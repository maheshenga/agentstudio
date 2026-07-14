import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class SaasPlanQuotaDto {
  @ApiProperty({ required: true, enum: ['users', 'ai_calls', 'tokens'] })
  @IsIn(['users', 'ai_calls', 'tokens'])
  quota_type: string;

  @ApiProperty({ required: true })
  @IsInt()
  @Min(0)
  total_quota: number;

  @ApiProperty({ required: false, enum: [0, 1] })
  @IsOptional()
  @IsIn([0, 1])
  status?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

export class UpdateSaasPlanQuotasDto {
  @ApiProperty({ required: true, type: [SaasPlanQuotaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaasPlanQuotaDto)
  quotas: SaasPlanQuotaDto[];
}
