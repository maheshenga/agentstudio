import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class AppRuntimeFileParamsDto {
  @ApiProperty({ minLength: 43, maxLength: 43 })
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  objectId: string;
}
