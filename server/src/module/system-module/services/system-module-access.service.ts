import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

import { SaasModuleService } from '../../saas/services/saas-module.service';
import { SystemModuleDependencyEntity } from '../entities/system-module-dependency.entity';
import { SystemModuleEntity } from '../entities/system-module.entity';
import { SystemModuleSaasBridgeEntity } from '../entities/system-module-saas-bridge.entity';
import { SystemTenantModuleEntity } from '../entities/system-tenant-module.entity';
import {
  isValidSystemModuleVersionRange,
  satisfiesSystemModuleVersionRange,
} from '../system-module-dependency.util';
import {
  isBaselineTenantSystemModule,
  resolveSystemModuleCodesFromSaasModules,
} from '../system-module-entitlement.util';
import { SystemModuleAccessCacheService } from './system-module-access-cache.service';

export interface AssertModuleAccessOptions {
  tenantId?: number;
  userId?: number;
  moduleCode: string;
  permission?: string;
  userPermissions?: string[];
  saasModuleCodes?: string[];
  requiredSaasModuleCode?: string;
  requiredAnySaasModuleCodes?: string[];
}

export type ModuleAccessDiagnosisStatus =
  | 'available'
  | 'module_not_found'
  | 'module_disabled'
  | 'dependency_missing'
  | 'missing_plan_module'
  | 'missing_tenant_module'
  | 'permission_missing';

export interface SystemModuleAccessDiagnosis {
  module_code: string;
  module_name: string;
  allowed: boolean;
  status: ModuleAccessDiagnosisStatus;
  reason: string;
  required_saas_module_codes: string[];
  missing_saas_module_codes: string[];
  tenant_saas_module_codes: string[];
  tenant_enabled: boolean;
  tenant_entitlement_source: string | null;
  suggestions: string[];
  dependency_code?: string;
  permission?: string;
  system_module_status?: string;
}

@Injectable()
export class SystemModuleAccessService {
  constructor(
    @InjectRepository(SystemModuleEntity)
    private readonly moduleRepo: Repository<SystemModuleEntity>,
    @InjectRepository(SystemModuleDependencyEntity)
    private readonly dependencyRepo: Repository<SystemModuleDependencyEntity>,
    @InjectRepository(SystemTenantModuleEntity)
    private readonly tenantModuleRepo: Repository<SystemTenantModuleEntity>,
    @InjectRepository(SystemModuleSaasBridgeEntity)
    private readonly bridgeRepo: Repository<SystemModuleSaasBridgeEntity>,
    private readonly saasModuleService: SaasModuleService,
    private readonly accessCache: SystemModuleAccessCacheService,
  ) {}

  async assertModuleAccess(options: AssertModuleAccessOptions) {
    const diagnosis = await this.diagnoseModuleAccess(options);
    if (diagnosis.allowed) {
      return true;
    }

    if (diagnosis.status === 'module_not_found') {
      throw new NotFoundException(`Module ${options.moduleCode} not found`);
    }
    if (diagnosis.status === 'module_disabled') {
      throw new BadRequestException('Module is disabled');
    }
    if (diagnosis.status === 'dependency_missing') {
      throw new BadRequestException('Module dependency is not satisfied');
    }
    if (diagnosis.status === 'missing_plan_module') {
      throw new BadRequestException('Current plan has not enabled this module');
    }
    if (diagnosis.status === 'missing_tenant_module') {
      throw new BadRequestException('Tenant has not enabled this module');
    }
    if (diagnosis.status === 'permission_missing') {
      throw new ForbiddenException('Missing module permission');
    }

    throw new BadRequestException(diagnosis.reason);
  }

  async diagnoseModuleAccess(options: AssertModuleAccessOptions): Promise<SystemModuleAccessDiagnosis> {
    return this.accessCache.getOrLoad(this.accessCacheKey(options), () =>
      this.diagnoseModuleAccessUncached(options),
    );
  }

