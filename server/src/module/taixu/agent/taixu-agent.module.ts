import { Module } from '@nestjs/common';
import { TaixuLlmModule } from '../llm/taixu-llm.module';
import { TaixuVectorModule } from '../vector/taixu-vector.module';
import { TaixuHistoryModule } from '../history/taixu-history.module';
import { TaixuAgenticModule } from '../agentic/taixu-agentic.module';
import { TaixuAgentController } from './taixu-agent.controller';
import { TaixuAgentService } from './taixu-agent.service';

@Module({
  imports: [TaixuLlmModule, TaixuVectorModule, TaixuHistoryModule, TaixuAgenticModule],
  controllers: [TaixuAgentController],
  providers: [TaixuAgentService],
  exports: [TaixuAgentService],
})
export class TaixuAgentModule {}

