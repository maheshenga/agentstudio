import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppOrderEntity } from './entities/app-order.entity';
import { AppPricePlanEntity } from './entities/app-price-plan.entity';
import { AppRevenueLedgerEntity } from './entities/app-revenue-ledger.entity';
import { AppSettlementBatchEntity } from './entities/app-settlement-batch.entity';
import { TenantAppLicenseEntity } from './entities/tenant-app-license.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppPricePlanEntity,
      AppOrderEntity,
      TenantAppLicenseEntity,
      AppRevenueLedgerEntity,
      AppSettlementBatchEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class AppCommerceModule {}
