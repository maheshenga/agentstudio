import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, IsNull, Like, Repository } from 'typeorm';

import { normalizeExternalHttpUrl } from '../../../common/utils/safe-url.util';
import {
  normalizeAppPage,
  type AppPageQuery,
  type AppPageResult,
} from '../app-page';
import {
  AppLicenseAccessService,
  type TenantAppCommerceAccess,
} from '../../app-commerce/services/app-license-access.service';
import { SaasModuleService } from '../../saas/services/saas-module.service';
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
import { normalizeAppCapabilities } from '../app-runtime.constants';
import { AppCapabilityGrantEntity } from '../entities/app-capability-grant.entity';
import { AppOpenLogEntity } from '../entities/app-open-log.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppServiceInstanceEntity } from '../entities/app-service-instance.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';
import { AppRuntimeContextService } from './app-runtime-context.service';
import { AppCapabilityPolicyService } from './app-capability-policy.service';
import { AppRuntimeSessionService } from './app-runtime-session.service';
import { AppIframeLaunchService } from './app-iframe-launch.service';

export interface AppOpenClientInfo {
  ip?: string;
  userAgent?: string;
}

export interface AppMarketplaceListQuery extends AppPageQuery {
  keyword?: string;
  category?: string;
  type?: AppPackageEntity['type'];
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

interface AppCapabilityState {
  requested: string[];
  platform_approved: string[];
  tenant_approved: string[];
  effective: string[];
}

interface AppCatalogVersionState {
  selected: AppPackageVersionEntity | null;
  latest: AppPackageVersionEntity | null;
  byId: Map<number, AppPackageVersionEntity>;
  capability: AppCapabilityState;
  latestCapability: AppCapabilityState;
}

const STATIC_APP_SANDBOX = 'allow-scripts allow-forms allow-popups allow-downloads';
const EXTERNAL_IFRAME_SANDBOX = `${STATIC_APP_SANDBOX} allow-same-origin`;

type AppOpenFailureReason = Exclude<AppOpenLogEntity['reasonCode'], 'none'>;

const APP_OPEN_FAILURE_MESSAGES: Record<AppOpenFailureReason, string> = {
  app_not_found: 'App was not found',
  app_not_published: 'App is not published',
  app_not_installed: 'App is not installed',
  missing_plan_module: 'Required plan module is not enabled',
  missing_system_module: 'Required tenant module is not enabled',
  system_module_unavailable: 'Required system module is unavailable',
  license_required: 'Application license is required',
  license_expired: 'Application license has expired',
  license_revoked: 'Application license is inactive',
  service_not_openable: 'Service apps cannot be opened directly',
  published_version_missing: 'App has no published version',
  upgrade_required: 'Installed app version is no longer available; upgrade required',
  open_metadata_error: 'Unable to open app',
};

@Injectable()
export class AppTenantService {
  constructor(
    @InjectRepository(AppPackageEntity)
    private readonly appRepo: Repository<AppPackageEntity>,
    @InjectRepository(AppPackageVersionEntity)
    private readonly versionRepo: Repository<AppPackageVersionEntity>,
    @InjectRepository(AppServiceInstanceEntity)
    private readonly instanceRepo: Repository<AppServiceInstanceEntity>,
    @InjectRepository(TenantAppInstallEntity)
    private readonly installRepo: Repository<TenantAppInstallEntity>,
    @InjectRepository(AppOpenLogEntity)
    private readonly openLogRepo: Repository<AppOpenLogEntity>,
    private readonly saasModuleService: SaasModuleService,
    private readonly systemModuleAccessService: SystemModuleAccessService,
    private readonly appLicenseAccessService: AppLicenseAccessService,
    private readonly appRuntimeContextService: AppRuntimeContextService,
    private readonly appRuntimeSessionService: AppRuntimeSessionService,
    private readonly appIframeLaunchService: AppIframeLaunchService,
    private readonly capabilityPolicy: AppCapabilityPolicyService,
    private readonly dataSource: DataSource,
  ) {}

