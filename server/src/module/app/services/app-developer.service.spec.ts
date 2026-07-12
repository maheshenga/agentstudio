import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppPackageEntity } from '../entities/app-package.entity';
import { AppDeveloperService } from './app-developer.service';
import { AppDeveloperCertificationService } from './app-developer-certification.service';
import { AppPlatformService } from './app-platform.service';

describe('AppDeveloperService', () => {
  let service: AppDeveloperService;

  const appRepo = {
    findOne: jest.fn(),
  };
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
        { provide: AppPlatformService, useValue: platformService },
        { provide: AppDeveloperCertificationService, useValue: certificationService },
        { provide: ConfigService, useValue: configService },
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
    expect(certificationService.assertRuntimeApproved).not.toHaveBeenCalled();
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
        visibility: 'platform',
        entry_url: '/system/user',
      } as any,
      17,
    );

    expect(platformService.updateApp).toHaveBeenCalledWith('creator_portal', {
      name: 'Changed',
      summary: 'Updated summary',
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
    appRepo.findOne.mockResolvedValue({ code: 'creator_portal', developerId: 17, status: 'rejected' });
    platformService.submitVersion.mockResolvedValue({ version: '1.0.0', review_status: 'pending' });

    await service.submitVersion('creator_portal', '1.0.0', 17);

    expect(platformService.submitVersion).toHaveBeenCalledWith('creator_portal', '1.0.0', 17);
  });
});
