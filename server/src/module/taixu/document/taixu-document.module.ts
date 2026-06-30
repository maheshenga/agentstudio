import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '../../../redis/redis.module';
import { TaixuSystemDocumentEntity } from './entities/taixu-system-document.entity';
import { TaixuDocumentController } from './taixu-document.controller';
import { TaixuDocumentService } from './taixu-document.service';
import { TaixuDocumentIndexTracker } from './document-index-tracker.service';
import { TaixuDocumentIndexProcessorService } from './document-index-processor.service';
import { TaixuDocumentIndexQueueService } from './document-index-queue.service';
import { TaixuVectorModule } from '../vector/taixu-vector.module';
import { TaixuLlmModule } from '../llm/taixu-llm.module';
import { TaixuGraphModule } from '../graph/taixu-graph.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaixuSystemDocumentEntity]),
    RedisModule,
    TaixuLlmModule,
    TaixuVectorModule,
    TaixuGraphModule,
  ],
  controllers: [TaixuDocumentController],
  providers: [
    TaixuDocumentService,
    TaixuDocumentIndexTracker,
    TaixuDocumentIndexProcessorService,
    TaixuDocumentIndexQueueService,
  ],
  exports: [TaixuDocumentService],
})
export class TaixuDocumentModule {}
