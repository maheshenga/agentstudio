import { Module } from '@nestjs/common';
import { TaixuGraphService } from './taixu-graph.service';

@Module({
  providers: [TaixuGraphService],
  exports: [TaixuGraphService],
})
export class TaixuGraphModule {}

