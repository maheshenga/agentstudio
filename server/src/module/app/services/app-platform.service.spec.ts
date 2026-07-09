import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import JSZip from 'jszip';

import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppReviewLogEntity } from '../entities/app-review-log.entity';
import { AppManifestService } from './app-manifest.service';
import { AppPackageStorageService } from './app-package-storage.service';
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

  beforeEach(async () => {
    jest.clearAllMocks();
    appRepo.create.mockImplementation((value) => ({ ...value }));
    appRepo.find.mockResolvedValue([]);
    appRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 1, ...value }));
    storageService.getPublicPrefix.mockReturnValue('/apps-static/');
    reviewLogRepo.create.mockImplementation((value) => ({ ...value }));
    reviewLogRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 1, ...value }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppPlatformService,
        { provide: getRepositoryToken(AppPackageEntity), useValue: appRepo },
        { provide: getRepositoryToken(AppPackageVersionEntity), useValue: versionRepo },
        { provide: getRepositoryToken(AppReviewLogEntity), useValue: reviewLogRepo },
        { provide: AppPackageStorageService, useValue: storageService },
        { provide: AppManifestService, useValue: manifestService },
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

  it('creates an iframe app as a published marketplace app', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createApp(
        {
          code: 'supplier_portal',
          name: 'Supplier Portal',
          type: 'iframe',
          entry_url: 'https://supplier.example.com',
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
    ).rejects.toThrow('Iframe app entry must use http or https');
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

    expect(appRepo.findOne).toHaveBeenCalledWith({ where: { code: 'supplier_portal' }, withDeleted: true });
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

    expect(appRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 3, status: 'disabled' }));
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

  it('rejects updates for unknown apps', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(service.updateStatus('missing_app', 'disabled')).rejects.toBeInstanceOf(NotFoundException);
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
    });
    versionRepo.save.mockImplementation(async (value) => value);

    await expect(service.approveVersion('job_board', '1.0.0', 'Looks safe', 66)).resolves.toMatchObject({
      version: '1.0.0',
      review_status: 'approved',
      review_message: 'Looks safe',
      reviewer_id: 66,
    });

    expect(versionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: 'approved',
        reviewMessage: 'Looks safe',
        reviewerId: 66,
        reviewTime: expect.any(Date),
      }),
    );
    expect(appRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 4, status: 'approved' }));
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

  it('publishes an approved static version and updates the app entry url', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 4,
      code: 'job_board',
      name: 'Job Board',
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

    await expect(service.unpublishVersion('job_board', '1.0.0', 'bad release', 66)).resolves.toMatchObject({
      version: '1.0.0',
      publish_status: 'unpublished_retired',
    });

    expect(versionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ publishStatus: 'unpublished_retired' }));
    expect(appRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved', entryUrl: '' }));
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

    await expect(service.rollbackVersion('job_board', '1.0.0', 'restore stable', 66)).resolves.toMatchObject({
      version: '1.0.0',
      publish_status: 'published',
      entry_url: '/apps-static/job_board/1.0.0/dist/index.html',
    });

    expect(versionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 9, publishStatus: 'unpublished_retired' }));
    expect(versionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 8, publishStatus: 'published' }));
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
    appRepo.findOne.mockResolvedValue({ id: 4, code: 'job_board', type: 'static', status: 'published' });
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
      { id: 4, code: 'job_board', name: 'Job Board', type: 'static', status: 'pending_review', entryUrl: '' },
      { id: 5, code: 'crm_iframe', name: 'CRM', type: 'iframe', status: 'published', entryUrl: 'https://crm.example.com' },
    ]);

    await expect(service.listReviewQueue({ keyword: 'job', type: 'static' })).resolves.toHaveLength(1);
  });
});