  async listMarketplace(tenantId: number): Promise<Record<string, unknown>[]>;
  async listMarketplace(
    tenantId: number,
    query: AppMarketplaceListQuery,
  ): Promise<AppPageResult<Record<string, unknown>>>;
  async listMarketplace(
    tenantId: number,
    query?: AppMarketplaceListQuery,
  ): Promise<Record<string, unknown>[] | AppPageResult<Record<string, unknown>>> {
    const normalizedQuery = query || {};
    const { page, limit, skip } = normalizeAppPage(normalizedQuery);
    const baseWhere: FindOptionsWhere<AppPackageEntity> = {
      deleteTime: IsNull(),
      status: 'published',
      visibility: In(['marketplace', 'tenant', 'platform']),
      ...(normalizedQuery.type ? { type: normalizedQuery.type } : {}),
      ...(normalizedQuery.category?.trim()
        ? { category: normalizedQuery.category.trim() }
        : {}),
    };
    const keyword = normalizedQuery.keyword?.trim();
    const where: FindOptionsWhere<AppPackageEntity> | FindOptionsWhere<AppPackageEntity>[] = keyword
      ? ['code', 'name', 'category', 'summary'].map((field) => ({
          ...baseWhere,
          [field]: Like(`%${keyword}%`),
        }))
      : baseWhere;
    const [apps, total] = await this.appRepo.findAndCount({
      where,
      order: { sort: 'ASC', id: 'ASC' },
      skip,
      take: limit,
    });
    const appIds = apps.map((app) => Number(app.id));
    const installs = appIds.length
      ? await this.installRepo.find({
          where: { tenantId, appId: In(appIds), deleteTime: IsNull() },
          order: { id: 'ASC' },
        })
      : [];
    const installByAppId = new Map(installs.map((install) => [Number(install.appId), install]));
    const serviceStateByAppId = await this.loadServiceRuntimeStates(apps);
    const [versionStateByAppId, availabilityByAppId] = await Promise.all([
      this.loadVersionStates(tenantId, apps, installByAppId, serviceStateByAppId),
      this.loadAvailabilityStates(tenantId, apps),
    ]);
    const commerceByAppId = await this.appLicenseAccessService.getAccessStates(
      tenantId,
      apps.map((app) => ({
        ...app,
        installed: Number(installByAppId.get(Number(app.id))?.enabled) === 1,
      })),
    );

    const list = apps.map((app) => {
        const install = installByAppId.get(Number(app.id));
        const installed = Boolean(install && Number(install.enabled) === 1);
        const versionState =
          versionStateByAppId.get(Number(app.id)) || this.emptyVersionState();
        const availability = availabilityByAppId.get(Number(app.id))!;
        const commerce = this.requireCommerceState(commerceByAppId, app.id);
        const serviceState = this.toTenantServiceState(
          app,
          install,
          serviceStateByAppId,
          availability,
          commerce,
        );
        return {
          ...this.toAppResponse(app),
          ...availability,
          installed,
          ...this.toCommerceResponse(commerce, availability, installed, app, serviceState),
          ...serviceState,
          ...this.toCapabilityResponse(versionState.capability),
          ...this.toVersionResponse(app, install, versionState),
        };
      });
    const result = { list, total, page, limit };
    return query === undefined ? list : result;
  }

  private async loadAvailabilityStates(tenantId: number, apps: AppPackageEntity[]) {
    const byRequirement = new Map<string, Promise<AppAvailability>>();
    const entries = apps.map(async (app) => {
      const key = `${app.saasModuleCode || ''}\0${app.systemModuleCode || ''}`;
      let availability = byRequirement.get(key);
      if (!availability) {
        availability = this.getAppAvailability(tenantId, app);
        byRequirement.set(key, availability);
      }
      return [Number(app.id), await availability] as const;
    });
    return new Map(await Promise.all(entries));
  }

