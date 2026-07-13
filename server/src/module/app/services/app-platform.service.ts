import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import JSZip from 'jszip';
import * as path from 'path';
import { DataSource, In, IsNull, Repository } from 'typeorm';

import { normalizeExternalHttpUrl } from '../../../common/utils/safe-url.util';
import { normalizeAppCapabilities, normalizeApprovedCapabilities } from '../app-runtime.constants';
import { CreateAppPackageDto, UpdateAppPackageDto } from '../dto/app-platform.dto';
import { AppCapabilityGrantEntity } from '../entities/app-capability-grant.entity';
import { AppDeveloperProfileEntity } from '../entities/app-developer-profile.entity';
import {
  AppPackageEntity,
  AppPackageStatus,
  AppPackageType,
  type AppTrustLevel,
} from '../entities/app-package.entity';
import {
  AppPackageVersionEntity,
  AppVersionPublishStatus,
  AppVersionReviewStatus,
} from '../entities/app-package-version.entity';
import { AppReviewAction, AppReviewLogEntity } from '../entities/app-review-log.entity';
import { AppManifestService, type StaticAppManifest } from './app-manifest.service';
import { AppCapabilityPolicyService } from './app-capability-policy.service';
import { AppDeveloperCertificationService } from './app-developer-certification.service';
import { AppPackageStorageService } from './app-package-storage.service';
import { AppReviewSnapshotService } from './app-review-snapshot.service';
import { AppRuntimeSessionService } from './app-runtime-session.service';
import { AppServicePackageService } from './app-service-package.service';
import { AppServiceRuntimeService } from './app-service-runtime.service';

export interface AppPlatformListQuery {
  keyword?: string;
  type?: AppPackageType;
  status?: AppPackageStatus;
}

export interface AppReviewQueueQuery {
  keyword?: string;
  type?: AppPackageType;
  review_status?: AppVersionReviewStatus;
  publish_status?: AppVersionPublishStatus;
}

