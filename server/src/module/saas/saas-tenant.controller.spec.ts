import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import * as tenantUtils from '../../common/utils/tenant.util';
import { SaasPlanEntity } from './entities/saas-plan.entity';
import { SaasSubscriptionEntity } from './entities/saas-subscription.entity';
import { SaasTrialEntity } from './entities/saas-trial.entity';
import { SaasTenantController } from './saas-tenant.controller';
import { SaasOrderService } from './services/saas-order.service';
import { SaasQuotaService } from './services/saas-quota.service';
import { SaasResourcePackService } from './services/saas-resource-pack.service';

describe('SaasTenantController', () => {
  let controller: SaasTenantController;

  const saasSubscriptionRepo = {
    findOne: jest.fn(),
  };

  const saasPlanRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const saasTrialRepo = {
    findOne: jest.fn(),
  };

  const saasQuotaService = {
    getTenantUsageSummary: jest.fn(),
  };

  const saasOrderService = {
    createUpgradeOrder: jest.fn(),
    findTenantOrder: jest.fn(),
  };
  const saasResourcePackService = {
    listTenantResourcePacks: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaasTenantController],
      providers: [
        {
          provide: getRepositoryToken(SaasSubscriptionEntity),
          useValue: saasSubscriptionRepo,
        },
        {
          provide: getRepositoryToken(SaasPlanEntity),
          useValue: saasPlanRepo,
        },
        {
          provide: getRepositoryToken(SaasTrialEntity),
          useValue: saasTrialRepo,
        },
        {
          provide: SaasQuotaService,
          useValue: saasQuotaService,
        },
        {
          provide: SaasOrderService,
          useValue: saasOrderService,
        },
        {
          provide: SaasResourcePackService,
          useValue: saasResourcePackService,
        },
      ],
    }).compile();

    controller = module.get(SaasTenantController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a tenant subscription summary with plan and trial fields', async () => {
    const subscriptionStart = new Date('2026-07-01T00:00:00.000Z');
    const subscriptionEnd = new Date('2027-07-01T00:00:00.000Z');
    const trialEnd = new Date('2026-07-15T00:00:00.000Z');

    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasSubscriptionRepo.findOne.mockResolvedValue({
      id: 9,
      tenantId: 88,
      planId: 3,
      billingCycle: 'yearly',
      status: 'active',
      startTime: subscriptionStart,
      endTime: subscriptionEnd,
    });
    saasPlanRepo.findOne.mockResolvedValue({
      id: 3,
      code: 'pro',
      name: 'Pro',
    });
    saasTrialRepo.findOne.mockResolvedValue({
      id: 19,
      tenantId: 88,
      subscriptionId: 9,
      status: 'trialing',
      endTime: trialEnd,
    });

    const result = await controller.subscription();

    expect(result.data).toEqual({
      tenant_id: 88,
      plan_id: 3,
      current_plan: 'pro',
      plan_name: 'Pro',
      subscription_status: 'active',
      billing_cycle: 'yearly',
      start_time: subscriptionStart,
      end_time: subscriptionEnd,
      trial_status: 'trialing',
      trial_end_time: trialEnd,
      is_trial_active: true,
    });
  });

  it('returns active tenant upgrade plans with backend prices', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasPlanRepo.find.mockResolvedValue([
      {
        id: 1,
        code: 'free',
        name: 'Free',
        billingCycle: 'monthly',
        priceMonthly: 0,
        priceYearly: 0,
      },
      {
        id: 2,
        code: 'pro',
        name: 'Pro',
        billingCycle: 'monthly',
        priceMonthly: 9900,
        priceYearly: 99000,
      },
    ]);

    const result = await controller.plans();

    expect(saasPlanRepo.find).toHaveBeenCalledWith({
      where: {
        status: 1,
      },
      order: {
        sort: 'ASC',
        id: 'ASC',
      },
    });
    expect(result.data).toEqual([
      {
        id: 1,
        code: 'free',
        name: 'Free',
        billing_cycle: 'monthly',
        price_monthly: 0,
        price_yearly: 0,
      },
      {
        id: 2,
        code: 'pro',
        name: 'Pro',
        billing_cycle: 'monthly',
        price_monthly: 9900,
        price_yearly: 99000,
      },
    ]);
  });

  it('creates a tenant upgrade order in tenant context', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasOrderService.createUpgradeOrder.mockResolvedValue({
      orderNo: 'SO20260702000000001000001',
      tenantId: 88,
      planCode: 'pro',
      amountCents: 99000,
      status: 'pending',
    });

    const result = await controller.createOrder({
      plan_code: 'pro',
      billing_cycle: 'yearly',
      payment_method: 'alipay',
    });

    expect(saasOrderService.createUpgradeOrder).toHaveBeenCalledWith(88, {
      plan_code: 'pro',
      billing_cycle: 'yearly',
      payment_method: 'alipay',
    });
    expect(result.data).toEqual({
      order_no: 'SO20260702000000001000001',
      plan_code: 'pro',
      amount_cents: 99000,
      status: 'pending',
      payment_method: undefined,
      alipay_trade_no: undefined,
      paid_at: undefined,
    });
  });

  it('returns a tenant order by order number', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasOrderService.findTenantOrder.mockResolvedValue({
      orderNo: 'SO20260702000000001000001',
      planCode: 'pro',
      amountCents: 99000,
      status: 'paid',
      paymentMethod: 'alipay',
      alipayTradeNo: 'DEV-SO20260702000000001000001',
      paidAt: new Date('2026-07-02T00:00:00.000Z'),
    });

    const result = await controller.order('SO20260702000000001000001');

    expect(saasOrderService.findTenantOrder).toHaveBeenCalledWith(88, 'SO20260702000000001000001');
    expect(result.data).toEqual({
      order_no: 'SO20260702000000001000001',
      plan_code: 'pro',
      amount_cents: 99000,
      status: 'paid',
      payment_method: 'alipay',
      alipay_trade_no: 'DEV-SO20260702000000001000001',
      paid_at: new Date('2026-07-02T00:00:00.000Z'),
    });
  });

  it('returns active tenant resource packs in tenant context', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasResourcePackService.listTenantResourcePacks.mockResolvedValue([{ code: 'ai_calls_1k' }]);

    const result = await controller.resourcePacks();

    expect(saasResourcePackService.listTenantResourcePacks).toHaveBeenCalled();
    expect(result.data).toEqual([{ code: 'ai_calls_1k' }]);
  });
});
