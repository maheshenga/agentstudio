import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateSaasPlanStatusDto {
  @ApiProperty({ required: true, enum: [0, 1] })
  @IsIn([0, 1])
  status: number;
}