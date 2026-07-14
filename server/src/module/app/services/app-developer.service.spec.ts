import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppServiceInstanceEntity } from '../entities/app-service-instance.entity';
import { AppServiceInvocationEntity } from '../entities/app-service-invocation.entity';
import { AppDeveloperService } from './app-developer.service';
import { AppDeveloperCertificationService } from './app-developer-certification.service';
import { AppPlatformService } from './app-platform.service';
import { AppServiceRuntimeService } from './app-service-runtime.service';

describe('AppDeveloperService', () => {
  let service: AppDeveloperService;

  const appRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const versionRepo = { find: jest.fn() };
  const instanceRepo = { find: jest.fn() };
  const invocationRepo = { query: jest.fn() };
  const platformService = {
    listDeveloperApps: jest.fn(),
    getApp: jest.fn(),
    createApp: jest.fn(),
    updateApp: jest.fn(),
    uploadStaticVersion: jest.fn(),
    uploadServiceVersion: jest.fn(),
    submitVersion: jest.fn(),
  };
  const certificationService = {
    assertRuntimeApproved: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const runtimeService = {
    getDeveloperRuntimeLogs: jest.fn(),
  };
  const file = {
    originalname: 'creator-portal.zip',
    mimetype: 'application/zip',
    size: 12,
    buffer: Buffer.from('zip-content'),
  } as Express.Multer.File;

  beforeEach(async () => {
    jest.clearAllMocks();
    configService.get.mockImplementation((key: string, fallback?: unknown) => fallback);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppDeveloperService,
        { provide: getRepositoryToken(AppPackageEntity), useValue: appRepo },
        { provide: getRepositoryToken(AppPackageVersionEntity), useValue: versionRepo },
        { provide: getRepositoryToken(AppServiceInstanceEntity), useValue: instanceRepo },
        { provide: getRepositoryToken(AppServiceInvocationEntity), useValue: invocationRepo },
        { provide: AppPlatformService, useValue: platformService },
        { provide: AppDeveloperCertificationService, useValue: certificationService },
        { provide: ConfigService, useValue: configService },
        { provide: AppServiceRuntimeService, useValue: runtimeService },
      ],
    }).compile();

    service = module.get(AppDeveloperService);
  });

  it('lists only apps owned by the authenticated developer', async () => {
    platformService.listDeveloperApps.mockResolvedValue([{ code: 'creator_portal' }]);

    await expect(service.listApps(17)).resolves.toEqual([{ code: 'creator_portal' }]);
    expect(platformService.listDeveloperApps).toHaveBeenCalledWith(17);
  });

  it('creates a static marketplace app owned by the authenticated developer', async () => {
    platformService.createApp.mockResolvedValue({ code: 'creator_portal', developer_id: 17 });

    await service.createApp(
      {
        code: 'creator_portal',
        name: 'Creator Portal',
        category: 'Tools',
        type: 'internal',
        entry_url: '/system/user',
        system_module_code: 'ai',
      } as any,
      17,
      'Alice',
    );

    expect(platformService.createApp).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'creator_portal',
        name: 'Creator Portal',
        category: 'Tools',
        type: 'static',
        visibility: 'marketplace',
        developer_name: 'Alice',
      }),
      17,
    );
    const [createParams] = platformService.createApp.mock.calls[0];
    expect(createParams).not.toHaveProperty('entry_url');
    expect(createParams).not.toHaveProperty('system_module_code');
    expect(certificationService.assertRuntimeApproved).toHaveBeenCalledWith(17, 'static');
  });

  it('creates an iframe app only after matching developer certification', async () => {
    certificationService.assertRuntimeApproved.mockResolvedValue({ id: 5, userId: 17 });
    platformService.createApp.mockResolvedValue({ code: 'supplier_portal', developer_id: 17 });

    await service.createApp(
      {
        code: 'supplier_portal',
        name: 'Supplier Portal',
        runtime_type: 'iframe',
        entry_url: 'https://supplier.example.com/app',
        allowed_origins: ['https://supplier.example.com'],
        requested_capabilities: ['context.read'],
      } as any,
      17,
      'Alice',
    );

    expect(certificationService.assertRuntimeApproved).toHaveBeenCalledWith(17, 'iframe');
    expect(platformService.createApp).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'supplier_portal',
        type: 'iframe',
        entry_url: 'https://supplier.example.com/app',
        allowed_origins: ['https://supplier.example.com'],
        requested_capabilities: ['context.read'],
      }),
      17,
      { reviewRequired: true },
    );
  });

  it('creates a developer_restricted service draft only for a certified service developer', async () => {
    configService.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'appMarketplace.developerService.enabled' ? true : fallback,
    );
    certificationService.assertRuntimeApproved.mockResolvedValue({ id: 5, userId: 17 });
    platformService.createApp.mockResolvedValue({ code: 'workflow_service', developer_id: 17 });

    await service.createApp(
      { code: 'workflow_service', name: 'Workflow Service', runtime_type: 'service' },
      17,
      'Alice',
    );

    expect(certificationService.assertRuntimeApproved).toHaveBeenCalledWith(17, 'service');
    expect(platformService.createApp).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'workflow_service',
        type: 'service',
        visibility: 'marketplace',
      }),
      17,
      { trustLevel: 'developer_restricted' },
    );
  });

  it('rejects service creation while the developer service flag is disabled', async () => {
    await expect(
      service.createApp(
        { code: 'workflow_service', name: 'Workflow Service', runtime_type: 'service' },
        17,
        'Alice',
      ),
    ).rejects.toThrow('Developer service apps are disabled');

    expect(certificationService.assertRuntimeApproved).not.toHaveBeenCalled();
    expect(platformService.createApp).not.toHaveBeenCalled();
  });

  it('rejects a blank app name', async () => {
    await expect(service.createApp({ code: 'creator_portal', name: '   ' }, 17, 'Alice')).rejects.toThrow(
      'App name is required',
    );
    expect(platformService.createApp).not.toHaveBeenCalled();
  });

  it('returns not found for another developer app', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(service.getApp('private_app', 17)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getApp('private_app', 17)).rejects.toThrow('App private_app not found');
    expect(platformService.getApp).not.toHaveBeenCalled();
  });

  it('returns detail for an owned app', async () => {
    appRepo.findOne.mockResolvedValue({ code: 'creator_portal', developerId: 17, status: 'draft' });
    platformService.getApp.mockResolvedValue({ code: 'creator_portal', versions: [] });

    await expect(service.getApp('creator_portal', 17)).resolves.toEqual({ code: 'creator_portal', versions: [] });
    expect(appRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ code: 'creator_portal', developerId: 17 }) }),
    );
  });

  it('blocks metadata edits while review is pending', async () => {
    appRepo.findOne.mockResolvedValue({ code: 'creator_portal', developerId: 17, status: 'pending_review' });

    await expect(service.updateApp('creator_portal', { name: 'Changed' }, 17)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateApp('creator_portal', { name: 'Changed' }, 17)).rejects.toThrow(
      'Only draft or rejected apps can be edited',
    );
    expect(platformService.updateApp).not.toHaveBeenCalled();
  });

  it('updates metadata for an owned draft app', async () => {
    appRepo.findOne.mockResolvedValue({ code: 'creator_portal', developerId: 17, status: 'draft' });
    platformService.updateApp.mockResolvedValue({ code: 'creator_portal', name: 'Changed' });

    await service.updateApp(
      'creator_portal',
      {
        name: 'Changed',
        summary: 'Updated summary',
        screenshots: ['https://cdn.example.com/creator.png'],
        documentation_url: 'https://docs.example.com/creator',
        support_url: 'https://support.example.com/creator',
        changelog: '2.0.0: Updated workflows.',
        visibility: 'platform',
        entry_url: '/system/user',
      } as any,
      17,
    );

    expect(platformService.updateApp).toHaveBeenCalledWith('creator_portal', {
      name: 'Changed',
      summary: 'Updated summary',
      screenshots: ['https://cdn.example.com/creator.png'],
      documentation_url: 'https://docs.example.com/creator',
      support_url: 'https://support.example.com/creator',
      changelog: '2.0.0: Updated workflows.',
    });
  });

  it('rejects a blank app name update', async () => {
    appRepo.findOne.mockResolvedValue({ code: 'creator_portal', developerId: 17, status: 'draft' });

    await expect(service.updateApp('creator_portal', { name: '   ' }, 17)).rejects.toThrow('App name is required');
    expect(platformService.updateApp).not.toHaveBeenCalled();
  });

  it('blocks uploads for disabled or archived apps', async () => {
    appRepo.findOne.mockResolvedValue({ code: 'creator_portal', developerId: 17, status: 'archived' });

    await expect(service.uploadVersion('creator_portal', file, 17)).rejects.toThrow(
      'Disabled or archived apps cannot upload versions',
    );
    expect(platformService.uploadStaticVersion).not.toHaveBeenCalled();
  });

  it('uploads a package for an owned active app', async () => {
    appRepo.findOne.mockResolvedValue({ code: 'creator_portal', developerId: 17, status: 'published' });
    platformService.uploadStaticVersion.mockResolvedValue({ version: '2.0.0', review_status: 'pending' });

    await service.uploadVersion('creator_portal', file, 17);

    expect(certificationService.assertRuntimeApproved).toHaveBeenCalledWith(17, 'static');
    expect(platformService.uploadStaticVersion).toHaveBeenCalledWith('creator_portal', file, 17);
  });

  it('dispatches an owned service upload only after the flag and certification checks', async () => {
    configService.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'appMarketplace.developerService.enabled' ? true : fallback,
    );
    appRepo.findOne.mockResolvedValue({
      code: 'workflow_service',
      developerId: 17,
      status: 'draft',
      type: 'service',
      trustLevel: 'developer_restricted',
    });
    certificationService.assertRuntimeApproved.mockResolvedValue({ id: 5, userId: 17 });
    platformService.uploadServiceVersion.mockResolvedValue({
      version: '1.0.0',
      review_status: 'pending',
    });

    await service.uploadVersion('workflow_service', file, 17);

    expect(certificationService.assertRuntimeApproved).toHaveBeenCalledWith(17, 'service');
    expect(platformService.uploadServiceVersion).toHaveBeenCalledWith(
      'workflow_service',
      file,
      17,
      expect.objectContaining({ id: 5, userId: 17 }),
    );
    expect(platformService.uploadStaticVersion).not.toHaveBeenCalled();
  });

  it('rejects an owned service upload while the developer service flag is disabled', async () => {
    appRepo.findOne.mockResolvedValue({
      code: 'workflow_service',
      developerId: 17,
      status: 'draft',
      type: 'service',
      trustLevel: 'developer_restricted',
    });

    await expect(service.uploadVersion('workflow_service', file, 17)).rejects.toThrow(
      'Developer service apps are disabled',
    );
    expect(certificationService.assertRuntimeApproved).not.toHaveBeenCalled();
    expect(platformService.uploadServiceVersion).not.toHaveBeenCalled();
  });

  it('resubmits a rejected version for an owned app', async () => {
    appRepo.findOne.mockResolvedValue({
      code: 'creator_portal',
      developerId: 17,
      status: 'rejected',
      type: 'static',
    });
    platformService.submitVersion.mockResolvedValue({ version: '1.0.0', review_status: 'pending' });

    await service.submitVersion('creator_portal', '1.0.0', 17);

    expect(certificationService.assertRuntimeApproved).toHaveBeenCalledWith(17, 'static');
    expect(platformService.submitVersion).toHaveBeenCalledWith('creator_portal', '1.0.0', 17);
  });

  it('blocks static creation when the developer certification is unavailable', async () => {
    certificationService.assertRuntimeApproved.mockRejectedValue(
      new BadRequestException('Developer runtime is not certified'),
    );

    await expect(
      service.createApp({ code: 'creator_portal', name: 'Creator Portal' }, 17, 'Alice'),
    ).rejects.toThrow('Developer runtime is not certified');
    expect(platformService.createApp).not.toHaveBeenCalled();
  });

  it('aggregates invocation totals only for service apps owned by the authenticated developer', async () => {
    appRepo.find.mockResolvedValue([
      {
        id: 40,
        code: 'workflow_service',
        name: 'Workflow Service',
        developerId: 17,
        type: 'service',
      },
    ]);
    versionRepo.find.mockResolvedValue([{ id: 60, appId: 40, version: '2.0.0' }]);
    instanceRepo.find.mockResolvedValue([
      {
        id: 70,
        appId: 40,
        versionId: 60,
        role: 'active',
        processStatus: 'online',
        healthStatus: 'healthy',
        circuitState: 'open',
        restartCount: 2,
        processName: 'must-not-escape',
        loopbackPort: 22001,
        releaseDir: '/must-not-escape',
      },
    ]);
    invocationRepo.query
      .mockResolvedValueOnce([
        {
          target_app_id: '40',
          success_count: '8',
          failure_count: '1',
          rejected_count: '1',
          total_count: '10',
          last_invoke_time: '2026-07-13T08:00:00.000Z',
          last_success_time: '2026-07-13T07:59:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        { target_app_id: '40', p50_duration_ms: '120', p95_duration_ms: '400' },
      ]);

    const result = await service.getServiceOverview(17, 7);

    expect(appRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ developerId: 17, type: 'service' }),
      order: { id: 'ASC' },
    });
    expect(invocationRepo.query.mock.calls[0][1][0]).toBe(17);
    expect(invocationRepo.query.mock.calls[1][1][0]).toBe(17);
    expect(result).toMatchObject({
      days: 7,
      total_services: 1,
      total_invocations: 10,
      total_success: 8,
      total_failure: 1,
      total_rejected: 1,
      success_rate: 80,
      services: [
        expect.objectContaining({
          app_code: 'workflow_service',
          version: '2.0.0',
          role: 'active',
          process_status: 'online',
          health_status: 'healthy',
          circuit_state: 'open',
          restart_count: 2,
          p50_duration_ms: 120,
          p95_duration_ms: 400,
        }),
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /process_name|loopback_port|release_dir|package_path|environment|command|tenant_id|payload/i,
    );
  });

  it('normalizes unsupported observability windows to a bounded value', async () => {
    appRepo.find.mockResolvedValue([]);

    await expect(service.getServiceOverview(17, 99 as any)).resolves.toMatchObject({
      days: 30,
      total_services: 0,
      services: [],
    });
    expect(invocationRepo.query).not.toHaveBeenCalled();
  });

  it('returns bounded redacted logs for an owned service app', async () => {
    const owned = { id: 40, code: 'workflow_service', developerId: 17, type: 'service' };
    appRepo.findOne.mockResolvedValue(owned);
    runtimeService.getDeveloperRuntimeLogs.mockResolvedValue({
      app_code: 'workflow_service',
      version: '2.0.0',
      role: 'active',
      stdout: 'ok',
      stderr: '[REDACTED]',
    });

    await expect(service.getServiceLogs('workflow_service', 17, 999)).resolves.toEqual({
      app_code: 'workflow_service',
      version: '2.0.0',
      role: 'active',
      stdout: 'ok',
      stderr: '[REDACTED]',
    });
    expect(runtimeService.getDeveloperRuntimeLogs).toHaveBeenCalledWith(owned, 200);
  });

  it('rejects a foreign service app before reading runtime logs', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(service.getServiceLogs('foreign_service', 17, 100)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(runtimeService.getDeveloperRuntimeLogs).not.toHaveBeenCalled();
  });
});
