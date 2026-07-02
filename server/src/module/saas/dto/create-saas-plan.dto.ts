import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateSaasPlanDto {
  @ApiProperty({ required: true })
  @IsString()
  @Matches(/^[a-z0-9_-]+$/)
  @MaxLength(50)
  code: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false, enum: ['monthly', 'yearly'] })
  @IsOptional()
  @IsIn(['monthly', 'yearly'])
  billing_cycle?: 'monthly' | 'yearly';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  price_monthly?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  price_yearly?: number;

  @ApiProperty({ required: false, enum: [0, 1] })
  @IsOptional()
  @IsIn([0, 1])
  status?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}