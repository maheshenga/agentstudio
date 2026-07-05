import { Test, TestingModule } from '@nestjs/testing';

import { TenantContext } from '../../common/tenant/tenant.context';
import { SystemModuleRegistryService } from './services/system-module-registry.service';
import { SystemModulePlatformController } from './system-module-platform.controller';

describe('SystemModulePlatformController', () => {
  let controller: SystemModulePlatformController;

  const registry = {
    listModules: jest.fn(),
    getModule: jest.fn(),
    updateStatus: jest.fn(),
    listEvents: jest.fn(),
    registerBuiltInModules: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemModulePlatformController],
      providers: [{ provide: SystemModuleRegistryService, useValue: registry }],
    }).compile();

    controller = module.get(SystemModulePlatformController);
  });

  it('lists modules outside tenant scope and wraps registry data', async () => {
    const query = { keyword: 'core', source: 'built_in' };
    const user = { userId: 11 };
    const modules = [{ code: 'core_system', status: 'enabled' }];
    registry.listModules.mockResolvedValue(modules);
    const contextSpy = jest.spyOn(TenantContext, 'run');

    const result = await controller.listModules(query, user as any);

    expect(registry.listModules).toHaveBeenCalledWith(query);
    expect(result.data).toEqual(modules);
    expect(contextSpy).toHaveBeenCalledWith(
      { tenantId: undefined, userId: 11, ignoreAudit: false, ignoreTenant: true },
      expect.any(Function),
    );
  });

  it('passes the operator id when updating module status', async () => {
    registry.updateStatus.mockResolvedValue({ code: 'ai_console', status: 'disabled' });

    const result = await controller.updateStatus('ai_console', { status: 'disabled' }, { userId: 42 } as any);

    expect(registry.updateStatus).toHaveBeenCalledWith('ai_console', 'disabled', 42);
    expect(result.data).toEqual({ code: 'ai_console', status: 'disabled' });
  });
});