  private async diagnoseModuleAccessUncached(
    options: AssertModuleAccessOptions,
  ): Promise<SystemModuleAccessDiagnosis> {
    let tenantEntitlement:
      | {
          enabled: boolean;
          source: string | null;
          tenantSaasModuleCodes: string[];
        }
      | undefined;

    const module = await this.moduleRepo.findOne({
      where: { code: options.moduleCode, deleteTime: IsNull() },
    });
    if (!module) {
      return this.createDiagnosis(options, {
        allowed: false,
        status: 'module_not_found',
        reason: `系统模块 ${options.moduleCode} 不存在`,
        suggestions: ['请在平台系统模块中注册或恢复该模块。'],
      });
    }
    if (module.status !== 'enabled') {
      return this.createDiagnosis(options, {
        module,
        allowed: false,
        status: 'module_disabled',
        reason: '系统模块未启用',
        system_module_status: module.status,
        suggestions: ['请在平台系统模块管理中启用该模块。'],
      });
    }

    const missingDependency = await this.findUnsatisfiedDependency(options.moduleCode);
    if (missingDependency) {
      return this.createDiagnosis(options, {
        module,
        allowed: false,
        status: 'dependency_missing',
        reason: '系统模块依赖未满足',
        dependency_code: missingDependency,
        suggestions: [`请先启用依赖模块 ${missingDependency}。`],
      });
    }

    if (options.tenantId !== undefined) {
      const requiredAnySaasModuleCodes = (options.requiredAnySaasModuleCodes || []).filter(Boolean);
      const requiredSaasModuleCodes = this.getRequiredSaasModuleCodes(options);
      const tenantSaasModuleCodes =
        options.requiredSaasModuleCode || requiredAnySaasModuleCodes.length || options.saasModuleCodes
          ? options.saasModuleCodes ?? (await this.loadTenantSaasModuleCodes(options.tenantId))
          : undefined;

      if (
        options.requiredSaasModuleCode &&
        !(tenantSaasModuleCodes || []).includes(options.requiredSaasModuleCode)
      ) {
        return this.createDiagnosis(options, {
          module,
          allowed: false,
          status: 'missing_plan_module',
          reason: '当前套餐未包含所需 SaaS 模块',
          required_saas_module_codes: requiredSaasModuleCodes,
          missing_saas_module_codes: [options.requiredSaasModuleCode],
          tenant_saas_module_codes: tenantSaasModuleCodes || [],
          suggestions: ['请升级套餐，或让平台管理员把所需 SaaS 模块加入当前套餐。'],
        });
      }

      if (
        requiredAnySaasModuleCodes.length &&
        !requiredAnySaasModuleCodes.some((code) => (tenantSaasModuleCodes || []).includes(code))
      ) {
        return this.createDiagnosis(options, {
          module,
          allowed: false,
          status: 'missing_plan_module',
          reason: '当前套餐未包含所需 SaaS 模块',
          required_saas_module_codes: requiredSaasModuleCodes,
          missing_saas_module_codes: requiredAnySaasModuleCodes,
          tenant_saas_module_codes: tenantSaasModuleCodes || [],
          suggestions: ['请升级套餐，或让平台管理员把任一所需 SaaS 模块加入当前套餐。'],
        });
      }

      tenantEntitlement = await this.getTenantEntitlement(options.tenantId, options.moduleCode, tenantSaasModuleCodes);
      const entitled = tenantEntitlement.enabled;
      if (!entitled) {
        return this.createDiagnosis(options, {
          module,
          allowed: false,
          status: 'missing_tenant_module',
          reason: '当前租户未启用该系统模块',
          required_saas_module_codes: requiredSaasModuleCodes,
          tenant_saas_module_codes: tenantEntitlement.tenantSaasModuleCodes,
          tenant_enabled: false,
          tenant_entitlement_source: null,
          suggestions: ['请在平台后台为该租户开通模块，或调整 SaaS 模块到系统模块的桥接关系。'],
        });
      }
    }

    if (options.permission && !(options.userPermissions || []).includes(options.permission)) {
      return this.createDiagnosis(options, {
        module,
        allowed: false,
        status: 'permission_missing',
        reason: '当前账号缺少模块权限',
        permission: options.permission,
        suggestions: ['请让管理员为当前账号分配对应权限。'],
      });
    }

    return this.createDiagnosis(options, {
      module,
      allowed: true,
      status: 'available',
      reason: '模块已开通',
      tenant_enabled: tenantEntitlement?.enabled ?? false,
      tenant_entitlement_source: tenantEntitlement?.source ?? null,
      tenant_saas_module_codes: tenantEntitlement?.tenantSaasModuleCodes ?? options.saasModuleCodes ?? [],
      suggestions: [],
    });
  }

