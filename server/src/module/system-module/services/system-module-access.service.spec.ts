import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { SystemModuleDependencyEntity } from '../entities/system-module-dependency.entity';
import { SystemModuleEntity } from '../entities/system-module.entity';
import { SystemTenantModuleEntity } from '../entities/system-tenant-module.entity';
import { SystemModuleAccessService } from './system-module-access.service';

type EntityRecord = Record<string, any>;

class MemoryRepository<T extends EntityRecord> {
  public records: T[];

  constructor(seed: T[] = []) {
    this.records = seed.map((record, index) => ({ id: record.id ?? index + 1, ...record })) as T[];
  }

  async findOne(options: { where: EntityRecord }) {
    return this.records.find((record) => this.matchesWhere(record, options.where)) ?? null;
  }

  async find(options: { where?: EntityRecord } = {}) {
    if (!options.where) return [...this.records];
    return this.records.filter((record) => this.matchesWhere(record, options.where));
  }

  private matchesWhere(record: EntityRecord, where: EntityRecord) {
    return Object.entries(where).every(([key, expected]) => {
      if (expected && typeof expected === 'object') {
        const operatorType = expected.type || expected._type;
        if (operatorType === 'isNull') {
          return record[key] === null || record[key] === undefined;
        }
      }
      return record[key] === expected;
    });
  }
}

describe('SystemModuleAccessService', () => {
  const enabledModule = (code: string) => ({
    code,
    name: code,
    source: 'built_in',
    version: '1.0.0',
    description: '',
    category: '',
    icon: '',
    status: 'enabled',
    entryRoute: '',
    configSchema: {},
    healthStatus: 'unknown',
    sort: 100,
  });

  const createService = (options: {
    modules?: EntityRecord[];
    dependencies?: EntityRecord[];
    tenantModules?: EntityRecord[];
    saasModuleCodes?: string[];
  } = {}) => {
    const moduleRepo = new MemoryRepository<SystemModuleEntity>(options.modules as SystemModuleEntity[]);
    const dependencyRepo = new MemoryRepository<SystemModuleDependencyEntity>(
      options.dependencies as SystemModuleDependencyEntity[],
    );
    const tenantModuleRepo = new MemoryRepository<SystemTenantModuleEntity>(
      options.tenantModules as SystemTenantModuleEntity[],
    );
    const saasModuleService = {
      listTenantModules: jest.fn().mockResolvedValue(
        (options.saasModuleCodes || []).map((code) => ({
          code,
          status: 1,
        })),
      ),
    };
    const service = new SystemModuleAccessService(
      moduleRepo as any,
      dependencyRepo as any,
      tenantModuleRepo as any,
      saasModuleService as any,
    );

    return { service, moduleRepo, dependencyRepo, tenantModuleRepo, saasModuleService };
  };

  it('allows enabled global + tenant explicit + permission present', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_console')],
      tenantModules: [{ tenantId: 10, moduleCode: 'ai_console', enabled: 1 }],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        userId: 20,
        moduleCode: 'ai_console',
        permission: 'system:ai_console:view',
        userPermissions: ['system:ai_console:view'],
      }),
    ).resolves.toBe(true);
  });

  it('denies disabled global module with BadRequestException', async () => {
    const { service } = createService({
      modules: [{ ...enabledModule('ai_console'), status: 'disabled' }],
    });

    await expect(service.assertModuleAccess({ moduleCode: 'ai_console' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.assertModuleAccess({ moduleCode: 'ai_console' })).rejects.toThrow('Module is disabled');
  });

  it('denies missing module with NotFoundException', async () => {
    const { service } = createService();

    await expect(service.assertModuleAccess({ moduleCode: 'missing_module' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.assertModuleAccess({ moduleCode: 'missing_module' })).rejects.toThrow(
      'Module missing_module not found',
    );
  });

  it('derives tenant availability from SaaS plan feature module codes', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_chat')],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'ai_chat',
        saasModuleCodes: ['taixu_workspace'],
      }),
    ).resolves.toBe(true);
  });

  it('derives tenant availability from mocked SaaS tenant modules', async () => {
    const { service, saasModuleService } = createService({
      modules: [enabledModule('advanced_report')],
      saasModuleCodes: ['saas_platform'],
    });

    await expect(service.assertModuleAccess({ tenantId: 10, moduleCode: 'advanced_report' })).resolves.toBe(true);
    expect(saasModuleService.listTenantModules).toHaveBeenCalledWith(10);
  });

  it('denies missing user permission with ForbiddenException', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_console')],
    });

    await expect(
      service.assertModuleAccess({
        moduleCode: 'ai_console',
        permission: 'system:ai_console:view',
        userPermissions: ['system:ai_console:edit'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies access when a required dependency is missing', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_console')],
      dependencies: [{ moduleCode: 'ai_console', dependsOnCode: 'core_system', required: 1 }],
    });

    await expect(service.assertModuleAccess({ moduleCode: 'ai_console' })).rejects.toThrow(
      'Module dependency is not satisfied',
    );
  });

  it('denies access when a required dependency is disabled', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_console'), { ...enabledModule('core_system'), status: 'disabled' }],
      dependencies: [{ moduleCode: 'ai_console', dependsOnCode: 'core_system', required: 1 }],
    });

    await expect(service.assertModuleAccess({ moduleCode: 'ai_console' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.assertModuleAccess({ moduleCode: 'ai_console' })).rejects.toThrow(
      'Module dependency is not satisfied',
    );
  });
});
