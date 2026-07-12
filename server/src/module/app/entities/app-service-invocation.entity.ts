import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AppServiceInvocationOutcome = 'success' | 'failure' | 'rejected';

@Index('idx_app_service_invocation_tenant_app_time', [
  'tenantId',
  'targetAppId',
  'createTime',
])
@Index('idx_app_service_invocation_developer_time', ['developerId', 'createTime'])
@Entity('app_service_invocation')
export class AppServiceInvocationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'caller_app_id' })
  callerAppId: number;

  @Column({ type: 'bigint', name: 'caller_version_id' })
  callerVersionId: number;

  @Column({ type: 'bigint', name: 'target_app_id' })
  targetAppId: number;

  @Column({ type: 'bigint', name: 'target_version_id' })
  targetVersionId: number;

  @Column({ type: 'bigint', name: 'developer_id', nullable: true })
  developerId?: number | null;

  @Column({ type: 'varchar', name: 'outcome', length: 20 })
  outcome: AppServiceInvocationOutcome;

  @Column({ type: 'smallint', name: 'status_code', unsigned: true, nullable: true })
  statusCode?: number | null;

  @Column({ type: 'int', name: 'duration_ms', unsigned: true, default: 0 })
  durationMs: number;

  @Column({ type: 'varchar', name: 'error_code', length: 80, default: '' })
  errorCode: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;
}
