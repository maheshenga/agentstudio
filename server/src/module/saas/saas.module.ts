import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SaasPlanFeatureEntity } from './entities/saas-plan-feature.entity';
import { SaasPlanQuotaEntity } from './entities/saas-plan-quota.entity';
import { SaasOrderEntity } from './entities/saas-order.entity';
import { SaasPlanEntity } from './entities/saas-plan.entity';
import { SaasSubscriptionEntity } from './entities/saas-subscription.entity';
import { SaasTenantResourceEntity } from './entities/saas-tenant-resource.entity';
import { SaasTrialEntity } from './entities/saas-trial.entity';
import { SaasPaymentController } from './saas-payment.controller';
import { SaasPlatformController } from './saas-platform.controller';
import { SaasPublicController } from './saas-public.controller';
import { SaasTenantController } from './saas-tenant.controller';
import { SaasPlanService } from './services/saas-plan.service';
import { SaasOrderService } from './services/saas-order.service';
import { SaasProvisioningService } from './services/saas-provisioning.service';
import { SaasQuotaService } from './services/saas-quota.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SaasPlanEntity,
      SaasOrderEntity,
      SaasPlanQuotaEntity,
      SaasPlanFeatureEntity,
      SaasSubscriptionEntity,
      SaasTenantResourceEntity,
      SaasTrialEntity,
    ]),
  ],
  controllers: [SaasPublicController, SaasPlatformController, SaasTenantController, SaasPaymentController],
  providers: [SaasPlanService, SaasOrderService, SaasQuotaService, SaasProvisioningService],
  exports: [SaasPlanService, SaasOrderService, SaasQuotaService, SaasProvisioningService],
})
export class SaasModule {}
