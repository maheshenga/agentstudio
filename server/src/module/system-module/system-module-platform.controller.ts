import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { PluginModuleManifestDto } from './dto/plugin-module-manifest.dto';
import { TenantModuleGrantReasonDto } from './dto/tenant-module-grant.dto';
import {
  SaveSystemModuleSaasBridgeDto,
  SystemModuleListQueryDto,
  SystemModuleSaasBridgeListQueryDto,
  UpdateSystemModuleSaasBridgeStatusDto,
  UpdateSystemModuleStatusDto,
} from './dto/save-system-module.dto';
import { SystemModuleRegistryService } from './services/system-module-registry.service';

@ApiTags('System Modules')
@ApiBearerAuth('Authorization')
@Controller('api/system/modules')
export class SystemModulePlatformController {
  constructor(private readonly registry: SystemModuleRegistryService) {}

  @Get()
  @ApiOperation({ summary: 'List system modules' })
  @RequirePermission('system:module:list')
  listModules(@Query() query: SystemModuleListQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.registry.listModules(query).then((data) => ResultData.ok(data)),
    );
  }

  @Post('plugins/register')
  @ApiOperation({ summary: 'Register plugin module metadata manifest' })
  @RequirePermission('system:module:install')
  registerPluginManifest(@Body() body: PluginModuleManifestDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.registry.registerPluginManifest(body, user?.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Get('saas-bridges')
  @ApiOperation({ summary: 'List SaaS to system module bridge configs' })
  @RequirePermission('system:module:list')
  listSaasBridges(@Query() query: SystemModuleSaasBridgeListQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.registry.listSaasBridges(query).then((data) => ResultData.ok(data)),
    );
  }

  @Post('saas-bridges')
  @ApiOperation({ summary: 'Create or update SaaS to system module bridge config' })
  @RequirePermission('system:module:config')
  saveSaasBridge(@Body() body: SaveSystemModuleSaasBridgeDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.registry.saveSaasBridge(body, user?.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Put('saas-bridges/:id/status')
  @ApiOperation({ summary: 'Update SaaS to system module bridge config status' })
  @RequirePermission('system:module:config')
  updateSaasBridgeStatus(
    @Param('id') id: string,
    @Body() body: UpdateSystemModuleSaasBridgeStatusDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.registry
        .updateSaasBridgeStatus(Number(id), body.enabled, user?.userId)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Get('tenant-grants/:tenantId')
  @ApiOperation({ summary: 'List system module grants for a tenant' })
  @RequirePermission('system:module:list')
  listTenantGrants(@Param('tenantId') tenantId: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.registry.listTenantGrants(Number(tenantId)).then((data) => ResultData.ok(data)),
    );
  }

  @Post('tenant-grants/:tenantId/:code/grant')
  @ApiOperation({ summary: 'Grant a system module to a tenant' })
  @RequirePermission('system:module:config')
  grantTenantModule(
    @Param('tenantId') tenantId: string,
    @Param('code') code: string,
    @Body() body: TenantModuleGrantReasonDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.registry
        .grantTenantModule(Number(tenantId), code, user?.userId, body?.reason || '')
        .then((data) => ResultData.ok(data)),
    );
  }

  @Post('tenant-grants/:tenantId/:code/revoke')
  @ApiOperation({ summary: 'Revoke an explicit system module grant from a tenant' })
  @RequirePermission('system:module:config')
  revokeTenantModule(
    @Param('tenantId') tenantId: string,
    @Param('code') code: string,
    @Body() body: TenantModuleGrantReasonDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.registry
        .revokeTenantModule(Number(tenantId), code, user?.userId, body?.reason || '')
        .then((data) => ResultData.ok(data)),
    );
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get system module detail' })
  @RequirePermission('system:module:read')
  getModule(@Param('code') code: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.registry.getModule(code).then((data) => ResultData.ok(data)),
    );
  }

  @Put(':code/status')
  @ApiOperation({ summary: 'Update system module status' })
  @RequirePermission('system:module:status')
  updateStatus(
    @Param('code') code: string,
    @Body() body: UpdateSystemModuleStatusDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.registry
        .updateStatus(code, body.status, user?.userId)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Get(':code/events')
  @ApiOperation({ summary: 'List system module events' })
  @RequirePermission('system:module:event')
  listEvents(@Param('code') code: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.registry.listEvents(code).then((data) => ResultData.ok(data)),
    );
  }

  @Post('register-built-ins')
  @ApiOperation({ summary: 'Register built-in system modules' })
  @RequirePermission('system:module:install')
  registerBuiltIns(@User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.registry.registerBuiltInModules().then((data) => ResultData.ok(data)),
    );
  }

  private runOutsideTenant(user: UserDto, callback: () => Promise<ResultData>) {
    return TenantContext.run(
      {
        tenantId: undefined,
        userId: user?.userId,
        ignoreAudit: false,
        ignoreTenant: true,
      },
      callback,
    );
  }
}
