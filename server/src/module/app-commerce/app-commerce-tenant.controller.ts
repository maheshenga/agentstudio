import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { getTenantId } from '../../common/utils/tenant.util';
import { ResultData } from '../../common/utils/result';
import { AppLicenseAccessService } from './services/app-license-access.service';
import { AppPricePlanService } from './services/app-price-plan.service';

@ApiTags('App Commerce Tenant')
@ApiBearerAuth('Authorization')
@Controller('api/app-tenant/commerce/apps')
export class AppCommerceTenantController {
  constructor(
    private readonly pricePlanService: AppPricePlanService,
    private readonly accessService: AppLicenseAccessService,
  ) {}

  @Get(':code')
  @ApiOperation({ summary: 'Get tenant application commerce access' })
  @RequirePermission('app:tenant:marketplace')
  async getCommerce(@Param('code') code: string) {
    const tenantId = getTenantId();
    if (!tenantId) return ResultData.fail(401, 'Tenant context is required');

    const app = await this.pricePlanService.findTenantApp(code);
    return ResultData.ok(await this.accessService.getAccessState(tenantId, app));
  }
}
