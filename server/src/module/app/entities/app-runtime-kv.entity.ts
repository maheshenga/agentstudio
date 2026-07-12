import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Index('uk_app_runtime_kv_scope', ['tenantId', 'appId', 'namespace', 'key'], { unique: true })
@Index('idx_app_runtime_kv_expiry', ['tenantId', 'appId', 'expiresTime'])
@Entity('app_runtime_kv')
export class AppRuntimeKvEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'varchar', name: 'namespace', length: 64 })
  namespace: string;

  @Column({ type: 'varchar', name: 'key', length: 191 })
  key: string;

  @Column({ type: 'json', name: 'value' })
  value: unknown;

  @Column({ type: 'int', name: 'size_byte', unsigned: true })
  sizeByte: number;

  @Column({ type: 'int', name: 'version', unsigned: true, default: 1 })
  version: number;

  @Column({ type: 'datetime', name: 'expires_time', nullable: true })
  expiresTime?: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;
}
