import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { IsNull, Like, Repository } from 'typeorm';

import { PublishAppFactoryModuleDto, SaveAppFactoryModuleDto } from '../dto/app-factory.dto';
import { AppFactoryModuleEntity } from '../entities/app-factory-module.entity';
import { AppFactoryPublishLogEntity } from '../entities/app-factory-publish-log.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppReviewLogEntity } from '../entities/app-review-log.entity';
import { AppPackageStorageService } from './app-package-storage.service';

export interface AppFactoryListQuery {
  keyword?: string;
  status?: string;
}

@Injectable()
export class AppFactoryService {
  constructor(
    @InjectRepository(AppFactoryModuleEntity)
    private readonly factoryRepo: Repository<AppFactoryModuleEntity>,
    @InjectRepository(AppFactoryPublishLogEntity)
    private readonly publishLogRepo: Repository<AppFactoryPublishLogEntity>,
    @InjectRepository(AppPackageEntity)
    private readonly appRepo: Repository<AppPackageEntity>,
    @InjectRepository(AppPackageVersionEntity)
    private readonly versionRepo: Repository<AppPackageVersionEntity>,
    @InjectRepository(AppReviewLogEntity)
    private readonly appReviewLogRepo: Repository<AppReviewLogEntity>,
    private readonly storage: AppPackageStorageService,
  ) {}

  async listModules(query: AppFactoryListQuery = {}) {
    const baseWhere: Record<string, unknown> = { deleteTime: IsNull() };
    if (query.status) baseWhere.status = query.status;
    const where = query.keyword
      ? [
          { ...baseWhere, code: Like(`%${query.keyword}%`) },
          { ...baseWhere, name: Like(`%${query.keyword}%`) },
        ]
      : baseWhere;
    const rows = await this.factoryRepo.find({ where, order: { sort: 'ASC', id: 'ASC' } as any });
    return rows.map((row) => this.toResponse(row));
  }

  async createModule(dto: SaveAppFactoryModuleDto, operatorId?: number) {
    const code = this.requireCode(dto.code);
    const existing = await this.factoryRepo.findOne({ where: { code }, withDeleted: true });
    if (existing) {
      throw new BadRequestException(`Factory module ${code} already exists`);
    }
    const appCode = this.createFactoryAppCode(code);
    const entity = this.factoryRepo.create({
      code,
      name: dto.name,
      kind: dto.kind || 'static_page',
      category: dto.category || '',
      icon: dto.icon || '',
      summary: dto.summary || '',
      description: dto.description || '',
      htmlContent: dto.html_content || '',
      cssContent: dto.css_content || '',
      appCode,
      status: 'draft',
      visibility: dto.visibility || 'marketplace',
      saasModuleCode: dto.saas_module_code || '',
      systemModuleCode: dto.system_module_code || '',
      createdBy: operatorId ?? null,
      sort: dto.sort ?? 100,
      remark: dto.remark || '',
    });
    return this.toResponse(await this.factoryRepo.save(entity));
  }

