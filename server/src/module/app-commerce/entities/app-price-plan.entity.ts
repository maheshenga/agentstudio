import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AppPricingModel = 'free' | 'included' | 'subscription' | 'one_time';
export type AppBillingPeriod = 'none' | 'monthly' | 'yearly';
export type AppPriceSaleScope = 'all' | 'selected_tenants';

@Index('uk_app_price_plan_app_code', ['appId', 'code'], { unique: true })
@Index('idx_app_price_plan_app_status', ['appId', 'status'])
@Entity('app_price_plan')
export class AppPricePlanEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'varchar', name: 'code', length: 50 })
  code: string;

  @Column({ type: 'varchar', name: 'name', length: 100 })
  name: string;

  @Column({ type: 'varchar', name: 'pricing_model', length: 20 })
  pricingModel: AppPricingModel;

  @Column({ type: 'varchar', name: 'billing_period', length: 20, default: 'none' })
  billingPeriod: AppBillingPeriod;

  @Column({ type: 'int', name: 'amount_cents', unsigned: true, default: 0 })
  amountCents: number;

  @Column({ type: 'varchar', name: 'currency', length: 10, default: 'CNY' })
  currency: 'CNY';

  @Column({ type: 'smallint', name: 'trial_days', unsigned: true, default: 0 })
  trialDays: number;

  @Column({ type: 'smallint', name: 'developer_share_bps', unsigned: true })
  developerShareBps: number;

  @Column({ type: 'json', name: 'included_plan_codes' })
  includedPlanCodes: string[];

  @Column({ type: 'varchar', name: 'sale_scope', length: 20, default: 'all' })
  saleScope: AppPriceSaleScope;

  @Column({ type: 'json', name: 'tenant_ids' })
  tenantIds: number[];

  @Column({ type: 'tinyint', name: 'status', default: 1 })
  status: number;

  @Column({ type: 'int', name: 'sort', default: 100 })
  sort: number;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
