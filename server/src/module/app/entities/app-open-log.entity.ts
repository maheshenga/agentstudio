import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index('idx_app_open_log_tenant', ['tenantId', 'createTime'])
@Index('idx_app_open_log_app', ['appId', 'versionId'])
@Entity('app_open_log')
export class AppOpenLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'user_id', nullable: true })
  userId?: number | null;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'bigint', name: 'version_id', nullable: true })
  versionId?: number | null;

  @Column({ type: 'varchar', name: 'open_mode', length: 30 })
  openMode: string;

  @Column({ type: 'varchar', name: 'ip', length: 80, default: '' })
  ip: string;

  @Column({ type: 'varchar', name: 'user_agent', length: 500, default: '' })
  userAgent: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;
}
