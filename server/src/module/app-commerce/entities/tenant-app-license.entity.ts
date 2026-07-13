import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TenantAppLicenseSource = 'trial' | 'order' | 'platform';
export type TenantAppLicenseStatus = 'active' | 'trialing' | 'expired' | 'revoked' | 'refunded';

@Index('uk_tenant_app_license_order', ['orderId'], { unique: true })
@Index('uk_tenant_app_license_current', ['currentLicenseKey'], { unique: true })
@Index('idx_tenant_app_license_tenant_app_status', ['tenantId', 'appId', 'status'])
@Index('idx_tenant_app_license_expiry', ['expiresAt'])
@Entity('tenant_app_license')
export class TenantAppLicenseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'bigint', name: 'price_plan_id', nullable: true })
  pricePlanId?: number | null;

  @Column({ type: 'bigint', name: 'order_id', nullable: true })
  orderId?: number | null;

  @Column({ type: 'varchar', name: 'source', length: 20 })
  source: TenantAppLicenseSource;

  @Column({ type: 'varchar', name: 'status', length: 20 })
  status: TenantAppLicenseStatus;

  @Column({ type: 'datetime', name: 'effective_at' })
  effectiveAt: Date;

  @Column({ type: 'datetime', name: 'expires_at', nullable: true })
  expiresAt?: Date | null;

  @Column({ type: 'datetime', name: 'revoked_at', nullable: true })
  revokedAt?: Date | null;

  @Column({ type: 'varchar', name: 'revoke_reason', length: 255, default: '' })
  revokeReason: string;

  @Column({ type: 'bigint', name: 'created_by', nullable: true })
  createdBy?: number | null;

  @Column({
    type: 'varchar',
    name: 'current_license_key',
    length: 100,
    asExpression:
      "CASE WHEN `status` IN ('active', 'trialing') AND `delete_time` IS NULL THEN CONCAT(`tenant_id`, ':', `app_id`) ELSE NULL END",
    generatedType: 'STORED',
    nullable: true,
    select: false,
    insert: false,
    update: false,
  })
  currentLicenseKey?: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
