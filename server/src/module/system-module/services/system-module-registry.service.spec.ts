import { BadRequestException, NotFoundException } from '@nestjs/common';

import { SystemModuleApiEntity } from '../entities/system-module-api.entity';
import { SystemModuleDependencyEntity } from '../entities/system-module-dependency.entity';
import { SystemModuleEventEntity } from '../entities/system-module-event.entity';
import { SystemModulePermissionEntity } from '../entities/system-module-permission.entity';
import { SystemModuleEntity } from '../entities/system-module.entity';
import { SystemTenantModuleEntity } from '../entities/system-tenant-module.entity';
import { BUILT_IN_SYSTEM_MODULES } from '../manifests/built-in-modules';
import { SystemModuleRegistryService } from './system-module-registry.service';

type EntityRecord = Record<string, any>;

class MemoryRepository<T extends EntityRecord> {
  public records: T[];
  public saveCalls = 0;
  public savedInputs: T[] = [];
  public updatedInputs: EntityRecord[] = [];
  private nextId: number;

  constructor(seed: T[] = []) {
    this.records = seed.map((record, index) => ({ id: record.id ?? index + 1, ...record })) as T[];
    this.nextId = this.records.length + 1;
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
        : this.records.findIndex((record) => record.code !== undefined && record.code === input.code);
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
      const error = new Error(`Duplicate entry '${input.code}' for key 'uk_system_module_code'`) as Error & {
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

  async find(options: { where?: EntityRecord | EntityRecord[]; order?: EntityRecord; take?: number } = {}) {
    const whereList = Array.isArray(options.where) ? options.where : options.where ? [options.where] : undefined;
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

  async transaction<T>(callback: (manager: { getRepository: (entity: Function) => MemoryRepository<EntityRecord> }) => Promise<T>) {
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
    const tenantModuleRepo = new MemoryRepository();
    const eventRepo = new MemoryRepository();
    const dataSource = new MemoryDataSource(
      new Map<Function, MemoryRepository<EntityRecord>>([
        [SystemModuleEntity, moduleRepo],
        [SystemModuleDependencyEntity, dependencyRepo],
        [SystemModulePermissionEntity, permissionRepo],
        [SystemModuleApiEntity, apiRepo],
        [SystemTenantModuleEntity, tenantModuleRepo],
        [SystemModuleEventEntity, eventRepo],
      ]),
    );
    const service = new SystemModuleRegistryService(
      dataSource as any,
      moduleRepo as any,
      dependencyRepo as any,
      permissionRepo as any,
      apiRepo as any,
      tenantModuleRepo as any,
      eventRepo as any,
    );

    return { service, dataSource, moduleRepo, dependencyRepo, permissionRepo, apiRepo, tenantModuleRepo, eventRepo };
  };

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
    expect(eventRepo.records.filter((row) => row.eventType === 'install')).toHaveLength(BUILT_IN_SYSTEM_MODULES.length);
    expect(dataSource.transactionCalls).toBe(2);
  });

  it('preserves existing lifecycle status when manifests are re-synced', async () => {
    const { service, moduleRepo } = createService();

    await service.registerBuiltInModules();
    await service.updateStatus('core_system', 'disabled', 7);
    moduleRepo.savedInputs = [];
    await service.registerBuiltInModules();

    await expect(service.getModule('core_system')).resolves.toEqual(expect.objectContaining({ status: 'disabled' }));
    expect(moduleRepo.savedInputs).not.toContainEqual(
      expect.objectContaining({
        code: 'core_system',
        status: expect.any(String),
      }),
    );
    expect(moduleRepo.updatedInputs.some((input) => Object.prototype.hasOwnProperty.call(input, 'status'))).toBe(false);
  });

  it('registers plugin manifests as installed metadata only modules', async () => {
    const { service, moduleRepo, dependencyRepo, permissionRepo, apiRepo, eventRepo } = createService();

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
    ).rejects.toThrow(new BadRequestException('Plugin hooks are metadata-only and must use reserved values'));
  });

  it('rejects plugin manifests that reuse non-plugin module codes without replacing metadata or bindings', async () => {
    const { service, moduleRepo, dependencyRepo, permissionRepo, apiRepo, eventRepo } = createService();
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
    ).rejects.toThrow(new BadRequestException('Module code is already used by a non-plugin module'));

    expect(moduleRepo.records.find((record) => record.code === 'core_system')).toEqual(beforeModule);
    expect(dependencyRepo.records.filter((record) => record.moduleCode === 'core_system')).toEqual(beforeDependencies);
    expect(permissionRepo.records.filter((record) => record.moduleCode === 'core_system')).toEqual(beforePermissions);
    expect(apiRepo.records.filter((record) => record.moduleCode === 'core_system')).toEqual(beforeApis);
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
      api_endpoints: [{ method: 'POST', path: '/risk/ops/manage', permission_slug: 'risk:ops:manage' }],
    });

    expect(result).toEqual(
      expect.objectContaining({
        code: 'risk_ops_plugin',
        name: 'Risk Ops Plugin Updated',
        source: 'plugin',
        version: '1.1.0',
      }),
    );
    expect(moduleRepo.records.filter((record) => record.code === 'risk_ops_plugin')).toHaveLength(1);
    expect(permissionRepo.records.filter((record) => record.moduleCode === 'risk_ops_plugin')).toEqual([
      expect.objectContaining({ permissionSlug: 'risk:ops:manage', bindingType: 'required' }),
    ]);
    expect(apiRepo.records.filter((record) => record.moduleCode === 'risk_ops_plugin')).toEqual([
      expect.objectContaining({ method: 'POST', path: '/risk/ops/manage' }),
    ]);
    expect(eventRepo.records.filter((record) => record.moduleCode === 'risk_ops_plugin').map((record) => record.eventType)).toEqual([
      'install',
      'upgrade',
    ]);
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
        entitlement_source: 'platform',
      }),
      expect.objectContaining({
        code: 'audit_center',
        tenant_enabled: false,
        entitlement_source: 'plan',
      }),
    ]);
  });

  it('rejects invalid lifecycle state with BadRequestException', async () => {
    const { service } = createService();

    await expect(service.updateStatus('core_system', 'paused' as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown module lookups with NotFoundException', async () => {
    const { service } = createService();

    await expect(service.getModule('missing_module')).rejects.toBeInstanceOf(NotFoundException);
  });
});
