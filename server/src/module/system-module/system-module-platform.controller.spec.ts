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
    listSaasBridges: jest.fn(),
    saveSaasBridge: jest.fn(),
    updateSaasBridgeStatus: jest.fn(),
    listTenantGrants: jest.fn(),
    grantTenantModule: jest.fn(),
    revokeTenantModule: jest.fn(),
    getPlatformConfig: jest.fn(),
    savePlatformConfig: jest.fn(),
    runHealthCheck: jest.fn(),
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

    const result = await controller.updateStatus('ai_console', { status: 'disabled' }, {
      userId: 42,
    } as any);

    expect(registry.updateStatus).toHaveBeenCalledWith('ai_console', 'disabled', 42);
    expect(result.data).toEqual({ code: 'ai_console', status: 'disabled' });
  });

  it('registers plugin manifests outside tenant scope with operator id', async () => {
    const body = {
      code: 'risk_ops_plugin',
      name: 'Risk Ops Plugin',
      source: 'plugin',
      version: '1.2.3',
    };
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

  it('lists SaaS bridge configs outside tenant scope', async () => {
    const query = { saas_module_code: 'ai_chat' };
    const rows = [{ id: 1, saas_module_code: 'ai_chat', system_module_code: 'ai_console' }];
    registry.listSaasBridges.mockResolvedValue(rows);
    const contextSpy = jest.spyOn(TenantContext, 'run');

    const result = await controller.listSaasBridges(query as any, { userId: 81 } as any);

    expect(registry.listSaasBridges).toHaveBeenCalledWith(query);
    expect(result.data).toEqual(rows);
    expect(contextSpy).toHaveBeenCalledWith(
      { tenantId: undefined, userId: 81, ignoreAudit: false, ignoreTenant: true },
      expect.any(Function),
    );
  });

  it('saves SaaS bridge config with operator id', async () => {
    const body = { saas_module_code: 'ai_chat', system_module_code: 'ai_console', enabled: 1 };
    const row = {
      id: 1,
      saas_module_code: 'ai_chat',
      system_module_code: 'ai_console',
      enabled: true,
    };
    registry.saveSaasBridge.mockResolvedValue(row);

    const result = await controller.saveSaasBridge(body as any, { userId: 82 } as any);

    expect(registry.saveSaasBridge).toHaveBeenCalledWith(body, 82);
    expect(result.data).toEqual(row);
  });

  it('updates SaaS bridge config status with operator id', async () => {
    const row = { id: 1, enabled: false };
    registry.updateSaasBridgeStatus.mockResolvedValue(row);

    const result = await controller.updateSaasBridgeStatus('1', { enabled: 0 }, {
      userId: 83,
    } as any);

    expect(registry.updateSaasBridgeStatus).toHaveBeenCalledWith(1, 0, 83);
    expect(result.data).toEqual(row);
  });

  it('lists and mutates explicit tenant module grants outside tenant scope', async () => {
    registry.listTenantGrants.mockResolvedValue([{ code: 'ai_console', tenant_enabled: true }]);
    registry.grantTenantModule.mockResolvedValue({ module_code: 'ai_console', enabled: true });
    registry.revokeTenantModule.mockResolvedValue({ module_code: 'ai_console', enabled: false });

    const listed = await controller.listTenantGrants('23', { userId: 41 } as any);
    const granted = await controller.grantTenantModule(
      '23',
      'ai_console',
      { reason: 'Enable AI' },
      { userId: 42 } as any,
    );
    const revoked = await controller.revokeTenantModule(
      '23',
      'ai_console',
      { reason: 'Disable AI' },
      { userId: 43 } as any,
    );

    expect(registry.listTenantGrants).toHaveBeenCalledWith(23);
    expect(registry.grantTenantModule).toHaveBeenCalledWith(23, 'ai_console', 42, 'Enable AI');
    expect(registry.revokeTenantModule).toHaveBeenCalledWith(23, 'ai_console', 43, 'Disable AI');
    expect(listed.data).toEqual([{ code: 'ai_console', tenant_enabled: true }]);
    expect(granted.data).toEqual({ module_code: 'ai_console', enabled: true });
    expect(revoked.data).toEqual({ module_code: 'ai_console', enabled: false });
  });

  it('reads and updates platform config and triggers health checks outside tenant scope', async () => {
    registry.getPlatformConfig.mockResolvedValue({ module_code: 'ai_console', config: {} });
    registry.savePlatformConfig.mockResolvedValue({ module_code: 'ai_console', config: { enabled: true } });
    registry.runHealthCheck.mockResolvedValue({ code: 'ai_console', health_status: 'healthy' });

    const read = await controller.getPlatformConfig('ai_console', { userId: 31 } as any);
    const saved = await controller.savePlatformConfig(
      'ai_console',
      { config: { enabled: true } },
      { userId: 32 } as any,
    );
    const health = await controller.runHealthCheck('ai_console', { userId: 33 } as any);

    expect(registry.getPlatformConfig).toHaveBeenCalledWith('ai_console');
    expect(registry.savePlatformConfig).toHaveBeenCalledWith('ai_console', { enabled: true }, 32);
    expect(registry.runHealthCheck).toHaveBeenCalledWith('ai_console', 33);
    expect(read.data).toEqual({ module_code: 'ai_console', config: {} });
    expect(saved.data).toEqual({ module_code: 'ai_console', config: { enabled: true } });
    expect(health.data).toEqual({ code: 'ai_console', health_status: 'healthy' });
  });
});
