import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import * as tenantUtils from '../../common/utils/tenant.util';
import { SaasPlanEntity } from './entities/saas-plan.entity';
import { SaasSubscriptionEntity } from './entities/saas-subscription.entity';
import { SaasTrialEntity } from './entities/saas-trial.entity';
import { SaasTenantController } from './saas-tenant.controller';
import { SaasOrderService } from './services/saas-order.service';
import { SaasOrderRiskService } from './services/saas-order-risk.service';
import { SaasPlanService } from './services/saas-plan.service';
import { SaasQuotaService } from './services/saas-quota.service';
import { SaasResourcePackOrderService } from './services/saas-resource-pack-order.service';
import { SaasResourcePackService } from './services/saas-resource-pack.service';
import { SaasSubscriptionLifecycleService } from './services/saas-subscription-lifecycle.service';

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
    listTenantOrders: jest.fn(),
    toResponse: jest.fn((order) => ({
      order_no: order.orderNo,
      plan_code: order.planCode,
      amount_cents: order.amountCents,
      status: order.status,
      payment_method: order.paymentMethod,
      alipay_trade_no: order.alipayTradeNo,
      paid_at: order.paidAt,
      closed_at: order.closedAt ?? null,
      close_reason: order.closeReason ?? null,
    })),
  };
  const saasOrderRiskService = {
    closeTenantPlanOrder: jest.fn(),
    closeTenantResourcePackOrder: jest.fn(),
  };

  const saasPlanService = {
    listTenantPlans: jest.fn(),
  };
  const saasResourcePackService = {
    listTenantResourcePacks: jest.fn(),
  };
  const saasResourcePackOrderService = {
    createTenantOrder: jest.fn(),
    findTenantOrder: jest.fn(),
    listTenantOrders: jest.fn(),
    toResponse: jest.fn((order) => ({
      order_no: order.orderNo,
      resource_pack_code: order.resourcePackCode,
      status: order.status,
      closed_at: order.closedAt ?? null,
      close_reason: order.closeReason ?? null,
    })),
  };
  const lifecycleService = {
    decorateSubscription: jest.fn(() => ({
      days_until_expiry: 5,
      is_expiring_soon: true,
      is_expired_by_time: false,
    })),
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
          provide: SaasOrderRiskService,
          useValue: saasOrderRiskService,
        },
        {
          provide: SaasPlanService,
          useValue: saasPlanService,
        },
        {
          provide: SaasResourcePackService,
          useValue: saasResourcePackService,
        },
        {
          provide: SaasResourcePackOrderService,
          useValue: saasResourcePackOrderService,
        },
        {
          provide: SaasSubscriptionLifecycleService,
          useValue: lifecycleService,
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

    expect(lifecycleService.decorateSubscription).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
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
      days_until_expiry: 5,
      is_expiring_soon: true,
      is_expired_by_time: false,
    });
  });

  it('returns enabled tenant plans with quota summaries from plan service', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasPlanService.listTenantPlans.mockResolvedValue([
      {
        id: 2,
        code: 'pro',
        name: 'Pro',
        billing_cycle: 'monthly',
        price_monthly: 9900,
        price_yearly: 99000,
        quotas: [{ quota_type: 'tokens', total_quota: 1000000, status: 1 }],
      },
    ]);

    const result = await controller.plans();

    expect(saasPlanService.listTenantPlans).toHaveBeenCalled();
    expect(saasPlanRepo.find).not.toHaveBeenCalled();
    expect(result.data).toEqual([
      {
        id: 2,
        code: 'pro',
        name: 'Pro',
        billing_cycle: 'monthly',
        price_monthly: 9900,
        price_yearly: 99000,
        quotas: [{ quota_type: 'tokens', total_quota: 1000000, status: 1 }],
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
      closed_at: null,
      close_reason: null,
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
      closed_at: null,
      close_reason: null,
    });
  });

  it('lists current tenant plan orders', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasOrderService.listTenantOrders.mockResolvedValue({
      list: [{ order_no: 'SO20260702000000001000001' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.orders({ status: 'closed', close_reason: 'tenant_cancelled' });

    expect(saasOrderService.listTenantOrders).toHaveBeenCalledWith(88, {
      status: 'closed',
      close_reason: 'tenant_cancelled',
    });
    expect(result.data).toEqual({
      list: [{ order_no: 'SO20260702000000001000001' }],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('cancels a current tenant plan order', async () => {
    const closedAt = new Date('2026-07-03T00:00:00.000Z');
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasOrderRiskService.closeTenantPlanOrder.mockResolvedValue({
      orderNo: 'SO20260702000000001000001',
      planCode: 'pro',
      amountCents: 9900,
      status: 'closed',
      closedAt,
      closeReason: 'tenant_cancelled',
    });

    const result = await controller.cancelOrder('SO20260702000000001000001');

    expect(saasOrderRiskService.closeTenantPlanOrder).toHaveBeenCalledWith(88, 'SO20260702000000001000001');
    expect(result.data).toEqual({
      order_no: 'SO20260702000000001000001',
      plan_code: 'pro',
      amount_cents: 9900,
      status: 'closed',
      payment_method: undefined,
      alipay_trade_no: undefined,
      paid_at: undefined,
      closed_at: closedAt,
      close_reason: 'tenant_cancelled',
    });
  });

  it('returns active tenant resource packs in tenant context', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasResourcePackService.listTenantResourcePacks.mockResolvedValue([{ code: 'ai_calls_1k' }]);

    const result = await controller.resourcePacks();

    expect(saasResourcePackService.listTenantResourcePacks).toHaveBeenCalled();
    expect(result.data).toEqual([{ code: 'ai_calls_1k' }]);
  });

  it('creates a tenant resource pack order in tenant context', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasResourcePackOrderService.createTenantOrder.mockResolvedValue({
      orderNo: 'RPO20260703120000001000001',
      resourcePackCode: 'tokens_1m',
      status: 'pending',
    });

    const result = await controller.createResourcePackOrder({
      resource_pack_code: 'tokens_1m',
      payment_method: 'alipay',
    });

    expect(saasResourcePackOrderService.createTenantOrder).toHaveBeenCalledWith(88, {
      resource_pack_code: 'tokens_1m',
      payment_method: 'alipay',
    });
    expect(result.data).toEqual({
      order_no: 'RPO20260703120000001000001',
      resource_pack_code: 'tokens_1m',
      status: 'pending',
      closed_at: null,
      close_reason: null,
    });
  });

  it('returns a tenant resource pack order by order number', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasResourcePackOrderService.findTenantOrder.mockResolvedValue({
      orderNo: 'RPO20260703120000001000001',
      resourcePackCode: 'tokens_1m',
      status: 'paid',
    });

    const result = await controller.resourcePackOrder('RPO20260703120000001000001');

    expect(saasResourcePackOrderService.findTenantOrder).toHaveBeenCalledWith(88, 'RPO20260703120000001000001');
    expect(result.data).toEqual({
      order_no: 'RPO20260703120000001000001',
      resource_pack_code: 'tokens_1m',
      status: 'paid',
      closed_at: null,
      close_reason: null,
    });
  });

  it('lists tenant resource pack orders in tenant context', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasResourcePackOrderService.listTenantOrders.mockResolvedValue({
      list: [{ order_no: 'RPO20260703120000001000001' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.resourcePackOrders({ status: 'pending' });

    expect(saasResourcePackOrderService.listTenantOrders).toHaveBeenCalledWith(88, { status: 'pending' });
    expect(result.data).toEqual({
      list: [{ order_no: 'RPO20260703120000001000001' }],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('cancels a current tenant resource pack order', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasOrderRiskService.closeTenantResourcePackOrder.mockResolvedValue({
      orderNo: 'RPO20260703120000001000001',
      resourcePackCode: 'tokens_1m',
      status: 'closed',
      closedAt: new Date('2026-07-03T01:00:00.000Z'),
      closeReason: 'tenant_cancelled',
    });

    const result = await controller.cancelResourcePackOrder('RPO20260703120000001000001');

    expect(saasOrderRiskService.closeTenantResourcePackOrder).toHaveBeenCalledWith(
      88,
      'RPO20260703120000001000001',
    );
    expect(result.data).toEqual({
      order_no: 'RPO20260703120000001000001',
      resource_pack_code: 'tokens_1m',
      status: 'closed',
      closed_at: new Date('2026-07-03T01:00:00.000Z'),
      close_reason: 'tenant_cancelled',
    });
  });
});
