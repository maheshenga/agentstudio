import { Test, TestingModule } from '@nestjs/testing';

import { AiAdminController } from './ai-admin.controller';
import { AiAdminService } from './services/ai-admin.service';

jest.mock('../../common/utils/index', () => ({
  formatDateTime: jest.fn(() => '2026-07-04 00:00:00'),
}));

describe('AiAdminController', () => {
  const aiAdminService = {
    listProviders: jest.fn(),
    createProvider: jest.fn(),
    updateProvider: jest.fn(),
    deleteProvider: jest.fn(),
    providerOptions: jest.fn(),
    listModels: jest.fn(),
    createModel: jest.fn(),
    updateModel: jest.fn(),
    deleteModel: jest.fn(),
    testProvider: jest.fn(),
  };
  let controller: AiAdminController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiAdminController],
      providers: [{ provide: AiAdminService, useValue: aiAdminService }],
    }).compile();
    controller = module.get(AiAdminController);
  });

  it('delegates provider test requests', async () => {
    aiAdminService.testProvider.mockResolvedValue({
      provider_id: '1',
      model_code: 'gpt-test',
      ok: true,
      latency_ms: 3,
      message: 'ok',
    });

    const result = await controller.testProvider(
      { userId: 7, tenantId: 42 } as any,
      '1',
      { model_code: 'gpt-test' },
    );

    expect(aiAdminService.testProvider).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 42 }),
      '1',
      { model_code: 'gpt-test' },
    );
    expect(result.data).toMatchObject({ ok: true, model_code: 'gpt-test' });
  });

  it('declares backend permissions for provider and model administration routes', () => {
    const permissions = (method: keyof AiAdminController) =>
      Reflect.getMetadata('requirePermission', controller[method] as any);

    expect(permissions('listProviders')).toEqual(['ai:provider:list']);
    expect(permissions('createProvider')).toEqual(['ai:provider:save']);
    expect(permissions('updateProvider')).toEqual(['ai:provider:update']);
    expect(permissions('deleteProvider')).toEqual(['ai:provider:delete']);
    expect(permissions('providerOptions')).toEqual(['ai:provider:list']);
    expect(permissions('testProvider')).toEqual(['ai:provider:update']);
    expect(permissions('listModels')).toEqual(['ai:model:list']);
    expect(permissions('createModel')).toEqual(['ai:model:save']);
    expect(permissions('updateModel')).toEqual(['ai:model:update']);
    expect(permissions('deleteModel')).toEqual(['ai:model:delete']);
  });
});
