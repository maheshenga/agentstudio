import { Module } from '@nestjs/common';
import { TaixuLlmModule } from '../llm/taixu-llm.module';
import { TaixuVectorService } from './taixu-vector.service';

@Module({
  imports: [TaixuLlmModule],
  providers: [TaixuVectorService],
  exports: [TaixuVectorService],
})
export class TaixuVectorModule {}

