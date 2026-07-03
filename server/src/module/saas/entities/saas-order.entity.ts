import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Index('uk_saas_order_order_no', ['orderNo'], { unique: true })
@Index('idx_saas_order_tenant_status', ['tenantId', 'status'])
@Entity('saas_order', { comment: 'SaaS tenant upgrade orders' })
export class SaasOrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'order_no', length: 32 })
  orderNo: string;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'plan_id' })
  planId: number;

  @Column({ type: 'varchar', name: 'plan_code', length: 50 })
  planCode: string;

  @Column({ type: 'varchar', name: 'billing_cycle', length: 20, default: 'monthly' })
  billingCycle: string;

  @Column({ type: 'int', name: 'amount_cents', default: 0 })
  amountCents: number;

  @Column({ type: 'varchar', name: 'currency', length: 10, default: 'CNY' })
  currency: string;

  @Column({ type: 'varchar', name: 'payment_method', length: 20, default: 'alipay' })
  paymentMethod: string;

  @Column({ type: 'varchar', name: 'status', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'varchar', name: 'alipay_trade_no', length: 64, nullable: true })
  alipayTradeNo?: string;

  @Column({ type: 'datetime', name: 'paid_at', nullable: true })
  paidAt?: Date;

  @Column({ type: 'varchar', name: 'remark', length: 255, nullable: true })
  remark?: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
