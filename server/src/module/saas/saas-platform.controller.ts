import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ResultData } from '../../common/utils/result';
import { TenantContext } from '../../common/tenant/tenant.context';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { TenantProvisionDto } from './dto/tenant-provision.dto';
import { SaasPlatformService } from './services/saas-platform.service';
import type { SaasPlatformListQuery } from './services/saas-platform.service';
import { SaasProvisioningService } from './services/saas-provisioning.service';
import type { SaasResourcePackListQuery } from './services/saas-resource-pack.service';

@ApiTags('SaaS Platform')
@ApiBearerAuth('Authorization')
@Controller('api/saas/platform')
export class SaasPlatformController {
  constructor(
    private readonly provisioning: SaasProvisioningService,
    private readonly platformService: SaasPlatformService,
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
}
