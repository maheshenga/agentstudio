import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Index('idx_saas_payment_notify_order', ['provider', 'orderNo'])
@Index('idx_saas_payment_notify_trade', ['provider', 'tradeNo'])
@Index('idx_saas_payment_notify_result', ['provider', 'result'])
@Index('idx_saas_payment_notify_notify_id', ['provider', 'notifyId'])
@Entity('saas_payment_notify_log', { comment: 'SaaS payment provider callback audit logs' })
export class SaasPaymentNotifyLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'provider', length: 20 })
  provider: string;

  @Column({ type: 'varchar', name: 'order_type', length: 30, nullable: true })
  orderType?: string;

  @Column({ type: 'varchar', name: 'order_no', length: 64, nullable: true })
  orderNo?: string;

  @Column({ type: 'varchar', name: 'trade_no', length: 64, nullable: true })
  tradeNo?: string;

  @Column({ type: 'varchar', name: 'trade_status', length: 50, nullable: true })
  tradeStatus?: string;

  @Column({ type: 'varchar', name: 'notify_id', length: 128, nullable: true })
  notifyId?: string;

  @Column({ type: 'varchar', name: 'result', length: 30 })
  result: string;

  @Column({ type: 'varchar', name: 'reason', length: 120, nullable: true })
  reason?: string;

  @Column({ type: 'json', name: 'raw_payload', nullable: true })
  rawPayload?: Record<string, unknown> | null;

  @Column({ type: 'datetime', name: 'processed_at', nullable: true })
  processedAt?: Date;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;
}
