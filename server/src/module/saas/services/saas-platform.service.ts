import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasTenantResourceEntity } from '../entities/saas-tenant-resource.entity';
import { SaasSubscriptionLifecycleService } from './saas-subscription-lifecycle.service';
import { SaasOrderRiskService } from './saas-order-risk.service';
import { SaasOrderService } from './saas-order.service';
import type { SaasOrderListQuery } from './saas-order.service';
import { SaasResourcePackOrderService } from './saas-resource-pack-order.service';
import type { SaasResourcePackOrderListQuery } from './saas-resource-pack-order.service';
import { SaasResourcePackService } from './saas-resource-pack.service';
import type { SaasResourcePackListQuery } from './saas-resource-pack.service';

export interface SaasPlatformListQuery {
  page?: string | number;
  limit?: string | number;
  status?: string;
  tenant_id?: string | number;
  order_no?: string;
  plan_code?: string;
  plan_id?: string | number;
  close_reason?: string;
  lifecycle_status?: string;
  expires_within_days?: string | number;
  expired_since_days?: string | number;
}

export interface SaasPlatformPlanOrderOverviewRecord {
  id?: number;
  order_no?: string;
  tenant_id?: number;
  plan_id?: number;
  plan_code?: string;
  billing_cycle?: string;
  amount_cents?: number;
  currency?: string;
  payment_method?: string;
  status?: string;
  alipay_trade_no?: string;
  paid_at?: Date;
  closed_at?: Date;
  close_reason?: string;
  create_time?: Date;
}

export interface SaasPlatformResourcePackOrderOverviewRecord {
  order_no?: string;
  tenant_id?: number;
  resource_pack_code?: string;
  resource_pack_name?: string;
  resource_type?: string;
  quota_amount?: number;
  amount_cents?: number;
  currency?: string;
  payment_method?: string;
  status?: string;
  alipay_trade_no?: string;
  paid_at?: Date;
  delivered_at?: Date;
  closed_at?: Date;
  close_reason?: string;
  create_time?: Date;
}

export interface SaasPlatformUsageOverview {
  kpis: {
    active_subscriptions: number;
    trialing_subscriptions: number;
    expired_subscriptions: number;
    pending_plan_orders: number;
    pending_resource_pack_orders: number;
    paid_plan_order_amount_cents: number;
    paid_resource_pack_order_amount_cents: number;
    total_paid_amount_cents: number;
  };
  quota_summary: Array<{
    resource_type: string;
    total_quota: number;
    used_quota: number;
    remaining_quota: number;
    usage_rate: number;
  }>;
  plan_distribution: Array<{
    plan_id: number;
    plan_code: string;
    plan_name: string;
    active_count: number;
  }>;
  recent_plan_orders: SaasPlatformPlanOrderOverviewRecord[];
  recent_resource_pack_orders: SaasPlatformResourcePackOrderOverviewRecord[];
}
@Injectable()
export class SaasPlatformService {
  constructor(
    @InjectRepository(SaasOrderEntity)
    private readonly orderRepo: Repository<SaasOrderEntity>,
    @InjectRepository(SaasSubscriptionEntity)
    private readonly subscriptionRepo: Repository<SaasSubscriptionEntity>,
    @InjectRepository(SaasPlanEntity)
    private readonly planRepo: Repository<SaasPlanEntity>,
    @InjectRepository(SaasTenantResourceEntity)
    private readonly tenantResourceRepo: Repository<SaasTenantResourceEntity>,
    @InjectRepository(SaasResourcePackOrderEntity)
    private readonly resourcePackOrderRepo: Repository<SaasResourcePackOrderEntity>,
    private readonly resourcePackService: SaasResourcePackService,
    private readonly saasOrderService: SaasOrderService,
    private readonly resourcePackOrderService: SaasResourcePackOrderService,
    private readonly orderRiskService: SaasOrderRiskService,
    private readonly lifecycleService: SaasSubscriptionLifecycleService,
  ) {}

  async listOrders(query: SaasOrderListQuery = {}) {
    return this.saasOrderService.listPlatformOrders(query);
  }

