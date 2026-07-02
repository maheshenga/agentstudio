import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { SAAS_PAYMENT_ALIPAY } from '../constants';

export class CreateUpgradeOrderDto {
  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(50)
  plan_code: string;

  @ApiProperty({ required: false, enum: ['monthly', 'yearly'] })
  @IsOptional()
  @IsIn(['monthly', 'yearly'])
  billing_cycle?: 'monthly' | 'yearly';

  @ApiProperty({ required: false, default: SAAS_PAYMENT_ALIPAY })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  payment_method?: string;
}
