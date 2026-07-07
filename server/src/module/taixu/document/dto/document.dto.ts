import { IsInt, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class TaixuDocumentPageDto {
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
  document_name?: string;

  @IsOptional()
  @IsString()
  document_type?: string;

  @IsOptional()
  @IsString()
  upload_time?: string;
}

export class TaixuDocumentDeleteDto extends TaixuDocumentPageDto {
  @IsString()
  ids: string;
}

export class TaixuDocumentWebsiteDto {
  @IsString()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  website: string;
}

export class TaixuDocumentPreviewDto {
  @IsString()
  documentName: string;

  @IsString()
  documentType: string;
}

export class TaixuDocumentDownloadDto {
  @IsString()
  documentName: string;
}

export class TaixuDocumentReindexDto {
  @IsString()
  ids: string;
}

export class TaixuDocumentIndexStatusDto {
  @IsString()
  ids: string;
}

