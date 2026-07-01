import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SaasPlanFeatureEntity } from './entities/saas-plan-feature.entity';
import { SaasPlanQuotaEntity } from './entities/saas-plan-quota.entity';
import { SaasPlanEntity } from './entities/saas-plan.entity';
import { SaasSubscriptionEntity } from './entities/saas-subscription.entity';
import { SaasTenantResourceEntity } from './entities/saas-tenant-resource.entity';
import { SaasTrialEntity } from './entities/saas-trial.entity';
import { SaasPlanService } from './services/saas-plan.service';
import { SaasProvisioningService } from './services/saas-provisioning.service';
import { SaasQuotaService } from './services/saas-quota.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SaasPlanEntity,
      SaasPlanQuotaEntity,
      SaasPlanFeatureEntity,
      SaasSubscriptionEntity,
      SaasTenantResourceEntity,
      SaasTrialEntity,
    ]),
  ],
  providers: [SaasPlanService, SaasQuotaService, SaasProvisioningService],
  exports: [SaasPlanService, SaasQuotaService, SaasProvisioningService],
})
export class SaasModule {}
