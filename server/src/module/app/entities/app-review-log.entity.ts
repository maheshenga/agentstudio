import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AppReviewAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'publish'
  | 'unpublish'
  | 'rollback'
  | 'candidate_start'
  | 'candidate_stop'
  | 'reconcile'
  | 'probe'
  | 'disable'
  | 'archive';

@Index('idx_app_review_log_app', ['appId', 'versionId'])
@Entity('app_review_log')
export class AppReviewLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'bigint', name: 'version_id', nullable: true })
  versionId?: number | null;

  @Column({ type: 'varchar', name: 'action', length: 30 })
  action: AppReviewAction;

  @Column({ type: 'varchar', name: 'message', length: 500, default: '' })
  message: string;

  @Column({ type: 'bigint', name: 'operator_id', nullable: true })
  operatorId?: number | null;

  @Column({ type: 'json', name: 'metadata', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;
}
