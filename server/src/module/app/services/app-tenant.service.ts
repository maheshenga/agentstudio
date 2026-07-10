import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

import { SaasModuleService } from '../../saas/services/saas-module.service';
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
import { AppOpenLogEntity } from '../entities/app-open-log.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';

export interface AppOpenClientInfo {
  ip?: string;
  userAgent?: string;
}

export type AppAvailabilityStatus =
  | 'available'
  | 'missing_plan_module'
  | 'missing_system_module'
  | 'system_module_unavailable';

export interface AppAvailability {
  available: boolean;
  availability_status: AppAvailabilityStatus;
  availability_reason: string;
  required_saas_module_code: string;
  required_system_module_code: string;
}

const STATIC_APP_SANDBOX = 'allow-scripts allow-forms allow-popups allow-downloads';

type AppOpenFailureReason = Exclude<AppOpenLogEntity['reasonCode'], 'none'>;

const APP_OPEN_FAILURE_MESSAGES: Record<AppOpenFailureReason, string> = {
  app_not_found: 'App was not found',
  app_not_published: 'App is not published',
  app_not_installed: 'App is not installed',
  missing_plan_module: 'Required plan module is not enabled',
  missing_system_module: 'Required tenant module is not enabled',
  system_module_unavailable: 'Required system module is unavailable',
  published_version_missing: 'App has no published version',
  open_metadata_error: 'Unable to open app',
};

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
    private readonly saasModuleService: SaasModuleService,
    private readonly systemModuleAccessService: SystemModuleAccessService,
  ) {}

  async listMarketplace(tenantId: number) {
    const [apps, installs] = await Promise.all([
      this.appRepo.find({ where: { deleteTime: IsNull() }, order: { sort: 'ASC', id: 'ASC' } }),
      this.installRepo.find({ where: { tenantId, deleteTime: IsNull() }, order: { id: 'ASC' } }),
    ]);
    const installByAppId = new Map(installs.map((install) => [Number(install.appId), install]));

    return Promise.all(
      apps
        .filter((app) => app.status === 'published')
        .filter((app) => ['marketplace', 'tenant', 'platform'].includes(app.visibility || 'marketplace'))
        .map(async (app) => {
        const install = installByAppId.get(Number(app.id));
        return {
          ...this.toAppResponse(app),
          ...(await this.getAppAvailability(tenantId, app)),
          installed: Boolean(install && Number(install.enabled) === 1),
        };
        }),
    );
  }

  async listInstalled(tenantId: number) {
    const installs = await this.installRepo.find({ where: { tenantId, deleteTime: IsNull() }, order: { id: 'DESC' } });
    const appIds = [...new Set(installs.map((install) => Number(install.appId)).filter(Boolean))];
    const apps = appIds.length
      ? await this.appRepo.find({
          where: { id: In(appIds), deleteTime: IsNull() },
        } as any)
      : [];
    const appById = new Map(apps.map((app) => [Number(app.id), app]));

    return Promise.all(
      installs.map(async (install) => {
        const app = appById.get(Number(install.appId));
        return {
          ...this.toInstallResponse(install),
          app: app
            ? {
                ...this.toAppResponse(app),
                ...(await this.getAppAvailability(tenantId, app)),
              }
            : null,
        };
      }),
    );
  }

  async installApp(tenantId: number, code: string, userId?: number) {
    const app = await this.findPublishedApp(code);
    this.assertAvailability(await this.getAppAvailability(tenantId, app));
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
    const appCode = String(code || '')
      .trim()
      .toLowerCase()
      .slice(0, 100);
    let app: AppPackageEntity | null = null;
    let version: AppPackageVersionEntity | null = null;
    let openMode = 'unknown';
    let failureAudited = false;

    const fail = async (reasonCode: AppOpenFailureReason, error: Error): Promise<never> => {
      failureAudited = true;
      await this.recordOpenOutcome({
        tenantId,
        userId,
        appCode,
        appId: app?.id ?? null,
        versionId: version?.id ?? null,
        openMode,
        outcome: 'failed',
        reasonCode,
        clientInfo,
      });
      throw error;
    };

    try {
      app = await this.appRepo.findOne({ where: { code: appCode, deleteTime: IsNull() } });
      if (!app) {
        return await fail('app_not_found', new NotFoundException(`App ${appCode} not found`));
      }
      if (app.status !== 'published') {
        return await fail('app_not_published', new BadRequestException('App is not published'));
      }

      const install = await this.installRepo.findOne({
        where: { tenantId, appId: app.id, enabled: 1, deleteTime: IsNull() },
      });
      if (!install) {
        return await fail('app_not_installed', new BadRequestException('App is not installed'));
      }

      const availability = await this.getAppAvailability(tenantId, app);
      if (!availability.available) {
        const reasonCode: AppOpenFailureReason =
          availability.availability_status === 'missing_plan_module' ||
          availability.availability_status === 'missing_system_module'
            ? availability.availability_status
            : 'system_module_unavailable';
        return await fail(
          reasonCode,
          new BadRequestException(availability.availability_reason || 'App is not available for this tenant'),
        );
      }

      if (app.type === 'static') {
        try {
          version = await this.resolveOpenVersion(app, install);
        } catch (error) {
          if (error instanceof BadRequestException && error.message === 'App has no published version') {
            return await fail('published_version_missing', error);
          }
          throw error;
        }
      }

      openMode = app.type === 'internal' ? 'internal_route' : 'iframe';
      await this.recordOpenOutcome({
        tenantId,
        userId,
        appCode: app.code,
        appId: app.id,
        versionId: version?.id ?? null,
        openMode,
        outcome: 'success',
        reasonCode: 'none',
        clientInfo,
      });

      return {
        code: app.code,
        name: app.name,
        type: app.type,
        open_mode: openMode,
        entry_url: app.entryUrl,
        sandbox: app.type === 'internal' ? '' : STATIC_APP_SANDBOX,
        version: version?.version || '',
      };
    } catch (error) {
      if (!failureAudited) {
        await this.recordOpenOutcome({
          tenantId,
          userId,
          appCode,
          appId: app?.id ?? null,
          versionId: version?.id ?? null,
          openMode,
          outcome: 'failed',
          reasonCode: 'open_metadata_error',
          clientInfo,
        });
      }
      throw error;
    }
  }

  private async recordOpenOutcome(input: {
    tenantId: number;
    userId?: number;
    appCode: string;
    appId: number | null;
    versionId: number | null;
    openMode: string;
    outcome: AppOpenLogEntity['outcome'];
    reasonCode: AppOpenLogEntity['reasonCode'];
    clientInfo: AppOpenClientInfo;
  }): Promise<void> {
    try {
      await this.openLogRepo.save(
        this.openLogRepo.create({
          tenantId: input.tenantId,
          userId: input.userId ?? null,
          appCode: input.appCode,
          appId: input.appId,
          versionId: input.versionId,
          openMode: input.openMode,
          outcome: input.outcome,
          reasonCode: input.reasonCode,
          failureMessage:
            input.reasonCode === 'none' ? '' : APP_OPEN_FAILURE_MESSAGES[input.reasonCode],
          ip: input.clientInfo.ip || '',
          userAgent: input.clientInfo.userAgent || '',
        }),
      );
    } catch {
      return;
    }
  }

  private assertAvailability(availability: AppAvailability) {
    if (!availability.available) {
      throw new BadRequestException(availability.availability_reason || 'App is not available for this tenant');
    }
  }

  async getAppAvailability(tenantId: number, app: Partial<AppPackageEntity>): Promise<AppAvailability> {
    const saasModuleCode = app.saasModuleCode || '';
    const systemModuleCode = app.systemModuleCode || '';

    if (saasModuleCode) {
      try {
        await this.saasModuleService.assertTenantModuleEnabled(tenantId, saasModuleCode);
      } catch (error) {
        return this.createAvailability(false, 'missing_plan_module', this.getErrorMessage(error), app);
      }
    }

    if (systemModuleCode) {
      const diagnosis = await this.systemModuleAccessService.diagnoseModuleAccess({
        tenantId,
        moduleCode: systemModuleCode,
        requiredSaasModuleCode: saasModuleCode || undefined,
      });
      if (!diagnosis.allowed) {
        const status =
          diagnosis.status === 'missing_plan_module'
            ? 'missing_plan_module'
            : diagnosis.status === 'missing_tenant_module'
              ? 'missing_system_module'
              : 'system_module_unavailable';
        return this.createAvailability(false, status, diagnosis.reason || 'App is not available for this tenant', app);
      }
    }

    return this.createAvailability(true, 'available', '', app);
  }

  private createAvailability(
    available: boolean,
    status: AppAvailabilityStatus,
    reason: string,
    app: Partial<AppPackageEntity>,
  ): AppAvailability {
    return {
      available,
      availability_status: status,
      availability_reason: available ? '' : reason || 'App is not available for this tenant',
      required_saas_module_code: app.saasModuleCode || '',
      required_system_module_code: app.systemModuleCode || '',
    };
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) return error.message;
    return 'App is not available for this tenant';
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

  private async resolveOpenVersion(app: AppPackageEntity, install: TenantAppInstallEntity) {
    if (install.versionId) {
      try {
        return await this.findVersionById(app.id, Number(install.versionId));
      } catch (error) {
        if (!(error instanceof BadRequestException)) {
          throw error;
        }
      }
    }
    return this.findPublishedVersion(app.id);
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
