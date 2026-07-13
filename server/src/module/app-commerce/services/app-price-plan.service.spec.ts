import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppPackageEntity } from '../../app/entities/app-package.entity';
import { AppPricePlanEntity } from '../entities/app-price-plan.entity';
import { AppPricePlanService } from './app-price-plan.service';

describe('AppPricePlanService', () => {
  let service: AppPricePlanService;

  const appRepo = {
    findOne: jest.fn(),
  };
  const planRepo = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    appRepo.findOne.mockResolvedValue({ id: 7, code: 'workflow', name: 'Workflow' });
    planRepo.create.mockImplementation((value) => value);
    planRepo.save.mockImplementation(async (value) => ({ id: 31, ...value }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppPricePlanService,
        { provide: getRepositoryToken(AppPackageEntity), useValue: appRepo },
        { provide: getRepositoryToken(AppPricePlanEntity), useValue: planRepo },
      ],
    }).compile();

    service = module.get(AppPricePlanService);
  });

  it('filters selected-tenant plans by the authoritative tenant id and hides internal fields', async () => {
    planRepo.find.mockResolvedValue([
      createPlan({ id: 1, code: 'free_all', pricingModel: 'free' }),
      createPlan({
        id: 2,
        code: 'tenant_pro',
        pricingModel: 'subscription',
        billingPeriod: 'monthly',
        amountCents: 9900,
        developerShareBps: 7000,
        saleScope: 'selected_tenants',
        tenantIds: [23],
      }),
      createPlan({
        id: 3,
        code: 'other_tenant',
        saleScope: 'selected_tenants',
        tenantIds: [99],
      }),
      createPlan({ id: 4, code: 'disabled', status: 0 }),
    ]);

    const plans = await service.listTenantPlans(7, 23);

    expect(planRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { appId: 7, status: 1 } }),
    );
    expect(plans.map((plan) => plan.code)).toEqual(['free_all', 'tenant_pro']);
    expect(plans[1]).toMatchObject({
      pricing_model: 'subscription',
      billing_period: 'monthly',
      amount_cents: 9900,
      currency: 'CNY',
    });
    expect(plans[1]).not.toHaveProperty('developer_share_bps');
    expect(plans[1]).not.toHaveProperty('tenant_ids');
    expect(plans[1]).not.toHaveProperty('included_plan_codes');
    expect(plans[1]).not.toHaveProperty('status');
  });

  it('rejects free or included plans with a non-zero amount or developer share', async () => {
    await expect(
      service.savePlan(
        'workflow',
        {
          code: 'free_plan',
          name: 'Free',
          pricing_model: 'free',
          billing_period: 'none',
          amount_cents: 1,
          developer_share_bps: 0,
        },
        9,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.savePlan(
        'workflow',
        {
          code: 'included_plan',
          name: 'Included',
          pricing_model: 'included',
          billing_period: 'none',
          amount_cents: 0,
          developer_share_bps: 1,
          included_plan_codes: ['pro'],
        },
        9,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(planRepo.save).not.toHaveBeenCalled();
  });

  it('rejects paid plans without an explicit developer_share_bps', async () => {
    await expect(
      service.savePlan(
        'workflow',
        {
          code: 'pro_monthly',
          name: 'Pro monthly',
          pricing_model: 'subscription',
          billing_period: 'monthly',
          amount_cents: 9900,
        },
        9,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(planRepo.save).not.toHaveBeenCalled();
  });

  it('rejects duplicate active price-plan codes per application', async () => {
    planRepo.findOne.mockResolvedValue({ id: 12, appId: 7, code: 'pro_monthly', status: 1 });

    await expect(
      service.savePlan(
        'workflow',
        {
          code: 'pro_monthly',
          name: 'Pro monthly',
          pricing_model: 'subscription',
          billing_period: 'monthly',
          amount_cents: 9900,
          developer_share_bps: 7000,
        },
        9,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('normalizes selected tenant ids and included SaaS plan codes before saving', async () => {
    planRepo.findOne.mockResolvedValue(null);

    await service.savePlan(
      'workflow',
      {
        code: 'team_bundle',
        name: ' Team Bundle ',
        pricing_model: 'included',
        billing_period: 'none',
        amount_cents: 0,
        developer_share_bps: 0,
        included_plan_codes: [' Pro ', 'pro', 'enterprise'],
        sale_scope: 'selected_tenants',
        tenant_ids: [23, 11, 23],
        trial_days: 0,
        status: 1,
        sort: 30,
      },
      9,
    );

    expect(planRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 7,
        code: 'team_bundle',
        name: 'Team Bundle',
        currency: 'CNY',
        includedPlanCodes: ['pro', 'enterprise'],
        saleScope: 'selected_tenants',
        tenantIds: [11, 23],
      }),
    );
  });
});

function createPlan(overrides: Partial<AppPricePlanEntity> = {}): AppPricePlanEntity {
  return {
    id: 1,
    appId: 7,
    code: 'free_all',
    name: 'Free',
    pricingModel: 'free',
    billingPeriod: 'none',
    amountCents: 0,
    currency: 'CNY',
    trialDays: 0,
    developerShareBps: 0,
    includedPlanCodes: [],
    saleScope: 'all',
    tenantIds: [],
    status: 1,
    sort: 100,
    ...overrides,
  };
}
