import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { SysMenuEntity } from '../../system/menu/entities/menu.entity';
import { SysRoleMenuEntity } from '../../system/role/entities/role-width-menu.entity';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasTrialEntity } from '../entities/saas-trial.entity';
import { SaasPlanService } from './saas-plan.service';
import { SaasProvisioningService } from './saas-provisioning.service';
import { SaasQuotaService } from './saas-quota.service';

describe('SaasProvisioningService', () => {
  let service: SaasProvisioningService;

  const freePlan: SaasPlanEntity = {
    id: 9,
    name: 'Free',
    code: 'free',
    priceMonthly: 0,
    priceYearly: 0,
    billingCycle: 'monthly',
    maxUsers: 3,
    maxStorageMb: 1024,
    sort: 1,
    status: 1,
  } as SaasPlanEntity;

  const manager = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    insert: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(),
  };

  const saasPlanService = {
    getFreePlan: jest.fn(),
    getPlanByCode: jest.fn(),
  };

  const saasQuotaService = {
    initializeTenantQuota: jest.fn(),
  };

  const tenantMenuRecords = [
    { id: 501, code: 'TenantSaas', slug: null },
    { id: 502, code: 'TenantBilling', slug: null },
    { id: 503, code: 'TenantQuota', slug: null },
    { id: 513, code: 'TenantResourcePack', slug: null },
    { id: 504, code: 'TenantMember', slug: null },
    { id: 511, code: 'TenantSystemModules', slug: null },
    { id: 505, code: null, slug: 'tenant:billing:view' },
    { id: 506, code: null, slug: 'tenant:billing:upgrade' },
    { id: 507, code: null, slug: 'tenant:quota:view' },
    { id: 508, code: null, slug: 'tenant:resource:buy' },
    { id: 509, code: null, slug: 'tenant:member:index' },
    { id: 510, code: null, slug: 'tenant:member:create' },
    { id: 518, code: null, slug: 'tenant:member:update' },
    { id: 519, code: null, slug: 'tenant:member:remove' },
    { id: 520, code: null, slug: 'tenant:member:reset-password' },
    { id: 512, code: null, slug: 'tenant:module:list' },
    { id: 514, code: null, slug: 'tenant:resource-pack:view' },
    { id: 515, code: null, slug: 'tenant:resource-pack-order:create' },
    { id: 516, code: null, slug: 'tenant:resource-pack-order:view' },
    { id: 517, code: null, slug: 'tenant:resource-pack-order:pay' },
    { id: 521, code: 'AppCenter', slug: null },
    { id: 522, code: 'AppMarketplace', slug: null },
    { id: 523, code: 'AppInstalledApps', slug: null },
    { id: 524, code: 'AppOpenRunner', slug: null },
    { id: 525, code: 'AppTenantUsage', slug: null },
    { id: 526, code: null, slug: 'app:tenant:marketplace' },
    { id: 527, code: null, slug: 'app:tenant:install' },
    { id: 528, code: null, slug: 'app:tenant:open' },
    { id: 529, code: null, slug: 'app:analytics:tenant' },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    manager.create.mockImplementation((_entity, payload) => payload);
    manager.findOne.mockResolvedValue(null);
    manager.find.mockImplementation(async (entity) => {
      if (entity === SysMenuEntity) {
        return tenantMenuRecords;
      }

      return [];
    });
    manager.insert.mockResolvedValue(undefined);
    manager.save.mockImplementation(async (_entity, payload) => {
      if (payload.username) {
        return { id: 101, ...payload };
      }
      if (payload.tenantName) {
        return { id: 202, ...payload };
      }
      if (payload.code?.startsWith('tenant:')) {
        return { id: payload.code.endsWith(':owner') ? 301 : payload.code.endsWith(':admin') ? 302 : 303, ...payload };
      }
      if (payload.planId) {
        return { id: 401, ...payload };
      }
      if (payload.subscriptionId !== undefined) {
        return { id: 402, ...payload };
      }
      return { id: 999, ...payload };
    });

    dataSource.transaction.mockImplementation(async (callback) => {
      const resultPromise = callback(manager);
      expect(saasQuotaService.initializeTenantQuota).not.toHaveBeenCalled();
      return resultPromise;
    });
    saasPlanService.getFreePlan.mockResolvedValue(freePlan);
    saasPlanService.getPlanByCode.mockResolvedValue({
      ...freePlan,
      id: 19,
      code: 'pro',
      name: 'Pro',
      billingCycle: 'yearly',
    });
    saasQuotaService.initializeTenantQuota.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasProvisioningService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: SaasPlanService,
          useValue: saasPlanService,
        },
        {
          provide: SaasQuotaService,
          useValue: saasQuotaService,
        },
      ],
    }).compile();

    service = module.get(SaasProvisioningService);
  });

  it('signs up a tenant owner with tenant, baseline role menus, free subscription, trial, and quota', async () => {
    const result = await service.signup({
      username: 'founder',
      password: 'Secret123!',
      realname: 'Founder',
      tenant_name: 'Acme AI',
      phone: '13800000000',
      email: 'founder@example.com',
      industry: 'software',
      team_size: '1-10',
    });

    expect(result).toEqual({ userId: 101, tenantId: 202 });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);

    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        username: 'founder',
        password: expect.any(String),
        realname: 'Founder',
        phone: '13800000000',
        email: 'founder@example.com',
        status: 1,
      }),
    );

    const savedUser = manager.save.mock.calls.find(([, payload]) => payload.username)?.[1];
    expect(savedUser.password).not.toBe('Secret123!');

    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantName: 'Acme AI',
        tenantCode: expect.stringMatching(/^acmeai-\d{13}$/),
        contactName: 'Founder',
        contactPhone: '13800000000',
        contactEmail: 'founder@example.com',
        status: 1,
        remark: expect.stringContaining('industry:software'),
      }),
    );

    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 101,
        tenantId: 202,
        isDefault: 1,
      }),
    );

    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: 'Owner',
        code: 'tenant:202:owner',
        tenantId: 202,
      }),
    );

    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 101,
        roleId: 301,
        tenantId: 202,
        status: 1,
      }),
    );

    expect(manager.save).toHaveBeenCalledWith(
      SaasSubscriptionEntity,
      expect.objectContaining({
        tenantId: 202,
        planId: 9,
        status: 'active',
        startTime: expect.any(Date),
        endTime: null,
      }),
    );

    expect(manager.save).toHaveBeenCalledWith(
      SaasTrialEntity,
      expect.objectContaining({
        tenantId: 202,
        subscriptionId: 401,
        status: 'trialing',
        startTime: expect.any(Date),
        endTime: expect.any(Date),
      }),
    );

    const trialPayload = manager.save.mock.calls.find(([entity]) => entity === SaasTrialEntity)?.[1];
    expect(trialPayload.endTime.getTime() - trialPayload.startTime.getTime()).toBe(14 * 24 * 60 * 60 * 1000);

    const roleMenuRows = manager.insert.mock.calls
      .filter(([entity]) => entity === SysRoleMenuEntity)
      .flatMap(([, values]) => values as Array<{ roleId: number; menuId: number }>);

    expect(roleMenuRows).toEqual(
      expect.arrayContaining([
        { roleId: 301, menuId: 501 },
        { roleId: 301, menuId: 502 },
        { roleId: 301, menuId: 503 },
        { roleId: 301, menuId: 513 },
        { roleId: 301, menuId: 504 },
        { roleId: 301, menuId: 511 },
        { roleId: 301, menuId: 505 },
        { roleId: 301, menuId: 506 },
        { roleId: 301, menuId: 507 },
        { roleId: 301, menuId: 508 },
        { roleId: 301, menuId: 509 },
        { roleId: 301, menuId: 510 },
        { roleId: 301, menuId: 518 },
        { roleId: 301, menuId: 519 },
        { roleId: 301, menuId: 520 },
        { roleId: 301, menuId: 512 },
        { roleId: 301, menuId: 514 },
        { roleId: 301, menuId: 515 },
        { roleId: 301, menuId: 516 },
        { roleId: 301, menuId: 517 },
        { roleId: 301, menuId: 521 },
        { roleId: 301, menuId: 522 },
        { roleId: 301, menuId: 523 },
        { roleId: 301, menuId: 524 },
        { roleId: 301, menuId: 525 },
        { roleId: 301, menuId: 526 },
        { roleId: 301, menuId: 527 },
        { roleId: 301, menuId: 528 },
        { roleId: 301, menuId: 529 },
        { roleId: 302, menuId: 513 },
        { roleId: 302, menuId: 511 },
        { roleId: 302, menuId: 506 },
        { roleId: 302, menuId: 508 },
        { roleId: 302, menuId: 510 },
        { roleId: 302, menuId: 518 },
        { roleId: 302, menuId: 519 },
        { roleId: 302, menuId: 520 },
        { roleId: 302, menuId: 512 },
        { roleId: 302, menuId: 514 },
        { roleId: 302, menuId: 515 },
        { roleId: 302, menuId: 516 },
        { roleId: 302, menuId: 517 },
        { roleId: 302, menuId: 521 },
        { roleId: 302, menuId: 522 },
        { roleId: 302, menuId: 523 },
        { roleId: 302, menuId: 524 },
        { roleId: 302, menuId: 525 },
        { roleId: 302, menuId: 526 },
        { roleId: 302, menuId: 527 },
        { roleId: 302, menuId: 528 },
        { roleId: 302, menuId: 529 },
        { roleId: 303, menuId: 511 },
        { roleId: 303, menuId: 505 },
        { roleId: 303, menuId: 507 },
        { roleId: 303, menuId: 509 },
        { roleId: 303, menuId: 512 },
        { roleId: 303, menuId: 521 },
        { roleId: 303, menuId: 522 },
        { roleId: 303, menuId: 523 },
        { roleId: 303, menuId: 524 },
        { roleId: 303, menuId: 526 },
        { roleId: 303, menuId: 528 },
      ]),
    );
    expect(roleMenuRows).not.toEqual(
      expect.arrayContaining([
        { roleId: 303, menuId: 506 },
        { roleId: 303, menuId: 508 },
        { roleId: 303, menuId: 510 },
        { roleId: 303, menuId: 518 },
        { roleId: 303, menuId: 519 },
        { roleId: 303, menuId: 520 },
        { roleId: 303, menuId: 513 },
        { roleId: 303, menuId: 514 },
        { roleId: 303, menuId: 515 },
        { roleId: 303, menuId: 516 },
        { roleId: 303, menuId: 517 },
        { roleId: 303, menuId: 525 },
        { roleId: 303, menuId: 527 },
        { roleId: 303, menuId: 529 },
      ]),
    );

    expect(saasQuotaService.initializeTenantQuota).toHaveBeenCalledWith(202, 9, manager);
  });

  it('creates a tenant from the platform with an explicit tenant code and defaults to the free plan when no plan code is provided', async () => {
    const result = await service.createTenantFromPlatform({
      tenant_name: 'Beta Labs',
      tenant_code: 'beta-labs',
      owner_username: 'beta-owner',
      owner_password: 'AnotherSecret123!',
      owner_realname: 'Beta Owner',
      with_trial: true,
    });

    expect(result).toEqual({ userId: 101, tenantId: 202 });
    expect(saasPlanService.getFreePlan).toHaveBeenCalledTimes(1);
    expect(saasPlanService.getPlanByCode).not.toHaveBeenCalled();

    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantName: 'Beta Labs',
        tenantCode: 'beta-labs',
        contactName: 'Beta Owner',
      }),
    );
  });

  it('uses a non-free plan code for platform provisioning and quota initialization', async () => {
    const result = await service.createTenantFromPlatform({
      tenant_name: 'Gamma Labs',
      tenant_code: 'gamma-labs',
      owner_username: 'gamma-owner',
      owner_password: 'AnotherSecret123!',
      owner_realname: 'Gamma Owner',
      plan_code: 'pro',
      with_trial: false,
    });

    expect(result).toEqual({ userId: 101, tenantId: 202 });
    expect(saasPlanService.getPlanByCode).toHaveBeenCalledWith('pro');
    expect(manager.save).toHaveBeenCalledWith(
      SaasSubscriptionEntity,
      expect.objectContaining({
        tenantId: 202,
        planId: 19,
        billingCycle: 'yearly',
        status: 'active',
      }),
    );
    expect(saasQuotaService.initializeTenantQuota).toHaveBeenCalledWith(202, 19, manager);
  });

  it('rejects signup with an existing username before creating tenant records', async () => {
    manager.findOne.mockImplementation(async (_entity, options) => {
      if (options?.where?.username === 'founder') {
        return { id: 88, username: 'founder' };
      }
      return null;
    });

    await expect(
      service.signup({
        username: 'founder',
        password: 'Secret123!',
        tenant_name: 'Acme AI',
        phone: '13800000000',
        email: 'founder@example.com',
      }),
    ).rejects.toThrow('登录账号已存在');

    expect(manager.save).not.toHaveBeenCalled();
    expect(saasQuotaService.initializeTenantQuota).not.toHaveBeenCalled();
  });

  it('rejects platform tenant creation with an existing tenant code before saving records', async () => {
    manager.findOne.mockImplementation(async (_entity, options) => {
      if (options?.where?.tenantCode === 'acme') {
        return { id: 99, tenantCode: 'acme' };
      }
      return null;
    });

    await expect(
      service.createTenantFromPlatform({
        tenant_name: 'Acme AI',
        tenant_code: 'acme',
        owner_username: 'new-owner',
        owner_password: 'Secret123!',
      }),
    ).rejects.toThrow('租户编码已存在');

    expect(manager.save).not.toHaveBeenCalled();
    expect(saasQuotaService.initializeTenantQuota).not.toHaveBeenCalled();
  });
});
