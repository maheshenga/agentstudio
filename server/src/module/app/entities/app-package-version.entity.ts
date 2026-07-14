import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AppVersionReviewStatus = 'pending' | 'approved' | 'rejected';
export type AppVersionPublishStatus =
  | 'unpublished'
  | 'published'
  | 'failed'
  | 'unpublished_retired';
export type AppPackageFormat = 'static_zip' | 'iframe_config' | 'service_zip' | 'native';
export type AppServiceCandidateHealthStatus = 'unknown' | 'checking' | 'healthy' | 'unhealthy';

@Index('uk_app_package_version', ['appId', 'version'], { unique: true })
@Index('idx_app_package_version_review', ['reviewStatus'])
@Index('idx_app_package_version_publish', ['publishStatus'])
@Entity('app_package_version')
export class AppPackageVersionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'varchar', name: 'version', length: 40 })
  version: string;

  @Column({ type: 'json', name: 'manifest', nullable: true })
  manifest?: Record<string, unknown> | null;

  @Column({ type: 'json', name: 'approved_capabilities', nullable: true })
  approvedCapabilities?: string[] | null;

  @Column({ type: 'int', name: 'manifest_version', unsigned: true, default: 1 })
  manifestVersion: number;

  @Column({ type: 'varchar', name: 'package_format', length: 30, default: 'static_zip' })
  packageFormat: AppPackageFormat;

  @Column({ type: 'json', name: 'scan_result', nullable: true })
  scanResult?: Record<string, unknown> | null;

  @Column({ type: 'json', name: 'review_snapshot', nullable: true })
  reviewSnapshot?: Record<string, unknown> | null;

  @Column({ type: 'char', name: 'review_snapshot_hash', length: 64, default: '' })
  reviewSnapshotHash: string;

  @Column({ type: 'datetime', name: 'submitted_time', nullable: true })
  submittedTime?: Date | null;

  @Column({ type: 'json', name: 'service_targets', nullable: true })
  serviceTargets?: string[] | null;

  @Column({
    type: 'varchar',
    name: 'candidate_health_status',
    length: 20,
    default: 'unknown',
  })
  candidateHealthStatus: AppServiceCandidateHealthStatus;

  @Column({ type: 'bigint', name: 'submitted_by', nullable: true })
  submittedBy?: number | null;

  @Column({ type: 'bigint', name: 'candidate_reviewed_by', nullable: true })
  candidateReviewedBy?: number | null;

  @Column({ type: 'datetime', name: 'candidate_reviewed_time', nullable: true })
  candidateReviewedTime?: Date | null;

  @Column({ type: 'bigint', name: 'released_by', nullable: true })
  releasedBy?: number | null;

  @Column({ type: 'datetime', name: 'released_time', nullable: true })
  releasedTime?: Date | null;

  @Column({ type: 'bigint', name: 'rollback_from_version_id', nullable: true })
  rollbackFromVersionId?: number | null;

  @Column({ type: 'varchar', name: 'package_path', length: 500, default: '' })
  packagePath: string;

  @Column({ type: 'varchar', name: 'publish_path', length: 500, default: '' })
  publishPath: string;

  @Column({ type: 'varchar', name: 'entry_file', length: 255, default: '' })
  entryFile: string;

  @Column({ type: 'varchar', name: 'file_hash', length: 64, default: '' })
  fileHash: string;

  @Column({ type: 'char', name: 'content_hash', length: 64, default: '' })
  contentHash: string;

  @Column({ type: 'bigint', name: 'file_size', default: 0 })
  fileSize: number;

  @Column({ type: 'varchar', name: 'review_status', length: 20, default: 'pending' })
  reviewStatus: AppVersionReviewStatus;

  @Column({ type: 'varchar', name: 'publish_status', length: 30, default: 'unpublished' })
  publishStatus: AppVersionPublishStatus;

  @Column({ type: 'varchar', name: 'review_message', length: 500, default: '' })
  reviewMessage: string;

  @Column({ type: 'bigint', name: 'reviewer_id', nullable: true })
  reviewerId?: number | null;

  @Column({ type: 'datetime', name: 'review_time', nullable: true })
  reviewTime?: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
