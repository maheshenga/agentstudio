import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import {
  AppServiceLogQueryDto,
  AppServiceProbeDto,
  AppServiceReasonDto,
  AppServiceRuntimeListQueryDto,
} from './dto/app-service-runtime.dto';
import { AppPlatformService } from './services/app-platform.service';
import { AppServiceRuntimeService } from './services/app-service-runtime.service';

@ApiTags('App Service Runtime')
@ApiBearerAuth('Authorization')
@Controller('api/app-platform/runtime')
export class AppServicePlatformController {
  constructor(
    private readonly appPlatformService: AppPlatformService,
    private readonly runtimeService: AppServiceRuntimeService,
  ) {}

  @Get('instances')
  @ApiOperation({ summary: 'List administrator service instances' })
  @RequirePermission('app:runtime:list')
  listInstances(@Query() query: AppServiceRuntimeListQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.runtimeService.listRuntimeInstances(query).then((data) => ResultData.ok(data)),
    );
  }

  @Get('apps/:code')
  @ApiOperation({ summary: 'Get administrator service runtime state' })
  @RequirePermission('app:runtime:list')
  getAppRuntime(@Param('code') code: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.runtimeService.getRuntimeApp(code).then((data) => ResultData.ok(data)),
    );
  }

  @Post('apps/:code/versions/:version/candidate')
  @ApiOperation({ summary: 'Start a reviewed service candidate' })
  @RequirePermission('app:runtime:manage')
  startCandidate(
    @Param('code') code: string,
    @Param('version') version: string,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService
        .startServiceCandidate(code, version, user?.userId)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Post('apps/:code/versions/:version/candidate/stop')
  @ApiOperation({ summary: 'Stop a service candidate' })
  @RequirePermission('app:runtime:manage')
  stopCandidate(
    @Param('code') code: string,
    @Param('version') version: string,
    @Body() body: AppServiceReasonDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService
        .stopServiceCandidate(code, version, body.reason, user?.userId)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Post('apps/:code/versions/:version/publish')
  @ApiOperation({ summary: 'Publish a healthy service candidate' })
  @RequirePermission('app:runtime:manage')
  publishCandidate(
    @Param('code') code: string,
    @Param('version') version: string,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService
        .publishServiceCandidate(code, version, user?.userId)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Post('apps/:code/versions/:version/rollback')
  @ApiOperation({ summary: 'Rollback to a healthy service standby' })
  @RequirePermission('app:runtime:manage')
  rollback(
    @Param('code') code: string,
    @Param('version') version: string,
    @Body() body: AppServiceReasonDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService
        .rollbackServiceVersion(code, version, body.reason, user?.userId)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Post('apps/:code/probe')
  @ApiOperation({ summary: 'Probe the active administrator service' })
  @RequirePermission('app:runtime:probe')
  probe(
    @Param('code') code: string,
    @Body() body: AppServiceProbeDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService
        .probeActiveService(code, body.payload, user?.userId)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Get('apps/:code/logs')
  @ApiOperation({ summary: 'Read bounded redacted administrator service logs' })
  @RequirePermission('app:runtime:logs')
  logs(
    @Param('code') code: string,
    @Query() query: AppServiceLogQueryDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.runtimeService.getRuntimeLogs(code, query.lines).then((data) => ResultData.ok(data)),
    );
  }

  @Post('reconcile')
  @ApiOperation({ summary: 'Reconcile administrator service process state' })
  @RequirePermission('app:runtime:manage')
  reconcile(@User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService
        .reconcileServiceRuntime(user?.userId)
        .then((data) => ResultData.ok(data)),
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
