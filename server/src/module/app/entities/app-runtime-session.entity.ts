import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Index('uk_app_runtime_session_token', ['tokenHash'], { unique: true })
@Index('idx_app_runtime_session_expiry', ['expiresTime', 'revokedTime'])
@Index('idx_app_runtime_session_install', ['tenantId', 'installId', 'revokedTime'])
@Entity('app_runtime_session')
export class AppRuntimeSessionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'char', name: 'token_hash', length: 64 })
  tokenHash: string;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'bigint', name: 'version_id' })
  versionId: number;

  @Column({ type: 'bigint', name: 'install_id' })
  installId: number;

  @Column({ type: 'json', name: 'capabilities' })
  capabilities: string[];

  @Column({ type: 'varchar', name: 'nonce', length: 64, default: '' })
  nonce: string;

  @Column({ type: 'json', name: 'client_metadata', nullable: true })
  clientMetadata?: Record<string, unknown> | null;

  @Column({ type: 'datetime', name: 'expires_time' })
  expiresTime: Date;

  @Column({ type: 'datetime', name: 'revoked_time', nullable: true })
  revokedTime?: Date | null;

  @Column({ type: 'varchar', name: 'revoke_reason', length: 50, default: '' })
  revokeReason: string;

  @Column({ type: 'datetime', name: 'last_used_time', nullable: true })
  lastUsedTime?: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;
}