  async findOrder(orderNo: string) {
    return this.saasOrderService.findPlatformOrder(orderNo);
  }

  async listSubscriptions(query: SaasPlatformListQuery = {}) {
    const { page, limit, skip } = this.resolvePagination(query);
    const where: FindOptionsWhere<SaasSubscriptionEntity> = {};
    if (query.status) where.status = query.status;
    const tenantId = this.resolveTenantId(query.tenant_id);
    if (tenantId !== undefined) where.tenantId = tenantId;
    const planId = this.resolveTenantId(query.plan_id);
    if (planId !== undefined) {
      where.planId = planId;
    } else if (query.plan_code) {
      const plan = await this.planRepo.findOne({ where: { code: query.plan_code } });
      if (!plan) return { list: [], total: 0, page, limit };
      where.planId = Number(plan.id);
    }
    if (!query.status) {
      if (query.lifecycle_status === 'active') {
        where.status = 'active';
      } else if (query.lifecycle_status === 'expiring') {
        Object.assign(where, this.lifecycleService.buildExpiringWhere(new Date(), (query.expires_within_days || 7) as any));
      } else if (query.lifecycle_status === 'expired') {
        Object.assign(where, this.lifecycleService.buildExpiredSinceWhere(new Date(), (query.expired_since_days || 365) as any));
      }
    }

    const [list, total] = await this.subscriptionRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip,
      take: limit,
    });

    return { list: list.map((subscription) => this.toSubscriptionResponse(subscription)), total, page, limit };
  }

  async findSubscription(id: string | number) {
    const subscriptionId = Number(id);
    if (!Number.isFinite(subscriptionId) || subscriptionId <= 0) return null;
    const subscription = await this.subscriptionRepo.findOne({ where: { id: subscriptionId } });
    return subscription ? this.toSubscriptionResponse(subscription) : null;
  }

  async getUsageOverview(): Promise<SaasPlatformUsageOverview> {
    const [[subscriptions], [orders], tenantResources, resourcePackOrders, recentPlanOrders, plans] = await Promise.all([
      this.subscriptionRepo.findAndCount({ order: { createTime: 'DESC', id: 'DESC' } }),
      this.orderRepo.findAndCount({ order: { createTime: 'DESC', id: 'DESC' } }),
      this.tenantResourceRepo.find({ order: { resourceType: 'ASC', id: 'ASC' } }),
      this.resourcePackOrderRepo.find({ order: { createTime: 'DESC', id: 'DESC' } }),
      this.orderRepo.find({ order: { createTime: 'DESC', id: 'DESC' }, take: 5 }),
      this.planRepo.find(),
    ]);

    const paidPlanAmount = this.sumAmount(orders.filter((order) => order.status === 'paid'));
    const paidResourcePackAmount = this.sumAmount(resourcePackOrders.filter((order) => order.status === 'paid'));

    return {
      kpis: {
        active_subscriptions: subscriptions.filter((item) => item.status === 'active').length,
        trialing_subscriptions: subscriptions.filter((item) => item.status === 'trialing').length,
        expired_subscriptions: subscriptions.filter((item) => item.status === 'expired').length,
        pending_plan_orders: orders.filter((item) => item.status === 'pending').length,
        pending_resource_pack_orders: resourcePackOrders.filter((item) => item.status === 'pending').length,
        paid_plan_order_amount_cents: paidPlanAmount,
        paid_resource_pack_order_amount_cents: paidResourcePackAmount,
        total_paid_amount_cents: paidPlanAmount + paidResourcePackAmount,
      },
      quota_summary: this.buildQuotaSummary(tenantResources),
      plan_distribution: this.buildPlanDistribution(subscriptions, plans),
      recent_plan_orders: recentPlanOrders.map((order) => this.saasOrderService.toResponse(order)),
      recent_resource_pack_orders: resourcePackOrders.slice(0, 5).map((order) => this.toResourcePackOrderResponse(order)),
    };
  }

  getSubscriptionLifecycleOverview() {
    return this.lifecycleService.getLifecycleOverview();
  }

  listResourcePacks(query: SaasResourcePackListQuery = {}) {
    return this.resourcePackService.listPlatformResourcePacks(query);
  }

  listResourcePackOrders(query: SaasResourcePackOrderListQuery = {}) {
    return this.resourcePackOrderService.listPlatformOrders(query);
  }

  findResourcePackOrder(orderNo: string) {
    return this.resourcePackOrderService.findPlatformOrder(orderNo);
  }

  getOrderRiskOverview() {
    return this.orderRiskService.getOrderRiskOverview();
  }

  private buildQuotaSummary(resources: Partial<SaasTenantResourceEntity>[]) {
    const groups = new Map<string, { resource_type: string; total_quota: number; used_quota: number }>();
    for (const resource of resources) {
      const resourceType = resource.resourceType || 'unknown';
      const current = groups.get(resourceType) || { resource_type: resourceType, total_quota: 0, used_quota: 0 };
      current.total_quota += Number(resource.totalQuota) || 0;
      current.used_quota += Number(resource.usedQuota) || 0;
      groups.set(resourceType, current);
    }

    return Array.from(groups.values()).map((item) => {
      const remaining = Math.max(item.total_quota - item.used_quota, 0);
      return {
        resource_type: item.resource_type,
        total_quota: item.total_quota,
        used_quota: item.used_quota,
        remaining_quota: remaining,
        usage_rate: item.total_quota > 0 ? Number(((item.used_quota / item.total_quota) * 100).toFixed(2)) : 0,
      };
    });
  }

  private buildPlanDistribution(subscriptions: Partial<SaasSubscriptionEntity>[], plans: Partial<SaasPlanEntity>[]) {
    const planMap = new Map(plans.map((plan) => [Number(plan.id), plan]));
    const groups = new Map<number, number>();
    for (const subscription of subscriptions) {
      if (subscription.status !== 'active') continue;
      const planId = Number(subscription.planId) || 0;
      groups.set(planId, (groups.get(planId) || 0) + 1);
    }

    return Array.from(groups.entries()).map(([planId, activeCount]) => {
      const plan = planMap.get(planId);
      return {
        plan_id: planId,
        plan_code: plan?.code || 'unknown',
        plan_name: plan?.name || 'unknown',
        active_count: activeCount,
      };
    });
  }

  private sumAmount(rows: Array<Partial<SaasOrderEntity> | Partial<SaasResourcePackOrderEntity>>) {
    return rows.reduce((sum, row) => sum + (Number(row.amountCents) || 0), 0);
  }

  private toResourcePackOrderResponse(order: Partial<SaasResourcePackOrderEntity>) {
    return {
      order_no: order.orderNo,
      tenant_id: order.tenantId,
      resource_pack_code: order.resourcePackCode,
      resource_pack_name: order.resourcePackName,
      resource_type: order.resourceType,
      quota_amount: order.quotaAmount,
      amount_cents: order.amountCents,
      currency: order.currency,
      payment_method: order.paymentMethod,
      status: order.status,
      alipay_trade_no: order.alipayTradeNo,
      paid_at: order.paidAt,
      delivered_at: order.deliveredAt,
      closed_at: order.closedAt ?? null,
      close_reason: order.closeReason ?? null,
      create_time: order.createTime,
    };
  }

  private toSubscriptionResponse(subscription: Partial<SaasSubscriptionEntity>) {
    return {
      id: subscription.id,
      tenant_id: subscription.tenantId,
      plan_id: subscription.planId,
      billing_cycle: subscription.billingCycle,
      status: subscription.status,
      start_time: subscription.startTime,
      end_time: subscription.endTime,
      cancel_at_period_end: subscription.cancelAtPeriodEnd,
      remark: subscription.remark,
      create_time: subscription.createTime,
      ...this.lifecycleService.decorateSubscription(subscription),
    };
  }

  private resolvePagination(query: SaasPlatformListQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));

    return { page, limit, skip: (page - 1) * limit };
  }

  private resolveTenantId(value: string | number | undefined): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const tenantId = Number(value);
    return Number.isFinite(tenantId) && tenantId > 0 ? tenantId : undefined;
  }
}
