import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { AppReviewQueueQueryDto } from './dto/app-platform.dto';
import { AppPlatformService } from './services/app-platform.service';

@ApiTags('App Platform')
@ApiBearerAuth('Authorization')
@Controller('api/app-platform/reviews')
export class AppPlatformReviewController {
  constructor(private readonly appPlatformService: AppPlatformService) {}

  @Get()
  @ApiOperation({ summary: 'List app review queue' })
  @RequirePermission('app:platform:review')
  listReviews(@Query() query: AppReviewQueueQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.appPlatformService.listReviewQueue(query).then((data) => ResultData.ok(data)));
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
