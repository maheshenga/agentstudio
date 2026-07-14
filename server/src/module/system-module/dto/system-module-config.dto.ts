import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class SaveSystemModuleConfigDto {
  @ApiProperty({ type: Object })
  @IsObject()
  config: Record<string, unknown>;
}
