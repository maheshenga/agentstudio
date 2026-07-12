import { TenantContext } from '../../common/tenant/tenant.context';
import { PATH_METADATA } from '@nestjs/common/constants';
import { AppServicePlatformController } from './app-service-platform.controller';
import { AppPlatformService } from './services/app-platform.service';
import { AppServiceRuntimeService } from './services/app-service-runtime.service';

describe('AppServicePlatformController', () => {
  const platformService = {
    startServiceCandidate: jest.fn(),
    publishServiceCandidate: jest.fn(),
    rollbackServiceVersion: jest.fn(),
    stopServiceCandidate: jest.fn(),
    reconcileServiceRuntime: jest.fn(),
    probeActiveService: jest.fn(),
  };
  const runtimeService = {
    listRuntimeInstances: jest.fn(),
    getRuntimeApp: jest.fn(),
    getRuntimeLogs: jest.fn(),
  };
  let controller: AppServicePlatformController;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(TenantContext, 'run').mockImplementation((_, callback) => callback() as any);
    controller = new AppServicePlatformController(
      platformService as unknown as AppPlatformService,
      runtimeService as unknown as AppServiceRuntimeService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['listInstances', 'app:runtime:list'],
    ['getAppRuntime', 'app:runtime:list'],
    ['startCandidate', 'app:runtime:manage'],
    ['stopCandidate', 'app:runtime:manage'],
    ['publishCandidate', 'app:runtime:manage'],
    ['rollback', 'app:runtime:manage'],
    ['probe', 'app:runtime:probe'],
    ['logs', 'app:runtime:logs'],
    ['reconcile', 'app:runtime:manage'],
  ])('requires the exact permission for %s', (methodName, permission) => {
    expect(Reflect.getMetadata('requirePermission', (controller as any)[methodName])).toEqual([
      permission,
    ]);
  });

  it('keeps the runtime route surface stable', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AppServicePlatformController)).toBe(
      'api/app-platform/runtime',
    );
    expect(Reflect.getMetadata(PATH_METADATA, controller.listInstances)).toBe('instances');
    expect(Reflect.getMetadata(PATH_METADATA, controller.getAppRuntime)).toBe('apps/:code');
    expect(Reflect.getMetadata(PATH_METADATA, controller.startCandidate)).toBe(
      'apps/:code/versions/:version/candidate',
    );
    expect(Reflect.getMetadata(PATH_METADATA, controller.stopCandidate)).toBe(
      'apps/:code/versions/:version/candidate/stop',
    );
    expect(Reflect.getMetadata(PATH_METADATA, controller.publishCandidate)).toBe(
      'apps/:code/versions/:version/publish',
    );
    expect(Reflect.getMetadata(PATH_METADATA, controller.rollback)).toBe(
      'apps/:code/versions/:version/rollback',
    );
    expect(Reflect.getMetadata(PATH_METADATA, controller.probe)).toBe('apps/:code/probe');
    expect(Reflect.getMetadata(PATH_METADATA, controller.logs)).toBe('apps/:code/logs');
    expect(Reflect.getMetadata(PATH_METADATA, controller.reconcile)).toBe('reconcile');
  });

  it('lists stable runtime instances outside tenant filtering', async () => {
    runtimeService.listRuntimeInstances.mockResolvedValue([
      {
        id: '1',
        app_code: 'admin_echo_service',
        version: '1.0.0',
        process_name: 'agentstudio-app-admin-echo-service-1-0-0',
        role: 'active',
      },
    ]);

    const result = await controller.listInstances({ role: 'active' }, { userId: 9 } as any);

    expect(TenantContext.run).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: undefined, userId: 9, ignoreTenant: true }),
      expect.any(Function),
    );
    expect(runtimeService.listRuntimeInstances).toHaveBeenCalledWith({ role: 'active' });
    expect(result).toMatchObject({ code: 200 });
    expect(JSON.stringify(result)).not.toMatch(/release_dir|releaseDir|environment|command/i);
  });

  it('derives lifecycle operator identity only from the authenticated user', async () => {
    platformService.startServiceCandidate.mockResolvedValue({ app_code: 'svc' });
    platformService.publishServiceCandidate.mockResolvedValue({ app_code: 'svc' });
    platformService.rollbackServiceVersion.mockResolvedValue({ app_code: 'svc' });
    platformService.stopServiceCandidate.mockResolvedValue({ app_code: 'svc' });
    platformService.reconcileServiceRuntime.mockResolvedValue({ restarted: 1 });

    await controller.startCandidate('svc', '2.0.0', { userId: 9 } as any);
    await controller.publishCandidate('svc', '2.0.0', { userId: 9 } as any);
    await controller.rollback('svc', '1.0.0', { reason: 'restore' }, { userId: 9 } as any);
    await controller.stopCandidate('svc', '2.0.0', { reason: 'cancel' }, { userId: 9 } as any);
    await controller.reconcile({ userId: 9 } as any);

    expect(platformService.startServiceCandidate).toHaveBeenCalledWith('svc', '2.0.0', 9);
    expect(platformService.publishServiceCandidate).toHaveBeenCalledWith('svc', '2.0.0', 9);
    expect(platformService.rollbackServiceVersion).toHaveBeenCalledWith(
      'svc',
      '1.0.0',
      'restore',
      9,
    );
    expect(platformService.stopServiceCandidate).toHaveBeenCalledWith(
      'svc',
      '2.0.0',
      'cancel',
      9,
    );
  });

  it('passes only bounded probe payload and log line count to runtime services', async () => {
    platformService.probeActiveService.mockResolvedValue({ body: { ok: true } });
    runtimeService.getRuntimeLogs.mockResolvedValue({ stdout: '', stderr: '' });

    await controller.probe('svc', { payload: { ping: true } }, { userId: 9 } as any);
    await controller.logs('svc', { lines: 100 }, { userId: 9 } as any);

    expect(platformService.probeActiveService).toHaveBeenCalledWith('svc', { ping: true }, 9);
    expect(runtimeService.getRuntimeLogs).toHaveBeenCalledWith('svc', 100);
  });
});
