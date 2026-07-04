import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class TaixuUserPageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  current_page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page_size?: number;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  createTime?: string;
}

export class TaixuUserCreateDto {
  @IsOptional()
  @IsString()
  user_name?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  resume?: string;

  @IsOptional()
  @IsString()
  photo?: string;
}

export class TaixuUserUpdateDto extends TaixuUserCreateDto {
  @IsString()
  id: string;
}

export class TaixuUserDeleteDto {
  @IsString()
  ids: string;
}

export class TaixuUserSelectDto {
  @IsOptional()
  @IsString()
  user_name?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

