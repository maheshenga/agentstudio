import { Test, TestingModule } from '@nestjs/testing';

import { getTenantId } from '../../common/utils/tenant.util';
import { SystemModuleAccessService } from './services/system-module-access.service';
import { SystemModuleRegistryService } from './services/system-module-registry.service';
import { SystemModuleTenantController } from './system-module-tenant.controller';

jest.mock('../../common/utils/tenant.util', () => ({
  getTenantId: jest.fn(),
}));

describe('SystemModuleTenantController', () => {
  let controller: SystemModuleTenantController;

  const registry = {
    listTenantModules: jest.fn(),
    getTenantConfig: jest.fn(),
    saveTenantConfig: jest.fn(),
  };
  const access = {
    diagnoseModuleAccess: jest.fn(),
    assertModuleAccess: jest.fn(),
  };
  const mockedGetTenantId = getTenantId as jest.MockedFunction<typeof getTenantId>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemModuleTenantController],
      providers: [
        { provide: SystemModuleRegistryService, useValue: registry },
        { provide: SystemModuleAccessService, useValue: access },
      ],
    }).compile();

    controller = module.get(SystemModuleTenantController);
  });

  it('lists current tenant modules from tenant context only', async () => {
    const modules = [{ code: 'core_system', tenant_enabled: true, entitlement_source: 'platform' }];
    mockedGetTenantId.mockReturnValue(23);
    registry.listTenantModules.mockResolvedValue(modules);

    const result = await controller.listModules();

    expect(registry.listTenantModules).toHaveBeenCalledWith(23);
    expect(registry.listTenantModules).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual(modules);
  });

  it('returns 401 without tenant context and does not call registry', async () => {
    mockedGetTenantId.mockReturnValue(null);

    const result = await controller.listModules();

    expect(result.code).toBe(401);
    expect(result.msg).toBe('Tenant context is required');
    expect(registry.listTenantModules).not.toHaveBeenCalled();
  });

  it('returns module access diagnosis for current tenant', async () => {
    const diagnosis = { module_code: 'ai_console', allowed: false, status: 'missing_tenant_module' };
    mockedGetTenantId.mockReturnValue(23);
    access.diagnoseModuleAccess.mockResolvedValue(diagnosis);

    const result = await controller.diagnoseModule('ai_console');

    expect(access.diagnoseModuleAccess).toHaveBeenCalledWith({ tenantId: 23, moduleCode: 'ai_console' });
    expect(access.diagnoseModuleAccess).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual(diagnosis);
  });

  it('returns 401 for module diagnosis without tenant context', async () => {
    mockedGetTenantId.mockReturnValue(null);

    const result = await controller.diagnoseModule('ai_console');

    expect(result.code).toBe(401);
    expect(result.msg).toBe('Tenant context is required');
    expect(access.diagnoseModuleAccess).not.toHaveBeenCalled();
  });

  it('reads and updates effective config for the current entitled tenant', async () => {
    mockedGetTenantId.mockReturnValue(23);
    access.assertModuleAccess.mockResolvedValue(true);
    registry.getTenantConfig.mockResolvedValue({ module_code: 'ai_console', tenant_id: 23 });
    registry.saveTenantConfig.mockResolvedValue({
      module_code: 'ai_console',
      tenant_id: 23,
      tenant_config: { tone: 'concise' },
    });

    const read = await controller.getTenantConfig('ai_console');
    const saved = await controller.saveTenantConfig(
      'ai_console',
      { config: { tone: 'concise' } },
      { userId: 51 } as any,
    );

    expect(access.assertModuleAccess).toHaveBeenCalledTimes(2);
    expect(access.assertModuleAccess).toHaveBeenCalledWith({ tenantId: 23, moduleCode: 'ai_console' });
    expect(registry.getTenantConfig).toHaveBeenCalledWith(23, 'ai_console');
    expect(registry.saveTenantConfig).toHaveBeenCalledWith(23, 'ai_console', { tone: 'concise' }, 51);
    expect(read.data).toEqual({ module_code: 'ai_console', tenant_id: 23 });
    expect(saved.data).toEqual({
      module_code: 'ai_console',
      tenant_id: 23,
      tenant_config: { tone: 'concise' },
    });
  });
});
