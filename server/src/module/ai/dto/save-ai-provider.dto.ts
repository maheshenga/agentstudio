import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SaveAiProviderDto {
  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(32)
  code: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(64)
  name: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(255)
  base_url: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  api_key?: string;

  @ApiProperty({ required: false, enum: ['openai_compatible'] })
  @IsOptional()
  @IsIn(['openai_compatible'])
  adapter_type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  extra_headers?: Record<string, string> | null;

  @ApiProperty({ required: false, enum: ['0', '1', 0, 1] })
  @IsOptional()
  @IsIn(['0', '1', 0, 1])
  status?: string | number;

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
