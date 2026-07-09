import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { getTenantId } from '../../common/utils/tenant.util';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { AppTenantService } from './services/app-tenant.service';

@ApiTags('App Tenant')
@ApiBearerAuth('Authorization')
@Controller('api/app-tenant')
export class AppTenantController {
  constructor(private readonly appTenantService: AppTenantService) {}

  @Get('marketplace')
  @ApiOperation({ summary: 'List tenant app marketplace' })
  @RequirePermission('app:tenant:marketplace')
  async marketplace() {
    const tenantId = getTenantId();
    if (!tenantId) return ResultData.fail(401, 'Tenant context is required');
    return ResultData.ok(await this.appTenantService.listMarketplace(tenantId));
  }

  @Get('installed')
  @ApiOperation({ summary: 'List installed tenant apps' })
  @RequirePermission('app:tenant:marketplace')
  async installed() {
    const tenantId = getTenantId();
    if (!tenantId) return ResultData.fail(401, 'Tenant context is required');
    return ResultData.ok(await this.appTenantService.listInstalled(tenantId));
  }

  @Post('apps/:code/install')
  @ApiOperation({ summary: 'Install tenant app' })
  @RequirePermission('app:tenant:install')
  async install(@Param('code') code: string, @User() user: UserDto) {
    const tenantId = getTenantId();
    if (!tenantId) return ResultData.fail(401, 'Tenant context is required');
    return ResultData.ok(await this.appTenantService.installApp(tenantId, code, user?.userId));
  }

  @Post('apps/:code/uninstall')
  @ApiOperation({ summary: 'Uninstall tenant app' })
  @RequirePermission('app:tenant:install')
  async uninstall(@Param('code') code: string) {
    const tenantId = getTenantId();
    if (!tenantId) return ResultData.fail(401, 'Tenant context is required');
    return ResultData.ok(await this.appTenantService.uninstallApp(tenantId, code));
  }

  @Get('apps/:code/open')
  @ApiOperation({ summary: 'Get tenant app open metadata' })
  @RequirePermission('app:tenant:open')
  async open(@Param('code') code: string, @User() user: UserDto, @Req() req: Request) {
    const tenantId = getTenantId();
    if (!tenantId) return ResultData.fail(401, 'Tenant context is required');
    return ResultData.ok(
      await this.appTenantService.getOpenMetadata(tenantId, code, user?.userId, {
        ip: String((req as any).ip || req.ip || ''),
        userAgent: String(req.headers['user-agent'] || ''),
      }),
    );
  }
}
