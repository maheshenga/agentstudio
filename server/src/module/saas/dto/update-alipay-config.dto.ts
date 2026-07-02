import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAlipayConfigDto {
  @ApiProperty({ required: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  app_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  private_key?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  public_key?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  gateway_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notify_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  return_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
