import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Index('uk_system_module_saas_bridge_pair', ['saasModuleCode', 'systemModuleCode'], { unique: true })
@Index('idx_system_module_saas_bridge_saas', ['saasModuleCode'])
@Index('idx_system_module_saas_bridge_system', ['systemModuleCode'])
@Entity('system_module_saas_bridge')
export class SystemModuleSaasBridgeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'saas_module_code', length: 50 })
  saasModuleCode: string;

  @Column({ type: 'varchar', name: 'system_module_code', length: 80 })
  systemModuleCode: string;

  @Column({ type: 'tinyint', name: 'enabled', default: 1 })
  enabled: number;

  @Column({ type: 'varchar', name: 'source', length: 20, default: 'seed' })
  source: string;

  @Column({ type: 'varchar', name: 'remark', length: 255, nullable: true })
  remark?: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
