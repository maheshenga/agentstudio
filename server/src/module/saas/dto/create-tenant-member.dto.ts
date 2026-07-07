import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const USERNAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{1,63}$/;
export const TENANT_MEMBER_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{5,19}$/;

export class CreateTenantMemberDto {
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(USERNAME_PATTERN)
  username: string;

  @ApiProperty({ required: true })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(TENANT_MEMBER_PASSWORD_PATTERN)
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  realname?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ValidateIf((dto) => dto.phone !== '')
  @IsString()
  @MaxLength(20)
  @Matches(PHONE_PATTERN)
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

export class ChangeTenantMemberRoleDto {
  @ApiProperty({ required: true, enum: ['admin', 'member'] })
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member';
}

export class UpdateTenantMemberStatusDto {
  @ApiProperty({ required: true, enum: [0, 1] })
  @IsIn([0, 1])
  status: 0 | 1;
}

export class ResetTenantMemberPasswordDto {
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(TENANT_MEMBER_PASSWORD_PATTERN)
  password: string;
}
