import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';

import { SaasModuleService } from '../../saas/services/saas-module.service';
import { SAAS_TO_SYSTEM_MODULE_BRIDGE, SYSTEM_MODULE_STATUSES } from '../constants';
import type { SystemModuleEventType, SystemModuleStatus } from '../constants';
import { SystemModuleApiEntity } from '../entities/system-module-api.entity';
import { SystemModuleDependencyEntity } from '../entities/system-module-dependency.entity';
import { SystemModuleEventEntity } from '../entities/system-module-event.entity';
import { SystemModulePermissionEntity } from '../entities/system-module-permission.entity';
import { SystemModuleEntity } from '../entities/system-module.entity';
import { SystemModuleSaasBridgeEntity } from '../entities/system-module-saas-bridge.entity';
import { SystemTenantModuleEntity } from '../entities/system-tenant-module.entity';
import { BUILT_IN_SYSTEM_MODULES, SystemModuleManifest } from '../manifests/built-in-modules';
import { PluginModuleManifestDto } from '../dto/plugin-module-manifest.dto';

export interface SystemModuleListQuery {
  keyword?: string;
  status?: SystemModuleStatus | string;
  source?: string;
}

export interface SystemModuleSaasBridgeListQuery {
  saas_module_code?: string;
  system_module_code?: string;
  enabled?: number | string;
}

export interface SaveSystemModuleSaasBridgeInput {
  saas_module_code: string;
  system_module_code: string;
  enabled?: number;
  remark?: string;
}

interface ImportManifestOptions {
  validateExisting?: (existing: SystemModuleEntity, manifest: SystemModuleManifest) => void;
}

