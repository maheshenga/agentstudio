import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SystemModuleApiEntity } from './entities/system-module-api.entity';
import { SystemModuleDependencyEntity } from './entities/system-module-dependency.entity';
import { SystemModuleEventEntity } from './entities/system-module-event.entity';
import { SystemModuleMenuEntity } from './entities/system-module-menu.entity';
import { SystemModulePermissionEntity } from './entities/system-module-permission.entity';
import { SystemModuleEntity } from './entities/system-module.entity';
import { SystemTenantModuleEntity } from './entities/system-tenant-module.entity';
import { SystemModuleRegistryService } from './services/system-module-registry.service';

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
  ],
  providers: [SystemModuleRegistryService],
  exports: [SystemModuleRegistryService],
})
export class SystemModuleRegistryModule {}
