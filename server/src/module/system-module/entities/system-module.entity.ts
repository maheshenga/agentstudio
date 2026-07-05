import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { SystemModuleHealthStatus, SystemModuleSource, SystemModuleStatus } from '../constants';

@Index('uk_system_module_code', ['code'], { unique: true })
@Index('idx_system_module_status', ['status'])
@Index('idx_system_module_source', ['source'])
@Entity('system_module')
export class SystemModuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'code', length: 80 })
  code: string;

  @Column({ type: 'varchar', name: 'name', length: 120 })
  name: string;

  @Column({ type: 'varchar', name: 'source', length: 20 })
  source: SystemModuleSource;

  @Column({ type: 'varchar', name: 'version', length: 40, default: '1.0.0' })
  version: string;

  @Column({ type: 'varchar', name: 'description', length: 500, default: '' })
  description: string;

  @Column({ type: 'varchar', name: 'category', length: 50, default: '' })
  category: string;

  @Column({ type: 'varchar', name: 'icon', length: 100, default: '' })
  icon: string;

  @Column({ type: 'varchar', name: 'status', length: 20, default: 'installed' })
  status: SystemModuleStatus;

  @Column({ type: 'varchar', name: 'entry_route', length: 255, default: '' })
  entryRoute: string;

  @Column({ type: 'json', name: 'manifest', nullable: true })
  manifest?: Record<string, unknown> | null;

  @Column({ type: 'json', name: 'config_schema', nullable: true })
  configSchema?: Record<string, unknown> | null;

  @Column({ type: 'varchar', name: 'health_status', length: 20, default: 'unknown' })
  healthStatus: SystemModuleHealthStatus;

  @Column({ type: 'int', name: 'sort', default: 100 })
  sort: number;

  @Column({ type: 'varchar', name: 'remark', length: 255, nullable: true })
  remark?: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
