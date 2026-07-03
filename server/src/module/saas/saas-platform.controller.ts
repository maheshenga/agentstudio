import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { CreateSaasPlanDto } from './dto/create-saas-plan.dto';
import { TenantProvisionDto } from './dto/tenant-provision.dto';
import { UpdateAlipayConfigDto } from './dto/update-alipay-config.dto';
import { UpdateSaasPlanQuotasDto } from './dto/update-saas-plan-quotas.dto';
import { UpdateSaasPlanStatusDto } from './dto/update-saas-plan-status.dto';
import { UpdateSaasPlanDto } from './dto/update-saas-plan.dto';
import { SaasPaymentConfigService } from './services/saas-payment-config.service';
import { SaasPlanService } from './services/saas-plan.service';
import type { SaasPlanListQuery } from './services/saas-plan.service';
import { SaasPlatformService } from './services/saas-platform.service';
import type { SaasPlatformListQuery } from './services/saas-platform.service';
import { SaasProvisioningService } from './services/saas-provisioning.service';
import { SaasRevenueReportService } from './services/saas-revenue-report.service';
import type { SaasResourcePackOrderListQuery } from './services/saas-resource-pack-order.service';
import type { SaasResourcePackListQuery } from './services/saas-resource-pack.service';

@ApiTags('SaaS Platform')
@ApiBearerAuth('Authorization')
@Controller('api/saas/platform')
export class SaasPlatformController {
  constructor(
    private readonly provisioning: SaasProvisioningService,
    private readonly platformService: SaasPlatformService,
    private readonly paymentConfigService: SaasPaymentConfigService,
    private readonly planService: SaasPlanService,
    private readonly revenueReportService: SaasRevenueReportService,
  ) {}

  @Post('tenants')
  @ApiOperation({ summary: 'Create SaaS tenant from platform' })
  @RequirePermission('saas:tenant:save')
  createTenant(@User() user: UserDto, @Body() body: TenantProvisionDto) {
    return this.runOutsideTenant(user, () => this.provisioning.createTenantFromPlatform(body).then((data) => ResultData.ok(data)));
  }

