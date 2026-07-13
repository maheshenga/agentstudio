import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAppOrderDto {
  @ApiProperty({ required: true })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{2,49}$/)
  price_plan_code: string;

  @ApiProperty({ required: false, enum: ['alipay'], default: 'alipay' })
  @IsOptional()
  @IsIn(['alipay'])
  payment_method?: 'alipay';
}

export class StartAppTrialDto {
  @ApiProperty({ required: true })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{2,49}$/)
  price_plan_code: string;
}

export class AppOrderListQueryDto {
  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  order_no?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  app_code?: string;

  @ApiProperty({ required: false, enum: ['pending', 'paid', 'refunded', 'closed'] })
  @IsOptional()
  @IsIn(['pending', 'paid', 'refunded', 'closed'])
  status?: 'pending' | 'paid' | 'refunded' | 'closed';

  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tenant_id?: number;

  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  developer_id?: number;
}

export class AppLicenseListQueryDto {
  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tenant_id?: number;

  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  app_id?: number;

  @ApiProperty({
    required: false,
    enum: ['active', 'trialing', 'expired', 'revoked', 'refunded'],
  })
  @IsOptional()
  @IsIn(['active', 'trialing', 'expired', 'revoked', 'refunded'])
  status?: 'active' | 'trialing' | 'expired' | 'revoked' | 'refunded';
}

export class RecordAppRefundDto {
  @ApiProperty({ required: true, minLength: 3, maxLength: 255 })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason: string;

  @ApiProperty({ required: true, minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  provider_reference: string;
}

export class RevokeAppLicenseDto {
  @ApiProperty({ required: true, minLength: 3, maxLength: 255 })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason: string;
}
