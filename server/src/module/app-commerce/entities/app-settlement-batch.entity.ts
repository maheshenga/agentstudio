import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type AppSettlementStatus = 'draft' | 'approved' | 'paid' | 'cancelled';

@Index('uk_app_settlement_batch_no', ['batchNo'], { unique: true })
@Index('uk_app_settlement_developer_period', ['developerId', 'periodStart', 'periodEnd'], {
  unique: true,
})
@Index('idx_app_settlement_status_period', ['status', 'periodStart', 'periodEnd'])
@Entity('app_settlement_batch')
export class AppSettlementBatchEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'batch_no', length: 40 })
  batchNo: string;

  @Column({ type: 'bigint', name: 'developer_id' })
  developerId: number;

  @Column({ type: 'date', name: 'period_start' })
  periodStart: string;

  @Column({ type: 'date', name: 'period_end' })
  periodEnd: string;

  @Column({ type: 'int', name: 'gross_amount_cents', unsigned: true, default: 0 })
  grossAmountCents: number;

  @Column({ type: 'int', name: 'refund_amount_cents', unsigned: true, default: 0 })
  refundAmountCents: number;

  @Column({ type: 'int', name: 'developer_amount_cents', default: 0 })
  developerAmountCents: number;

  @Column({ type: 'int', name: 'ledger_count', unsigned: true, default: 0 })
  ledgerCount: number;

  @Column({ type: 'varchar', name: 'status', length: 20, default: 'draft' })
  status: AppSettlementStatus;

  @Column({ type: 'bigint', name: 'reviewed_by', nullable: true })
  reviewedBy?: number | null;

  @Column({ type: 'datetime', name: 'reviewed_at', nullable: true })
  reviewedAt?: Date | null;

  @Column({ type: 'bigint', name: 'paid_by', nullable: true })
  paidBy?: number | null;

  @Column({ type: 'datetime', name: 'paid_at', nullable: true })
  paidAt?: Date | null;

  @Column({ type: 'varchar', name: 'payment_reference', length: 100, default: '' })
  paymentReference: string;

  @Column({ type: 'varchar', name: 'note', length: 255, default: '' })
  note: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;
}
