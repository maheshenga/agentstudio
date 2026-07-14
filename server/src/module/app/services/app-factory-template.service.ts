import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Like, Repository } from 'typeorm';

import type { AppFactoryTemplateListQueryDto } from '../dto/app-factory.dto';
import { AppFactoryTemplateEntity } from '../entities/app-factory-template.entity';

@Injectable()
export class AppFactoryTemplateService {
  constructor(
    @InjectRepository(AppFactoryTemplateEntity)
    private readonly templateRepo: Repository<AppFactoryTemplateEntity>,
  ) {}

  async listTemplates(query: AppFactoryTemplateListQueryDto = {}) {
    const baseWhere: Record<string, unknown> = {
      deleteTime: IsNull(),
      status: query.status === undefined || query.status === '' ? 1 : Number(query.status),
    };
    if (query.category) baseWhere.category = query.category;
    const where = query.keyword
      ? [
          { ...baseWhere, code: Like(`%${query.keyword}%`) },
          { ...baseWhere, name: Like(`%${query.keyword}%`) },
        ]
      : baseWhere;
    const rows = await this.templateRepo.find({ where, order: { sort: 'ASC', id: 'ASC' } as any });
    return rows.map((row) => this.toResponse(row));
  }

  async getTemplate(code: string, templateVersion?: string) {
    const entity = await this.templateRepo.findOne({
      where: {
        code,
        ...(templateVersion ? { templateVersion } : {}),
        status: 1,
        deleteTime: IsNull(),
      },
      order: templateVersion ? undefined : ({ id: 'DESC' } as any),
    });
    if (!entity) {
      throw new NotFoundException(`Factory template ${code} not found`);
    }
    return this.toResponse(entity);
  }

  private toResponse(row: Partial<AppFactoryTemplateEntity>) {
    return {
      id: row.id,
      code: row.code,
      schema_version: Number(row.schemaVersion ?? 1),
      template_version: row.templateVersion || '1.0.0',
      runtime_target: row.runtimeTarget || 'static',
      manifest_defaults: row.manifestDefaults || {},
      name: row.name,
      category: row.category || '',
      icon: row.icon || '',
      summary: row.summary || '',
      description: row.description || '',
      html_content: row.htmlContent || '',
      css_content: row.cssContent || '',
      default_visibility: row.defaultVisibility || 'marketplace',
      default_saas_module_code: row.defaultSaasModuleCode || '',
      default_system_module_code: row.defaultSystemModuleCode || '',
      status: Number(row.status ?? 1),
      sort: Number(row.sort) || 0,
      remark: row.remark || '',
      create_time: row.createTime,
      update_time: row.updateTime,
    };
  }
}
