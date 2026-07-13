import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppCommerceModule } from '../app-commerce/app-commerce.module';
import { TenantEntity } from '../system/tenant/entities/tenant.entity';
import { SysUserTenantEntity } from '../system/user/entities/user-tenant.entity';
import { SaasPlanFeatureEntity } from './entities/saas-plan-feature.entity';
import { SaasModuleEntity } from './entities/saas-module.entity';
import { SaasPlanQuotaEntity } from './entities/saas-plan-quota.entity';
import { SaasOrderEntity } from './entities/saas-order.entity';
import { SaasPaymentNotifyLogEntity } from './entities/saas-payment-notify-log.entity';
import { SaasPlanEntity } from './entities/saas-plan.entity';
import { SaasPaymentConfigEntity } from './entities/saas-payment-config.entity';
import { SaasQuotaLedgerEntity } from './entities/saas-quota-ledger.entity';
import { SaasResourcePackOrderEntity } from './entities/saas-resource-pack-order.entity';
import { SaasResourcePackEntity } from './entities/saas-resource-pack.entity';
import { SaasSubscriptionEntity } from './entities/saas-subscription.entity';
import { SaasTenantResourceEntity } from './entities/saas-tenant-resource.entity';
import { SaasTrialEntity } from './entities/saas-trial.entity';
import { SaasPaymentController } from './saas-payment.controller';
import { SaasPlatformController } from './saas-platform.controller';
import { SaasPublicController } from './saas-public.controller';
import { SaasTenantController } from './saas-tenant.controller';
import { SaasPlanService } from './services/saas-plan.service';
import { SaasModuleService } from './services/saas-module.service';
import { SaasOrderService } from './services/saas-order.service';
import { SaasOrderRiskService } from './services/saas-order-risk.service';
import { SaasPaymentService } from './services/saas-payment.service';
import { SaasPaymentConfigService } from './services/saas-payment-config.service';
import { SaasPlatformService } from './services/saas-platform.service';
import { SaasProvisioningService } from './services/saas-provisioning.service';
import { SaasRevenueReportService } from './services/saas-revenue-report.service';
import { SaasQuotaService } from './services/saas-quota.service';
import { SaasResourcePackOrderService } from './services/saas-resource-pack-order.service';
import { SaasResourcePackService } from './services/saas-resource-pack.service';
import { SaasRuntimeHealthService } from './services/saas-runtime-health.service';
import { SaasSubscriptionLifecycleService } from './services/saas-subscription-lifecycle.service';
import { SaasTenantMemberService } from './services/saas-tenant-member.service';

@Module({
  imports: [
    AppCommerceModule,
    TypeOrmModule.forFeature([
      SaasPlanEntity,
      SaasModuleEntity,
      SaasOrderEntity,
      SaasPaymentNotifyLogEntity,
      SaasPlanQuotaEntity,
      SaasPlanFeatureEntity,
      SaasPaymentConfigEntity,
      SaasQuotaLedgerEntity,
      SaasResourcePackEntity,
      SaasResourcePackOrderEntity,
      SaasSubscriptionEntity,
      SaasTenantResourceEntity,
      SaasTrialEntity,
      TenantEntity,
      SysUserTenantEntity,
    ]),
  ],
  controllers: [SaasPublicController, SaasPlatformController, SaasTenantController, SaasPaymentController],
  providers: [
    SaasPlanService,
    SaasModuleService,
    SaasOrderService,
    SaasOrderRiskService,
    SaasPaymentService,
    SaasPaymentConfigService,
    SaasPlatformService,
    SaasQuotaService,
    SaasResourcePackService,
    SaasResourcePackOrderService,
    SaasProvisioningService,
    SaasRevenueReportService,
    SaasRuntimeHealthService,
    SaasSubscriptionLifecycleService,
    SaasTenantMemberService,
  ],
  exports: [
    AppCommerceModule,
    SaasPlanService,
    SaasModuleService,
    SaasOrderService,
    SaasOrderRiskService,
    SaasPaymentService,
    SaasPaymentConfigService,
    SaasPlatformService,
    SaasQuotaService,
    SaasResourcePackService,
    SaasResourcePackOrderService,
    SaasProvisioningService,
    SaasRevenueReportService,
    SaasRuntimeHealthService,
    SaasSubscriptionLifecycleService,
    SaasTenantMemberService,
  ],
})
export class SaasModule {}
