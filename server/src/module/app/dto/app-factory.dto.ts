import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

import type { AppFactoryModuleKind, AppFactoryModuleVisibility } from '../entities/app-factory-module.entity';

export const APP_FACTORY_KINDS: AppFactoryModuleKind[] = ['static_page'];
export const APP_FACTORY_VISIBILITIES: AppFactoryModuleVisibility[] = ['platform', 'tenant', 'marketplace', 'private'];

export class AppFactoryListQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;
}

export class AppFactoryTemplateListQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;
}

export class SaveAppFactoryModuleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z][a-z0-9_]{2,79}$/)
  code?: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ required: false, enum: APP_FACTORY_KINDS })
  @IsOptional()
  @IsIn(APP_FACTORY_KINDS)
  kind?: AppFactoryModuleKind;

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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200000)
  html_content?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  css_content?: string;

  @ApiProperty({ required: false, enum: APP_FACTORY_VISIBILITIES })
  @IsOptional()
  @IsIn(APP_FACTORY_VISIBILITIES)
  visibility?: AppFactoryModuleVisibility;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  saas_module_code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  system_module_code?: string;

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

export class PublishAppFactoryModuleDto {
  @ApiProperty({ required: true })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/)
  version: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
