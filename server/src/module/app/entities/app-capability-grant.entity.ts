import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type AppCapabilitySubjectType = 'platform' | 'tenant';
export type AppCapabilityGrantStatus = 'approved' | 'denied' | 'revoked';

@Index('uk_app_capability_subject', ['versionId', 'capability', 'subjectType', 'subjectId'], { unique: true })
@Index('idx_app_capability_app', ['appId', 'status'])
@Entity('app_capability_grant')
export class AppCapabilityGrantEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'bigint', name: 'version_id' })
  versionId: number;

  @Column({ type: 'varchar', name: 'subject_type', length: 20 })
  subjectType: AppCapabilitySubjectType;

  @Column({ type: 'bigint', name: 'subject_id', default: 0 })
  subjectId: number;

  @Column({ type: 'varchar', name: 'capability', length: 80 })
  capability: string;

  @Column({ type: 'varchar', name: 'status', length: 20, default: 'approved' })
  status: AppCapabilityGrantStatus;

  @Column({ type: 'json', name: 'policy', nullable: true })
  policy?: Record<string, unknown> | null;

  @Column({ type: 'bigint', name: 'operator_id', nullable: true })
  operatorId?: number | null;

  @Column({ type: 'datetime', name: 'granted_time', nullable: true })
  grantedTime?: Date | null;

  @Column({ type: 'datetime', name: 'revoked_time', nullable: true })
  revokedTime?: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;
}
