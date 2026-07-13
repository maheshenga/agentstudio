import { Body, Controller, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { CreateDeveloperAppDto, UpdateDeveloperAppDto } from './dto/app-developer.dto';
import { APP_UPLOAD_MULTER_OPTIONS } from './app-upload.constants';
import { AppDeveloperService } from './services/app-developer.service';

@ApiTags('App Developer')
@ApiBearerAuth('Authorization')
@Controller('api/app-developer/apps')
export class AppDeveloperController {
  constructor(private readonly appDeveloperService: AppDeveloperService) {}

  @Get()
  @ApiOperation({ summary: 'List my developer apps' })
  @RequirePermission('app:developer:list')
  listApps(@User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.appDeveloperService.listApps(user.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create my app draft' })
  @RequirePermission('app:developer:create')
  createApp(@Body() body: CreateDeveloperAppDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.appDeveloperService
        .createApp(body, user.userId, this.resolveDeveloperName(user))
        .then((data) => ResultData.ok(data)),
    );
  }

  @Get('service-overview')
  @ApiOperation({ summary: 'Get owned service runtime overview' })
  @RequirePermission('app:developer:observability')
  getServiceOverview(@Query('days') days: string | undefined, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.appDeveloperService
        .getServiceOverview(user.userId, Number(days || 7))
        .then((data) => ResultData.ok(data)),
    );
  }

  @Get(':code/runtime/logs')
  @ApiOperation({ summary: 'Get bounded redacted logs for my service app' })
  @RequirePermission('app:developer:observability')
  getServiceLogs(
    @Param('code') code: string,
    @Query('lines') lines: string | undefined,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.appDeveloperService
        .getServiceLogs(code, user.userId, Number(lines || 100))
        .then((data) => ResultData.ok(data)),
    );
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get my developer app detail' })
  @RequirePermission('app:developer:read')
  getApp(@Param('code') code: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.appDeveloperService.getApp(code, user.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Put(':code')
  @ApiOperation({ summary: 'Update my developer app metadata' })
  @RequirePermission('app:developer:update')
  updateApp(
    @Param('code') code: string,
    @Body() body: UpdateDeveloperAppDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.appDeveloperService.updateApp(code, body, user.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Post(':code/versions/upload')
  @UseInterceptors(FileInterceptor('file', APP_UPLOAD_MULTER_OPTIONS))
  @ApiOperation({ summary: 'Upload a version for my app' })
  @RequirePermission('app:developer:upload')
  uploadVersion(
    @Param('code') code: string,
    @UploadedFile() file: Express.Multer.File,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.appDeveloperService.uploadVersion(code, file, user.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Post(':code/versions/:version/submit')
  @ApiOperation({ summary: 'Resubmit a rejected version for review' })
  @RequirePermission('app:developer:submit')
  submitVersion(
    @Param('code') code: string,
    @Param('version') version: string,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.appDeveloperService.submitVersion(code, version, user.userId).then((data) => ResultData.ok(data)),
    );
  }

  private resolveDeveloperName(user: UserDto) {
    return String(
      user?.user?.nickname || user?.user?.nickName || user?.user?.username || `User ${user.userId}`,
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
