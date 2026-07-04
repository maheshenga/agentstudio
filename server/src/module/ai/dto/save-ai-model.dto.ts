import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SaveAiModelDto {
  @ApiProperty({ required: true })
  @IsString()
  provider_id: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(64)
  model_code: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(64)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1024)
  context_window?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(256)
  max_output_tokens?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  default_temperature?: number;

  @ApiProperty({ required: false, enum: [0, 1] })
  @IsOptional()
  @IsIn([0, 1])
  is_default?: number;

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
