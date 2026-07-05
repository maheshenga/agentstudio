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
    registerPluginManifest: jest.fn(),
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

  it('registers plugin manifests outside tenant scope with operator id', async () => {
    const body = { code: 'risk_ops_plugin', name: 'Risk Ops Plugin', source: 'plugin', version: '1.2.3' };
    const module = { code: 'risk_ops_plugin', status: 'installed' };
    registry.registerPluginManifest.mockResolvedValue(module);
    const contextSpy = jest.spyOn(TenantContext, 'run');

    const result = await controller.registerPluginManifest(body as any, { userId: 66 } as any);

    expect(registry.registerPluginManifest).toHaveBeenCalledWith(body, 66);
    expect(result.data).toEqual(module);
    expect(contextSpy).toHaveBeenCalledWith(
      { tenantId: undefined, userId: 66, ignoreAudit: false, ignoreTenant: true },
      expect.any(Function),
    );
  });
});
