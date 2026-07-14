import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import type {
  AppFactoryManifestDefaults,
  AppFactoryRuntimeTarget,
} from '../app-factory-template-contract';

export type AppFactoryModuleKind = 'static_page';
export type AppFactoryModuleStatus = 'draft' | 'published' | 'disabled' | 'archived';
export type AppFactoryModuleVisibility = 'platform' | 'tenant' | 'marketplace' | 'private';

@Index('uk_app_factory_module_code', ['code'], { unique: true })
@Index('idx_app_factory_module_status', ['status'])
@Index('idx_app_factory_module_kind', ['kind'])
@Entity('app_factory_module')
export class AppFactoryModuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'code', length: 80 })
  code: string;

  @Column({ type: 'varchar', name: 'name', length: 120 })
  name: string;

  @Column({ type: 'varchar', name: 'kind', length: 30, default: 'static_page' })
  kind: AppFactoryModuleKind;

  @Column({ type: 'varchar', name: 'template_code', length: 80, default: '' })
  templateCode: string;

  @Column({ type: 'varchar', name: 'template_version', length: 40, default: '' })
  templateVersion: string;

  @Column({ type: 'int', name: 'template_schema_version', unsigned: true, default: 1 })
  templateSchemaVersion: number;

  @Column({ type: 'varchar', name: 'runtime_target', length: 20, default: 'static' })
  runtimeTarget: AppFactoryRuntimeTarget;

  @Column({ type: 'json', name: 'manifest_defaults', nullable: true })
  manifestDefaults?: AppFactoryManifestDefaults | null;

  @Column({ type: 'varchar', name: 'category', length: 50, default: '' })
  category: string;

  @Column({ type: 'varchar', name: 'icon', length: 100, default: '' })
  icon: string;

  @Column({ type: 'varchar', name: 'summary', length: 255, default: '' })
  summary: string;

  @Column({ type: 'text', name: 'description', nullable: true })
  description?: string | null;

  @Column({ type: 'mediumtext', name: 'html_content', nullable: true })
  htmlContent?: string | null;

  @Column({ type: 'mediumtext', name: 'css_content', nullable: true })
  cssContent?: string | null;

  @Column({ type: 'varchar', name: 'app_code', length: 80, default: '' })
  appCode: string;

  @Column({ type: 'varchar', name: 'status', length: 30, default: 'draft' })
  status: AppFactoryModuleStatus;

  @Column({ type: 'varchar', name: 'visibility', length: 20, default: 'marketplace' })
  visibility: AppFactoryModuleVisibility;

  @Column({ type: 'varchar', name: 'saas_module_code', length: 50, default: '' })
  saasModuleCode: string;

  @Column({ type: 'varchar', name: 'system_module_code', length: 80, default: '' })
  systemModuleCode: string;

  @Column({ type: 'varchar', name: 'latest_version', length: 40, default: '' })
  latestVersion: string;

  @Column({ type: 'datetime', name: 'last_publish_time', nullable: true })
  lastPublishTime?: Date | null;

  @Column({ type: 'bigint', name: 'created_by', nullable: true })
  createdBy?: number | null;

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
