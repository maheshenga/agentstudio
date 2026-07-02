import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ResultData } from '../../common/utils/result';
import { getTenantId } from '../../common/utils/tenant.util';
import { CreateResourcePackOrderDto } from './dto/create-resource-pack-order.dto';
import { CreateUpgradeOrderDto } from './dto/create-upgrade-order.dto';
import { SaasOrderEntity } from './entities/saas-order.entity';
import { SaasPlanEntity } from './entities/saas-plan.entity';
import { SaasSubscriptionEntity } from './entities/saas-subscription.entity';
import { SaasTrialEntity } from './entities/saas-trial.entity';
import { SaasOrderService } from './services/saas-order.service';
import { SaasQuotaService } from './services/saas-quota.service';
import { SaasResourcePackOrderService } from './services/saas-resource-pack-order.service';
import { SaasResourcePackService } from './services/saas-resource-pack.service';

@ApiTags('SaaS Tenant')
@ApiBearerAuth('Authorization')
@Controller('api/saas/tenant')
export class SaasTenantController {
  constructor(
    @InjectRepository(SaasSubscriptionEntity)
    private readonly saasSubscriptionRepo: Repository<SaasSubscriptionEntity>,
    @InjectRepository(SaasPlanEntity)
    private readonly saasPlanRepo: Repository<SaasPlanEntity>,
    @InjectRepository(SaasTrialEntity)
    private readonly saasTrialRepo: Repository<SaasTrialEntity>,
    private readonly saasQuotaService: SaasQuotaService,
    private readonly saasOrderService: SaasOrderService,
    private readonly saasResourcePackService: SaasResourcePackService,
    private readonly saasResourcePackOrderService: SaasResourcePackOrderService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get active SaaS plans for tenant upgrades' })
  async plans() {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    const plans = await this.saasPlanRepo.find({
      where: {
        status: 1,
      },
      order: {
        sort: 'ASC',
        id: 'ASC',
      },
    });

    return ResultData.ok(
      plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        billing_cycle: plan.billingCycle,
        price_monthly: Number(plan.priceMonthly) || 0,
        price_yearly: Number(plan.priceYearly) || 0,
      })),
    );
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get current tenant SaaS usage' })
  async usage() {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(await this.saasQuotaService.getTenantUsageSummary(tenantId));
  }

  @Get('resource-packs')
  @ApiOperation({ summary: 'Get active SaaS resource packs for current tenant' })
  async resourcePacks() {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(await this.saasResourcePackService.listTenantResourcePacks());
  }

  @Post('resource-pack-orders')
  @ApiOperation({ summary: 'Create a tenant SaaS resource pack order' })
  async createResourcePackOrder(@Body() body: CreateResourcePackOrderDto) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(
      this.saasResourcePackOrderService.toResponse(
        await this.saasResourcePackOrderService.createTenantOrder(tenantId, body),
      ),
    );
  }

  @Get('resource-pack-orders/:order_no')
  @ApiOperation({ summary: 'Get a tenant SaaS resource pack order' })
  async resourcePackOrder(@Param('order_no') orderNo: string) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    const order = await this.saasResourcePackOrderService.findTenantOrder(tenantId, orderNo);
    return ResultData.ok(order ? this.saasResourcePackOrderService.toResponse(order) : null);
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Get current tenant SaaS subscription' })
  async subscription() {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    const subscription = await this.saasSubscriptionRepo.findOne({
      where: {
        tenantId,
      },
      order: {
        id: 'DESC',
      },
    });

    if (!subscription) {
      return ResultData.ok(null);
    }

    const [plan, trial] = await Promise.all([
      this.saasPlanRepo.findOne({
        where: {
          id: subscription.planId,
        },
      }),
      this.saasTrialRepo.findOne({
        where: {
          tenantId,
          subscriptionId: subscription.id,
        },
        order: {
          id: 'DESC',
        },
      }),
    ]);

    return ResultData.ok({
      tenant_id: tenantId,
      plan_id: subscription.planId,
      current_plan: plan?.code ?? null,
      plan_name: plan?.name ?? null,
      subscription_status: subscription.status,
      billing_cycle: subscription.billingCycle,
      start_time: subscription.startTime,
      end_time: subscription.endTime ?? null,
      trial_status: trial?.status ?? null,
      trial_end_time: trial?.endTime ?? null,
      is_trial_active: Boolean(trial && trial.status === 'trialing' && (!trial.endTime || trial.endTime.getTime() >= Date.now())),
    });
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create a tenant SaaS upgrade order' })
  async createOrder(@Body() body: CreateUpgradeOrderDto) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(this.toOrderResponse(await this.saasOrderService.createUpgradeOrder(tenantId, body)));
  }

  @Get('orders/:order_no')
  @ApiOperation({ summary: 'Get a tenant SaaS order' })
  async order(@Param('order_no') orderNo: string) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    const order = await this.saasOrderService.findTenantOrder(tenantId, orderNo);
    return ResultData.ok(order ? this.toOrderResponse(order) : null);
  }

  private toOrderResponse(order: Partial<SaasOrderEntity>) {
    return {
      order_no: order.orderNo,
      plan_code: order.planCode,
      amount_cents: order.amountCents,
      status: order.status,
      payment_method: order.paymentMethod,
      alipay_trade_no: order.alipayTradeNo,
      paid_at: order.paidAt,
    };
  }
}
