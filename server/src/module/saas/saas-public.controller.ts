import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/auth.decorator';
import { ResultData } from '../../common/utils/result';
import { SaasSignupDto } from './dto/signup.dto';
import { SaasProvisioningService } from './services/saas-provisioning.service';

@ApiTags('SaaS Public')
@Controller('saas')
export class SaasPublicController {
  constructor(private readonly provisioning: SaasProvisioningService) {}

  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Public SaaS signup' })
  signup(@Body() body: SaasSignupDto) {
    return this.provisioning.signup(body).then((data) => ResultData.ok(data));
  }
}
