import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { SAAS_PAYMENT_ALIPAY } from '../constants';

export class CreateResourcePackOrderDto {
  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(50)
  resource_pack_code: string;

  @ApiProperty({ required: false, default: SAAS_PAYMENT_ALIPAY })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  payment_method?: string;
}
