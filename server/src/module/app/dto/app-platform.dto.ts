import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

import type { AppPackageStatus, AppPackageType, AppPackageVisibility } from '../entities/app-package.entity';

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
export const APP_PACKAGE_VISIBILITIES: AppPackageVisibility[] = ['platform', 'tenant', 'marketplace', 'private'];

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
}
