import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('saas_plan_quota', { comment: 'SaaS plan quotas' })
export class SaasPlanQuotaEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'plan_id' })
  planId: number;

  @Column({ type: 'varchar', name: 'quota_type', length: 50 })
  quotaType: string;

  @Column({ type: 'bigint', name: 'total_quota', default: 0 })
  totalQuota: number;

  @Column({ type: 'tinyint', name: 'status', default: 1 })
  status: number;

  @Column({ type: 'varchar', name: 'remark', length: 255, nullable: true })
  remark?: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
