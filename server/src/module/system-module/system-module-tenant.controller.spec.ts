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
  };
  const access = {
    diagnoseModuleAccess: jest.fn(),
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
});
