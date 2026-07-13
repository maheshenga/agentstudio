import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AppRevenueLedgerType = 'charge' | 'refund' | 'adjustment';

@Index('uk_app_revenue_ledger_event', ['eventKey'], { unique: true })
@Index('idx_app_revenue_ledger_developer_time', ['developerId', 'createTime'])
@Index('idx_app_revenue_ledger_settlement', ['settlementBatchId'])
@Entity('app_revenue_ledger')
export class AppRevenueLedgerEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'event_key', length: 100 })
  eventKey: string;

  @Column({ type: 'varchar', name: 'event_type', length: 20 })
  eventType: AppRevenueLedgerType;

  @Column({ type: 'bigint', name: 'order_id', nullable: true })
  orderId?: number | null;

  @Column({ type: 'bigint', name: 'license_id', nullable: true })
  licenseId?: number | null;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'bigint', name: 'developer_id', nullable: true })
  developerId?: number | null;

  @Column({ type: 'int', name: 'gross_amount_cents' })
  grossAmountCents: number;

  @Column({ type: 'int', name: 'platform_amount_cents' })
  platformAmountCents: number;

  @Column({ type: 'int', name: 'developer_amount_cents' })
  developerAmountCents: number;

  @Column({ type: 'varchar', name: 'currency', length: 10, default: 'CNY' })
  currency: 'CNY';

  @Column({ type: 'bigint', name: 'settlement_batch_id', nullable: true })
  settlementBatchId?: number | null;

  @Column({ type: 'bigint', name: 'created_by', nullable: true })
  createdBy?: number | null;

  @Column({ type: 'varchar', name: 'note', length: 255, default: '' })
  note: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;
}
