import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../../common/constant';
import { SystemModuleAccessService } from './services/system-module-access.service';
import { SystemModuleGuard } from './system-module.guard';

describe('SystemModuleGuard', () => {
  const createContext = (path: string, user: Record<string, any> = {}, handler: Function = jest.fn()): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          path,
          route: { path },
          method: 'GET',
          user,
        }),
      }),
      getClass: () => class TestController {},
      getHandler: () => handler,
    }) as unknown as ExecutionContext;

  it('blocks a tenant SaaS route when the system module access gate rejects it', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockRejectedValue(new Error('Module is disabled')),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/saas/tenant/usage', {
          userId: 9,
          tenantId: 23,
          permissions: ['tenant:quota:view'],
        }),
      ),
    ).rejects.toThrow('Module is disabled');

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'tenant_saas',
      tenantId: 23,
      userId: 9,
    });
  });

  it('checks platform SaaS routes without a tenant entitlement requirement', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/saas/platform/usage/overview', {
          userId: 9,
          tenantId: 23,
          permissions: ['saas:usage:index'],
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'saas_platform',
      tenantId: undefined,
      userId: 9,
    });
  });

  it('passes member management SaaS feature requirements for tenant member routes', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/saas/tenant/members', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'tenant_saas',
      tenantId: 23,
      userId: 9,
      requiredSaasModuleCode: 'member_management',
    });
  });

  it('passes resource pack SaaS feature requirements for tenant resource pack order routes', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/saas/tenant/resource-pack-orders', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'tenant_saas',
      tenantId: 23,
      userId: 9,
      requiredSaasModuleCode: 'resource_pack',
    });
  });

  it('keeps feature bindings scoped to route segment boundaries', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/saas/tenant/resource-pack-orders-admin', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'tenant_saas',
      tenantId: 23,
      userId: 9,
    });
  });

  it('passes AI chat SaaS feature requirements for tenant chat routes', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/ai/sessions', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'ai_console',
      tenantId: 23,
      userId: 9,
      requiredSaasModuleCode: 'ai_chat',
    });
  });

  it('does not require ai_chat for AI admin routes', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/ai/admin/providers/list', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'ai_console',
      tenantId: 23,
      userId: 9,
    });
  });

  it('matches managed routes behind a deployment prefix', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/nest-api/api/saas/tenant/usage', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'tenant_saas',
      tenantId: 23,
      userId: 9,
    });
  });

  it('rejects tenant-scoped module routes without tenant context', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/taixu/agent/invoke', {
          userId: 9,
        }),
      ),
    ).rejects.toThrow('Tenant context is required for this module');

    expect(access.assertModuleAccess).not.toHaveBeenCalled();
  });

  it('skips public managed routes before module access checks', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const handler = jest.fn();
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(guard.canActivate(createContext('/api/taixu/common/info', {}, handler))).resolves.toBe(true);

    expect(access.assertModuleAccess).not.toHaveBeenCalled();
  });
});
