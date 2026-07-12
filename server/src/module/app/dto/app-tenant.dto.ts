import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class InstallTenantAppDto {
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  capabilities?: string[];
}

export class UpdateTenantAppCapabilitiesDto {
  @ApiProperty({ required: true, type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  capabilities: string[];
}

export class AppOpenClientInfoDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ip?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;
}
