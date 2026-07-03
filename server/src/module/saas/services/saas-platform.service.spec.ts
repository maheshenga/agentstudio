import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasTenantResourceEntity } from '../entities/saas-tenant-resource.entity';
import { SaasPlatformService } from './saas-platform.service';
import { SaasSubscriptionLifecycleService } from './saas-subscription-lifecycle.service';
import { SaasResourcePackOrderService } from './saas-resource-pack-order.service';
import { SaasResourcePackService } from './saas-resource-pack.service';

describe('SaasPlatformService', () => {
  let service: SaasPlatformService;

  const orderRepo = {
    find: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
  };
  const subscriptionRepo = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
  };
  const planRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const tenantResourceRepo = {
    find: jest.fn(),
  };
  const resourcePackOrderRepo = {
    find: jest.fn(),
  };
  const resourcePackService = {
    listPlatformResourcePacks: jest.fn(),
  };
  const resourcePackOrderService = {
    listPlatformOrders: jest.fn(),
    findPlatformOrder: jest.fn(),
  };
  const lifecycleService = {
    getLifecycleOverview: jest.fn(),
    decorateSubscription: jest.fn((subscription) => ({
      days_until_expiry: subscription.endTime ? 10 : null,
      is_expiring_soon: false,
      is_expired_by_time: false,
    })),
    buildExpiringWhere: jest.fn(() => ({ status: 'active', endTime: expect.any(Object) })),
    buildExpiredSinceWhere: jest.fn(() => ({ status: 'expired', endTime: expect.any(Object) })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasPlatformService,
        { provide: getRepositoryToken(SaasOrderEntity), useValue: orderRepo },
        { provide: getRepositoryToken(SaasSubscriptionEntity), useValue: subscriptionRepo },
        { provide: getRepositoryToken(SaasPlanEntity), useValue: planRepo },
        { provide: getRepositoryToken(SaasTenantResourceEntity), useValue: tenantResourceRepo },
        { provide: getRepositoryToken(SaasResourcePackOrderEntity), useValue: resourcePackOrderRepo },
        { provide: SaasResourcePackService, useValue: resourcePackService },
        { provide: SaasResourcePackOrderService, useValue: resourcePackOrderService },
        { provide: SaasSubscriptionLifecycleService, useValue: lifecycleService },
      ],
    }).compile();

    service = module.get(SaasPlatformService);
  });


  it('returns zero usage overview when there is no SaaS operating data', async () => {
    subscriptionRepo.findAndCount.mockResolvedValue([[], 0]);
    orderRepo.findAndCount.mockResolvedValue([[], 0]);
    orderRepo.find.mockResolvedValue([]);
    resourcePackOrderRepo.find.mockResolvedValue([]);
    tenantResourceRepo.find.mockResolvedValue([]);
    planRepo.find.mockResolvedValue([]);

    await expect(service.getUsageOverview()).resolves.toEqual({
      kpis: {
        active_subscriptions: 0,
        trialing_subscriptions: 0,
        expired_subscriptions: 0,
        pending_plan_orders: 0,
        pending_resource_pack_orders: 0,
        paid_plan_order_amount_cents: 0,
        paid_resource_pack_order_amount_cents: 0,
        total_paid_amount_cents: 0,
      },
      quota_summary: [],
      plan_distribution: [],
      recent_plan_orders: [],
      recent_resource_pack_orders: [],
    });
  });

  it('aggregates platform usage KPIs, quotas, plan distribution, and recent orders', async () => {
    const now = new Date('2026-07-03T06:00:00.000Z');

    subscriptionRepo.findAndCount.mockResolvedValue([
      [
        { id: 1, tenantId: 10, planId: 2, billingCycle: 'yearly', status: 'active', createTime: now },
        { id: 2, tenantId: 11, planId: 2, billingCycle: 'monthly', status: 'active', createTime: now },
        { id: 3, tenantId: 12, planId: 3, billingCycle: 'monthly', status: 'trialing', createTime: now },
        { id: 4, tenantId: 13, planId: 99, billingCycle: 'monthly', status: 'expired', createTime: now },
      ],
      4,
    ]);

    orderRepo.findAndCount.mockResolvedValue([
      [
        { id: 20, orderNo: 'SO-PAID', tenantId: 10, planId: 2, planCode: 'pro', billingCycle: 'yearly', amountCents: 99000, status: 'paid', paidAt: now, createTime: now },
        { id: 21, orderNo: 'SO-PENDING', tenantId: 11, planId: 2, planCode: 'pro', billingCycle: 'monthly', amountCents: 9900, status: 'pending', createTime: now },
      ],
      2,
    ]);
    orderRepo.find.mockResolvedValue([
      { id: 21, orderNo: 'SO-PENDING', tenantId: 11, planId: 2, planCode: 'pro', billingCycle: 'monthly', amountCents: 9900, currency: 'CNY', paymentMethod: 'alipay', status: 'pending', createTime: now },
      { id: 20, orderNo: 'SO-PAID', tenantId: 10, planId: 2, planCode: 'pro', billingCycle: 'yearly', amountCents: 99000, currency: 'CNY', paymentMethod: 'alipay', status: 'paid', paidAt: now, createTime: now },
    ]);

    resourcePackOrderRepo.find.mockResolvedValue([
      { id: 30, orderNo: 'RPO-PAID', tenantId: 10, resourcePackCode: 'tokens_1m', resourcePackName: 'Tokens 1M', resourceType: 'tokens', quotaAmount: 1000000, amountCents: 19900, status: 'paid', paidAt: now, createTime: now },
      { id: 31, orderNo: 'RPO-PENDING', tenantId: 11, resourcePackCode: 'ai_1k', resourcePackName: 'AI 1K', resourceType: 'ai_calls', quotaAmount: 1000, amountCents: 9900, status: 'pending', createTime: now },
    ]);

    tenantResourceRepo.find.mockResolvedValue([
      { tenantId: 10, resourceType: 'tokens', totalQuota: 1000, usedQuota: 250 },
      { tenantId: 11, resourceType: 'tokens', totalQuota: 3000, usedQuota: 750 },
      { tenantId: 12, resourceType: 'ai_calls', totalQuota: 100, usedQuota: 40 },
    ]);

    planRepo.find.mockResolvedValue([
      { id: 2, code: 'pro', name: 'Pro' },
      { id: 3, code: 'enterprise', name: 'Enterprise' },
    ]);

    const result = await service.getUsageOverview();

    expect(result.kpis).toEqual({
      active_subscriptions: 2,
      trialing_subscriptions: 1,
      expired_subscriptions: 1,
      pending_plan_orders: 1,
      pending_resource_pack_orders: 1,
      paid_plan_order_amount_cents: 99000,
      paid_resource_pack_order_amount_cents: 19900,
      total_paid_amount_cents: 118900,
    });
    expect(result.quota_summary).toEqual([
      { resource_type: 'tokens', total_quota: 4000, used_quota: 1000, remaining_quota: 3000, usage_rate: 25 },
      { resource_type: 'ai_calls', total_quota: 100, used_quota: 40, remaining_quota: 60, usage_rate: 40 },
    ]);
    expect(result.plan_distribution).toEqual([
      { plan_id: 2, plan_code: 'pro', plan_name: 'Pro', active_count: 2 },
    ]);
    expect(result.recent_plan_orders).toHaveLength(2);
    expect(result.recent_resource_pack_orders).toHaveLength(2);
  });

  it('lists SaaS orders with paging and filters', async () => {
    const paidAt = new Date('2026-07-02T00:00:00.000Z');
    orderRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 88,
          orderNo: 'SO20260702000000001000001',
          tenantId: 12,
          planId: 2,
          planCode: 'pro',
          billingCycle: 'yearly',
          amountCents: 99000,
          currency: 'CNY',
          paymentMethod: 'alipay',
          status: 'paid',
          alipayTradeNo: '2026070222000000000001',
          paidAt,
          createTime: paidAt,
        },
      ],
      1,
    ]);

    const result = await service.listOrders({ page: '2', limit: '5', status: 'paid', tenant_id: '12' });

    expect(orderRepo.findAndCount).toHaveBeenCalledWith({
      where: { status: 'paid', tenantId: 12 },
      order: { createTime: 'DESC', id: 'DESC' },
      skip: 5,
      take: 5,
    });
    expect(result).toEqual({
      list: [
        {
          id: 88,
          order_no: 'SO20260702000000001000001',
          tenant_id: 12,
          plan_id: 2,
          plan_code: 'pro',
          billing_cycle: 'yearly',
          amount_cents: 99000,
          currency: 'CNY',
          payment_method: 'alipay',
          status: 'paid',
          alipay_trade_no: '2026070222000000000001',
          paid_at: paidAt,
          create_time: paidAt,
        },
      ],
      total: 1,
      page: 2,
      limit: 5,
    });
  });

  it('lists SaaS subscriptions with paging and filters', async () => {
    const startTime = new Date('2026-07-02T00:00:00.000Z');
    const endTime = new Date('2027-07-02T00:00:00.000Z');
    subscriptionRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 99,
          tenantId: 12,
          planId: 2,
          billingCycle: 'yearly',
          status: 'active',
          startTime,
          endTime,
          cancelAtPeriodEnd: 0,
          remark: 'Activated by order SO20260702000000001000001',
          createTime: startTime,
        },
      ],
      1,
    ]);

    const result = await service.listSubscriptions({ page: '1', limit: '10', status: 'active', tenant_id: '12' });

    expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith({
      where: { status: 'active', tenantId: 12 },
      order: { createTime: 'DESC', id: 'DESC' },
      skip: 0,
      take: 10,
    });
    expect(result).toEqual({
      list: [
        {
          id: 99,
          tenant_id: 12,
          plan_id: 2,
          billing_cycle: 'yearly',
          status: 'active',
          start_time: startTime,
          end_time: endTime,
          cancel_at_period_end: 0,
          remark: 'Activated by order SO20260702000000001000001',
          create_time: startTime,
          days_until_expiry: 10,
          is_expiring_soon: false,
          is_expired_by_time: false,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    });
  });

  it('decorates platform subscription list rows with lifecycle fields', async () => {
    const startTime = new Date('2026-07-02T00:00:00.000Z');
    const endTime = new Date('2026-07-13T00:00:00.000Z');
    lifecycleService.decorateSubscription.mockReturnValueOnce({
      days_until_expiry: 10,
      is_expiring_soon: false,
      is_expired_by_time: false,
    });
    subscriptionRepo.findAndCount.mockResolvedValue([
      [{ id: 99, tenantId: 12, planId: 2, billingCycle: 'yearly', status: 'active', startTime, endTime }],
      1,
    ]);

    const result = await service.listSubscriptions({ status: 'active' });

    expect(result.list[0]).toMatchObject({
      id: 99,
      days_until_expiry: 10,
      is_expiring_soon: false,
      is_expired_by_time: false,
    });
    expect(lifecycleService.decorateSubscription).toHaveBeenCalledWith(expect.objectContaining({ id: 99 }));
  });

  it('filters subscriptions by expiring lifecycle status', async () => {
    subscriptionRepo.findAndCount.mockResolvedValue([[], 0]);

    await service.listSubscriptions({ lifecycle_status: 'expiring', expires_within_days: '14' } as any);

    expect(lifecycleService.buildExpiringWhere).toHaveBeenCalledWith(expect.any(Date), '14');
    expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'active' }),
    }));
  });

  it('filters subscriptions by expired lifecycle status', async () => {
    subscriptionRepo.findAndCount.mockResolvedValue([[], 0]);

    await service.listSubscriptions({ lifecycle_status: 'expired', expired_since_days: '30' } as any);

    expect(lifecycleService.buildExpiredSinceWhere).toHaveBeenCalledWith(expect.any(Date), '30');
    expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'expired' }),
    }));
  });

  it('lets explicit status override lifecycle status', async () => {
    subscriptionRepo.findAndCount.mockResolvedValue([[], 0]);

    await service.listSubscriptions({ status: 'frozen', lifecycle_status: 'expiring' } as any);

    expect(lifecycleService.buildExpiringWhere).not.toHaveBeenCalled();
    expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'frozen' }),
    }));
  });

  it('returns lifecycle overview from lifecycle service', async () => {
    lifecycleService.getLifecycleOverview.mockResolvedValue({
      active_count: 3,
      expiring_7_days_count: 1,
      expiring_30_days_count: 2,
      expired_count: 4,
    });

    await expect(service.getSubscriptionLifecycleOverview()).resolves.toEqual({
      active_count: 3,
      expiring_7_days_count: 1,
      expiring_30_days_count: 2,
      expired_count: 4,
    });
  });

  it('filters SaaS orders by order number and plan code', async () => {
    orderRepo.findAndCount.mockResolvedValue([[{ orderNo: 'SO1', planCode: 'pro' }], 1]);

    await service.listOrders({ order_no: 'SO1', plan_code: 'pro' });

    expect(orderRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: { orderNo: 'SO1', planCode: 'pro' },
    }));
  });

  it('finds a platform SaaS order by order number', async () => {
    orderRepo.findOne.mockResolvedValue({ id: 1, orderNo: 'SO1', tenantId: 12, planCode: 'pro' });

    await expect(service.findOrder('SO1')).resolves.toMatchObject({ order_no: 'SO1', tenant_id: 12 });
    expect(orderRepo.findOne).toHaveBeenCalledWith({ where: { orderNo: 'SO1' } });
  });

  it('filters subscriptions by plan id', async () => {
    subscriptionRepo.findAndCount.mockResolvedValue([[{ id: 9, tenantId: 12, planId: 2, status: 'active' }], 1]);

    await service.listSubscriptions({ plan_id: '2' });

    expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { planId: 2 } }));
  });

  it('filters subscriptions by plan code when plan id is absent', async () => {
    planRepo.findOne.mockResolvedValue({ id: 3, code: 'team' });
    subscriptionRepo.findAndCount.mockResolvedValue([[{ id: 10, tenantId: 12, planId: 3, status: 'active' }], 1]);

    await service.listSubscriptions({ plan_code: 'team' });

    expect(planRepo.findOne).toHaveBeenCalledWith({ where: { code: 'team' } });
    expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { planId: 3 } }));
  });

  it('returns an empty subscription page for an unknown plan code', async () => {
    planRepo.findOne.mockResolvedValue(null);

    await expect(service.listSubscriptions({ plan_code: 'missing' })).resolves.toMatchObject({ list: [], total: 0 });
    expect(subscriptionRepo.findAndCount).not.toHaveBeenCalled();
  });

  it('finds subscription detail by id', async () => {
    subscriptionRepo.findOne.mockResolvedValue({ id: 9, tenantId: 12, planId: 2, status: 'active' });

    await expect(service.findSubscription(9)).resolves.toMatchObject({ id: 9, tenant_id: 12, plan_id: 2 });
    expect(subscriptionRepo.findOne).toHaveBeenCalledWith({ where: { id: 9 } });
  });

  it('delegates resource pack listing to the resource pack catalog service', async () => {
    resourcePackService.listPlatformResourcePacks.mockResolvedValue({ list: [{ code: 'tokens_1m' }], total: 1, page: 1, limit: 20 });

    await expect(service.listResourcePacks({ resource_type: 'tokens' })).resolves.toEqual({ list: [{ code: 'tokens_1m' }], total: 1, page: 1, limit: 20 });
    expect(resourcePackService.listPlatformResourcePacks).toHaveBeenCalledWith({ resource_type: 'tokens' });
  });

  it('delegates resource pack order listing to the resource pack order service', async () => {
    resourcePackOrderService.listPlatformOrders.mockResolvedValue({ list: [{ order_no: 'RPO20260703120000001000001' }], total: 1, page: 1, limit: 20 });

    await expect(service.listResourcePackOrders({ status: 'paid' })).resolves.toEqual({ list: [{ order_no: 'RPO20260703120000001000001' }], total: 1, page: 1, limit: 20 });
    expect(resourcePackOrderService.listPlatformOrders).toHaveBeenCalledWith({ status: 'paid' });
  });

  it('delegates platform resource pack order detail lookup', async () => {
    resourcePackOrderService.findPlatformOrder.mockResolvedValue({ order_no: 'RPO1' });

    await expect(service.findResourcePackOrder('RPO1')).resolves.toEqual({ order_no: 'RPO1' });
    expect(resourcePackOrderService.findPlatformOrder).toHaveBeenCalledWith('RPO1');
  });
});