  async listInstalled(tenantId: number) {
    const installs = await this.installRepo.find({
      where: { tenantId, deleteTime: IsNull() },
      order: { id: 'DESC' },
    });
    const appIds = [...new Set(installs.map((install) => Number(install.appId)).filter(Boolean))];
    const apps = appIds.length
      ? await this.appRepo.find({
          where: { id: In(appIds), deleteTime: IsNull() },
        } as any)
      : [];
    const appById = new Map(apps.map((app) => [Number(app.id), app]));
    const installByAppId = new Map(installs.map((install) => [Number(install.appId), install]));
    const serviceStateByAppId = await this.loadServiceRuntimeStates(apps);
    const versionStateByAppId = await this.loadVersionStates(
      tenantId,
      apps,
      installByAppId,
      serviceStateByAppId,
    );
    const commerceByAppId = await this.appLicenseAccessService.getAccessStates(
      tenantId,
      apps.map((app) => ({
        ...app,
        installed: Number(installByAppId.get(Number(app.id))?.enabled) === 1,
      })),
    );

    return Promise.all(
      installs.map(async (install) => {
        const app = appById.get(Number(install.appId));
        const versionState =
          versionStateByAppId.get(Number(install.appId)) || this.emptyVersionState();
        return {
          ...this.toInstallResponse(install),
          ...this.toCapabilityResponse(versionState.capability),
          app: app
            ? await this.toInstalledAppResponse(
                tenantId,
                app,
                install,
                commerceByAppId,
                serviceStateByAppId,
                versionState,
              )
            : null,
        };
      }),
    );
  }

  async installApp(tenantId: number, code: string, userId?: number, capabilities: string[] = []) {
    const app = await this.findPublishedApp(code);
    this.assertCommerceAccess(
      await this.appLicenseAccessService.getAccessState(tenantId, { ...app, installed: false }),
      'install',
    );
    this.assertAvailability(await this.getAppAvailability(tenantId, app));
    const version =
      app.type === 'static'
        ? await this.findPublishedVersion(app.id)
        : app.type === 'iframe'
          ? await this.findPublishedVersionOrNull(app.id)
          : app.type === 'service'
            ? await this.findActiveServiceVersion(app.id)
            : null;
    const existing = await this.installRepo.findOne({
      where: { tenantId, appId: app.id },
      withDeleted: true,
    } as any);
    if (
      existing &&
      Number(existing.enabled) === 1 &&
      Number(existing.versionId || 0) !== Number(version?.id || 0)
    ) {
      throw new BadRequestException('Use the app upgrade endpoint to change versions');
    }

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

    if (capabilities.length && !version) {
      throw new BadRequestException('App has no published version for capability consent');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const savedInstall = await manager.getRepository(TenantAppInstallEntity).save(install);
      if (version) {
        await this.capabilityPolicy.setTenantCapabilities(
          {
            tenantId,
            appId: app.id,
            versionId: version.id,
            capabilities,
            operatorId: userId,
          },
          manager.getRepository(AppCapabilityGrantEntity),
        );
      }
      return savedInstall;
    });
    return this.toInstallResponse(saved);
  }

