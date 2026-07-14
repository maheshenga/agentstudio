import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { AppBillingPeriod } from './app-price-plan.entity';

export type AppOrderPricingModel = 'subscription' | 'one_time';
export type AppOrderStatus = 'pending' | 'paid' | 'refunded' | 'closed';

@Index('uk_app_order_order_no', ['orderNo'], { unique: true })
@Index('uk_app_order_trade_no', ['alipayTradeNo'], { unique: true })
@Index('idx_app_order_tenant_status', ['tenantId', 'status'])
@Index('idx_app_order_app_status', ['appId', 'status'])
@Index('idx_app_order_pending_lookup', [
  'tenantId',
  'appId',
  'pricePlanId',
  'paymentMethod',
  'status',
])
@Entity('app_order')
export class AppOrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'order_no', length: 32 })
  orderNo: string;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'bigint', name: 'price_plan_id' })
  pricePlanId: number;

  @Column({ type: 'varchar', name: 'app_code', length: 80 })
  appCode: string;

  @Column({ type: 'varchar', name: 'app_name', length: 120 })
  appName: string;

  @Column({ type: 'varchar', name: 'price_plan_code', length: 50 })
  pricePlanCode: string;

  @Column({ type: 'varchar', name: 'pricing_model', length: 20 })
  pricingModel: AppOrderPricingModel;

  @Column({ type: 'varchar', name: 'billing_period', length: 20, default: 'none' })
  billingPeriod: AppBillingPeriod;

  @Column({ type: 'int', name: 'amount_cents', unsigned: true })
  amountCents: number;

  @Column({ type: 'varchar', name: 'currency', length: 10, default: 'CNY' })
  currency: 'CNY';

  @Column({ type: 'bigint', name: 'developer_id', nullable: true })
  developerId?: number | null;

  @Column({ type: 'smallint', name: 'developer_share_bps', unsigned: true })
  developerShareBps: number;

  @Column({ type: 'varchar', name: 'payment_method', length: 20, default: 'alipay' })
  paymentMethod: 'alipay';

  @Column({ type: 'varchar', name: 'status', length: 20, default: 'pending' })
  status: AppOrderStatus;

  @Column({ type: 'varchar', name: 'alipay_trade_no', length: 64, nullable: true })
  alipayTradeNo?: string | null;

  @Column({ type: 'datetime', name: 'paid_at', nullable: true })
  paidAt?: Date | null;

  @Column({ type: 'datetime', name: 'refunded_at', nullable: true })
  refundedAt?: Date | null;

  @Column({ type: 'bigint', name: 'refunded_by', nullable: true })
  refundedBy?: number | null;

  @Column({ type: 'varchar', name: 'refund_reason', length: 255, default: '' })
  refundReason: string;

  @Column({ type: 'varchar', name: 'refund_reference', length: 100, default: '' })
  refundReference: string;

  @Column({ type: 'datetime', name: 'payment_requested_at', nullable: true })
  paymentRequestedAt?: Date | null;

  @Column({ type: 'datetime', name: 'closed_at', nullable: true })
  closedAt?: Date | null;

  @Column({ type: 'varchar', name: 'close_reason', length: 50, default: '' })
  closeReason: string;

  @Column({ type: 'bigint', name: 'created_by', nullable: true })
  createdBy?: number | null;

  @Column({ type: 'varchar', name: 'remark', length: 255, default: '' })
  remark: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
