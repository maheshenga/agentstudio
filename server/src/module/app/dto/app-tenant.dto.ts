import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { APP_PACKAGE_TYPES } from './app-platform.dto';
import type { AppPackageType } from '../entities/app-package.entity';

export class AppMarketplaceListQueryDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyword?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiProperty({ required: false, enum: APP_PACKAGE_TYPES })
  @IsOptional()
  @IsIn(APP_PACKAGE_TYPES)
  type?: AppPackageType;
}

export class InstallTenantAppDto {
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  capabilities?: string[];
}

export class UpgradeTenantAppDto {
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  capabilities?: string[];
}

export class UpdateTenantAppCapabilitiesDto {
  @ApiProperty({ required: true, type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  capabilities: string[];
}

export class AppOpenClientInfoDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ip?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;
}
