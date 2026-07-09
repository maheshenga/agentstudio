import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppPlatformController } from './app-platform.controller';
import { AppOpenLogEntity } from './entities/app-open-log.entity';
import { AppPackageVersionEntity } from './entities/app-package-version.entity';
import { AppPackageEntity } from './entities/app-package.entity';
import { AppReviewLogEntity } from './entities/app-review-log.entity';
import { TenantAppInstallEntity } from './entities/tenant-app-install.entity';
import { AppManifestService } from './services/app-manifest.service';
import { AppPackageStorageService } from './services/app-package-storage.service';
import { AppPlatformService } from './services/app-platform.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppPackageEntity,
      AppPackageVersionEntity,
      AppReviewLogEntity,
      TenantAppInstallEntity,
      AppOpenLogEntity,
    ]),
  ],
  controllers: [AppPlatformController],
  providers: [AppManifestService, AppPackageStorageService, AppPlatformService],
  exports: [AppManifestService, AppPackageStorageService, AppPlatformService],
})
export class AppMarketplaceModule {}
