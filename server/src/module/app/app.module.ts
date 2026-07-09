import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SaasModule } from '../saas/saas.module';
import { SystemModuleRegistryModule } from '../system-module/system-module.module';
import { AppFactoryController } from './app-factory.controller';
import { AppPlatformController } from './app-platform.controller';
import { AppTenantController } from './app-tenant.controller';
import { AppFactoryModuleEntity } from './entities/app-factory-module.entity';
import { AppFactoryPublishLogEntity } from './entities/app-factory-publish-log.entity';
import { AppOpenLogEntity } from './entities/app-open-log.entity';
import { AppPackageVersionEntity } from './entities/app-package-version.entity';
import { AppPackageEntity } from './entities/app-package.entity';
import { AppReviewLogEntity } from './entities/app-review-log.entity';
import { TenantAppInstallEntity } from './entities/tenant-app-install.entity';
import { AppManifestService } from './services/app-manifest.service';
import { AppFactoryService } from './services/app-factory.service';
import { AppPackageStorageService } from './services/app-package-storage.service';
import { AppPlatformService } from './services/app-platform.service';
import { AppTenantService } from './services/app-tenant.service';

@Module({
  imports: [
    SaasModule,
    SystemModuleRegistryModule,
    TypeOrmModule.forFeature([
      AppPackageEntity,
      AppPackageVersionEntity,
      AppReviewLogEntity,
      TenantAppInstallEntity,
      AppOpenLogEntity,
      AppFactoryModuleEntity,
      AppFactoryPublishLogEntity,
    ]),
  ],
  controllers: [AppPlatformController, AppTenantController, AppFactoryController],
  providers: [AppManifestService, AppPackageStorageService, AppPlatformService, AppTenantService, AppFactoryService],
  exports: [AppManifestService, AppPackageStorageService, AppPlatformService, AppTenantService, AppFactoryService],
})
export class AppMarketplaceModule {}
