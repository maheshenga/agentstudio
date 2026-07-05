import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

import { SaasModuleService } from '../../saas/services/saas-module.service';
import { SAAS_TO_SYSTEM_MODULE_BRIDGE } from '../constants';
import { SystemModuleDependencyEntity } from '../entities/system-module-dependency.entity';
import { SystemModuleEntity } from '../entities/system-module.entity';
import { SystemModuleSaasBridgeEntity } from '../entities/system-module-saas-bridge.entity';
import { SystemTenantModuleEntity } from '../entities/system-tenant-module.entity';

export interface AssertModuleAccessOptions {
  tenantId?: number;
  userId?: number;
  moduleCode: string;
  permission?: string;
  userPermissions?: string[];
  saasModuleCodes?: string[];
  requiredSaasModuleCode?: string;
}

const BASELINE_TENANT_SYSTEM_MODULES = new Set(['tenant_saas']);

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
  ) {}

  async assertModuleAccess(options: AssertModuleAccessOptions) {
    const module = await this.moduleRepo.findOne({
      where: { code: options.moduleCode, deleteTime: IsNull() },
    });
    if (!module) {
      throw new NotFoundException(`Module ${options.moduleCode} not found`);
    }
    if (module.status !== 'enabled') {
      throw new BadRequestException('Module is disabled');
    }

    await this.assertDependenciesEnabled(options.moduleCode);

    if (options.tenantId !== undefined) {
      const tenantSaasModuleCodes =
        options.requiredSaasModuleCode || options.saasModuleCodes
          ? options.saasModuleCodes ?? (await this.loadTenantSaasModuleCodes(options.tenantId))
          : undefined;

      if (
        options.requiredSaasModuleCode &&
        !(tenantSaasModuleCodes || []).includes(options.requiredSaasModuleCode)
      ) {
        throw new BadRequestException('Current plan has not enabled this module');
      }

      const entitled = await this.isTenantEntitled(options.tenantId, options.moduleCode, tenantSaasModuleCodes);
      if (!entitled) {
        throw new BadRequestException('Tenant has not enabled this module');
      }
    }

    if (options.permission && !(options.userPermissions || []).includes(options.permission)) {
      throw new ForbiddenException('Missing module permission');
    }

    return true;
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

    if (BASELINE_TENANT_SYSTEM_MODULES.has(moduleCode)) {
      return true;
    }

    const tenantSaasModuleCodes = saasModuleCodes ?? (await this.loadTenantSaasModuleCodes(tenantId));
    const entitledSystemModuleCodes = await this.resolveSystemModuleCodesFromSaasModules(tenantSaasModuleCodes);

    return entitledSystemModuleCodes.has(moduleCode);
  }

  private async assertDependenciesEnabled(moduleCode: string) {
    const requiredDependencies = await this.dependencyRepo.find({
      where: { moduleCode, required: 1 },
    });
    if (!requiredDependencies.length) {
      return;
    }

    for (const dependency of requiredDependencies) {
      const dependencyModule = await this.moduleRepo.findOne({
        where: { code: dependency.dependsOnCode, deleteTime: IsNull() },
      });
      if (!dependencyModule || dependencyModule.status !== 'enabled') {
        throw new BadRequestException('Module dependency is not satisfied');
      }
    }
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

    if (bridgeRows.length) {
      return new Set(
        bridgeRows
          .filter((row) => Number(row.enabled) === 1)
          .map((row) => row.systemModuleCode)
          .filter(Boolean),
      );
    }

    return new Set(uniqueCodes.flatMap((saasModuleCode) => SAAS_TO_SYSTEM_MODULE_BRIDGE[saasModuleCode] || []));
  }
}
