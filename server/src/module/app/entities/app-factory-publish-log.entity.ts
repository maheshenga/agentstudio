import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AppFactoryPublishAction = 'publish';

@Index('idx_app_factory_publish_log_factory', ['factoryId'])
@Index('idx_app_factory_publish_log_app', ['appId', 'versionId'])
@Entity('app_factory_publish_log')
export class AppFactoryPublishLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'factory_id' })
  factoryId: number;

  @Column({ type: 'bigint', name: 'app_id', nullable: true })
  appId?: number | null;

  @Column({ type: 'bigint', name: 'version_id', nullable: true })
  versionId?: number | null;

  @Column({ type: 'varchar', name: 'version', length: 40 })
  version: string;

  @Column({ type: 'varchar', name: 'action', length: 30 })
  action: AppFactoryPublishAction;

  @Column({ type: 'varchar', name: 'message', length: 500, default: '' })
  message: string;

  @Column({ type: 'bigint', name: 'operator_id', nullable: true })
  operatorId?: number | null;

  @Column({ type: 'json', name: 'metadata', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;
}
