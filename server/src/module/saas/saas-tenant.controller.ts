import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ResultData } from '../../common/utils/result';
import { getTenantId } from '../../common/utils/tenant.util';
import { CreateTenantMemberDto } from './dto/create-tenant-member.dto';
import { CreateResourcePackOrderDto } from './dto/create-resource-pack-order.dto';
import { CreateUpgradeOrderDto } from './dto/create-upgrade-order.dto';
import { SaasPlanEntity } from './entities/saas-plan.entity';
import { SaasSubscriptionEntity } from './entities/saas-subscription.entity';
import { SaasTrialEntity } from './entities/saas-trial.entity';
import { SaasOrderRiskService } from './services/saas-order-risk.service';
import { SaasOrderService } from './services/saas-order.service';
import { SaasModuleService } from './services/saas-module.service';
import type { SaasOrderListQuery } from './services/saas-order.service';
import { SaasPlanService } from './services/saas-plan.service';
import { SaasQuotaService } from './services/saas-quota.service';
import { SaasResourcePackOrderService } from './services/saas-resource-pack-order.service';
import type { SaasResourcePackOrderListQuery } from './services/saas-resource-pack-order.service';
import { SaasResourcePackService } from './services/saas-resource-pack.service';
import { SaasSubscriptionLifecycleService } from './services/saas-subscription-lifecycle.service';
import { SaasTenantMemberListQuery, SaasTenantMemberService } from './services/saas-tenant-member.service';

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
    private readonly saasOrderRiskService: SaasOrderRiskService,
    private readonly saasPlanService: SaasPlanService,
    private readonly moduleService: SaasModuleService,
    private readonly saasResourcePackService: SaasResourcePackService,
    private readonly saasResourcePackOrderService: SaasResourcePackOrderService,
    private readonly lifecycleService: SaasSubscriptionLifecycleService,
    private readonly tenantMemberService: SaasTenantMemberService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get active SaaS plans for tenant upgrades' })
  async plans() {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(await this.saasPlanService.listTenantPlans());
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

  @Get('modules')
  @ApiOperation({ summary: 'Get current tenant SaaS modules' })
  async modules() {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(await this.moduleService.listTenantModules(tenantId));
  }

  @Get('members')
  @ApiOperation({ summary: 'List current tenant SaaS members' })
  async members(@Query() query: SaasTenantMemberListQuery) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    await this.moduleService.assertTenantModuleEnabled(tenantId, 'member_management');
    return ResultData.ok(await this.tenantMemberService.listMembers(tenantId, query));
  }

  @Post('members')
  @ApiOperation({ summary: 'Create current tenant SaaS member' })
  async createMember(@Body() body: CreateTenantMemberDto) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    await this.moduleService.assertTenantModuleEnabled(tenantId, 'member_management');
    return ResultData.ok(await this.tenantMemberService.createMember(tenantId, body));
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

  @Get('resource-pack-orders')
  @ApiOperation({ summary: 'List current tenant SaaS resource pack orders' })
  async resourcePackOrders(@Query() query: SaasResourcePackOrderListQuery) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(await this.saasResourcePackOrderService.listTenantOrders(tenantId, query));
  }

  @Post('resource-pack-orders/:order_no/cancel')
  @ApiOperation({ summary: 'Cancel a pending tenant SaaS resource pack order' })
  async cancelResourcePackOrder(@Param('order_no') orderNo: string) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(
      this.saasResourcePackOrderService.toResponse(
        await this.saasOrderRiskService.closeTenantResourcePackOrder(tenantId, orderNo),
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
      ...this.lifecycleService.decorateSubscription(subscription),
    });
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create a tenant SaaS upgrade order' })
  async createOrder(@Body() body: CreateUpgradeOrderDto) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(this.saasOrderService.toResponse(await this.saasOrderService.createUpgradeOrder(tenantId, body)));
  }

  @Get('orders')
  @ApiOperation({ summary: 'List current tenant SaaS orders' })
  async orders(@Query() query: SaasOrderListQuery) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(await this.saasOrderService.listTenantOrders(tenantId, query));
  }

  @Post('orders/:order_no/cancel')
  @ApiOperation({ summary: 'Cancel a pending tenant SaaS order' })
  async cancelOrder(@Param('order_no') orderNo: string) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(this.saasOrderService.toResponse(await this.saasOrderRiskService.closeTenantPlanOrder(tenantId, orderNo)));
  }

  @Get('orders/:order_no')
  @ApiOperation({ summary: 'Get a tenant SaaS order' })
  async order(@Param('order_no') orderNo: string) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    const order = await this.saasOrderService.findTenantOrder(tenantId, orderNo);
    return ResultData.ok(order ? this.saasOrderService.toResponse(order) : null);
  }
}
