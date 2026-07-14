import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import type {
  AppFactoryManifestDefaults,
  AppFactoryRuntimeTarget,
} from '../app-factory-template-contract';

export type AppFactoryTemplateVisibility = 'platform' | 'tenant' | 'marketplace' | 'private';

@Index('uk_app_factory_template_code_version', ['code', 'templateVersion'], { unique: true })
@Index('idx_app_factory_template_category', ['category'])
@Index('idx_app_factory_template_status', ['status'])
@Entity('app_factory_template')
export class AppFactoryTemplateEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'code', length: 80 })
  code: string;

  @Column({ type: 'int', name: 'schema_version', unsigned: true, default: 1 })
  schemaVersion: number;

  @Column({ type: 'varchar', name: 'template_version', length: 40, default: '1.0.0' })
  templateVersion: string;

  @Column({ type: 'varchar', name: 'runtime_target', length: 20, default: 'static' })
  runtimeTarget: AppFactoryRuntimeTarget;

  @Column({ type: 'json', name: 'manifest_defaults', nullable: true })
  manifestDefaults?: AppFactoryManifestDefaults | null;

  @Column({ type: 'varchar', name: 'name', length: 120 })
  name: string;

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

  @Column({ type: 'varchar', name: 'default_visibility', length: 20, default: 'marketplace' })
  defaultVisibility: AppFactoryTemplateVisibility;

  @Column({ type: 'varchar', name: 'default_saas_module_code', length: 50, default: '' })
  defaultSaasModuleCode: string;

  @Column({ type: 'varchar', name: 'default_system_module_code', length: 80, default: '' })
  defaultSystemModuleCode: string;

  @Column({ type: 'tinyint', name: 'status', default: 1 })
  status: number;

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
