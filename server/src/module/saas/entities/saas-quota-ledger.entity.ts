import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index('idx_saas_quota_ledger_tenant_resource', ['tenantId', 'resourceType'])
@Index('idx_saas_quota_ledger_source', ['sourceType', 'sourceId'])
@Entity('saas_quota_ledger', { comment: 'SaaS quota change ledger' })
export class SaasQuotaLedgerEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'varchar', name: 'resource_type', length: 50 })
  resourceType: string;

  @Column({ type: 'varchar', name: 'change_type', length: 20 })
  changeType: string;

  @Column({ type: 'bigint', name: 'quota_delta', default: 0 })
  quotaDelta: number;

  @Column({ type: 'bigint', name: 'used_delta', default: 0 })
  usedDelta: number;

  @Column({ type: 'bigint', name: 'balance_total_quota', default: 0 })
  balanceTotalQuota: number;

  @Column({ type: 'bigint', name: 'balance_used_quota', default: 0 })
  balanceUsedQuota: number;

  @Column({ type: 'varchar', name: 'source_type', length: 50, nullable: true })
  sourceType?: string;

  @Column({ type: 'varchar', name: 'source_id', length: 64, nullable: true })
  sourceId?: string;

  @Column({ type: 'varchar', name: 'remark', length: 255, nullable: true })
  remark?: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;
}
