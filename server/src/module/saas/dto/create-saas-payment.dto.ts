import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import type { SaasPaymentOrderType } from '../services/saas-payment.service';

export class CreateSaasPaymentDto {
  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  order_no: string;

  @ApiProperty({ required: false, enum: ['plan', 'resource_pack', 'app'], default: 'plan' })
  @IsOptional()
  @IsIn(['plan', 'resource_pack', 'app'])
  order_type?: SaasPaymentOrderType;
}
