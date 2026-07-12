import { ApiProperty } from '@nestjs/swagger';
import {
  IsDefined,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const APP_RUNTIME_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const;
export type AppRuntimeHttpMethod = (typeof APP_RUNTIME_HTTP_METHODS)[number];

export class AppRuntimeHttpRequestDto {
  @ApiProperty({ maxLength: 2048 })
  @IsString()
  @MaxLength(2048)
  url: string;

  @ApiProperty({ enum: APP_RUNTIME_HTTP_METHODS })
  @IsString()
  @IsIn(APP_RUNTIME_HTTP_METHODS)
  method: AppRuntimeHttpMethod;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  body?: unknown;
}

export class AppRuntimeWebhookDto {
  @ApiProperty({ maxLength: 2048 })
  @IsString()
  @MaxLength(2048)
  url: string;

  @ApiProperty({ pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' })
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)
  event: string;

  @ApiProperty()
  @IsDefined()
  payload: unknown;
}
