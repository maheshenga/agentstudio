import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TaixuHistoryRecordListDto {
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  pattern?: string;

  @IsOptional()
  @IsString()
  library?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  current_page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_size?: number;
}

export class TaixuHistoryRecordUpdateDto {
  @IsString()
  id: string;

  @IsString()
  name: string;
}

export class TaixuHistoryRecordDeleteDto {
  @IsString()
  ids: string;
}

export class TaixuHistoryRecordUpdateModelsDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  chat_model_id?: string;
}

export class TaixuMemoryDetailListDto {
  @IsOptional()
  @IsString()
  source_id?: string;
}

export class TaixuMemoryDetailDownloadDto {
  @IsString()
  source_id: string;
}
