import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ResultData } from '../../common/utils/result';
import { TenantContext } from '../../common/tenant/tenant.context';
import { User } from '../system/user/user.decorator';
import type { UserDto } from '../system/user/user.decorator';
import { TenantProvisionDto } from './dto/tenant-provision.dto';
import { SaasProvisioningService } from './services/saas-provisioning.service';

@ApiTags('SaaS Platform')
@ApiBearerAuth('Authorization')
@Controller('api/saas/platform')
export class SaasPlatformController {
  constructor(private readonly provisioning: SaasProvisioningService) {}

  @Post('tenants')
  @ApiOperation({ summary: 'Create SaaS tenant from platform' })
  @RequirePermission('saas:tenant:save')
  createTenant(@User() user: UserDto, @Body() body: TenantProvisionDto) {
    return TenantContext.run(
      {
        tenantId: undefined,
        userId: user?.userId,
        ignoreAudit: false,
        ignoreTenant: true,
      },
      () => this.provisioning.createTenantFromPlatform(body).then((data) => ResultData.ok(data)),
    );
  }
}
