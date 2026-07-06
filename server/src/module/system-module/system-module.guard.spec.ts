import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../../common/constant';
import { SystemModuleAccessService } from './services/system-module-access.service';
import { SystemModuleGuard } from './system-module.guard';

describe('SystemModuleGuard', () => {
  const createContext = (
    path: string,
    user: Record<string, any> = {},
    handler: Function = jest.fn(),
    request: { query?: Record<string, any>; body?: Record<string, any> } = {},
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          path,
          route: { path },
          method: 'GET',
          user,
          query: request.query ?? {},
          body: request.body ?? {},
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

  it.each([
    '/api/taixu/agent/invoke',
    '/api/taixu/agentic/invoke',
    '/api/taixu/search/invoke',
    '/api/taixu/topic/invoke',
    '/api/taixu/travel/invoke',
    '/api/taixu/llm/chat',
    '/api/taixu/image/generate',
  ])('passes AI chat SaaS feature requirements for Taixu generation route %s', async (path) => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext(path, {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'taixu_workspace',
      tenantId: 23,
      userId: 9,
      requiredSaasModuleCode: 'ai_chat',
    });
  });

  it.each(['/llm/chat', '/image/generate'])(
    'passes AI chat SaaS feature requirements for Taixu compat generation route %s',
    async (path) => {
      const access = {
        assertModuleAccess: jest.fn().mockResolvedValue(true),
      };
      const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

      await expect(
        guard.canActivate(
          createContext(path, {
            userId: 9,
            tenantId: 23,
          }),
        ),
      ).resolves.toBe(true);

      expect(access.assertModuleAccess).toHaveBeenCalledWith({
        moduleCode: 'taixu_workspace',
        tenantId: 23,
        userId: 9,
        requiredSaasModuleCode: 'ai_chat',
      });
    },
  );

  it.each(['/nest-api/llm/chat', '/nest-api/image/generate'])(
    'matches Taixu compat generation routes behind a deployment prefix %s',
    async (path) => {
      const access = {
        assertModuleAccess: jest.fn().mockResolvedValue(true),
      };
      const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

      await expect(
        guard.canActivate(
          createContext(path, {
            userId: 9,
            tenantId: 23,
          }),
        ),
      ).resolves.toBe(true);

      expect(access.assertModuleAccess).toHaveBeenCalledWith({
        moduleCode: 'taixu_workspace',
        tenantId: 23,
        userId: 9,
        requiredSaasModuleCode: 'ai_chat',
      });
    },
  );

  it.each([
    '/api/taixu/retrieval/rag',
    '/api/taixu/retrieval/advance',
    '/api/taixu/special/rag',
    '/api/taixu/program/retrieve',
    '/api/taixu/arxiv/retrieve',
    '/api/taixu/document/list',
    '/api/taixu/document/upload',
    '/api/taixu/document/reindex',
  ])('passes RAG SaaS feature requirements for Taixu knowledge route %s', async (path) => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext(path, {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'taixu_workspace',
      tenantId: 23,
      userId: 9,
      requiredSaasModuleCode: 'rag',
    });
  });

  it.each([
    '/api/taixu/model/page',
    '/api/taixu/model/list',
    '/api/taixu/history/records',
    '/api/taixu/history/update',
    '/api/taixu/memory/details',
    '/api/taixu/memory/download',
    '/api/taixu/setting/list',
    '/api/taixu/setting/save',
  ])('passes any AI/RAG SaaS feature requirements for shared Taixu route %s', async (path) => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext(path, {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'taixu_workspace',
      tenantId: 23,
      userId: 9,
      requiredAnySaasModuleCodes: ['ai_chat', 'rag'],
    });
  });

  it.each([
    ['/api/taixu/setting/detail', { query: { source: 'llm' } }, 'ai_chat'],
    ['/api/taixu/setting/list', { query: { source: 'rag' } }, 'rag'],
  ])('uses exact SaaS feature requirements for Taixu setting query source %s', async (path, request, expectedCode) => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext(
          path as string,
          {
            userId: 9,
            tenantId: 23,
          },
          jest.fn(),
          request as { query?: Record<string, any>; body?: Record<string, any> },
        ),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'taixu_workspace',
      tenantId: 23,
      userId: 9,
      requiredSaasModuleCode: expectedCode,
    });
  });

  it.each([
    [{ source: 'llm' }, 'ai_chat'],
    [{ source: 'rag' }, 'rag'],
  ])('uses exact SaaS feature requirements for Taixu setting body source %#', async (body, expectedCode) => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext(
          '/api/taixu/setting/save',
          {
            userId: 9,
            tenantId: 23,
          },
          jest.fn(),
          { body },
        ),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'taixu_workspace',
      tenantId: 23,
      userId: 9,
      requiredSaasModuleCode: expectedCode,
    });
  });

  it('prefers Taixu setting body source over query source for save authorization', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext(
          '/api/taixu/setting/save',
          {
            userId: 9,
            tenantId: 23,
          },
          jest.fn(),
          {
            query: { source: 'rag' },
            body: { source: 'llm' },
          },
        ),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'taixu_workspace',
      tenantId: 23,
      userId: 9,
      requiredSaasModuleCode: 'ai_chat',
    });
  });

  it.each(['/api/taixu/setting/save/', '/nest-api/api/taixu/setting/save/'])(
    'prefers Taixu setting body source for trailing-slash save route %s',
    async (path) => {
      const access = {
        assertModuleAccess: jest.fn().mockResolvedValue(true),
      };
      const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

      await expect(
        guard.canActivate(
          createContext(
            path,
            {
              userId: 9,
              tenantId: 23,
            },
            jest.fn(),
            {
              query: { source: 'rag' },
              body: { source: 'llm' },
            },
          ),
        ),
      ).resolves.toBe(true);

      expect(access.assertModuleAccess).toHaveBeenCalledWith({
        moduleCode: 'taixu_workspace',
        tenantId: 23,
        userId: 9,
        requiredSaasModuleCode: 'ai_chat',
      });
    },
  );

  it.each(['/api/taixu/setting/detail', '/api/taixu/setting/list'])(
    'prefers Taixu setting query source over body source for query route %s',
    async (path) => {
      const access = {
        assertModuleAccess: jest.fn().mockResolvedValue(true),
      };
      const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

      await expect(
        guard.canActivate(
          createContext(
            path,
            {
              userId: 9,
              tenantId: 23,
            },
            jest.fn(),
            {
              query: { source: 'rag' },
              body: { source: 'llm' },
            },
          ),
        ),
      ).resolves.toBe(true);

      expect(access.assertModuleAccess).toHaveBeenCalledWith({
        moduleCode: 'taixu_workspace',
        tenantId: 23,
        userId: 9,
        requiredSaasModuleCode: 'rag',
      });
    },
  );

  it.each([
    ['/api/taixu/setting/list', {}],
    ['/api/taixu/setting/detail', { query: { source: 'other' } }],
    ['/api/taixu/setting/save', { body: { source: 'other' } }],
  ])('falls back to any AI/RAG feature for Taixu setting route without mapped source %s', async (path, request) => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext(
          path as string,
          {
            userId: 9,
            tenantId: 23,
          },
          jest.fn(),
          request as { query?: Record<string, any>; body?: Record<string, any> },
        ),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'taixu_workspace',
      tenantId: 23,
      userId: 9,
      requiredAnySaasModuleCodes: ['ai_chat', 'rag'],
    });
  });

  it('keeps generic Taixu workspace routes on the broad workspace gate', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/taixu/home/current_weather', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'taixu_workspace',
      tenantId: 23,
      userId: 9,
    });
  });

  it('keeps Taixu user routes on the broad workspace gate', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/taixu/user/page', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'taixu_workspace',
      tenantId: 23,
      userId: 9,
    });
  });

  it.each(['/api/taixu/modeling/page', '/api/taixu/settings/list'])(
    'keeps shared Taixu feature bindings scoped to route segment boundaries for %s',
    async (path) => {
      const access = {
        assertModuleAccess: jest.fn().mockResolvedValue(true),
      };
      const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

      await expect(
        guard.canActivate(
          createContext(path, {
            userId: 9,
            tenantId: 23,
          }),
        ),
      ).resolves.toBe(true);

      expect(access.assertModuleAccess).toHaveBeenCalledWith({
        moduleCode: 'taixu_workspace',
        tenantId: 23,
        userId: 9,
      });
    },
  );

  it('keeps Taixu feature bindings scoped to route segment boundaries', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/taixu/documentation/list', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'taixu_workspace',
      tenantId: 23,
      userId: 9,
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
