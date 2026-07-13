import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { AppLicenseAccessService } from '../../app-commerce/services/app-license-access.service';
import { AppCapabilityGrantEntity } from '../entities/app-capability-grant.entity';
import { AppOpenLogEntity } from '../entities/app-open-log.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppServiceInstanceEntity } from '../entities/app-service-instance.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';
import { AppRuntimeContextService } from './app-runtime-context.service';
import { AppRuntimeSessionService } from './app-runtime-session.service';
import { AppIframeLaunchService } from './app-iframe-launch.service';
import { AppCapabilityPolicyService } from './app-capability-policy.service';
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
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const instanceRepo = {
    find: jest.fn(),
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
  const appLicenseAccessService = {
    getAccessState: jest.fn(),
    getAccessStates: jest.fn(),
  };
  const appRuntimeContextService = {
    buildBootstrap: jest.fn(),
  };
  const appRuntimeSessionService = {
    isEnabled: jest.fn(),
    issue: jest.fn(),
    revokeInstall: jest.fn(),
  };
  const appIframeLaunchService = {
    isEnabled: jest.fn(),
    create: jest.fn(),
    exchange: jest.fn(),
  };
  const capabilityPolicy = {
    getCapabilityState: jest.fn(),
    setTenantCapabilities: jest.fn(),
  };
  const grantRepo = {};
  const dataSource = {
    transaction: jest.fn(async (callback) =>
      callback({
        getRepository: (entity) => {
          if (entity === TenantAppInstallEntity) return installRepo;
          if (entity === AppCapabilityGrantEntity) return grantRepo;
          throw new Error('Unexpected transaction repository');
        },
      }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    installRepo.create.mockImplementation((value) => ({ ...value }));
    versionRepo.find.mockResolvedValue([]);
    instanceRepo.find.mockResolvedValue([]);
    instanceRepo.findOne.mockResolvedValue(null);
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
    appLicenseAccessService.getAccessState.mockResolvedValue(
      commerceAccess({ commerce_enabled: false, access_status: 'legacy_free' }),
    );
    appLicenseAccessService.getAccessStates.mockImplementation(
      async (_tenantId: number, apps: Array<{ id: number; installed?: boolean }>) =>
        new Map(
          apps.map((app) => [
            Number(app.id),
            commerceAccess({
              commerce_enabled: false,
              access_status: 'legacy_free',
              action: app.installed ? 'open' : 'install',
            }),
          ]),
        ),
    );
    appRuntimeContextService.buildBootstrap.mockResolvedValue(null);
    appRuntimeSessionService.isEnabled.mockReturnValue(false);
    appRuntimeSessionService.issue.mockResolvedValue({
      token: 'runtime-token',
      expires_at: '2026-07-12T07:00:00.000Z',
      capabilities: ['context.read'],
    });
    appRuntimeSessionService.revokeInstall.mockResolvedValue(1);
    appIframeLaunchService.isEnabled.mockReturnValue(false);
    appIframeLaunchService.create.mockResolvedValue(null);
    appIframeLaunchService.exchange.mockResolvedValue({
      token: 'host-only-runtime-token',
      expires_at: '2026-07-12T08:00:00.000Z',
      capabilities: ['context.read'],
    });
    capabilityPolicy.getCapabilityState.mockResolvedValue({
      requested: [],
      platform_approved: [],
      tenant_approved: [],
      effective: [],
    });
    capabilityPolicy.setTenantCapabilities.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppTenantService,
        { provide: getRepositoryToken(AppPackageEntity), useValue: appRepo },
        { provide: getRepositoryToken(AppPackageVersionEntity), useValue: versionRepo },
        { provide: getRepositoryToken(AppServiceInstanceEntity), useValue: instanceRepo },
        { provide: getRepositoryToken(TenantAppInstallEntity), useValue: installRepo },
        { provide: getRepositoryToken(AppOpenLogEntity), useValue: openLogRepo },
        { provide: SaasModuleService, useValue: saasModuleService },
        { provide: SystemModuleAccessService, useValue: systemModuleAccessService },
        { provide: AppLicenseAccessService, useValue: appLicenseAccessService },
        { provide: AppRuntimeContextService, useValue: appRuntimeContextService },
        { provide: AppRuntimeSessionService, useValue: appRuntimeSessionService },
        { provide: AppIframeLaunchService, useValue: appIframeLaunchService },
        { provide: AppCapabilityPolicyService, useValue: capabilityPolicy },
        { provide: DataSource, useValue: dataSource },
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

  it('exposes authoritative capability state in marketplace records', async () => {
    appRepo.find.mockResolvedValue([
      {
        id: 1,
        code: 'job_board',
        name: 'Job Board',
        type: 'static',
        status: 'published',
        visibility: 'marketplace',
      },
    ]);
    installRepo.find.mockResolvedValue([]);
    versionRepo.find.mockResolvedValue([
      {
        id: 9,
        appId: 1,
        version: '1.0.0',
        publishStatus: 'published',
        reviewStatus: 'approved',
        manifest: { permissions: ['runtime:context:read'] },
      },
    ]);
    capabilityPolicy.getCapabilityState.mockResolvedValue({
      requested: ['context.read'],
      platform_approved: ['context.read'],
      tenant_approved: [],
      effective: [],
    });

    await expect(service.listMarketplace(23)).resolves.toEqual([
      expect.objectContaining({
        requested_capabilities: ['context.read'],
        platform_approved_capabilities: ['context.read'],
        tenant_approved_capabilities: [],
        effective_capabilities: [],
      }),
    ]);
    expect(capabilityPolicy.getCapabilityState).toHaveBeenCalledWith(23, 9, ['context.read']);
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

    await expect(service.installApp(23, 'draft_app', 7)).rejects.toBeInstanceOf(
      BadRequestException,
    );
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
    versionRepo.find.mockResolvedValue([
      {
        id: 9,
        appId: 1,
        version: '1.0.0',
        publishStatus: 'published',
        reviewStatus: 'approved',
        manifest: { permissions: ['runtime:context:read'] },
      },
    ]);
    capabilityPolicy.getCapabilityState.mockResolvedValue({
      requested: ['context.read'],
      platform_approved: ['context.read'],
      tenant_approved: ['context.read'],
      effective: ['context.read'],
    });

    await expect(service.listInstalled(23)).resolves.toEqual([
      expect.objectContaining({
        id: 6,
        enabled: true,
        requested_capabilities: ['context.read'],
        platform_approved_capabilities: ['context.read'],
        tenant_approved_capabilities: ['context.read'],
        effective_capabilities: ['context.read'],
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

  it('installs a service app with its active healthy published version', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 3,
      code: 'workflow_service',
      type: 'service',
      runtimeType: 'service',
      status: 'published',
      visibility: 'platform',
    });
    instanceRepo.findOne.mockResolvedValue({
      id: 31,
      appId: 3,
      versionId: 19,
      role: 'active',
      processStatus: 'online',
      healthStatus: 'healthy',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 19,
      appId: 3,
      version: '1.0.0',
      reviewStatus: 'approved',
      publishStatus: 'published',
    });
    installRepo.findOne.mockResolvedValue(null);

    await expect(service.installApp(23, 'workflow_service', 7)).resolves.toMatchObject({
      tenant_id: 23,
      app_id: 3,
      version_id: 19,
      enabled: true,
    });

    expect(instanceRepo.findOne).toHaveBeenCalledWith({
      where: {
        appId: 3,
        role: 'active',
        processStatus: 'online',
        healthStatus: 'healthy',
      },
    });
  });

  it('rejects service installation when no healthy active release exists', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 3,
      code: 'workflow_service',
      type: 'service',
      runtimeType: 'service',
      status: 'published',
      visibility: 'platform',
    });
    instanceRepo.findOne.mockResolvedValue(null);

    await expect(service.installApp(23, 'workflow_service', 7)).rejects.toThrow(
      'Service app has no healthy active version',
    );
    expect(installRepo.save).not.toHaveBeenCalled();
  });

  it('reports service readiness without advertising an iframe open action', async () => {
    appRepo.find.mockResolvedValue([
      {
        id: 3,
        code: 'workflow_service',
        name: 'Workflow Service',
        type: 'service',
        runtimeType: 'service',
        status: 'published',
        visibility: 'platform',
      },
    ]);
    installRepo.find.mockResolvedValue([
      { id: 30, tenantId: 23, appId: 3, versionId: 19, enabled: 1 },
    ]);
    instanceRepo.find.mockResolvedValue([
      {
        id: 31,
        appId: 3,
        versionId: 19,
        role: 'active',
        processStatus: 'online',
        healthStatus: 'healthy',
      },
    ]);
    versionRepo.find.mockResolvedValue([
      {
        id: 19,
        appId: 3,
        version: '1.0.0',
        reviewStatus: 'approved',
        publishStatus: 'published',
        manifest: { capabilities: [] },
      },
    ]);

    await expect(service.listMarketplace(23)).resolves.toEqual([
      expect.objectContaining({
        code: 'workflow_service',
        installed: true,
        can_open: false,
        service_status: 'ready',
        service_version: '1.0.0',
        service_callable: true,
      }),
    ]);
  });

  it('rejects direct opening of an installed service app with a stable audit reason', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 3,
      code: 'workflow_service',
      name: 'Workflow Service',
      type: 'service',
      runtimeType: 'service',
      status: 'published',
      visibility: 'platform',
    });
    installRepo.findOne.mockResolvedValue({
      id: 30,
      tenantId: 23,
      appId: 3,
      versionId: 19,
      enabled: 1,
    });

    await expect(service.getOpenMetadata(23, 'workflow_service', 7)).rejects.toThrow(
      'Service apps cannot be opened directly',
    );
    expect(openLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appCode: 'workflow_service',
        reasonCode: 'service_not_openable',
        outcome: 'failed',
      }),
    );
    expect(appRuntimeContextService.buildBootstrap).not.toHaveBeenCalled();
  });

  it('installs and records first tenant capability consent in one transaction', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'job_board',
      type: 'static',
      status: 'published',
      visibility: 'marketplace',
    });
    versionRepo.findOne.mockResolvedValue({
      id: 9,
      appId: 1,
      version: '1.0.0',
      publishStatus: 'published',
      reviewStatus: 'approved',
      manifest: { permissions: ['runtime:context:read'] },
    });
    installRepo.findOne.mockResolvedValue(null);

    await service.installApp(23, 'job_board', 7, ['context.read']);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(capabilityPolicy.setTenantCapabilities).toHaveBeenCalledWith(
      {
        tenantId: 23,
        appId: 1,
        versionId: 9,
        capabilities: ['context.read'],
        operatorId: 7,
      },
      grantRepo,
    );
  });

  it('returns capability state only for an active tenant installation', async () => {
    appRepo.findOne.mockResolvedValue({ id: 1, code: 'job_board', status: 'published' });
    installRepo.findOne.mockResolvedValue({
      id: 5,
      tenantId: 23,
      appId: 1,
      versionId: 9,
      enabled: 1,
    });
    versionRepo.findOne.mockResolvedValue({
      id: 9,
      appId: 1,
      version: '1.0.0',
      publishStatus: 'published',
      reviewStatus: 'approved',
      manifest: { permissions: ['runtime:context:read'] },
    });
    capabilityPolicy.getCapabilityState.mockResolvedValue({
      requested: ['context.read'],
      platform_approved: ['context.read'],
      tenant_approved: [],
      effective: [],
    });

    await expect(service.getCapabilities(23, 'job_board')).resolves.toEqual({
      requested: ['context.read'],
      platform_approved: ['context.read'],
      tenant_approved: [],
      effective: [],
    });
    expect(capabilityPolicy.getCapabilityState).toHaveBeenCalledWith(23, 9, ['context.read']);
  });

  it('updates tenant capability consent for the installed published version', async () => {
    appRepo.findOne.mockResolvedValue({ id: 1, code: 'job_board', status: 'published' });
    installRepo.findOne.mockResolvedValue({
      id: 5,
      tenantId: 23,
      appId: 1,
      versionId: 9,
      enabled: 1,
    });
    versionRepo.findOne.mockResolvedValue({
      id: 9,
      appId: 1,
      version: '1.0.0',
      publishStatus: 'published',
      reviewStatus: 'approved',
      manifest: { permissions: ['runtime:context:read'] },
    });
    capabilityPolicy.getCapabilityState.mockResolvedValue({
      requested: ['context.read'],
      platform_approved: ['context.read'],
      tenant_approved: ['context.read'],
      effective: ['context.read'],
    });

    await expect(
      service.updateCapabilities(23, 'job_board', ['context.read'], 7),
    ).resolves.toMatchObject({ effective: ['context.read'] });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(capabilityPolicy.setTenantCapabilities).toHaveBeenCalledWith(
      {
        tenantId: 23,
        appId: 1,
        versionId: 9,
        capabilities: ['context.read'],
        operatorId: 7,
      },
      grantRepo,
    );
  });

  it('rejects capability changes when the tenant has no active installation', async () => {
    appRepo.findOne.mockResolvedValue({ id: 1, code: 'job_board', status: 'published' });
    installRepo.findOne.mockResolvedValue(null);

    await expect(service.updateCapabilities(23, 'job_board', ['context.read'], 7)).rejects.toThrow(
      'App is not installed',
    );
    expect(capabilityPolicy.setTenantCapabilities).not.toHaveBeenCalled();
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

    await expect(service.getOpenMetadata(23, 'job_board', 7)).rejects.toThrow(
      'App is not installed',
    );
    expect(openLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 23,
        userId: 7,
        appCode: 'job_board',
        appId: 1,
        outcome: 'failed',
        reasonCode: 'app_not_installed',
        failureMessage: 'App is not installed',
      }),
    );
  });

  it('audits an unknown app code without requiring an app id', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(service.getOpenMetadata(23, 'missing_app', 7)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(openLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 23,
        userId: 7,
        appCode: 'missing_app',
        appId: null,
        outcome: 'failed',
        reasonCode: 'app_not_found',
        failureMessage: 'App was not found',
      }),
    );
  });

  it('audits unpublished apps with a fixed safe reason', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 2,
      code: 'draft_app',
      type: 'iframe',
      status: 'draft',
    });

    await expect(service.getOpenMetadata(23, 'draft_app', 7)).rejects.toThrow(
      'App is not published',
    );

    expect(openLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appCode: 'draft_app',
        appId: 2,
        outcome: 'failed',
        reasonCode: 'app_not_published',
        failureMessage: 'App is not published',
      }),
    );
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
    installRepo.findOne.mockResolvedValue({
      id: 4,
      tenantId: 23,
      appId: 1,
      versionId: 9,
      enabled: 1,
    });
    versionRepo.findOne.mockResolvedValue({
      id: 9,
      appId: 1,
      version: '1.0.0',
      publishStatus: 'published',
      reviewStatus: 'approved',
    });
    appRuntimeContextService.buildBootstrap.mockResolvedValue({
      protocol_version: 1,
      scopes: ['runtime:context:read'],
      context: {
        tenant: { id: '23', name: 'Acme' },
        user: { id: '7', display_name: 'Owner' },
        app: { code: 'job_board', name: 'Job Board', version: '1.0.0' },
      },
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
      runtime: {
        protocol_version: 1,
        scopes: ['runtime:context:read'],
        context: {
          tenant: { id: '23' },
          user: { id: '7' },
        },
      },
    });

    expect(appRuntimeContextService.buildBootstrap).toHaveBeenCalledWith({
      tenantId: 23,
      userId: 7,
      app: expect.objectContaining({ id: 1, code: 'job_board', type: 'static' }),
      version: expect.objectContaining({ id: 9, version: '1.0.0' }),
    });

    expect(openLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 23,
        userId: 7,
        appCode: 'job_board',
        appId: 1,
        versionId: 9,
        openMode: 'iframe',
        outcome: 'success',
        reasonCode: 'none',
        failureMessage: '',
        ip: '127.0.0.1',
        userAgent: 'jest',
      }),
    );
  });

  it('returns a one-time signed external iframe launch without a runtime bearer token', async () => {
    appIframeLaunchService.isEnabled.mockReturnValue(true);
    appIframeLaunchService.create.mockResolvedValue({
      fragment: '#agentstudio_launch=signed-launch-token',
      expires_at: '2026-07-12T07:00:30.000Z',
      origin: 'https://supplier.example.com',
    });
    appRepo.findOne.mockResolvedValue({
      id: 2,
      code: 'supplier_portal',
      name: 'Supplier Portal',
      type: 'iframe',
      status: 'published',
      entryUrl: 'https://supplier.example.com/catalog-v2',
    });
    installRepo.findOne.mockResolvedValue({
      id: 5,
      tenantId: 23,
      appId: 2,
      versionId: 12,
      enabled: 1,
    });
    versionRepo.findOne.mockResolvedValue({
      id: 12,
      appId: 2,
      version: '1.0.0',
      publishStatus: 'published',
      reviewStatus: 'approved',
      manifest: {
        permissions: ['runtime:context:read'],
        entry: 'https://supplier.example.com/installed-v1',
        allowedOrigins: ['https://supplier.example.com'],
      },
    });
    capabilityPolicy.getCapabilityState.mockResolvedValue({
      requested: ['context.read'],
      platform_approved: ['context.read'],
      tenant_approved: ['context.read'],
      effective: ['context.read'],
    });

    const result = await service.getOpenMetadata(23, 'supplier_portal', 7);

    expect(result).toMatchObject({
      entry_url: 'https://supplier.example.com/installed-v1',
      sandbox: expect.stringContaining('allow-same-origin'),
      version: '1.0.0',
      runtime: null,
      launch: {
        fragment: '#agentstudio_launch=signed-launch-token',
        origin: 'https://supplier.example.com',
      },
    });
    expect(JSON.stringify(result)).not.toContain('host-only-runtime-token');
    expect(appIframeLaunchService.create).toHaveBeenCalledWith({
      tenantId: 23,
      userId: 7,
      appId: 2,
      versionId: 12,
      installId: 5,
      entryUrl: 'https://supplier.example.com/installed-v1',
      allowedOrigins: ['https://supplier.example.com'],
      capabilities: ['context.read'],
    });
    expect(appRuntimeSessionService.issue).not.toHaveBeenCalled();
  });

  it('exchanges an iframe launch using only current JWT tenant and user identity', async () => {
    await expect(service.exchangeIframeLaunch(23, 7, 'signed-launch-token')).resolves.toMatchObject(
      { token: 'host-only-runtime-token' },
    );
    expect(appIframeLaunchService.exchange).toHaveBeenCalledWith({
      tenantId: 23,
      userId: 7,
      launchToken: 'signed-launch-token',
    });
  });

  it('rejects an iframe version whose entry origin is not in its approved manifest', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 2,
      code: 'supplier_portal',
      name: 'Supplier Portal',
      type: 'iframe',
      status: 'published',
      entryUrl: 'https://supplier.example.com/app',
    });
    installRepo.findOne.mockResolvedValue({
      id: 5,
      tenantId: 23,
      appId: 2,
      versionId: 12,
      enabled: 1,
    });
    versionRepo.findOne.mockResolvedValue({
      id: 12,
      appId: 2,
      version: '1.0.0',
      publishStatus: 'published',
      reviewStatus: 'approved',
      manifest: {
        entry: 'https://unapproved.example.com/app',
        allowedOrigins: ['https://supplier.example.com'],
      },
    });

    await expect(service.getOpenMetadata(23, 'supplier_portal', 7)).rejects.toThrow(
      'Iframe version origin is invalid',
    );
    expect(appIframeLaunchService.create).not.toHaveBeenCalled();
  });

  it('issues a short-lived runtime session instead of inline context when enabled', async () => {
    appRuntimeSessionService.isEnabled.mockReturnValue(true);
    appRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'published',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    installRepo.findOne.mockResolvedValue({
      id: 4,
      tenantId: 23,
      appId: 1,
      versionId: 9,
      enabled: 1,
    });
    versionRepo.findOne.mockResolvedValue({
      id: 9,
      appId: 1,
      version: '1.0.0',
      publishStatus: 'published',
      reviewStatus: 'approved',
      manifest: { permissions: ['runtime:context:read'] },
    });
    capabilityPolicy.getCapabilityState.mockResolvedValue({
      requested: ['context.read'],
      platform_approved: ['context.read'],
      tenant_approved: ['context.read'],
      effective: ['context.read'],
    });
    appRuntimeContextService.buildBootstrap.mockResolvedValue({
      protocol_version: 1,
      scopes: ['runtime:context:read'],
      context: { tenant: { id: '23' } },
    });

    await expect(service.getOpenMetadata(23, 'job_board', 7)).resolves.toMatchObject({
      runtime: {
        protocol_version: 1,
        scopes: ['runtime:context:read'],
        context: null,
        session: { token: 'runtime-token', expires_at: '2026-07-12T07:00:00.000Z' },
      },
    });
    expect(appRuntimeSessionService.issue).toHaveBeenCalledWith({
      tenantId: 23,
      userId: 7,
      appId: 1,
      versionId: 9,
      installId: 4,
      capabilities: ['context.read'],
    });
  });

  it('omits a session when enabled but no capability is effectively granted', async () => {
    appRuntimeSessionService.isEnabled.mockReturnValue(true);
    appRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'published',
    });
    installRepo.findOne.mockResolvedValue({
      id: 4,
      tenantId: 23,
      appId: 1,
      versionId: 9,
      enabled: 1,
    });
    versionRepo.findOne.mockResolvedValue({
      id: 9,
      appId: 1,
      version: '1.0.0',
      publishStatus: 'published',
      reviewStatus: 'approved',
      manifest: { permissions: ['runtime:context:read'] },
    });
    capabilityPolicy.getCapabilityState.mockResolvedValue({
      requested: ['context.read'],
      platform_approved: ['context.read'],
      tenant_approved: [],
      effective: [],
    });
    appRuntimeContextService.buildBootstrap.mockResolvedValue({
      protocol_version: 1,
      scopes: ['runtime:context:read'],
      context: { tenant: { id: '23' } },
    });

    const result = await service.getOpenMetadata(23, 'job_board', 7);
    expect(result.runtime).toEqual({
      protocol_version: 1,
      scopes: ['runtime:context:read'],
      context: null,
    });
    expect(appRuntimeSessionService.issue).not.toHaveBeenCalled();
  });

  it('revokes runtime sessions before completing an uninstall', async () => {
    appRepo.findOne.mockResolvedValue({ id: 1, code: 'job_board' });
    installRepo.findOne.mockResolvedValue({ id: 4, tenantId: 23, appId: 1, enabled: 1 });

    await service.uninstallApp(23, 'job_board');

    expect(appRuntimeSessionService.revokeInstall).toHaveBeenCalledWith(23, 4, 'uninstalled');
    expect(appRuntimeSessionService.revokeInstall.mock.invocationCallOrder[0]).toBeLessThan(
      installRepo.save.mock.invocationCallOrder[0],
    );
  });

  it('keeps app opening successful when runtime context resolution fails', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'published',
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    installRepo.findOne.mockResolvedValue({
      id: 4,
      tenantId: 23,
      appId: 1,
      versionId: 9,
      enabled: 1,
    });
    versionRepo.findOne.mockResolvedValue({
      id: 9,
      appId: 1,
      version: '1.0.0',
      publishStatus: 'published',
      reviewStatus: 'approved',
    });
    appRuntimeContextService.buildBootstrap.mockRejectedValue(
      new Error('identity database unavailable'),
    );

    await expect(service.getOpenMetadata(23, 'job_board', 7)).resolves.toMatchObject({
      code: 'job_board',
      open_mode: 'iframe',
      runtime: null,
    });
    expect(openLogRepo.create).toHaveBeenCalledTimes(1);
    expect(openLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'success', reasonCode: 'none' }),
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
    installRepo.findOne.mockResolvedValue({
      id: 4,
      tenantId: 23,
      appId: 1,
      versionId: 10,
      enabled: 1,
    });
    versionRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
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

  it('updates a stale installation binding before issuing a fallback-version session', async () => {
    appRuntimeSessionService.isEnabled.mockReturnValue(true);
    appRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'published',
      entryUrl: '/apps-static/job_board/2.0.0/dist/index.html',
    });
    const install = { id: 4, tenantId: 23, appId: 1, versionId: 10, enabled: 1 };
    installRepo.findOne.mockResolvedValue(install);
    versionRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 11,
      appId: 1,
      version: '2.0.0',
      publishStatus: 'published',
      reviewStatus: 'approved',
      manifest: { permissions: ['runtime:context:read'] },
    });
    capabilityPolicy.getCapabilityState.mockResolvedValue({
      requested: ['context.read'],
      platform_approved: ['context.read'],
      tenant_approved: ['context.read'],
      effective: ['context.read'],
    });
    appRuntimeContextService.buildBootstrap.mockResolvedValue({
      protocol_version: 1,
      scopes: ['runtime:context:read'],
      context: { tenant: { id: '23' } },
    });

    await service.getOpenMetadata(23, 'job_board', 7);

    expect(installRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4, versionId: 11 }),
    );
    expect(appRuntimeSessionService.issue).toHaveBeenCalledWith(
      expect.objectContaining({ installId: 4, versionId: 11 }),
    );
    expect(installRepo.save.mock.invocationCallOrder[0]).toBeLessThan(
      appRuntimeSessionService.issue.mock.invocationCallOrder[0],
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
    expect(openLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appCode: 'crm_portal',
        appId: 8,
        outcome: 'failed',
        reasonCode: 'missing_system_module',
        failureMessage: 'Required tenant module is not enabled',
      }),
    );
  });

  it('audits plan entitlement blockers without leaking the underlying exception', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 9,
      code: 'recruiting_portal',
      name: 'Recruiting Portal',
      type: 'iframe',
      status: 'published',
      entryUrl: 'https://jobs.example.com',
      saasModuleCode: 'recruiting',
    });
    installRepo.findOne.mockResolvedValue({ id: 7, tenantId: 23, appId: 9, enabled: 1 });
    saasModuleService.assertTenantModuleEnabled.mockRejectedValue(
      new BadRequestException(
        'Current plan has not enabled recruiting because internal-product-key=secret',
      ),
    );

    await expect(service.getOpenMetadata(23, 'recruiting_portal', 7)).rejects.toThrow(
      'Current plan has not enabled recruiting',
    );

    expect(openLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appCode: 'recruiting_portal',
        outcome: 'failed',
        reasonCode: 'missing_plan_module',
        failureMessage: 'Required plan module is not enabled',
      }),
    );
  });

  it('audits unavailable system modules with the platform-safe reason', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 11,
      code: 'crm_reports',
      name: 'CRM Reports',
      type: 'iframe',
      status: 'published',
      entryUrl: 'https://crm.example.com/reports',
      systemModuleCode: 'crm',
    });
    installRepo.findOne.mockResolvedValue({ id: 9, tenantId: 23, appId: 11, enabled: 1 });
    systemModuleAccessService.diagnoseModuleAccess.mockResolvedValue({
      allowed: false,
      status: 'module_disabled',
      reason: 'Module disabled because operator-note=do-not-log',
      module_code: 'crm',
      module_name: 'CRM',
      required_saas_module_codes: [],
      missing_saas_module_codes: [],
      tenant_saas_module_codes: [],
      tenant_enabled: true,
      tenant_entitlement_source: 'platform',
      suggestions: [],
    });

    await expect(service.getOpenMetadata(23, 'crm_reports', 7)).rejects.toThrow('Module disabled');

    expect(openLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appCode: 'crm_reports',
        outcome: 'failed',
        reasonCode: 'system_module_unavailable',
        failureMessage: 'Required system module is unavailable',
      }),
    );
  });

  it('audits a missing published version with a fixed safe reason', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 10,
      code: 'static_portal',
      name: 'Static Portal',
      type: 'static',
      status: 'published',
      entryUrl: '/apps-static/static_portal/index.html',
    });
    installRepo.findOne.mockResolvedValue({ id: 8, tenantId: 23, appId: 10, enabled: 1 });
    versionRepo.findOne.mockResolvedValue(null);

    await expect(service.getOpenMetadata(23, 'static_portal', 7)).rejects.toThrow(
      'App has no published version',
    );

    expect(openLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appCode: 'static_portal',
        appId: 10,
        outcome: 'failed',
        reasonCode: 'published_version_missing',
        failureMessage: 'App has no published version',
      }),
    );
  });

  it('audits unexpected open failures without persisting raw exception text', async () => {
    appRepo.findOne.mockRejectedValue(new Error('database password=do-not-log'));

    await expect(service.getOpenMetadata(23, 'job_board', 7)).rejects.toThrow(
      'database password=do-not-log',
    );

    expect(openLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appCode: 'job_board',
        appId: null,
        outcome: 'failed',
        reasonCode: 'open_metadata_error',
        failureMessage: 'Unable to open app',
      }),
    );
    expect(JSON.stringify(openLogRepo.create.mock.calls)).not.toContain(
      'database password=do-not-log',
    );
  });

  it('does not fail a successful open when audit persistence is unavailable', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 2,
      code: 'tenant_members',
      name: 'Tenant Members',
      type: 'internal',
      status: 'published',
      entryUrl: '/tenant-saas/members',
    });
    installRepo.findOne.mockResolvedValue({ id: 5, tenantId: 23, appId: 2, enabled: 1 });
    openLogRepo.save.mockRejectedValue(new Error('audit database unavailable'));

    await expect(service.getOpenMetadata(23, 'tenant_members', 7)).resolves.toMatchObject({
      code: 'tenant_members',
      open_mode: 'internal_route',
    });
  });

  it('does not replace the original business error when audit persistence is unavailable', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'job_board',
      type: 'static',
      status: 'published',
    });
    installRepo.findOne.mockResolvedValue(null);
    openLogRepo.save.mockRejectedValue(new Error('audit database unavailable'));

    await expect(service.getOpenMetadata(23, 'job_board', 7)).rejects.toThrow(
      'App is not installed',
    );
  });

  it('does not replace an unexpected error when audit persistence is unavailable', async () => {
    appRepo.findOne.mockRejectedValue(new Error('primary app lookup failed'));
    openLogRepo.save.mockRejectedValue(new Error('audit database unavailable'));

    await expect(service.getOpenMetadata(23, 'job_board', 7)).rejects.toThrow(
      'primary app lookup failed',
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
      runtime: null,
    });
  });

  it('rejects unknown apps', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(service.installApp(23, 'missing', 7)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adds actionable commerce state to marketplace records with one bounded bulk lookup', async () => {
    appRepo.find.mockResolvedValue([
      {
        id: 1,
        code: 'legacy_tool',
        name: 'Legacy Tool',
        type: 'internal',
        status: 'published',
        visibility: 'marketplace',
      },
      {
        id: 2,
        code: 'paid_tool',
        name: 'Paid Tool',
        type: 'internal',
        status: 'published',
        visibility: 'marketplace',
      },
    ]);
    installRepo.find.mockResolvedValue([{ tenantId: 23, appId: 1, enabled: 1 }]);
    appLicenseAccessService.getAccessStates.mockResolvedValue(
      new Map([
        [
          1,
          commerceAccess({ commerce_enabled: true, access_status: 'legacy_free', action: 'open' }),
        ],
        [
          2,
          commerceAccess({
            commerce_enabled: true,
            access_status: 'purchase_required',
            can_install: false,
            can_open: false,
            action: 'purchase',
          }),
        ],
      ]),
    );

    await expect(service.listMarketplace(23)).resolves.toEqual([
      expect.objectContaining({
        code: 'legacy_tool',
        commerce: expect.objectContaining({ access_status: 'legacy_free' }),
        can_install: true,
        can_open: true,
        commerce_action: 'open',
      }),
      expect.objectContaining({
        code: 'paid_tool',
        commerce: expect.objectContaining({ access_status: 'purchase_required' }),
        can_install: false,
        can_open: false,
        commerce_action: 'purchase',
      }),
    ]);
    expect(appLicenseAccessService.getAccessStates).toHaveBeenCalledTimes(1);
    expect(appLicenseAccessService.getAccessState).not.toHaveBeenCalled();
  });

  it('blocks install for a paid app without a current license before module checks', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 7,
      code: 'paid_tool',
      name: 'Paid Tool',
      type: 'internal',
      status: 'published',
      visibility: 'marketplace',
      saasModuleCode: 'recruiting',
    });
    appLicenseAccessService.getAccessState.mockResolvedValue(
      commerceAccess({
        commerce_enabled: true,
        access_status: 'purchase_required',
        can_install: false,
        can_open: false,
        action: 'purchase',
      }),
    );
    saasModuleService.assertTenantModuleEnabled.mockRejectedValue(
      new BadRequestException('Tenant has not enabled this module'),
    );

    await expect(service.installApp(23, 'paid_tool', 7)).rejects.toThrow(
      'Application license is required',
    );
    expect(saasModuleService.assertTenantModuleEnabled).not.toHaveBeenCalled();
    expect(installRepo.save).not.toHaveBeenCalled();
  });

  it.each([
    ['expired', 'license_expired', 'Application license has expired'],
    ['revoked', 'license_revoked', 'Application license is inactive'],
  ])(
    'blocks open for an %s license with a stable audit reason',
    async (status, reasonCode, message) => {
      appRepo.findOne.mockResolvedValue({
        id: 7,
        code: 'paid_tool',
        name: 'Paid Tool',
        type: 'internal',
        status: 'published',
        visibility: 'marketplace',
      });
      installRepo.findOne.mockResolvedValue({ id: 5, tenantId: 23, appId: 7, enabled: 1 });
      appLicenseAccessService.getAccessState.mockResolvedValue(
        commerceAccess({
          commerce_enabled: true,
          access_status: status,
          can_install: false,
          can_open: false,
          action: status === 'expired' ? 'renew' : 'contact_admin',
        }),
      );

      await expect(service.getOpenMetadata(23, 'paid_tool', 7)).rejects.toThrow(message);
      expect(openLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ reasonCode, failureMessage: message }),
      );
    },
  );

  it('allows included access while the matching subscription remains active', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 7,
      code: 'included_tool',
      name: 'Included Tool',
      type: 'internal',
      status: 'published',
      visibility: 'marketplace',
    });
    installRepo.findOne.mockResolvedValue(null);
    appLicenseAccessService.getAccessState.mockResolvedValue(
      commerceAccess({ commerce_enabled: true, access_status: 'included' }),
    );

    await expect(service.installApp(23, 'included_tool', 7)).resolves.toMatchObject({
      app_id: 7,
      enabled: true,
    });
  });

  it('does not inspect or mutate a paid license when uninstalling an app', async () => {
    appRepo.findOne.mockResolvedValue({ id: 7, code: 'paid_tool' });
    installRepo.findOne.mockResolvedValue({ id: 5, tenantId: 23, appId: 7, enabled: 1 });

    await service.uninstallApp(23, 'paid_tool');

    expect(appLicenseAccessService.getAccessState).not.toHaveBeenCalled();
    expect(appRuntimeSessionService.revokeInstall).toHaveBeenCalledWith(23, 5, 'uninstalled');
    expect(installRepo.save).toHaveBeenCalledWith(expect.objectContaining({ enabled: 0 }));
  });
});

function commerceAccess(overrides: Record<string, unknown> = {}) {
  return {
    commerce_enabled: true,
    access_status: 'free',
    can_install: true,
    can_open: true,
    action: 'install',
    license_expires_at: null,
    plans: [],
    ...overrides,
  };
}
