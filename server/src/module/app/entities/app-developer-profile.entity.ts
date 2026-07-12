import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AppDeveloperCertificationStatus =
  | 'pending'
  | 'certified'
  | 'rejected'
  | 'expired';
export type AppDeveloperRiskLevel = 'low' | 'medium' | 'high';
export type AppDeveloperRuntimeType = 'static' | 'iframe' | 'service';

@Index('uk_app_developer_profile_user', ['userId'], { unique: true })
@Index('idx_app_developer_profile_status', ['certificationStatus', 'disabled'])
@Entity('app_developer_profile')
export class AppDeveloperProfileEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', name: 'display_name', length: 100, default: '' })
  displayName: string;

  @Column({ type: 'varchar', name: 'website', length: 255, default: '' })
  website: string;

  @Column({ type: 'text', name: 'application_statement' })
  applicationStatement: string;

  @Column({ type: 'varchar', name: 'certification_status', length: 20, default: 'pending' })
  certificationStatus: AppDeveloperCertificationStatus;

  @Column({ type: 'json', name: 'requested_runtime_types' })
  requestedRuntimeTypes: AppDeveloperRuntimeType[];

  @Column({ type: 'json', name: 'approved_runtime_types' })
  approvedRuntimeTypes: AppDeveloperRuntimeType[];

  @Column({ type: 'varchar', name: 'risk_level', length: 20, default: 'medium' })
  riskLevel: AppDeveloperRiskLevel;

  @Column({ type: 'bigint', name: 'reviewer_id', nullable: true })
  reviewerId?: number | null;

  @Column({ type: 'varchar', name: 'review_message', length: 500, default: '' })
  reviewMessage: string;

  @Column({ type: 'datetime', name: 'certification_time', nullable: true })
  certificationTime?: Date | null;

  @Column({ type: 'datetime', name: 'certification_expiry', nullable: true })
  certificationExpiry?: Date | null;

  @Column({ type: 'tinyint', name: 'disabled', default: 0 })
  disabled: number;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;
}
