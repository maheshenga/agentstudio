import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppPackageEntity } from '../app/entities/app-package.entity';
import { SaasPlanEntity } from '../saas/entities/saas-plan.entity';
import { SaasSubscriptionEntity } from '../saas/entities/saas-subscription.entity';
import { AppCommercePlatformController } from './app-commerce-platform.controller';
import { AppCommerceTenantController } from './app-commerce-tenant.controller';
import { AppOrderEntity } from './entities/app-order.entity';
import { AppPricePlanEntity } from './entities/app-price-plan.entity';
import { AppRevenueLedgerEntity } from './entities/app-revenue-ledger.entity';
import { AppSettlementBatchEntity } from './entities/app-settlement-batch.entity';
import { TenantAppLicenseEntity } from './entities/tenant-app-license.entity';
import { AppLicenseAccessService } from './services/app-license-access.service';
import { AppPricePlanService } from './services/app-price-plan.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppPricePlanEntity,
      AppOrderEntity,
      TenantAppLicenseEntity,
      AppRevenueLedgerEntity,
      AppSettlementBatchEntity,
      AppPackageEntity,
      SaasSubscriptionEntity,
      SaasPlanEntity,
    ]),
  ],
  controllers: [AppCommercePlatformController, AppCommerceTenantController],
  providers: [AppPricePlanService, AppLicenseAccessService],
  exports: [TypeOrmModule, AppPricePlanService, AppLicenseAccessService],
})
export class AppCommerceModule {}
