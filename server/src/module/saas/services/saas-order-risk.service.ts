import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { Task } from '../../../common/decorators/task.decorator';
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
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

export interface PaymentReconciliationOverview {
  checked_at: Date;
  stale_minutes: number;
  stale_plan_payment_count: number;
  stale_resource_pack_payment_count: number;
  stale_plan_payment_amount_cents: number;
  stale_resource_pack_payment_amount_cents: number;
  recent_plan_orders: PaymentExceptionRecord[];
  recent_resource_pack_orders: PaymentExceptionRecord[];
}

export interface PaymentExceptionRecord {
  order_no?: string;
  tenant_id?: number;
  amount_cents: number;
  payment_requested_at?: Date | null;
  create_time?: Date | null;
  exception_type: 'payment_requested_stale';
}

@Injectable()
export class SaasOrderRiskService {
  constructor(
    @InjectRepository(SaasOrderEntity)
    private readonly planOrderRepo: Repository<SaasOrderEntity>,
    @InjectRepository(SaasResourcePackOrderEntity)
    private readonly resourcePackOrderRepo: Repository<SaasResourcePackOrderEntity>,
    private readonly systemModuleAccessService: SystemModuleAccessService,
  ) {}

  async closeExpiredPendingOrders(
    now = new Date(),
    timeoutMinutes = SAAS_ORDER_PENDING_TIMEOUT_MINUTES,
  ): Promise<CloseExpiredPendingOrdersResult> {
    const cutoff = this.subtractMinutes(now, timeoutMinutes);
    const [planOrders, resourcePackOrders] = await Promise.all([
      this.planOrderRepo.find({
        where: { status: SAAS_ORDER_PENDING, createTime: LessThanOrEqual(cutoff), paymentRequestedAt: IsNull() },
        select: { orderNo: true },
      }),
      this.resourcePackOrderRepo.find({
        where: { status: SAAS_ORDER_PENDING, createTime: LessThanOrEqual(cutoff), paymentRequestedAt: IsNull() },
        select: { orderNo: true },
      }),
    ]);
    const planOrderNos = planOrders.map((order) => order.orderNo).filter(Boolean);
    const resourcePackOrderNos = resourcePackOrders.map((order) => order.orderNo).filter(Boolean);
    let closedPlanOrderCount = 0;
    let closedResourcePackOrderCount = 0;

    if (planOrderNos.length > 0) {
      const updateResult = await this.planOrderRepo.update(
        { orderNo: In(planOrderNos), status: SAAS_ORDER_PENDING, paymentRequestedAt: IsNull() },
        { status: SAAS_ORDER_CLOSED, closedAt: now, closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT },
      );
      closedPlanOrderCount = updateResult.affected ?? 0;
    }
    if (resourcePackOrderNos.length > 0) {
      const updateResult = await this.resourcePackOrderRepo.update(
        { orderNo: In(resourcePackOrderNos), status: SAAS_ORDER_PENDING, paymentRequestedAt: IsNull() },
        { status: SAAS_ORDER_CLOSED, closedAt: now, closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT },
      );
      closedResourcePackOrderCount = updateResult.affected ?? 0;
    }

    return {
      checked_at: now,
      timeout_minutes: timeoutMinutes,
      closed_plan_order_count: closedPlanOrderCount,
      closed_resource_pack_order_count: closedResourcePackOrderCount,
      closed_plan_order_nos: planOrderNos,
      closed_resource_pack_order_nos: resourcePackOrderNos,
    };
  }

  async closeTenantPlanOrder(tenantId: number, orderNo: string, now = new Date()): Promise<SaasOrderEntity> {
    const updateResult = await this.planOrderRepo.update(
      { tenantId, orderNo, status: SAAS_ORDER_PENDING, paymentRequestedAt: IsNull() },
      { status: SAAS_ORDER_CLOSED, closedAt: now, closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED },
    );
    const order = await this.planOrderRepo.findOne({ where: { tenantId, orderNo } });
    if (!order) throw new NotFoundException('Order not found');
    if ((updateResult.affected ?? 0) > 0) return order;
    if (order.status === SAAS_ORDER_CLOSED) return order;
    if (order.status === SAAS_ORDER_PAID) throw new BadRequestException('Paid orders cannot be cancelled');
    if (order.status === SAAS_ORDER_PENDING && order.paymentRequestedAt) {
      throw new BadRequestException('Payment has already been requested for this order');
    }
    throw new BadRequestException('Only pending orders can be cancelled');
  }

