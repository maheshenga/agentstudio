import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { AppOpenLogEntity } from '../entities/app-open-log.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';

export interface AppOpenClientInfo {
  ip?: string;
  userAgent?: string;
}

const STATIC_APP_SANDBOX = 'allow-scripts allow-forms allow-popups allow-downloads';

@Injectable()
export class AppTenantService {
  constructor(
    @InjectRepository(AppPackageEntity)
    private readonly appRepo: Repository<AppPackageEntity>,
    @InjectRepository(AppPackageVersionEntity)
    private readonly versionRepo: Repository<AppPackageVersionEntity>,
    @InjectRepository(TenantAppInstallEntity)
    private readonly installRepo: Repository<TenantAppInstallEntity>,
    @InjectRepository(AppOpenLogEntity)
    private readonly openLogRepo: Repository<AppOpenLogEntity>,
  ) {}

  async listMarketplace(tenantId: number) {
    const [apps, installs] = await Promise.all([
      this.appRepo.find({ where: { deleteTime: IsNull() }, order: { sort: 'ASC', id: 'ASC' } }),
      this.installRepo.find({ where: { tenantId, deleteTime: IsNull() }, order: { id: 'ASC' } }),
    ]);
    const installByAppId = new Map(installs.map((install) => [Number(install.appId), install]));

    return apps
      .filter((app) => app.status === 'published')
      .filter((app) => ['marketplace', 'tenant', 'platform'].includes(app.visibility || 'marketplace'))
      .map((app) => {
        const install = installByAppId.get(Number(app.id));
        return {
          ...this.toAppResponse(app),
          installed: Boolean(install && Number(install.enabled) === 1),
        };
      });
  }

  async listInstalled(tenantId: number) {
    const installs = await this.installRepo.find({ where: { tenantId, deleteTime: IsNull() }, order: { id: 'DESC' } });
    return installs.map((install) => this.toInstallResponse(install));
  }

  async installApp(tenantId: number, code: string, userId?: number) {
    const app = await this.findPublishedApp(code);
    const version = app.type === 'static' ? await this.findPublishedVersion(app.id) : null;
    const existing = await this.installRepo.findOne({
      where: { tenantId, appId: app.id },
      withDeleted: true,
    } as any);

    const installedTime = new Date();
    const install =
      existing ||
      this.installRepo.create({
        tenantId,
        appId: app.id,
        versionId: version?.id ?? null,
        enabled: 1,
        source: 'marketplace',
        installedBy: userId ?? null,
        installedTime,
      });

    install.versionId = version?.id ?? null;
    install.enabled = 1;
    install.source = install.source || 'marketplace';
    install.installedBy = userId ?? null;
    install.installedTime = installedTime;
    install.deleteTime = null;

    return this.toInstallResponse(await this.installRepo.save(install));
  }

  async uninstallApp(tenantId: number, code: string) {
    const app = await this.findApp(code);
    const existing = await this.installRepo.findOne({ where: { tenantId, appId: app.id, deleteTime: IsNull() } });
    if (!existing) {
      return { code, installed: false };
    }

    existing.enabled = 0;
    await this.installRepo.save(existing);
    return { code, installed: false };
  }

  async getOpenMetadata(tenantId: number, code: string, userId?: number, clientInfo: AppOpenClientInfo = {}) {
    const app = await this.findPublishedApp(code);
    const install = await this.installRepo.findOne({
      where: { tenantId, appId: app.id, enabled: 1, deleteTime: IsNull() },
    });
    if (!install) {
      throw new BadRequestException('App is not installed');
    }

    const version = app.type === 'static'
      ? install.versionId
        ? await this.findVersionById(app.id, Number(install.versionId))
        : await this.findPublishedVersion(app.id)
      : null;

    const openMode = app.type === 'internal' ? 'internal_route' : 'iframe';
    await this.openLogRepo.save(
      this.openLogRepo.create({
        tenantId,
        userId: userId ?? null,
        appId: app.id,
        versionId: version?.id ?? null,
        openMode,
        ip: clientInfo.ip || '',
        userAgent: clientInfo.userAgent || '',
      }),
    );

    return {
      code: app.code,
      name: app.name,
      type: app.type,
      open_mode: openMode,
      entry_url: app.entryUrl,
      sandbox: app.type === 'internal' ? '' : STATIC_APP_SANDBOX,
      version: version?.version || '',
    };
  }

  private async findApp(code: string) {
    const app = await this.appRepo.findOne({ where: { code, deleteTime: IsNull() } });
    if (!app) {
      throw new NotFoundException(`App ${code} not found`);
    }
    return app;
  }

  private async findPublishedApp(code: string) {
    const app = await this.findApp(code);
    if (app.status !== 'published') {
      throw new BadRequestException('App is not published');
    }
    return app;
  }

  private async findPublishedVersion(appId: number) {
    const version = await this.versionRepo.findOne({
      where: { appId, reviewStatus: 'approved', publishStatus: 'published', deleteTime: IsNull() },
      order: { id: 'DESC' },
    } as any);
    if (!version) {
      throw new BadRequestException('App has no published version');
    }
    return version;
  }

  private async findVersionById(appId: number, id: number) {
    const version = await this.versionRepo.findOne({
      where: { id, appId, reviewStatus: 'approved', publishStatus: 'published', deleteTime: IsNull() },
    } as any);
    if (!version) {
      throw new BadRequestException('App has no published version');
    }
    return version;
  }

  private toAppResponse(app: Partial<AppPackageEntity>) {
    return {
      id: app.id,
      code: app.code,
      name: app.name,
      type: app.type,
      category: app.category || '',
      icon: app.icon || '',
      summary: app.summary || '',
      description: app.description || '',
      status: app.status,
      visibility: app.visibility || 'marketplace',
      entry_mode: app.entryMode || '',
      entry_url: app.entryUrl || '',
      system_module_code: app.systemModuleCode || '',
      saas_module_code: app.saasModuleCode || '',
    };
  }

  private toInstallResponse(install: Partial<TenantAppInstallEntity>) {
    return {
      id: install.id,
      tenant_id: install.tenantId,
      app_id: install.appId,
      version_id: install.versionId ?? null,
      enabled: Number(install.enabled) === 1,
      source: install.source || 'marketplace',
      installed_by: install.installedBy ?? null,
      installed_time: install.installedTime,
      create_time: install.createTime,
      update_time: install.updateTime,
    };
  }
}
