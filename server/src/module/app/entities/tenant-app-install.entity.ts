import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type TenantAppInstallSource = 'marketplace' | 'plan' | 'platform' | 'manual';

@Index('uk_tenant_app_install_pair', ['tenantId', 'appId'], { unique: true })
@Index('idx_tenant_app_install_tenant', ['tenantId', 'enabled'])
@Entity('tenant_app_install')
export class TenantAppInstallEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'bigint', name: 'version_id', nullable: true })
  versionId?: number | null;

  @Column({ type: 'tinyint', name: 'enabled', default: 1 })
  enabled: number;

  @Column({ type: 'varchar', name: 'source', length: 20, default: 'marketplace' })
  source: TenantAppInstallSource;

  @Column({ type: 'json', name: 'config', nullable: true })
  config?: Record<string, unknown> | null;

  @Column({ type: 'bigint', name: 'installed_by', nullable: true })
  installedBy?: number | null;

  @Column({ type: 'datetime', name: 'installed_time', nullable: true })
  installedTime?: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