const APP_STATUS_TRANSITIONS: Record<AppPackageStatus, readonly AppPackageStatus[]> = {
  draft: ['archived'],
  pending_review: ['archived'],
  approved: ['archived'],
  published: ['disabled'],
  rejected: ['archived'],
  disabled: ['published', 'archived'],
  archived: [],
};

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
    private readonly reviewSnapshotService: AppReviewSnapshotService,
    private readonly servicePackageService: AppServicePackageService,
    private readonly serviceRuntimeService: AppServiceRuntimeService,
    private readonly capabilityPolicy: AppCapabilityPolicyService,
    private readonly dataSource: DataSource,
    private readonly runtimeSessionService: AppRuntimeSessionService,
    private readonly certificationService: AppDeveloperCertificationService,
  ) {}

  async listApps(query: AppPlatformListQuery = {}) {
    const apps = await this.appRepo.find({
      where: { deleteTime: IsNull() },
      order: { sort: 'ASC', id: 'ASC' },
    });
    const keyword = query.keyword?.trim().toLowerCase();

    return apps
      .filter((app) => {
        if (query.type && app.type !== query.type) return false;
        if (query.status && app.status !== query.status) return false;
        if (!keyword) return true;
        return [app.code, app.name, app.category, app.summary].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(keyword),
        );
      })
      .map((app) => this.toResponse(app));
  }

  async listDeveloperApps(developerId: number) {
    const apps = await this.appRepo.find({
      where: { developerId, deleteTime: IsNull() },
      order: { sort: 'ASC', id: 'ASC' },
    });
    const appIds = apps.map((app) => Number(app.id)).filter(Boolean);
    const versions = appIds.length
      ? await this.versionRepo.find({
          where: { appId: In(appIds), deleteTime: IsNull() } as any,
          order: { id: 'DESC' },
        })
      : [];
    const latestVersionByAppId = new Map<number, AppPackageVersionEntity>();
    for (const version of versions) {
      const appId = Number(version.appId);
      if (!latestVersionByAppId.has(appId)) {
        latestVersionByAppId.set(appId, version);
      }
    }

    return apps.map((app) => {
      const latest = latestVersionByAppId.get(Number(app.id));
      return {
        ...this.toResponse(app),
        latest_version: latest?.version || '',
        latest_review_status: latest?.reviewStatus || '',
        latest_publish_status: latest?.publishStatus || '',
        latest_review_message: latest?.reviewMessage || '',
      };
    });
  }

  async listReviewQueue(query: AppReviewQueueQuery = {}) {
    const versions = await this.versionRepo.find({
      where: { deleteTime: IsNull() },
      order: { id: 'DESC' },
    });
    const appIds = [...new Set(versions.map((version) => Number(version.appId)).filter(Boolean))];
    if (!appIds.length) return [];

    const apps = await this.appRepo.find({
      where: { id: In(appIds), deleteTime: IsNull() } as any,
    });
    const appById = new Map(apps.map((app) => [Number(app.id), app]));
    const keyword = String(query.keyword || '')
      .trim()
      .toLowerCase();

    return versions
      .map((version) => {
        const app = appById.get(Number(version.appId));
        if (!app) return null;
        return this.toReviewQueueResponse(app, version);
      })
      .filter((record): record is NonNullable<typeof record> => Boolean(record))
      .filter((record) => {
        if (query.type && record.app_type !== query.type) return false;
        if (query.review_status && record.review_status !== query.review_status) return false;
        if (query.publish_status && record.publish_status !== query.publish_status) return false;
        if (!keyword) return true;
        return [
          record.app_code,
          record.app_name,
          record.category,
          record.developer_name,
          record.version,
          record.review_message,
        ].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(keyword),
        );
      });
  }

  async createApp(
    dto: CreateAppPackageDto,
    operatorId?: number,
    options?: { trustLevel?: AppTrustLevel },
  ) {
    const code = dto.code.trim();
    const existing = await this.appRepo.findOne({ where: { code }, withDeleted: true });
    if (existing) {
      throw new BadRequestException(`App ${code} already exists`);
    }

    const iframeRuntime =
      dto.type === 'iframe'
        ? this.normalizeIframeRuntime(dto.entry_url || '', dto.allowed_origins)
        : null;
    const iframeCapabilities =
      dto.type === 'iframe' ? normalizeApprovedCapabilities(dto.requested_capabilities) : [];
    if (
      dto.type !== 'iframe' &&
      (dto.allowed_origins !== undefined ||
        dto.version !== undefined ||
        dto.requested_capabilities !== undefined)
    ) {
      throw new BadRequestException('Iframe version settings require an iframe app');
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
      status: dto.type === 'static' || dto.type === 'service' ? 'draft' : 'published',
      visibility: dto.visibility || 'marketplace',
      entryMode: this.resolveEntryMode(dto.type),
      entryUrl: iframeRuntime?.entryUrl || this.normalizeEntryUrl(dto.type, dto.entry_url || ''),
      runtimeType: this.runtimeType(dto.type),
      trustLevel: options?.trustLevel ?? this.trustLevel(dto.type),
      serviceHealthPath: dto.type === 'service' ? '/health' : '',
      runtimeConfig: null,
      systemModuleCode: dto.system_module_code || '',
      saasModuleCode: dto.saas_module_code || '',
      sort: dto.sort ?? 100,
      remark: dto.remark || '',
    });

    if (!iframeRuntime) return this.toResponse(await this.appRepo.save(app));

    return this.dataSource.transaction(async (manager) => {
      const savedApp = await manager.getRepository(AppPackageEntity).save(app);
      const versionRepo = manager.getRepository(AppPackageVersionEntity);
      const version = versionRepo.create(
        this.createIframeVersion({
          app: savedApp,
          version: dto.version || '1.0.0',
          entryUrl: iframeRuntime.entryUrl,
          allowedOrigins: iframeRuntime.allowedOrigins,
          capabilities: iframeCapabilities,
          operatorId,
        }),
      );
      const savedVersion = await versionRepo.save(version);
      await this.capabilityPolicy.approvePlatformCapabilities(
        {
          appId: savedApp.id,
          versionId: savedVersion.id,
          requestedCapabilities: iframeCapabilities,
          approvedCapabilities: iframeCapabilities,
          operatorId,
        },
        manager.getRepository(AppCapabilityGrantEntity),
      );
      return this.toResponse(savedApp);
    });
  }

  async updateApp(code: string, dto: UpdateAppPackageDto) {
    const app = await this.findApp(code);
    const iframeRuntimeChanged =
      app.type === 'iframe' &&
      (dto.entry_url !== undefined ||
        dto.allowed_origins !== undefined ||
        dto.version !== undefined ||
        dto.requested_capabilities !== undefined);
    if (
      app.type !== 'iframe' &&
      (dto.allowed_origins !== undefined ||
        dto.version !== undefined ||
        dto.requested_capabilities !== undefined)
    ) {
      throw new BadRequestException('Iframe version settings require an iframe app');
    }
    if (iframeRuntimeChanged && !dto.version) {
      throw new BadRequestException('Iframe runtime updates require a new version');
    }
    const latestIframeVersion = iframeRuntimeChanged
      ? await this.versionRepo.findOne({
          where: {
            appId: app.id,
            reviewStatus: 'approved',
            publishStatus: 'published',
            deleteTime: IsNull(),
          },
          order: { id: 'DESC' },
        })
      : null;
    const previousOrigins = Array.isArray(latestIframeVersion?.manifest?.allowedOrigins)
      ? latestIframeVersion.manifest.allowedOrigins.filter(
          (value): value is string => typeof value === 'string',
        )
      : undefined;
    const iframeRuntime = iframeRuntimeChanged
      ? this.normalizeIframeRuntime(
          dto.entry_url ?? app.entryUrl,
          dto.allowed_origins ?? previousOrigins,
        )
      : null;
    const iframeCapabilities = iframeRuntimeChanged
      ? dto.requested_capabilities !== undefined
        ? normalizeApprovedCapabilities(dto.requested_capabilities)
        : normalizeAppCapabilities(latestIframeVersion?.manifest)
      : [];
    if (iframeRuntime && dto.version) {
      const existingVersion = await this.versionRepo.findOne({
        where: { appId: app.id, version: dto.version },
      });
      if (existingVersion)
        throw new BadRequestException(`App version ${dto.version} already exists`);
    }
    if (dto.name !== undefined) app.name = dto.name;
    if (dto.category !== undefined) app.category = dto.category;
    if (dto.icon !== undefined) app.icon = dto.icon;
    if (dto.summary !== undefined) app.summary = dto.summary;
    if (dto.description !== undefined) app.description = dto.description;
    if (dto.visibility !== undefined) app.visibility = dto.visibility;
    if (dto.entry_url !== undefined) {
      app.entryUrl = iframeRuntime?.entryUrl || this.normalizeEntryUrl(app.type, dto.entry_url);
    }
    if (dto.developer_name !== undefined) app.developerName = dto.developer_name;
    if (dto.system_module_code !== undefined) app.systemModuleCode = dto.system_module_code;
    if (dto.saas_module_code !== undefined) app.saasModuleCode = dto.saas_module_code;
    if (dto.sort !== undefined) app.sort = Number(dto.sort);
    if (dto.remark !== undefined) app.remark = dto.remark;

    if (!iframeRuntime || !dto.version) return this.toResponse(await this.appRepo.save(app));

    return this.dataSource.transaction(async (manager) => {
      const savedApp = await manager.getRepository(AppPackageEntity).save(app);
      const versionRepo = manager.getRepository(AppPackageVersionEntity);
      const version = versionRepo.create(
        this.createIframeVersion({
          app: savedApp,
          version: dto.version,
          entryUrl: iframeRuntime.entryUrl,
          allowedOrigins: iframeRuntime.allowedOrigins,
          capabilities: iframeCapabilities,
        }),
      );
      const savedVersion = await versionRepo.save(version);
      await this.capabilityPolicy.approvePlatformCapabilities(
        {
          appId: savedApp.id,
          versionId: savedVersion.id,
          requestedCapabilities: iframeCapabilities,
          approvedCapabilities: iframeCapabilities,
        },
        manager.getRepository(AppCapabilityGrantEntity),
      );
      return this.toResponse(savedApp);
    });
  }

  async updateStatus(code: string, status: AppPackageStatus, operatorId?: number) {
    const app = await this.findApp(code);
    if (app.status === status) {
      return this.toResponse(app);
    }

    if (!APP_STATUS_TRANSITIONS[app.status]?.includes(status)) {
      throw new BadRequestException(`Illegal app status transition: ${app.status} -> ${status}`);
    }
    if (status === 'published') {
      await this.assertCanEnable(app);
    }

    app.status = status;
    const saved = await this.appRepo.save(app);
    await this.recordAppEvent(
      saved.id,
      null,
      this.statusToAction(status),
      `App ${code} status changed to ${status}`,
      operatorId,
    );
    return this.toResponse(saved);
  }

  async getApp(code: string) {
    const app = await this.findApp(code);
    const versions = await this.versionRepo.find({
      where: { appId: app.id, deleteTime: IsNull() },
      order: { id: 'DESC' },
    });
    return {
      ...this.toResponse(app),
      versions: versions.map((version) =>
        this.toGovernedVersionResponse(app, version, app.entryUrl),
      ),
    };
  }

  async startServiceCandidate(code: string, version: string, operatorId: number) {
    await this.serviceRuntimeService.startCandidate(code, version, operatorId);
    return this.serviceRuntimeService.getRuntimeApp(code);
  }

  async publishServiceCandidate(code: string, version: string, operatorId: number) {
    await this.serviceRuntimeService.publishCandidate(code, version, operatorId);
    return this.serviceRuntimeService.getRuntimeApp(code);
  }

  async rollbackServiceVersion(code: string, version: string, reason: string, operatorId: number) {
    await this.serviceRuntimeService.rollback(code, version, reason, operatorId);
    return this.serviceRuntimeService.getRuntimeApp(code);
  }

  async stopServiceCandidate(code: string, version: string, reason: string, operatorId: number) {
    await this.serviceRuntimeService.stopCandidate(code, version, reason, operatorId);
    return this.serviceRuntimeService.getRuntimeApp(code);
  }

  reconcileServiceRuntime(operatorId: number) {
    return this.serviceRuntimeService.reconcile(operatorId);
  }

  probeActiveService(code: string, input: unknown, operatorId: number) {
    return this.serviceRuntimeService.probeActive(code, input, operatorId);
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
    const manifestFile = zipFiles.find(
      (zipFile) => this.normalizeZipEntryName(this.getZipEntryName(zipFile)) === 'manifest.json',
    );
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
      serviceTargets: manifest.serviceTargets,
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

    if (app.status !== 'published') {
      this.applyManifestMetadata(app, manifest);
    }
    this.updateAppReviewStatus(app, 'pending_review');
    app.entryMode = 'static';
    await this.appRepo.save(app);
    await this.recordAppEvent(
      app.id,
      savedVersion.id,
      'submit',
      `Uploaded version ${manifest.version} for review`,
      operatorId,
      {
        fileHash: savedVersion.fileHash,
        fileSize: savedVersion.fileSize,
      },
    );

    return this.toVersionResponse(savedVersion);
  }

  async uploadServiceVersion(
    code: string,
    file: Express.Multer.File,
    operatorId?: number,
    developerProfile?: AppDeveloperProfileEntity,
  ) {
    const app = await this.findApp(code);
    if (app.type !== 'service') {
      throw new BadRequestException('Only service apps can upload service packages');
    }
    const restricted = app.trustLevel === 'developer_restricted';
    if (
      restricted &&
      (!developerProfile ||
        operatorId === undefined ||
        Number(developerProfile.userId) !== Number(operatorId) ||
        Number(app.developerId) !== Number(operatorId))
    ) {
      throw new BadRequestException('Developer service certification is required');
    }
    if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('Service package file is required');
    }

    const installed = await this.servicePackageService.scanAndInstall({
      appCode: code,
      zipBuffer: file.buffer,
    });
    const existingVersion = await this.versionRepo.findOne({
      where: { appId: app.id, version: installed.manifest.version },
      withDeleted: true,
    });
    if (existingVersion) {
      throw new BadRequestException(`App version ${installed.manifest.version} already exists`);
    }

    const versionEntity = this.versionRepo.create({
      appId: app.id,
      version: installed.manifest.version,
      manifest: installed.manifest as unknown as Record<string, unknown>,
      approvedCapabilities: [],
      manifestVersion: installed.manifest.manifestVersion,
      packageFormat: 'service_zip',
      scanResult: installed.scanResult as unknown as Record<string, unknown>,
      serviceTargets: installed.manifest.serviceTargets,
      candidateHealthStatus: 'unknown',
      submittedBy: operatorId ?? null,
      submittedTime: new Date(),
      packagePath: installed.releaseDir,
      publishPath: '',
      entryFile: installed.entryFile,
      fileHash: installed.packageSha256,
      fileSize: installed.fileSize,
      reviewStatus: 'pending',
      publishStatus: 'unpublished',
      reviewMessage: '',
      reviewerId: null,
      reviewTime: null,
    } as Partial<AppPackageVersionEntity>) as AppPackageVersionEntity;
    const savedVersion = await this.dataSource.transaction(async (manager) => {
      const txVersionRepo = manager.getRepository(AppPackageVersionEntity);
      const txAppRepo = manager.getRepository(AppPackageEntity);
      let saved = await txVersionRepo.save(versionEntity);

      this.updateAppReviewStatus(app, 'pending_review');
      app.entryMode = 'service';
      app.runtimeType = 'service';
      app.trustLevel = restricted ? 'developer_restricted' : 'platform_trusted';
      app.serviceHealthPath = installed.manifest.healthPath;
      app.runtimeConfig = installed.manifest.runtimeConfig;

      if (restricted) {
        const snapshot = this.reviewSnapshotService.create(app, saved, developerProfile!);
        saved.reviewSnapshot = snapshot as unknown as Record<string, unknown>;
        saved.reviewSnapshotHash = this.reviewSnapshotService.hash(snapshot);
        saved = await txVersionRepo.save(saved);
      }
      await txAppRepo.save(app);
      return saved;
    });
    await this.recordAppEvent(
      app.id,
      savedVersion.id,
      'submit',
      `Uploaded service version ${installed.manifest.version} for review`,
      operatorId,
      {
        fileHash: installed.packageSha256,
        fileSize: installed.fileSize,
        scanResult: installed.scanResult,
      },
    );

    return this.toGovernedVersionResponse(app, savedVersion);
  }

  async submitVersion(code: string, version: string, operatorId?: number) {
    const app = await this.findApp(code);
    const appVersion = await this.findVersion(app.id, version);
    if (appVersion.reviewStatus !== 'rejected') {
      throw new BadRequestException('Only rejected versions can be resubmitted');
    }
    if (app.type === 'service' && app.trustLevel === 'developer_restricted') {
      throw new BadRequestException(
        'Rejected developer service content is immutable; upload a new version',
      );
    }
    appVersion.reviewStatus = 'pending';
    appVersion.reviewMessage = '';
    appVersion.reviewerId = null;
    appVersion.reviewTime = null;
    this.updateAppReviewStatus(app, 'pending_review');
    const savedVersion = await this.versionRepo.save(appVersion);
    await this.appRepo.save(app);
    await this.recordAppEvent(
      app.id,
      appVersion.id,
      'submit',
      `Submitted version ${version} for review`,
      operatorId,
    );
    return this.toGovernedVersionResponse(app, savedVersion);
  }

  async approveVersion(
    code: string,
    version: string,
    message = '',
    operatorId?: number,
    approvedCapabilities?: string[],
  ) {
    const app = await this.findApp(code);
    const appVersion = await this.findVersion(app.id, version);
    if (appVersion.reviewStatus !== 'pending') {
      throw new BadRequestException('Only pending versions can be approved');
    }
    if (
      app.type === 'service' &&
      (operatorId === undefined ||
        appVersion.submittedBy === null ||
        appVersion.submittedBy === undefined ||
        Number(appVersion.submittedBy) === Number(operatorId))
    ) {
      throw new BadRequestException(
        'Service version requires review by a different platform operator',
      );
    }
    if (app.type === 'service' && appVersion.scanResult?.passed !== true) {
      throw new BadRequestException('Service version requires a passing package scan');
    }
    if (app.type === 'service' && app.trustLevel === 'developer_restricted') {
      if (!app.developerId) {
        throw new BadRequestException('Developer service owner is unavailable');
      }
      await this.certificationService.assertRuntimeApproved(Number(app.developerId), 'service');
      this.reviewSnapshotService.verify(appVersion);
      await this.servicePackageService.verifyInstalledEntry(appVersion);
    } else if (app.type === 'service' && app.trustLevel !== 'platform_trusted') {
      throw new BadRequestException('Service trust level is not reviewable');
    }

    const requestedCapabilities = normalizeAppCapabilities(appVersion.manifest);
    const effectiveApproval = normalizeApprovedCapabilities(approvedCapabilities ?? []);
    const savedVersion = await this.dataSource.transaction(async (manager) => {
      appVersion.reviewStatus = 'approved';
      appVersion.reviewMessage = message || '';
      appVersion.reviewerId = operatorId ?? null;
      appVersion.reviewTime = new Date();
      appVersion.approvedCapabilities = effectiveApproval;
      this.updateAppReviewStatus(app, 'approved');

      await this.capabilityPolicy.approvePlatformCapabilities(
        {
          appId: app.id,
          versionId: appVersion.id,
          requestedCapabilities,
          approvedCapabilities: effectiveApproval,
          operatorId,
        },
        manager.getRepository(AppCapabilityGrantEntity),
      );
      const saved = await manager.getRepository(AppPackageVersionEntity).save(appVersion);
      await manager.getRepository(AppPackageEntity).save(app);
      return saved;
    });
    await this.recordAppEvent(
      app.id,
      appVersion.id,
      'approve',
      message || `Approved version ${version}`,
      operatorId,
    );
    return this.toGovernedVersionResponse(app, savedVersion);
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
    this.updateAppReviewStatus(app, 'rejected');

    const savedVersion = await this.versionRepo.save(appVersion);
    await this.appRepo.save(app);
    await this.recordAppEvent(
      app.id,
      appVersion.id,
      'reject',
      message || `Rejected version ${version}`,
      operatorId,
    );
    return this.toGovernedVersionResponse(app, savedVersion);
  }

  async publishVersion(code: string, version: string, operatorId?: number) {
    const app = await this.findApp(code);
    this.assertStaticApp(app);
    const appVersion = await this.findVersion(app.id, version);
    if (appVersion.reviewStatus !== 'approved') {
      throw new BadRequestException('Only approved versions can be published');
    }
    const shouldApplyVersionMetadata =
      app.status === 'published' || Boolean(app.entryUrl) || Boolean(appVersion.publishPath);

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
    if (shouldApplyVersionMetadata && appVersion.manifest) {
      this.applyManifestMetadata(app, appVersion.manifest as unknown as StaticAppManifest);
    }

    const savedVersion = await this.versionRepo.save(appVersion);
    await this.appRepo.save(app);
    await this.recordAppEvent(
      app.id,
      appVersion.id,
      'publish',
      `Published version ${version}`,
      operatorId,
      {
        entryUrl: published.entryUrl,
      },
    );
    return this.toVersionResponse(savedVersion, app.code, app.entryUrl);
  }

  async unpublishVersion(code: string, version: string, message = '', operatorId?: number) {
    const app = await this.findApp(code);
    this.assertStaticApp(app);
    const appVersion = await this.findVersion(app.id, version);
    if (appVersion.publishStatus !== 'published') {
      throw new BadRequestException('Only published versions can be unpublished');
    }

    const targetEntryUrl = this.createStaticEntryUrl(
      app.code,
      appVersion.version,
      appVersion.entryFile,
    );
    const wasActiveVersion = app.entryUrl === targetEntryUrl || !app.entryUrl;
    appVersion.publishStatus = 'unpublished_retired';
    await this.runtimeSessionService.revokeVersion(appVersion.id, 'unpublished');
    const savedVersion = await this.versionRepo.save(appVersion);

    if (wasActiveVersion) {
      const fallback = (await this.findPublishedVersions(app.id)).find(
        (item) => Number(item.id) !== Number(appVersion.id),
      );
      if (fallback) {
        app.status = 'published';
        app.entryMode = 'static';
        app.entryUrl = this.createStaticEntryUrl(app.code, fallback.version, fallback.entryFile);
      } else {
        app.status = 'approved';
        app.entryUrl = '';
      }
      await this.appRepo.save(app);
    }

    await this.recordAppEvent(
      app.id,
      appVersion.id,
      'unpublish',
      message || `Unpublished version ${version}`,
      operatorId,
    );
    return this.toVersionResponse(savedVersion, app.code, app.entryUrl);
  }

  async rollbackVersion(code: string, version: string, message = '', operatorId?: number) {
    const app = await this.findApp(code);
    this.assertStaticApp(app);
    const appVersion = await this.findVersion(app.id, version);
    if (appVersion.reviewStatus !== 'approved') {
      throw new BadRequestException('Only approved versions can be rolled back');
    }
    if (!appVersion.publishPath || !appVersion.entryFile) {
      throw new BadRequestException('App version has no published artifact');
    }

    await this.retirePublishedVersions(app.id, appVersion.id);
    appVersion.publishStatus = 'published';
    const entryUrl = this.createStaticEntryUrl(app.code, appVersion.version, appVersion.entryFile);
    const savedVersion = await this.versionRepo.save(appVersion);

    app.status = 'published';
    app.entryMode = 'static';
    app.entryUrl = entryUrl;
    if (appVersion.manifest) {
      this.applyManifestMetadata(app, appVersion.manifest as unknown as StaticAppManifest);
    }
    await this.appRepo.save(app);

    await this.recordAppEvent(
      app.id,
      appVersion.id,
      'rollback',
      message || `Rolled back to version ${version}`,
      operatorId,
      {
        entryUrl,
      },
    );
    return this.toVersionResponse(savedVersion, app.code, app.entryUrl);
  }

  private async assertCanEnable(app: AppPackageEntity) {
    if (app.type === 'internal') {
      this.normalizeEntryUrl('internal', app.entryUrl || '');
      return;
    }

    if (app.type === 'service') {
      const runtime = await this.serviceRuntimeService.getRuntimeApp(app.code);
      const active = Array.isArray(runtime.instances)
        ? runtime.instances.filter(
            (instance) =>
              instance.role === 'active' &&
              instance.process_status === 'online' &&
              instance.health_status === 'healthy',
          )
        : [];
      if (!runtime.active_version || active.length !== 1) {
        throw new BadRequestException(
          'Service app requires a healthy active runtime before enabling',
        );
      }
      return;
    }

    const version = await this.versionRepo.findOne({
      where: {
        appId: app.id,
        reviewStatus: 'approved',
        publishStatus: 'published',
        deleteTime: IsNull(),
      },
      order: { id: 'DESC' },
    } as any);
    if (!version || (app.type === 'static' && !version.publishPath)) {
      throw new BadRequestException('App requires a reviewed published version before enabling');
    }
  }

  private resolveEntryMode(type: AppPackageType) {
    if (type === 'internal') return 'internal_route';
    if (type === 'static') return 'static';
    if (type === 'service') return 'service';
    return 'iframe';
  }

  private normalizeEntryUrl(type: AppPackageType, value: string) {
    if (type === 'static') {
      return String(value || '').trim();
    }
    if (type === 'iframe') {
      return normalizeExternalHttpUrl(value, { label: 'Iframe app entry', httpsOnly: true });
    }
    if (type === 'service') return '';
    return this.normalizeInternalRoute(value);
  }

  private runtimeType(type: AppPackageType) {
    if (type === 'internal') return 'native' as const;
    return type;
  }

  private trustLevel(type: AppPackageType) {
    if (type === 'internal' || type === 'service') return 'platform_trusted' as const;
    if (type === 'iframe') return 'external_managed' as const;
    return 'static_sandboxed' as const;
  }

  private normalizeIframeRuntime(entryValue: string, originValues?: string[]) {
    const entryUrl = normalizeExternalHttpUrl(entryValue, {
      label: 'Iframe app entry',
      httpsOnly: true,
    });
    const entryOrigin = new URL(entryUrl).origin;
    const values = originValues?.length ? originValues : [entryOrigin];
    const allowedOrigins = [...new Set(values.map((value) => this.normalizeIframeOrigin(value)))];
    if (!allowedOrigins.includes(entryOrigin)) {
      throw new BadRequestException('Iframe entry origin must be approved');
    }
    return { entryUrl, allowedOrigins };
  }

  private normalizeIframeOrigin(value: string) {
    let parsed: URL;
    try {
      parsed = new URL(String(value || '').trim());
    } catch {
      throw new BadRequestException('Iframe allowed origins must be exact HTTPS origins');
    }
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      throw new BadRequestException('Iframe allowed origins must be exact HTTPS origins');
    }
    return parsed.origin;
  }

  private createIframeVersion(input: {
    app: AppPackageEntity;
    version: string;
    entryUrl: string;
    allowedOrigins: string[];
    capabilities: ReturnType<typeof normalizeApprovedCapabilities>;
    operatorId?: number;
  }): Partial<AppPackageVersionEntity> {
    return {
      appId: input.app.id,
      version: input.version,
      manifest: {
        code: input.app.code,
        name: input.app.name,
        version: input.version,
        type: 'iframe',
        entry: input.entryUrl,
        permissions: [],
        capabilities: [...input.capabilities],
        allowedOrigins: [...input.allowedOrigins],
      },
      approvedCapabilities: [...input.capabilities],
      packagePath: '',
      publishPath: '',
      entryFile: '',
      fileHash: '',
      fileSize: 0,
      reviewStatus: 'approved',
      publishStatus: 'published',
      reviewMessage: '',
      reviewerId: input.operatorId ?? null,
      reviewTime: new Date(),
    };
  }

  private normalizeInternalRoute(value: string) {
    const route = String(value || '').trim();
    if (
      !route ||
      !route.startsWith('/') ||
      route.startsWith('//') ||
      route.includes('\\') ||
      /^[a-z][a-z0-9+.-]*:/i.test(route) ||
      route.startsWith('/api/')
    ) {
      throw new BadRequestException('Internal app entry must be an absolute app route');
    }
    return route;
  }

  private updateAppReviewStatus(app: AppPackageEntity, status: AppPackageStatus) {
    if (app.status !== 'published') {
      app.status = status;
    }
  }

  private applyManifestMetadata(app: AppPackageEntity, manifest: StaticAppManifest) {
    app.name = manifest.name || app.name;
    app.category = manifest.category || app.category;
    app.icon = manifest.icon || app.icon;
    app.summary = manifest.summary || app.summary;
    app.description = manifest.description || app.description;
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
    const appVersion = await this.versionRepo.findOne({
      where: { appId, version, deleteTime: IsNull() },
    });
    if (!appVersion) {
      throw new NotFoundException(`App version ${version} not found`);
    }
    return appVersion;
  }

  private assertStaticApp(app: AppPackageEntity) {
    if (app.type !== 'static') {
      throw new BadRequestException('Only static app versions can be governed');
    }
  }

  private async findPublishedVersions(appId: number) {
    return this.versionRepo.find({
      where: { appId, reviewStatus: 'approved', publishStatus: 'published', deleteTime: IsNull() },
      order: { id: 'DESC' },
    } as any);
  }

  private async retirePublishedVersions(appId: number, exceptVersionId?: number) {
    const versions = await this.findPublishedVersions(appId);
    for (const item of versions) {
      if (exceptVersionId && Number(item.id) === Number(exceptVersionId)) {
        continue;
      }
      item.publishStatus = 'unpublished_retired';
      await this.runtimeSessionService.revokeVersion(item.id, 'rollback_retired');
      await this.versionRepo.save(item);
    }
  }

  private createStaticEntryUrl(appCode: string, version: string, entryFile: string) {
    const normalizedEntry = String(entryFile || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');
    return `${this.storage.getPublicPrefix()}${appCode}/${version}/${normalizedEntry}`;
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
    const normalized = String(value || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');
    const resolved = path.posix.normalize(normalized);
    if (
      !resolved ||
      resolved === '.' ||
      resolved.startsWith('../') ||
      resolved.includes('/../') ||
      path.posix.isAbsolute(resolved)
    ) {
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

  private toVersionResponse(
    version: Partial<AppPackageVersionEntity>,
    appCode?: string,
    activeEntryUrl?: string,
  ) {
    const entryUrl =
      appCode && version.version && version.entryFile
        ? this.createStaticEntryUrl(appCode, version.version, version.entryFile)
        : '';
    return {
      id: version.id,
      app_id: version.appId,
      version: version.version,
      manifest: version.manifest || null,
      requested_capabilities: normalizeAppCapabilities(version.manifest),
      approved_capabilities: version.approvedCapabilities || [],
      manifest_version: Number(version.manifestVersion) || 1,
      package_format: version.packageFormat || 'static_zip',
      scan_result: version.scanResult || null,
      service_targets: version.serviceTargets || [],
      candidate_health_status: version.candidateHealthStatus || 'unknown',
      package_path: version.packagePath || '',
      publish_path: version.publishPath || '',
      entry_file: version.entryFile || '',
      file_hash: version.fileHash || '',
      file_size: Number(version.fileSize) || 0,
      review_status: version.reviewStatus,
      publish_status: version.publishStatus,
      entry_url: entryUrl,
      is_active: Boolean(
        entryUrl && activeEntryUrl === entryUrl && version.publishStatus === 'published',
      ),
      review_message: version.reviewMessage || '',
      reviewer_id: version.reviewerId ?? null,
      submitted_by: version.submittedBy ?? null,
      candidate_reviewed_by: version.candidateReviewedBy ?? null,
      candidate_reviewed_time: version.candidateReviewedTime ?? null,
      released_by: version.releasedBy ?? null,
      released_time: version.releasedTime ?? null,
      rollback_from_version_id: version.rollbackFromVersionId ?? null,
      review_time: version.reviewTime,
      create_time: version.createTime,
      update_time: version.updateTime,
    };
  }

  private toServiceVersionResponse(version: Partial<AppPackageVersionEntity>) {
    return {
      id: version.id,
      app_id: version.appId,
      version: version.version,
      manifest: version.manifest || null,
      requested_capabilities: normalizeAppCapabilities(version.manifest),
      approved_capabilities: version.approvedCapabilities || [],
      manifest_version: Number(version.manifestVersion) || 2,
      package_format: version.packageFormat || 'service_zip',
      scan_result: this.sanitizeServiceScanResult(version.scanResult),
      review_snapshot: version.reviewSnapshot || null,
      review_snapshot_hash: version.reviewSnapshotHash || '',
      submitted_time: version.submittedTime ?? null,
      service_targets: version.serviceTargets || [],
      candidate_health_status: version.candidateHealthStatus || 'unknown',
      review_status: version.reviewStatus,
      publish_status: version.publishStatus,
      review_message: version.reviewMessage || '',
      reviewer_id: version.reviewerId ?? null,
      submitted_by: version.submittedBy ?? null,
      candidate_reviewed_by: version.candidateReviewedBy ?? null,
      candidate_reviewed_time: version.candidateReviewedTime ?? null,
      released_by: version.releasedBy ?? null,
      released_time: version.releasedTime ?? null,
      rollback_from_version_id: version.rollbackFromVersionId ?? null,
      review_time: version.reviewTime,
      create_time: version.createTime,
      update_time: version.updateTime,
    };
  }

  private toGovernedVersionResponse(
    app: AppPackageEntity,
    version: Partial<AppPackageVersionEntity>,
    activeEntryUrl?: string,
  ) {
    return app.type === 'service'
      ? this.toServiceVersionResponse(version)
      : this.toVersionResponse(version, app.code, activeEntryUrl);
  }

  private sanitizeServiceScanResult(value: Record<string, unknown> | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return this.reviewSnapshotService.sanitizeScanResult(value);
  }

  private toReviewQueueResponse(app: AppPackageEntity, version: AppPackageVersionEntity) {
    return {
      ...this.toGovernedVersionResponse(app, version, app.entryUrl),
      app_code: app.code,
      app_name: app.name,
      app_type: app.type,
      app_status: app.status,
      trust_level: app.trustLevel || this.trustLevel(app.type),
      category: app.category || '',
      developer_name: app.developerName || '',
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
      runtime_type: app.runtimeType || this.runtimeType(app.type as AppPackageType),
      trust_level: app.trustLevel || this.trustLevel(app.type as AppPackageType),
      service_health_path: app.serviceHealthPath || '',
      runtime_config: app.runtimeConfig || null,
      system_module_code: app.systemModuleCode || '',
      saas_module_code: app.saasModuleCode || '',
      sort: Number(app.sort) || 0,
      remark: app.remark || '',
      create_time: app.createTime,
      update_time: app.updateTime,
    };
  }
}
