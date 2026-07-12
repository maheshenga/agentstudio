import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

import type { AppDeveloperRuntimeType } from '../entities/app-developer-profile.entity';
import type { AppDeveloperRiskLevel } from '../entities/app-developer-profile.entity';
import type { AppDeveloperCertificationStatus } from '../entities/app-developer-profile.entity';

export const APP_DEVELOPER_RUNTIME_TYPES: AppDeveloperRuntimeType[] = [
  'static',
  'iframe',
  'service',
];

export class ApplyDeveloperCertificationDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100)
  display_name: string;

  @ApiProperty({ required: false, maxLength: 255 })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(255)
  website?: string;

  @ApiProperty({ minLength: 20, maxLength: 2000 })
  @IsString()
  @Length(20, 2000)
  statement: string;

  @ApiProperty({ enum: APP_DEVELOPER_RUNTIME_TYPES, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsIn(APP_DEVELOPER_RUNTIME_TYPES, { each: true })
  requested_runtime_types: AppDeveloperRuntimeType[];
}

export class DecideDeveloperCertificationDto {
  @ApiProperty({ enum: ['certified', 'rejected'] })
  @IsIn(['certified', 'rejected'])
  decision: 'certified' | 'rejected';

  @ApiProperty({ enum: APP_DEVELOPER_RUNTIME_TYPES, isArray: true })
  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(APP_DEVELOPER_RUNTIME_TYPES, { each: true })
  approved_runtime_types: AppDeveloperRuntimeType[];

  @ApiProperty({ enum: ['low', 'medium', 'high'] })
  @IsIn(['low', 'medium', 'high'])
  risk_level: AppDeveloperRiskLevel;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  certification_expiry?: string;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @Length(3, 500)
  message: string;
}

export class SetDeveloperCertificationDisabledDto {
  @ApiProperty()
  @IsBoolean()
  disabled: boolean;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @Length(3, 500)
  message: string;
}

export class DeveloperCertificationListDto {
  @ApiProperty({ required: false, enum: ['pending', 'certified', 'rejected', 'expired'] })
  @IsOptional()
  @IsIn(['pending', 'certified', 'rejected', 'expired'])
  certification_status?: AppDeveloperCertificationStatus;

  @ApiProperty({ required: false, enum: ['low', 'medium', 'high'] })
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  risk_level?: AppDeveloperRiskLevel;

  @ApiProperty({ required: false, enum: APP_DEVELOPER_RUNTIME_TYPES })
  @IsOptional()
  @IsIn(APP_DEVELOPER_RUNTIME_TYPES)
  runtime_type?: AppDeveloperRuntimeType;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  disabled?: boolean;
}
