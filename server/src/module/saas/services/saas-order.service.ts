import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { SAAS_ORDER_PAID, SAAS_ORDER_PENDING, SAAS_PAYMENT_ALIPAY, SAAS_PLAN_FREE, SAAS_SUBSCRIPTION_ACTIVE, SAAS_SUBSCRIPTION_EXPIRED } from '../constants';
import { CreateUpgradeOrderDto } from '../dto/create-upgrade-order.dto';
import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasQuotaService } from './saas-quota.service';

export interface SaasOrderListQuery {
  page?: string | number;
  limit?: string | number;
  tenant_id?: string | number;
  order_no?: string;
  plan_code?: string;
  plan_id?: string | number;
  status?: string;
  close_reason?: string;
}

@Injectable()
export class SaasOrderService {
  constructor(
    @InjectRepository(SaasPlanEntity)
    private readonly saasPlanRepo: Repository<SaasPlanEntity>,
    @InjectRepository(SaasOrderEntity)
    private readonly saasOrderRepo: Repository<SaasOrderEntity>,
    private readonly dataSource: DataSource,
    private readonly saasQuotaService: SaasQuotaService,
  ) {}

  async createUpgradeOrder(tenantId: number, dto: CreateUpgradeOrderDto): Promise<SaasOrderEntity> {
    const plan = await this.saasPlanRepo.findOne({
      where: {
        code: dto.plan_code,
        status: 1,
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan ${dto.plan_code} is not configured`);
    }
    if (plan.code === SAAS_PLAN_FREE) {
      throw new BadRequestException('Free plan cannot be purchased as an upgrade order');
    }

    const billingCycle = dto.billing_cycle ?? plan.billingCycle ?? 'monthly';
    const amountCents = this.resolveAmountCents(plan, billingCycle);
    const order = this.saasOrderRepo.create({
      orderNo: this.generateOrderNo(),
      tenantId,
      planId: plan.id,
      planCode: plan.code,
      billingCycle,
      amountCents,
      currency: 'CNY',
      paymentMethod: dto.payment_method || SAAS_PAYMENT_ALIPAY,
      status: SAAS_ORDER_PENDING,
      remark: `Upgrade to ${plan.code}`,
    });

    return this.saasOrderRepo.save(order);
  }

  async confirmDevPayment(tenantId: number, orderNo: string): Promise<SaasOrderEntity> {
    return this.confirmPaidOrder({
      where: {
        tenantId,
        orderNo,
      },
      resolveTradeNo: (order) => `DEV-${order.orderNo}`,
    });
  }

  async confirmAlipayPayment(orderNo: string, alipayTradeNo: string): Promise<SaasOrderEntity> {
    return this.confirmPaidOrder({
      where: {
        orderNo,
      },
      resolveTradeNo: () => alipayTradeNo,
    });
  }

  async findTenantOrder(tenantId: number, orderNo: string): Promise<SaasOrderEntity | null> {
    return this.saasOrderRepo.findOne({
      where: {
        tenantId,
        orderNo,
      },
    });
  }

  async listTenantOrders(tenantId: number, query: SaasOrderListQuery = {}) {
    const { page, limit, skip } = this.resolvePagination(query);
    const where: FindOptionsWhere<SaasOrderEntity> = { tenantId };
    this.applyOrderFilters(where, query, { allowTenantId: false });

    const [list, total] = await this.saasOrderRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip,
      take: limit,
    });

    return { list: list.map((order) => this.toResponse(order)), total, page, limit };
  }

  async listPlatformOrders(query: SaasOrderListQuery = {}) {
    const { page, limit, skip } = this.resolvePagination(query);
    const where: FindOptionsWhere<SaasOrderEntity> = {};
    this.applyOrderFilters(where, query, { allowTenantId: true });

    const [list, total] = await this.saasOrderRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip,
      take: limit,
    });

    return { list: list.map((order) => this.toResponse(order)), total, page, limit };
  }

  async findPlatformOrder(orderNo: string) {
    const order = await this.saasOrderRepo.findOne({ where: { orderNo } });
    return order ? this.toResponse(order) : null;
  }

  toResponse(order: Partial<SaasOrderEntity>) {
    return {
      id: order.id,
      order_no: order.orderNo,
      tenant_id: order.tenantId,
      plan_id: order.planId,
      plan_code: order.planCode,
      billing_cycle: order.billingCycle,
      amount_cents: Number(order.amountCents) || 0,
      currency: order.currency,
      payment_method: order.paymentMethod,
      status: order.status,
      alipay_trade_no: order.alipayTradeNo,
      paid_at: order.paidAt,
      closed_at: order.closedAt ?? null,
      close_reason: order.closeReason ?? null,
      create_time: order.createTime,
    };
  }

  private async confirmPaidOrder(options: {
    where: Record<string, string | number>;
    resolveTradeNo: (order: SaasOrderEntity) => string;
  }): Promise<SaasOrderEntity> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(SaasOrderEntity);
      const subscriptionRepo = manager.getRepository(SaasSubscriptionEntity);
      const order = await orderRepo.findOne({
        where: options.where,
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.status === SAAS_ORDER_PAID) {
        return order;
      }
      if (order.status !== SAAS_ORDER_PENDING) {
        throw new BadRequestException('Only pending orders can be paid');
      }

      const paidAt = new Date();
      order.status = SAAS_ORDER_PAID;
      order.paidAt = paidAt;
      order.alipayTradeNo = options.resolveTradeNo(order);

      await subscriptionRepo.update(
        {
          tenantId: order.tenantId,
          status: SAAS_SUBSCRIPTION_ACTIVE,
        },
        {
          status: SAAS_SUBSCRIPTION_EXPIRED,
          endTime: paidAt,
        },
      );
      await subscriptionRepo.save({
        tenantId: order.tenantId,
        planId: order.planId,
        billingCycle: order.billingCycle,
        status: SAAS_SUBSCRIPTION_ACTIVE,
        startTime: paidAt,
        endTime: this.calculateEndTime(paidAt, order.billingCycle),
        cancelAtPeriodEnd: 0,
        remark: `Activated by order ${order.orderNo}`,
      });
      await this.saasQuotaService.initializeTenantQuota(order.tenantId, order.planId, manager);

      return orderRepo.save(order);
    });
  }

  private resolveAmountCents(plan: SaasPlanEntity, billingCycle: string): number {
    return Number(billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly) || 0;
  }

  private generateOrderNo(): string {
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
      String(now.getMilliseconds()).padStart(3, '0'),
    ].join('');
    const suffix = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    return `SO${timestamp}${suffix}`;
  }

  private calculateEndTime(startTime: Date, billingCycle: string): Date {
    const endTime = new Date(startTime);
    if (billingCycle === 'yearly') {
      endTime.setFullYear(endTime.getFullYear() + 1);
      return endTime;
    }
    endTime.setMonth(endTime.getMonth() + 1);
    return endTime;
  }

  private applyOrderFilters(
    where: FindOptionsWhere<SaasOrderEntity>,
    query: SaasOrderListQuery,
    options: { allowTenantId: boolean },
  ) {
    if (options.allowTenantId) {
      const tenantId = this.resolvePositiveNumber(query.tenant_id);
      if (tenantId !== undefined) {
        where.tenantId = tenantId;
      }
    }
    if (query.order_no) {
      where.orderNo = query.order_no;
    }
    const planId = this.resolvePositiveNumber(query.plan_id);
    if (planId !== undefined) {
      where.planId = planId;
    }
    if (query.plan_code) {
      where.planCode = query.plan_code;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.close_reason) {
      where.closeReason = query.close_reason;
    }
  }

  private resolvePagination(query: SaasOrderListQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return { page, limit, skip: (page - 1) * limit };
  }

  private resolvePositiveNumber(value: string | number | undefined): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  }
}
