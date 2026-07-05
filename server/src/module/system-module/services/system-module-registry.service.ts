import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
    const imported = [];

    for (const manifest of manifests) {
      const existing = await this.moduleRepo.findOne({ where: { code: manifest.code } });
      const module = this.moduleRepo.create({
        ...(existing || {}),
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
        healthStatus: existing?.healthStatus || 'unknown',
        sort: manifest.sort,
      });
      imported.push(this.toResponse(await this.moduleRepo.save(module)));

      await this.replaceDependencies(manifest);
      await this.replacePermissions(manifest);
      await this.replaceApis(manifest);
      await this.recordEvent(manifest.code, 'install', 'success', `Imported module ${manifest.code}`);
    }

    return imported;
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

    const module = await this.findModule(code);
    module.status = status;
    const saved = await this.moduleRepo.save(module);
    await this.recordEvent(code, this.statusToEventType(status), 'success', `Module ${code} status changed to ${status}`, {
      operatorId,
      metadata: { status },
    });
    return this.toResponse(saved);
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

  private async replaceDependencies(manifest: SystemModuleManifest) {
    await this.dependencyRepo.delete({ moduleCode: manifest.code });
    if (!manifest.dependencies.length) return;

    await this.dependencyRepo.save(
      manifest.dependencies.map((dependency) =>
        this.dependencyRepo.create({
          moduleCode: manifest.code,
          dependsOnCode: dependency.code,
          versionRange: dependency.versionRange || '',
          required: dependency.required === false ? 0 : 1,
        }),
      ),
    );
  }

  private async replacePermissions(manifest: SystemModuleManifest) {
    await this.permissionRepo.delete({ moduleCode: manifest.code });
    if (!manifest.permissions.length) return;

    await this.permissionRepo.save(
      manifest.permissions.map((permission) =>
        this.permissionRepo.create({
          moduleCode: manifest.code,
          permissionSlug: permission.slug,
          bindingType: permission.bindingType || 'owned',
        }),
      ),
    );
  }

  private async replaceApis(manifest: SystemModuleManifest) {
    await this.apiRepo.delete({ moduleCode: manifest.code });
    if (!manifest.apis.length) return;

    await this.apiRepo.save(
      manifest.apis.map((api) =>
        this.apiRepo.create({
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
    moduleCode: string,
    eventType: SystemModuleEventType,
    status: 'success' | 'failed',
    message: string,
    options: { operatorId?: number; metadata?: Record<string, unknown> } = {},
  ) {
    const event = this.eventRepo.create({
      moduleCode,
      eventType,
      status,
      message,
      metadata: options.metadata || null,
      operatorId: options.operatorId,
    });
    return this.eventRepo.save(event);
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
