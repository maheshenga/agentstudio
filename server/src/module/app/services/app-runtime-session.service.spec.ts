import {
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';

import { AppLicenseAccessService } from '../../app-commerce/services/app-license-access.service';
import { SysUserTenantEntity } from '../../system/user/entities/user-tenant.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppRuntimeAuditLogEntity } from '../entities/app-runtime-audit-log.entity';
import { AppRuntimeSessionEntity } from '../entities/app-runtime-session.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';
import { AppCapabilityPolicyService } from './app-capability-policy.service';
import { AppRuntimeSessionService } from './app-runtime-session.service';
import { SaasModuleService } from '../../saas/services/saas-module.service';
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
import { RedisService } from '../../../redis/redis.service';

describe('AppRuntimeSessionService', () => {
  const sessionRepo = {
    create: jest.fn((value) => ({ ...value })),
    findOne: jest.fn(),
    save: jest.fn(async (value) => ({ id: value.id ?? 41, ...value })),
    update: jest.fn(),
  };
  const auditRepo = {
    create: jest.fn((value) => ({ ...value })),
    save: jest.fn(async (value) => value),
  };
  const installRepo = { findOne: jest.fn() };
  const appRepo = { findOne: jest.fn() };
  const versionRepo = { findOne: jest.fn() };
  const membershipRepo = { findOne: jest.fn() };
  const capabilityPolicy = { resolveGrantedCapabilities: jest.fn() };
  const saasModuleService = { assertTenantModuleEnabled: jest.fn() };
  const systemModuleAccessService = { assertModuleAccess: jest.fn() };
  const appLicenseAccessService = { getAccessState: jest.fn() };
  const redisClient = { eval: jest.fn() };
  const redisService = { getClient: jest.fn(() => redisClient) };

  let service: AppRuntimeSessionService;

  const issueInput = {
    tenantId: 23,
    userId: 91,
    appId: 10,
    versionId: 20,
    installId: 30,
    capabilities: ['context.read'] as const,
  };

  const activeSession = () => ({
    id: 41,
    tokenHash: 'a'.repeat(64),
    tenantId: 23,
    userId: 91,
    appId: 10,
    versionId: 20,
    installId: 30,
    capabilities: ['context.read'],
    expiresTime: new Date(Date.now() + 120_000),
    revokedTime: null,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.APP_RUNTIME_CAPABILITIES_ENABLED = 'true';
    delete process.env.APP_RUNTIME_SESSION_TTL_SECONDS;
    delete process.env.APP_RUNTIME_CAPABILITY_RATE_LIMIT_PER_MINUTE;
    installRepo.findOne.mockResolvedValue({
      id: 30,
      tenantId: 23,
      appId: 10,
      versionId: 20,
      enabled: 1,
    });
    appRepo.findOne.mockResolvedValue({
      id: 10,
      status: 'published',
      saasModuleCode: 'recruiting',
      systemModuleCode: 'job_board',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 20,
      appId: 10,
      reviewStatus: 'approved',
      publishStatus: 'published',
    });
    membershipRepo.findOne.mockResolvedValue({ id: 7, tenantId: 23, userId: 91 });
    capabilityPolicy.resolveGrantedCapabilities.mockResolvedValue(['context.read']);
    saasModuleService.assertTenantModuleEnabled.mockResolvedValue(true);
    systemModuleAccessService.assertModuleAccess.mockResolvedValue(true);
    appLicenseAccessService.getAccessState.mockResolvedValue({
      commerce_enabled: false,
      access_status: 'legacy_free',
      can_install: true,
      can_open: true,
      action: 'open',
      license_expires_at: null,
      plans: [],
    });
    redisClient.eval.mockResolvedValue([1, 60]);

    const module = await Test.createTestingModule({
      providers: [
        AppRuntimeSessionService,
        { provide: getRepositoryToken(AppRuntimeSessionEntity), useValue: sessionRepo },
        { provide: getRepositoryToken(AppRuntimeAuditLogEntity), useValue: auditRepo },
        { provide: getRepositoryToken(TenantAppInstallEntity), useValue: installRepo },
        { provide: getRepositoryToken(AppPackageEntity), useValue: appRepo },
        { provide: getRepositoryToken(AppPackageVersionEntity), useValue: versionRepo },
        { provide: getRepositoryToken(SysUserTenantEntity), useValue: membershipRepo },
        { provide: AppCapabilityPolicyService, useValue: capabilityPolicy },
        { provide: SaasModuleService, useValue: saasModuleService },
        { provide: SystemModuleAccessService, useValue: systemModuleAccessService },
        { provide: AppLicenseAccessService, useValue: appLicenseAccessService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();
    service = module.get(AppRuntimeSessionService);
  });

  afterEach(() => {
    delete process.env.APP_RUNTIME_CAPABILITIES_ENABLED;
    delete process.env.APP_RUNTIME_SESSION_TTL_SECONDS;
    delete process.env.APP_RUNTIME_CAPABILITY_RATE_LIMIT_PER_MINUTE;
  });

  it('issues a one-time raw token while persisting only its digest', async () => {
    const result = await service.issue({ ...issueInput, capabilities: ['context.read'] });
    const saved = sessionRepo.save.mock.calls[0][0];

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.capabilities).toEqual(['context.read']);
    expect(saved.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(saved)).not.toContain(result.token);
    expect(new Date(result.expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(installRepo.findOne).toHaveBeenCalledWith({
      where: {
        id: 30,
        tenantId: 23,
        appId: 10,
        versionId: 20,
        enabled: 1,
        deleteTime: IsNull(),
      },
    });
  });

  it('refuses to issue a session when any authority binding is inactive', async () => {
    membershipRepo.findOne.mockResolvedValue(null);
    await expect(
      service.issue({ ...issueInput, capabilities: ['context.read'] }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('refuses to issue capabilities outside the current platform and tenant grants', async () => {
    capabilityPolicy.resolveGrantedCapabilities.mockResolvedValue([]);
    await expect(
      service.issue({ ...issueInput, capabilities: ['context.read'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('clamps configured session TTL to the supported bounds', async () => {
    process.env.APP_RUNTIME_SESSION_TTL_SECONDS = '9999';
    const result = await service.issue({ ...issueInput, capabilities: ['context.read'] });
    const ttl = new Date(result.expires_at).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(890_000);
    expect(ttl).toBeLessThanOrEqual(900_000);
  });

  it('fails closed when runtime capabilities are disabled', async () => {
    process.env.APP_RUNTIME_CAPABILITIES_ENABLED = 'false';
    await expect(
      service.issue({ ...issueInput, capabilities: ['context.read'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('authorizes a valid session and updates last use with bounded audit metadata', async () => {
    sessionRepo.findOne.mockResolvedValue(activeSession());

    await expect(
      service.authorize('raw-runtime-token', 'context.read', {
        requestId: 'req-1',
        ip: '127.0.0.1',
        userAgent: 'jest',
      }),
    ).resolves.toMatchObject({ tenantId: 23, userId: 91, appId: 10, versionId: 20 });

    expect(sessionRepo.update).toHaveBeenCalledWith(41, { lastUsedTime: expect.any(Date) });
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'allowed', reasonCode: 'authorized', requestId: 'req-1' }),
    );
    expect(JSON.stringify(auditRepo.create.mock.calls)).not.toContain('raw-runtime-token');
    expect(redisClient.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'app_runtime:rate:41:context.read',
      60,
      120,
    );
    expect(JSON.stringify(redisClient.eval.mock.calls)).not.toContain('raw-runtime-token');
  });

  it('clamps the configured per-session capability rate limit', async () => {
    process.env.APP_RUNTIME_CAPABILITY_RATE_LIMIT_PER_MINUTE = '9999';
    sessionRepo.findOne.mockResolvedValue(activeSession());

    await service.authorize('raw-runtime-token', 'context.read', {});

    expect(redisClient.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'app_runtime:rate:41:context.read',
      60,
      1000,
    );
  });

  it('returns a bounded retry interval and audits when the capability rate limit is exceeded', async () => {
    sessionRepo.findOne.mockResolvedValue(activeSession());
    redisClient.eval.mockResolvedValue([121, 47]);

    let error: unknown;
    try {
      await service.authorize('raw-runtime-token', 'context.read', {});
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect((error as HttpException).getResponse()).toEqual({
      statusCode: 429,
      message: 'App runtime capability rate limit exceeded',
      error: 'Too Many Requests',
      retry_after: 47,
    });
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied', reasonCode: 'rate_limited' }),
    );
    expect(sessionRepo.update).not.toHaveBeenCalled();
  });

  it('writes only one rate-limit audit per session capability window', async () => {
    sessionRepo.findOne.mockResolvedValue(activeSession());
    redisClient.eval.mockResolvedValueOnce([121, 47]).mockResolvedValueOnce([122, 46]);

    await expect(service.authorize('raw-runtime-token', 'context.read', {})).rejects.toMatchObject({
      status: 429,
    });
    await expect(service.authorize('raw-runtime-token', 'context.read', {})).rejects.toMatchObject({
      status: 429,
    });

    expect(auditRepo.create).toHaveBeenCalledTimes(1);
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied', reasonCode: 'rate_limited' }),
    );
  });

  it('fails closed with a fixed response and bounded audit when Redis is unavailable', async () => {
    sessionRepo.findOne.mockResolvedValue(activeSession());
    redisClient.eval.mockRejectedValue(new Error('redis secret connection details'));

    let error: unknown;
    try {
      await service.authorize('raw-runtime-token', 'context.read', {});
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).message).toBe(
      'App runtime rate limit is unavailable',
    );
    expect(JSON.stringify(error)).not.toContain('redis secret connection details');
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied', reasonCode: 'rate_limit_unavailable' }),
    );
    expect(sessionRepo.update).not.toHaveBeenCalled();
  });

  it('keeps the fixed unavailable response when the failure audit cannot be stored', async () => {
    sessionRepo.findOne.mockResolvedValue(activeSession());
    redisClient.eval.mockRejectedValue(new Error('redis internal failure'));
    auditRepo.save.mockRejectedValueOnce(new Error('database internal failure'));

    await expect(service.authorize('raw-runtime-token', 'context.read', {})).rejects.toMatchObject({
      status: 503,
      message: 'App runtime rate limit is unavailable',
    });
  });

  it.each([
    ['unknown token', null, 'unknown_token'],
    ['expired token', { ...activeSession(), expiresTime: new Date(Date.now() - 1) }, 'expired'],
    ['revoked token', { ...activeSession(), revokedTime: new Date() }, 'revoked'],
  ])('rejects an %s', async (_label, session, reasonCode) => {
    sessionRepo.findOne.mockResolvedValue(session);

    await expect(
      service.authorize('invalid-runtime-token', 'context.read', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied', reasonCode }),
    );
  });

  it('rejects capabilities missing from the session snapshot', async () => {
    sessionRepo.findOne.mockResolvedValue({ ...activeSession(), capabilities: [] });
    await expect(service.authorize('raw-runtime-token', 'context.read', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied', reasonCode: 'capability_missing' }),
    );
  });

  it('rejects sessions after installation, publication, membership, or consent is lost', async () => {
    sessionRepo.findOne.mockResolvedValue(activeSession());
    membershipRepo.findOne.mockResolvedValue(null);

    await expect(service.authorize('raw-runtime-token', 'context.read', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(membershipRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 23, userId: 91, deleteTime: IsNull() },
      select: { id: true },
    });
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied', reasonCode: 'membership_inactive' }),
    );
  });

  it('rejects a session after SaaS plan entitlement is lost', async () => {
    sessionRepo.findOne.mockResolvedValue(activeSession());
    saasModuleService.assertTenantModuleEnabled.mockRejectedValue(
      new Error('plan entitlement lost'),
    );

    await expect(service.authorize('raw-runtime-token', 'context.read', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(saasModuleService.assertTenantModuleEnabled).toHaveBeenCalledWith(23, 'recruiting');
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied', reasonCode: 'entitlement_inactive' }),
    );
  });

  it('rejects a session after the tenant system module is disabled', async () => {
    sessionRepo.findOne.mockResolvedValue(activeSession());
    systemModuleAccessService.assertModuleAccess.mockRejectedValue(new Error('module disabled'));

    await expect(service.authorize('raw-runtime-token', 'context.read', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(systemModuleAccessService.assertModuleAccess).toHaveBeenCalledWith({
      tenantId: 23,
      moduleCode: 'job_board',
      requiredSaasModuleCode: 'recruiting',
    });
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied', reasonCode: 'entitlement_inactive' }),
    );
  });

  it('denies runtime-session issue and authorization after the application license is lost', async () => {
    appLicenseAccessService.getAccessState.mockResolvedValue({
      commerce_enabled: true,
      access_status: 'expired',
      can_install: false,
      can_open: false,
      action: 'renew',
      license_expires_at: '2026-07-01T00:00:00.000Z',
      plans: [],
    });

    await expect(
      service.issue({ ...issueInput, capabilities: ['context.read'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessionRepo.save).not.toHaveBeenCalled();

    sessionRepo.findOne.mockResolvedValue(activeSession());
    await expect(service.authorize('raw-runtime-token', 'context.read', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied', reasonCode: 'entitlement_inactive' }),
    );
  });

  it('revokes all active sessions bound to an installation or version', async () => {
    sessionRepo.update.mockResolvedValue({ affected: 2 });
    await expect(service.revokeInstall(23, 30, 'uninstalled')).resolves.toBe(2);
    await expect(service.revokeVersion(20, 'unpublished')).resolves.toBe(2);
    expect(sessionRepo.update).toHaveBeenNthCalledWith(
      1,
      { tenantId: 23, installId: 30, revokedTime: IsNull() },
      { revokedTime: expect.any(Date), revokeReason: 'uninstalled' },
    );
  });
});
