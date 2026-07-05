import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { User, UserDto } from '../system/user/user.decorator';
import { SystemModuleListQueryDto, UpdateSystemModuleStatusDto } from './dto/save-system-module.dto';
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
    return this.runOutsideTenant(user, () => this.registry.listModules(query).then((data) => ResultData.ok(data)));
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get system module detail' })
  @RequirePermission('system:module:read')
  getModule(@Param('code') code: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.registry.getModule(code).then((data) => ResultData.ok(data)));
  }

  @Put(':code/status')
  @ApiOperation({ summary: 'Update system module status' })
  @RequirePermission('system:module:status')
  updateStatus(@Param('code') code: string, @Body() body: UpdateSystemModuleStatusDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.registry.updateStatus(code, body.status, user?.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Get(':code/events')
  @ApiOperation({ summary: 'List system module events' })
  @RequirePermission('system:module:event')
  listEvents(@Param('code') code: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.registry.listEvents(code).then((data) => ResultData.ok(data)));
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
