import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { ApplyDeveloperCertificationDto } from './dto/app-developer-certification.dto';
import { AppDeveloperCertificationService } from './services/app-developer-certification.service';

@ApiTags('App Developer Profile')
@ApiBearerAuth('Authorization')
@Controller('api/app-developer/profile')
export class AppDeveloperProfileController {
  constructor(
    private readonly certificationService: AppDeveloperCertificationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get my developer certification profile' })
  getOwnProfile(@User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.certificationService
        .getOwnProfile(user.userId)
        .then((data) => ResultData.ok(data)),
    );
  }

  @Post('apply')
  @ApiOperation({ summary: 'Apply for developer certification' })
  apply(@Body() body: ApplyDeveloperCertificationDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () =>
      this.certificationService
        .apply(user.userId, body)
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
