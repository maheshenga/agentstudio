import { TenantContext } from '../../../common/tenant/tenant.context';
import { TaixuLlmRuntimeService } from './taixu-llm-runtime.service';

jest.mock('../../../common/utils', () => ({
  formatDateTime: jest.fn(() => '2026-07-04 00:00:00'),
  generateUUID: jest.fn(() => 'uuid-test'),
}));

describe('TaixuLlmRuntimeService unified AI model bridge', () => {
  const modelRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const historyRepo = {
    findOne: jest.fn(),
  };
  const settingService = {
    detail: jest.fn(),
  };
  const llmService = {
    getProvider: jest.fn(() => 'openai'),
    newChatModel: jest.fn(),
    newEmbeddings: jest.fn(),
  };
  const aiConfigService = {
    resolveModel: jest.fn(),
  };

  let service: TaixuLlmRuntimeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new (TaixuLlmRuntimeService as any)(
      modelRepo,
      historyRepo,
      settingService,
      llmService,
      aiConfigService,
    );
  });

  it('resolves chat models from sa_ai_model when sourceId uses ai: prefix', async () => {
    aiConfigService.resolveModel.mockResolvedValue({
      model: { id: '10', modelCode: 'deepseek-chat' },
      provider: {
        id: '1',
        adapterType: 'openai_compatible',
        baseUrl: 'https://api.deepseek.com/v1',
      },
      apiKey: 'sk-central',
    });

    const result = await TenantContext.run({ tenantId: 42 }, () =>
      service.resolveChatModel({ sourceId: 'ai:10' }),
    );

    expect(aiConfigService.resolveModel).toHaveBeenCalledWith('10', 42);
    expect(result).toEqual({
      provider: 'openai',
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-central',
      temperature: 0.2,
    });
    expect(modelRepo.findOne).not.toHaveBeenCalled();
  });

  it('resolves embedding models from sa_ai_model when sourceId uses ai: prefix', async () => {
    aiConfigService.resolveModel.mockResolvedValue({
      model: { id: '20', modelCode: 'text-embedding-3-small' },
      provider: {
        id: '1',
        adapterType: 'openai_compatible',
        baseUrl: 'https://api.openai.com/v1',
      },
      apiKey: 'sk-central',
    });

    const result = await TenantContext.run({ tenantId: 42 }, () =>
      service.resolveEmbeddings({ sourceId: 'ai:20' }),
    );

    expect(aiConfigService.resolveModel).toHaveBeenCalledWith('20', 42);
    expect(result).toEqual({
      provider: 'openai',
      model: 'text-embedding-3-small',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-central',
      temperature: 0.2,
    });
  });
});
