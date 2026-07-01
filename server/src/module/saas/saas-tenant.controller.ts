import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ResultData } from '../../common/utils/result';
import { getTenantId } from '../../common/utils/tenant.util';
import { SaasSubscriptionEntity } from './entities/saas-subscription.entity';
import { SaasQuotaService } from './services/saas-quota.service';

@ApiTags('SaaS Tenant')
@ApiBearerAuth('Authorization')
@Controller('saas/tenant')
export class SaasTenantController {
  constructor(
    @InjectRepository(SaasSubscriptionEntity)
    private readonly saasSubscriptionRepo: Repository<SaasSubscriptionEntity>,
    private readonly saasQuotaService: SaasQuotaService,
  ) {}

  @Get('usage')
  @ApiOperation({ summary: 'Get current tenant SaaS usage' })
  async usage() {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(await this.saasQuotaService.getTenantUsageSummary(tenantId));
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Get current tenant SaaS subscription' })
  async subscription() {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    const subscription = await this.saasSubscriptionRepo.findOne({
      where: {
        tenantId,
      },
      order: {
        id: 'DESC',
      },
    });

    return ResultData.ok(subscription);
  }
}
