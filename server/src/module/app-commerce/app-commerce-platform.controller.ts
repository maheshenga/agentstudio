import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import {
  SaveAppPricePlanDto,
  UpdateAppPricePlanDto,
  UpdateAppPricePlanStatusDto,
} from './dto/app-price-plan.dto';
import { AppPricePlanService } from './services/app-price-plan.service';

@ApiTags('App Commerce Platform')
@ApiBearerAuth('Authorization')
@Controller('api/app-platform/commerce/apps')
export class AppCommercePlatformController {
  constructor(private readonly pricePlanService: AppPricePlanService) {}

  @Get(':code/prices')
  @ApiOperation({ summary: 'List application price plans' })
  @RequirePermission('app:commerce:view')
  listPrices(@Param('code') code: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.pricePlanService.listPlatformPlans(code).then((data) => ResultData.ok(data)),
    );
  }

  @Post(':code/prices')
  @ApiOperation({ summary: 'Create application price plan' })
  @RequirePermission('app:commerce:manage')
  createPrice(
    @Param('code') code: string,
    @Body() body: SaveAppPricePlanDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.pricePlanService
        .savePlan(code, body, user?.userId)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Put(':code/prices/:planCode')
  @ApiOperation({ summary: 'Update application price plan' })
  @RequirePermission('app:commerce:manage')
  updatePrice(
    @Param('code') code: string,
    @Param('planCode') planCode: string,
    @Body() body: UpdateAppPricePlanDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.pricePlanService
        .savePlan(code, { ...body, code: planCode }, user?.userId, planCode)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Put(':code/prices/:planCode/status')
  @ApiOperation({ summary: 'Update application price plan status' })
  @RequirePermission('app:commerce:manage')
  updatePriceStatus(
    @Param('code') code: string,
    @Param('planCode') planCode: string,
    @Body() body: UpdateAppPricePlanStatusDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.pricePlanService
        .updateStatus(code, planCode, body.status, user?.userId)
        .then((data) => ResultData.ok(data)),
    );
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
