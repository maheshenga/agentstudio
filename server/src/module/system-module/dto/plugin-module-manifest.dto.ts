import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PluginModuleDependencyDto {
  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z][a-z0-9_]{2,79}$/)
  code: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;
}

export class PluginModulePermissionDto {
  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(100)
  slug: string;

  @ApiProperty({ required: false, enum: ['owned', 'required', 'optional'] })
  @IsOptional()
  @IsIn(['owned', 'required', 'optional'])
  bindingType?: 'owned' | 'required' | 'optional';
}

export class PluginModuleApiEndpointDto {
  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(20)
  method: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(255)
  path: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  permission_slug?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  tenant_scoped?: boolean;
}

export class PluginModuleManifestDto {
  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z][a-z0-9_]{2,79}$/)
  code: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: true, enum: ['plugin'] })
  @IsIn(['plugin'])
  source: 'plugin';

  @ApiProperty({ required: true })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/)
  version: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

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

  @ApiProperty({ required: false, type: [PluginModuleDependencyDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginModuleDependencyDto)
  dependencies?: PluginModuleDependencyDto[];

  @ApiProperty({ required: false, type: [PluginModulePermissionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginModulePermissionDto)
  permissions?: PluginModulePermissionDto[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  routes?: string[];

  @ApiProperty({ required: false, type: [PluginModuleApiEndpointDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginModuleApiEndpointDto)
  api_endpoints?: PluginModuleApiEndpointDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  config_schema?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  hooks?: Record<string, unknown>;
}
