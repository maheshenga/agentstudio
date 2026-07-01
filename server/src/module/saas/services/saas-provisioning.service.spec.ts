import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

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
    save: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(),
  };

  const saasPlanService = {
    getFreePlan: jest.fn(),
  };

  const saasQuotaService = {
    initializeTenantQuota: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    manager.create.mockImplementation((_entity, payload) => payload);
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

    dataSource.transaction.mockImplementation(async (callback) => callback(manager));
    saasPlanService.getFreePlan.mockResolvedValue(freePlan);
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

  it('signs up a tenant owner with tenant, owner role, free subscription, trial, and quota', async () => {
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

    expect(saasQuotaService.initializeTenantQuota).toHaveBeenCalledWith(202, 9);
  });

  it('creates a tenant from the platform with an explicit tenant code', async () => {
    const result = await service.createTenantFromPlatform({
      tenant_name: 'Beta Labs',
      tenant_code: 'beta-labs',
      owner_username: 'beta-owner',
      owner_password: 'AnotherSecret123!',
      owner_realname: 'Beta Owner',
      plan_code: 'free',
      with_trial: true,
    });

    expect(result).toEqual({ userId: 101, tenantId: 202 });

    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantName: 'Beta Labs',
        tenantCode: 'beta-labs',
        contactName: 'Beta Owner',
      }),
    );
  });
});
