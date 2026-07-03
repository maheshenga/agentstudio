import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Index('uk_saas_payment_config_provider_scope', ['provider', 'scope'], { unique: true })
@Entity('saas_payment_config', { comment: 'SaaS payment provider configs' })
export class SaasPaymentConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'provider', length: 20 })
  provider: string;

  @Column({ type: 'varchar', name: 'scope', length: 20, default: 'platform' })
  scope: string;

  @Column({ type: 'tinyint', name: 'enabled', default: 0 })
  enabled: number;

  @Column({ type: 'varchar', name: 'app_id', length: 64, nullable: true })
  appId?: string;

  @Column({ type: 'text', name: 'private_key', nullable: true })
  privateKey?: string;

  @Column({ type: 'text', name: 'public_key', nullable: true })
  publicKey?: string;

  @Column({ type: 'varchar', name: 'gateway_url', length: 255, nullable: true })
  gatewayUrl?: string;

  @Column({ type: 'varchar', name: 'notify_url', length: 255, nullable: true })
  notifyUrl?: string;

  @Column({ type: 'varchar', name: 'return_url', length: 255, nullable: true })
  returnUrl?: string;

  @Column({ type: 'varchar', name: 'remark', length: 255, nullable: true })
  remark?: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
