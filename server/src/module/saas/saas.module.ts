import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SaasPlanFeatureEntity } from './entities/saas-plan-feature.entity';
import { SaasPlanQuotaEntity } from './entities/saas-plan-quota.entity';
import { SaasOrderEntity } from './entities/saas-order.entity';
import { SaasPlanEntity } from './entities/saas-plan.entity';
import { SaasResourcePackEntity } from './entities/saas-resource-pack.entity';
import { SaasSubscriptionEntity } from './entities/saas-subscription.entity';
import { SaasTenantResourceEntity } from './entities/saas-tenant-resource.entity';
import { SaasTrialEntity } from './entities/saas-trial.entity';
import { SaasPaymentController } from './saas-payment.controller';
import { SaasPlatformController } from './saas-platform.controller';
import { SaasPublicController } from './saas-public.controller';
import { SaasTenantController } from './saas-tenant.controller';
import { SaasPlanService } from './services/saas-plan.service';
import { SaasOrderService } from './services/saas-order.service';
import { SaasPaymentService } from './services/saas-payment.service';
import { SaasPlatformService } from './services/saas-platform.service';
import { SaasProvisioningService } from './services/saas-provisioning.service';
import { SaasQuotaService } from './services/saas-quota.service';
import { SaasResourcePackService } from './services/saas-resource-pack.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SaasPlanEntity,
      SaasOrderEntity,
      SaasPlanQuotaEntity,
      SaasPlanFeatureEntity,
      SaasResourcePackEntity,
      SaasSubscriptionEntity,
      SaasTenantResourceEntity,
      SaasTrialEntity,
    ]),
  ],
  controllers: [SaasPublicController, SaasPlatformController, SaasTenantController, SaasPaymentController],
  providers: [
    SaasPlanService,
    SaasOrderService,
    SaasPaymentService,
    SaasPlatformService,
    SaasQuotaService,
    SaasResourcePackService,
    SaasProvisioningService,
  ],
  exports: [
    SaasPlanService,
    SaasOrderService,
    SaasPaymentService,
    SaasPlatformService,
    SaasQuotaService,
    SaasResourcePackService,
    SaasProvisioningService,
  ],
})
export class SaasModule {}
