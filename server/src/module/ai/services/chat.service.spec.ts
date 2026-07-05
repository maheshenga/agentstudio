import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AiChatMessageEntity } from '../entities/ai-chat-message.entity';
import { AiChatSessionEntity } from '../entities/ai-chat-session.entity';
import { SAAS_QUOTA_AI_CALLS, SAAS_QUOTA_TOKENS } from '../../saas/constants';
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
import { SaasQuotaService } from '../../saas/services/saas-quota.service';
import { AiConfigService } from './ai-config.service';
import { ChatService } from './chat.service';
import { ContextBuilderService } from './context-builder.service';
import { LlmProviderService } from './llm-provider.service';
import { LlmSemaphoreService } from './llm-semaphore.service';
import { SessionSummaryService } from './session-summary.service';

jest.mock('../../../common/utils/index', () => ({
  formatDateTime: jest.fn(() => '2026-07-03 00:00:00'),
}));

describe('ChatService SaaS quota integration', () => {
  const sessionRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const messageRepo = {
    save: jest.fn(),
    create: jest.fn((value) => value),
    createQueryBuilder: jest.fn(),
  };
  const aiConfigService = {
    isAiEnabled: jest.fn(),
    resolveModel: jest.fn(),
    getContextCompactThreshold: jest.fn(),
  };
  const semaphore = {
    acquire: jest.fn(),
    release: jest.fn(),
  };
  const contextBuilder = {
    buildMessages: jest.fn(),
  };
  const sessionSummaryService = {
    scheduleSummarize: jest.fn(),
  };
  const saasQuotaService = {
    assertTenantQuotaAvailable: jest.fn(),
    consumeAiUsage: jest.fn(),
  };
  const systemModuleAccessService = {
    assertModuleAccess: jest.fn(),
  };
  const llmProviderService = {
    streamChat: jest.fn(),
  };

  let service: ChatService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(AiChatSessionEntity), useValue: sessionRepo },
        { provide: getRepositoryToken(AiChatMessageEntity), useValue: messageRepo },
        { provide: AiConfigService, useValue: aiConfigService },
        { provide: LlmSemaphoreService, useValue: semaphore },
        { provide: ContextBuilderService, useValue: contextBuilder },
        { provide: SessionSummaryService, useValue: sessionSummaryService },
        { provide: SaasQuotaService, useValue: saasQuotaService },
        { provide: SystemModuleAccessService, useValue: systemModuleAccessService },
        { provide: LlmProviderService, useValue: llmProviderService },
      ],
    }).compile();

    service = module.get(ChatService);
  });

  it('checks AI chat module before quota and message writes', async () => {
    aiConfigService.isAiEnabled.mockResolvedValue(true);
    sessionRepo.findOne.mockResolvedValue({
      id: 'session-db-id',
      sessionUuid: 'session-uuid',
      userId: 7,
      tenantId: 42,
      defaultModelId: 'model-1',
      messageCount: 0,
    });
    systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

    await expect(
      service.handleChatSend(
        { userId: 7, tenantId: 42, userName: 'owner' } as any,
        { session_uuid: 'session-uuid', content: 'hello' } as any,
        jest.fn(),
      ),
    ).rejects.toThrow('Module disabled');

    expect(systemModuleAccessService.assertModuleAccess).toHaveBeenCalledWith({
      tenantId: 42,
      userId: 7,
      moduleCode: 'ai_console',
      requiredSaasModuleCode: 'ai_chat',
    });
    expect(saasQuotaService.assertTenantQuotaAvailable).not.toHaveBeenCalled();
    expect(messageRepo.save).not.toHaveBeenCalled();
  });

  it('checks AI call quota before creating chat messages', async () => {
    aiConfigService.isAiEnabled.mockResolvedValue(true);
    sessionRepo.findOne.mockResolvedValue({
      id: 'session-db-id',
      sessionUuid: 'session-uuid',
      userId: 7,
      tenantId: 42,
      defaultModelId: 'model-1',
      messageCount: 0,
    });
    saasQuotaService.assertTenantQuotaAvailable.mockRejectedValueOnce(
      new BadRequestException('AI 调用次数额度不足'),
    );

    await expect(
      service.handleChatSend(
        { userId: 7, tenantId: 42, userName: 'owner' } as any,
        { session_uuid: 'session-uuid', content: 'hello' } as any,
        jest.fn(),
      ),
    ).rejects.toThrow('AI 调用次数额度不足');

    expect(saasQuotaService.assertTenantQuotaAvailable).toHaveBeenCalledWith(
      42,
      SAAS_QUOTA_AI_CALLS,
      1,
      'AI 调用次数额度不足',
    );
    expect(messageRepo.save).not.toHaveBeenCalled();
  });

  it('checks token quota before creating chat messages', async () => {
    aiConfigService.isAiEnabled.mockResolvedValue(true);
    sessionRepo.findOne.mockResolvedValue({
      id: 'session-db-id',
      sessionUuid: 'session-uuid',
      userId: 7,
      tenantId: 42,
      defaultModelId: 'model-1',
      messageCount: 0,
    });
    saasQuotaService.assertTenantQuotaAvailable
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new BadRequestException('Token 额度不足'));

    await expect(
      service.handleChatSend(
        { userId: 7, tenantId: 42, userName: 'owner' } as any,
        { session_uuid: 'session-uuid', content: 'hello' } as any,
        jest.fn(),
      ),
    ).rejects.toThrow('Token 额度不足');

    expect(saasQuotaService.assertTenantQuotaAvailable).toHaveBeenCalledWith(
      42,
      SAAS_QUOTA_TOKENS,
      1,
      'Token 额度不足',
    );
    expect(messageRepo.save).not.toHaveBeenCalled();
  });

  it('consumes AI quota after a completed assistant message', async () => {
    const ownedSession = {
      id: 'session-db-id',
      sessionUuid: 'session-uuid',
      userId: 7,
      tenantId: 42,
      defaultModelId: 'model-1',
      messageCount: 0,
      title: '新对话',
      agentId: null,
      summary: null,
      summaryUpToSeq: 0,
    };
    const emit = jest.fn();

    aiConfigService.isAiEnabled.mockResolvedValue(true);
    aiConfigService.getContextCompactThreshold.mockResolvedValue(80);
    aiConfigService.resolveModel.mockResolvedValue({
      model: {
        id: 'model-1',
        modelCode: 'gpt-test',
        name: 'Test Model',
        defaultTemperature: 0.7,
        maxOutputTokens: 1024,
        contextWindow: 32000,
      },
      provider: {
        id: 'provider-1',
        name: 'Test Provider',
        baseUrl: 'https://llm.example.test',
        extraHeaders: null,
      },
      apiKey: 'test-key',
    });
    sessionRepo.findOne.mockResolvedValue(ownedSession);
    sessionRepo.save.mockResolvedValue(undefined);
    messageRepo.save.mockImplementation(async (entity) => entity);
    contextBuilder.buildMessages.mockResolvedValue({
      messages: [{ role: 'user', content: 'hello' }],
      contextRatio: 10,
      estimatedPromptTokens: 5,
      historyRounds: 0,
    });
    messageRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '123', prompt: '45' }),
    });
    llmProviderService.streamChat.mockReturnValue(
      (async function* () {
        yield { delta: 'hi' };
        return { promptTokens: 12, completionTokens: 8, totalTokens: 20 };
      })(),
    );

    await service.handleChatSend(
      { userId: 7, tenantId: 42, userName: 'owner' } as any,
      { session_uuid: 'session-uuid', content: 'hello' } as any,
      emit,
    );

    expect(saasQuotaService.assertTenantQuotaAvailable).toHaveBeenCalledWith(
      42,
      SAAS_QUOTA_AI_CALLS,
      1,
      'AI 调用次数额度不足',
    );
    expect(saasQuotaService.assertTenantQuotaAvailable).toHaveBeenCalledWith(
      42,
      SAAS_QUOTA_TOKENS,
      1,
      'Token 额度不足',
    );
    expect(saasQuotaService.consumeAiUsage).toHaveBeenCalledWith(42, { totalTokens: 20 });
    expect(llmProviderService.streamChat).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'provider-1' }),
      'test-key',
      expect.objectContaining({ model: 'gpt-test' }),
    );
    expect(emit).toHaveBeenCalledWith(
      'chat.message_done',
      expect.objectContaining({
        usage: expect.objectContaining({
          total_tokens: 20,
        }),
      }),
    );
  });
});
