import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class TenantProvisionDto {
  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(100)
  tenant_name: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(50)
  tenant_code: string;

  @ApiProperty({ required: true })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  owner_username: string;

  @ApiProperty({ required: true })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  owner_password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  owner_realname?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  plan_code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  with_trial?: boolean;
}
