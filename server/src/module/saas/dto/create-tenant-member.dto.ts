import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CreateTenantMemberDto {
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username: string;

  @ApiProperty({ required: true })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  realname?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateIf((dto) => dto.email !== '')
  @IsEmail()
  @MaxLength(128)
  email?: string;

  @ApiProperty({ required: true, enum: ['admin', 'member'] })
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member';
}
