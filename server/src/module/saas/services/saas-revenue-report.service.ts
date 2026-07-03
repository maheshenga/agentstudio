import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';

export type SaasRevenueSource = 'plan' | 'resource_pack';
export type SaasRevenueOrderType = SaasRevenueSource;

export interface SaasRevenueOverview {
  kpis: {
    today_revenue_cents: number;
    month_revenue_cents: number;
    total_revenue_cents: number;
    plan_revenue_cents: number;
    resource_pack_revenue_cents: number;
    today_paid_order_count: number;
    month_paid_order_count: number;
    total_paid_order_count: number;
    month_paid_tenant_count: number;
    total_paid_tenant_count: number;
    active_subscription_count: number;
    average_order_value_cents: number;
    month_average_order_value_cents: number;
  };
  revenue_split: Array<{ source: SaasRevenueSource; revenue_cents: number; order_count: number; percent: number }>;
  daily_trend: Array<{ date: string; plan_revenue_cents: number; resource_pack_revenue_cents: number; total_revenue_cents: number; paid_order_count: number }>;
  top_tenants: Array<{ tenant_id: number; tenant_name?: string; revenue_cents: number; order_count: number; last_paid_at?: Date }>;
  recent_paid_orders: Array<{ order_no: string; order_type: SaasRevenueOrderType; tenant_id: number; label: string; amount_cents: number; payment_method: string; paid_at?: Date }>;
}

type NormalizedPaidOrder = {
  orderNo: string;
  orderType: SaasRevenueOrderType;
  tenantId: number;
  label: string;
  amountCents: number;
  paymentMethod: string;
  paidAt?: Date;
};

@Injectable()
export class SaasRevenueReportService {
  constructor(
    @InjectRepository(SaasOrderEntity)
    private readonly orderRepo: Repository<SaasOrderEntity>,
    @InjectRepository(SaasResourcePackOrderEntity)
    private readonly resourcePackOrderRepo: Repository<SaasResourcePackOrderEntity>,
    @InjectRepository(SaasSubscriptionEntity)
    private readonly subscriptionRepo: Repository<SaasSubscriptionEntity>,
  ) {}

  async getOverview(): Promise<SaasRevenueOverview> {
    const [planOrders, resourcePackOrders, activeSubscriptionCount] = await Promise.all([
      this.orderRepo.find({ where: { status: 'paid' } }),
      this.resourcePackOrderRepo.find({ where: { status: 'paid' } }),
      this.subscriptionRepo.count({ where: { status: 'active' } }),
    ]);

    const paidOrders = this.normalizeOrders(planOrders, resourcePackOrders);
    return this.buildOverview(paidOrders, activeSubscriptionCount, new Date());
  }

  private normalizeOrders(planOrders: SaasOrderEntity[], resourcePackOrders: SaasResourcePackOrderEntity[]): NormalizedPaidOrder[] {
    return [
      ...planOrders.map((order) => ({
        orderNo: order.orderNo,
        orderType: 'plan' as const,
        tenantId: Number(order.tenantId) || 0,
        label: order.planCode || 'unknown',
        amountCents: Number(order.amountCents) || 0,
        paymentMethod: order.paymentMethod || '',
        paidAt: order.paidAt || undefined,
      })),
      ...resourcePackOrders.map((order) => ({
        orderNo: order.orderNo,
        orderType: 'resource_pack' as const,
        tenantId: Number(order.tenantId) || 0,
        label: order.resourcePackName || order.resourcePackCode || 'unknown',
        amountCents: Number(order.amountCents) || 0,
        paymentMethod: order.paymentMethod || '',
        paidAt: order.paidAt || undefined,
      })),
    ];
  }

