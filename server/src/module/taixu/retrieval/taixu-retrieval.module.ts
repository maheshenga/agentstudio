import { Module } from '@nestjs/common';
import { TaixuLlmModule } from '../llm/taixu-llm.module';
import { TaixuVectorModule } from '../vector/taixu-vector.module';
import { TaixuGraphModule } from '../graph/taixu-graph.module';
import { TaixuHistoryModule } from '../history/taixu-history.module';
import { TaixuAgenticModule } from '../agentic/taixu-agentic.module';
import { TaixuDocumentModule } from '../document/taixu-document.module';
import { TaixuRetrievalController } from './taixu-retrieval.controller';
import { TaixuRetrievalService } from './taixu-retrieval.service';
import { TaixuRagGraphService } from './taixu-rag-graph.service';

@Module({
  imports: [TaixuLlmModule, TaixuVectorModule, TaixuGraphModule, TaixuHistoryModule, TaixuAgenticModule, TaixuDocumentModule],
  controllers: [TaixuRetrievalController],
  providers: [TaixuRetrievalService, TaixuRagGraphService],
  exports: [TaixuRetrievalService],
})
export class TaixuRetrievalModule {}
