import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

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
}