  private buildOverview(paidOrders: NormalizedPaidOrder[], activeSubscriptionCount: number, now: Date): SaasRevenueOverview {
    const todayStart = this.startOfDay(now);
    const todayEnd = this.endOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const datedOrders = paidOrders.filter((order) => order.paidAt);
    const todayOrders = datedOrders.filter((order) => this.isBetween(order.paidAt!, todayStart, todayEnd));
    const monthOrders = datedOrders.filter((order) => this.isBetween(order.paidAt!, monthStart, monthEnd));
    const planOrders = paidOrders.filter((order) => order.orderType === 'plan');
    const resourcePackOrders = paidOrders.filter((order) => order.orderType === 'resource_pack');
    const totalRevenue = this.sumAmount(paidOrders);
    const planRevenue = this.sumAmount(planOrders);
    const resourcePackRevenue = this.sumAmount(resourcePackOrders);
    const monthRevenue = this.sumAmount(monthOrders);

    return {
      kpis: {
        today_revenue_cents: this.sumAmount(todayOrders),
        month_revenue_cents: monthRevenue,
        total_revenue_cents: totalRevenue,
        plan_revenue_cents: planRevenue,
        resource_pack_revenue_cents: resourcePackRevenue,
        today_paid_order_count: todayOrders.length,
        month_paid_order_count: monthOrders.length,
        total_paid_order_count: paidOrders.length,
        month_paid_tenant_count: new Set(monthOrders.map((order) => order.tenantId)).size,
        total_paid_tenant_count: new Set(paidOrders.map((order) => order.tenantId)).size,
        active_subscription_count: activeSubscriptionCount,
        average_order_value_cents: paidOrders.length ? Math.floor(totalRevenue / paidOrders.length) : 0,
        month_average_order_value_cents: monthOrders.length ? Math.floor(monthRevenue / monthOrders.length) : 0,
      },
      revenue_split: [
        { source: 'plan', revenue_cents: planRevenue, order_count: planOrders.length, percent: this.percent(planRevenue, totalRevenue) },
        {
          source: 'resource_pack',
          revenue_cents: resourcePackRevenue,
          order_count: resourcePackOrders.length,
          percent: this.percent(resourcePackRevenue, totalRevenue),
        },
      ],
      daily_trend: this.buildDailyTrend(now, datedOrders),
      top_tenants: this.buildTopTenants(paidOrders),
      recent_paid_orders: this.buildRecentPaidOrders(paidOrders),
    };
  }

  private startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  private isBetween(value: Date, start: Date, end: Date): boolean {
    const time = value.getTime();
    return time >= start.getTime() && time <= end.getTime();
  }

  private sumAmount(orders: NormalizedPaidOrder[]): number {
    return orders.reduce((sum, order) => sum + order.amountCents, 0);
  }

  private percent(value: number, total: number): number {
    if (!total) return 0;
    return Math.round((value / total) * 10000) / 100;
  }

  private buildDailyTrend(now: Date, datedOrders: NormalizedPaidOrder[]): SaasRevenueOverview['daily_trend'] {
    const trend = this.createEmptyDailyTrend(now);
    const byDate = new Map(trend.map((row) => [row.date, row]));

    for (const order of datedOrders) {
      const row = byDate.get(this.formatDateKey(order.paidAt!));
      if (!row) continue;

      if (order.orderType === 'plan') row.plan_revenue_cents += order.amountCents;
      if (order.orderType === 'resource_pack') row.resource_pack_revenue_cents += order.amountCents;
      row.total_revenue_cents += order.amountCents;
      row.paid_order_count += 1;
    }

    return trend;
  }

  private buildTopTenants(paidOrders: NormalizedPaidOrder[]): SaasRevenueOverview['top_tenants'] {
    const tenantMap = new Map<number, { tenant_id: number; revenue_cents: number; order_count: number; last_paid_at?: Date }>();

    for (const order of paidOrders) {
      const current = tenantMap.get(order.tenantId) || { tenant_id: order.tenantId, revenue_cents: 0, order_count: 0 };
      current.revenue_cents += order.amountCents;
      current.order_count += 1;
      if (order.paidAt && (!current.last_paid_at || order.paidAt.getTime() > current.last_paid_at.getTime())) {
        current.last_paid_at = order.paidAt;
      }
      tenantMap.set(order.tenantId, current);
    }

    return [...tenantMap.values()]
      .sort((a, b) => b.revenue_cents - a.revenue_cents || b.order_count - a.order_count || a.tenant_id - b.tenant_id)
      .slice(0, 10);
  }

  private buildRecentPaidOrders(paidOrders: NormalizedPaidOrder[]): SaasRevenueOverview['recent_paid_orders'] {
    return [...paidOrders]
      .sort((a, b) => {
        const timeDiff = (b.paidAt?.getTime() || 0) - (a.paidAt?.getTime() || 0);
        if (timeDiff) return timeDiff;
        return b.orderNo.localeCompare(a.orderNo);
      })
      .slice(0, 10)
      .map((order) => ({
        order_no: order.orderNo,
        order_type: order.orderType,
        tenant_id: order.tenantId,
        label: order.label,
        amount_cents: order.amountCents,
        payment_method: order.paymentMethod,
        paid_at: order.paidAt,
      }));
  }

  private createEmptyDailyTrend(now: Date): SaasRevenueOverview['daily_trend'] {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29);

    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        date: this.formatDateKey(date),
        plan_revenue_cents: 0,
        resource_pack_revenue_cents: 0,
        total_revenue_cents: 0,
        paid_order_count: 0,
      };
    });
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
