import { BadRequestException, NotFoundException } from '@nestjs/common';

import { SystemModuleApiEntity } from '../entities/system-module-api.entity';
import { SystemModuleConfigEntity } from '../entities/system-module-config.entity';
import { SystemModuleDependencyEntity } from '../entities/system-module-dependency.entity';
import { SystemModuleEventEntity } from '../entities/system-module-event.entity';
import { SystemModuleMenuEntity } from '../entities/system-module-menu.entity';
import { SystemModulePermissionEntity } from '../entities/system-module-permission.entity';
import { SystemModuleEntity } from '../entities/system-module.entity';
import { SystemModuleSaasBridgeEntity } from '../entities/system-module-saas-bridge.entity';
import { SystemTenantModuleConfigEntity } from '../entities/system-tenant-module-config.entity';
import { SystemTenantModuleEntity } from '../entities/system-tenant-module.entity';
import { BUILT_IN_SYSTEM_MODULES } from '../manifests/built-in-modules';
import { SysMenuEntity } from '../../system/menu/entities/menu.entity';
import { SystemModuleRegistryService } from './system-module-registry.service';

type EntityRecord = Record<string, any>;

class MemoryRepository<T extends EntityRecord> {
  public records: T[];
  public saveCalls = 0;
  public savedInputs: T[] = [];
  public updatedInputs: EntityRecord[] = [];
  private nextId: number;
  private readonly identityKeys: string[];

  constructor(seed: T[] = [], identityKeys: string[] = []) {
    this.records = seed.map((record, index) => ({ id: record.id ?? index + 1, ...record })) as T[];
    this.nextId = this.records.length + 1;
    this.identityKeys = identityKeys;
  }

  create(input: Partial<T> | Partial<T>[]) {
    if (Array.isArray(input)) {
      return input.map((item) => ({ ...item })) as T[];
    }
    return { ...input } as T;
  }

  async save(input: T | T[]) {
    this.saveCalls += 1;
    this.savedInputs.push(...(Array.isArray(input) ? input : [input]));
    if (Array.isArray(input)) {
      return Promise.all(input.map((item) => this.save(item))) as Promise<T[]>;
    }

    const now = new Date('2026-07-05T00:00:00.000Z');
    const existingIndex =
      input.id !== undefined
        ? this.records.findIndex((record) => record.id === input.id)
        : this.identityKeys.length
          ? this.records.findIndex(
              (record) => this.identityKeys.every((key) => record[key] === input[key]),
            )
        : this.records.findIndex(
            (record) => record.code !== undefined && record.code === input.code,
          );
    const record = {
      ...input,
      id: input.id ?? this.nextId++,
      createTime: input.createTime ?? now,
      updateTime: now,
    } as T;

    if (existingIndex >= 0) {
      this.records[existingIndex] = { ...this.records[existingIndex], ...record };
      return this.records[existingIndex];
    }

    this.records.push(record);
    return record;
  }

  async insert(input: T) {
    if (input.code && this.records.some((record) => record.code === input.code)) {
      const error = new Error(
        `Duplicate entry '${input.code}' for key 'uk_system_module_code'`,
      ) as Error & {
        code: string;
        errno: number;
      };
      error.code = 'ER_DUP_ENTRY';
      error.errno = 1062;
      throw error;
    }

    return this.save(input);
  }

  async update(where: EntityRecord, partial: EntityRecord) {
    this.updatedInputs.push(partial);
    this.records = this.records.map((record) =>
      this.matchesWhere(record, where) ? ({ ...record, ...partial } as T) : record,
    );
    return { affected: 1 };
  }

  async findOne(options: { where: EntityRecord; lock?: EntityRecord }) {
    return this.records.find((record) => this.matchesWhere(record, options.where)) ?? null;
  }

  async find(
    options: { where?: EntityRecord | EntityRecord[]; order?: EntityRecord; take?: number } = {},
  ) {
    const whereList = Array.isArray(options.where)
      ? options.where
      : options.where
        ? [options.where]
        : undefined;
    const filtered = whereList
      ? this.records.filter((record) => whereList.some((where) => this.matchesWhere(record, where)))
      : [...this.records];
    const ordered = this.orderBy(filtered, options.order);
    return options.take ? ordered.slice(0, options.take) : ordered;
  }

  async delete(where: EntityRecord) {
    this.records = this.records.filter((record) => !this.matchesWhere(record, where));
    return { affected: 1 };
  }

  private matchesWhere(record: EntityRecord, where: EntityRecord) {
    return Object.entries(where).every(([key, expected]) => {
      if (expected && typeof expected === 'object') {
        const operatorType = expected.type || expected._type;
        const operatorValue = expected.value ?? expected._value;
        if (operatorType === 'like') {
          return String(record[key] ?? '').includes(String(operatorValue).replace(/%/g, ''));
        }
        if (operatorType === 'isNull') {
          return record[key] === null || record[key] === undefined;
        }
        if (operatorType === 'in') {
          return (operatorValue as unknown[]).includes(record[key]);
        }
      }
      return record[key] === expected;
    });
  }

