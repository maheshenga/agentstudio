import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { getTenantId } from '../../common/utils/tenant.util';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { SaveSystemModuleConfigDto } from './dto/system-module-config.dto';
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

  @Get(':code/config')
  @RequirePermission('tenant:module:list')
  @ApiOperation({ summary: 'Get current tenant module configuration' })
  async getTenantConfig(@Param('code') code: string) {
    const tenantId = getTenantId();
    if (!tenantId) return ResultData.fail(401, 'Tenant context is required');
    await this.access.assertModuleAccess({ tenantId, moduleCode: code });
    return ResultData.ok(await this.registry.getTenantConfig(tenantId, code));
  }

  @Put(':code/config')
  @RequirePermission('tenant:module:config')
  @ApiOperation({ summary: 'Update current tenant module configuration' })
  async saveTenantConfig(
    @Param('code') code: string,
    @Body() body: SaveSystemModuleConfigDto,
    @User() user: UserDto,
  ) {
    const tenantId = getTenantId();
    if (!tenantId) return ResultData.fail(401, 'Tenant context is required');
    await this.access.assertModuleAccess({ tenantId, moduleCode: code });
    return ResultData.ok(
      await this.registry.saveTenantConfig(tenantId, code, body.config, user?.userId),
    );
  }
}
