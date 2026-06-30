import { IsOptional, IsString } from 'class-validator';

export class TaixuImageGenerateDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  format?: string;
}