  private orderBy(records: T[], order: EntityRecord = {}) {
    return [...records].sort((left, right) => {
      for (const [key, direction] of Object.entries(order)) {
        const a = left[key] ?? 0;
        const b = right[key] ?? 0;
        if (a === b) continue;
        return direction === 'DESC' ? (a < b ? 1 : -1) : a > b ? 1 : -1;
      }
      return 0;
    });
  }
}

class MemoryDataSource {
  public transactionCalls = 0;

  constructor(private readonly repositories: Map<Function, MemoryRepository<EntityRecord>>) {}

  async transaction<T>(
    callback: (manager: {
      getRepository: (entity: Function) => MemoryRepository<EntityRecord>;
    }) => Promise<T>,
  ) {
    this.transactionCalls += 1;
    return callback({
      getRepository: (entity: Function) => {
        const repo = this.repositories.get(entity);
        if (!repo) throw new Error(`Missing repository for ${entity.name}`);
        return repo;
      },
    });
  }
}

describe('SystemModuleRegistryService', () => {
  const createService = () => {
    const moduleRepo = new MemoryRepository();
    const dependencyRepo = new MemoryRepository();
    const permissionRepo = new MemoryRepository();
    const apiRepo = new MemoryRepository();
    const moduleMenuRepo = new MemoryRepository();
    const tenantModuleRepo = new MemoryRepository();
    const eventRepo = new MemoryRepository();
    const bridgeRepo = new MemoryRepository();
    const moduleConfigRepo = new MemoryRepository([], ['moduleCode']);
    const tenantConfigRepo = new MemoryRepository([], ['tenantId', 'moduleCode']);
    const sysMenuRepo = new MemoryRepository();
    const saasModuleService = {
      listTenantModules: jest.fn().mockResolvedValue([]),
      listPlatformModules: jest.fn().mockResolvedValue([]),
    };
    const accessCache = { invalidateAll: jest.fn() };
    const dataSource = new MemoryDataSource(
      new Map<Function, MemoryRepository<EntityRecord>>([
        [SystemModuleEntity, moduleRepo],
        [SystemModuleDependencyEntity, dependencyRepo],
        [SystemModulePermissionEntity, permissionRepo],
        [SystemModuleApiEntity, apiRepo],
        [SystemModuleMenuEntity, moduleMenuRepo],
        [SystemTenantModuleEntity, tenantModuleRepo],
        [SystemModuleEventEntity, eventRepo],
        [SystemModuleSaasBridgeEntity, bridgeRepo],
        [SystemModuleConfigEntity, moduleConfigRepo],
        [SystemTenantModuleConfigEntity, tenantConfigRepo],
        [SysMenuEntity, sysMenuRepo],
      ]),
    );
    const service = new SystemModuleRegistryService(
      dataSource as any,
      moduleRepo as any,
      dependencyRepo as any,
      permissionRepo as any,
      apiRepo as any,
      moduleMenuRepo as any,
      tenantModuleRepo as any,
      eventRepo as any,
      bridgeRepo as any,
      moduleConfigRepo as any,
      tenantConfigRepo as any,
      sysMenuRepo as any,
      saasModuleService as any,
      accessCache as any,
    );

    return {
      service,
      dataSource,
      moduleRepo,
      dependencyRepo,
      permissionRepo,
      apiRepo,
      moduleMenuRepo,
      tenantModuleRepo,
      eventRepo,
      bridgeRepo,
      moduleConfigRepo,
      tenantConfigRepo,
      sysMenuRepo,
      saasModuleService,
      accessCache,
    };
  };

  const manifest = (
    code: string,
    dependencies: Array<{ code: string; versionRange?: string; required?: boolean }> = [],
    version = '1.0.0',
  ) => ({
    code,
    name: code,
    source: 'extension' as const,
    version,
    description: '',
    category: 'test',
    icon: '',
    status: 'enabled' as const,
    entryRoute: '',
    sort: 100,
    dependencies,
    permissions: [],
    apis: [],
    configSchema: {},
  });

  it('imports built-in manifests idempotently and includes core system and SaaS platform modules', async () => {
    const { service, dataSource, moduleRepo, dependencyRepo, eventRepo } = createService();

    await service.registerBuiltInModules();
    await service.registerBuiltInModules();

    const modules = await service.listModules();
    expect(modules.map((module) => module.code)).toEqual(
      expect.arrayContaining(['core_system', 'saas_platform']),
    );
    expect(moduleRepo.records).toHaveLength(BUILT_IN_SYSTEM_MODULES.length);
    expect(dependencyRepo.records.filter((row) => row.moduleCode === 'saas_platform')).toEqual([
      expect.objectContaining({ dependsOnCode: 'core_system', required: 1 }),
    ]);
    expect(eventRepo.records.filter((row) => row.eventType === 'install')).toHaveLength(
      BUILT_IN_SYSTEM_MODULES.length,
    );
    expect(dataSource.transactionCalls).toBe(2);
  });

  it('rejects manifest dependency cycles before writing module metadata', async () => {
    const { service, moduleRepo } = createService();

    await expect(
      service.importManifests([
        manifest('module_alpha', [{ code: 'module_beta', versionRange: '^1.0.0' }]),
        manifest('module_beta', [{ code: 'module_alpha', versionRange: '^1.0.0' }]),
      ]),
    ).rejects.toThrow('System module dependency cycle detected');
    expect(moduleRepo.records).toEqual([]);
  });

  it('rejects manifest dependencies whose installed version is outside the declared range', async () => {
    const { service, moduleRepo } = createService();

    await expect(
      service.importManifests([
        manifest('core_system', [], '1.0.0'),
        manifest('module_alpha', [{ code: 'core_system', versionRange: '^2.0.0' }]),
      ]),
    ).rejects.toThrow('System module dependency version is not satisfied');
    expect(moduleRepo.records).toEqual([]);
  });

  it('validates platform config and merges tenant overrides without logging values', async () => {
    const { service, moduleRepo, moduleConfigRepo, tenantConfigRepo, eventRepo } = createService();
    await moduleRepo.save({
      ...manifest('module_alpha'),
      configSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['enabled', 'limits'],
        properties: {
          enabled: { type: 'boolean' },
          limits: {
            type: 'object',
            required: ['requests', 'burst'],
            properties: {
              requests: { type: 'number', minimum: 1, maximum: 100 },
              burst: { type: 'number', minimum: 1, maximum: 20 },
            },
          },
          secret: { type: 'string', maxLength: 100 },
        },
      },
    });

    await expect(
      service.savePlatformConfig('module_alpha', { enabled: 'yes' } as any, 7),
    ).rejects.toThrow('Module config validation failed');
    expect(moduleConfigRepo.records).toEqual([]);

    await service.savePlatformConfig(
      'module_alpha',
      { enabled: true, limits: { requests: 10, burst: 2 }, secret: 'super-secret' },
      7,
    );
    const result = await service.saveTenantConfig(
      23,
      'module_alpha',
      { limits: { requests: 20 } },
      9,
    );

    expect(result).toEqual({
      module_code: 'module_alpha',
      tenant_id: 23,
      platform_config: { enabled: true, limits: { requests: 10, burst: 2 }, secret: 'super-secret' },
      tenant_config: { limits: { requests: 20 } },
      effective_config: { enabled: true, limits: { requests: 20, burst: 2 }, secret: 'super-secret' },
    });
    expect(moduleConfigRepo.records).toHaveLength(1);
    expect(tenantConfigRepo.records).toHaveLength(1);
    const configEvents = eventRepo.records.filter((row) => row.eventType === 'config_update');
    expect(configEvents).toHaveLength(2);
    expect(configEvents[1]).toEqual(
      expect.objectContaining({
        operatorId: 9,
        metadata: { scope: 'tenant', tenantId: 23, keys: ['limits'] },
      }),
    );
    expect(JSON.stringify(configEvents)).not.toContain('super-secret');
  });

  it('rejects prototype mutation keys even when the module schema is open', async () => {
    const { service, moduleRepo } = createService();
    await moduleRepo.save({ ...manifest('module_alpha'), configSchema: {} });
    const maliciousConfig = JSON.parse('{"__proto__":{"polluted":true}}');

    await expect(service.savePlatformConfig('module_alpha', maliciousConfig, 7)).rejects.toThrow(
      'Module config validation failed',
    );
    expect(({} as any).polluted).toBeUndefined();
  });

  it('runs a bounded health check and records only finding codes', async () => {
    const { service, moduleRepo, dependencyRepo, eventRepo } = createService();
    await moduleRepo.save({ ...manifest('module_alpha'), healthStatus: 'unknown' });
    await moduleRepo.save({ ...manifest('module_beta'), status: 'disabled', healthStatus: 'unknown' });
    await dependencyRepo.save({
      moduleCode: 'module_alpha',
      dependsOnCode: 'module_beta',
      versionRange: '^1.0.0',
      required: 1,
    });

    const result = await service.runHealthCheck('module_alpha', 12);

    expect(result).toEqual(
      expect.objectContaining({
        code: 'module_alpha',
        health_status: 'failed',
        findings: ['dependency_unavailable'],
      }),
    );
    expect(moduleRepo.records.find((row) => row.code === 'module_alpha')).toEqual(
      expect.objectContaining({ healthStatus: 'failed' }),
    );
    expect(eventRepo.records).toContainEqual(
      expect.objectContaining({
        moduleCode: 'module_alpha',
        eventType: 'health_check',
        status: 'failed',
        operatorId: 12,
        metadata: { health_status: 'failed', findings: ['dependency_unavailable'] },
      }),
    );
  });

  it('compiles enabled API metadata and rejects undeclared permissions', async () => {
    const { service } = createService();
    await expect(
      service.importManifests([
        {
          ...manifest('module_alpha'),
          permissions: [{ slug: 'module:alpha:view' }],
          apis: [
            {
              method: 'GET',
              path: '/api/module-alpha/items/:id',
              permissionSlug: 'module:alpha:view',
              tenantScoped: true,
            },
          ],
        },
      ]),
    ).resolves.toBeDefined();

    expect(service.matchApiBinding('GET', ['/api/module-alpha/items/42'])).toEqual(
      expect.objectContaining({
        moduleCode: 'module_alpha',
        tenantScoped: true,
        permission: 'module:alpha:view',
      }),
    );

    await expect(
      service.importManifests([
        {
          ...manifest('module_beta'),
          apis: [
            {
              method: 'GET',
              path: '/api/module-beta/items',
              permissionSlug: 'module:beta:missing',
            },
          ],
        },
      ]),
    ).rejects.toThrow('System module API permission is not declared');
  });

  it('rejects API route conflicts across different modules', async () => {
    const { service } = createService();
    await service.importManifests([
      {
        ...manifest('module_alpha'),
        apis: [{ method: 'GET', path: '/api/shared/items' }],
      },
    ]);

    await expect(
      service.importManifests([
        {
          ...manifest('module_beta'),
          apis: [{ method: 'GET', path: '/api/shared/items' }],
        },
      ]),
    ).rejects.toThrow('System module API route is duplicated');
  });

  it('binds manifest routes and permissions to existing menus without creating menu records', async () => {
    const { service, sysMenuRepo, moduleMenuRepo } = createService();
    await sysMenuRepo.save({ id: 501, code: 'ModuleAlpha', path: '/module-alpha', type: 2 });
    await sysMenuRepo.save({ id: 502, slug: 'module:alpha:view', type: 3 });

    await service.importManifests([
      {
        ...manifest('module_alpha'),
        routes: ['/module-alpha'],
        entryRoute: '/module-alpha',
        permissions: [{ slug: 'module:alpha:view', bindingType: 'required' }],
      },
    ]);

    expect(sysMenuRepo.records).toHaveLength(2);
    expect(moduleMenuRepo.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ moduleCode: 'module_alpha', menuId: 501, bindingType: 'owned' }),
        expect.objectContaining({ moduleCode: 'module_alpha', menuId: 502, bindingType: 'required' }),
      ]),
    );
  });

  it('preserves existing lifecycle status when manifests are re-synced', async () => {
    const { service, moduleRepo } = createService();

    await service.registerBuiltInModules();
    await service.updateStatus('ops_monitor', 'disabled', 7);
    moduleRepo.savedInputs = [];
    await service.registerBuiltInModules();

    await expect(service.getModule('ops_monitor')).resolves.toEqual(
      expect.objectContaining({ status: 'disabled' }),
    );
    expect(moduleRepo.savedInputs).not.toContainEqual(
      expect.objectContaining({
        code: 'ops_monitor',
        status: expect.any(String),
      }),
    );
    expect(
      moduleRepo.updatedInputs.some((input) =>
        Object.prototype.hasOwnProperty.call(input, 'status'),
      ),
    ).toBe(false);
  });

  it('registers plugin manifests as installed metadata only modules', async () => {
    const { service, moduleRepo, dependencyRepo, permissionRepo, apiRepo, eventRepo } =
      createService();

    const result = await service.registerPluginManifest(
      {
        code: 'risk_ops_plugin',
        name: 'Risk Ops Plugin',
        source: 'plugin',
        version: '1.2.3',
        description: 'Risk operations metadata plugin.',
        routes: ['/risk/ops', '/risk/ops/detail'],
        permissions: [{ slug: 'risk:ops:view', bindingType: 'required' }],
        dependencies: [{ code: 'core_system', version: '^1.0.0' }],
        api_endpoints: [
          {
            method: 'get',
            path: '/risk/ops',
            permission_slug: 'risk:ops:view',
            tenant_scoped: true,
          },
        ],
        config_schema: { enabled: { type: 'boolean' } },
        hooks: { dashboard: 'reserved' },
      },
      77,
    );

    expect(result).toEqual(
      expect.objectContaining({
        code: 'risk_ops_plugin',
        source: 'plugin',
        status: 'installed',
        category: 'plugin',
        icon: 'ri:puzzle-line',
        entry_route: '',
        sort: 500,
        config_schema: { enabled: { type: 'boolean' } },
      }),
    );
    expect(moduleRepo.records).toEqual([
      expect.objectContaining({
        code: 'risk_ops_plugin',
        source: 'plugin',
        status: 'installed',
        category: 'plugin',
        icon: 'ri:puzzle-line',
        entryRoute: '',
        sort: 500,
        manifest: expect.objectContaining({
          routes: ['/risk/ops', '/risk/ops/detail'],
        }),
      }),
    ]);
    expect(dependencyRepo.records).toEqual([
      expect.objectContaining({
        moduleCode: 'risk_ops_plugin',
        dependsOnCode: 'core_system',
        versionRange: '^1.0.0',
        required: 1,
      }),
    ]);
    expect(permissionRepo.records).toEqual([
      expect.objectContaining({
        moduleCode: 'risk_ops_plugin',
        permissionSlug: 'risk:ops:view',
        bindingType: 'required',
      }),
    ]);
    expect(apiRepo.records).toEqual([
      expect.objectContaining({
        moduleCode: 'risk_ops_plugin',
        method: 'GET',
        path: '/risk/ops',
        permissionSlug: 'risk:ops:view',
        tenantScoped: 1,
      }),
    ]);
    expect(eventRepo.records).toEqual([
      expect.objectContaining({
        moduleCode: 'risk_ops_plugin',
        eventType: 'install',
        status: 'success',
      }),
    ]);
  });

  it('rejects plugin manifests with executable hook values', async () => {
    const { service } = createService();

    await expect(
      service.registerPluginManifest({
        code: 'risk_ops_plugin',
        name: 'Risk Ops Plugin',
        source: 'plugin',
        version: '1.2.3',
        hooks: { onInstall: 'runInstaller' },
      }),
    ).rejects.toThrow(
      new BadRequestException('Plugin hooks are metadata-only and must use reserved values'),
    );
  });

  it('rejects plugin manifests that reuse non-plugin module codes without replacing metadata or bindings', async () => {
    const { service, moduleRepo, dependencyRepo, permissionRepo, apiRepo, eventRepo } =
      createService();
    await service.registerBuiltInModules();

    const beforeModule = { ...moduleRepo.records.find((record) => record.code === 'core_system') };
    const beforeDependencies = dependencyRepo.records
      .filter((record) => record.moduleCode === 'core_system')
      .map((record) => ({ ...record }));
    const beforePermissions = permissionRepo.records
      .filter((record) => record.moduleCode === 'core_system')
      .map((record) => ({ ...record }));
    const beforeApis = apiRepo.records
      .filter((record) => record.moduleCode === 'core_system')
      .map((record) => ({ ...record }));
    const beforeEvents = eventRepo.records.map((record) => ({ ...record }));

    await expect(
      service.registerPluginManifest({
        code: 'core_system',
        name: 'Hijacked Core',
        source: 'plugin',
        version: '9.9.9',
        permissions: [{ slug: 'evil:admin' }],
        dependencies: [{ code: 'evil_dep', version: '*' }],
        api_endpoints: [{ method: 'POST', path: '/evil', permission_slug: 'evil:admin' }],
      }),
    ).rejects.toThrow(
      new BadRequestException('Module code is already used by a non-plugin module'),
    );

    expect(moduleRepo.records.find((record) => record.code === 'core_system')).toEqual(
      beforeModule,
    );
    expect(dependencyRepo.records.filter((record) => record.moduleCode === 'core_system')).toEqual(
      beforeDependencies,
    );
    expect(permissionRepo.records.filter((record) => record.moduleCode === 'core_system')).toEqual(
      beforePermissions,
    );
    expect(apiRepo.records.filter((record) => record.moduleCode === 'core_system')).toEqual(
      beforeApis,
    );
    expect(eventRepo.records).toEqual(beforeEvents);
  });

  it('allows existing plugin module codes to be re-registered', async () => {
    const { service, moduleRepo, permissionRepo, apiRepo, eventRepo } = createService();

    await service.registerPluginManifest({
      code: 'risk_ops_plugin',
      name: 'Risk Ops Plugin',
      source: 'plugin',
      version: '1.0.0',
      permissions: [{ slug: 'risk:ops:view' }],
      api_endpoints: [{ method: 'GET', path: '/risk/ops', permission_slug: 'risk:ops:view' }],
    });

    const result = await service.registerPluginManifest({
      code: 'risk_ops_plugin',
      name: 'Risk Ops Plugin Updated',
      source: 'plugin',
      version: '1.1.0',
      permissions: [{ slug: 'risk:ops:manage', bindingType: 'required' }],
      api_endpoints: [
        { method: 'POST', path: '/risk/ops/manage', permission_slug: 'risk:ops:manage' },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        code: 'risk_ops_plugin',
        name: 'Risk Ops Plugin Updated',
        source: 'plugin',
        version: '1.1.0',
      }),
    );
    expect(moduleRepo.records.filter((record) => record.code === 'risk_ops_plugin')).toHaveLength(
      1,
    );
    expect(
      permissionRepo.records.filter((record) => record.moduleCode === 'risk_ops_plugin'),
    ).toEqual([
      expect.objectContaining({ permissionSlug: 'risk:ops:manage', bindingType: 'required' }),
    ]);
    expect(apiRepo.records.filter((record) => record.moduleCode === 'risk_ops_plugin')).toEqual([
      expect.objectContaining({ method: 'POST', path: '/risk/ops/manage' }),
    ]);
    expect(
      eventRepo.records
        .filter((record) => record.moduleCode === 'risk_ops_plugin')
        .map((record) => record.eventType),
    ).toEqual(['install', 'upgrade']);
  });

  it('updates status transactionally and records an enable event with operator id', async () => {
    const { service, dataSource, moduleRepo, eventRepo } = createService();
    await moduleRepo.save({
      code: 'ai_console',
      name: 'AI Console',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'ai',
      icon: 'Bot',
      status: 'disabled',
      entryRoute: '/ai/chat',
      configSchema: {},
      healthStatus: 'unknown',
      sort: 40,
    });

    const result = await service.updateStatus('ai_console', 'enabled', 99);

    expect(result).toEqual(expect.objectContaining({ code: 'ai_console', status: 'enabled' }));
    expect(dataSource.transactionCalls).toBe(1);
    expect(eventRepo.records).toEqual([
      expect.objectContaining({
        moduleCode: 'ai_console',
        eventType: 'enable',
        status: 'success',
        operatorId: 99,
      }),
    ]);
  });

  it('does not save or record event when status is unchanged', async () => {
    const { service, dataSource, moduleRepo, eventRepo } = createService();
    await moduleRepo.save({
      code: 'ops_monitor',
      name: 'Ops Monitor',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'ops',
      icon: 'Activity',
      status: 'enabled',
      entryRoute: '/tool/crontab',
      configSchema: {},
      healthStatus: 'unknown',
      sort: 70,
    });
    moduleRepo.saveCalls = 0;
    eventRepo.saveCalls = 0;

    const result = await service.updateStatus('ops_monitor', 'enabled', 12);

    expect(result).toEqual(expect.objectContaining({ code: 'ops_monitor', status: 'enabled' }));
    expect(dataSource.transactionCalls).toBe(1);
    expect(moduleRepo.saveCalls).toBe(0);
    expect(eventRepo.saveCalls).toBe(0);
    expect(eventRepo.records).toHaveLength(0);
  });

  it('rejects disabling a module while an enabled module still depends on it', async () => {
    const { service, moduleRepo, dependencyRepo, eventRepo } = createService();
    await moduleRepo.save({
      code: 'core_system',
      name: 'Core System',
      source: 'built_in',
      version: '1.0.0',
      status: 'enabled',
    });
    await moduleRepo.save({
      code: 'tenant_saas',
      name: 'Tenant SaaS',
      source: 'built_in',
      version: '1.0.0',
      status: 'enabled',
    });
    await dependencyRepo.save({
      moduleCode: 'tenant_saas',
      dependsOnCode: 'core_system',
      versionRange: '^1.0.0',
      required: 1,
    });

    await expect(service.updateStatus('core_system', 'disabled', 7)).rejects.toThrow(
      'Enabled modules still depend on core_system: tenant_saas',
    );
    expect(moduleRepo.records.find((item) => item.code === 'core_system')?.status).toBe('enabled');
    expect(eventRepo.records).toHaveLength(0);
  });

  it('lists enabled modules with explicit tenant entitlement flags', async () => {
    const { service, moduleRepo, tenantModuleRepo } = createService();
    await moduleRepo.save({
      code: 'core_system',
      name: 'Core System',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'core',
      icon: 'Settings',
      status: 'enabled',
      entryRoute: '/system',
      configSchema: {},
      healthStatus: 'healthy',
      sort: 10,
    });
    await moduleRepo.save({
      code: 'ai_console',
      name: 'AI Console',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'ai',
      icon: 'Bot',
      status: 'enabled',
      entryRoute: '/ai/chat',
      configSchema: {},
      healthStatus: 'unknown',
      sort: 40,
    });
    await moduleRepo.save({
      code: 'ops_monitor',
      name: 'Ops Monitor',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'ops',
      icon: 'Activity',
      status: 'disabled',
      entryRoute: '/tool/crontab',
      configSchema: {},
      healthStatus: 'unknown',
      sort: 70,
    });
    await moduleRepo.save({
      code: 'audit_center',
      name: 'Audit Center',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'ops',
      icon: 'Shield',
      status: 'enabled',
      entryRoute: '/monitor/logs',
      configSchema: {},
      healthStatus: 'unknown',
      sort: 80,
    });
    await tenantModuleRepo.save({
      tenantId: 23,
      moduleCode: 'core_system',
      enabled: 1,
      source: 'platform',
      config: null,
    });
    await tenantModuleRepo.save({
      tenantId: 23,
      moduleCode: 'ai_console',
      enabled: 0,
      source: 'platform',
      config: null,
    });
    await tenantModuleRepo.save({
      tenantId: 99,
      moduleCode: 'ops_monitor',
      enabled: 1,
      source: 'platform',
      config: null,
    });

    await expect(service.listTenantModules(23)).resolves.toEqual([
      expect.objectContaining({
        code: 'core_system',
        tenant_enabled: true,
        entitlement_source: 'platform',
      }),
      expect.objectContaining({
        code: 'ai_console',
        tenant_enabled: false,
        entitlement_source: null,
      }),
      expect.objectContaining({
        code: 'audit_center',
        tenant_enabled: false,
        entitlement_source: null,
      }),
    ]);
  });

  it('grants and revokes one explicit tenant module idempotently with audit events', async () => {
    const { service, moduleRepo, tenantModuleRepo, eventRepo } = createService();
    await moduleRepo.save({
      code: 'ai_console',
      name: 'AI Console',
      source: 'built_in',
      version: '1.0.0',
      status: 'enabled',
      configSchema: {},
      healthStatus: 'healthy',
      sort: 40,
    });

    await expect(
      service.grantTenantModule(23, 'ai_console', 9, 'Enable tenant AI'),
    ).resolves.toEqual(
      expect.objectContaining({
        tenant_id: 23,
        module_code: 'ai_console',
        enabled: true,
        source: 'platform',
      }),
    );
    await service.grantTenantModule(23, 'ai_console', 9, 'Repeated request');

    expect(tenantModuleRepo.records).toHaveLength(1);
    expect(eventRepo.records.filter((row) => row.eventType === 'tenant_grant')).toHaveLength(1);
    expect(eventRepo.records).toContainEqual(
      expect.objectContaining({
        moduleCode: 'ai_console',
        eventType: 'tenant_grant',
        operatorId: 9,
        metadata: expect.objectContaining({ tenantId: 23 }),
      }),
    );

    await expect(
      service.revokeTenantModule(23, 'ai_console', 10, 'Tenant requested removal'),
    ).resolves.toEqual(
      expect.objectContaining({
        tenant_id: 23,
        module_code: 'ai_console',
        enabled: false,
      }),
    );
    expect(tenantModuleRepo.records[0]).toEqual(expect.objectContaining({ enabled: 0 }));
    expect(eventRepo.records).toContainEqual(
      expect.objectContaining({
        eventType: 'tenant_revoke',
        operatorId: 10,
        metadata: expect.objectContaining({ tenantId: 23 }),
      }),
    );
  });

  it('marks tenant modules enabled by SaaS plan bridge entitlements', async () => {
    const { service, moduleRepo, tenantModuleRepo, saasModuleService } = createService();
    await moduleRepo.save({
      code: 'ai_console',
      name: 'AI Console',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'ai',
      icon: 'Bot',
      status: 'enabled',
      entryRoute: '/ai/chat',
      configSchema: {},
      healthStatus: 'unknown',
      sort: 40,
    });
    await moduleRepo.save({
      code: 'tenant_saas',
      name: 'Tenant SaaS',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'saas',
      icon: 'Building2',
      status: 'enabled',
      entryRoute: '/tenant-saas/usage',
      configSchema: {},
      healthStatus: 'unknown',
      sort: 30,
    });
    await tenantModuleRepo.save({
      tenantId: 23,
      moduleCode: 'tenant_saas',
      enabled: 0,
      source: 'manual',
      config: null,
    });
    saasModuleService.listTenantModules.mockResolvedValue([
      { code: 'ai_chat' },
      { code: 'member_management' },
    ]);

    const result = await service.listTenantModules(23);

    expect(saasModuleService.listTenantModules).toHaveBeenCalledWith(23);
    expect(result).toEqual([
      expect.objectContaining({
        code: 'tenant_saas',
        tenant_enabled: true,
        entitlement_source: 'system',
      }),
      expect.objectContaining({
        code: 'ai_console',
        tenant_enabled: true,
        entitlement_source: 'plan',
      }),
    ]);
  });

  it('lists tenant SaaS as a system baseline before the tenant purchases any modules', async () => {
    const { service, moduleRepo, saasModuleService } = createService();
    await moduleRepo.save({
      code: 'tenant_saas',
      name: 'Tenant SaaS',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'saas',
      icon: 'Building2',
      status: 'enabled',
      entryRoute: '/tenant-saas/usage',
      configSchema: {},
      healthStatus: 'unknown',
      sort: 30,
    });
    saasModuleService.listTenantModules.mockResolvedValue([]);

    await expect(service.listTenantModules(23)).resolves.toEqual([
      expect.objectContaining({
        code: 'tenant_saas',
        explicit_enabled: false,
        plan_enabled: false,
        tenant_enabled: true,
        entitlement_source: 'system',
      }),
    ]);
  });

  it('merges database bridge overrides per SaaS module in tenant listings', async () => {
    const { service, moduleRepo, bridgeRepo, saasModuleService } = createService();
    await moduleRepo.save({ ...manifest('ai_console'), source: 'built_in' });
    await moduleRepo.save({ ...manifest('saas_platform'), source: 'built_in' });
    await bridgeRepo.save({
      saasModuleCode: 'ai_chat',
      systemModuleCode: 'ai_console',
      enabled: 0,
      source: 'platform',
    });
    saasModuleService.listTenantModules.mockResolvedValue([
      { code: 'ai_chat' },
      { code: 'advanced_report' },
    ]);

    await expect(service.listTenantModules(23)).resolves.toEqual([
      expect.objectContaining({
        code: 'ai_console',
        tenant_enabled: false,
        entitlement_source: null,
      }),
      expect.objectContaining({
        code: 'saas_platform',
        tenant_enabled: true,
        entitlement_source: 'plan',
      }),
    ]);
  });

  it('marks tenant modules enabled from database SaaS bridge rows', async () => {
    const { service, moduleRepo, bridgeRepo, saasModuleService } = createService();
    await moduleRepo.save({
      code: 'custom_workspace',
      name: 'Custom Workspace',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'ai',
      icon: 'Bot',
      status: 'enabled',
      entryRoute: '/custom/workspace',
      configSchema: {},
      healthStatus: 'unknown',
      sort: 40,
    });
    await bridgeRepo.save({
      saasModuleCode: 'custom_ai',
      systemModuleCode: 'custom_workspace',
      enabled: 1,
      source: 'platform',
    });
    saasModuleService.listTenantModules.mockResolvedValue([{ code: 'custom_ai' }]);

    await expect(service.listTenantModules(23)).resolves.toEqual([
      expect.objectContaining({
        code: 'custom_workspace',
        tenant_enabled: true,
        entitlement_source: 'plan',
      }),
    ]);
  });

  it('does not mark tenant modules enabled from disabled database bridge rows', async () => {
    const { service, moduleRepo, bridgeRepo, saasModuleService } = createService();
    await moduleRepo.save({
      code: 'ai_console',
      name: 'AI Console',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'ai',
      icon: 'Bot',
      status: 'enabled',
      entryRoute: '/ai/chat',
      configSchema: {},
      healthStatus: 'unknown',
      sort: 40,
    });
    await bridgeRepo.save({
      saasModuleCode: 'ai_chat',
      systemModuleCode: 'ai_console',
      enabled: 0,
      source: 'platform',
    });
    saasModuleService.listTenantModules.mockResolvedValue([{ code: 'ai_chat' }]);

    await expect(service.listTenantModules(23)).resolves.toEqual([
      expect.objectContaining({
        code: 'ai_console',
        tenant_enabled: false,
        entitlement_source: null,
      }),
    ]);
  });

  it('lists SaaS bridge config rows with filters and snake case response', async () => {
    const { service, bridgeRepo } = createService();
    await bridgeRepo.save({
      saasModuleCode: 'ai_chat',
      systemModuleCode: 'ai_console',
      enabled: 1,
      source: 'seed',
      remark: 'AI bridge',
    });
    await bridgeRepo.save({
      saasModuleCode: 'member_management',
      systemModuleCode: 'tenant_saas',
      enabled: 0,
      source: 'platform',
      remark: 'Disabled bridge',
    });

    await expect(service.listSaasBridges({ saas_module_code: 'ai_chat' })).resolves.toEqual([
      expect.objectContaining({
        saas_module_code: 'ai_chat',
        system_module_code: 'ai_console',
        enabled: true,
        source: 'seed',
        remark: 'AI bridge',
      }),
    ]);
  });

  it('creates SaaS bridge config after validating SaaS and system module catalogs', async () => {
    const { service, moduleRepo, bridgeRepo, saasModuleService } = createService();
    await moduleRepo.save({
      code: 'custom_workspace',
      name: 'Custom Workspace',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'ai',
      icon: 'Bot',
      status: 'enabled',
      entryRoute: '/custom/workspace',
      configSchema: {},
      healthStatus: 'unknown',
      sort: 40,
    });
    saasModuleService.listPlatformModules.mockResolvedValue([{ code: 'custom_ai' }]);

    const result = await service.saveSaasBridge({
      saas_module_code: 'custom_ai',
      system_module_code: 'custom_workspace',
      enabled: 1,
      remark: 'Custom AI workspace',
    });

    expect(result).toEqual(
      expect.objectContaining({
        saas_module_code: 'custom_ai',
        system_module_code: 'custom_workspace',
        enabled: true,
        source: 'platform',
        remark: 'Custom AI workspace',
      }),
    );
    expect(bridgeRepo.records).toEqual([
      expect.objectContaining({
        saasModuleCode: 'custom_ai',
        systemModuleCode: 'custom_workspace',
        enabled: 1,
        source: 'platform',
      }),
    ]);
  });

  it('revives an existing soft-deleted SaaS bridge config without inserting a duplicate', async () => {
    const { service, moduleRepo, bridgeRepo, saasModuleService } = createService();
    await moduleRepo.save({
      code: 'ai_console',
      name: 'AI Console',
      source: 'built_in',
      version: '1.0.0',
      description: '',
      category: 'ai',
      icon: 'Bot',
      status: 'enabled',
      entryRoute: '/ai/chat',
      configSchema: {},
      healthStatus: 'unknown',
      sort: 40,
    });
    await bridgeRepo.save({
      id: 88,
      saasModuleCode: 'ai_chat',
      systemModuleCode: 'ai_console',
      enabled: 0,
      source: 'seed',
      remark: 'Old bridge',
      deleteTime: new Date('2026-07-01T00:00:00.000Z'),
    });
    saasModuleService.listPlatformModules.mockResolvedValue([{ code: 'ai_chat' }]);

    const result = await service.saveSaasBridge({
      saas_module_code: 'ai_chat',
      system_module_code: 'ai_console',
      enabled: 1,
      remark: 'Revived bridge',
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 88,
        enabled: true,
        source: 'seed',
        remark: 'Revived bridge',
      }),
    );
    expect(bridgeRepo.records).toHaveLength(1);
    expect(bridgeRepo.records[0]).toEqual(
      expect.objectContaining({ id: 88, enabled: 1, deleteTime: null }),
    );
  });

  it('updates SaaS bridge config status by id', async () => {
    const { service, bridgeRepo } = createService();
    await bridgeRepo.save({
      id: 9,
      saasModuleCode: 'ai_chat',
      systemModuleCode: 'ai_console',
      enabled: 1,
      source: 'seed',
    });

    const result = await service.updateSaasBridgeStatus(9, 0);

    expect(result).toEqual(expect.objectContaining({ id: 9, enabled: false }));
    expect(bridgeRepo.records[0]).toEqual(expect.objectContaining({ enabled: 0 }));
  });

  it('rejects invalid lifecycle state with BadRequestException', async () => {
    const { service } = createService();

    await expect(service.updateStatus('core_system', 'paused' as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects unknown module lookups with NotFoundException', async () => {
    const { service } = createService();

    await expect(service.getModule('missing_module')).rejects.toBeInstanceOf(NotFoundException);
  });
});