  async closeTenantResourcePackOrder(
    tenantId: number,
    orderNo: string,
    now = new Date(),
  ): Promise<SaasResourcePackOrderEntity> {
    await this.assertTenantResourcePackAccess(tenantId);

    const updateResult = await this.resourcePackOrderRepo.update(
      { tenantId, orderNo, status: SAAS_ORDER_PENDING, paymentRequestedAt: IsNull() },
      { status: SAAS_ORDER_CLOSED, closedAt: now, closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED },
    );
    const order = await this.resourcePackOrderRepo.findOne({ where: { tenantId, orderNo } });
    if (!order) throw new NotFoundException('Resource pack order not found');
    if ((updateResult.affected ?? 0) > 0) return order;
    if (order.status === SAAS_ORDER_CLOSED) return order;
    if (order.status === SAAS_ORDER_PAID) throw new BadRequestException('Paid orders cannot be cancelled');
    if (order.status === SAAS_ORDER_PENDING && order.paymentRequestedAt) {
      throw new BadRequestException('Payment has already been requested for this order');
    }
    throw new BadRequestException('Only pending orders can be cancelled');
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

  async getPaymentReconciliationOverview(now = new Date(), staleMinutes = 120): Promise<PaymentReconciliationOverview> {
    const cutoff = this.subtractMinutes(now, staleMinutes);
    const stalePaymentWhere = {
      status: SAAS_ORDER_PENDING,
      paymentRequestedAt: LessThanOrEqual(cutoff),
    };
    const [planOrderAmounts, resourcePackOrderAmounts, planOrders, resourcePackOrders] = await Promise.all([
      this.planOrderRepo.find({
        where: stalePaymentWhere,
        select: { amountCents: true },
      }),
      this.resourcePackOrderRepo.find({
        where: stalePaymentWhere,
        select: { amountCents: true },
      }),
      this.planOrderRepo.find({
        where: stalePaymentWhere,
        order: { paymentRequestedAt: 'ASC', id: 'DESC' },
        take: 20,
      }),
      this.resourcePackOrderRepo.find({
        where: stalePaymentWhere,
        order: { paymentRequestedAt: 'ASC', id: 'DESC' },
        take: 20,
      }),
    ]);

    return {
      checked_at: now,
      stale_minutes: staleMinutes,
      stale_plan_payment_count: planOrderAmounts.length,
      stale_resource_pack_payment_count: resourcePackOrderAmounts.length,
      stale_plan_payment_amount_cents: this.sumAmount(planOrderAmounts),
      stale_resource_pack_payment_amount_cents: this.sumAmount(resourcePackOrderAmounts),
      recent_plan_orders: planOrders.map((order) => this.toPaymentExceptionRecord(order)),
      recent_resource_pack_orders: resourcePackOrders.map((order) => this.toPaymentExceptionRecord(order)),
    };
  }

  decoratePlanOrder(order: Partial<SaasOrderEntity>) {
    return {
      closed_at: order.closedAt ?? null,
      close_reason: order.closeReason ?? null,
      payment_requested_at: order.paymentRequestedAt ?? null,
    };
  }

  decorateResourcePackOrder(order: Partial<SaasResourcePackOrderEntity>) {
    return {
      closed_at: order.closedAt ?? null,
      close_reason: order.closeReason ?? null,
      payment_requested_at: order.paymentRequestedAt ?? null,
    };
  }

  @Task({
    name: 'saas.orderRisk.closeExpiredPendingOrders',
    description: 'Close stale pending SaaS orders',
  })
  closeExpiredPendingOrdersTask() {
    return this.closeExpiredPendingOrders();
  }

  @Task({
    name: 'saas.orderRisk.paymentReconciliationOverview',
    description: 'Scan stale SaaS payment requests',
  })
  paymentReconciliationOverviewTask() {
    return this.getPaymentReconciliationOverview();
  }

  private async assertTenantResourcePackAccess(tenantId: number): Promise<void> {
    await this.systemModuleAccessService.assertModuleAccess({
      tenantId,
      moduleCode: 'tenant_saas',
      requiredSaasModuleCode: 'resource_pack',
    });
  }

  private sumAmount(orders: Array<Partial<SaasOrderEntity> | Partial<SaasResourcePackOrderEntity>>): number {
    return orders.reduce((sum, order) => sum + (Number(order.amountCents) || 0), 0);
  }

  private toPaymentExceptionRecord(order: Partial<SaasOrderEntity | SaasResourcePackOrderEntity>): PaymentExceptionRecord {
    return {
      order_no: order.orderNo,
      tenant_id: order.tenantId,
      amount_cents: Number(order.amountCents) || 0,
      payment_requested_at: order.paymentRequestedAt ?? null,
      create_time: order.createTime ?? null,
      exception_type: 'payment_requested_stale',
    };
  }

  private subtractMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() - minutes * 60_000);
  }

  private subtractDays(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 86_400_000);
  }
}
