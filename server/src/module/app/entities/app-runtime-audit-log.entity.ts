import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AppRuntimeAuditOutcome = 'allowed' | 'denied';

@Index('idx_app_runtime_audit_tenant', ['tenantId', 'createTime'])
@Index('idx_app_runtime_audit_app', ['appId', 'capability', 'createTime'])
@Entity('app_runtime_audit_log')
export class AppRuntimeAuditLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'session_id', nullable: true })
  sessionId?: number | null;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'bigint', name: 'version_id' })
  versionId: number;

  @Column({ type: 'varchar', name: 'capability', length: 80 })
  capability: string;

  @Column({ type: 'varchar', name: 'action', length: 80 })
  action: string;

  @Column({ type: 'varchar', name: 'outcome', length: 20 })
  outcome: AppRuntimeAuditOutcome;

  @Column({ type: 'varchar', name: 'reason_code', length: 50, default: '' })
  reasonCode: string;

  @Column({ type: 'varchar', name: 'request_id', length: 100, default: '' })
  requestId: string;

  @Column({ type: 'varchar', name: 'ip', length: 80, default: '' })
  ip: string;

  @Column({ type: 'varchar', name: 'user_agent', length: 500, default: '' })
  userAgent: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;
}
