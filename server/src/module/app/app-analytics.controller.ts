import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { getTenantId } from '../../common/utils/tenant.util';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { AppAnalyticsQueryDto } from './dto/app-analytics.dto';
import { AppAnalyticsService } from './services/app-analytics.service';

@ApiTags('App Analytics')
@ApiBearerAuth('Authorization')
@Controller('api/app-analytics')
export class AppAnalyticsController {
  constructor(private readonly analyticsService: AppAnalyticsService) {}

  @Get('platform/overview')
  @ApiOperation({ summary: 'Get platform app analytics overview' })
  @RequirePermission('app:analytics:platform')
  platformOverview(@Query() query: AppAnalyticsQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.analyticsService.getPlatformOverview(query.days).then((data) => ResultData.ok(data)),
    );
  }

  @Get('platform/apps/:code')
  @ApiOperation({ summary: 'Get platform analytics for one app' })
  @RequirePermission('app:analytics:platform')
  platformAppDetail(@Param('code') code: string, @Query() query: AppAnalyticsQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.analyticsService.getPlatformAppDetail(code, query.days).then((data) => ResultData.ok(data)),
    );
  }

  @Get('tenant/overview')
  @ApiOperation({ summary: 'Get current tenant app usage overview' })
  @RequirePermission('app:analytics:tenant')
  async tenantOverview(@Query() query: AppAnalyticsQueryDto) {
    const tenantId = getTenantId();
    if (!tenantId) return ResultData.fail(401, 'Tenant context is required');
    return ResultData.ok(await this.analyticsService.getTenantOverview(tenantId, query.days));
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
