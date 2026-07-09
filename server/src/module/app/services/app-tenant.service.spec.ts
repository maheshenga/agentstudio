import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppOpenLogEntity } from '../entities/app-open-log.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';
import { AppTenantService } from './app-tenant.service';
import { SaasModuleService } from '../../saas/services/saas-module.service';
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';

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
  const saasModuleService = {
    assertTenantModuleEnabled: jest.fn(),
  };
  const systemModuleAccessService = {
    diagnoseModuleAccess: jest.fn(),
    assertModuleAccess: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    installRepo.create.mockImplementation((value) => ({ ...value }));
    installRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 1, ...value }));
    openLogRepo.create.mockImplementation((value) => ({ ...value }));
    openLogRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 1, ...value }));
    saasModuleService.assertTenantModuleEnabled.mockResolvedValue(true);
    systemModuleAccessService.diagnoseModuleAccess.mockResolvedValue({
      allowed: true,
      status: 'available',
      reason: 'Module is available',
      module_code: 'test_module',
      module_name: 'Test Module',
      required_saas_module_codes: [],
      missing_saas_module_codes: [],
      tenant_saas_module_codes: [],
      tenant_enabled: true,
      tenant_entitlement_source: 'platform',
      suggestions: [],
    });
    systemModuleAccessService.assertModuleAccess.mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppTenantService,
        { provide: getRepositoryToken(AppPackageEntity), useValue: appRepo },
        { provide: getRepositoryToken(AppPackageVersionEntity), useValue: versionRepo },
        { provide: getRepositoryToken(TenantAppInstallEntity), useValue: installRepo },
        { provide: getRepositoryToken(AppOpenLogEntity), useValue: openLogRepo },
        { provide: SaasModuleService, useValue: saasModuleService },
        { provide: SystemModuleAccessService, useValue: systemModuleAccessService },
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

  it('marks marketplace apps unavailable when the SaaS plan does not include the required module', async () => {
    appRepo.find.mockResolvedValue([
      {
        id: 7,
        code: 'job_board',
        name: 'Job Board',
        type: 'iframe',
        status: 'published',
        visibility: 'marketplace',
        entryMode: 'iframe',
        entryUrl: 'https://jobs.example.com',
        saasModuleCode: 'recruiting',
      },
    ]);
    installRepo.find.mockResolvedValue([]);
    saasModuleService.assertTenantModuleEnabled.mockRejectedValue(
      new BadRequestException('Current plan has not enabled this module'),
    );

    await expect(service.listMarketplace(23)).resolves.toEqual([
      expect.objectContaining({
        code: 'job_board',
        available: false,
        availability_status: 'missing_plan_module',
        availability_reason: 'Current plan has not enabled this module',
        required_saas_module_code: 'recruiting',
      }),
    ]);
  });

  it('marks marketplace apps unavailable when the mapped system module is not enabled for the tenant', async () => {
    appRepo.find.mockResolvedValue([
      {
        id: 8,
        code: 'crm_portal',
        name: 'CRM Portal',
        type: 'iframe',
        status: 'published',
        visibility: 'marketplace',
        entryMode: 'iframe',
        entryUrl: 'https://crm.example.com',
        systemModuleCode: 'crm',
      },
    ]);
    installRepo.find.mockResolvedValue([]);
    systemModuleAccessService.diagnoseModuleAccess.mockResolvedValue({
      allowed: false,
      status: 'missing_tenant_module',
      reason: 'Tenant has not enabled this module',
      module_code: 'crm',
      module_name: 'CRM',
      required_saas_module_codes: [],
      missing_saas_module_codes: [],
      tenant_saas_module_codes: [],
      tenant_enabled: false,
      tenant_entitlement_source: null,
      suggestions: [],
    });

    await expect(service.listMarketplace(23)).resolves.toEqual([
      expect.objectContaining({
        code: 'crm_portal',
        available: false,
        availability_status: 'missing_system_module',
        availability_reason: 'Tenant has not enabled this module',
        required_system_module_code: 'crm',
      }),
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

  it('rejects installing a published app when the current plan lacks the required SaaS module', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 7,
      code: 'job_board',
      type: 'iframe',
      status: 'published',
      visibility: 'marketplace',
      entryMode: 'iframe',
      entryUrl: 'https://jobs.example.com',
      saasModuleCode: 'recruiting',
    });
    saasModuleService.assertTenantModuleEnabled.mockRejectedValue(
      new BadRequestException('Current plan has not enabled this module'),
    );

    await expect(service.installApp(23, 'job_board', 7)).rejects.toThrow(
      'Current plan has not enabled this module',
    );
    expect(installRepo.save).not.toHaveBeenCalled();
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

  it('falls back to the current published version when an installed version was retired', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'published',
      entryMode: 'static',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    installRepo.findOne.mockResolvedValue({ id: 4, tenantId: 23, appId: 1, versionId: 10, enabled: 1 });
    versionRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 9,
        appId: 1,
        version: '1.0.0',
        publishStatus: 'published',
        reviewStatus: 'approved',
      });

    await expect(service.getOpenMetadata(23, 'job_board', 7)).resolves.toMatchObject({
      code: 'job_board',
      type: 'static',
      entry_url: '/apps-static/job_board/1.0.0/dist/index.html',
      version: '1.0.0',
    });

    expect(openLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        versionId: 9,
      }),
    );
  });

  it('rejects opening an installed app when the mapped system module is unavailable', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 8,
      code: 'crm_portal',
      name: 'CRM Portal',
      type: 'iframe',
      status: 'published',
      visibility: 'marketplace',
      entryMode: 'iframe',
      entryUrl: 'https://crm.example.com',
      systemModuleCode: 'crm',
    });
    installRepo.findOne.mockResolvedValue({ id: 6, tenantId: 23, appId: 8, enabled: 1 });
    systemModuleAccessService.diagnoseModuleAccess.mockResolvedValue({
      allowed: false,
      status: 'missing_tenant_module',
      reason: 'Tenant has not enabled this module',
      module_code: 'crm',
      module_name: 'CRM',
      required_saas_module_codes: [],
      missing_saas_module_codes: [],
      tenant_saas_module_codes: [],
      tenant_enabled: false,
      tenant_entitlement_source: null,
      suggestions: [],
    });

    await expect(service.getOpenMetadata(23, 'crm_portal', 7)).rejects.toThrow(
      'Tenant has not enabled this module',
    );
    expect(openLogRepo.save).not.toHaveBeenCalled();
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
