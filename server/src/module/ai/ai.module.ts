import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiController } from './ai.controller';
import { AiAdminController } from './ai-admin.controller';
import { AiChatGateway } from './ai-chat.gateway';
import { ChatService } from './services/chat.service';
import { AiConfigService } from './services/ai-config.service';
import { AiAdminService } from './services/ai-admin.service';
import { LlmSemaphoreService } from './services/llm-semaphore.service';
import { LlmProviderService } from './services/llm-provider.service';
import { AiStreamStopService } from './services/ai-stream-stop.service';
import { ContextBuilderService } from './services/context-builder.service';
import { SessionSummaryService } from './services/session-summary.service';
import { SaasModule } from '../saas/saas.module';
import {
  AiProviderEntity,
  AiModelEntity,
  AiAgentEntity,
  AiChatSessionEntity,
  AiChatMessageEntity,
} from './entities';

@Module({
  imports: [
    SaasModule,
    TypeOrmModule.forFeature([
      AiProviderEntity,
      AiModelEntity,
      AiAgentEntity,
      AiChatSessionEntity,
      AiChatMessageEntity,
    ]),
  ],
  controllers: [AiController, AiAdminController],
  providers: [
    AiConfigService,
    AiAdminService,
    LlmSemaphoreService,
    LlmProviderService,
    ContextBuilderService,
    SessionSummaryService,
    ChatService,
    AiStreamStopService,
    AiChatGateway,
  ],
  exports: [ChatService, AiConfigService],
})
export class AiModule {}
