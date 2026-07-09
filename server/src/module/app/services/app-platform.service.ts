import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { CreateAppPackageDto, UpdateAppPackageDto } from '../dto/app-platform.dto';
import { AppPackageEntity, AppPackageStatus, AppPackageType } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppReviewAction, AppReviewLogEntity } from '../entities/app-review-log.entity';

export interface AppPlatformListQuery {
  keyword?: string;
  type?: AppPackageType;
  status?: AppPackageStatus;
}

@Injectable()
export class AppPlatformService {
  constructor(
    @InjectRepository(AppPackageEntity)
    private readonly appRepo: Repository<AppPackageEntity>,
    @InjectRepository(AppPackageVersionEntity)
    private readonly versionRepo: Repository<AppPackageVersionEntity>,
    @InjectRepository(AppReviewLogEntity)
    private readonly reviewLogRepo: Repository<AppReviewLogEntity>,
  ) {}

  async listApps(query: AppPlatformListQuery = {}) {
    const apps = await this.appRepo.find({ where: { deleteTime: IsNull() }, order: { sort: 'ASC', id: 'ASC' } });
    const keyword = query.keyword?.trim().toLowerCase();

    return apps
      .filter((app) => {
        if (query.type && app.type !== query.type) return false;
        if (query.status && app.status !== query.status) return false;
        if (!keyword) return true;
        return [app.code, app.name, app.category, app.summary].some((value) =>
          String(value || '').toLowerCase().includes(keyword),
        );
      })
      .map((app) => this.toResponse(app));
  }

  async createApp(dto: CreateAppPackageDto, operatorId?: number) {
    const code = dto.code.trim();
    const existing = await this.appRepo.findOne({ where: { code }, withDeleted: true });
    if (existing) {
      throw new BadRequestException(`App ${code} already exists`);
    }

    const app = this.appRepo.create({
      code,
      name: dto.name,
      type: dto.type,
      category: dto.category || '',
      icon: dto.icon || '',
      summary: dto.summary || '',
      description: dto.description || '',
      developerId: operatorId ?? null,
      developerName: dto.developer_name || '',
      status: dto.type === 'static' ? 'draft' : 'published',
      visibility: dto.visibility || 'marketplace',
      entryMode: this.resolveEntryMode(dto.type),
      entryUrl: dto.entry_url || '',
      systemModuleCode: dto.system_module_code || '',
      saasModuleCode: dto.saas_module_code || '',
      sort: dto.sort ?? 100,
      remark: dto.remark || '',
    });

    return this.toResponse(await this.appRepo.save(app));
  }

  async updateApp(code: string, dto: UpdateAppPackageDto) {
    const app = await this.findApp(code);
    if (dto.name !== undefined) app.name = dto.name;
    if (dto.category !== undefined) app.category = dto.category;
    if (dto.icon !== undefined) app.icon = dto.icon;
    if (dto.summary !== undefined) app.summary = dto.summary;
    if (dto.description !== undefined) app.description = dto.description;
    if (dto.visibility !== undefined) app.visibility = dto.visibility;
    if (dto.entry_url !== undefined) app.entryUrl = dto.entry_url;
    if (dto.developer_name !== undefined) app.developerName = dto.developer_name;
    if (dto.system_module_code !== undefined) app.systemModuleCode = dto.system_module_code;
    if (dto.saas_module_code !== undefined) app.saasModuleCode = dto.saas_module_code;
    if (dto.sort !== undefined) app.sort = Number(dto.sort);
    if (dto.remark !== undefined) app.remark = dto.remark;

    return this.toResponse(await this.appRepo.save(app));
  }

  async updateStatus(code: string, status: AppPackageStatus, operatorId?: number) {
    const app = await this.findApp(code);
    if (app.status === status) {
      return this.toResponse(app);
    }

    app.status = status;
    const saved = await this.appRepo.save(app);
    await this.recordAppEvent(saved.id, null, this.statusToAction(status), `App ${code} status changed to ${status}`, operatorId);
    return this.toResponse(saved);
  }

  async getApp(code: string) {
    const app = await this.findApp(code);
    const versions = await this.versionRepo.find({ where: { appId: app.id, deleteTime: IsNull() }, order: { id: 'DESC' } });
    return {
      ...this.toResponse(app),
      versions: versions.map((version) => ({
        id: version.id,
        version: version.version,
        review_status: version.reviewStatus,
        publish_status: version.publishStatus,
        entry_file: version.entryFile,
        create_time: version.createTime,
      })),
    };
  }

  private resolveEntryMode(type: AppPackageType) {
    if (type === 'internal') return 'internal_route';
    if (type === 'static') return 'static';
    return 'iframe';
  }

  private statusToAction(status: AppPackageStatus): AppReviewAction {
    if (status === 'disabled') return 'disable';
    if (status === 'archived') return 'archive';
    if (status === 'rejected') return 'reject';
    if (status === 'approved') return 'approve';
    if (status === 'published') return 'publish';
    return 'submit';
  }

  private async findApp(code: string) {
    const app = await this.appRepo.findOne({ where: { code, deleteTime: IsNull() } });
    if (!app) {
      throw new NotFoundException(`App ${code} not found`);
    }
    return app;
  }

  private async recordAppEvent(
    appId: number,
    versionId: number | null,
    action: AppReviewAction,
    message: string,
    operatorId?: number,
  ) {
    return this.reviewLogRepo.save(
      this.reviewLogRepo.create({
        appId,
        versionId,
        action,
        message,
        operatorId,
      }),
    );
  }

  private toResponse(app: Partial<AppPackageEntity>) {
    return {
      id: app.id,
      code: app.code,
      name: app.name,
      type: app.type,
      category: app.category || '',
      icon: app.icon || '',
      summary: app.summary || '',
      description: app.description || '',
      developer_id: app.developerId ?? null,
      developer_name: app.developerName || '',
      status: app.status,
      visibility: app.visibility || 'marketplace',
      entry_mode: app.entryMode || '',
      entry_url: app.entryUrl || '',
      system_module_code: app.systemModuleCode || '',
      saas_module_code: app.saasModuleCode || '',
      sort: Number(app.sort) || 0,
      remark: app.remark || '',
      create_time: app.createTime,
      update_time: app.updateTime,
    };
  }
}
