import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { SaasModuleService } from '../../saas/services/saas-module.service';
import { SAAS_TO_SYSTEM_MODULE_BRIDGE } from '../constants';
import { SystemModuleDependencyEntity } from '../entities/system-module-dependency.entity';
import { SystemModuleEntity } from '../entities/system-module.entity';
import { SystemTenantModuleEntity } from '../entities/system-tenant-module.entity';

export interface AssertModuleAccessOptions {
  tenantId?: number;
  userId?: number;
  moduleCode: string;
  permission?: string;
  userPermissions?: string[];
  saasModuleCodes?: string[];
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
      const entitled = await this.isTenantEntitled(options.tenantId, options.moduleCode, options.saasModuleCodes);
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

    const tenantSaasModuleCodes = saasModuleCodes ?? (await this.loadTenantSaasModuleCodes(tenantId));

    return tenantSaasModuleCodes.some((saasModuleCode) =>
      (SAAS_TO_SYSTEM_MODULE_BRIDGE[saasModuleCode] || []).includes(moduleCode),
    );
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
}
