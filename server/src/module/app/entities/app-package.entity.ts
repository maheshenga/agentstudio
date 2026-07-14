import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AppPackageType = 'internal' | 'static' | 'iframe' | 'service';
export type AppPackageStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'disabled'
  | 'archived';
export type AppPackageVisibility = 'platform' | 'tenant' | 'marketplace' | 'private';
export type AppPackageEntryMode = 'internal_route' | 'static' | 'iframe' | 'service' | 'new_window';
export type AppRuntimeType = 'static' | 'iframe' | 'service' | 'native';
export type AppTrustLevel =
  | 'platform_trusted'
  | 'developer_restricted'
  | 'external_managed'
  | 'static_sandboxed';

@Index('uk_app_package_code', ['code'], { unique: true })
@Index('idx_app_package_status', ['status'])
@Index('idx_app_package_type', ['type'])
@Entity('app_package')
export class AppPackageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'code', length: 80 })
  code: string;

  @Column({ type: 'varchar', name: 'name', length: 120 })
  name: string;

  @Column({ type: 'varchar', name: 'type', length: 20 })
  type: AppPackageType;

  @Column({ type: 'varchar', name: 'category', length: 50, default: '' })
  category: string;

  @Column({ type: 'varchar', name: 'icon', length: 100, default: '' })
  icon: string;

  @Column({ type: 'varchar', name: 'summary', length: 255, default: '' })
  summary: string;

  @Column({ type: 'text', name: 'description', nullable: true })
  description?: string | null;

  @Column({ type: 'bigint', name: 'developer_id', nullable: true })
  developerId?: number | null;

  @Column({ type: 'varchar', name: 'developer_name', length: 100, default: '' })
  developerName: string;

  @Column({ type: 'varchar', name: 'status', length: 30, default: 'draft' })
  status: AppPackageStatus;

  @Column({ type: 'varchar', name: 'visibility', length: 20, default: 'marketplace' })
  visibility: AppPackageVisibility;

  @Column({ type: 'varchar', name: 'entry_mode', length: 30, default: 'iframe' })
  entryMode: AppPackageEntryMode;

  @Column({ type: 'varchar', name: 'entry_url', length: 500, default: '' })
  entryUrl: string;

  @Column({ type: 'varchar', name: 'runtime_type', length: 20, default: 'static' })
  runtimeType: AppRuntimeType;

  @Column({ type: 'varchar', name: 'trust_level', length: 30, default: 'static_sandboxed' })
  trustLevel: AppTrustLevel;

  @Column({ type: 'varchar', name: 'service_health_path', length: 255, default: '' })
  serviceHealthPath: string;

  @Column({ type: 'json', name: 'runtime_config', nullable: true })
  runtimeConfig?: Record<string, unknown> | null;

  @Column({ type: 'json', name: 'screenshots', nullable: true })
  screenshots?: string[] | null;

  @Column({ type: 'varchar', name: 'documentation_url', length: 500, default: '' })
  documentationUrl: string;

  @Column({ type: 'varchar', name: 'support_url', length: 500, default: '' })
  supportUrl: string;

  @Column({ type: 'text', name: 'changelog', nullable: true })
  changelog?: string | null;

  @Column({ type: 'varchar', name: 'system_module_code', length: 80, default: '' })
  systemModuleCode: string;

  @Column({ type: 'varchar', name: 'saas_module_code', length: 50, default: '' })
  saasModuleCode: string;

  @Column({ type: 'int', name: 'sort', default: 100 })
  sort: number;

  @Column({ type: 'varchar', name: 'remark', length: 255, nullable: true })
  remark?: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
