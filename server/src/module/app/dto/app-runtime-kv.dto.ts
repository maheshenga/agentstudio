import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SetAppRuntimeKvDto {
  @ApiProperty()
  @IsDefined()
  value: unknown;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  expected_version?: number;

  @ApiProperty({ required: false, minimum: 60, maximum: 2592000 })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(2592000)
  ttl_seconds?: number;
}
