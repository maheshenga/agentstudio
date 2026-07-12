import { Body, Controller, Get, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import {
  AppPlatformListQueryDto,
  CreateAppPackageDto,
  ReviewAppPackageVersionDto,
  UpdateAppPackageDto,
  UpdateAppPackageStatusDto,
} from './dto/app-platform.dto';
import { AppPlatformService } from './services/app-platform.service';

@ApiTags('App Platform')
@ApiBearerAuth('Authorization')
@Controller('api/app-platform/apps')
export class AppPlatformController {
  constructor(private readonly appPlatformService: AppPlatformService) {}

  @Get()
  @ApiOperation({ summary: 'List platform apps' })
  @RequirePermission('app:platform:list')
  listApps(@Query() query: AppPlatformListQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.appPlatformService.listApps(query).then((data) => ResultData.ok(data)));
  }

  @Post()
  @ApiOperation({ summary: 'Create platform app' })
  @RequirePermission('app:platform:create')
  createApp(@Body() body: CreateAppPackageDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService.createApp(body, user?.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get platform app detail' })
  @RequirePermission('app:platform:read')
  getApp(@Param('code') code: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.appPlatformService.getApp(code).then((data) => ResultData.ok(data)));
  }

  @Put(':code')
  @ApiOperation({ summary: 'Update platform app' })
  @RequirePermission('app:platform:update')
  updateApp(@Param('code') code: string, @Body() body: UpdateAppPackageDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.appPlatformService.updateApp(code, body).then((data) => ResultData.ok(data)));
  }

  @Put(':code/status')
  @ApiOperation({ summary: 'Update platform app status' })
  @RequirePermission('app:platform:status')
  updateStatus(@Param('code') code: string, @Body() body: UpdateAppPackageStatusDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService.updateStatus(code, body.status, user?.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Post(':code/versions/:version/submit')
  @ApiOperation({ summary: 'Submit app version for review' })
  @RequirePermission('app:platform:upload')
  submitVersion(@Param('code') code: string, @Param('version') version: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService.submitVersion(code, version, user?.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Post(':code/versions/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload static app version package' })
  @RequirePermission('app:platform:upload')
  uploadVersion(@Param('code') code: string, @UploadedFile() file: Express.Multer.File, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService.uploadStaticVersion(code, file, user?.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Post(':code/versions/:version/approve')
  @ApiOperation({ summary: 'Approve app version' })
  @RequirePermission('app:platform:review')
  approveVersion(
    @Param('code') code: string,
    @Param('version') version: string,
    @Body() body: ReviewAppPackageVersionDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService
        .approveVersion(code, version, body.message || '', user?.userId, body.approved_capabilities)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Post(':code/versions/:version/reject')
  @ApiOperation({ summary: 'Reject app version' })
  @RequirePermission('app:platform:review')
  rejectVersion(
    @Param('code') code: string,
    @Param('version') version: string,
    @Body() body: ReviewAppPackageVersionDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService.rejectVersion(code, version, body.message || '', user?.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Post(':code/versions/:version/publish')
  @ApiOperation({ summary: 'Publish app version' })
  @RequirePermission('app:platform:publish')
  publishVersion(@Param('code') code: string, @Param('version') version: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService.publishVersion(code, version, user?.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Post(':code/versions/:version/unpublish')
  @ApiOperation({ summary: 'Unpublish app version' })
  @RequirePermission('app:platform:publish')
  unpublishVersion(
    @Param('code') code: string,
    @Param('version') version: string,
    @Body() body: ReviewAppPackageVersionDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService.unpublishVersion(code, version, body.message || '', user?.userId).then((data) => ResultData.ok(data)),
    );
  }

  @Post(':code/versions/:version/rollback')
  @ApiOperation({ summary: 'Rollback app version' })
  @RequirePermission('app:platform:publish')
  rollbackVersion(
    @Param('code') code: string,
    @Param('version') version: string,
    @Body() body: ReviewAppPackageVersionDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.appPlatformService.rollbackVersion(code, version, body.message || '', user?.userId).then((data) => ResultData.ok(data)),
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
