import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { SAAS_ORDER_PAID, SAAS_ORDER_PENDING, SAAS_PAYMENT_ALIPAY, SAAS_PLAN_FREE, SAAS_SUBSCRIPTION_ACTIVE, SAAS_SUBSCRIPTION_EXPIRED } from '../constants';
import { CreateUpgradeOrderDto } from '../dto/create-upgrade-order.dto';
import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasQuotaService } from './saas-quota.service';

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
}
