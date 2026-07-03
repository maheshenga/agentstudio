import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { Task } from '../../../common/decorators/task.decorator';
import {
  SAAS_ORDER_CLOSED,
  SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
  SAAS_ORDER_CLOSE_REASON_TIMEOUT,
  SAAS_ORDER_PAID,
  SAAS_ORDER_PENDING,
  SAAS_ORDER_PENDING_TIMEOUT_MINUTES,
} from '../constants';
import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';

export interface CloseExpiredPendingOrdersResult {
  checked_at: Date;
  timeout_minutes: number;
  closed_plan_order_count: number;
  closed_resource_pack_order_count: number;
  closed_plan_order_nos: string[];
  closed_resource_pack_order_nos: string[];
}

export interface OrderRiskOverview {
  pending_plan_orders: number;
  pending_resource_pack_orders: number;
  timeout_closed_plan_orders_7d: number;
  timeout_closed_resource_pack_orders_7d: number;
  tenant_cancelled_plan_orders_7d: number;
  tenant_cancelled_resource_pack_orders_7d: number;
}

@Injectable()
export class SaasOrderRiskService {
  constructor(
    @InjectRepository(SaasOrderEntity)
    private readonly planOrderRepo: Repository<SaasOrderEntity>,
    @InjectRepository(SaasResourcePackOrderEntity)
    private readonly resourcePackOrderRepo: Repository<SaasResourcePackOrderEntity>,
  ) {}

  async closeExpiredPendingOrders(
    now = new Date(),
    timeoutMinutes = SAAS_ORDER_PENDING_TIMEOUT_MINUTES,
  ): Promise<CloseExpiredPendingOrdersResult> {
    const cutoff = this.subtractMinutes(now, timeoutMinutes);
    const [planOrders, resourcePackOrders] = await Promise.all([
      this.planOrderRepo.find({
        where: { status: SAAS_ORDER_PENDING, createTime: LessThanOrEqual(cutoff) },
        select: ['orderNo'] as any,
      }),
      this.resourcePackOrderRepo.find({
        where: { status: SAAS_ORDER_PENDING, createTime: LessThanOrEqual(cutoff) },
        select: ['orderNo'] as any,
      }),
    ]);
    const planOrderNos = planOrders.map((order) => order.orderNo).filter(Boolean);
    const resourcePackOrderNos = resourcePackOrders.map((order) => order.orderNo).filter(Boolean);

    if (planOrderNos.length > 0) {
      await this.planOrderRepo.update(
        { orderNo: In(planOrderNos), status: SAAS_ORDER_PENDING },
        { status: SAAS_ORDER_CLOSED, closedAt: now, closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT },
      );
    }
    if (resourcePackOrderNos.length > 0) {
      await this.resourcePackOrderRepo.update(
        { orderNo: In(resourcePackOrderNos), status: SAAS_ORDER_PENDING },
        { status: SAAS_ORDER_CLOSED, closedAt: now, closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT },
      );
    }

    return {
      checked_at: now,
      timeout_minutes: timeoutMinutes,
      closed_plan_order_count: planOrderNos.length,
      closed_resource_pack_order_count: resourcePackOrderNos.length,
      closed_plan_order_nos: planOrderNos,
      closed_resource_pack_order_nos: resourcePackOrderNos,
    };
  }

  async closeTenantPlanOrder(tenantId: number, orderNo: string, now = new Date()): Promise<SaasOrderEntity> {
    const order = await this.planOrderRepo.findOne({ where: { tenantId, orderNo } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === SAAS_ORDER_CLOSED) return order;
    if (order.status === SAAS_ORDER_PAID) throw new BadRequestException('Paid orders cannot be cancelled');

    order.status = SAAS_ORDER_CLOSED;
    order.closedAt = now;
    order.closeReason = SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED;
    return this.planOrderRepo.save(order);
  }

  async closeTenantResourcePackOrder(
    tenantId: number,
    orderNo: string,
    now = new Date(),
  ): Promise<SaasResourcePackOrderEntity> {
    const order = await this.resourcePackOrderRepo.findOne({ where: { tenantId, orderNo } });
    if (!order) throw new NotFoundException('Resource pack order not found');
    if (order.status === SAAS_ORDER_CLOSED) return order;
    if (order.status === SAAS_ORDER_PAID) throw new BadRequestException('Paid orders cannot be cancelled');

    order.status = SAAS_ORDER_CLOSED;
    order.closedAt = now;
    order.closeReason = SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED;
    return this.resourcePackOrderRepo.save(order);
  }

  async getOrderRiskOverview(now = new Date()): Promise<OrderRiskOverview> {
    const since = this.subtractDays(now, 7);
    const [pendingPlan, pendingResourcePack, timeoutPlan, timeoutResourcePack, cancelledPlan, cancelledResourcePack] =
      await Promise.all([
        this.planOrderRepo.count({ where: { status: SAAS_ORDER_PENDING } }),
        this.resourcePackOrderRepo.count({ where: { status: SAAS_ORDER_PENDING } }),
        this.planOrderRepo.count({
          where: {
            status: SAAS_ORDER_CLOSED,
            closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT,
            closedAt: MoreThanOrEqual(since),
          },
        }),
        this.resourcePackOrderRepo.count({
          where: {
            status: SAAS_ORDER_CLOSED,
            closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT,
            closedAt: MoreThanOrEqual(since),
          },
        }),
        this.planOrderRepo.count({
          where: {
            status: SAAS_ORDER_CLOSED,
            closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
            closedAt: MoreThanOrEqual(since),
          },
        }),
        this.resourcePackOrderRepo.count({
          where: {
            status: SAAS_ORDER_CLOSED,
            closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
            closedAt: MoreThanOrEqual(since),
          },
        }),
      ]);

    return {
      pending_plan_orders: pendingPlan,
      pending_resource_pack_orders: pendingResourcePack,
      timeout_closed_plan_orders_7d: timeoutPlan,
      timeout_closed_resource_pack_orders_7d: timeoutResourcePack,
      tenant_cancelled_plan_orders_7d: cancelledPlan,
      tenant_cancelled_resource_pack_orders_7d: cancelledResourcePack,
    };
  }

  decoratePlanOrder(order: Partial<SaasOrderEntity>) {
    return {
      closed_at: order.closedAt ?? null,
      close_reason: order.closeReason ?? null,
    };
  }

  decorateResourcePackOrder(order: Partial<SaasResourcePackOrderEntity>) {
    return {
      closed_at: order.closedAt ?? null,
      close_reason: order.closeReason ?? null,
    };
  }

  @Task({
    name: 'saas.orderRisk.closeExpiredPendingOrders',
    description: 'Close stale pending SaaS orders',
  })
  closeExpiredPendingOrdersTask() {
    return this.closeExpiredPendingOrders();
  }

  private subtractMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() - minutes * 60_000);
  }

  private subtractDays(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 86_400_000);
  }
}
