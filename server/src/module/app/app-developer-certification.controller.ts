import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import {
  DecideDeveloperCertificationDto,
  DeveloperCertificationListDto,
  SetDeveloperCertificationDisabledDto,
} from './dto/app-developer-certification.dto';
import { AppDeveloperCertificationService } from './services/app-developer-certification.service';

@ApiTags('App Developer Certification')
@ApiBearerAuth('Authorization')
@Controller('api/app-platform/developers')
export class AppDeveloperCertificationController {
  constructor(
    private readonly certificationService: AppDeveloperCertificationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List developer certification profiles' })
  @RequirePermission('app:developer-certification:list')
  list(@Query() query: DeveloperCertificationListDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.certificationService.list(query).then((data) => ResultData.ok(data)),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a developer certification profile' })
  @RequirePermission('app:developer-certification:list')
  getProfile(@Param('id', ParseIntPipe) profileId: number, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.certificationService
        .getProfile(profileId)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Post(':id/decision')
  @ApiOperation({ summary: 'Approve or reject developer certification' })
  @RequirePermission('app:developer-certification:manage')
  decide(
    @Param('id', ParseIntPipe) profileId: number,
    @Body() body: DecideDeveloperCertificationDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.certificationService
        .decide(profileId, user.userId, body)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Post(':id/disabled')
  @ApiOperation({ summary: 'Enable or disable developer certification' })
  @RequirePermission('app:developer-certification:manage')
  setDisabled(
    @Param('id', ParseIntPipe) profileId: number,
    @Body() body: SetDeveloperCertificationDisabledDto,
    @User() user: UserDto,
  ) {
    return this.runOutsideTenant(user, () =>
      this.certificationService
        .setDisabled(profileId, user.userId, body)
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
