import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SaasModule } from '../saas/saas.module';
import { SystemModuleApiEntity } from './entities/system-module-api.entity';
import { SystemModuleDependencyEntity } from './entities/system-module-dependency.entity';
import { SystemModuleEventEntity } from './entities/system-module-event.entity';
import { SystemModuleMenuEntity } from './entities/system-module-menu.entity';
import { SystemModulePermissionEntity } from './entities/system-module-permission.entity';
import { SystemModuleEntity } from './entities/system-module.entity';
import { SystemTenantModuleEntity } from './entities/system-tenant-module.entity';
import { SystemModuleAccessService } from './services/system-module-access.service';
import { SystemModuleRegistryService } from './services/system-module-registry.service';
import { SystemModulePlatformController } from './system-module-platform.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemModuleEntity,
      SystemModuleDependencyEntity,
      SystemModulePermissionEntity,
      SystemModuleApiEntity,
      SystemModuleMenuEntity,
      SystemTenantModuleEntity,
      SystemModuleEventEntity,
    ]),
    SaasModule,
  ],
  controllers: [SystemModulePlatformController],
  providers: [SystemModuleRegistryService, SystemModuleAccessService],
  exports: [SystemModuleRegistryService, SystemModuleAccessService],
})
export class SystemModuleRegistryModule {}
