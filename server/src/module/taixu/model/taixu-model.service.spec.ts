import { TenantContext } from '../../../common/tenant/tenant.context';
import { encryptAiSecret, maskAiSecret } from '../../../common/utils/ai-crypto.util';
import { TaixuModelService } from './taixu-model.service';

jest.mock('../../../common/utils/ai-crypto.util', () => ({
  encryptAiSecret: jest.fn((value) => `enc:${value}`),
  decryptAiSecret: jest.fn((value) => String(value).replace(/^enc:/, '')),
  maskAiSecret: jest.fn(() => 'sk-****test'),
}));

jest.mock('../../../common/utils', () => ({
  formatDateTime: jest.fn(() => '2026-07-04 00:00:00'),
  generateUUID: jest.fn(() => 'model-uuid'),
}));

describe('TaixuModelService API key handling', () => {
  const qb = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
  };

  const modelRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };

  let service: TaixuModelService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TaixuModelService(modelRepo as any);
  });

  it('encrypts api keys when creating Taixu models', async () => {
    await TenantContext.run({ tenantId: 42 }, () =>
      service.create({
        model_name: 'deepseek-chat',
        base_url: 'https://api.deepseek.com/v1',
        api_key: 'sk-test',
        type: 'llm',
        source: 'modelscope',
      }),
    );

    expect(encryptAiSecret).toHaveBeenCalledWith('sk-test');
    expect(modelRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'enc:sk-test', tenantId: 42 }),
    );
  });

  it('returns only masked api keys in model lists', async () => {
    qb.getManyAndCount.mockResolvedValue([
      [
        {
          id: 'model-1',
          tenantId: 42,
          modelName: 'deepseek-chat',
          displayName: 'DeepSeek Chat',
          modelId: 'deepseek-chat',
          baseUrl: 'https://api.deepseek.com/v1',
          apiKey: 'enc:sk-test',
          type: 'llm',
          source: 'modelscope',
          createTime: new Date(),
        },
      ],
      1,
    ]);

    const result = await TenantContext.run({ tenantId: 42 }, () =>
      service.page({ current_page: 1, page_size: 10 }),
    );

    expect(maskAiSecret).toHaveBeenCalledWith('sk-test');
    expect(result.records[0].api_key).toBe('sk-****test');
  });

  it('does not clear an existing api key when update receives an empty api_key', async () => {
    await TenantContext.run({ tenantId: 42 }, () =>
      service.update({
        id: 'model-1',
        api_key: '',
      }),
    );

    expect(modelRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'model-1', tenantId: 42 }),
      {},
    );
  });
});
