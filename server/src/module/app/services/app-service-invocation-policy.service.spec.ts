import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AppLicenseAccessService } from '../../app-commerce/services/app-license-access.service';
import type { AuthorizedAppRuntimeSession } from './app-runtime-session.service';
import { AppServiceInvocationPolicyService } from './app-service-invocation-policy.service';

describe('AppServiceInvocationPolicyService', () => {
  const session: AuthorizedAppRuntimeSession = {
    id: 7,
    tenantId: 23,
    userId: 91,
    appId: 10,
    versionId: 20,
    installId: 30,
    capabilities: ['service.invoke'],
  };
  const callerVersion = {
    id: 20,
    appId: 10,
    version: '1.0.0',
    serviceTargets: ['workflow_service'],
  };
  const targetApp = {
    id: 40,
    code: 'workflow_service',
    type: 'service',
    runtimeType: 'service',
    trustLevel: 'developer_restricted',
    status: 'published',
    developerId: 17,
    saasModuleCode: '',
    systemModuleCode: '',
  };
  const targetInstall = {
    id: 50,
    tenantId: 23,
    appId: 40,
    versionId: 60,
    enabled: 1,
  };
  const targetVersion = {
    id: 60,
    appId: 40,
    version: '2.0.0',
    reviewStatus: 'approved',
    publishStatus: 'published',
  };
  const targetInstance = {
    id: 70,
    appId: 40,
    versionId: 60,
    role: 'active',
    processStatus: 'online',
    healthStatus: 'healthy',
  };

  const appRepo = { findOne: jest.fn() };
  const versionRepo = { findOne: jest.fn() };
  const installRepo = { findOne: jest.fn() };
  const instanceRepo = { findOne: jest.fn(), update: jest.fn() };
  const invocationRepo = {
    create: jest.fn((value) => ({ ...value })),
    save: jest.fn(async (value) => ({ id: 1, ...value })),
    delete: jest.fn(),
  };
  const redisClient = { eval: jest.fn() };
  const redisService = { getClient: jest.fn(() => redisClient) };
  const saasModuleService = { assertTenantModuleEnabled: jest.fn() };
  const systemModuleAccessService = { assertModuleAccess: jest.fn() };
  const appLicenseAccessService = { getAccessState: jest.fn() };
  const runtimeService = { invokeAuthorized: jest.fn() };
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const values: Record<string, number> = {
        'appMarketplace.developerService.concurrency': 20,
        'appMarketplace.developerService.ratePerMinute': 60,
        'appMarketplace.developerService.circuitFailures': 5,
        'appMarketplace.developerService.circuitOpenSeconds': 60,
      };
      return values[key] ?? fallback;
    }),
  };
  let service: AppServiceInvocationPolicyService;

  beforeEach(() => {
    jest.clearAllMocks();
    versionRepo.findOne.mockReset();
    appRepo.findOne.mockReset();
    installRepo.findOne.mockReset();
    instanceRepo.findOne.mockReset();
    instanceRepo.update.mockReset();
    invocationRepo.create.mockReset().mockImplementation((value) => ({ ...value }));
    invocationRepo.save.mockReset().mockImplementation(async (value) => ({ id: 1, ...value }));
    invocationRepo.delete.mockReset().mockResolvedValue({ affected: 0 });
    redisClient.eval.mockReset();
    saasModuleService.assertTenantModuleEnabled.mockReset().mockResolvedValue(undefined);
    systemModuleAccessService.assertModuleAccess.mockReset().mockResolvedValue(undefined);
    appLicenseAccessService.getAccessState.mockReset().mockResolvedValue({
      commerce_enabled: false,
      access_status: 'legacy_free',
      can_install: true,
      can_open: true,
      action: 'open',
      license_expires_at: null,
      plans: [],
    });
    runtimeService.invokeAuthorized.mockReset();
    versionRepo.findOne
      .mockResolvedValueOnce(callerVersion)
      .mockResolvedValueOnce(targetVersion);
    appRepo.findOne.mockResolvedValue(targetApp);
    installRepo.findOne.mockResolvedValue(targetInstall);
    instanceRepo.findOne.mockResolvedValue(targetInstance);
    instanceRepo.update.mockResolvedValue({ affected: 1 });
    redisClient.eval
      .mockResolvedValueOnce([0, 0, 1])
      .mockResolvedValueOnce([0, 0])
      .mockResolvedValueOnce(0);
    runtimeService.invokeAuthorized.mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: { ok: true },
    });
    service = new AppServiceInvocationPolicyService(
      appRepo as any,
      versionRepo as any,
      installRepo as any,
      instanceRepo as any,
      invocationRepo as any,
      redisService as any,
      configService as any,
      saasModuleService as any,
      systemModuleAccessService as any,
      appLicenseAccessService as any,
      runtimeService as any,
    );
  });

  it('rejects a target absent from the caller service target snapshot before lookup', async () => {
    await expect(service.invoke(session, 'reporting_service', { value: 1 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(appRepo.findOne).not.toHaveBeenCalled();
    expect(redisClient.eval).not.toHaveBeenCalled();
    expect(runtimeService.invokeAuthorized).not.toHaveBeenCalled();
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'rejected', errorCode: 'service_target_not_declared' }),
    );
  });

  it('fails closed when Redis quota state is unavailable or malformed', async () => {
    redisClient.eval.mockReset().mockResolvedValue(['invalid']);

    await expect(service.invoke(session, 'workflow_service', {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(runtimeService.invokeAuthorized).not.toHaveBeenCalled();
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'rejected', errorCode: 'service_quota_unavailable' }),
    );
  });

  it('rejects null Redis quota values instead of coercing them to zero', async () => {
    redisClient.eval.mockReset().mockResolvedValue([null, 0, 0]);

    await expect(service.invoke(session, 'workflow_service', {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(runtimeService.invokeAuthorized).not.toHaveBeenCalled();
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'rejected', errorCode: 'service_quota_unavailable' }),
    );
  });

  it('rejects an installed version that is not the current published target version', async () => {
    installRepo.findOne.mockResolvedValue({ ...targetInstall, versionId: 61 });

    await expect(service.invoke(session, 'workflow_service', {})).rejects.toMatchObject({
      status: 409,
    });
    expect(instanceRepo.findOne).not.toHaveBeenCalled();
    expect(runtimeService.invokeAuthorized).not.toHaveBeenCalled();
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'rejected', errorCode: 'service_target_version_mismatch' }),
    );
  });

  it('resolves only a same-tenant enabled install bound to the current published version', async () => {
    await service.invoke(session, 'workflow_service', {});

    expect(installRepo.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenantId: 23, appId: 40, enabled: 1 }),
    });
    expect(versionRepo.findOne).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          appId: 40,
          reviewStatus: 'approved',
          publishStatus: 'published',
        }),
        order: { id: 'DESC' },
      }),
    );
  });

  it('rejects an uninstalled target before quota acquisition', async () => {
    installRepo.findOne.mockResolvedValue(null);

    await expect(service.invoke(session, 'workflow_service', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(redisClient.eval).not.toHaveBeenCalled();
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'rejected', errorCode: 'service_target_not_installed' }),
    );
  });

  it('rejects an unpublished target version before quota acquisition', async () => {
    versionRepo.findOne
      .mockReset()
      .mockResolvedValueOnce(callerVersion)
      .mockResolvedValueOnce(null);

    await expect(service.invoke(session, 'workflow_service', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(redisClient.eval).not.toHaveBeenCalled();
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'rejected', errorCode: 'service_target_unpublished' }),
    );
  });

  it('rejects an unentitled target before quota acquisition', async () => {
    appRepo.findOne.mockResolvedValue({ ...targetApp, saasModuleCode: 'workflow' });
    saasModuleService.assertTenantModuleEnabled.mockRejectedValueOnce(new Error('not entitled'));

    await expect(service.invoke(session, 'workflow_service', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(redisClient.eval).not.toHaveBeenCalled();
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'rejected', errorCode: 'service_target_not_entitled' }),
    );
  });

  it('denies restricted service target invocation when the target license is inactive', async () => {
    appLicenseAccessService.getAccessState.mockResolvedValue({
      commerce_enabled: true,
      access_status: 'revoked',
      can_install: false,
      can_open: false,
      action: 'contact_admin',
      license_expires_at: null,
      plans: [],
    });

    await expect(service.invoke(session, 'workflow_service', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(appLicenseAccessService.getAccessState).toHaveBeenCalledWith(
      23,
      expect.objectContaining({ id: 40, code: 'workflow_service' }),
    );
    expect(runtimeService.invokeAuthorized).not.toHaveBeenCalled();
    expect(redisClient.eval).not.toHaveBeenCalled();
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'rejected', errorCode: 'service_target_not_entitled' }),
    );
  });

  it('rejects an unhealthy target before quota acquisition', async () => {
    instanceRepo.findOne.mockResolvedValue(null);

    await expect(service.invoke(session, 'workflow_service', {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(redisClient.eval).not.toHaveBeenCalled();
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'rejected', errorCode: 'service_target_unhealthy' }),
    );
  });

  it.each([
    ['rate limit', [2, 42, 0], 429, 'service_rate_limited', 42],
    ['open circuit', [3, 55, 0], 503, 'service_circuit_open', 55],
  ])(
    'returns bounded retry_after for %s rejection',
    async (_label, quotaResult, status, errorCode, retryAfter) => {
      redisClient.eval.mockReset().mockResolvedValue(quotaResult);

      let caught: HttpException | undefined;
      try {
        await service.invoke(session, 'workflow_service', {});
      } catch (error) {
        caught = error as HttpException;
      }

      expect(caught).toBeInstanceOf(HttpException);
      expect(caught?.getStatus()).toBe(status);
      expect(caught?.getResponse()).toMatchObject({
        message: errorCode,
        retry_after: retryAfter,
      });
      expect(runtimeService.invokeAuthorized).not.toHaveBeenCalled();
      expect(redisClient.eval).toHaveBeenCalledTimes(1);
    },
  );

  it('derives context from the session, releases concurrency in finally, and records no payload', async () => {
    const result = await service.invoke(session, 'workflow_service', { secret: 'payload' });

    expect(result).toEqual({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { ok: true },
    });
    expect(runtimeService.invokeAuthorized).toHaveBeenCalledWith(
      targetApp,
      targetVersion,
      {
        tenant: { id: '23' },
        user: { id: '91' },
        caller: { app_id: '10', version_id: '20' },
      },
      { secret: 'payload' },
    );
    expect(redisClient.eval).toHaveBeenCalledTimes(3);
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success', statusCode: 200, errorCode: '' }),
    );
    expect(JSON.stringify(invocationRepo.save.mock.calls)).not.toContain('payload');
    expect(JSON.stringify(redisClient.eval.mock.calls)).not.toContain('payload');
    expect(JSON.stringify(redisClient.eval.mock.calls)).not.toContain('runtime-token');
  });

  it('opens and mirrors the circuit after the configured consecutive service failures', async () => {
    redisClient.eval
      .mockReset()
      .mockResolvedValueOnce([0, 0, 1])
      .mockResolvedValueOnce([5, 60])
      .mockResolvedValueOnce(0);
    runtimeService.invokeAuthorized.mockResolvedValue({
      statusCode: 503,
      headers: {},
      body: { error: 'unavailable' },
    });

    await expect(service.invoke(session, 'workflow_service', {})).resolves.toMatchObject({
      status: 503,
    });

    expect(instanceRepo.update).toHaveBeenCalledWith(
      { id: 70 },
      expect.objectContaining({
        consecutiveFailures: 5,
        circuitState: 'open',
        circuitOpenUntil: expect.any(Date),
      }),
    );
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', statusCode: 503 }),
    );
  });

  it('counts a loopback transport exception, records it, and releases the lease', async () => {
    runtimeService.invokeAuthorized.mockRejectedValue(
      new BadGatewayException('upstream details must not escape'),
    );

    await expect(service.invoke(session, 'workflow_service', {})).rejects.toBeInstanceOf(
      BadGatewayException,
    );

    expect(redisClient.eval).toHaveBeenCalledTimes(3);
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failure',
        statusCode: 502,
        errorCode: 'service_gateway_failure',
      }),
    );
  });

  it('does not count runtime authorization revalidation as a target service failure', async () => {
    runtimeService.invokeAuthorized.mockRejectedValue(
      new BadRequestException('certification changed'),
    );

    await expect(service.invoke(session, 'workflow_service', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(redisClient.eval).toHaveBeenCalledTimes(2);
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'rejected',
        statusCode: 400,
        errorCode: 'service_target_policy_changed',
      }),
    );
    expect(instanceRepo.update).not.toHaveBeenCalledWith(
      { id: 70 },
      expect.objectContaining({ consecutiveFailures: expect.any(Number) }),
    );
  });

  it('resets failures after success without exposing circuit metadata in the result', async () => {
    const result = await service.invoke(session, 'workflow_service', {});

    expect(result).toEqual({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { ok: true },
    });
    expect(String(redisClient.eval.mock.calls[1][0])).toContain("redis.call('DEL', KEYS[1])");
    expect(instanceRepo.update).toHaveBeenCalledWith(
      { id: 70 },
      expect.objectContaining({
        consecutiveFailures: 0,
        circuitState: 'closed',
        lastSuccessTime: expect.any(Date),
      }),
    );
  });

  it('keeps invocation metrics and instance mirrors best effort after authorization', async () => {
    instanceRepo.update
      .mockRejectedValueOnce(new Error('mirror unavailable'))
      .mockRejectedValueOnce(new Error('mirror unavailable'))
      .mockResolvedValue({ affected: 1 });
    invocationRepo.save.mockRejectedValueOnce(new Error('metrics unavailable'));

    await expect(service.invoke(session, 'workflow_service', {})).resolves.toMatchObject({
      status: 200,
    });
    expect(runtimeService.invokeAuthorized).toHaveBeenCalledTimes(1);
    expect(redisClient.eval).toHaveBeenCalledTimes(3);
  });

  it('fails closed on circuit-state loss without counting it as a target failure', async () => {
    redisClient.eval
      .mockReset()
      .mockResolvedValueOnce([0, 0, 1])
      .mockRejectedValueOnce(new Error('redis unavailable'))
      .mockResolvedValueOnce(0);

    await expect(service.invoke(session, 'workflow_service', {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(runtimeService.invokeAuthorized).toHaveBeenCalledTimes(1);
    expect(redisClient.eval).toHaveBeenCalledTimes(3);
    expect(invocationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'rejected',
        errorCode: 'service_quota_unavailable',
      }),
    );
    expect(instanceRepo.update).not.toHaveBeenCalledWith(
      { id: 70 },
      expect.objectContaining({ consecutiveFailures: expect.any(Number) }),
    );
  });

  it('schedules retention cleanup without blocking a successful invocation', async () => {
    configService.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'appMarketplace.developerService.logRetentionDays') return 7;
      const values: Record<string, number> = {
        'appMarketplace.developerService.concurrency': 20,
        'appMarketplace.developerService.ratePerMinute': 60,
        'appMarketplace.developerService.circuitFailures': 5,
        'appMarketplace.developerService.circuitOpenSeconds': 60,
      };
      return values[key] ?? fallback;
    });
    invocationRepo.delete.mockRejectedValueOnce(new Error('cleanup unavailable'));

    await expect(service.invoke(session, 'workflow_service', {})).resolves.toMatchObject({
      status: 200,
    });
    await Promise.resolve();

    expect(invocationRepo.delete).toHaveBeenCalledWith({
      createTime: expect.anything(),
    });
  });
});