  private accessCacheKey(options: AssertModuleAccessOptions) {
    const normalizeCodes = (values: Array<string | undefined>) =>
      [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
    const permissionGranted = options.permission
      ? (options.userPermissions || []).includes(options.permission)
      : true;
    return JSON.stringify({
      moduleCode: options.moduleCode,
      tenantId: options.tenantId ?? null,
      requiredSaasModuleCode: options.requiredSaasModuleCode || '',
      requiredAnySaasModuleCodes: normalizeCodes(options.requiredAnySaasModuleCodes || []),
      saasModuleCodes: normalizeCodes(options.saasModuleCodes || []),
      permission: options.permission || '',
      permissionGranted,
    });
  }

  async isTenantEntitled(tenantId: number, moduleCode: string, saasModuleCodes?: string[]) {
    const explicitTenantModule = await this.tenantModuleRepo.findOne({
      where: {
        tenantId,
        moduleCode,
        enabled: 1,
        deleteTime: IsNull(),
      },
    });
    if (explicitTenantModule) {
      return true;
    }

    if (isBaselineTenantSystemModule(moduleCode)) {
      return true;
    }

    const tenantSaasModuleCodes = saasModuleCodes ?? (await this.loadTenantSaasModuleCodes(tenantId));
    const entitledSystemModuleCodes = await this.resolveSystemModuleCodesFromSaasModules(tenantSaasModuleCodes);

    return entitledSystemModuleCodes.has(moduleCode);
  }

  private async findUnsatisfiedDependency(moduleCode: string) {
    const visiting = new Set<string>();
    const satisfied = new Set<string>();
    const visit = async (currentModuleCode: string): Promise<string | undefined> => {
      if (visiting.has(currentModuleCode)) return currentModuleCode;
      if (satisfied.has(currentModuleCode)) return undefined;

      visiting.add(currentModuleCode);
      const requiredDependencies = await this.dependencyRepo.find({
        where: { moduleCode: currentModuleCode, required: 1 },
      });
      for (const dependency of requiredDependencies) {
        const dependencyModule = await this.moduleRepo.findOne({
          where: { code: dependency.dependsOnCode, deleteTime: IsNull() },
        });
        const versionRange = String(dependency.versionRange || '').trim();
        if (
          !dependencyModule ||
          dependencyModule.status !== 'enabled' ||
          !isValidSystemModuleVersionRange(versionRange) ||
          !satisfiesSystemModuleVersionRange(dependencyModule.version, versionRange)
        ) {
          return dependency.dependsOnCode;
        }
        const nestedFailure = await visit(dependency.dependsOnCode);
        if (nestedFailure) return nestedFailure;
      }
      visiting.delete(currentModuleCode);
      satisfied.add(currentModuleCode);
      return undefined;
    };

    return visit(moduleCode);
  }

  private async loadTenantSaasModuleCodes(tenantId: number) {
    const modules = await this.saasModuleService.listTenantModules(tenantId);
    return modules.map((module) => module.code).filter((code): code is string => Boolean(code));
  }

  private async resolveSystemModuleCodesFromSaasModules(saasModuleCodes: string[]) {
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

    return resolveSystemModuleCodesFromSaasModules(uniqueCodes, bridgeRows);
  }

  private getRequiredSaasModuleCodes(options: AssertModuleAccessOptions) {
    return [
      options.requiredSaasModuleCode,
      ...(options.requiredAnySaasModuleCodes || []),
    ].filter((code): code is string => Boolean(code));
  }

  private async getTenantEntitlement(tenantId: number, moduleCode: string, saasModuleCodes?: string[]) {
    const explicitTenantModule = await this.tenantModuleRepo.findOne({
      where: {
        tenantId,
        moduleCode,
        enabled: 1,
        deleteTime: IsNull(),
      },
    });
    if (explicitTenantModule) {
      return {
        enabled: true,
        source: explicitTenantModule.source || 'platform',
        tenantSaasModuleCodes: saasModuleCodes || [],
      };
    }

    if (isBaselineTenantSystemModule(moduleCode)) {
      return {
        enabled: true,
        source: 'system',
        tenantSaasModuleCodes: saasModuleCodes || [],
      };
    }

    const tenantSaasModuleCodes = saasModuleCodes ?? (await this.loadTenantSaasModuleCodes(tenantId));
    const entitledSystemModuleCodes = await this.resolveSystemModuleCodesFromSaasModules(tenantSaasModuleCodes);
    const enabled = entitledSystemModuleCodes.has(moduleCode);

    return {
      enabled,
      source: enabled ? 'plan' : null,
      tenantSaasModuleCodes,
    };
  }

  private createDiagnosis(
    options: AssertModuleAccessOptions,
    diagnosis: Partial<SystemModuleAccessDiagnosis> & {
      allowed: boolean;
      status: ModuleAccessDiagnosisStatus;
      reason: string;
      module?: Partial<SystemModuleEntity>;
    },
  ): SystemModuleAccessDiagnosis {
    return {
      module_code: options.moduleCode,
      module_name: diagnosis.module?.name || '',
      allowed: diagnosis.allowed,
      status: diagnosis.status,
      reason: diagnosis.reason,
      required_saas_module_codes: diagnosis.required_saas_module_codes || this.getRequiredSaasModuleCodes(options),
      missing_saas_module_codes: diagnosis.missing_saas_module_codes || [],
      tenant_saas_module_codes: diagnosis.tenant_saas_module_codes || options.saasModuleCodes || [],
      tenant_enabled: diagnosis.tenant_enabled ?? false,
      tenant_entitlement_source: diagnosis.tenant_entitlement_source ?? null,
      suggestions: diagnosis.suggestions || [],
      dependency_code: diagnosis.dependency_code,
      permission: diagnosis.permission,
      system_module_status: diagnosis.system_module_status || diagnosis.module?.status,
    };
  }
}
