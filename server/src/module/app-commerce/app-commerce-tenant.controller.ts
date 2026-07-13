import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { getTenantId } from '../../common/utils/tenant.util';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import {
  AppOrderListQueryDto,
  CreateAppOrderDto,
  StartAppTrialDto,
} from './dto/app-order.dto';
import { AppLicenseAccessService } from './services/app-license-access.service';
import { AppOrderService } from './services/app-order.service';
import { AppPricePlanService } from './services/app-price-plan.service';

@ApiTags('App Commerce Tenant')
@ApiBearerAuth('Authorization')
@Controller('api/app-tenant/commerce')
export class AppCommerceTenantController {
  constructor(
    private readonly pricePlanService: AppPricePlanService,
    private readonly accessService: AppLicenseAccessService,
    private readonly orderService: AppOrderService,
  ) {}

  @Get('apps/:code')
  @ApiOperation({ summary: 'Get tenant application commerce access' })
  @RequirePermission('app:tenant:marketplace')
  async getCommerce(@Param('code') code: string) {
    const tenantId = getTenantId();
    if (!tenantId) return ResultData.fail(401, 'Tenant context is required');

    const app = await this.pricePlanService.findTenantApp(code);
    return ResultData.ok(await this.accessService.getAccessState(tenantId, app));
  }

  @Post('apps/:code/orders')
  @ApiOperation({ summary: 'Create tenant application order' })
  @RequirePermission('app:tenant:purchase')
  async createOrder(
    @Param('code') code: string,
    @Body() body: CreateAppOrderDto,
    @User() user: UserDto,
  ) {
    const tenantId = getTenantId();
    const userId = Number(user?.userId || 0);
    if (!tenantId || !userId) return ResultData.fail(401, 'Tenant and user context are required');
    const order = await this.orderService.createTenantOrder(tenantId, userId, code, body);
    return ResultData.ok(this.orderService.toResponse(order));
  }

  @Post('apps/:code/trial')
  @ApiOperation({ summary: 'Start tenant application trial' })
  @RequirePermission('app:tenant:purchase')
  async startTrial(
    @Param('code') code: string,
    @Body() body: StartAppTrialDto,
    @User() user: UserDto,
  ) {
    const tenantId = getTenantId();
    const userId = Number(user?.userId || 0);
    if (!tenantId || !userId) return ResultData.fail(401, 'Tenant and user context are required');
    const license = await this.orderService.startTrial(
      tenantId,
      userId,
      code,
      body.price_plan_code,
    );
    return ResultData.ok(this.orderService.toLicenseResponse(license));
  }

  @Get('orders')
  @ApiOperation({ summary: 'List tenant application orders' })
  @RequirePermission('app:tenant:orders')
  async listOrders(@Query() query: AppOrderListQueryDto) {
    const tenantId = getTenantId();
    if (!tenantId) return ResultData.fail(401, 'Tenant context is required');
    return ResultData.ok(await this.orderService.listTenantOrders(tenantId, query));
  }

  @Get('orders/:orderNo')
  @ApiOperation({ summary: 'Get tenant application order' })
  @RequirePermission('app:tenant:orders')
  async getOrder(@Param('orderNo') orderNo: string) {
    const tenantId = getTenantId();
    if (!tenantId) return ResultData.fail(401, 'Tenant context is required');
    return ResultData.ok(await this.orderService.getTenantOrder(tenantId, orderNo));
  }
}
