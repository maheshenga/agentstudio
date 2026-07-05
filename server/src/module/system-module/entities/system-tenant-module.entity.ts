import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import type { SystemTenantModuleSource } from '../constants';

@Index('uk_system_tenant_module_pair', ['tenantId', 'moduleCode'], { unique: true })
@Index('idx_system_tenant_module_module', ['moduleCode'])
@Index('idx_system_tenant_module_enabled', ['tenantId', 'enabled'])
@Entity('system_tenant_module')
export class SystemTenantModuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'varchar', name: 'module_code', length: 80 })
  moduleCode: string;

  @Column({ type: 'tinyint', name: 'enabled', default: 1 })
  enabled: number;

  @Column({ type: 'varchar', name: 'source', length: 20, default: 'platform' })
  source: SystemTenantModuleSource;

  @Column({ type: 'json', name: 'config', nullable: true })
  config?: Record<string, unknown> | null;

  @Column({ type: 'datetime', name: 'start_time', nullable: true })
  startTime?: Date;

  @Column({ type: 'datetime', name: 'end_time', nullable: true })
  endTime?: Date;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
