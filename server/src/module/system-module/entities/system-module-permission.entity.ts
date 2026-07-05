import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import type { SystemModuleBindingType } from './system-module-menu.entity';

@Index('idx_system_module_permission_module', ['moduleCode'])
@Index('uk_system_module_permission_pair', ['moduleCode', 'permissionSlug'], { unique: true })
@Entity('system_module_permission')
export class SystemModulePermissionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'module_code', length: 80 })
  moduleCode: string;

  @Column({ type: 'varchar', name: 'permission_slug', length: 120 })
  permissionSlug: string;

  @Column({ type: 'varchar', name: 'binding_type', length: 20, default: 'owned' })
  bindingType: SystemModuleBindingType;
}
