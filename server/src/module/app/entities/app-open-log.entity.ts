import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index('idx_app_open_log_tenant', ['tenantId', 'createTime'])
@Index('idx_app_open_log_app', ['appId', 'versionId'])
@Index('idx_app_open_log_outcome', ['outcome', 'createTime'])
@Index('idx_app_open_log_reason', ['reasonCode', 'createTime'])
@Entity('app_open_log')
export class AppOpenLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'user_id', nullable: true })
  userId?: number | null;

  @Column({ type: 'varchar', name: 'app_code', length: 100 })
  appCode: string;

  @Column({ type: 'bigint', name: 'app_id', nullable: true })
  appId?: number | null;

  @Column({ type: 'bigint', name: 'version_id', nullable: true })
  versionId?: number | null;

  @Column({ type: 'varchar', name: 'open_mode', length: 30 })
  openMode: string;

  @Column({ type: 'varchar', name: 'outcome', length: 20, default: 'success' })
  outcome: 'success' | 'failed';

  @Column({ type: 'varchar', name: 'reason_code', length: 50, default: 'none' })
  reasonCode:
    | 'none'
    | 'app_not_found'
    | 'app_not_published'
    | 'app_not_installed'
    | 'missing_plan_module'
    | 'missing_system_module'
    | 'system_module_unavailable'
    | 'published_version_missing'
    | 'open_metadata_error';

  @Column({ type: 'varchar', name: 'failure_message', length: 255, default: '' })
  failureMessage: string;

  @Column({ type: 'varchar', name: 'ip', length: 80, default: '' })
  ip: string;

  @Column({ type: 'varchar', name: 'user_agent', length: 500, default: '' })
  userAgent: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;
}