@Injectable()
export class SystemModuleRegistryService implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SystemModuleEntity)
    private readonly moduleRepo: Repository<SystemModuleEntity>,
    @InjectRepository(SystemModuleDependencyEntity)
    private readonly dependencyRepo: Repository<SystemModuleDependencyEntity>,
    @InjectRepository(SystemModulePermissionEntity)
    private readonly permissionRepo: Repository<SystemModulePermissionEntity>,
    @InjectRepository(SystemModuleApiEntity)
    private readonly apiRepo: Repository<SystemModuleApiEntity>,
    @InjectRepository(SystemTenantModuleEntity)
    private readonly tenantModuleRepo: Repository<SystemTenantModuleEntity>,
    @InjectRepository(SystemModuleEventEntity)
    private readonly eventRepo: Repository<SystemModuleEventEntity>,
    @InjectRepository(SystemModuleSaasBridgeEntity)
    private readonly bridgeRepo: Repository<SystemModuleSaasBridgeEntity>,
    private readonly saasModuleService: SaasModuleService,
  ) {}

  async onModuleInit() {
    await this.registerBuiltInModules();
  }

  async registerBuiltInModules() {
    return this.importManifests(BUILT_IN_SYSTEM_MODULES);
  }

  async registerPluginManifest(dto: PluginModuleManifestDto, operatorId?: number) {
    void operatorId;
    this.assertMetadataOnlyHooks(dto.hooks);

    const manifest: SystemModuleManifest = {
      code: dto.code,
      name: dto.name,
      source: 'plugin',
      version: dto.version,
      description: dto.description || '',
      category: dto.category || 'plugin',
      icon: dto.icon || 'ri:puzzle-line',
      status: 'installed',
      entryRoute: '',
      sort: 500,
      routes: dto.routes || [],
      dependencies: (dto.dependencies || []).map((dependency) => ({
        code: dependency.code,
        versionRange: dependency.version || '',
        required: true,
      })),
      permissions: (dto.permissions || []).map((permission) => ({
        slug: permission.slug,
        bindingType: permission.bindingType || 'owned',
      })),
      apis: (dto.api_endpoints || []).map((api) => ({
        method: api.method,
        path: api.path,
        permissionSlug: api.permission_slug || '',
        tenantScoped: Boolean(api.tenant_scoped),
      })),
      configSchema: dto.config_schema || {},
    };

    await this.dataSource.transaction(async (manager) => {
      const moduleRepo = manager.getRepository(SystemModuleEntity);
      const existing = await moduleRepo.findOne({
        where: { code: dto.code },
        lock: { mode: 'pessimistic_write' },
      });
      this.assertPluginCodeAvailable(existing);

      await this.importManifestsWithManager(manager, [manifest], {
        validateExisting: (module) => this.assertPluginCodeAvailable(module),
      });
    });
    return this.getModule(dto.code);
  }

  async importManifests(manifests: SystemModuleManifest[]) {
    return this.dataSource.transaction((manager) =>
      this.importManifestsWithManager(manager, manifests),
    );
  }

  private async importManifestsWithManager(
    manager: EntityManager,
    manifests: SystemModuleManifest[],
    options: ImportManifestOptions = {},
  ) {
    const moduleRepo = manager.getRepository(SystemModuleEntity);
    const dependencyRepo = manager.getRepository(SystemModuleDependencyEntity);
    const permissionRepo = manager.getRepository(SystemModulePermissionEntity);
    const apiRepo = manager.getRepository(SystemModuleApiEntity);
    const eventRepo = manager.getRepository(SystemModuleEventEntity);
    const imported = [];

    for (const manifest of manifests) {
      const inserted = await this.insertManifestModule(moduleRepo, manifest);
      const existing = await moduleRepo.findOne({
        where: { code: manifest.code },
        lock: { mode: 'pessimistic_write' },
      });
      if (!existing) {
        throw new NotFoundException(
          `System module ${manifest.code} not found after manifest insert`,
        );
      }
      options.validateExisting?.(existing, manifest);

      const manifestChanged = inserted ? false : this.hasManifestChanged(existing, manifest);
      const metadata = this.toManifestMetadata(manifest, existing);
      await moduleRepo.update({ code: manifest.code }, metadata);
      imported.push(this.toResponse({ ...existing, ...metadata }));

      await this.replaceDependencies(dependencyRepo, manifest);
      await this.replacePermissions(permissionRepo, manifest);
      await this.replaceApis(apiRepo, manifest);

      if (inserted) {
        await this.recordEvent(
          eventRepo,
          manifest.code,
          'install',
          'success',
          `Imported module ${manifest.code}`,
        );
      } else if (manifestChanged) {
        await this.recordEvent(
          eventRepo,
          manifest.code,
          'upgrade',
          'success',
          `Synced module ${manifest.code}`,
          {
            metadata: { version: manifest.version },
          },
        );
      }
    }

    return imported;
  }

  private async insertManifestModule(
    repo: Repository<SystemModuleEntity>,
    manifest: SystemModuleManifest,
  ) {
    try {
      await repo.insert(
        repo.create({
          code: manifest.code,
          name: manifest.name,
          source: manifest.source,
          version: manifest.version,
          description: manifest.description,
          category: manifest.category,
          icon: manifest.icon,
          status: manifest.status,
          entryRoute: manifest.entryRoute,
          manifest: manifest as unknown as Record<string, unknown>,
          configSchema: manifest.configSchema,
          healthStatus: 'unknown',
          sort: manifest.sort,
        }),
      );
      return true;
    } catch (error) {
      if (this.isDuplicateModuleCodeError(error)) {
        return false;
      }
      throw error;
    }
  }

  private toManifestMetadata(manifest: SystemModuleManifest, existing: SystemModuleEntity) {
    return {
      name: manifest.name,
      source: manifest.source,
      version: manifest.version,
      description: manifest.description,
      category: manifest.category,
      icon: manifest.icon,
      entryRoute: manifest.entryRoute,
      manifest: manifest as unknown as Record<string, unknown>,
      configSchema: manifest.configSchema,
      healthStatus: existing.healthStatus || 'unknown',
      sort: manifest.sort,
      remark: existing.remark,
    };
  }

  private isDuplicateModuleCodeError(error: unknown) {
    const err = error as { code?: string; errno?: number; message?: string };
    return (
      err?.code === 'ER_DUP_ENTRY' ||
      err?.code === '23505' ||
      err?.errno === 1062 ||
      String(err?.message || '')
        .toLowerCase()
        .includes('duplicate')
    );
  }

  async listModules(query: SystemModuleListQuery = {}) {
    const modules = await this.moduleRepo.find({ order: { sort: 'ASC', id: 'ASC' } });
    const keyword = query.keyword?.trim().toLowerCase();

    return modules
      .filter((module) => {
        if (query.status && module.status !== query.status) return false;
        if (query.source && module.source !== query.source) return false;
        if (!keyword) return true;
        return [module.code, module.name, module.description, module.category].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(keyword),
        );
      })
      .map((module) => this.toResponse(module));
  }

  async listTenantModules(tenantId: number) {
    const [modules, tenantModules, saasModules] = await Promise.all([
      this.moduleRepo.find({ where: { status: 'enabled' }, order: { sort: 'ASC', id: 'ASC' } }),
      this.tenantModuleRepo.find({ where: { tenantId }, order: { id: 'ASC' } }),
      this.saasModuleService.listTenantModules(tenantId),
    ]);
    const tenantModuleByCode = new Map(tenantModules.map((module) => [module.moduleCode, module]));
    const planEntitledModuleCodes = await this.resolvePlanEntitledSystemModuleCodes(
      saasModules.map((module) => module.code).filter((code): code is string => Boolean(code)),
    );

    return modules.map((module) => {
      const tenantModule = tenantModuleByCode.get(module.code);
      const explicitlyEnabled = tenantModule ? Number(tenantModule.enabled) === 1 : false;
      const planEnabled = planEntitledModuleCodes.has(module.code);
      const tenantEnabled = explicitlyEnabled || planEnabled;
      return {
        ...this.toResponse(module),
        explicit_enabled: explicitlyEnabled,
        plan_enabled: planEnabled,
        tenant_enabled: tenantEnabled,
        entitlement_source: explicitlyEnabled
          ? tenantModule?.source || 'platform'
          : planEnabled
            ? 'plan'
            : null,
      };
    });
  }

  listTenantGrants(tenantId: number) {
    return this.listTenantModules(this.assertTenantId(tenantId));
  }

  async grantTenantModule(
    tenantIdValue: number,
    codeValue: string,
    operatorId?: number,
    reason = '',
  ) {
    const tenantId = this.assertTenantId(tenantIdValue);
    const code = this.requiredModuleCode(codeValue);
    return this.dataSource.transaction(async (manager) => {
      const moduleRepo = manager.getRepository(SystemModuleEntity);
      const tenantModuleRepo = manager.getRepository(SystemTenantModuleEntity);
      const eventRepo = manager.getRepository(SystemModuleEventEntity);
      const module = await moduleRepo.findOne({
        where: { code, deleteTime: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!module) throw new NotFoundException(`System module ${code} not found`);
      if (module.status !== 'enabled') {
        throw new BadRequestException(`System module ${code} is not enabled`);
      }

      const existing = await tenantModuleRepo.findOne({
        where: { tenantId, moduleCode: code },
        withDeleted: true,
        lock: { mode: 'pessimistic_write' },
      } as any);
      if (existing && Number(existing.enabled) === 1 && !existing.deleteTime) {
        return this.toTenantGrantResponse(existing);
      }

      const grant = existing || tenantModuleRepo.create({ tenantId, moduleCode: code });
      grant.tenantId = tenantId;
      grant.moduleCode = code;
      grant.enabled = 1;
      grant.source = 'platform';
      grant.startTime = new Date();
      grant.endTime = null;
      grant.deleteTime = null;
      const saved = await tenantModuleRepo.save(grant);
      await this.recordEvent(
        eventRepo,
        code,
        'tenant_grant',
        'success',
        this.eventReason(reason, `Granted module ${code} to tenant ${tenantId}`),
        { operatorId, metadata: { tenantId, source: 'platform' } },
      );
      return this.toTenantGrantResponse(saved);
    });
  }

  async revokeTenantModule(
    tenantIdValue: number,
    codeValue: string,
    operatorId?: number,
    reason = '',
  ) {
    const tenantId = this.assertTenantId(tenantIdValue);
    const code = this.requiredModuleCode(codeValue);
    return this.dataSource.transaction(async (manager) => {
      const moduleRepo = manager.getRepository(SystemModuleEntity);
      const tenantModuleRepo = manager.getRepository(SystemTenantModuleEntity);
      const eventRepo = manager.getRepository(SystemModuleEventEntity);
      const module = await moduleRepo.findOne({
        where: { code, deleteTime: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!module) throw new NotFoundException(`System module ${code} not found`);

      const grant = await tenantModuleRepo.findOne({
        where: { tenantId, moduleCode: code },
        withDeleted: true,
        lock: { mode: 'pessimistic_write' },
      } as any);
      if (!grant || Number(grant.enabled) === 0) {
        return this.toTenantGrantResponse(
          grant || { tenantId, moduleCode: code, enabled: 0, source: 'platform' },
        );
      }

      grant.enabled = 0;
      grant.endTime = new Date();
      grant.deleteTime = null;
      const saved = await tenantModuleRepo.save(grant);
      await this.recordEvent(
        eventRepo,
        code,
        'tenant_revoke',
        'success',
        this.eventReason(reason, `Revoked module ${code} from tenant ${tenantId}`),
        { operatorId, metadata: { tenantId, source: grant.source || 'platform' } },
      );
      return this.toTenantGrantResponse(saved);
    });
  }

  async listSaasBridges(query: SystemModuleSaasBridgeListQuery = {}) {
    const bridgeRows = await this.bridgeRepo.find({
      where: { deleteTime: IsNull() },
      order: { saasModuleCode: 'ASC', systemModuleCode: 'ASC', id: 'ASC' },
    });

    const enabledFilter =
      query.enabled === undefined || query.enabled === '' ? undefined : Number(query.enabled);

    return bridgeRows
      .filter((row) => {
        if (query.saas_module_code && row.saasModuleCode !== query.saas_module_code) return false;
        if (query.system_module_code && row.systemModuleCode !== query.system_module_code)
          return false;
        if (enabledFilter !== undefined && Number(row.enabled) !== enabledFilter) return false;
        return true;
      })
      .map((row) => this.toSaasBridgeResponse(row));
  }

  async saveSaasBridge(dto: SaveSystemModuleSaasBridgeInput, operatorId?: number) {
    void operatorId;
    const saasModuleCode = dto.saas_module_code?.trim();
    const systemModuleCode = dto.system_module_code?.trim();
    if (!saasModuleCode || !systemModuleCode) {
      throw new BadRequestException('SaaS module code and system module code are required');
    }

    await this.assertSaasModuleExists(saasModuleCode);
    await this.findModule(systemModuleCode);

    const existing = await this.bridgeRepo.findOne({
      where: { saasModuleCode, systemModuleCode },
      withDeleted: true,
    } as any);
    const bridge =
      existing || this.bridgeRepo.create({ saasModuleCode, systemModuleCode, source: 'platform' });

    bridge.saasModuleCode = saasModuleCode;
    bridge.systemModuleCode = systemModuleCode;
    bridge.enabled = dto.enabled === undefined ? 1 : Number(dto.enabled);
    bridge.source = bridge.source || 'platform';
    bridge.remark = dto.remark || '';
    bridge.deleteTime = null;

    return this.toSaasBridgeResponse(await this.bridgeRepo.save(bridge));
  }

  async updateSaasBridgeStatus(id: number, enabled: number, operatorId?: number) {
    void operatorId;
    const bridge = await this.bridgeRepo.findOne({ where: { id, deleteTime: IsNull() } });
    if (!bridge) {
      throw new NotFoundException(`SaaS bridge ${id} not found`);
    }

    bridge.enabled = Number(enabled);
    return this.toSaasBridgeResponse(await this.bridgeRepo.save(bridge));
  }

  async getModule(code: string) {
    const module = await this.findModule(code);
    const [dependencies, permissions, apis, events] = await Promise.all([
      this.dependencyRepo.find({ where: { moduleCode: code }, order: { id: 'ASC' } }),
      this.permissionRepo.find({ where: { moduleCode: code }, order: { id: 'ASC' } }),
      this.apiRepo.find({ where: { moduleCode: code }, order: { id: 'ASC' } }),
      this.listEvents(code),
    ]);

    return {
      ...this.toResponse(module),
      dependencies: dependencies.map((dependency) => ({
        depends_on_code: dependency.dependsOnCode,
        version_range: dependency.versionRange || '',
        required: Number(dependency.required) === 1,
      })),
      permissions: permissions.map((permission) => ({
        permission_slug: permission.permissionSlug,
        binding_type: permission.bindingType,
      })),
      apis: apis.map((api) => ({
        method: api.method,
        path: api.path,
        permission_slug: api.permissionSlug || '',
        tenant_scoped: Number(api.tenantScoped) === 1,
      })),
      events,
    };
  }

  async updateStatus(code: string, status: SystemModuleStatus, operatorId?: number) {
    if (!SYSTEM_MODULE_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid system module status: ${status}`);
    }

    return this.dataSource.transaction(async (manager) => {
      const moduleRepo = manager.getRepository(SystemModuleEntity);
      const eventRepo = manager.getRepository(SystemModuleEventEntity);
      const module = await moduleRepo.findOne({
        where: { code, deleteTime: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!module) {
        throw new NotFoundException(`System module ${code} not found`);
      }
      if (module.status === status) {
        return this.toResponse(module);
      }

      module.status = status;
      const saved = await moduleRepo.save(module);
      await this.recordEvent(
        eventRepo,
        code,
        this.statusToEventType(status),
        'success',
        `Module ${code} status changed to ${status}`,
        {
          operatorId,
          metadata: { status },
        },
      );
      return this.toResponse(saved);
    });
  }

  async listEvents(code: string) {
    await this.findModule(code);
    const events = await this.eventRepo.find({
      where: { moduleCode: code },
      order: { createTime: 'DESC', id: 'DESC' },
      take: 50,
    });
    return events.map((event) => ({
      id: event.id,
      module_code: event.moduleCode,
      event_type: event.eventType,
      status: event.status,
      message: event.message || '',
      metadata: event.metadata || null,
      operator_id: event.operatorId,
      create_time: event.createTime,
    }));
  }

  private async replaceDependencies(
    repo: Repository<SystemModuleDependencyEntity>,
    manifest: SystemModuleManifest,
  ) {
    await repo.delete({ moduleCode: manifest.code });
    if (!manifest.dependencies.length) return;

    await repo.save(
      manifest.dependencies.map((dependency) =>
        repo.create({
          moduleCode: manifest.code,
          dependsOnCode: dependency.code,
          versionRange: dependency.versionRange || '',
          required: dependency.required === false ? 0 : 1,
        }),
      ),
    );
  }

  private async replacePermissions(
    repo: Repository<SystemModulePermissionEntity>,
    manifest: SystemModuleManifest,
  ) {
    await repo.delete({ moduleCode: manifest.code });
    if (!manifest.permissions.length) return;

    await repo.save(
      manifest.permissions.map((permission) =>
        repo.create({
          moduleCode: manifest.code,
          permissionSlug: permission.slug,
          bindingType: permission.bindingType || 'owned',
        }),
      ),
    );
  }

  private async replaceApis(
    repo: Repository<SystemModuleApiEntity>,
    manifest: SystemModuleManifest,
  ) {
    await repo.delete({ moduleCode: manifest.code });
    if (!manifest.apis.length) return;

    await repo.save(
      manifest.apis.map((api) =>
        repo.create({
          moduleCode: manifest.code,
          method: api.method.toUpperCase(),
          path: api.path,
          permissionSlug: api.permissionSlug || '',
          tenantScoped: api.tenantScoped ? 1 : 0,
        }),
      ),
    );
  }

  private async findModule(code: string) {
    const module = await this.moduleRepo.findOne({ where: { code } });
    if (!module) {
      throw new NotFoundException(`System module ${code} not found`);
    }
    return module;
  }

  private async assertSaasModuleExists(code: string) {
    const modules = await this.saasModuleService.listPlatformModules({});
    if (!modules.some((module) => module.code === code)) {
      throw new NotFoundException(`SaaS module ${code} not found`);
    }
  }

  private async resolvePlanEntitledSystemModuleCodes(saasModuleCodes: string[]) {
    const uniqueCodes = [...new Set(saasModuleCodes.filter(Boolean))];
    if (!uniqueCodes.length) {
      return new Set<string>();
    }

    const bridgeRows = await this.bridgeRepo.find({
      where: {
        saasModuleCode: In(uniqueCodes),
        deleteTime: IsNull(),
      },
    });

    if (bridgeRows.length) {
      return new Set(
        bridgeRows
          .filter((row) => Number(row.enabled) === 1)
          .map((row) => row.systemModuleCode)
          .filter(Boolean),
      );
    }

    return new Set(
      uniqueCodes.flatMap((saasModuleCode) => SAAS_TO_SYSTEM_MODULE_BRIDGE[saasModuleCode] || []),
    );
  }

  private statusToEventType(status: SystemModuleStatus): SystemModuleEventType {
    if (status === 'enabled') return 'enable';
    if (status === 'disabled') return 'disable';
    return 'upgrade';
  }

  private assertMetadataOnlyHooks(hooks?: Record<string, unknown>) {
    if (!hooks) return;
    const hasExecutableHookValue = Object.values(hooks).some((value) => value !== 'reserved');
    if (hasExecutableHookValue) {
      throw new BadRequestException('Plugin hooks are metadata-only and must use reserved values');
    }
  }

  private assertPluginCodeAvailable(existing: SystemModuleEntity | null) {
    if (existing && existing.source !== 'plugin') {
      throw new BadRequestException('Module code is already used by a non-plugin module');
    }
  }

  private async recordEvent(
    repo: Repository<SystemModuleEventEntity>,
    moduleCode: string,
    eventType: SystemModuleEventType,
    status: 'success' | 'failed',
    message: string,
    options: { operatorId?: number; metadata?: Record<string, unknown> } = {},
  ) {
    const event = repo.create({
      moduleCode,
      eventType,
      status,
      message,
      metadata: options.metadata || null,
      operatorId: options.operatorId,
    });
    return repo.save(event);
  }

  private hasManifestChanged(existing: SystemModuleEntity, manifest: SystemModuleManifest) {
    const expected = {
      name: manifest.name,
      source: manifest.source,
      version: manifest.version,
      description: manifest.description,
      category: manifest.category,
      icon: manifest.icon,
      entryRoute: manifest.entryRoute,
      manifest,
      configSchema: manifest.configSchema,
      sort: manifest.sort,
    };
    const current = {
      name: existing.name,
      source: existing.source,
      version: existing.version,
      description: existing.description,
      category: existing.category,
      icon: existing.icon,
      entryRoute: existing.entryRoute,
      manifest: existing.manifest,
      configSchema: existing.configSchema,
      sort: existing.sort,
    };

    return this.stableStringify(current) !== this.stableStringify(expected);
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      return `{${Object.keys(value as Record<string, unknown>)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${this.stableStringify((value as Record<string, unknown>)[key])}`,
        )
        .join(',')}}`;
    }
    return JSON.stringify(value);
  }

  private assertTenantId(value: number) {
    const tenantId = Number(value);
    if (!Number.isSafeInteger(tenantId) || tenantId <= 0) {
      throw new BadRequestException('A positive tenant id is required');
    }
    return tenantId;
  }

  private requiredModuleCode(value: string) {
    const code = String(value || '').trim();
    if (!code) throw new BadRequestException('System module code is required');
    return code;
  }

  private eventReason(value: string, fallback: string) {
    return (String(value || '').trim() || fallback).slice(0, 500);
  }

  private toResponse(module: Partial<SystemModuleEntity>) {
    return {
      id: module.id,
      code: module.code,
      name: module.name,
      source: module.source,
      version: module.version,
      description: module.description || '',
      category: module.category || '',
      icon: module.icon || '',
      status: module.status,
      entry_route: module.entryRoute || '',
      sort: Number(module.sort) || 0,
      config_schema: module.configSchema || {},
      health_status: module.healthStatus || 'unknown',
      create_time: module.createTime,
      update_time: module.updateTime,
    };
  }

  private toSaasBridgeResponse(row: Partial<SystemModuleSaasBridgeEntity>) {
    return {
      id: row.id,
      saas_module_code: row.saasModuleCode,
      system_module_code: row.systemModuleCode,
      enabled: Number(row.enabled) === 1,
      source: row.source || 'platform',
      remark: row.remark || '',
      create_time: row.createTime,
      update_time: row.updateTime,
    };
  }

  private toTenantGrantResponse(row: Partial<SystemTenantModuleEntity>) {
    return {
      id: row.id,
      tenant_id: row.tenantId,
      module_code: row.moduleCode,
      enabled: Number(row.enabled) === 1,
      source: row.source || 'platform',
      start_time: row.startTime,
      end_time: row.endTime,
      create_time: row.createTime,
      update_time: row.updateTime,
    };
  }
}
