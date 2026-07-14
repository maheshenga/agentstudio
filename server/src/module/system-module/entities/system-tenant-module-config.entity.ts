import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Index('uk_system_tenant_module_config_pair', ['tenantId', 'moduleCode'], { unique: true })
@Index('idx_system_tenant_module_config_module', ['moduleCode'])
@Entity('system_tenant_module_config')
export class SystemTenantModuleConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'varchar', name: 'module_code', length: 80 })
  moduleCode: string;

  @Column({ type: 'json', name: 'config' })
  config: Record<string, unknown>;

  @Column({ type: 'bigint', name: 'operator_id', nullable: true })
  operatorId?: number;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;
}
