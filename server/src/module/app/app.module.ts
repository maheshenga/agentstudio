import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisModule } from '../../redis/redis.module';
import { AppCommerceModule } from '../app-commerce/app-commerce.module';
import { SaasModule } from '../saas/saas.module';
import { SystemModuleRegistryModule } from '../system-module/system-module.module';
import { TenantEntity } from '../system/tenant/entities/tenant.entity';
import { SysUserTenantEntity } from '../system/user/entities/user-tenant.entity';
import { UserEntity } from '../system/user/entities/sys-user.entity';
import { AppAnalyticsController } from './app-analytics.controller';
import { AppDeveloperController } from './app-developer.controller';
import { AppDeveloperCertificationController } from './app-developer-certification.controller';
import { AppDeveloperProfileController } from './app-developer-profile.controller';
import { AppFactoryController } from './app-factory.controller';
import { AppPlatformReviewController } from './app-platform-review.controller';
import { AppPlatformController } from './app-platform.controller';
import { AppRuntimeController } from './app-runtime.controller';
import { AppServicePlatformController } from './app-service-platform.controller';
import { AppTenantController } from './app-tenant.controller';
import { AppFactoryModuleEntity } from './entities/app-factory-module.entity';
import { AppFactoryPublishLogEntity } from './entities/app-factory-publish-log.entity';
import { AppFactoryTemplateEntity } from './entities/app-factory-template.entity';
import { AppOpenLogEntity } from './entities/app-open-log.entity';
import { AppCapabilityGrantEntity } from './entities/app-capability-grant.entity';
import { AppDeveloperProfileEntity } from './entities/app-developer-profile.entity';
import { AppPackageVersionEntity } from './entities/app-package-version.entity';
import { AppPackageEntity } from './entities/app-package.entity';
import { AppReviewLogEntity } from './entities/app-review-log.entity';
import { AppRuntimeAuditLogEntity } from './entities/app-runtime-audit-log.entity';
import { AppRuntimeKvEntity } from './entities/app-runtime-kv.entity';
import { AppRuntimeSessionEntity } from './entities/app-runtime-session.entity';
import { AppStorageObjectEntity } from './entities/app-storage-object.entity';
import { AppServiceInstanceEntity } from './entities/app-service-instance.entity';
import { AppServiceInvocationEntity } from './entities/app-service-invocation.entity';
import { TenantAppInstallEntity } from './entities/tenant-app-install.entity';
import { AppManifestService } from './services/app-manifest.service';
import { AppAnalyticsService } from './services/app-analytics.service';
import { AppCapabilityPolicyService } from './services/app-capability-policy.service';
import { AppDeveloperService } from './services/app-developer.service';
import { AppDeveloperCertificationService } from './services/app-developer-certification.service';
import { AppFactoryTemplateService } from './services/app-factory-template.service';
import { AppFactoryService } from './services/app-factory.service';
import { AppPackageStorageService } from './services/app-package-storage.service';
import { AppPlatformService } from './services/app-platform.service';
import { AppRuntimeContextService } from './services/app-runtime-context.service';
import { AppIframeLaunchService } from './services/app-iframe-launch.service';
import { AppRuntimeFileService } from './services/app-runtime-file.service';
import { AppRuntimeKvService } from './services/app-runtime-kv.service';
import {
  AppRuntimeHttpService,
  UndiciAppRuntimeHttpTransport,
} from './services/app-runtime-http.service';
import { AppRuntimeSessionService } from './services/app-runtime-session.service';
import { AppReviewSnapshotService } from './services/app-review-snapshot.service';
import { AppServiceLogRedactor } from './services/app-service-log-redactor';
import { AppServiceInvocationPolicyService } from './services/app-service-invocation-policy.service';
import { AppServiceLoopbackTransport } from './services/app-service-loopback.transport';
import { AppServicePackageService } from './services/app-service-package.service';
import {
  AppServiceCommandRunner,
  AppServiceHostEnvironment,
  AppServiceProcessManager,
  NodeAppServiceCommandRunner,
} from './services/app-service-process-manager';
import {
  AppServiceDelay,
  AppServicePortAllocator,
  AppServiceRuntimeService,
  NodeAppServiceDelay,
  NodeAppServicePortAllocator,
} from './services/app-service-runtime.service';
import { AppTenantService } from './services/app-tenant.service';

@Module({
  imports: [
    AppCommerceModule,
    SaasModule,
    SystemModuleRegistryModule,
    RedisModule,
    TypeOrmModule.forFeature([
      AppPackageEntity,
      AppPackageVersionEntity,
      AppDeveloperProfileEntity,
      AppCapabilityGrantEntity,
      AppRuntimeSessionEntity,
      AppRuntimeAuditLogEntity,
      AppRuntimeKvEntity,
      AppStorageObjectEntity,
      AppServiceInstanceEntity,
      AppServiceInvocationEntity,
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
    AppServicePlatformController,
    AppTenantController,
    AppFactoryController,
    AppDeveloperController,
    AppDeveloperProfileController,
    AppDeveloperCertificationController,
  ],
  providers: [
    AppAnalyticsService,
    AppManifestService,
    AppCapabilityPolicyService,
    AppDeveloperService,
    AppDeveloperCertificationService,
    AppPackageStorageService,
    AppReviewSnapshotService,
    AppServicePackageService,
    AppServiceInvocationPolicyService,
    AppServiceLogRedactor,
    AppServiceHostEnvironment,
    AppServiceProcessManager,
    { provide: AppServiceCommandRunner, useClass: NodeAppServiceCommandRunner },
    AppServiceLoopbackTransport,
    AppServiceRuntimeService,
    { provide: AppServicePortAllocator, useClass: NodeAppServicePortAllocator },
    { provide: AppServiceDelay, useClass: NodeAppServiceDelay },
    AppPlatformService,
    AppRuntimeContextService,
    AppIframeLaunchService,
    AppRuntimeFileService,
    AppRuntimeKvService,
    AppRuntimeHttpService,
    UndiciAppRuntimeHttpTransport,
    AppRuntimeSessionService,
    AppTenantService,
    AppFactoryService,
    AppFactoryTemplateService,
  ],
  exports: [
    AppManifestService,
    AppDeveloperService,
    AppDeveloperCertificationService,
    AppPackageStorageService,
    AppReviewSnapshotService,
    AppServicePackageService,
    AppServiceLogRedactor,
    AppServiceProcessManager,
    AppServiceLoopbackTransport,
    AppServiceRuntimeService,
    AppPlatformService,
    AppRuntimeContextService,
    AppTenantService,
    AppFactoryService,
    AppFactoryTemplateService,
  ],
})
export class AppMarketplaceModule {}
