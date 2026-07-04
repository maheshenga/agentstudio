import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { decryptAiSecret } from '../../../common/utils/ai-crypto.util';
import { AiModelEntity } from '../entities/ai-model.entity';
import { AiProviderEntity } from '../entities/ai-provider.entity';
import { AiAdminService } from './ai-admin.service';
import { LlmProviderService } from './llm-provider.service';

jest.mock('../../../common/utils/ai-crypto.util', () => ({
  encryptAiSecret: jest.fn((value) => `enc:${value}`),
  decryptAiSecret: jest.fn((value) => String(value).replace(/^enc:/, '')),
  maskAiSecret: jest.fn(() => 'sk-****test'),
}));

jest.mock('../../../common/utils/index', () => ({
  formatDateTime: jest.fn(() => '2026-07-04 00:00:00'),
}));

describe('AiAdminService', () => {
  const providerRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: value.id || '1', ...value })),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const modelRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: value.id || '10', ...value })),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const llmProviderService = {
    completeChat: jest.fn(),
  };
  let service: AiAdminService;
  const user = { userId: 7, tenantId: 42 } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAdminService,
        { provide: getRepositoryToken(AiProviderEntity), useValue: providerRepo },
        { provide: getRepositoryToken(AiModelEntity), useValue: modelRepo },
        { provide: LlmProviderService, useValue: llmProviderService },
      ],
    }).compile();
    service = module.get(AiAdminService);
  });

  it('rejects duplicate provider code in tenant scope', async () => {
    providerRepo.findOne.mockResolvedValue({ id: 'old', tenantId: 42, code: 'deepseek' });

    await expect(
      service.createProvider(user, {
        code: 'deepseek',
        name: 'DeepSeek',
        base_url: 'https://api.deepseek.com/v1',
        api_key: 'secret',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes provider base URL on create', async () => {
    providerRepo.findOne.mockResolvedValue(null);

    const result = await service.createProvider(user, {
      code: 'deepseek',
      name: 'DeepSeek',
      base_url: 'https://api.deepseek.com/v1/',
      api_key: 'secret',
      adapter_type: 'openai_compatible',
    } as any);

    expect(result.base_url).toBe('https://api.deepseek.com/v1');
  });

  it('rejects duplicate model code under provider', async () => {
    providerRepo.findOne.mockResolvedValue({ id: '1', tenantId: 42, status: '1' });
    modelRepo.findOne.mockResolvedValue({
      id: 'old',
      tenantId: 42,
      providerId: '1',
      modelCode: 'deepseek-chat',
    });

    await expect(
      service.createModel(user, {
        provider_id: '1',
        model_code: 'deepseek-chat',
        name: 'DeepSeek Chat',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps one default model per tenant scope', async () => {
    providerRepo.findOne.mockResolvedValue({ id: '1', tenantId: 42, status: '1' });
    modelRepo.findOne.mockResolvedValue(null);

    await service.createModel(user, {
      provider_id: '1',
      model_code: 'deepseek-chat',
      name: 'DeepSeek Chat',
      is_default: 1,
    } as any);

    expect(modelRepo.update).toHaveBeenCalledWith({ tenantId: 42 }, { isDefault: 0 });
  });

  it('tests a provider with the requested model code', async () => {
    providerRepo.findOne.mockResolvedValue({
      id: '1',
      tenantId: 42,
      status: '1',
      apiKeyCipher: 'enc:secret',
      adapterType: 'openai_compatible',
      baseUrl: 'https://api.example.test/v1',
      extraHeaders: null,
    });
    llmProviderService.completeChat.mockResolvedValue({
      content: 'pong',
      usage: { totalTokens: 2 },
    });

    const result = await service.testProvider(user, '1', { model_code: 'gpt-test' } as any);

    expect(decryptAiSecret).toHaveBeenCalledWith('enc:secret');
    expect(llmProviderService.completeChat).toHaveBeenCalledWith(
      expect.any(Object),
      'secret',
      expect.objectContaining({ model: 'gpt-test' }),
    );
    expect(result).toMatchObject({
      provider_id: '1',
      model_code: 'gpt-test',
      ok: true,
      message: 'pong',
    });
  });

  it('returns failed provider test result for remote errors', async () => {
    providerRepo.findOne.mockResolvedValue({
      id: '1',
      tenantId: 42,
      status: '1',
      apiKeyCipher: 'enc:secret',
      adapterType: 'openai_compatible',
      baseUrl: 'https://api.example.test/v1',
      extraHeaders: null,
    });
    llmProviderService.completeChat.mockRejectedValue(new Error('401 unauthorized'));

    await expect(
      service.testProvider(user, '1', { model_code: 'gpt-test' } as any),
    ).resolves.toMatchObject({
      provider_id: '1',
      model_code: 'gpt-test',
      ok: false,
      message: '401 unauthorized',
    });
  });
});
