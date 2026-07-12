import { BadRequestException } from '@nestjs/common';
import { createServer } from 'net';
import type { AddressInfo } from 'net';

import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppReviewLogEntity } from '../entities/app-review-log.entity';
import { AppServiceInstanceEntity } from '../entities/app-service-instance.entity';
import { AppServiceLogRedactor } from './app-service-log-redactor';
import {
  AppServiceDelay,
  AppServicePortAllocator,
  AppServiceRuntimeService,
  NodeAppServicePortAllocator,
} from './app-service-runtime.service';

describe('AppServiceRuntimeService', () => {
  let apps: any[];
  let versions: any[];
  let instances: any[];
  let audits: any[];
  let appRepo: MemoryRepository;
  let versionRepo: MemoryRepository;
  let instanceRepo: MemoryRepository;
  let auditRepo: MemoryRepository;
  let processManager: Record<string, jest.Mock>;
  let transport: Record<string, jest.Mock>;
  let portAllocator: { allocate: jest.Mock };
  let delay: { wait: jest.Mock };
  let certificationService: { assertRuntimeApproved: jest.Mock };
  let snapshotService: { verify: jest.Mock };
  let packageService: { verifyInstalledEntry: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let service: AppServiceRuntimeService;

  beforeEach(() => {
    apps = [
      {
        id: 1,
        code: 'admin_echo_service',
        name: 'Admin Echo Service',
        type: 'service',
        status: 'published',
        entryMode: 'service',
        entryUrl: '',
        runtimeType: 'service',
        trustLevel: 'platform_trusted',
        serviceHealthPath: '/health',
      },
    ];
    versions = [
      createVersion(11, '1.0.0', 'published', 'healthy', 10, 12),
      createVersion(12, '2.0.0', 'unpublished', 'unknown', 20, 21),
    ];
    instances = [
      createInstance({
        id: 101,
        versionId: 11,
        processName: 'agentstudio-app-admin-echo-service-1-0-0',
        loopbackPort: 21001,
        role: 'active',
        processStatus: 'online',
        healthStatus: 'healthy',
      }),
    ];
    audits = [];
    appRepo = new MemoryRepository(apps);
    versionRepo = new MemoryRepository(versions);
    instanceRepo = new MemoryRepository(instances);
    auditRepo = new MemoryRepository(audits);
    processManager = {
      start: jest.fn(async (spec) => ({
        processName: spec.processName,
        status: 'online',
        pid: 300,
        restartCount: 0,
        memoryBytes: 100,
        cpuPercent: 0,
      })),
      stop: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
      describe: jest.fn(async (processName: string) => {
        const match = instances.find((item) => item.processName === processName);
        if (!match || match.processStatus !== 'online') return null;
        return {
          processName,
          status: 'online',
          pid: 300,
          restartCount: match.restartCount || 0,
          memoryBytes: 100,
          cpuPercent: 0,
        };
      }),
      logs: jest.fn(),
    };
    transport = {
      health: jest.fn(async () => ({ statusCode: 200, headers: {}, body: { status: 'ok' } })),
      invoke: jest.fn(async () => ({ statusCode: 200, headers: {}, body: { version: '1.0.0' } })),
    };
    portAllocator = { allocate: jest.fn(async () => 22001) };
    delay = { wait: jest.fn(async () => undefined) };
    certificationService = { assertRuntimeApproved: jest.fn(async () => ({ id: 5 })) };
    snapshotService = { verify: jest.fn() };
    packageService = { verifyInstalledEntry: jest.fn(async () => undefined) };
    const manager = {
      getRepository: (entity: unknown) => {
        if (entity === AppPackageEntity) return appRepo;
        if (entity === AppPackageVersionEntity) return versionRepo;
        if (entity === AppServiceInstanceEntity) return instanceRepo;
        if (entity === AppReviewLogEntity) return auditRepo;
        throw new Error('Unexpected repository');
      },
    };
    dataSource = { transaction: jest.fn(async (callback) => callback(manager)) };
    service = new AppServiceRuntimeService(
      appRepo as any,
      versionRepo as any,
      instanceRepo as any,
      auditRepo as any,
      dataSource as any,
      {
        get: jest.fn((key: string, fallback?: unknown) => {
          if (key === 'appMarketplace.serviceRuntime.enabled') return true;
          if (key === 'appMarketplace.serviceRuntime.healthSuccessCount') return 3;
          if (key === 'appMarketplace.serviceRuntime.memoryMb') return 256;
          if (key === 'appMarketplace.serviceRuntime.portMin') return 20000;
          if (key === 'appMarketplace.serviceRuntime.portMax') return 39999;
          return fallback;
        }),
      } as any,
      processManager as any,
      transport as any,
      portAllocator as unknown as AppServicePortAllocator,
      delay as unknown as AppServiceDelay,
      new AppServiceLogRedactor(),
      certificationService as any,
      snapshotService as any,
      packageService as any,
    );
  });

  it('keeps platform-trusted candidate behavior independent of developer certification', async () => {
    await service.startCandidate('admin_echo_service', '2.0.0', 99);

    expect(certificationService.assertRuntimeApproved).not.toHaveBeenCalled();
    expect(snapshotService.verify).not.toHaveBeenCalled();
    expect(packageService.verifyInstalledEntry).not.toHaveBeenCalled();
    expect(version(12).candidateReviewedBy).toBeUndefined();
  });

  it('starts a restricted candidate only for a live certification and independent candidate reviewer', async () => {
    app().trustLevel = 'developer_restricted';
    app().developerId = 17;
    Object.assign(version(12), {
      reviewSnapshot: { schema_version: 1 },
      reviewSnapshotHash: 'a'.repeat(64),
      serviceTargets: [],
    });

    await expect(service.startCandidate('admin_echo_service', '2.0.0', 20)).rejects.toThrow(
      'Candidate review requires a different platform operator',
    );
    await expect(service.startCandidate('admin_echo_service', '2.0.0', 21)).rejects.toThrow(
      'Candidate review requires a different platform operator',
    );
    expect(processManager.start).not.toHaveBeenCalled();

    await service.startCandidate('admin_echo_service', '2.0.0', 99);

    expect(certificationService.assertRuntimeApproved).toHaveBeenCalledWith(17, 'service');
    expect(snapshotService.verify).toHaveBeenCalledWith(version(12));
    expect(packageService.verifyInstalledEntry).toHaveBeenCalledWith(version(12));
    expect(version(12)).toMatchObject({
      candidateReviewedBy: 99,
      candidateReviewedTime: expect.any(Date),
      candidateHealthStatus: 'healthy',
    });
  });

  it('records no restricted candidate reviewer when health verification fails', async () => {
    app().trustLevel = 'developer_restricted';
    app().developerId = 17;
    Object.assign(version(12), {
      reviewSnapshot: { schema_version: 1 },
      reviewSnapshotHash: 'a'.repeat(64),
    });
    transport.health.mockResolvedValue({ statusCode: 503, body: { status: 'starting' } });

    await expect(service.startCandidate('admin_echo_service', '2.0.0', 99)).rejects.toThrow(
      'Candidate health verification failed',
    );

    expect(version(12).candidateReviewedBy).toBeNull();
    expect(version(12).candidateReviewedTime).toBeNull();
    expect(instance(101)).toMatchObject({ role: 'active', healthStatus: 'healthy' });
  });

  it('revalidates restricted certification, snapshot, and installed entry before publish', async () => {
    app().trustLevel = 'developer_restricted';
    app().developerId = 17;
    Object.assign(version(12), {
      reviewSnapshot: { schema_version: 1 },
      reviewSnapshotHash: 'a'.repeat(64),
      candidateHealthStatus: 'healthy',
      candidateReviewedBy: 99,
      candidateReviewedTime: new Date(),
    });
    instances.push(
      createInstance({
        id: 102,
        versionId: 12,
        processName: 'agentstudio-app-admin-echo-service-2-0-0',
        loopbackPort: 22001,
        role: 'candidate',
        processStatus: 'online',
        healthStatus: 'healthy',
      }),
    );

    await service.publishCandidate('admin_echo_service', '2.0.0', 77);

    expect(certificationService.assertRuntimeApproved).toHaveBeenCalledWith(17, 'service');
    expect(snapshotService.verify).toHaveBeenCalledWith(version(12));
    expect(packageService.verifyInstalledEntry).toHaveBeenCalledWith(version(12));
    expect(instance(102).role).toBe('active');
  });

  it('leaves the active instance unchanged when candidate start fails and stores no raw error', async () => {
    processManager.start.mockRejectedValue(new Error('password=private database=production'));

    await expect(service.startCandidate('admin_echo_service', '2.0.0', 99)).rejects.toThrow(
      'Candidate process failed to start',
    );

    expect(instance(101)).toMatchObject({ role: 'active', healthStatus: 'healthy' });
    expect(version(11)).toMatchObject({ publishStatus: 'published' });
    expect(apps[0]).toMatchObject({ status: 'published' });
    const failed = instances.find((item) => item.versionId === 12);
    expect(failed).toMatchObject({
      role: 'candidate',
      processStatus: 'failed',
      healthStatus: 'unhealthy',
      lastErrorCode: 'candidate_start_failed',
      lastErrorMessage: 'Candidate process failed to start',
    });
    expect(JSON.stringify(failed)).not.toContain('private');
    expect(processManager.stop).toHaveBeenCalledWith(failed.processName);
    expect(processManager.delete).toHaveBeenCalledWith(failed.processName);
  });

  it('requires three consecutive health successes before marking a candidate healthy', async () => {
    transport.health
      .mockResolvedValueOnce({ statusCode: 200, body: { status: 'ok' } })
      .mockResolvedValueOnce({ statusCode: 503, body: { status: 'starting' } })
      .mockResolvedValueOnce({ statusCode: 200, body: { status: 'ok' } })
      .mockResolvedValueOnce({ statusCode: 200, body: { status: 'ok' } })
      .mockResolvedValueOnce({ statusCode: 200, body: { status: 'ok' } });

    await expect(service.startCandidate('admin_echo_service', '2.0.0', 99)).resolves.toMatchObject({
      role: 'candidate',
      processStatus: 'online',
      healthStatus: 'healthy',
    });

    expect(transport.health).toHaveBeenCalledTimes(5);
    expect(version(12).candidateHealthStatus).toBe('healthy');
    expect(instance(101).role).toBe('active');
    expect(audits.find((item) => item.action === 'candidate_start')).toMatchObject({
      operatorId: 99,
    });
  });

  it('keeps active unchanged when candidate health never becomes healthy', async () => {
    transport.health.mockResolvedValue({ statusCode: 503, body: { status: 'starting' } });

    await expect(service.startCandidate('admin_echo_service', '2.0.0', 99)).rejects.toThrow(
      'Candidate health verification failed',
    );

    expect(instance(101)).toMatchObject({ role: 'active', healthStatus: 'healthy' });
    expect(version(11).publishStatus).toBe('published');
    expect(version(12).candidateHealthStatus).toBe('unhealthy');
    expect(instances.find((item) => item.versionId === 12)).toMatchObject({
      role: 'candidate',
      processStatus: 'failed',
      healthStatus: 'unhealthy',
    });
  });

  it('does not start an unapproved, failed-scan, or self-reviewed service version', async () => {
    version(12).reviewStatus = 'pending';
    await expect(service.startCandidate('admin_echo_service', '2.0.0', 99)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    version(12).reviewStatus = 'approved';
    version(12).scanResult = { passed: false };
    await expect(service.startCandidate('admin_echo_service', '2.0.0', 99)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    version(12).scanResult = { passed: true, findings: [] };
    version(12).reviewerId = version(12).submittedBy;
    await expect(service.startCandidate('admin_echo_service', '2.0.0', 99)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(processManager.start).not.toHaveBeenCalled();
  });

  it('does not create a duplicate candidate for a version already active or standby', async () => {
    await expect(service.startCandidate('admin_echo_service', '1.0.0', 99)).rejects.toThrow(
      'already active or standby',
    );
    expect(processManager.start).not.toHaveBeenCalled();
    expect(instances.filter((item) => item.versionId === 11)).toHaveLength(1);
  });

  it('does not publish an unhealthy candidate', async () => {
    instances.push(
      createInstance({
        id: 102,
        versionId: 12,
        processName: 'agentstudio-app-admin-echo-service-2-0-0',
        loopbackPort: 22001,
        role: 'candidate',
        processStatus: 'online',
        healthStatus: 'unhealthy',
      }),
    );

    await expect(service.publishCandidate('admin_echo_service', '2.0.0', 99)).rejects.toThrow(
      'healthy candidate',
    );
    expect(instance(101).role).toBe('active');
    expect(version(12).publishStatus).toBe('unpublished');
  });

  it('does not publish a stale healthy candidate whose PM2 process is no longer online', async () => {
    instances.push(
      createInstance({
        id: 102,
        versionId: 12,
        processName: 'agentstudio-app-admin-echo-service-2-0-0',
        loopbackPort: 22001,
        role: 'candidate',
        processStatus: 'online',
        healthStatus: 'healthy',
      }),
    );
    version(12).candidateHealthStatus = 'healthy';
    processManager.describe.mockResolvedValue(null);

    await expect(service.publishCandidate('admin_echo_service', '2.0.0', 99)).rejects.toThrow(
      'healthy candidate',
    );
    expect(instance(101).role).toBe('active');
    expect(instance(102).role).toBe('candidate');
  });

  it('atomically moves active to standby, candidate to active, and retires older standby', async () => {
    instances.push(
      createInstance({
        id: 100,
        versionId: 10,
        processName: 'agentstudio-app-admin-echo-service-0-9-0',
        loopbackPort: 20901,
        role: 'standby',
        processStatus: 'online',
        healthStatus: 'healthy',
      }),
      createInstance({
        id: 102,
        versionId: 12,
        processName: 'agentstudio-app-admin-echo-service-2-0-0',
        loopbackPort: 22001,
        role: 'candidate',
        processStatus: 'online',
        healthStatus: 'healthy',
      }),
    );
    versions.unshift(createVersion(10, '0.9.0', 'unpublished_retired', 'healthy', 1, 2));
    version(12).candidateHealthStatus = 'healthy';

    await service.publishCandidate('admin_echo_service', '2.0.0', 99);

    expect(instance(102).role).toBe('active');
    expect(instance(101).role).toBe('standby');
    expect(instance(100).role).toBe('retired');
    expect(version(12)).toMatchObject({ publishStatus: 'published', releasedBy: 99 });
    expect(version(11).publishStatus).toBe('unpublished_retired');
    expect(processManager.stop).toHaveBeenCalledWith(instance(100).processName);
    expect(processManager.delete).toHaveBeenCalledWith(instance(100).processName);
    expect(instances.filter((item) => item.role === 'active')).toHaveLength(1);
    expect(instances.filter((item) => item.role === 'standby')).toHaveLength(1);
  });

  it('rolls back only to a healthy standby and keeps the replaced active as the sole standby', async () => {
    instance(101).role = 'standby';
    instance(101).healthStatus = 'unhealthy';
    instances.push(
      createInstance({
        id: 102,
        versionId: 12,
        processName: 'agentstudio-app-admin-echo-service-2-0-0',
        loopbackPort: 22001,
        role: 'active',
        processStatus: 'online',
        healthStatus: 'healthy',
      }),
    );
    version(11).publishStatus = 'unpublished_retired';
    version(12).publishStatus = 'published';

    await expect(
      service.rollback('admin_echo_service', '1.0.0', 'restore stable release', 99),
    ).rejects.toThrow('healthy standby');

    instance(101).healthStatus = 'healthy';
    await service.rollback('admin_echo_service', '1.0.0', 'restore stable release', 99);

    expect(instance(101).role).toBe('active');
    expect(instance(102).role).toBe('standby');
    expect(version(11)).toMatchObject({
      publishStatus: 'published',
      rollbackFromVersionId: 12,
      releasedBy: 99,
    });
    expect(version(12).publishStatus).toBe('unpublished_retired');
  });

  it('stops only the matching candidate without touching active', async () => {
    instances.push(
      createInstance({
        id: 102,
        versionId: 12,
        processName: 'agentstudio-app-admin-echo-service-2-0-0',
        loopbackPort: 22001,
        role: 'candidate',
        processStatus: 'online',
        healthStatus: 'healthy',
      }),
    );
    processManager.stop.mockImplementation(async () => {
      expect(instance(102).role).toBe('retired');
    });

    await service.stopCandidate('admin_echo_service', '2.0.0', 'cancel release', 99);

    expect(processManager.stop).toHaveBeenCalledWith(instance(102).processName);
    expect(processManager.delete).toHaveBeenCalledWith(instance(102).processName);
    expect(instance(102)).toMatchObject({ role: 'retired', processStatus: 'stopped' });
    expect(instance(101)).toMatchObject({ role: 'active', processStatus: 'online' });
  });

  it('restarts expected active process without changing publication or instance role', async () => {
    instance(101).processStatus = 'stopped';
    processManager.describe.mockResolvedValue(null);

    await expect(service.reconcile()).resolves.toMatchObject({ restarted: 1, failed: 0 });

    expect(processManager.start).toHaveBeenCalled();
    expect(instance(101)).toMatchObject({ role: 'active', processStatus: 'online' });
    expect(version(11).publishStatus).toBe('published');
    expect(version(12).publishStatus).toBe('unpublished');
    expect(instanceRepo.update).toHaveBeenCalledWith(
      { id: 101 },
      expect.objectContaining({ processStatus: 'online' }),
    );
    expect(instanceRepo.update.mock.calls.at(-1)?.[1]).not.toHaveProperty('role');
  });

  it('marks repeated restart drift failed without crashing or publishing', async () => {
    instance(101).restartCount = 0;
    processManager.describe.mockResolvedValue({
      processName: instance(101).processName,
      status: 'online',
      pid: 100,
      restartCount: 5,
      memoryBytes: 1,
      cpuPercent: 0,
    });

    await expect(service.reconcile()).resolves.toMatchObject({ restarted: 0, failed: 1 });

    expect(instance(101)).toMatchObject({
      role: 'active',
      processStatus: 'failed',
      lastErrorCode: 'restart_drift',
    });
    expect(version(11).publishStatus).toBe('published');
    expect(processManager.start).not.toHaveBeenCalled();

    await expect(service.reconcile()).resolves.toMatchObject({ restarted: 0, failed: 1 });
    expect(instance(101)).toMatchObject({ processStatus: 'failed', lastErrorCode: 'restart_drift' });
  });

  it('records a fixed diagnostic when a retired process cannot be cleaned up after publish', async () => {
    instances.push(
      createInstance({
        id: 100,
        versionId: 10,
        processName: 'agentstudio-app-admin-echo-service-0-9-0',
        loopbackPort: 20901,
        role: 'standby',
        processStatus: 'online',
        healthStatus: 'healthy',
      }),
      createInstance({
        id: 102,
        versionId: 12,
        processName: 'agentstudio-app-admin-echo-service-2-0-0',
        loopbackPort: 22001,
        role: 'candidate',
        processStatus: 'online',
        healthStatus: 'healthy',
      }),
    );
    versions.unshift(createVersion(10, '0.9.0', 'unpublished_retired', 'healthy', 1, 2));
    version(12).candidateHealthStatus = 'healthy';
    processManager.stop.mockRejectedValue(new Error('password=private'));
    processManager.delete.mockRejectedValue(new Error('token=private'));

    await service.publishCandidate('admin_echo_service', '2.0.0', 99);

    expect(instance(100)).toMatchObject({
      role: 'retired',
      processStatus: 'failed',
      lastErrorCode: 'retired_cleanup_failed',
      lastErrorMessage: 'Service process reconciliation failed',
    });
    expect(JSON.stringify(instance(100))).not.toContain('private');
  });

  it('probes only the healthy active service through bounded loopback transport', async () => {
    await expect(service.probeActive('admin_echo_service', { ping: true })).resolves.toEqual({
      statusCode: 200,
      headers: {},
      body: { version: '1.0.0' },
    });
    expect(transport.invoke).toHaveBeenCalledWith(21001, { ping: true });

    instance(101).healthStatus = 'unhealthy';
    await expect(service.probeActive('admin_echo_service', {})).rejects.toThrow('healthy active');
  });

  it('returns stable runtime responses without release paths, commands, or environment values', async () => {
    const list = await service.listRuntimeInstances({ role: 'active' });
    const detail = await service.getRuntimeApp('admin_echo_service');
    processManager.logs.mockResolvedValue({ stdout: 'ok', stderr: '' });
    const logs = await service.getRuntimeLogs('admin_echo_service', 100);

    expect(list).toEqual([
      expect.objectContaining({
        id: '101',
        app_code: 'admin_echo_service',
        version: '1.0.0',
        role: 'active',
        process_status: 'online',
        health_status: 'healthy',
      }),
    ]);
    expect(detail).toMatchObject({ app_code: 'admin_echo_service', active_version: '1.0.0' });
    expect(logs).toMatchObject({
      app_code: 'admin_echo_service',
      process_name: instance(101).processName,
      stdout: 'ok',
      stderr: '',
    });
    for (const value of [list, detail, logs]) {
      expect(JSON.stringify(value)).not.toMatch(
        /releaseDir|release_dir|packagePath|package_path|pm2Home|environment|command/i,
      );
      expect(JSON.stringify(value)).not.toContain('/runtime/admin_echo_service');
    }
  });

  it('allocates only an unused loopback port from the configured range', async () => {
    const blocker = createServer();
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const blockedPort = (blocker.address() as AddressInfo).port;
    if (blockedPort > 65530) {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
      return;
    }

    try {
      const allocated = await new NodeAppServicePortAllocator().allocate({
        min: blockedPort,
        max: blockedPort + 5,
        used: [blockedPort + 1],
      });
      expect(allocated).toBeGreaterThan(blockedPort + 1);
      expect(allocated).toBeLessThanOrEqual(blockedPort + 5);
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });

  function createVersion(
    id: number,
    versionValue: string,
    publishStatus: string,
    candidateHealthStatus: string,
    submittedBy: number,
    reviewerId: number,
  ) {
    return {
      id,
      appId: 1,
      version: versionValue,
      manifest: {
        manifestVersion: 2,
        code: 'admin_echo_service',
        version: versionValue,
        runtime: 'service',
        entry: 'dist/index.js',
        healthPath: '/health',
        capabilities: [],
        allowedOrigins: [],
        runtimeConfig: {},
      },
      manifestVersion: 2,
      packageFormat: 'service_zip',
      scanResult: { passed: true, findings: [] },
      candidateHealthStatus,
      submittedBy,
      reviewerId,
      reviewStatus: 'approved',
      publishStatus,
      packagePath: `/runtime/admin_echo_service/${versionValue}`,
      entryFile: 'dist/index.js',
      fileHash: 'a'.repeat(64),
      fileSize: 100,
    };
  }

  function createInstance(overrides: Record<string, unknown>) {
    return {
      id: 0,
      appId: 1,
      versionId: 0,
      releaseDir: '/runtime/admin_echo_service/1.0.0',
      processName: '',
      loopbackPort: 0,
      role: 'candidate',
      processStatus: 'stopped',
      healthStatus: 'unknown',
      restartCount: 0,
      lastErrorCode: '',
      lastErrorMessage: '',
      ...overrides,
    };
  }

  function app() {
    return apps[0];
  }

  function version(id: number) {
    return versions.find((item) => item.id === id);
  }

  function instance(id: number) {
    return instances.find((item) => item.id === id);
  }
});

class MemoryRepository {
  readonly findOne = jest.fn(async (options: any) => {
    return this.items.find((item) => matches(item, options?.where)) || null;
  });
  readonly find = jest.fn(async (options?: any) => {
    return this.items.filter((item) => matches(item, options?.where));
  });
  readonly create = jest.fn((value: any) => ({ ...value }));
  readonly save = jest.fn(async (value: any) => {
    if (!value.id) value.id = this.nextId++;
    const index = this.items.findIndex((item) => Number(item.id) === Number(value.id));
    if (index < 0) this.items.push(value);
    else this.items[index] = value;
    return value;
  });
  readonly update = jest.fn(async (criteria: any, partial: any) => {
    const item = this.items.find((candidate) => matches(candidate, criteria));
    if (item) Object.assign(item, partial);
    return { affected: item ? 1 : 0 };
  });

  private nextId: number;

  constructor(private readonly items: any[]) {
    this.nextId = Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
  }

  createQueryBuilder() {
    let appId: number | undefined;
    const builder = {
      setLock: jest.fn(() => builder),
      where: jest.fn((_sql: string, params: { appId: number }) => {
        appId = params.appId;
        return builder;
      }),
      getMany: jest.fn(async () =>
        this.items.filter((item) => appId === undefined || Number(item.appId) === Number(appId)),
      ),
    };
    return builder;
  }
}

function matches(item: any, where?: Record<string, unknown>) {
  if (!where) return true;
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'deleteTime') return item[key] === null || item[key] === undefined;
    return Number.isFinite(Number(expected)) && expected !== ''
      ? Number(item[key]) === Number(expected)
      : item[key] === expected;
  });
}