  @Get('plans')
  @ApiOperation({ summary: 'List SaaS platform plans' })
  @RequirePermission('saas:plan:index')
  listPlans(@Query() query: SaasPlanListQuery, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.planService.listPlatformPlans(query).then((data) => ResultData.ok(data)));
  }

  @Post('plans')
  @ApiOperation({ summary: 'Create SaaS platform plan' })
  @RequirePermission('saas:plan:create')
  createPlan(@Body() body: CreateSaasPlanDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.planService.createPlatformPlan(body).then((data) => ResultData.ok(data)));
  }

  @Get('plans/:code')
  @ApiOperation({ summary: 'Get SaaS platform plan detail' })
  @RequirePermission('saas:plan:index')
  getPlan(@Param('code') code: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.planService.findPlatformPlan(code).then((data) => ResultData.ok(data)));
  }

  @Put('plans/:code')
  @ApiOperation({ summary: 'Update SaaS platform plan' })
  @RequirePermission('saas:plan:update')
  updatePlan(@Param('code') code: string, @Body() body: UpdateSaasPlanDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.planService.updatePlatformPlan(code, body).then((data) => ResultData.ok(data)));
  }

  @Put('plans/:code/status')
  @ApiOperation({ summary: 'Update SaaS platform plan status' })
  @RequirePermission('saas:plan:status')
  updatePlanStatus(@Param('code') code: string, @Body() body: UpdateSaasPlanStatusDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.planService.updatePlatformPlanStatus(code, body.status).then((data) => ResultData.ok(data)));
  }

  @Put('plans/:code/quotas')
  @ApiOperation({ summary: 'Update SaaS platform plan quotas' })
  @RequirePermission('saas:plan:quota:update')
  updatePlanQuotas(@Param('code') code: string, @Body() body: UpdateSaasPlanQuotasDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.planService.updatePlatformPlanQuotas(code, body).then((data) => ResultData.ok(data)));
  }

  @Get('usage/overview')
  @ApiOperation({ summary: 'Get SaaS platform usage overview' })
  @RequirePermission('saas:usage:index')
  usageOverview(@User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.platformService.getUsageOverview().then((data) => ResultData.ok(data)));
  }

  @Get('revenue/overview')
  @ApiOperation({ summary: 'Get SaaS revenue overview' })
  @RequirePermission('saas:revenue:index')
  revenueOverview(@User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.revenueReportService.getOverview().then((data) => ResultData.ok(data)));
  }

  @Get('orders')
  @ApiOperation({ summary: 'List SaaS platform orders' })
  @RequirePermission('saas:order:list')
  listOrders(@Query() query: SaasPlatformListQuery, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.platformService.listOrders(query).then((data) => ResultData.ok(data)));
  }

  @Get('orders/:order_no')
  @ApiOperation({ summary: 'Get SaaS platform order detail' })
  @RequirePermission('saas:order:list')
  getOrder(@Param('order_no') orderNo: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.platformService.findOrder(orderNo).then((data) => ResultData.ok(data)));
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List SaaS platform subscriptions' })
  @RequirePermission('saas:subscription:list')
  listSubscriptions(@Query() query: SaasPlatformListQuery, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.platformService.listSubscriptions(query).then((data) => ResultData.ok(data)));
  }

  @Get('subscriptions/lifecycle/overview')
  @ApiOperation({ summary: 'Get SaaS subscription lifecycle overview' })
  @RequirePermission('saas:subscription:list')
  subscriptionLifecycleOverview(@User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.platformService.getSubscriptionLifecycleOverview().then((data) => ResultData.ok(data)));
  }

  @Get('subscriptions/:id')
  @ApiOperation({ summary: 'Get SaaS platform subscription detail' })
  @RequirePermission('saas:subscription:list')
  getSubscription(@Param('id') id: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.platformService.findSubscription(id).then((data) => ResultData.ok(data)));
  }

  @Get('resource-packs')
  @ApiOperation({ summary: 'List SaaS resource packs' })
  @RequirePermission('saas:resource-pack:index')
  listResourcePacks(@Query() query: SaasResourcePackListQuery, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.platformService.listResourcePacks(query).then((data) => ResultData.ok(data)));
  }

  @Get('resource-pack-orders')
  @ApiOperation({ summary: 'List SaaS resource pack orders' })
  @RequirePermission('saas:resource-pack-order:list')
  listResourcePackOrders(@Query() query: SaasResourcePackOrderListQuery, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.platformService.listResourcePackOrders(query).then((data) => ResultData.ok(data)));
  }

  @Get('resource-pack-orders/:order_no')
  @ApiOperation({ summary: 'Get SaaS resource pack order detail' })
  @RequirePermission('saas:resource-pack-order:list')
  getResourcePackOrder(@Param('order_no') orderNo: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.platformService.findResourcePackOrder(orderNo).then((data) => ResultData.ok(data)));
  }

  @Get('payment/alipay/config')
  @ApiOperation({ summary: 'Get platform Alipay config status' })
  @RequirePermission('saas:payment-config:view')
  getAlipayConfig(@User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.paymentConfigService.getAlipayConfigStatus().then((data) => ResultData.ok(data)));
  }

  @Put('payment/alipay/config')
  @ApiOperation({ summary: 'Update platform Alipay config' })
  @RequirePermission('saas:payment-config:update')
  updateAlipayConfig(@Body() body: UpdateAlipayConfigDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.paymentConfigService.updateAlipayConfig(body).then((data) => ResultData.ok(data)));
  }

  private runOutsideTenant(user: UserDto, callback: () => Promise<ResultData>) {
    return TenantContext.run(
      {
        tenantId: undefined,
        userId: user?.userId,
        ignoreAudit: false,
        ignoreTenant: true,
      },
      callback,
    );
  }
}
