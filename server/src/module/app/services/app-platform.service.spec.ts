import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import JSZip from 'jszip';
import { DataSource } from 'typeorm';

import { AppCapabilityGrantEntity } from '../entities/app-capability-grant.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppReviewLogEntity } from '../entities/app-review-log.entity';
import { AppManifestService } from './app-manifest.service';
import { AppCapabilityPolicyService } from './app-capability-policy.service';
import { AppDeveloperCertificationService } from './app-developer-certification.service';
import { AppPackageStorageService } from './app-package-storage.service';
import { AppRuntimeSessionService } from './app-runtime-session.service';
import { AppReviewSnapshotService } from './app-review-snapshot.service';
import { AppServicePackageService } from './app-service-package.service';
import { AppServiceRuntimeService } from './app-service-runtime.service';
import { AppPlatformService } from './app-platform.service';

describe('AppPlatformService', () => {
  let service: AppPlatformService;

  const appRepo = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const versionRepo = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const reviewLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const storageService = {
    extractStaticPackage: jest.fn(),
    publishVersion: jest.fn(),
    getPublicPrefix: jest.fn(),
  };
  const manifestService = {
    validateStaticManifest: jest.fn(),
  };
  const servicePackageService = {
    scanAndInstall: jest.fn(),
    verifyInstalledEntry: jest.fn(),
  };
  const reviewSnapshotService = {
    create: jest.fn(),
    hash: jest.fn(),
    verify: jest.fn(),
    sanitizeScanResult: jest.fn(),
  };
  const serviceRuntimeService = {
    startCandidate: jest.fn(),
    publishCandidate: jest.fn(),
    rollback: jest.fn(),
    stopCandidate: jest.fn(),
    reconcile: jest.fn(),
    probeActive: jest.fn(),
    getRuntimeApp: jest.fn(),
  };
  const capabilityPolicy = {
    approvePlatformCapabilities: jest.fn(),
  };
  const certificationService = {
    assertRuntimeApproved: jest.fn(),
  };
  const runtimeSessionService = { revokeVersion: jest.fn() };
  const grantRepo = {};
  const dataSource = {
    transaction: jest.fn(async (callback) =>
      callback({
        getRepository: (entity) => {
          if (entity === AppPackageEntity) return appRepo;
          if (entity === AppPackageVersionEntity) return versionRepo;
          if (entity === AppCapabilityGrantEntity) return grantRepo;
          throw new Error('Unexpected transaction repository');
        },
      }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    appRepo.create.mockImplementation((value) => ({ ...value }));
    appRepo.find.mockResolvedValue([]);
    appRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 1, ...value }));
    versionRepo.create.mockImplementation((value) => ({ ...value }));
    versionRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 11, ...value }));
    storageService.getPublicPrefix.mockReturnValue('/apps-static/');
    reviewLogRepo.create.mockImplementation((value) => ({ ...value }));
    reviewLogRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 1, ...value }));
    runtimeSessionService.revokeVersion.mockResolvedValue(1);
    certificationService.assertRuntimeApproved.mockResolvedValue({ id: 5, userId: 17 });
    reviewSnapshotService.verify.mockImplementation(() => undefined);
    servicePackageService.verifyInstalledEntry.mockResolvedValue(undefined);
    reviewSnapshotService.sanitizeScanResult.mockImplementation((value) => ({
      passed: value?.passed === true,
      findings: Array.isArray(value?.findings)
        ? value.findings.map((finding) => ({
            code: finding.code,
            severity: finding.severity,
            line: finding.line,
            column: finding.column,
          }))
        : [],
      scannedFiles: Number(value?.scannedFiles) || 0,
      entrySha256: String(value?.entrySha256 || ''),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppPlatformService,
        { provide: getRepositoryToken(AppPackageEntity), useValue: appRepo },
        { provide: getRepositoryToken(AppPackageVersionEntity), useValue: versionRepo },
        { provide: getRepositoryToken(AppReviewLogEntity), useValue: reviewLogRepo },
        { provide: AppPackageStorageService, useValue: storageService },
        { provide: AppManifestService, useValue: manifestService },
        { provide: AppCapabilityPolicyService, useValue: capabilityPolicy },
        { provide: AppDeveloperCertificationService, useValue: certificationService },
        { provide: AppRuntimeSessionService, useValue: runtimeSessionService },
        { provide: AppReviewSnapshotService, useValue: reviewSnapshotService },
        { provide: AppServicePackageService, useValue: servicePackageService },
        { provide: AppServiceRuntimeService, useValue: serviceRuntimeService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(AppPlatformService);
  });

  it('lists only apps owned by the authenticated developer', async () => {
    appRepo.find.mockResolvedValue([
      {
        id: 5,
        code: 'creator_portal',
        name: 'Creator Portal',
        type: 'static',
        status: 'draft',
        visibility: 'marketplace',
        entryMode: 'static',
        entryUrl: '',
        developerId: 17,
      },
    ]);
    versionRepo.find.mockResolvedValue([
      {
        id: 11,
        appId: 5,
        version: '1.1.0',
        reviewStatus: 'rejected',
        publishStatus: 'unpublished',
        reviewMessage: 'Remove external script',
      },
      {
        id: 10,
        appId: 5,
        version: '1.0.0',
        reviewStatus: 'approved',
        publishStatus: 'published',
        reviewMessage: '',
      },
    ]);

    await expect(service.listDeveloperApps(17)).resolves.toEqual([
      expect.objectContaining({
        code: 'creator_portal',
        developer_id: 17,
        latest_version: '1.1.0',
        latest_review_status: 'rejected',
        latest_publish_status: 'unpublished',
        latest_review_message: 'Remove external script',
      }),
    ]);
    expect(appRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ developerId: 17 }),
      }),
    );
  });

  it('delegates service lifecycle operations to the isolated runtime service', async () => {
    serviceRuntimeService.startCandidate.mockResolvedValue({ role: 'candidate' });
    serviceRuntimeService.publishCandidate.mockResolvedValue({ active: '2.0.0' });
    serviceRuntimeService.rollback.mockResolvedValue({ active: '1.0.0' });
    serviceRuntimeService.stopCandidate.mockResolvedValue({ stopped: true });
    serviceRuntimeService.reconcile.mockResolvedValue({ restarted: 1 });
    serviceRuntimeService.probeActive.mockResolvedValue({ body: { ok: true } });
    serviceRuntimeService.getRuntimeApp
      .mockResolvedValueOnce({ role: 'candidate' })
      .mockResolvedValueOnce({ active: '2.0.0' })
      .mockResolvedValueOnce({ active: '1.0.0' })
      .mockResolvedValueOnce({ stopped: true });

    await expect(service.startServiceCandidate('svc', '2.0.0', 9)).resolves.toEqual({
      role: 'candidate',
    });
    await expect(service.publishServiceCandidate('svc', '2.0.0', 9)).resolves.toEqual({
      active: '2.0.0',
    });
    await expect(service.rollbackServiceVersion('svc', '1.0.0', 'rollback', 9)).resolves.toEqual({
      active: '1.0.0',
    });
    await expect(service.stopServiceCandidate('svc', '2.0.0', 'cancel', 9)).resolves.toEqual({
      stopped: true,
    });
    await expect(service.reconcileServiceRuntime(9)).resolves.toEqual({ restarted: 1 });
    await expect(service.probeActiveService('svc', { ping: true }, 9)).resolves.toEqual({
      body: { ok: true },
    });
  });

  it('creates an iframe app as a published marketplace app', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createApp(
        {
          code: 'supplier_portal',
          name: 'Supplier Portal',
          type: 'iframe',
          entry_url: 'https://supplier.example.com',
          allowed_origins: ['https://supplier.example.com:443'],
          requested_capabilities: ['context.read', 'kv.read'],
          category: 'Industry',
        },
        88,
      ),
    ).resolves.toMatchObject({
      code: 'supplier_portal',
      name: 'Supplier Portal',
      type: 'iframe',
      status: 'published',
      visibility: 'marketplace',
      entry_mode: 'iframe',
      entry_url: 'https://supplier.example.com/',
    });

    expect(appRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'supplier_portal',
        type: 'iframe',
        status: 'published',
        entryMode: 'iframe',
        entryUrl: 'https://supplier.example.com/',
        developerId: 88,
      }),
    );
    expect(versionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 1,
        version: '1.0.0',
        reviewStatus: 'approved',
        publishStatus: 'published',
        manifest: expect.objectContaining({
          type: 'iframe',
          entry: 'https://supplier.example.com/',
          allowedOrigins: ['https://supplier.example.com'],
          capabilities: ['context.read', 'kv.read'],
        }),
        approvedCapabilities: ['context.read', 'kv.read'],
      }),
    );
    expect(versionRepo.save).toHaveBeenCalledTimes(1);
    expect(capabilityPolicy.approvePlatformCapabilities).toHaveBeenCalledWith(
      {
        appId: 1,
        versionId: 11,
        requestedCapabilities: ['context.read', 'kv.read'],
        approvedCapabilities: ['context.read', 'kv.read'],
        operatorId: 88,
      },
      grantRepo,
    );
  });

  it('creates a service app as an unpublished platform-trusted draft', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createApp(
        {
          code: 'admin_echo_service',
          name: 'Admin Echo Service',
          type: 'service',
          category: 'developer_tools',
        },
        88,
      ),
    ).resolves.toMatchObject({
      code: 'admin_echo_service',
      type: 'service',
      status: 'draft',
      entry_mode: 'service',
      entry_url: '',
      runtime_type: 'service',
      trust_level: 'platform_trusted',
      service_health_path: '/health',
    });

    expect(appRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'service',
        status: 'draft',
        entryMode: 'service',
        entryUrl: '',
        runtimeType: 'service',
        trustLevel: 'platform_trusted',
        serviceHealthPath: '/health',
      }),
    );
    expect(versionRepo.create).not.toHaveBeenCalled();
  });

  it('creates an explicitly restricted developer service draft without changing platform defaults', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createApp(
        {
          code: 'workflow_service',
          name: 'Workflow Service',
          type: 'service',
        },
        17,
        { trustLevel: 'developer_restricted' },
      ),
    ).resolves.toMatchObject({
      code: 'workflow_service',
      type: 'service',
      trust_level: 'developer_restricted',
    });
    expect(appRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ trustLevel: 'developer_restricted', developerId: 17 }),
    );
  });

  it('uploads a scanned service version without starting or publishing it', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 9,
      code: 'admin_echo_service',
      name: 'Admin Echo Service',
      type: 'service',
      status: 'draft',
      entryMode: 'service',
      entryUrl: '',
      runtimeType: 'service',
      trustLevel: 'platform_trusted',
    });
    versionRepo.findOne.mockResolvedValue(null);
    servicePackageService.scanAndInstall.mockResolvedValue({
      manifest: {
        manifestVersion: 2,
        code: 'admin_echo_service',
        version: '1.0.0',
        runtime: 'service',
        entry: 'dist/index.js',
        healthPath: '/health',
        capabilities: ['context.read'],
        serviceTargets: [],
        allowedOrigins: [],
        runtimeConfig: {},
      },
      releaseDir: '/runtime/admin_echo_service/1.0.0',
      entryFile: 'dist/index.js',
      fileSize: 1024,
      packageSha256: 'a'.repeat(64),
      scanResult: {
        passed: true,
        findings: [
          {
            code: 'warning_only',
            severity: 'warning',
            line: 1,
            column: 2,
            snippet: 'process.env.SECRET',
          },
        ],
        scannedFiles: 1,
        entrySha256: 'b'.repeat(64),
        source: 'raw uploaded source',
      },
    });

    const response = await service.uploadServiceVersion(
      'admin_echo_service',
      { buffer: Buffer.from('zip'), size: 3 } as Express.Multer.File,
      88,
    );
    expect(response).toMatchObject({
      version: '1.0.0',
      manifest_version: 2,
      package_format: 'service_zip',
      review_status: 'pending',
      publish_status: 'unpublished',
      submitted_by: 88,
      scan_result: expect.objectContaining({ passed: true }),
    });
    expect(JSON.stringify(response)).not.toContain('/runtime/admin_echo_service');
    expect(response).not.toHaveProperty('package_path');
    expect(response).not.toHaveProperty('publish_path');
    expect(JSON.stringify(response)).not.toContain('raw uploaded source');
    expect(JSON.stringify(response)).not.toContain('process.env.SECRET');
    expect(versionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 9,
        version: '1.0.0',
        manifestVersion: 2,
        packageFormat: 'service_zip',
        packagePath: '/runtime/admin_echo_service/1.0.0',
        entryFile: 'dist/index.js',
        reviewStatus: 'pending',
        publishStatus: 'unpublished',
        submittedBy: 88,
      }),
    );
    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_review', serviceHealthPath: '/health' }),
    );
  });

  it('stores one frozen restricted-service submission snapshot in the upload transaction', async () => {
    const app = {
      id: 9,
      code: 'workflow_service',
      name: 'Workflow Service',
      type: 'service',
      category: 'Automation',
      summary: 'Runs workflows',
      description: 'Approved workflow service',
      developerId: 17,
      developerName: 'Alice',
      status: 'draft',
      entryMode: 'service',
      entryUrl: '',
      runtimeType: 'service',
      trustLevel: 'developer_restricted',
    };
    const profile = {
      id: 5,
      userId: 17,
      certificationStatus: 'certified',
      approvedRuntimeTypes: ['service'],
      riskLevel: 'low',
      certificationExpiry: new Date('2030-01-01T00:00:00.000Z'),
      disabled: 0,
    } as any;
    const frozenSnapshot = { schema_version: 1, app: { code: 'workflow_service' } };
    appRepo.findOne.mockResolvedValue(app);
    versionRepo.findOne.mockResolvedValue(null);
    servicePackageService.scanAndInstall.mockResolvedValue({
      manifest: {
        manifestVersion: 2,
        code: 'workflow_service',
        version: '1.0.0',
        runtime: 'service',
        entry: 'dist/index.js',
        healthPath: '/health',
        capabilities: ['service.invoke'],
        serviceTargets: ['reporting_service'],
        allowedOrigins: [],
        runtimeConfig: {},
      },
      releaseDir: '/runtime/workflow_service/1.0.0',
      entryFile: 'dist/index.js',
      fileSize: 1024,
      packageSha256: 'a'.repeat(64),
      scanResult: {
        passed: true,
        findings: [],
        scannedFiles: 1,
        entrySha256: 'b'.repeat(64),
      },
    });
    reviewSnapshotService.create.mockReturnValue(frozenSnapshot);
    reviewSnapshotService.hash.mockReturnValue('c'.repeat(64));

    await service.uploadServiceVersion(
      'workflow_service',
      { buffer: Buffer.from('zip'), size: 3 } as Express.Multer.File,
      17,
      profile,
    );

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(reviewSnapshotService.create).toHaveBeenCalledWith(
      expect.objectContaining({ trustLevel: 'developer_restricted' }),
      expect.objectContaining({
        id: 11,
        serviceTargets: ['reporting_service'],
        submittedTime: expect.any(Date),
      }),
      profile,
    );
    expect(reviewSnapshotService.hash).toHaveBeenCalledWith(frozenSnapshot);
    expect(versionRepo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reviewSnapshot: frozenSnapshot,
        reviewSnapshotHash: 'c'.repeat(64),
        serviceTargets: ['reporting_service'],
        submittedTime: expect.any(Date),
      }),
    );
  });

  it('prevents a service submitter from approving the same version', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 9,
      code: 'admin_echo_service',
      type: 'service',
      status: 'pending_review',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 12,
      appId: 9,
      version: '1.0.0',
      manifest: { capabilities: [] },
      scanResult: { passed: true, findings: [] },
      submittedBy: 88,
      reviewStatus: 'pending',
      publishStatus: 'unpublished',
    });

    await expect(service.approveVersion('admin_echo_service', '1.0.0', '', 88, [])).rejects.toThrow(
      'Service version requires review by a different platform operator',
    );
  });

  it('rejects the legacy static publish flow for service versions', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 9,
      code: 'admin_echo_service',
      type: 'service',
      status: 'approved',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 12,
      appId: 9,
      version: '1.0.0',
      reviewStatus: 'approved',
      publishStatus: 'unpublished',
      packagePath: '/runtime/admin_echo_service/1.0.0',
      entryFile: 'dist/index.js',
    });

    await expect(service.publishVersion('admin_echo_service', '1.0.0', 9)).rejects.toThrow(
      'Only static app versions can be governed',
    );
    expect(storageService.publishVersion).not.toHaveBeenCalled();
  });

  it('fails closed when a service review has no authenticated operator identity', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 9,
      code: 'admin_echo_service',
      type: 'service',
      status: 'pending_review',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 12,
      appId: 9,
      version: '1.0.0',
      manifest: { capabilities: [] },
      scanResult: { passed: true, findings: [] },
      submittedBy: 88,
      reviewStatus: 'pending',
      publishStatus: 'unpublished',
    });

    await expect(
      service.approveVersion('admin_echo_service', '1.0.0', '', undefined, []),
    ).rejects.toThrow('Service version requires review by a different platform operator');
  });

  it('creates a new immutable iframe version when runtime settings change', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 3,
      code: 'supplier_portal',
      name: 'Supplier Portal',
      type: 'iframe',
      status: 'published',
      entryMode: 'iframe',
      entryUrl: 'https://supplier.example.com/',
    });
    versionRepo.findOne.mockResolvedValue(null);

    await service.updateApp('supplier_portal', {
      entry_url: 'https://supplier.example.com/v2',
      allowed_origins: ['https://supplier.example.com', 'https://api.example.com:443'],
      requested_capabilities: ['http.request'],
      version: '1.1.0',
    });

    expect(versionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 3,
        version: '1.1.0',
        manifest: expect.objectContaining({
          entry: 'https://supplier.example.com/v2',
          allowedOrigins: ['https://supplier.example.com', 'https://api.example.com'],
          capabilities: ['http.request'],
        }),
        approvedCapabilities: ['http.request'],
      }),
    );
    expect(versionRepo.save).toHaveBeenCalledTimes(1);
    expect(capabilityPolicy.approvePlatformCapabilities).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 3,
        versionId: 11,
        requestedCapabilities: ['http.request'],
        approvedCapabilities: ['http.request'],
      }),
      grantRepo,
    );
    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ entryUrl: 'https://supplier.example.com/v2' }),
    );
  });

  it('rejects iframe origins that are not exact HTTPS origins or omit the entry origin', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createApp({
        code: 'bad_origins',
        name: 'Bad Origins',
        type: 'iframe',
        entry_url: 'https://supplier.example.com/app',
        allowed_origins: ['https://supplier.example.com/path'],
      }),
    ).rejects.toThrow('Iframe allowed origins must be exact HTTPS origins');
    await expect(
      service.createApp({
        code: 'missing_origin',
        name: 'Missing Origin',
        type: 'iframe',
        entry_url: 'https://supplier.example.com/app',
        allowed_origins: ['https://api.example.com'],
      }),
    ).rejects.toThrow('Iframe entry origin must be approved');
    await expect(
      service.createApp({
        code: 'http_iframe',
        name: 'HTTP Iframe',
        type: 'iframe',
        entry_url: 'http://supplier.example.com/app',
      }),
    ).rejects.toThrow('Iframe app entry must use https');
  });

  it('rejects unsafe iframe app entry urls', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createApp({
        code: 'unsafe_iframe',
        name: 'Unsafe Iframe',
        type: 'iframe',
        entry_url: 'javascript:alert(1)',
      }),
    ).rejects.toThrow('Iframe app entry must use https');
  });

  it('creates an internal app that opens an existing route', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createApp({
        code: 'tenant_members',
        name: 'Tenant Members',
        type: 'internal',
        entry_url: '/tenant-saas/members',
      }),
    ).resolves.toMatchObject({
      code: 'tenant_members',
      type: 'internal',
      status: 'published',
      entry_mode: 'internal_route',
      entry_url: '/tenant-saas/members',
    });
  });

  it('rejects internal apps that point outside the admin route space', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createApp({
        code: 'external_internal',
        name: 'External Internal',
        type: 'internal',
        entry_url: 'https://example.com/app',
      }),
    ).rejects.toThrow('Internal app entry must be an absolute app route');
  });

  it('rejects duplicate app codes even when the existing row is soft-deleted', async () => {
    appRepo.findOne.mockResolvedValue({ id: 9, code: 'supplier_portal', deleteTime: new Date() });

    await expect(
      service.createApp({
        code: 'supplier_portal',
        name: 'Supplier Portal',
        type: 'iframe',
        entry_url: 'https://supplier.example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(appRepo.findOne).toHaveBeenCalledWith({
      where: { code: 'supplier_portal' },
      withDeleted: true,
    });
    expect(appRepo.save).not.toHaveBeenCalled();
  });

  it('updates app status and records an audit log', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 3,
      code: 'supplier_portal',
      name: 'Supplier Portal',
      type: 'iframe',
      status: 'published',
      entryMode: 'iframe',
      entryUrl: 'https://supplier.example.com',
    });

    await expect(service.updateStatus('supplier_portal', 'disabled', 77)).resolves.toMatchObject({
      code: 'supplier_portal',
      status: 'disabled',
    });

    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 3, status: 'disabled' }),
    );
    expect(reviewLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 3,
        versionId: null,
        action: 'disable',
        operatorId: 77,
      }),
    );
    expect(reviewLogRepo.save).toHaveBeenCalled();
  });

  it('rejects publishing a draft app through the generic status endpoint', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 3,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'draft',
      entryMode: 'static',
      entryUrl: '',
    });

    await expect(service.updateStatus('job_board', 'published', 77)).rejects.toThrow(
      'Illegal app status transition: draft -> published',
    );
    expect(appRepo.save).not.toHaveBeenCalled();
  });

  it('rejects re-enabling a service app without a healthy active runtime', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 9,
      code: 'workflow_service',
      name: 'Workflow Service',
      type: 'service',
      status: 'disabled',
      entryMode: 'service',
      entryUrl: '',
    });
    serviceRuntimeService.getRuntimeApp.mockResolvedValue({
      app_code: 'workflow_service',
      active_version: '',
      instances: [],
    });

    await expect(service.updateStatus('workflow_service', 'published', 77)).rejects.toThrow(
      'Service app requires a healthy active runtime before enabling',
    );
    expect(appRepo.save).not.toHaveBeenCalled();
  });

  it('rejects updates for unknown apps', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(service.updateStatus('missing_app', 'disabled')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('approves a pending app version and records an approval log', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 4,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'pending_review',
      entryMode: 'static',
      entryUrl: '',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 8,
      appId: 4,
      version: '1.0.0',
      reviewStatus: 'pending',
      publishStatus: 'unpublished',
      entryFile: 'dist/index.html',
      manifest: { permissions: ['runtime:context:read'] },
    });
    versionRepo.save.mockImplementation(async (value) => value);

    await expect(
      service.approveVersion('job_board', '1.0.0', 'Looks safe', 66, ['context.read']),
    ).resolves.toMatchObject({
      version: '1.0.0',
      review_status: 'approved',
      review_message: 'Looks safe',
      reviewer_id: 66,
      approved_capabilities: ['context.read'],
    });

    expect(versionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: 'approved',
        reviewMessage: 'Looks safe',
        reviewerId: 66,
        reviewTime: expect.any(Date),
        approvedCapabilities: ['context.read'],
      }),
    );
    expect(capabilityPolicy.approvePlatformCapabilities).toHaveBeenCalledWith(
      {
        appId: 4,
        versionId: 8,
        requestedCapabilities: ['context.read'],
        approvedCapabilities: ['context.read'],
        operatorId: 66,
      },
      grantRepo,
    );
    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, status: 'approved' }),
    );
    expect(reviewLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 4,
        versionId: 8,
        action: 'approve',
        message: 'Looks safe',
        operatorId: 66,
      }),
    );
  });

  it('stores a normalized platform capability snapshot', async () => {
    appRepo.findOne.mockResolvedValue({ id: 4, code: 'job_board', status: 'pending_review' });
    versionRepo.findOne.mockResolvedValue({
      id: 8,
      appId: 4,
      version: '1.0.0',
      reviewStatus: 'pending',
      publishStatus: 'unpublished',
      manifest: { permissions: ['runtime:context:read'] },
    });
    versionRepo.save.mockImplementation(async (value) => value);
    capabilityPolicy.approvePlatformCapabilities.mockResolvedValue(['context.read']);

    await service.approveVersion('job_board', '1.0.0', '', 66, ['context.read', 'context.read']);

    expect(versionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ approvedCapabilities: ['context.read'] }),
    );
  });

  it('approves no runtime capabilities when the reviewer omits a selection', async () => {
    appRepo.findOne.mockResolvedValue({ id: 4, code: 'job_board', status: 'pending_review' });
    versionRepo.findOne.mockResolvedValue({
      id: 8,
      appId: 4,
      version: '1.0.0',
      reviewStatus: 'pending',
      publishStatus: 'unpublished',
      manifest: { permissions: ['runtime:context:read'] },
    });
    versionRepo.save.mockImplementation(async (value) => value);

    await service.approveVersion('job_board', '1.0.0', 'Reviewed', 66);

    expect(versionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ approvedCapabilities: [] }),
    );
    expect(capabilityPolicy.approvePlatformCapabilities).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedCapabilities: ['context.read'],
        approvedCapabilities: [],
      }),
      grantRepo,
    );
  });

  it('keeps an active published app available when a new version is approved', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 4,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'published',
      entryMode: 'static',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 9,
      appId: 4,
      version: '2.0.0',
      reviewStatus: 'pending',
      publishStatus: 'unpublished',
      entryFile: 'dist/index.html',
    });
    versionRepo.save.mockImplementation(async (value) => value);

    await service.approveVersion('job_board', '2.0.0', 'Approved', 1);

    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'published',
        entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
      }),
    );
  });

  it('keeps an active published app available when a new version is rejected', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 4,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'published',
      entryMode: 'static',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 9,
      appId: 4,
      version: '2.0.0',
      reviewStatus: 'pending',
      publishStatus: 'unpublished',
      entryFile: 'dist/index.html',
    });
    versionRepo.save.mockImplementation(async (value) => value);

    await service.rejectVersion('job_board', '2.0.0', 'Needs changes', 1);

    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'published',
        entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
      }),
    );
  });

  it('uploads a static app package as a pending review version', async () => {
    const zip = new JSZip();
    zip.file(
      'manifest.json',
      JSON.stringify({
        code: 'job_board',
        name: 'Job Board',
        version: '1.0.0',
        type: 'static',
        entry: 'dist/index.html',
      }),
    );
    zip.file('dist/index.html', '<html>job board</html>');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    appRepo.findOne.mockResolvedValueOnce({
      id: 4,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'draft',
      entryMode: 'static',
      entryUrl: '',
    });
    versionRepo.findOne.mockResolvedValue(null);
    versionRepo.create.mockImplementation((value) => ({ ...value }));
    versionRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 12, ...value }));
    manifestService.validateStaticManifest.mockReturnValue({
      code: 'job_board',
      name: 'Job Board',
      version: '1.0.0',
      type: 'static',
      entry: 'dist/index.html',
      category: 'Industry',
      summary: 'Hiring board',
      description: 'Recruiting app',
      icon: 'ri:briefcase-line',
      tenant_scoped: true,
      permissions: [],
      serviceTargets: ['reporting_service'],
    });
    storageService.extractStaticPackage.mockResolvedValue({
      packagePath: '/safe/packages/job_board/1.0.0',
    });

    await expect(
      service.uploadStaticVersion(
        'job_board',
        {
          originalname: 'job-board.zip',
          mimetype: 'application/zip',
          size: buffer.length,
          buffer,
        } as Express.Multer.File,
        66,
      ),
    ).resolves.toMatchObject({
      version: '1.0.0',
      review_status: 'pending',
      publish_status: 'unpublished',
      package_path: '/safe/packages/job_board/1.0.0',
      entry_file: 'dist/index.html',
      file_size: buffer.length,
    });

    expect(versionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 4,
        version: '1.0.0',
        packagePath: '/safe/packages/job_board/1.0.0',
        entryFile: 'dist/index.html',
        serviceTargets: ['reporting_service'],
        reviewStatus: 'pending',
        publishStatus: 'unpublished',
      }),
    );
    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 4,
        status: 'pending_review',
        name: 'Job Board',
        category: 'Industry',
        summary: 'Hiring board',
      }),
    );
    expect(reviewLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 4,
        versionId: 12,
        action: 'submit',
        operatorId: 66,
      }),
    );
  });

  it('keeps an active published app available while uploading a new version', async () => {
    const zip = new JSZip();
    zip.file(
      'manifest.json',
      JSON.stringify({
        code: 'job_board',
        name: 'Job Board Next',
        version: '2.0.0',
        type: 'static',
        entry: 'dist/index.html',
      }),
    );
    zip.file('dist/index.html', '<html>job board v2</html>');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    appRepo.findOne.mockResolvedValueOnce({
      id: 4,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      category: 'Industry',
      summary: 'Current public summary',
      status: 'published',
      entryMode: 'static',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    versionRepo.findOne.mockResolvedValue(null);
    versionRepo.create.mockImplementation((value) => ({ ...value }));
    versionRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 13, ...value }));
    manifestService.validateStaticManifest.mockReturnValue({
      code: 'job_board',
      name: 'Job Board Next',
      version: '2.0.0',
      type: 'static',
      entry: 'dist/index.html',
      category: 'Recruiting',
      summary: 'Unreviewed summary',
      tenant_scoped: true,
      permissions: [],
    });
    storageService.extractStaticPackage.mockResolvedValue({
      packagePath: '/safe/packages/job_board/2.0.0',
    });

    await service.uploadStaticVersion(
      'job_board',
      {
        originalname: 'job-board-v2.zip',
        mimetype: 'application/zip',
        size: buffer.length,
        buffer,
      } as Express.Multer.File,
      17,
    );

    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Job Board',
        category: 'Industry',
        summary: 'Current public summary',
        status: 'published',
        entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
      }),
    );
  });

  it('only allows rejected versions to be resubmitted', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 4,
      code: 'job_board',
      type: 'static',
      status: 'published',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 8,
      appId: 4,
      version: '1.0.0',
      reviewStatus: 'approved',
      publishStatus: 'published',
      entryFile: 'dist/index.html',
    });

    await expect(service.submitVersion('job_board', '1.0.0', 17)).rejects.toThrow(
      'Only rejected versions can be resubmitted',
    );
    expect(versionRepo.save).not.toHaveBeenCalled();
  });

  it('keeps an active published app available when a rejected version is resubmitted', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 4,
      code: 'job_board',
      type: 'static',
      status: 'published',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 9,
      appId: 4,
      version: '2.0.0',
      reviewStatus: 'rejected',
      publishStatus: 'unpublished',
      entryFile: 'dist/index.html',
      reviewMessage: 'Needs changes',
    });
    versionRepo.save.mockImplementation(async (value) => value);

    await expect(service.submitVersion('job_board', '2.0.0', 17)).resolves.toMatchObject({
      review_status: 'pending',
      review_message: '',
      reviewer_id: null,
      review_time: null,
    });

    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'published',
        entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
      }),
    );
  });

  it('approves restricted service content only after live certification and immutable evidence verify', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 9,
      code: 'workflow_service',
      type: 'service',
      runtimeType: 'service',
      trustLevel: 'developer_restricted',
      developerId: 17,
      status: 'pending_review',
    });
    const pendingVersion = {
      id: 12,
      appId: 9,
      version: '1.0.0',
      manifest: { capabilities: ['context.read'] },
      manifestVersion: 2,
      packageFormat: 'service_zip',
      scanResult: { passed: true, findings: [] },
      reviewSnapshot: { schema_version: 1 },
      reviewSnapshotHash: 'a'.repeat(64),
      submittedBy: 17,
      reviewStatus: 'pending',
      publishStatus: 'unpublished',
      packagePath: '/runtime/workflow_service/1.0.0',
      entryFile: 'dist/index.js',
    };
    versionRepo.findOne.mockResolvedValue(pendingVersion);
    certificationService.assertRuntimeApproved.mockResolvedValue({ id: 5, userId: 17 });

    await service.approveVersion('workflow_service', '1.0.0', 'Verified', 88, ['context.read']);

    expect(certificationService.assertRuntimeApproved).toHaveBeenCalledWith(17, 'service');
    expect(reviewSnapshotService.verify).toHaveBeenCalledWith(pendingVersion);
    expect(servicePackageService.verifyInstalledEntry).toHaveBeenCalledWith(pendingVersion);
    expect(versionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ reviewStatus: 'approved', reviewerId: 88 }),
    );
  });

  it('does not approve restricted service content when frozen evidence verification fails', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 9,
      code: 'workflow_service',
      type: 'service',
      runtimeType: 'service',
      trustLevel: 'developer_restricted',
      developerId: 17,
      status: 'pending_review',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 12,
      appId: 9,
      version: '1.0.0',
      manifest: { capabilities: [] },
      manifestVersion: 2,
      packageFormat: 'service_zip',
      scanResult: { passed: true, findings: [] },
      reviewSnapshot: { schema_version: 1 },
      reviewSnapshotHash: 'a'.repeat(64),
      submittedBy: 17,
      reviewStatus: 'pending',
      publishStatus: 'unpublished',
      packagePath: '/runtime/workflow_service/1.0.0',
      entryFile: 'dist/index.js',
    });
    certificationService.assertRuntimeApproved.mockResolvedValue({ id: 5, userId: 17 });
    reviewSnapshotService.verify.mockImplementation(() => {
      throw new BadRequestException('Frozen review content integrity check failed');
    });

    await expect(
      service.approveVersion('workflow_service', '1.0.0', 'Verified', 88, []),
    ).rejects.toThrow('Frozen review content integrity check failed');
    expect(versionRepo.save).not.toHaveBeenCalled();
    expect(servicePackageService.verifyInstalledEntry).not.toHaveBeenCalled();
  });

  it('keeps rejected developer service content terminal', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 9,
      code: 'workflow_service',
      type: 'service',
      trustLevel: 'developer_restricted',
      status: 'rejected',
      entryUrl: '',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 12,
      appId: 9,
      version: '1.0.0',
      reviewStatus: 'rejected',
      publishStatus: 'unpublished',
      reviewSnapshot: { schema_version: 1 },
      reviewSnapshotHash: 'a'.repeat(64),
    });

    await expect(service.submitVersion('workflow_service', '1.0.0', 17)).rejects.toThrow(
      'Rejected developer service content is immutable; upload a new version',
    );
    expect(versionRepo.save).not.toHaveBeenCalled();
    expect(appRepo.save).not.toHaveBeenCalled();
  });

  it('publishes an approved static version and updates the app entry url', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 4,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'published',
      entryMode: 'static',
      entryUrl: '/apps-static/job_board/0.9.0/dist/index.html',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 8,
      appId: 4,
      version: '1.0.0',
      reviewStatus: 'approved',
      publishStatus: 'unpublished',
      packagePath: '/safe/packages/job_board/1.0.0',
      entryFile: 'dist/index.html',
      manifest: {
        code: 'job_board',
        name: 'Job Board Next',
        version: '1.0.0',
        type: 'static',
        entry: 'dist/index.html',
        category: 'Recruiting',
        summary: 'Reviewed summary',
        description: 'Reviewed description',
        icon: 'ri:briefcase-line',
        tenant_scoped: true,
        permissions: [],
      },
    });
    versionRepo.save.mockImplementation(async (value) => value);
    storageService.publishVersion.mockResolvedValue({
      publishPath: '/safe/public/job_board/1.0.0',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });

    await expect(service.publishVersion('job_board', '1.0.0', 66)).resolves.toMatchObject({
      version: '1.0.0',
      publish_status: 'published',
      publish_path: '/safe/public/job_board/1.0.0',
    });

    expect(storageService.publishVersion).toHaveBeenCalledWith({
      appCode: 'job_board',
      version: '1.0.0',
      sourceDir: '/safe/packages/job_board/1.0.0',
      entryFile: 'dist/index.html',
    });
    expect(versionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        publishStatus: 'published',
        publishPath: '/safe/public/job_board/1.0.0',
      }),
    );
    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 4,
        name: 'Job Board Next',
        category: 'Recruiting',
        summary: 'Reviewed summary',
        status: 'published',
        entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
      }),
    );
  });

  it('preserves reviewed app metadata on the first version publish', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 4,
      code: 'job_board',
      name: 'Edited Job Board',
      category: 'Creator Tools',
      summary: 'Edited after review feedback',
      type: 'static',
      status: 'approved',
      entryMode: 'static',
      entryUrl: '',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 8,
      appId: 4,
      version: '1.0.0',
      reviewStatus: 'approved',
      publishStatus: 'unpublished',
      packagePath: '/safe/packages/job_board/1.0.0',
      publishPath: '',
      entryFile: 'dist/index.html',
      manifest: {
        code: 'job_board',
        name: 'Original Manifest Name',
        version: '1.0.0',
        type: 'static',
        entry: 'dist/index.html',
        category: 'Original',
        summary: 'Original summary',
        description: '',
        icon: '',
        tenant_scoped: true,
        permissions: [],
      },
    });
    versionRepo.save.mockImplementation(async (value) => value);
    storageService.publishVersion.mockResolvedValue({
      publishPath: '/safe/public/job_board/1.0.0',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });

    await service.publishVersion('job_board', '1.0.0', 66);

    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Edited Job Board',
        category: 'Creator Tools',
        summary: 'Edited after review feedback',
        status: 'published',
      }),
    );
  });

  it('unpublishes the active static version and records an audit log', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 4,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'published',
      entryMode: 'static',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 8,
      appId: 4,
      version: '1.0.0',
      reviewStatus: 'approved',
      publishStatus: 'published',
      publishPath: '/safe/public/job_board/1.0.0',
      entryFile: 'dist/index.html',
    });
    versionRepo.find.mockResolvedValue([]);
    versionRepo.save.mockImplementation(async (value) => value);

    await expect(
      service.unpublishVersion('job_board', '1.0.0', 'bad release', 66),
    ).resolves.toMatchObject({
      version: '1.0.0',
      publish_status: 'unpublished_retired',
    });

    expect(versionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ publishStatus: 'unpublished_retired' }),
    );
    expect(runtimeSessionService.revokeVersion).toHaveBeenCalledWith(8, 'unpublished');
    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved', entryUrl: '' }),
    );
    expect(reviewLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 4,
        versionId: 8,
        action: 'unpublish',
        message: 'bad release',
        operatorId: 66,
      }),
    );
  });

  it('rolls back to an approved publishable version and retires competing published versions', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 4,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'published',
      entryMode: 'static',
      entryUrl: '/apps-static/job_board/2.0.0/dist/index.html',
    });
    const rollbackTarget = {
      id: 8,
      appId: 4,
      version: '1.0.0',
      reviewStatus: 'approved',
      publishStatus: 'unpublished_retired',
      publishPath: '/safe/public/job_board/1.0.0',
      entryFile: 'dist/index.html',
      manifest: {
        code: 'job_board',
        name: 'Job Board Classic',
        version: '1.0.0',
        type: 'static',
        entry: 'dist/index.html',
        category: 'Industry',
        summary: 'Stable release',
        description: 'Stable description',
        icon: 'ri:briefcase-line',
        tenant_scoped: true,
        permissions: [],
      },
    };
    const currentVersion = {
      id: 9,
      appId: 4,
      version: '2.0.0',
      reviewStatus: 'approved',
      publishStatus: 'published',
      publishPath: '/safe/public/job_board/2.0.0',
      entryFile: 'dist/index.html',
    };
    versionRepo.findOne.mockResolvedValue(rollbackTarget);
    versionRepo.find.mockResolvedValue([currentVersion]);
    versionRepo.save.mockImplementation(async (value) => value);

    await expect(
      service.rollbackVersion('job_board', '1.0.0', 'restore stable', 66),
    ).resolves.toMatchObject({
      version: '1.0.0',
      publish_status: 'published',
      entry_url: '/apps-static/job_board/1.0.0/dist/index.html',
    });

    expect(versionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, publishStatus: 'unpublished_retired' }),
    );
    expect(runtimeSessionService.revokeVersion).toHaveBeenCalledWith(9, 'rollback_retired');
    expect(versionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 8, publishStatus: 'published' }),
    );
    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Job Board Classic',
        category: 'Industry',
        summary: 'Stable release',
        status: 'published',
        entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
      }),
    );
    expect(reviewLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 4,
        versionId: 8,
        action: 'rollback',
        message: 'restore stable',
        operatorId: 66,
      }),
    );
  });

  it('rejects rollback when the target version has no published path', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 4,
      code: 'job_board',
      type: 'static',
      status: 'published',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 8,
      appId: 4,
      version: '1.0.0',
      reviewStatus: 'approved',
      publishStatus: 'unpublished',
      publishPath: '',
      entryFile: 'dist/index.html',
    });

    await expect(service.rollbackVersion('job_board', '1.0.0', '', 66)).rejects.toThrow(
      'App version has no published artifact',
    );
    expect(appRepo.save).not.toHaveBeenCalled();
  });

  it('lists review queue records with app and version context', async () => {
    versionRepo.find.mockResolvedValue([
      {
        id: 8,
        appId: 4,
        version: '1.0.0',
        reviewStatus: 'pending',
        publishStatus: 'unpublished',
        entryFile: 'dist/index.html',
        reviewMessage: '',
      },
    ]);
    appRepo.find.mockResolvedValue([
      {
        id: 4,
        code: 'job_board',
        name: 'Job Board',
        type: 'static',
        status: 'pending_review',
        category: 'Industry',
        developerName: 'Module Factory',
        entryUrl: '',
      },
    ]);

    await expect(service.listReviewQueue({ review_status: 'pending' })).resolves.toEqual([
      expect.objectContaining({
        app_code: 'job_board',
        app_name: 'Job Board',
        app_type: 'static',
        review_status: 'pending',
        publish_status: 'unpublished',
        entry_url: '/apps-static/job_board/1.0.0/dist/index.html',
      }),
    ]);
  });

  it('filters review queue records by keyword and app type', async () => {
    versionRepo.find.mockResolvedValue([
      {
        id: 8,
        appId: 4,
        version: '1.0.0',
        reviewStatus: 'pending',
        publishStatus: 'unpublished',
        entryFile: 'dist/index.html',
      },
      {
        id: 9,
        appId: 5,
        version: '1.0.0',
        reviewStatus: 'approved',
        publishStatus: 'published',
        entryFile: 'dist/index.html',
      },
    ]);
    appRepo.find.mockResolvedValue([
      {
        id: 4,
        code: 'job_board',
        name: 'Job Board',
        type: 'static',
        status: 'pending_review',
        entryUrl: '',
      },
      {
        id: 5,
        code: 'crm_iframe',
        name: 'CRM',
        type: 'iframe',
        status: 'published',
        entryUrl: 'https://crm.example.com',
      },
    ]);

    await expect(service.listReviewQueue({ keyword: 'job', type: 'static' })).resolves.toHaveLength(
      1,
    );
  });

  it('returns only sanitized immutable evidence for restricted service reviews', async () => {
    versionRepo.find.mockResolvedValue([
      {
        id: 12,
        appId: 9,
        version: '1.0.0',
        manifest: { capabilities: ['service.invoke'], serviceTargets: ['reporting_service'] },
        manifestVersion: 2,
        packageFormat: 'service_zip',
        scanResult: {
          passed: true,
          findings: [{ code: 'warning_only', severity: 'warning', source: 'secret source' }],
          scannedFiles: 1,
          entrySha256: 'b'.repeat(64),
        },
        reviewSnapshot: {
          schema_version: 1,
          app: { code: 'workflow_service' },
          developer: { profile_id: '5', certification_status: 'certified' },
        },
        reviewSnapshotHash: 'c'.repeat(64),
        serviceTargets: ['reporting_service'],
        candidateReviewedBy: 99,
        candidateReviewedTime: new Date('2026-07-13T08:00:00.000Z'),
        reviewStatus: 'approved',
        publishStatus: 'unpublished',
        submittedBy: 17,
        reviewerId: 88,
        packagePath: '/runtime/workflow_service/1.0.0',
        publishPath: '/public/workflow_service/1.0.0',
        entryFile: 'dist/index.js',
      },
    ]);
    appRepo.find.mockResolvedValue([
      {
        id: 9,
        code: 'workflow_service',
        name: 'Workflow Service',
        type: 'service',
        runtimeType: 'service',
        trustLevel: 'developer_restricted',
        status: 'approved',
        developerName: 'Alice',
        entryUrl: '',
      },
    ]);

    const [record] = await service.listReviewQueue({ type: 'service' });

    expect(record).toMatchObject({
      trust_level: 'developer_restricted',
      review_snapshot: expect.objectContaining({ schema_version: 1 }),
      review_snapshot_hash: 'c'.repeat(64),
      candidate_reviewed_by: 99,
      candidate_reviewed_time: new Date('2026-07-13T08:00:00.000Z'),
      service_targets: ['reporting_service'],
    });
    expect(JSON.stringify(record)).not.toMatch(
      /package_path|publish_path|release_path|loopback_port|environment|command|secret source|\/runtime\//i,
    );
  });
});
