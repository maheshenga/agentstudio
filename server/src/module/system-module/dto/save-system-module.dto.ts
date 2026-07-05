import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { SYSTEM_MODULE_STATUSES } from '../constants';
import type { SystemModuleStatus } from '../constants';

export class SystemModuleListQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateSystemModuleStatusDto {
  @ApiProperty({ enum: SYSTEM_MODULE_STATUSES })
  @IsIn([...SYSTEM_MODULE_STATUSES])
  status: SystemModuleStatus;
}

export class SystemModuleSaasBridgeListQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  saas_module_code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  system_module_code?: string;

  @ApiProperty({ required: false, enum: [0, 1] })
  @IsOptional()
  @IsIn([0, 1, '0', '1'])
  enabled?: number | string;
}

export class SaveSystemModuleSaasBridgeDto {
  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_:-]{1,49}$/)
  saas_module_code: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z][a-z0-9_:-]{1,79}$/)
  system_module_code: string;

  @ApiProperty({ required: false, enum: [0, 1] })
  @IsOptional()
  @IsIn([0, 1])
  enabled?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

export class UpdateSystemModuleSaasBridgeStatusDto {
  @ApiProperty({ required: true, enum: [0, 1] })
  @IsIn([0, 1])
  enabled: number;
}
