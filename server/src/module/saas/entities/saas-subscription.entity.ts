import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('saas_subscription', { comment: 'SaaS tenant subscriptions' })
export class SaasSubscriptionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'plan_id' })
  planId: number;

  @Column({ type: 'varchar', name: 'billing_cycle', length: 20, default: 'monthly' })
  billingCycle: string;

  @Column({ type: 'varchar', name: 'status', length: 20 })
  status: string;

  @Column({ type: 'datetime', name: 'start_time' })
  startTime: Date;

  @Column({ type: 'datetime', name: 'end_time', nullable: true })
  endTime?: Date;

  @Column({ type: 'tinyint', name: 'cancel_at_period_end', default: 0 })
  cancelAtPeriodEnd: number;

  @Column({ type: 'varchar', name: 'remark', length: 255, nullable: true })
  remark?: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
