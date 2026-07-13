import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { SystemModuleDependencyEntity } from '../entities/system-module-dependency.entity';
import { SystemModuleEntity } from '../entities/system-module.entity';
import { SystemModuleSaasBridgeEntity } from '../entities/system-module-saas-bridge.entity';
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
        const operatorValue = expected.value ?? expected._value;
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
    bridgeRows?: EntityRecord[];
    saasModuleCodes?: string[];
  } = {}) => {
    const moduleRepo = new MemoryRepository<SystemModuleEntity>(options.modules as SystemModuleEntity[]);
    const dependencyRepo = new MemoryRepository<SystemModuleDependencyEntity>(
      options.dependencies as SystemModuleDependencyEntity[],
    );
    const tenantModuleRepo = new MemoryRepository<SystemTenantModuleEntity>(
      options.tenantModules as SystemTenantModuleEntity[],
    );
    const bridgeRepo = new MemoryRepository<SystemModuleSaasBridgeEntity>(
      options.bridgeRows as SystemModuleSaasBridgeEntity[],
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
      bridgeRepo as any,
      saasModuleService as any,
    );

    return { service, moduleRepo, dependencyRepo, tenantModuleRepo, bridgeRepo, saasModuleService };
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

  it('diagnoses missing required SaaS plan module without throwing', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_console')],
      saasModuleCodes: ['rag'],
    });

    await expect(
      service.diagnoseModuleAccess({
        tenantId: 10,
        moduleCode: 'ai_console',
        requiredSaasModuleCode: 'ai_chat',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        allowed: false,
        status: 'missing_plan_module',
        reason: '当前套餐未包含所需 SaaS 模块',
        required_saas_module_codes: ['ai_chat'],
        missing_saas_module_codes: ['ai_chat'],
        tenant_saas_module_codes: ['rag'],
      }),
    );
  });

  it('diagnoses missing tenant system-module entitlement without throwing', async () => {
    const { service } = createService({
      modules: [enabledModule('taixu_workspace')],
      saasModuleCodes: ['member_management'],
    });

    await expect(
      service.diagnoseModuleAccess({
        tenantId: 10,
        moduleCode: 'taixu_workspace',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        allowed: false,
        status: 'missing_tenant_module',
        reason: '当前租户未启用该系统模块',
        tenant_enabled: false,
        tenant_entitlement_source: null,
      }),
    );
  });

  it('diagnoses explicit tenant entitlement as available', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_console')],
      tenantModules: [{ tenantId: 10, moduleCode: 'ai_console', enabled: 1, source: 'platform' }],
    });

    await expect(
      service.diagnoseModuleAccess({
        tenantId: 10,
        moduleCode: 'ai_console',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        allowed: true,
        status: 'available',
        reason: '模块已开通',
        tenant_enabled: true,
        tenant_entitlement_source: 'platform',
      }),
    );
  });

  it('diagnoses plan-derived tenant entitlement with a single SaaS module load', async () => {
    const { service, saasModuleService } = createService({
      modules: [enabledModule('ai_console')],
      saasModuleCodes: ['ai_chat'],
    });

    await expect(
      service.diagnoseModuleAccess({
        tenantId: 10,
        moduleCode: 'ai_console',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        allowed: true,
        status: 'available',
        tenant_enabled: true,
        tenant_entitlement_source: 'plan',
        tenant_saas_module_codes: ['ai_chat'],
      }),
    );
    expect(saasModuleService.listTenantModules).toHaveBeenCalledTimes(1);
  });

  it('derives tenant availability from SaaS plan feature module codes', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_console')],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'ai_console',
        saasModuleCodes: ['ai_chat'],
      }),
    ).resolves.toBe(true);
  });

  it('uses enabled database bridge rows for SaaS plan entitlement', async () => {
    const { service } = createService({
      modules: [enabledModule('custom_workspace')],
      bridgeRows: [{ saasModuleCode: 'custom_ai', systemModuleCode: 'custom_workspace', enabled: 1 }],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'custom_workspace',
        saasModuleCodes: ['custom_ai'],
      }),
    ).resolves.toBe(true);
  });

  it('ignores disabled database bridge rows without falling back to legacy constants', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_console')],
      bridgeRows: [{ saasModuleCode: 'ai_chat', systemModuleCode: 'ai_console', enabled: 0 }],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'ai_console',
        saasModuleCodes: ['ai_chat'],
      }),
    ).rejects.toThrow('Tenant has not enabled this module');
  });

  it('derives tenant availability from mocked SaaS tenant modules', async () => {
    const { service, saasModuleService } = createService({
      modules: [enabledModule('ai_console')],
      saasModuleCodes: ['ai_chat'],
    });

    await expect(service.assertModuleAccess({ tenantId: 10, moduleCode: 'ai_console' })).resolves.toBe(true);
    expect(saasModuleService.listTenantModules).toHaveBeenCalledWith(10);
  });

  it('allows access when the required SaaS feature is present', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_console')],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'ai_console',
        requiredSaasModuleCode: 'ai_chat',
        saasModuleCodes: ['ai_chat'],
      }),
    ).resolves.toBe(true);
  });

  it('loads tenant SaaS modules when required feature codes are not pre-supplied', async () => {
    const { service, saasModuleService } = createService({
      modules: [enabledModule('ai_console')],
      saasModuleCodes: ['ai_chat'],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'ai_console',
        requiredSaasModuleCode: 'ai_chat',
      }),
    ).resolves.toBe(true);

    expect(saasModuleService.listTenantModules).toHaveBeenCalledWith(10);
  });

  it('denies access when the exact required SaaS feature is missing', async () => {
    const { service } = createService({
      modules: [enabledModule('taixu_workspace')],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'taixu_workspace',
        requiredSaasModuleCode: 'ai_chat',
        saasModuleCodes: ['rag'],
      }),
    ).rejects.toThrow('Current plan has not enabled this module');
  });

  it('does not let an explicit tenant module bypass a required SaaS feature gate', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_console')],
      tenantModules: [{ tenantId: 10, moduleCode: 'ai_console', enabled: 1 }],
      saasModuleCodes: ['rag'],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'ai_console',
        requiredSaasModuleCode: 'ai_chat',
      }),
    ).rejects.toThrow('Current plan has not enabled this module');
  });

  it('allows access when any required SaaS feature is present', async () => {
    const { service } = createService({
      modules: [enabledModule('taixu_workspace')],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'taixu_workspace',
        requiredAnySaasModuleCodes: ['ai_chat', 'rag'],
        saasModuleCodes: ['rag'],
      }),
    ).resolves.toBe(true);
  });

  it('denies access when all required-any SaaS features are missing', async () => {
    const { service } = createService({
      modules: [enabledModule('taixu_workspace')],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'taixu_workspace',
        requiredAnySaasModuleCodes: ['ai_chat', 'rag'],
        saasModuleCodes: ['member_management'],
      }),
    ).rejects.toThrow('Current plan has not enabled this module');
  });

  it('does not let an explicit tenant module bypass required-any SaaS feature gates', async () => {
    const { service } = createService({
      modules: [enabledModule('taixu_workspace')],
      tenantModules: [{ tenantId: 10, moduleCode: 'taixu_workspace', enabled: 1 }],
      saasModuleCodes: ['member_management'],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'taixu_workspace',
        requiredAnySaasModuleCodes: ['ai_chat', 'rag'],
      }),
    ).rejects.toThrow('Current plan has not enabled this module');
  });

  it('allows tenant SaaS self-service before the tenant has purchased modules', async () => {
    const { service, saasModuleService } = createService({
      modules: [enabledModule('tenant_saas')],
    });

    await expect(service.assertModuleAccess({ tenantId: 10, moduleCode: 'tenant_saas' })).resolves.toBe(true);
    expect(saasModuleService.listTenantModules).not.toHaveBeenCalled();
  });

  it('merges database bridge overrides per SaaS module without dropping other static mappings', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_console'), enabledModule('saas_platform')],
      bridgeRows: [
        {
          saasModuleCode: 'ai_chat',
          systemModuleCode: 'ai_console',
          enabled: 0,
        },
      ],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'saas_platform',
        saasModuleCodes: ['ai_chat', 'advanced_report'],
      }),
    ).resolves.toBe(true);
    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'ai_console',
        saasModuleCodes: ['ai_chat', 'advanced_report'],
      }),
    ).rejects.toThrow('Tenant has not enabled this module');
  });

  it('denies SaaS bridge entitlement when tenant plan modules do not map to the system module', async () => {
    const { service } = createService({
      modules: [enabledModule('taixu_workspace')],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'taixu_workspace',
        saasModuleCodes: ['member_management'],
      }),
    ).rejects.toThrow('Tenant has not enabled this module');
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

  it('denies access when a required dependency version is outside the declared range', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_console'), enabledModule('core_system')],
      dependencies: [
        {
          moduleCode: 'ai_console',
          dependsOnCode: 'core_system',
          versionRange: '^2.0.0',
          required: 1,
        },
      ],
    });

    await expect(service.assertModuleAccess({ moduleCode: 'ai_console' })).rejects.toThrow(
      'Module dependency is not satisfied',
    );
  });

  it('denies access when a transitive required dependency is disabled', async () => {
    const { service } = createService({
      modules: [
        enabledModule('ai_console'),
        enabledModule('core_system'),
        { ...enabledModule('ops_monitor'), status: 'disabled' },
      ],
      dependencies: [
        { moduleCode: 'ai_console', dependsOnCode: 'core_system', required: 1 },
        { moduleCode: 'core_system', dependsOnCode: 'ops_monitor', required: 1 },
      ],
    });

    await expect(service.assertModuleAccess({ moduleCode: 'ai_console' })).rejects.toThrow(
      'Module dependency is not satisfied',
    );
  });

  it('fails closed when stored required dependencies contain a cycle', async () => {
    const { service } = createService({
      modules: [enabledModule('ai_console'), enabledModule('core_system')],
      dependencies: [
        { moduleCode: 'ai_console', dependsOnCode: 'core_system', required: 1 },
        { moduleCode: 'core_system', dependsOnCode: 'ai_console', required: 1 },
      ],
    });

    await expect(service.assertModuleAccess({ moduleCode: 'ai_console' })).rejects.toThrow(
      'Module dependency is not satisfied',
    );
  });
});
