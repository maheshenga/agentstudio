import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { SYSTEM_MODULE_STATUSES, SystemModuleEventType, SystemModuleStatus } from '../constants';
import { SystemModuleApiEntity } from '../entities/system-module-api.entity';
import { SystemModuleDependencyEntity } from '../entities/system-module-dependency.entity';
import { SystemModuleEventEntity } from '../entities/system-module-event.entity';
import { SystemModulePermissionEntity } from '../entities/system-module-permission.entity';
import { SystemModuleEntity } from '../entities/system-module.entity';
import { SystemTenantModuleEntity } from '../entities/system-tenant-module.entity';
import { BUILT_IN_SYSTEM_MODULES, SystemModuleManifest } from '../manifests/built-in-modules';

export interface SystemModuleListQuery {
  keyword?: string;
  status?: SystemModuleStatus | string;
  source?: string;
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
  ) {}

  async onModuleInit() {
    await this.registerBuiltInModules();
  }

  async registerBuiltInModules() {
    return this.importManifests(BUILT_IN_SYSTEM_MODULES);
  }

  async importManifests(manifests: SystemModuleManifest[]) {
    return this.dataSource.transaction(async (manager) => {
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
          throw new NotFoundException(`System module ${manifest.code} not found after manifest insert`);
        }

        const manifestChanged = inserted ? false : this.hasManifestChanged(existing, manifest);
        const metadata = this.toManifestMetadata(manifest, existing);
        await moduleRepo.update({ code: manifest.code }, metadata);
        imported.push(this.toResponse({ ...existing, ...metadata }));

        await this.replaceDependencies(dependencyRepo, manifest);
        await this.replacePermissions(permissionRepo, manifest);
        await this.replaceApis(apiRepo, manifest);

        if (inserted) {
          await this.recordEvent(eventRepo, manifest.code, 'install', 'success', `Imported module ${manifest.code}`);
        } else if (manifestChanged) {
          await this.recordEvent(eventRepo, manifest.code, 'upgrade', 'success', `Synced module ${manifest.code}`, {
            metadata: { version: manifest.version },
          });
        }
      }

      return imported;
    });
  }

  private async insertManifestModule(repo: Repository<SystemModuleEntity>, manifest: SystemModuleManifest) {
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
      String(err?.message || '').toLowerCase().includes('duplicate')
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
          String(value || '').toLowerCase().includes(keyword),
        );
      })
      .map((module) => this.toResponse(module));
  }

  async listTenantModules(tenantId: number) {
    const [modules, tenantModules] = await Promise.all([
      this.moduleRepo.find({ where: { status: 'enabled' }, order: { sort: 'ASC', id: 'ASC' } }),
      this.tenantModuleRepo.find({ where: { tenantId }, order: { id: 'ASC' } }),
    ]);
    const tenantModuleByCode = new Map(tenantModules.map((module) => [module.moduleCode, module]));

    return modules.map((module) => {
      const tenantModule = tenantModuleByCode.get(module.code);
      return {
        ...this.toResponse(module),
        tenant_enabled: tenantModule ? Number(tenantModule.enabled) === 1 : false,
        entitlement_source: tenantModule ? 'platform' : 'plan',
      };
    });
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

  private async replaceDependencies(repo: Repository<SystemModuleDependencyEntity>, manifest: SystemModuleManifest) {
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

  private async replacePermissions(repo: Repository<SystemModulePermissionEntity>, manifest: SystemModuleManifest) {
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

  private async replaceApis(repo: Repository<SystemModuleApiEntity>, manifest: SystemModuleManifest) {
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

  private statusToEventType(status: SystemModuleStatus): SystemModuleEventType {
    if (status === 'enabled') return 'enable';
    if (status === 'disabled') return 'disable';
    return 'upgrade';
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
        .map((key) => `${JSON.stringify(key)}:${this.stableStringify((value as Record<string, unknown>)[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(value);
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
}
