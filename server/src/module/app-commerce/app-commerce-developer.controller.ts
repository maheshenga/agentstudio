import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { AppRevenueQueryDto, AppSettlementListQueryDto } from './dto/app-settlement.dto';
import { AppRevenueLedgerService } from './services/app-revenue-ledger.service';
import { AppSettlementService } from './services/app-settlement.service';

@ApiTags('App Commerce Developer')
@ApiBearerAuth('Authorization')
@Controller('api/app-developer/commerce')
export class AppCommerceDeveloperController {
  constructor(
    private readonly revenueService: AppRevenueLedgerService,
    private readonly settlementService: AppSettlementService,
  ) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Get owned application revenue overview' })
  @RequirePermission('app:developer:revenue')
  getRevenue(@Query() query: AppRevenueQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.revenueService
        .getDeveloperOverview(user?.userId, query)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Get('settlements')
  @ApiOperation({ summary: 'List owned application settlement history' })
  @RequirePermission('app:developer:revenue')
  listSettlements(@Query() query: AppSettlementListQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.settlementService
        .listDeveloperSettlements(user?.userId, query)
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
