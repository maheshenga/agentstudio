import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasRevenueReportService } from './saas-revenue-report.service';

describe('SaasRevenueReportService', () => {
  let service: SaasRevenueReportService;

  const orderRepo = { find: jest.fn() };
  const resourcePackOrderRepo = { find: jest.fn() };
  const subscriptionRepo = { count: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasRevenueReportService,
        { provide: getRepositoryToken(SaasOrderEntity), useValue: orderRepo },
        { provide: getRepositoryToken(SaasResourcePackOrderEntity), useValue: resourcePackOrderRepo },
        { provide: getRepositoryToken(SaasSubscriptionEntity), useValue: subscriptionRepo },
      ],
    }).compile();

    service = module.get(SaasRevenueReportService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns zero revenue overview with a 30-day zero trend for empty datasets', async () => {
    orderRepo.find.mockResolvedValue([]);
    resourcePackOrderRepo.find.mockResolvedValue([]);
    subscriptionRepo.count.mockResolvedValue(0);

    const result = await service.getOverview();

    expect(result.kpis).toEqual({
      today_revenue_cents: 0,
      month_revenue_cents: 0,
      total_revenue_cents: 0,
      plan_revenue_cents: 0,
      resource_pack_revenue_cents: 0,
      today_paid_order_count: 0,
      month_paid_order_count: 0,
      total_paid_order_count: 0,
      month_paid_tenant_count: 0,
      total_paid_tenant_count: 0,
      active_subscription_count: 0,
      average_order_value_cents: 0,
      month_average_order_value_cents: 0,
    });
    expect(result.revenue_split).toEqual([
      { source: 'plan', revenue_cents: 0, order_count: 0, percent: 0 },
      { source: 'resource_pack', revenue_cents: 0, order_count: 0, percent: 0 },
    ]);
    expect(result.daily_trend).toHaveLength(30);
    expect(result.daily_trend.every((row) => row.total_revenue_cents === 0 && row.paid_order_count === 0)).toBe(true);
    expect(result.top_tenants).toEqual([]);
    expect(result.recent_paid_orders).toEqual([]);
  });

  it('aggregates paid plan and resource-pack revenue by period and source', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-03T10:00:00.000Z'));
    const today = new Date('2026-07-03T08:00:00.000Z');
    const yesterday = new Date('2026-07-02T08:00:00.000Z');
    const previousMonth = new Date('2026-06-30T08:00:00.000Z');

    orderRepo.find.mockResolvedValue([
      { orderNo: 'SO-TODAY', tenantId: 10, planCode: 'pro', amountCents: 9900, paymentMethod: 'alipay', status: 'paid', paidAt: today },
      { orderNo: 'SO-MONTH', tenantId: 11, planCode: 'team', amountCents: 19900, paymentMethod: 'alipay', status: 'paid', paidAt: yesterday },
      { orderNo: 'SO-OLD', tenantId: 10, planCode: 'pro', amountCents: 29900, paymentMethod: 'alipay', status: 'paid', paidAt: previousMonth },
      { orderNo: 'SO-NO-PAID-AT', tenantId: 12, planCode: 'legacy', amountCents: 1000, paymentMethod: 'manual', status: 'paid' },
    ]);
    resourcePackOrderRepo.find.mockResolvedValue([
      { orderNo: 'RPO-TODAY', tenantId: 10, resourcePackCode: 'tokens_1m', resourcePackName: 'Tokens 1M', amountCents: 4900, paymentMethod: 'alipay', status: 'paid', paidAt: today },
      { orderNo: 'RPO-OLD', tenantId: 13, resourcePackCode: 'ai_1k', resourcePackName: 'AI 1K', amountCents: 5900, paymentMethod: 'alipay', status: 'paid', paidAt: previousMonth },
    ]);
    subscriptionRepo.count.mockResolvedValue(3);

    const result = await service.getOverview();

    expect(orderRepo.find).toHaveBeenCalledWith({ where: { status: 'paid' } });
    expect(resourcePackOrderRepo.find).toHaveBeenCalledWith({ where: { status: 'paid' } });
    expect(subscriptionRepo.count).toHaveBeenCalledWith({ where: { status: 'active' } });
    expect(result.kpis).toMatchObject({
      today_revenue_cents: 14800,
      month_revenue_cents: 34700,
      total_revenue_cents: 71500,
      plan_revenue_cents: 60700,
      resource_pack_revenue_cents: 10800,
      today_paid_order_count: 2,
      month_paid_order_count: 3,
      total_paid_order_count: 6,
      month_paid_tenant_count: 2,
      total_paid_tenant_count: 4,
      active_subscription_count: 3,
      average_order_value_cents: 11916,
      month_average_order_value_cents: 11566,
    });
    expect(result.revenue_split).toEqual([
      { source: 'plan', revenue_cents: 60700, order_count: 4, percent: 84.9 },
      { source: 'resource_pack', revenue_cents: 10800, order_count: 2, percent: 15.1 },
    ]);
    expect(result.daily_trend.find((row) => row.date === '2026-07-03')).toMatchObject({
      plan_revenue_cents: 9900,
      resource_pack_revenue_cents: 4900,
      total_revenue_cents: 14800,
      paid_order_count: 2,
    });
  });

  it('returns deterministic top tenants and recent paid orders', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-03T10:00:00.000Z'));
    const newer = new Date('2026-07-03T09:00:00.000Z');
    const older = new Date('2026-07-02T09:00:00.000Z');

    orderRepo.find.mockResolvedValue([
      { orderNo: 'SO-2', tenantId: 20, planCode: 'pro', amountCents: 2000, paymentMethod: 'alipay', status: 'paid', paidAt: newer },
      { orderNo: 'SO-1', tenantId: 10, planCode: 'free', amountCents: 1000, paymentMethod: 'manual', status: 'paid', paidAt: older },
    ]);
    resourcePackOrderRepo.find.mockResolvedValue([
      { orderNo: 'RPO-1', tenantId: 10, resourcePackCode: 'tokens', resourcePackName: 'Tokens', amountCents: 3000, paymentMethod: 'alipay', status: 'paid', paidAt: newer },
    ]);
    subscriptionRepo.count.mockResolvedValue(0);

    const result = await service.getOverview();

    expect(result.top_tenants).toEqual([
      { tenant_id: 10, revenue_cents: 4000, order_count: 2, last_paid_at: newer },
      { tenant_id: 20, revenue_cents: 2000, order_count: 1, last_paid_at: newer },
    ]);
    expect(result.recent_paid_orders.map((order) => order.order_no)).toEqual(['RPO-1', 'SO-2', 'SO-1']);
    expect(result.recent_paid_orders[0]).toMatchObject({
      order_type: 'resource_pack',
      tenant_id: 10,
      label: 'Tokens',
      amount_cents: 3000,
      payment_method: 'alipay',
    });
  });
});
