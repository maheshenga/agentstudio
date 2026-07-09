import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import JSZip from 'jszip';
import * as path from 'path';
import { IsNull, Repository } from 'typeorm';

import { CreateAppPackageDto, UpdateAppPackageDto } from '../dto/app-platform.dto';
import { AppPackageEntity, AppPackageStatus, AppPackageType } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppReviewAction, AppReviewLogEntity } from '../entities/app-review-log.entity';
import { AppManifestService } from './app-manifest.service';
import { AppPackageStorageService } from './app-package-storage.service';

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
    private readonly storage: AppPackageStorageService,
    private readonly manifestService: AppManifestService,
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

  async uploadStaticVersion(code: string, file: Express.Multer.File, operatorId?: number) {
    const app = await this.findApp(code);
    if (app.type !== 'static') {
      throw new BadRequestException('Only static apps can upload packages');
    }
    if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('App package file is required');
    }

    const zip = await this.loadZip(file.buffer);
    const zipFiles = Object.values(zip.files).filter((zipFile) => !zipFile.dir);
    const entries = zipFiles.map((zipFile) => this.getZipEntryName(zipFile));
    const manifestFile = zipFiles.find((zipFile) => this.normalizeZipEntryName(this.getZipEntryName(zipFile)) === 'manifest.json');
    if (!manifestFile) {
      throw new BadRequestException('App manifest not found');
    }

    const manifestPayload = await this.readManifestJson(manifestFile);
    const manifest = this.manifestService.validateStaticManifest({
      manifest: manifestPayload,
      entries,
    });
    if (manifest.code !== code) {
      throw new BadRequestException('Manifest code does not match app code');
    }

    const existingVersion = await this.versionRepo.findOne({
      where: { appId: app.id, version: manifest.version },
      withDeleted: true,
    } as any);
    if (existingVersion) {
      throw new BadRequestException(`App version ${manifest.version} already exists`);
    }

    const extracted = await this.storage.extractStaticPackage({
      appCode: code,
      version: manifest.version,
      zipBuffer: file.buffer,
    });
    const versionEntity = this.versionRepo.create({
      appId: app.id,
      version: manifest.version,
      manifest: manifest as unknown as Record<string, unknown>,
      packagePath: extracted.packagePath,
      publishPath: '',
      entryFile: manifest.entry,
      fileHash: createHash('sha256').update(file.buffer).digest('hex'),
      fileSize: file.size || file.buffer.length,
      reviewStatus: 'pending',
      publishStatus: 'unpublished',
      reviewMessage: '',
    } as Partial<AppPackageVersionEntity>) as AppPackageVersionEntity;
    const savedVersion = await this.versionRepo.save(versionEntity);

    app.name = manifest.name || app.name;
    app.category = manifest.category || app.category;
    app.icon = manifest.icon || app.icon;
    app.summary = manifest.summary || app.summary;
    app.description = manifest.description || app.description;
    app.status = 'pending_review';
    app.entryMode = 'static';
    await this.appRepo.save(app);
    await this.recordAppEvent(app.id, savedVersion.id, 'submit', `Uploaded version ${manifest.version} for review`, operatorId, {
      fileHash: savedVersion.fileHash,
      fileSize: savedVersion.fileSize,
    });

    return this.toVersionResponse(savedVersion);
  }

  async submitVersion(code: string, version: string, operatorId?: number) {
    const app = await this.findApp(code);
    const appVersion = await this.findVersion(app.id, version);
    appVersion.reviewStatus = 'pending';
    app.status = 'pending_review';
    const savedVersion = await this.versionRepo.save(appVersion);
    await this.appRepo.save(app);
    await this.recordAppEvent(app.id, appVersion.id, 'submit', `Submitted version ${version} for review`, operatorId);
    return this.toVersionResponse(savedVersion);
  }

  async approveVersion(code: string, version: string, message = '', operatorId?: number) {
    const app = await this.findApp(code);
    const appVersion = await this.findVersion(app.id, version);
    if (appVersion.reviewStatus !== 'pending') {
      throw new BadRequestException('Only pending versions can be approved');
    }

    appVersion.reviewStatus = 'approved';
    appVersion.reviewMessage = message || '';
    appVersion.reviewerId = operatorId ?? null;
    appVersion.reviewTime = new Date();
    app.status = 'approved';

    const savedVersion = await this.versionRepo.save(appVersion);
    await this.appRepo.save(app);
    await this.recordAppEvent(app.id, appVersion.id, 'approve', message || `Approved version ${version}`, operatorId);
    return this.toVersionResponse(savedVersion);
  }

  async rejectVersion(code: string, version: string, message = '', operatorId?: number) {
    const app = await this.findApp(code);
    const appVersion = await this.findVersion(app.id, version);
    if (appVersion.reviewStatus !== 'pending') {
      throw new BadRequestException('Only pending versions can be rejected');
    }

    appVersion.reviewStatus = 'rejected';
    appVersion.reviewMessage = message || '';
    appVersion.reviewerId = operatorId ?? null;
    appVersion.reviewTime = new Date();
    app.status = 'rejected';

    const savedVersion = await this.versionRepo.save(appVersion);
    await this.appRepo.save(app);
    await this.recordAppEvent(app.id, appVersion.id, 'reject', message || `Rejected version ${version}`, operatorId);
    return this.toVersionResponse(savedVersion);
  }

  async publishVersion(code: string, version: string, operatorId?: number) {
    const app = await this.findApp(code);
    const appVersion = await this.findVersion(app.id, version);
    if (appVersion.reviewStatus !== 'approved') {
      throw new BadRequestException('Only approved versions can be published');
    }

    const published = await this.storage.publishVersion({
      appCode: code,
      version,
      sourceDir: appVersion.packagePath,
      entryFile: appVersion.entryFile,
    });

    appVersion.publishStatus = 'published';
    appVersion.publishPath = published.publishPath;
    app.status = 'published';
    app.entryUrl = published.entryUrl;
    app.entryMode = 'static';

    const savedVersion = await this.versionRepo.save(appVersion);
    await this.appRepo.save(app);
    await this.recordAppEvent(app.id, appVersion.id, 'publish', `Published version ${version}`, operatorId, {
      entryUrl: published.entryUrl,
    });
    return this.toVersionResponse(savedVersion);
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

  private async findVersion(appId: number, version: string) {
    const appVersion = await this.versionRepo.findOne({ where: { appId, version, deleteTime: IsNull() } });
    if (!appVersion) {
      throw new NotFoundException(`App version ${version} not found`);
    }
    return appVersion;
  }

  private async loadZip(buffer: Buffer) {
    try {
      return await JSZip.loadAsync(buffer);
    } catch {
      throw new BadRequestException('Invalid app package zip');
    }
  }

  private async readManifestJson(zipFile: JSZip.JSZipObject) {
    try {
      return JSON.parse(await zipFile.async('string')) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid app manifest json');
    }
  }

  private normalizeZipEntryName(value: string) {
    const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const resolved = path.posix.normalize(normalized);
    if (!resolved || resolved === '.' || resolved.startsWith('../') || resolved.includes('/../') || path.posix.isAbsolute(resolved)) {
      throw new BadRequestException('Invalid app entry');
    }
    return resolved;
  }

  private getZipEntryName(zipFile: JSZip.JSZipObject) {
    return String((zipFile as any).unsafeOriginalName || zipFile.name || '');
  }

  private async recordAppEvent(
    appId: number,
    versionId: number | null,
    action: AppReviewAction,
    message: string,
    operatorId?: number,
    metadata?: Record<string, unknown>,
  ) {
    return this.reviewLogRepo.save(
      this.reviewLogRepo.create({
        appId,
        versionId,
        action,
        message,
        operatorId,
        metadata,
      }),
    );
  }

  private toVersionResponse(version: Partial<AppPackageVersionEntity>) {
    return {
      id: version.id,
      app_id: version.appId,
      version: version.version,
      manifest: version.manifest || null,
      package_path: version.packagePath || '',
      publish_path: version.publishPath || '',
      entry_file: version.entryFile || '',
      file_hash: version.fileHash || '',
      file_size: Number(version.fileSize) || 0,
      review_status: version.reviewStatus,
      publish_status: version.publishStatus,
      review_message: version.reviewMessage || '',
      reviewer_id: version.reviewerId ?? null,
      review_time: version.reviewTime,
      create_time: version.createTime,
      update_time: version.updateTime,
    };
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