  async upgradeApp(
    tenantId: number,
    code: string,
    operatorId?: number,
    capabilities: string[] = [],
  ) {
    const app = await this.findPublishedApp(code);
    if (!['static', 'iframe', 'service'].includes(app.type)) {
      throw new BadRequestException('App type does not support version upgrades');
    }
    this.assertCommerceAccess(
      await this.appLicenseAccessService.getAccessState(tenantId, { ...app, installed: true }),
      'open',
    );
    this.assertAvailability(await this.getAppAvailability(tenantId, app));

    const existing = await this.installRepo.findOne({
      where: { tenantId, appId: app.id, enabled: 1, deleteTime: IsNull() },
    });
    if (!existing) throw new BadRequestException('App is not installed');

    const target =
      app.type === 'service'
        ? await this.findActiveServiceVersion(app.id)
        : await this.findPublishedVersion(app.id);
    if (Number(existing.versionId || 0) === Number(target.id)) {
      throw new BadRequestException('App is already on the latest available version');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const installRepo = manager.getRepository(TenantAppInstallEntity);
      const lockedInstall = await installRepo.findOne({
        where: { id: existing.id, tenantId, appId: app.id, enabled: 1, deleteTime: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedInstall) throw new BadRequestException('App installation changed during upgrade');
      if (Number(lockedInstall.versionId || 0) === Number(target.id)) {
        throw new BadRequestException('App is already on the latest available version');
      }

      const availableTarget = await manager.getRepository(AppPackageVersionEntity).findOne({
        where: {
          id: target.id,
          appId: app.id,
          reviewStatus: 'approved',
          publishStatus: 'published',
          deleteTime: IsNull(),
        },
      } as any);
      if (!availableTarget) throw new BadRequestException('Upgrade version is no longer available');

      lockedInstall.versionId = availableTarget.id;
      lockedInstall.installedBy = operatorId ?? null;
      lockedInstall.installedTime = new Date();
      const savedInstall = await installRepo.save(lockedInstall);
      await this.capabilityPolicy.setTenantCapabilities(
        {
          tenantId,
          appId: app.id,
          versionId: availableTarget.id,
          capabilities,
          operatorId,
        },
        manager.getRepository(AppCapabilityGrantEntity),
      );
      return { install: savedInstall, version: availableTarget };
    });

    await this.appRuntimeSessionService.revokeInstall(tenantId, saved.install.id, 'upgraded');
    return {
      ...this.toInstallResponse(saved.install),
      version_id: saved.version.id,
      version: saved.version.version,
      update_available: false,
      ...this.toCapabilityResponse(
        await this.capabilityPolicy.getCapabilityState(
          tenantId,
          saved.version.id,
          normalizeAppCapabilities(saved.version.manifest),
        ),
      ),
    };
  }

  async getCapabilities(tenantId: number, code: string) {
    const { version } = await this.getInstalledPublishedVersion(tenantId, code);
    return this.capabilityPolicy.getCapabilityState(
      tenantId,
      version.id,
      normalizeAppCapabilities(version.manifest),
    );
  }

  async updateCapabilities(
    tenantId: number,
    code: string,
    capabilities: string[],
    operatorId?: number,
  ) {
    const { app, version } = await this.getInstalledPublishedVersion(tenantId, code);
    await this.dataSource.transaction((manager) =>
      this.capabilityPolicy.setTenantCapabilities(
        {
          tenantId,
          appId: app.id,
          versionId: version.id,
          capabilities,
          operatorId,
        },
        manager.getRepository(AppCapabilityGrantEntity),
      ),
    );
    return this.capabilityPolicy.getCapabilityState(
      tenantId,
      version.id,
      normalizeAppCapabilities(version.manifest),
    );
  }

  async uninstallApp(tenantId: number, code: string) {
    const app = await this.findApp(code);
    const existing = await this.installRepo.findOne({
      where: { tenantId, appId: app.id, deleteTime: IsNull() },
    });
    if (!existing) {
      return { code, installed: false };
    }

    existing.enabled = 0;
    await this.appRuntimeSessionService.revokeInstall(tenantId, existing.id, 'uninstalled');
    await this.installRepo.save(existing);
    return { code, installed: false };
  }

  exchangeIframeLaunch(tenantId: number, userId: number, launchToken: string) {
    return this.appIframeLaunchService.exchange({
      tenantId,
      userId,
      launchToken: String(launchToken || '').trim(),
    });
  }

  async getOpenMetadata(
    tenantId: number,
    code: string,
    userId?: number,
    clientInfo: AppOpenClientInfo = {},
  ) {
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

      const commerce = await this.appLicenseAccessService.getAccessState(tenantId, {
        ...app,
        installed: true,
      });
      if (!commerce.can_open) {
        const denial = this.commerceDenial(commerce);
        return await fail(denial.reasonCode, new BadRequestException(denial.message));
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
          new BadRequestException(
            availability.availability_reason || 'App is not available for this tenant',
          ),
        );
      }

      if (app.type === 'service') {
        return await fail(
          'service_not_openable',
          new BadRequestException('Service apps cannot be opened directly'),
        );
      }

      if (app.type === 'static' || app.type === 'iframe') {
        try {
          version = await this.resolveOpenVersion(app, install);
        } catch (error) {
          if (
            error instanceof BadRequestException &&
            error.message === APP_OPEN_FAILURE_MESSAGES.upgrade_required
          ) {
            return await fail('upgrade_required', error);
          }
          if (
            app.type === 'static' &&
            error instanceof BadRequestException &&
            error.message === 'App has no published version'
          ) {
            return await fail('published_version_missing', error);
          }
          if (app.type === 'static') throw error;
          version = null;
        }
      }

      openMode = app.type === 'internal' ? 'internal_route' : 'iframe';
      let runtime = await this.appRuntimeContextService
        .buildBootstrap({ tenantId, userId, app, version })
        .catch(() => null);
      if (this.appRuntimeSessionService.isEnabled() && runtime) {
        runtime = { ...runtime, context: null };
        if (version && userId) {
          const capabilityState = await this.capabilityPolicy.getCapabilityState(
            tenantId,
            version.id,
            normalizeAppCapabilities(version.manifest),
          );
          if (capabilityState.effective.length) {
            const issued = await this.appRuntimeSessionService.issue({
              tenantId,
              userId,
              appId: app.id,
              versionId: version.id,
              installId: install.id,
              capabilities: capabilityState.effective,
            });
            runtime = {
              ...runtime,
              session: { token: issued.token, expires_at: issued.expires_at },
            } as typeof runtime & { session: { token: string; expires_at: string } };
          }
        }
      }
      let launch: Awaited<ReturnType<AppIframeLaunchService['create']>> | null = null;
      const iframeEntryUrl =
        app.type === 'iframe' ? this.resolveIframeEntryUrl(app.entryUrl, version) : app.entryUrl;
      if (app.type === 'iframe' && version && userId && this.appIframeLaunchService.isEnabled()) {
        const capabilityState = await this.capabilityPolicy.getCapabilityState(
          tenantId,
          version.id,
          normalizeAppCapabilities(version.manifest),
        );
        launch = await this.appIframeLaunchService.create({
          tenantId,
          userId,
          appId: app.id,
          versionId: version.id,
          installId: install.id,
          entryUrl: iframeEntryUrl,
          allowedOrigins: Array.isArray(version.manifest?.allowedOrigins)
            ? version.manifest.allowedOrigins
            : [],
          capabilities: capabilityState.effective,
        });
      }
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
        entry_url: iframeEntryUrl,
        sandbox:
          app.type === 'internal'
            ? ''
            : app.type === 'iframe'
              ? EXTERNAL_IFRAME_SANDBOX
              : STATIC_APP_SANDBOX,
        version: version?.version || '',
        runtime,
        launch,
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

  private async toInstalledAppResponse(
    tenantId: number,
    app: AppPackageEntity,
    install: TenantAppInstallEntity,
    commerceByAppId: Map<number, TenantAppCommerceAccess>,
    serviceStateByAppId: Map<number, { versionId: number; version: string }>,
    versionState: AppCatalogVersionState,
  ) {
    const availability = await this.getAppAvailability(tenantId, app);
    const commerce = this.requireCommerceState(commerceByAppId, app.id);
    const serviceState = this.toTenantServiceState(
      app,
      install,
      serviceStateByAppId,
      availability,
      commerce,
    );
    return {
      ...this.toAppResponse(app),
      ...availability,
      ...this.toCommerceResponse(
        commerce,
        availability,
        Number(install.enabled) === 1,
        app,
        serviceState,
      ),
      ...serviceState,
      ...this.toVersionResponse(app, install, versionState),
    };
  }

  private toCommerceResponse(
    commerce: TenantAppCommerceAccess,
    availability: AppAvailability,
    installed: boolean,
    app: AppPackageEntity,
    serviceState: Record<string, unknown>,
  ) {
    const serviceReady = app.type !== 'service' || serviceState.service_status === 'ready';
    return {
      commerce,
      can_install: availability.available && commerce.can_install && serviceReady,
      can_open: app.type !== 'service' && availability.available && installed && commerce.can_open,
      commerce_action: commerce.action,
    };
  }

  private requireCommerceState(states: Map<number, TenantAppCommerceAccess>, appId: number) {
    const state = states.get(Number(appId));
    if (!state) throw new BadRequestException('Application license state is unavailable');
    return state;
  }

  private assertCommerceAccess(commerce: TenantAppCommerceAccess, transition: 'install' | 'open') {
    const allowed = transition === 'install' ? commerce.can_install : commerce.can_open;
    if (!allowed) throw new BadRequestException(this.commerceDenial(commerce).message);
  }

  private commerceDenial(commerce: TenantAppCommerceAccess): {
    reasonCode: Extract<
      AppOpenFailureReason,
      'license_required' | 'license_expired' | 'license_revoked'
    >;
    message: string;
  } {
    if (commerce.access_status === 'expired') {
      return { reasonCode: 'license_expired', message: APP_OPEN_FAILURE_MESSAGES.license_expired };
    }
    if (commerce.access_status === 'revoked') {
      return { reasonCode: 'license_revoked', message: APP_OPEN_FAILURE_MESSAGES.license_revoked };
    }
    return { reasonCode: 'license_required', message: APP_OPEN_FAILURE_MESSAGES.license_required };
  }

  private assertAvailability(availability: AppAvailability) {
    if (!availability.available) {
      throw new BadRequestException(
        availability.availability_reason || 'App is not available for this tenant',
      );
    }
  }

  async getAppAvailability(
    tenantId: number,
    app: Partial<AppPackageEntity>,
  ): Promise<AppAvailability> {
    const saasModuleCode = app.saasModuleCode || '';
    const systemModuleCode = app.systemModuleCode || '';

    if (saasModuleCode) {
      try {
        await this.saasModuleService.assertTenantModuleEnabled(tenantId, saasModuleCode);
      } catch (error) {
        return this.createAvailability(
          false,
          'missing_plan_module',
          this.getErrorMessage(error),
          app,
        );
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
        return this.createAvailability(
          false,
          status,
          diagnosis.reason || 'App is not available for this tenant',
          app,
        );
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

  private async findPublishedVersionOrNull(appId: number) {
    return this.versionRepo.findOne({
      where: { appId, reviewStatus: 'approved', publishStatus: 'published', deleteTime: IsNull() },
      order: { id: 'DESC' },
    } as any);
  }

  private async findActiveServiceVersion(appId: number) {
    const instance = await this.instanceRepo.findOne({
      where: {
        appId,
        role: 'active',
        processStatus: 'online',
        healthStatus: 'healthy',
      },
    });
    if (!instance) {
      throw new BadRequestException('Service app has no healthy active version');
    }

    const version = await this.versionRepo.findOne({
      where: {
        id: instance.versionId,
        appId,
        reviewStatus: 'approved',
        publishStatus: 'published',
        deleteTime: IsNull(),
      },
    } as any);
    if (!version) {
      throw new BadRequestException('Service app has no healthy active version');
    }
    return version;
  }

  private resolveIframeEntryUrl(appEntryUrl: string, version: AppPackageVersionEntity | null) {
    try {
      const candidate =
        version && typeof version.manifest?.entry === 'string'
          ? version.manifest.entry
          : appEntryUrl;
      const entryUrl = normalizeExternalHttpUrl(candidate, {
        label: 'Iframe app entry',
        httpsOnly: true,
      });
      if (!version) return entryUrl;
      const origins = Array.isArray(version.manifest?.allowedOrigins)
        ? version.manifest.allowedOrigins.map((value) => this.normalizeIframeOrigin(value))
        : [];
      if (!origins.includes(new URL(entryUrl).origin)) {
        throw new Error('origin mismatch');
      }
      return entryUrl;
    } catch {
      throw new BadRequestException('Iframe version origin is invalid');
    }
  }

  private normalizeIframeOrigin(value: unknown) {
    const parsed = new URL(String(value || '').trim());
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('invalid origin');
    }
    return parsed.origin;
  }

  private async getInstalledPublishedVersion(tenantId: number, code: string) {
    const app = await this.findPublishedApp(code);
    const install = await this.installRepo.findOne({
      where: { tenantId, appId: app.id, enabled: 1, deleteTime: IsNull() },
    });
    if (!install) {
      throw new BadRequestException('App is not installed');
    }
    if (!install.versionId) {
      throw new BadRequestException(APP_OPEN_FAILURE_MESSAGES.upgrade_required);
    }
    let version: AppPackageVersionEntity;
    try {
      version = await this.findVersionById(app.id, Number(install.versionId));
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      throw new BadRequestException(APP_OPEN_FAILURE_MESSAGES.upgrade_required);
    }
    return { app, install, version };
  }

  private async loadVersionStates(
    tenantId: number,
    apps: AppPackageEntity[],
    installByAppId: Map<number, TenantAppInstallEntity>,
    serviceStateByAppId: Map<number, { versionId: number; version: string }>,
  ) {
    const versionedAppIds = apps
      .filter((app) => app.type === 'static' || app.type === 'iframe' || app.type === 'service')
      .map((app) => Number(app.id))
      .filter(Boolean);
    if (!versionedAppIds.length) return new Map<number, AppCatalogVersionState>();

    const versions = await this.versionRepo.find({
      where: {
        appId: In(versionedAppIds),
        reviewStatus: 'approved',
        publishStatus: 'published',
        deleteTime: IsNull(),
      } as any,
      order: { id: 'DESC' },
    });
    const versionById = new Map(versions.map((version) => [Number(version.id), version]));
    const latestByAppId = new Map<number, AppPackageVersionEntity>();
    for (const version of versions) {
      const appId = Number(version.appId);
      if (!latestByAppId.has(appId)) latestByAppId.set(appId, version);
    }

    const versionsByAppId = new Map<number, AppPackageVersionEntity[]>();
    for (const version of versions) {
      const appId = Number(version.appId);
      versionsByAppId.set(appId, [...(versionsByAppId.get(appId) || []), version]);
    }

    const appById = new Map(apps.map((app) => [Number(app.id), app]));
    const entries = await Promise.all(
      versionedAppIds.map(async (appId) => {
        const app = appById.get(appId);
        const install = installByAppId.get(appId);
        const installedVersionId = Number(install?.versionId || 0);
        const selected =
          Number(install?.enabled) === 1 && installedVersionId
            ? versionById.get(installedVersionId) || null
            : latestByAppId.get(appId) || null;
        const serviceVersionId = serviceStateByAppId.get(appId)?.versionId;
        const latest =
          app?.type === 'service'
            ? serviceVersionId
              ? versionById.get(serviceVersionId) || null
              : null
            : latestByAppId.get(appId) || null;
        const capability = selected
          ? await this.capabilityPolicy.getCapabilityState(
              tenantId,
              selected.id,
              normalizeAppCapabilities(selected.manifest),
            )
          : this.emptyCapabilityState();
        const latestCapability =
          latest && Number(latest.id) !== Number(selected?.id || 0)
            ? await this.capabilityPolicy.getCapabilityState(
                tenantId,
                latest.id,
                normalizeAppCapabilities(latest.manifest),
              )
            : capability;
        return [
          appId,
          {
            selected,
            latest,
            byId: new Map(
              (versionsByAppId.get(appId) || []).map((version) => [Number(version.id), version]),
            ),
            capability,
            latestCapability,
          } satisfies AppCatalogVersionState,
        ] as const;
      }),
    );
    return new Map(entries);
  }

  private async loadServiceRuntimeStates(apps: AppPackageEntity[]) {
    const serviceAppIds = apps
      .filter((app) => app.type === 'service')
      .map((app) => Number(app.id))
      .filter(Boolean);
    if (!serviceAppIds.length) {
      return new Map<number, { versionId: number; version: string }>();
    }

    const instances = await this.instanceRepo.find({
      where: {
        appId: In(serviceAppIds),
        role: 'active',
        processStatus: 'online',
        healthStatus: 'healthy',
      },
      order: { id: 'DESC' },
    } as any);
    const instancesByAppId = new Map<number, AppServiceInstanceEntity[]>();
    for (const instance of instances) {
      const appId = Number(instance.appId);
      instancesByAppId.set(appId, [...(instancesByAppId.get(appId) || []), instance]);
    }

    const singleActiveInstances = [...instancesByAppId.values()]
      .filter((items) => items.length === 1)
      .map((items) => items[0]);
    const versionIds = singleActiveInstances.map((instance) => Number(instance.versionId));
    if (!versionIds.length) {
      return new Map<number, { versionId: number; version: string }>();
    }

    const versions = await this.versionRepo.find({
      where: {
        id: In(versionIds),
        reviewStatus: 'approved',
        publishStatus: 'published',
        deleteTime: IsNull(),
      },
    } as any);
    const versionById = new Map(versions.map((version) => [Number(version.id), version]));
    return new Map(
      singleActiveInstances.flatMap((instance) => {
        const version = versionById.get(Number(instance.versionId));
        if (!version || Number(version.appId) !== Number(instance.appId)) return [];
        return [
          [
            Number(instance.appId),
            { versionId: Number(version.id), version: version.version },
          ] as const,
        ];
      }),
    );
  }

  private toTenantServiceState(
    app: AppPackageEntity,
    install: TenantAppInstallEntity | undefined,
    serviceStateByAppId: Map<number, { versionId: number; version: string }>,
    availability: AppAvailability,
    commerce: TenantAppCommerceAccess,
  ) {
    if (app.type !== 'service') return {};
    const runtime = serviceStateByAppId.get(Number(app.id));
    const installed = Boolean(install && Number(install.enabled) === 1);
    const versionMatches = Boolean(
      runtime && install?.versionId && Number(install.versionId) === runtime.versionId,
    );
    return {
      service_status: runtime
        ? installed && !versionMatches
          ? 'update_required'
          : 'ready'
        : 'unavailable',
      service_version: runtime?.version || '',
      service_callable:
        Boolean(runtime) &&
        installed &&
        versionMatches &&
        availability.available &&
        commerce.can_open,
    };
  }

  private emptyCapabilityState() {
    return {
      requested: [] as string[],
      platform_approved: [] as string[],
      tenant_approved: [] as string[],
      effective: [] as string[],
    };
  }

  private emptyVersionState(): AppCatalogVersionState {
    const capability = this.emptyCapabilityState();
    return {
      selected: null,
      latest: null,
      byId: new Map(),
      capability,
      latestCapability: capability,
    };
  }

  private toVersionResponse(
    app: AppPackageEntity,
    install: TenantAppInstallEntity | undefined,
    state: AppCatalogVersionState,
  ) {
    if (!['static', 'iframe', 'service'].includes(app.type)) {
      return {
        installed_version_id: null,
        installed_version: '',
        latest_version_id: null,
        latest_version: '',
        update_available: false,
        latest_requested_capabilities: [] as string[],
        latest_platform_approved_capabilities: [] as string[],
        new_capabilities: [] as string[],
      };
    }

    const installedVersionId = Number(install?.versionId || 0);
    const installedVersion = installedVersionId ? state.byId.get(installedVersionId) || null : null;
    const latestVersion = state.latest;
    const latestVersionId = Number(latestVersion?.id || 0);
    const installedRequested = new Set(normalizeAppCapabilities(installedVersion?.manifest));
    const latestRequested = normalizeAppCapabilities(latestVersion?.manifest);

    return {
      installed_version_id: installedVersionId || null,
      installed_version: installedVersion?.version || '',
      latest_version_id: latestVersionId || null,
      latest_version: latestVersion?.version || '',
      update_available:
        Boolean(install && Number(install.enabled) === 1 && installedVersionId && latestVersionId) &&
        installedVersionId !== latestVersionId,
      latest_requested_capabilities: latestRequested,
      latest_platform_approved_capabilities: state.latestCapability.platform_approved,
      new_capabilities: latestRequested.filter((capability) => !installedRequested.has(capability)),
    };
  }

  private toCapabilityResponse(state: ReturnType<AppTenantService['emptyCapabilityState']>) {
    return {
      requested_capabilities: state.requested,
      platform_approved_capabilities: state.platform_approved,
      tenant_approved_capabilities: state.tenant_approved,
      effective_capabilities: state.effective,
    };
  }

  private async resolveOpenVersion(app: AppPackageEntity, install: TenantAppInstallEntity) {
    if (!install.versionId) {
      await this.findPublishedVersion(app.id);
      throw new BadRequestException(APP_OPEN_FAILURE_MESSAGES.upgrade_required);
    }
    try {
      return await this.findVersionById(app.id, Number(install.versionId));
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      throw new BadRequestException(APP_OPEN_FAILURE_MESSAGES.upgrade_required);
    }
  }

  private async findVersionById(appId: number, id: number) {
    const version = await this.versionRepo.findOne({
      where: {
        id,
        appId,
        reviewStatus: 'approved',
        publishStatus: 'published',
        deleteTime: IsNull(),
      },
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
      screenshots: Array.isArray(app.screenshots) ? app.screenshots : [],
      documentation_url: app.documentationUrl || '',
      support_url: app.supportUrl || '',
      changelog: app.changelog || '',
      status: app.status,
      visibility: app.visibility || 'marketplace',
      entry_mode: app.entryMode || '',
      entry_url: app.entryUrl || '',
      runtime_type: app.runtimeType || this.runtimeType(app.type),
      trust_level: app.trustLevel || this.trustLevel(app.type),
      service_health_path: app.serviceHealthPath || '',
      runtime_config: app.runtimeConfig || null,
      system_module_code: app.systemModuleCode || '',
      saas_module_code: app.saasModuleCode || '',
    };
  }

  private runtimeType(type?: AppPackageEntity['type']) {
    if (type === 'internal') return 'native';
    return type || 'static';
  }

  private trustLevel(type?: AppPackageEntity['type']) {
    if (type === 'internal' || type === 'service') return 'platform_trusted';
    if (type === 'iframe') return 'external_managed';
    return 'static_sandboxed';
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
