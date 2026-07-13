import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AppRevenueQueryDto {
  @ApiProperty({ required: false, example: '2026-01-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  start_date?: string;

  @ApiProperty({ required: false, example: '2026-06-30' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  end_date?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  app_code?: string;
}

export class CreateAppSettlementDto {
  @ApiProperty({ required: true, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  developer_id: number;

  @ApiProperty({ required: true, example: '2026-06' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period: string;
}

export class AppSettlementListQueryDto {
  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  developer_id?: number;

  @ApiProperty({ required: false, example: '2026-06' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period?: string;

  @ApiProperty({ required: false, enum: ['draft', 'approved', 'paid', 'cancelled'] })
  @IsOptional()
  @IsIn(['draft', 'approved', 'paid', 'cancelled'])
  status?: 'draft' | 'approved' | 'paid' | 'cancelled';
}

export class ApproveAppSettlementDto {
  @ApiProperty({ required: true, minLength: 2, maxLength: 255 })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  note: string;
}

export class MarkAppSettlementPaidDto {
  @ApiProperty({ required: true, minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  payment_reference: string;
}

export class CancelAppSettlementDto {
  @ApiProperty({ required: true, minLength: 3, maxLength: 255 })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  note: string;
}
