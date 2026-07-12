import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisModule } from '../../redis/redis.module';
import { SaasModule } from '../saas/saas.module';
import { SystemModuleRegistryModule } from '../system-module/system-module.module';
import { TenantEntity } from '../system/tenant/entities/tenant.entity';
import { SysUserTenantEntity } from '../system/user/entities/user-tenant.entity';
import { UserEntity } from '../system/user/entities/sys-user.entity';
import { AppAnalyticsController } from './app-analytics.controller';
import { AppDeveloperController } from './app-developer.controller';
import { AppFactoryController } from './app-factory.controller';
import { AppPlatformReviewController } from './app-platform-review.controller';
import { AppPlatformController } from './app-platform.controller';
import { AppRuntimeController } from './app-runtime.controller';
import { AppTenantController } from './app-tenant.controller';
import { AppFactoryModuleEntity } from './entities/app-factory-module.entity';
import { AppFactoryPublishLogEntity } from './entities/app-factory-publish-log.entity';
import { AppFactoryTemplateEntity } from './entities/app-factory-template.entity';
import { AppOpenLogEntity } from './entities/app-open-log.entity';
import { AppCapabilityGrantEntity } from './entities/app-capability-grant.entity';
import { AppPackageVersionEntity } from './entities/app-package-version.entity';
import { AppPackageEntity } from './entities/app-package.entity';
import { AppReviewLogEntity } from './entities/app-review-log.entity';
import { AppRuntimeAuditLogEntity } from './entities/app-runtime-audit-log.entity';
import { AppRuntimeKvEntity } from './entities/app-runtime-kv.entity';
import { AppRuntimeSessionEntity } from './entities/app-runtime-session.entity';
import { AppStorageObjectEntity } from './entities/app-storage-object.entity';
import { TenantAppInstallEntity } from './entities/tenant-app-install.entity';
import { AppManifestService } from './services/app-manifest.service';
import { AppAnalyticsService } from './services/app-analytics.service';
import { AppCapabilityPolicyService } from './services/app-capability-policy.service';
import { AppDeveloperService } from './services/app-developer.service';
import { AppFactoryTemplateService } from './services/app-factory-template.service';
import { AppFactoryService } from './services/app-factory.service';
import { AppPackageStorageService } from './services/app-package-storage.service';
import { AppPlatformService } from './services/app-platform.service';
import { AppRuntimeContextService } from './services/app-runtime-context.service';
import { AppRuntimeSessionService } from './services/app-runtime-session.service';
import { AppTenantService } from './services/app-tenant.service';

@Module({
  imports: [
    SaasModule,
    SystemModuleRegistryModule,
    RedisModule,
    TypeOrmModule.forFeature([
      AppPackageEntity,
      AppPackageVersionEntity,
      AppCapabilityGrantEntity,
      AppRuntimeSessionEntity,
      AppRuntimeAuditLogEntity,
      AppRuntimeKvEntity,
      AppStorageObjectEntity,
      AppReviewLogEntity,
      TenantAppInstallEntity,
      AppOpenLogEntity,
      AppFactoryModuleEntity,
      AppFactoryPublishLogEntity,
      AppFactoryTemplateEntity,
      TenantEntity,
      UserEntity,
      SysUserTenantEntity,
    ]),
  ],
  controllers: [
    AppAnalyticsController,
    AppPlatformController,
    AppPlatformReviewController,
    AppRuntimeController,
    AppTenantController,
    AppFactoryController,
    AppDeveloperController,
  ],
  providers: [
    AppAnalyticsService,
    AppManifestService,
    AppCapabilityPolicyService,
    AppDeveloperService,
    AppPackageStorageService,
    AppPlatformService,
    AppRuntimeContextService,
    AppRuntimeSessionService,
    AppTenantService,
    AppFactoryService,
    AppFactoryTemplateService,
  ],
  exports: [
    AppManifestService,
    AppDeveloperService,
    AppPackageStorageService,
    AppPlatformService,
    AppRuntimeContextService,
    AppTenantService,
    AppFactoryService,
    AppFactoryTemplateService,
  ],
})
export class AppMarketplaceModule {}
