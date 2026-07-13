import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import {
  AppLicenseListQueryDto,
  AppOrderListQueryDto,
  RecordAppRefundDto,
  RevokeAppLicenseDto,
} from './dto/app-order.dto';
import {
  SaveAppPricePlanDto,
  UpdateAppPricePlanDto,
  UpdateAppPricePlanStatusDto,
} from './dto/app-price-plan.dto';
import {
  AppRevenueQueryDto,
  AppSettlementListQueryDto,
  ApproveAppSettlementDto,
  CancelAppSettlementDto,
  CreateAppSettlementDto,
  MarkAppSettlementPaidDto,
} from './dto/app-settlement.dto';
import { AppOrderService } from './services/app-order.service';
import { AppPricePlanService } from './services/app-price-plan.service';
import { AppRevenueLedgerService } from './services/app-revenue-ledger.service';
import { AppSettlementService } from './services/app-settlement.service';

@ApiTags('App Commerce Platform')
@ApiBearerAuth('Authorization')
@Controller('api/app-platform/commerce')
export class AppCommercePlatformController {
  constructor(
    private readonly pricePlanService: AppPricePlanService,
    private readonly orderService: AppOrderService,
    private readonly revenueService: AppRevenueLedgerService,
    private readonly settlementService: AppSettlementService,
  ) {}

  @Get('apps/:code/prices')
  @ApiOperation({ summary: 'List application price plans' })
  @RequirePermission('app:commerce:view')
  listPrices(@Param('code') code: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.pricePlanService.listPlatformPlans(code).then((data) => ResultData.ok(data)),
    );
  }

  @Post('apps/:code/prices')
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

  @Put('apps/:code/prices/:planCode')
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

  @Put('apps/:code/prices/:planCode/status')
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

  @Get('orders')
  @ApiOperation({ summary: 'List application orders' })
  @RequirePermission('app:commerce:view')
  listOrders(@Query() query: AppOrderListQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.orderService.listPlatformOrders(query).then((data) => ResultData.ok(data)),
    );
  }

  @Post('orders/:orderNo/refund')
  @ApiOperation({ summary: 'Record a confirmed full application refund' })
  @RequirePermission('app:commerce:manage')
  refundOrder(
    @Param('orderNo') orderNo: string,
    @Body() body: RecordAppRefundDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.orderService
        .recordFullRefund(orderNo, user?.userId, body.reason, body.provider_reference)
        .then((order) => ResultData.ok(this.orderService.toResponse(order))),
    );
  }

  @Get('licenses')
  @ApiOperation({ summary: 'List tenant application licenses' })
  @RequirePermission('app:commerce:view')
  listLicenses(@Query() query: AppLicenseListQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.orderService.listPlatformLicenses(query).then((data) => ResultData.ok(data)),
    );
  }

  @Put('licenses/:id/revoke')
  @ApiOperation({ summary: 'Revoke a current tenant application license' })
  @RequirePermission('app:commerce:manage')
  revokeLicense(
    @Param('id') id: number,
    @Body() body: RevokeAppLicenseDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.orderService
        .revokeLicense(Number(id), user?.userId, body.reason)
        .then((license) => ResultData.ok(this.orderService.toLicenseResponse(license))),
    );
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get application revenue overview' })
  @RequirePermission('app:commerce:view')
  getRevenue(@Query() query: AppRevenueQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.revenueService.getPlatformOverview(query).then((data) => ResultData.ok(data)),
    );
  }

  @Get('settlements')
  @ApiOperation({ summary: 'List application settlement batches' })
  @RequirePermission('app:settlement:manage')
  listSettlements(@Query() query: AppSettlementListQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.settlementService.listPlatformSettlements(query).then((data) => ResultData.ok(data)),
    );
  }

  @Post('settlements')
  @ApiOperation({ summary: 'Create an application settlement batch' })
  @RequirePermission('app:settlement:manage')
  createSettlement(@Body() body: CreateAppSettlementDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.settlementService
        .createBatch(body.developer_id, body.period, user?.userId)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Post('settlements/:id/approve')
  @ApiOperation({ summary: 'Approve an application settlement batch' })
  @RequirePermission('app:settlement:manage')
  approveSettlement(
    @Param('id') id: number,
    @Body() body: ApproveAppSettlementDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.settlementService
        .approveBatch(Number(id), user?.userId, body.note)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Post('settlements/:id/paid')
  @ApiOperation({ summary: 'Mark an application settlement batch paid' })
  @RequirePermission('app:settlement:manage')
  markSettlementPaid(
    @Param('id') id: number,
    @Body() body: MarkAppSettlementPaidDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.settlementService
        .markPaid(Number(id), user?.userId, body.payment_reference)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Post('settlements/:id/cancel')
  @ApiOperation({ summary: 'Cancel a draft application settlement batch' })
  @RequirePermission('app:settlement:manage')
  cancelSettlement(
    @Param('id') id: number,
    @Body() body: CancelAppSettlementDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.settlementService
        .cancelBatch(Number(id), user?.userId, body.note)
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
