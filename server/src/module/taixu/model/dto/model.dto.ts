import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { TAIXU_MODEL_SOURCES, TAIXU_MODEL_TYPES } from '../model.constants';

export class TaixuModelPageDto {
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
  model_name?: string;

  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  @IsString()
  model_id?: string;

  @IsOptional()
  @IsIn([...TAIXU_MODEL_TYPES])
  type?: string;

  @IsOptional()
  @IsIn([...TAIXU_MODEL_SOURCES])
  source?: string;
}

export class TaixuModelCreateDto {
  @IsString()
  model_name: string;

  @IsOptional()
  @IsString()
  base_url?: string;

  @IsOptional()
  @IsString()
  api_key?: string;

  @IsIn([...TAIXU_MODEL_TYPES])
  type: string;

  @IsIn([...TAIXU_MODEL_SOURCES])
  source: string;
}

export class TaixuModelUpdateDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  model_name?: string;

  @IsOptional()
  @IsString()
  base_url?: string;

  @IsOptional()
  @IsString()
  api_key?: string;

  @IsOptional()
  @IsIn([...TAIXU_MODEL_TYPES])
  type?: string;

  @IsOptional()
  @IsIn([...TAIXU_MODEL_SOURCES])
  source?: string;
}

export class TaixuModelDeleteDto {
  @IsString()
  ids: string;
}
