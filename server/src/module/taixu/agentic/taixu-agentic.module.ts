import { Module } from '@nestjs/common';
import { TaixuHistoryModule } from '../history/taixu-history.module';
import { TaixuLlmModule } from '../llm/taixu-llm.module';
import { TaixuSearchMemoryService } from './memory/search-memory.service';
import { TaixuAgentToolsService } from './tools/agent-tools.service';
import { TaixuMcpClientService } from './tools/mcp-client.service';
import { TaixuPromptService } from './prompt/taixu-prompt.service';
import { TaixuPatternAgentService } from './agent/pattern-agent.service';
import { TaixuProgramAgentsService } from './agent/taixu-program-agents.service';
import { TaixuAgenticOrchestratorService } from './agent/taixu-agentic-orchestrator.service';

@Module({
  imports: [TaixuHistoryModule, TaixuLlmModule],
  providers: [
    TaixuSearchMemoryService,
    TaixuAgentToolsService,
    TaixuMcpClientService,
    TaixuPromptService,
    TaixuPatternAgentService,
    TaixuProgramAgentsService,
    TaixuAgenticOrchestratorService,
  ],
  exports: [
    TaixuSearchMemoryService,
    TaixuAgentToolsService,
    TaixuMcpClientService,
    TaixuPromptService,
    TaixuPatternAgentService,
    TaixuProgramAgentsService,
    TaixuAgenticOrchestratorService,
  ],
})
export class TaixuAgenticModule {}
