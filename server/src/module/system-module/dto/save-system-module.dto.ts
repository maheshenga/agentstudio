import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

import { SYSTEM_MODULE_STATUSES, SystemModuleStatus } from '../constants';

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