  async updateModule(code: string, dto: SaveAppFactoryModuleDto) {
    const entity = await this.findFactoryModule(code);
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.kind !== undefined) entity.kind = dto.kind;
    if (dto.category !== undefined) entity.category = dto.category;
    if (dto.icon !== undefined) entity.icon = dto.icon;
    if (dto.summary !== undefined) entity.summary = dto.summary;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.html_content !== undefined) entity.htmlContent = dto.html_content;
    if (dto.css_content !== undefined) entity.cssContent = dto.css_content;
    if (dto.visibility !== undefined) entity.visibility = dto.visibility;
    if (dto.saas_module_code !== undefined) entity.saasModuleCode = dto.saas_module_code;
    if (dto.system_module_code !== undefined) entity.systemModuleCode = dto.system_module_code;
    if (dto.sort !== undefined) entity.sort = Number(dto.sort);
    if (dto.remark !== undefined) entity.remark = dto.remark;
    return this.toResponse(await this.factoryRepo.save(entity));
  }

  async getModule(code: string) {
    return this.toResponse(await this.findFactoryModule(code));
  }

  async publishModule(code: string, dto: PublishAppFactoryModuleDto, operatorId?: number) {
    const factory = await this.findFactoryModule(code);
    const version = this.safeVersion(dto.version);
    const appCode = factory.appCode || this.createFactoryAppCode(factory.code);
    this.assertSafeStaticPage(factory.htmlContent || '', factory.cssContent || '');

    let app = await this.appRepo.findOne({ where: { code: appCode, deleteTime: IsNull() } });
    if (!app) {
      app = this.appRepo.create({
        code: appCode,
        name: factory.name,
        type: 'static',
        category: factory.category || '',
        icon: factory.icon || '',
        summary: factory.summary || '',
        description: factory.description || '',
        developerId: factory.createdBy ?? null,
        developerName: 'Module Factory',
        status: 'published',
        visibility: factory.visibility || 'marketplace',
        entryMode: 'static',
        entryUrl: '',
        systemModuleCode: factory.systemModuleCode || '',
        saasModuleCode: factory.saasModuleCode || '',
        sort: factory.sort ?? 100,
        remark: factory.remark || '',
      });
    } else {
      app.name = factory.name;
      app.type = 'static';
      app.category = factory.category || '';
      app.icon = factory.icon || '';
      app.summary = factory.summary || '';
      app.description = factory.description || '';
      app.developerName = app.developerName || 'Module Factory';
      app.status = 'published';
      app.visibility = factory.visibility || 'marketplace';
      app.entryMode = 'static';
      app.systemModuleCode = factory.systemModuleCode || '';
      app.saasModuleCode = factory.saasModuleCode || '';
      app.sort = factory.sort ?? 100;
      app.remark = factory.remark || '';
    }
    let savedApp = await this.appRepo.save(app);

    const existingVersion = await this.versionRepo.findOne({
      where: { appId: savedApp.id, version, deleteTime: IsNull() },
    });
    if (existingVersion) {
      throw new BadRequestException(`App version ${version} already exists`);
    }

    const sourceDir = this.storage.resolvePackagePath(appCode, version);
    const html = this.renderStaticPage(factory);
    fs.rmSync(sourceDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(sourceDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'dist', 'index.html'), html, 'utf8');

    const published = await this.storage.publishVersion({
      appCode,
      version,
      sourceDir,
      entryFile: 'dist/index.html',
    });

    savedApp.entryUrl = published.entryUrl;
    savedApp.status = 'published';
    savedApp = await this.appRepo.save(savedApp);

    const appVersion = await this.versionRepo.save(
      this.versionRepo.create({
        appId: savedApp.id,
        version,
        manifest: {
          code: appCode,
          name: factory.name,
          version,
          type: 'static',
          entry: 'dist/index.html',
          factory_code: factory.code,
        },
        packagePath: sourceDir,
        publishPath: published.publishPath,
        entryFile: 'dist/index.html',
        fileHash: createHash('sha256').update(html).digest('hex'),
        fileSize: Buffer.byteLength(html),
        reviewStatus: 'approved',
        publishStatus: 'published',
        reviewMessage: dto.message || 'Published from module factory',
        reviewerId: operatorId ?? null,
        reviewTime: new Date(),
      } as Partial<AppPackageVersionEntity>) as AppPackageVersionEntity,
    );

    await this.appReviewLogRepo.save(
      this.appReviewLogRepo.create({
        appId: savedApp.id,
        versionId: appVersion.id,
        action: 'publish',
        message: dto.message || `Published factory module ${factory.code}`,
        operatorId: operatorId ?? null,
        metadata: { factory_code: factory.code },
      }),
    );

    factory.status = 'published';
    factory.appCode = appCode;
    factory.latestVersion = version;
    factory.lastPublishTime = new Date();
    const savedFactory = await this.factoryRepo.save(factory);

    await this.publishLogRepo.save(
      this.publishLogRepo.create({
        factoryId: savedFactory.id,
        appId: savedApp.id,
        versionId: appVersion.id,
        version,
        action: 'publish',
        message: dto.message || `Published ${appCode}@${version}`,
        operatorId: operatorId ?? null,
        metadata: { entry_url: published.entryUrl },
      }),
    );

    return { ...this.toResponse(savedFactory), entry_url: published.entryUrl };
  }

  private async findFactoryModule(code: string) {
    const entity = await this.factoryRepo.findOne({ where: { code, deleteTime: IsNull() } });
    if (!entity) {
      throw new NotFoundException(`Factory module ${code} not found`);
    }
    return entity;
  }

  private requireCode(value?: string) {
    const code = String(value || '').trim();
    if (!/^[a-z][a-z0-9_]{2,79}$/.test(code)) {
      throw new BadRequestException('Factory module code is required');
    }
    return code;
  }

  private createFactoryAppCode(code: string) {
    const appCode = `factory_${code}`;
    if (!/^[a-z][a-z0-9_]{2,79}$/.test(appCode)) {
      throw new BadRequestException('Factory app code is too long');
    }
    return appCode;
  }

  private safeVersion(value: string) {
    const version = String(value || '').trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      throw new BadRequestException('Invalid app version');
    }
    return version;
  }

  private assertSafeStaticPage(html: string, css: string) {
    const combined = `${html}\n${css}`;
    if (/<\s*script\b/i.test(combined)) {
      throw new BadRequestException('Factory page HTML contains unsafe script');
    }
    if (/\son[a-z]+\s*=/i.test(combined)) {
      throw new BadRequestException('Factory page HTML contains unsafe event handler');
    }
    if (/javascript\s*:/i.test(combined)) {
      throw new BadRequestException('Factory page HTML contains unsafe javascript URL');
    }
    if (/<\s*\/\s*style\s*>/i.test(css)) {
      throw new BadRequestException('Factory page CSS contains unsafe style terminator');
    }
  }

  private renderStaticPage(factory: Partial<AppFactoryModuleEntity>) {
    const title = this.escapeText(factory.name || factory.code || 'Factory App');
    const css = factory.cssContent || '';
    const html = factory.htmlContent || '<main><p>This factory page is empty.</p></main>';
    return [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      `<title>${title}</title>`,
      '<style>',
      'body{margin:0;font-family:Arial,sans-serif;color:#1f2937;background:#f8fafc;}',
      '.factory-page{max-width:1120px;margin:0 auto;padding:32px;}',
      css,
      '</style>',
      '</head>',
      '<body>',
      '<div class="factory-page">',
      html,
      '</div>',
      '</body>',
      '</html>',
    ].join('\n');
  }

  private escapeText(value: string) {
    return String(value).replace(/[&<>"']/g, (char) => {
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return map[char] || char;
    });
  }

  private toResponse(row: Partial<AppFactoryModuleEntity>) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      kind: row.kind || 'static_page',
      category: row.category || '',
      icon: row.icon || '',
      summary: row.summary || '',
      description: row.description || '',
      html_content: row.htmlContent || '',
      css_content: row.cssContent || '',
      app_code: row.appCode || '',
      status: row.status || 'draft',
      visibility: row.visibility || 'marketplace',
      saas_module_code: row.saasModuleCode || '',
      system_module_code: row.systemModuleCode || '',
      latest_version: row.latestVersion || '',
      last_publish_time: row.lastPublishTime,
      created_by: row.createdBy ?? null,
      sort: Number(row.sort) || 0,
      remark: row.remark || '',
      create_time: row.createTime,
      update_time: row.updateTime,
    };
  }
}
