import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Index('uk_saas_quota_reservation_source', ['tenantId', 'sourceType', 'sourceId'], { unique: true })
@Entity('saas_quota_reservation', { comment: 'Durable quota reservations' })
export class SaasQuotaReservationEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'id' })
  id: string;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'varchar', length: 50, name: 'source_type' })
  sourceType: string;

  @Column({ type: 'varchar', length: 64, name: 'source_id' })
  sourceId: string;

  @Column({ type: 'varchar', length: 20, name: 'status', default: 'pending' })
  status: 'pending' | 'finalized' | 'released';

  @Column({ type: 'bigint', name: 'reserved_calls', default: 0 })
  reservedCalls: number;

  @Column({ type: 'bigint', name: 'reserved_tokens', default: 0 })
  reservedTokens: number;

  @Column({ type: 'bigint', name: 'actual_tokens', default: 0 })
  actualTokens: number;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;
}
