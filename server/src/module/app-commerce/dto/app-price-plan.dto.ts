import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import type {
  AppBillingPeriod,
  AppPriceSaleScope,
  AppPricingModel,
} from '../entities/app-price-plan.entity';

export const APP_PRICING_MODELS: AppPricingModel[] = [
  'free',
  'included',
  'subscription',
  'one_time',
];
export const APP_BILLING_PERIODS: AppBillingPeriod[] = ['none', 'monthly', 'yearly'];
export const APP_PRICE_SALE_SCOPES: AppPriceSaleScope[] = ['all', 'selected_tenants'];

export class SaveAppPricePlanDto {
  @ApiProperty({ required: true })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{2,49}$/)
  code: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: true, enum: APP_PRICING_MODELS })
  @IsIn(APP_PRICING_MODELS)
  pricing_model: AppPricingModel;

  @ApiProperty({ required: true, enum: APP_BILLING_PERIODS })
  @IsIn(APP_BILLING_PERIODS)
  billing_period: AppBillingPeriod;

  @ApiProperty({ required: true, description: 'Backend-owned integer CNY cents' })
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  amount_cents: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trial_days?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 10000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  developer_share_bps?: number;

  @ApiProperty({ required: false, type: [String], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  included_plan_codes?: string[];

  @ApiProperty({ required: false, enum: APP_PRICE_SALE_SCOPES })
  @IsOptional()
  @IsIn(APP_PRICE_SALE_SCOPES)
  sale_scope?: AppPriceSaleScope;

  @ApiProperty({ required: false, type: [Number], maxItems: 1000 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  @Min(1, { each: true })
  tenant_ids?: number[];

  @ApiProperty({ required: false, enum: [0, 1] })
  @IsOptional()
  @IsIn([0, 1])
  status?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;
}

export class UpdateAppPricePlanDto extends PartialType(
  OmitType(SaveAppPricePlanDto, ['code'] as const),
) {}

export class UpdateAppPricePlanStatusDto {
  @ApiProperty({ required: true, enum: [0, 1] })
  @IsIn([0, 1])
  status: number;
}
