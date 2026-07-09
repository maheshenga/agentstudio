import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppOpenLogEntity } from '../entities/app-open-log.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';
import { AppTenantService } from './app-tenant.service';

describe('AppTenantService', () => {
  let service: AppTenantService;

  const appRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const versionRepo = {
    findOne: jest.fn(),
  };
  const installRepo = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const openLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    installRepo.create.mockImplementation((value) => ({ ...value }));
    installRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 1, ...value }));
    openLogRepo.create.mockImplementation((value) => ({ ...value }));
    openLogRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 1, ...value }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppTenantService,
        { provide: getRepositoryToken(AppPackageEntity), useValue: appRepo },
        { provide: getRepositoryToken(AppPackageVersionEntity), useValue: versionRepo },
        { provide: getRepositoryToken(TenantAppInstallEntity), useValue: installRepo },
        { provide: getRepositoryToken(AppOpenLogEntity), useValue: openLogRepo },
      ],
    }).compile();

    service = module.get(AppTenantService);
  });

  it('lists published marketplace apps with tenant install state', async () => {
    appRepo.find.mockResolvedValue([
      {
        id: 1,
        code: 'job_board',
        name: 'Job Board',
        type: 'static',
        status: 'published',
        visibility: 'marketplace',
        entryMode: 'static',
        entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
      },
      {
        id: 2,
        code: 'supplier_portal',
        name: 'Supplier Portal',
        type: 'iframe',
        status: 'published',
        visibility: 'marketplace',
        entryMode: 'iframe',
        entryUrl: 'https://supplier.example.com',
      },
    ]);
    installRepo.find.mockResolvedValue([{ tenantId: 23, appId: 1, enabled: 1 }]);

    await expect(service.listMarketplace(23)).resolves.toEqual([
      expect.objectContaining({ code: 'job_board', installed: true }),
      expect.objectContaining({ code: 'supplier_portal', installed: false }),
    ]);
  });

  it('rejects installing unpublished apps', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'draft_app',
      type: 'iframe',
      status: 'draft',
      visibility: 'marketplace',
      entryMode: 'iframe',
      entryUrl: 'https://draft.example.com',
    });

    await expect(service.installApp(23, 'draft_app', 7)).rejects.toBeInstanceOf(BadRequestException);
    expect(installRepo.save).not.toHaveBeenCalled();
  });

  it('lists installed apps with app metadata for tenant UI', async () => {
    installRepo.find.mockResolvedValue([
      {
        id: 6,
        tenantId: 23,
        appId: 1,
        versionId: 9,
        enabled: 1,
        source: 'marketplace',
        installedBy: 7,
      },
    ]);
    appRepo.find.mockResolvedValue([
      {
        id: 1,
        code: 'job_board',
        name: 'Job Board',
        type: 'static',
        status: 'published',
        visibility: 'marketplace',
        entryMode: 'static',
        entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
      },
    ]);

    await expect(service.listInstalled(23)).resolves.toEqual([
      expect.objectContaining({
        id: 6,
        enabled: true,
        app: expect.objectContaining({
          code: 'job_board',
          name: 'Job Board',
          type: 'static',
          status: 'published',
        }),
      }),
    ]);
  });

  it('installs a published static app with its published version', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'job_board',
      type: 'static',
      status: 'published',
      visibility: 'marketplace',
      entryMode: 'static',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 9,
      appId: 1,
      version: '1.0.0',
      publishStatus: 'published',
      reviewStatus: 'approved',
    });
    installRepo.findOne.mockResolvedValue(null);

    await expect(service.installApp(23, 'job_board', 7)).resolves.toMatchObject({
      tenant_id: 23,
      app_id: 1,
      version_id: 9,
      enabled: true,
      source: 'marketplace',
    });

    expect(installRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 23,
        appId: 1,
        versionId: 9,
        enabled: 1,
        source: 'marketplace',
        installedBy: 7,
        installedTime: expect.any(Date),
      }),
    );
  });

  it('rejects opening apps that are not installed by the tenant', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'job_board',
      type: 'static',
      status: 'published',
      entryMode: 'static',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    installRepo.findOne.mockResolvedValue(null);

    await expect(service.getOpenMetadata(23, 'job_board', 7)).rejects.toThrow('App is not installed');
  });

  it('returns static iframe open metadata and writes an open log', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'published',
      entryMode: 'static',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    installRepo.findOne.mockResolvedValue({ id: 4, tenantId: 23, appId: 1, versionId: 9, enabled: 1 });
    versionRepo.findOne.mockResolvedValue({
      id: 9,
      appId: 1,
      version: '1.0.0',
      publishStatus: 'published',
      reviewStatus: 'approved',
    });

    await expect(
      service.getOpenMetadata(23, 'job_board', 7, { ip: '127.0.0.1', userAgent: 'jest' }),
    ).resolves.toMatchObject({
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      open_mode: 'iframe',
      entry_url: '/apps-static/job_board/1.0.0/dist/index.html',
      sandbox: 'allow-scripts allow-forms allow-popups allow-downloads',
      version: '1.0.0',
    });

    expect(openLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 23,
        userId: 7,
        appId: 1,
        versionId: 9,
        openMode: 'iframe',
        ip: '127.0.0.1',
        userAgent: 'jest',
      }),
    );
  });

  it('returns internal route metadata for installed internal apps', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 2,
      code: 'tenant_members',
      name: 'Tenant Members',
      type: 'internal',
      status: 'published',
      entryMode: 'internal_route',
      entryUrl: '/tenant-saas/members',
    });
    installRepo.findOne.mockResolvedValue({ id: 5, tenantId: 23, appId: 2, enabled: 1 });

    await expect(service.getOpenMetadata(23, 'tenant_members', 7)).resolves.toMatchObject({
      code: 'tenant_members',
      type: 'internal',
      open_mode: 'internal_route',
      entry_url: '/tenant-saas/members',
      sandbox: '',
    });
  });

  it('rejects unknown apps', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(service.installApp(23, 'missing', 7)).rejects.toBeInstanceOf(NotFoundException);
  });
});
