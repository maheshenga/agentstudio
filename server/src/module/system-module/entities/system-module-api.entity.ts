import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index('idx_system_module_api_module', ['moduleCode'])
@Index('idx_system_module_api_route', ['method', 'path'])
@Entity('system_module_api')
export class SystemModuleApiEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'module_code', length: 80 })
  moduleCode: string;

  @Column({ type: 'varchar', name: 'method', length: 20 })
  method: string;

  @Column({ type: 'varchar', name: 'path', length: 255 })
  path: string;

  @Column({ type: 'varchar', name: 'permission_slug', length: 120, default: '' })
  permissionSlug: string;

  @Column({ type: 'tinyint', name: 'tenant_scoped', default: 0 })
  tenantScoped: number;
}
