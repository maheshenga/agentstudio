import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const RESOURCE_PACK_TYPES = ['users', 'storage_mb', 'ai_calls', 'rag_documents', 'tokens'] as const;

export class SaveSaasResourcePackDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_-]+$/)
  @MaxLength(50)
  code?: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: true, enum: RESOURCE_PACK_TYPES })
  @IsString()
  @IsIn([...RESOURCE_PACK_TYPES])
  resource_type: string;

  @ApiProperty({ required: true })
  @IsInt()
  @Min(1)
  quota_amount: number;

  @ApiProperty({ required: true })
  @IsInt()
  @Min(0)
  price_cents: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiProperty({ required: false, enum: [0, 1] })
  @IsOptional()
  @IsIn([0, 1])
  status?: number;

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

export class UpdateSaasResourcePackDto extends PartialType(SaveSaasResourcePackDto) {}

export class UpdateSaasResourcePackStatusDto {
  @ApiProperty({ required: true, enum: [0, 1] })
  @IsIn([0, 1])
  status: number;
}
