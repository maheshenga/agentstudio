import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import type {
  AppPackageStatus,
  AppPackageType,
  AppPackageVisibility,
} from '../entities/app-package.entity';
import type {
  AppVersionPublishStatus,
  AppVersionReviewStatus,
} from '../entities/app-package-version.entity';

export const APP_PACKAGE_TYPES: AppPackageType[] = ['internal', 'static', 'iframe'];
export const APP_PACKAGE_STATUSES: AppPackageStatus[] = [
  'draft',
  'pending_review',
  'approved',
  'published',
  'rejected',
  'disabled',
  'archived',
];
export const APP_PACKAGE_VISIBILITIES: AppPackageVisibility[] = [
  'platform',
  'tenant',
  'marketplace',
  'private',
];
export const APP_VERSION_REVIEW_STATUSES: AppVersionReviewStatus[] = [
  'pending',
  'approved',
  'rejected',
];
export const APP_VERSION_PUBLISH_STATUSES: AppVersionPublishStatus[] = [
  'unpublished',
  'published',
  'failed',
  'unpublished_retired',
];

export class AppPlatformListQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ required: false, enum: APP_PACKAGE_TYPES })
  @IsOptional()
  @IsIn(APP_PACKAGE_TYPES)
  type?: AppPackageType;

  @ApiProperty({ required: false, enum: APP_PACKAGE_STATUSES })
  @IsOptional()
  @IsIn(APP_PACKAGE_STATUSES)
  status?: AppPackageStatus;
}

export class AppReviewQueueQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ required: false, enum: APP_PACKAGE_TYPES })
  @IsOptional()
  @IsIn(APP_PACKAGE_TYPES)
  type?: AppPackageType;

  @ApiProperty({ required: false, enum: APP_VERSION_REVIEW_STATUSES })
  @IsOptional()
  @IsIn(APP_VERSION_REVIEW_STATUSES)
  review_status?: AppVersionReviewStatus;

  @ApiProperty({ required: false, enum: APP_VERSION_PUBLISH_STATUSES })
  @IsOptional()
  @IsIn(APP_VERSION_PUBLISH_STATUSES)
  publish_status?: AppVersionPublishStatus;
}

export class CreateAppPackageDto {
  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z][a-z0-9_]{2,79}$/)
  code: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ required: true, enum: APP_PACKAGE_TYPES })
  @IsIn(APP_PACKAGE_TYPES)
  type: AppPackageType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  summary?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ required: false, enum: APP_PACKAGE_VISIBILITIES })
  @IsOptional()
  @IsIn(APP_PACKAGE_VISIBILITIES)
  visibility?: AppPackageVisibility;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  entry_url?: string;

  @ApiProperty({ required: false, example: '1.0.0' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^\d+\.\d+\.\d+$/)
  version?: string;

  @ApiProperty({ required: false, type: [String], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  allowed_origins?: string[];

  @ApiProperty({ required: false, type: [String], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  requested_capabilities?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  developer_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  system_module_code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  saas_module_code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

export class UpdateAppPackageDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  summary?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ required: false, enum: APP_PACKAGE_VISIBILITIES })
  @IsOptional()
  @IsIn(APP_PACKAGE_VISIBILITIES)
  visibility?: AppPackageVisibility;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  entry_url?: string;

  @ApiProperty({ required: false, example: '1.1.0' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^\d+\.\d+\.\d+$/)
  version?: string;

  @ApiProperty({ required: false, type: [String], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  allowed_origins?: string[];

  @ApiProperty({ required: false, type: [String], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  requested_capabilities?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  developer_name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  system_module_code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  saas_module_code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

export class UpdateAppPackageStatusDto {
  @ApiProperty({ required: true, enum: APP_PACKAGE_STATUSES })
  @IsIn(APP_PACKAGE_STATUSES)
  status: AppPackageStatus;
}

export class ReviewAppPackageVersionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  approved_capabilities?: string[];
}

export class ExchangeIframeLaunchDto {
  @ApiProperty({ maxLength: 4096 })
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  @Matches(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  launch_token: string;
}
