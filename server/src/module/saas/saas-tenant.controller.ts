import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ResultData } from '../../common/utils/result';
import { getTenantId } from '../../common/utils/tenant.util';
import { SaasPlanEntity } from './entities/saas-plan.entity';
import { SaasSubscriptionEntity } from './entities/saas-subscription.entity';
import { SaasTrialEntity } from './entities/saas-trial.entity';
import { SaasQuotaService } from './services/saas-quota.service';

@ApiTags('SaaS Tenant')
@ApiBearerAuth('Authorization')
@Controller('saas/tenant')
export class SaasTenantController {
  constructor(
    @InjectRepository(SaasSubscriptionEntity)
    private readonly saasSubscriptionRepo: Repository<SaasSubscriptionEntity>,
    @InjectRepository(SaasPlanEntity)
    private readonly saasPlanRepo: Repository<SaasPlanEntity>,
    @InjectRepository(SaasTrialEntity)
    private readonly saasTrialRepo: Repository<SaasTrialEntity>,
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

    if (!subscription) {
      return ResultData.ok(null);
    }

    const [plan, trial] = await Promise.all([
      this.saasPlanRepo.findOne({
        where: {
          id: subscription.planId,
        },
      }),
      this.saasTrialRepo.findOne({
        where: {
          tenantId,
          subscriptionId: subscription.id,
        },
        order: {
          id: 'DESC',
        },
      }),
    ]);

    return ResultData.ok({
      tenant_id: tenantId,
      plan_id: subscription.planId,
      current_plan: plan?.code ?? null,
      plan_name: plan?.name ?? null,
      subscription_status: subscription.status,
      billing_cycle: subscription.billingCycle,
      start_time: subscription.startTime,
      end_time: subscription.endTime ?? null,
      trial_status: trial?.status ?? null,
      trial_end_time: trial?.endTime ?? null,
      is_trial_active: Boolean(trial && trial.status === 'trialing' && (!trial.endTime || trial.endTime.getTime() >= Date.now())),
    });
  }
}
