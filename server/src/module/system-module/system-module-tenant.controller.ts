import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { getTenantId } from '../../common/utils/tenant.util';
import { ResultData } from '../../common/utils/result';
import { SystemModuleAccessService } from './services/system-module-access.service';
import { SystemModuleRegistryService } from './services/system-module-registry.service';

@ApiTags('Tenant System Modules')
@ApiBearerAuth('Authorization')
@Controller('api/tenant/modules')
export class SystemModuleTenantController {
  constructor(
    private readonly registry: SystemModuleRegistryService,
    private readonly access: SystemModuleAccessService,
  ) {}

  @Get()
  @RequirePermission('tenant:module:list')
  @ApiOperation({ summary: 'List current tenant system modules' })
  async listModules() {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(await this.registry.listTenantModules(tenantId));
  }

  @Get(':code/access-diagnosis')
  @RequirePermission('tenant:module:list')
  @ApiOperation({ summary: 'Diagnose current tenant system module access' })
  async diagnoseModule(@Param('code') code: string) {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(await this.access.diagnoseModuleAccess({ tenantId, moduleCode: code }));
  }
}
