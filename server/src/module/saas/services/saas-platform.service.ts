import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
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
    private readonly resourcePackService: SaasResourcePackService,
    private readonly resourcePackOrderService: SaasResourcePackOrderService,
  ) {}

  async listOrders(query: SaasPlatformListQuery = {}) {
    const { page, limit, skip } = this.resolvePagination(query);
    const where: FindOptionsWhere<SaasOrderEntity> = {};
    if (query.status) where.status = query.status;
    if (query.order_no) where.orderNo = query.order_no;
    if (query.plan_code) where.planCode = query.plan_code;
    const tenantId = this.resolveTenantId(query.tenant_id);
    if (tenantId !== undefined) where.tenantId = tenantId;

    const [list, total] = await this.orderRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip,
      take: limit,
    });

    return { list: list.map((order) => this.toOrderResponse(order)), total, page, limit };
  }

  async findOrder(orderNo: string) {
    const order = await this.orderRepo.findOne({ where: { orderNo } });
    return order ? this.toOrderResponse(order) : null;
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

  listResourcePacks(query: SaasResourcePackListQuery = {}) {
    return this.resourcePackService.listPlatformResourcePacks(query);
  }

  listResourcePackOrders(query: SaasResourcePackOrderListQuery = {}) {
    return this.resourcePackOrderService.listPlatformOrders(query);
  }

  findResourcePackOrder(orderNo: string) {
    return this.resourcePackOrderService.findPlatformOrder(orderNo);
  }

  private toOrderResponse(order: Partial<SaasOrderEntity>) {
    return {
      id: order.id,
      order_no: order.orderNo,
      tenant_id: order.tenantId,
      plan_id: order.planId,
      plan_code: order.planCode,
      billing_cycle: order.billingCycle,
      amount_cents: order.amountCents,
      currency: order.currency,
      payment_method: order.paymentMethod,
      status: order.status,
      alipay_trade_no: order.alipayTradeNo,
      paid_at: order.paidAt,
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