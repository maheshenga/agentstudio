import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SaasModule } from '../saas/saas.module';
import { SystemModuleRegistryModule } from '../system-module/system-module.module';
import { AppDeveloperController } from './app-developer.controller';
import { AppFactoryController } from './app-factory.controller';
import { AppPlatformReviewController } from './app-platform-review.controller';
import { AppPlatformController } from './app-platform.controller';
import { AppTenantController } from './app-tenant.controller';
import { AppFactoryModuleEntity } from './entities/app-factory-module.entity';
import { AppFactoryPublishLogEntity } from './entities/app-factory-publish-log.entity';
import { AppFactoryTemplateEntity } from './entities/app-factory-template.entity';
import { AppOpenLogEntity } from './entities/app-open-log.entity';
import { AppPackageVersionEntity } from './entities/app-package-version.entity';
import { AppPackageEntity } from './entities/app-package.entity';
import { AppReviewLogEntity } from './entities/app-review-log.entity';
import { TenantAppInstallEntity } from './entities/tenant-app-install.entity';
import { AppManifestService } from './services/app-manifest.service';
import { AppDeveloperService } from './services/app-developer.service';
import { AppFactoryTemplateService } from './services/app-factory-template.service';
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
      AppFactoryTemplateEntity,
    ]),
  ],
  controllers: [
    AppPlatformController,
    AppPlatformReviewController,
    AppTenantController,
    AppFactoryController,
    AppDeveloperController,
  ],
  providers: [
    AppManifestService,
    AppDeveloperService,
    AppPackageStorageService,
    AppPlatformService,
    AppTenantService,
    AppFactoryService,
    AppFactoryTemplateService,
  ],
  exports: [
    AppManifestService,
    AppDeveloperService,
    AppPackageStorageService,
    AppPlatformService,
    AppTenantService,
    AppFactoryService,
    AppFactoryTemplateService,
  ],
})
export class AppMarketplaceModule {}
