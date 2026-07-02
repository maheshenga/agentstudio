import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ResultData } from '../../common/utils/result';
import { TenantContext } from '../../common/tenant/tenant.context';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { TenantProvisionDto } from './dto/tenant-provision.dto';
import { UpdateAlipayConfigDto } from './dto/update-alipay-config.dto';
import { SaasPaymentConfigService } from './services/saas-payment-config.service';
import { SaasPlatformService } from './services/saas-platform.service';
import type { SaasPlatformListQuery } from './services/saas-platform.service';
import { SaasProvisioningService } from './services/saas-provisioning.service';
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
  ) {}

  @Post('tenants')
  @ApiOperation({ summary: 'Create SaaS tenant from platform' })
  @RequirePermission('saas:tenant:save')
  createTenant(@User() user: UserDto, @Body() body: TenantProvisionDto) {
    return TenantContext.run(
      {
        tenantId: undefined,
        userId: user?.userId,
        ignoreAudit: false,
        ignoreTenant: true,
      },
      () => this.provisioning.createTenantFromPlatform(body).then((data) => ResultData.ok(data)),
    );
  }

  @Get('orders')
  @ApiOperation({ summary: 'List SaaS platform orders' })
  @RequirePermission('saas:order:list')
  listOrders(@Query() query: SaasPlatformListQuery, @User() user: UserDto) {
    return TenantContext.run(
      {
        tenantId: undefined,
        userId: user?.userId,
        ignoreAudit: false,
        ignoreTenant: true,
      },
      () => this.platformService.listOrders(query).then((data) => ResultData.ok(data)),
    );
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List SaaS platform subscriptions' })
  @RequirePermission('saas:subscription:list')
  listSubscriptions(@Query() query: SaasPlatformListQuery, @User() user: UserDto) {
    return TenantContext.run(
      {
        tenantId: undefined,
        userId: user?.userId,
        ignoreAudit: false,
        ignoreTenant: true,
      },
      () => this.platformService.listSubscriptions(query).then((data) => ResultData.ok(data)),
    );
  }

  @Get('resource-packs')
  @ApiOperation({ summary: 'List SaaS resource packs' })
  @RequirePermission('saas:resource-pack:index')
  listResourcePacks(@Query() query: SaasResourcePackListQuery, @User() user: UserDto) {
    return TenantContext.run(
      {
        tenantId: undefined,
        userId: user?.userId,
        ignoreAudit: false,
        ignoreTenant: true,
      },
      () => this.platformService.listResourcePacks(query).then((data) => ResultData.ok(data)),
    );
  }

  @Get('resource-pack-orders')
  @ApiOperation({ summary: 'List SaaS resource pack orders' })
  @RequirePermission('saas:resource-pack-order:list')
  listResourcePackOrders(@Query() query: SaasResourcePackOrderListQuery, @User() user: UserDto) {
    return TenantContext.run(
      {
        tenantId: undefined,
        userId: user?.userId,
        ignoreAudit: false,
        ignoreTenant: true,
      },
      () => this.platformService.listResourcePackOrders(query).then((data) => ResultData.ok(data)),
    );
  }

  @Get('resource-pack-orders/:order_no')
  @ApiOperation({ summary: 'Get SaaS resource pack order detail' })
  @RequirePermission('saas:resource-pack-order:list')
  getResourcePackOrder(@Param('order_no') orderNo: string, @User() user: UserDto) {
    return TenantContext.run(
      {
        tenantId: undefined,
        userId: user?.userId,
        ignoreAudit: false,
        ignoreTenant: true,
      },
      () => this.platformService.findResourcePackOrder(orderNo).then((data) => ResultData.ok(data)),
    );
  }

  @Get('payment/alipay/config')
  @ApiOperation({ summary: 'Get platform Alipay config status' })
  @RequirePermission('saas:payment-config:view')
  getAlipayConfig(@User() user: UserDto) {
    return TenantContext.run(
      {
        tenantId: undefined,
        userId: user?.userId,
        ignoreAudit: false,
        ignoreTenant: true,
      },
      () => this.paymentConfigService.getAlipayConfigStatus().then((data) => ResultData.ok(data)),
    );
  }

  @Put('payment/alipay/config')
  @ApiOperation({ summary: 'Update platform Alipay config' })
  @RequirePermission('saas:payment-config:update')
  updateAlipayConfig(@Body() body: UpdateAlipayConfigDto, @User() user: UserDto) {
    return TenantContext.run(
      {
        tenantId: undefined,
        userId: user?.userId,
        ignoreAudit: false,
        ignoreTenant: true,
      },
      () => this.paymentConfigService.updateAlipayConfig(body).then((data) => ResultData.ok(data)),
    );
  }
}
