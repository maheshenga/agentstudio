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

  type EntityRecord = Record<string, any>;

  class MemoryRepository<T extends EntityRecord> {
    public records: T[];

    constructor(seed: T[] = []) {
      this.records = seed.map((record, index) => ({ id: record.id ?? index + 1, ...record })) as T[];
    }

    async findOne(options: { where: EntityRecord }) {
      return this.records.find((record) => this.matchesWhere(record, options.where)) ?? null;
    }

    async find(options: { where?: EntityRecord } = {}) {
      if (!options.where) return [...this.records];
      return this.records.filter((record) => this.matchesWhere(record, options.where));
    }

    private matchesWhere(record: EntityRecord, where: EntityRecord) {
      return Object.entries(where).every(([key, expected]) => {
        if (expected && typeof expected === 'object') {
          const operatorType = expected.type || expected._type;
          const operatorValue = expected.value ?? expected._value;
          if (operatorType === 'isNull') {
            return record[key] === null || record[key] === undefined;
          }
          if (operatorType === 'in') {
            return (operatorValue as unknown[]).includes(record[key]);
          }
        }
        return record[key] === expected;
      });
    }
  }

  const enabledModule = (code: string) => ({
    code,
    name: code,
    source: 'built_in',
    version: '1.0.0',
    description: '',
    category: '',
    icon: '',
    status: 'enabled',
    entryRoute: '',
    configSchema: {},
    healthStatus: 'unknown',
    sort: 100,
  });

  const createRealAccessGuard = (
    options: {
      modules?: EntityRecord[];
      saasModuleCodes?: string[];
      tenantModules?: EntityRecord[];
      bridgeRows?: EntityRecord[];
    } = {},
  ) => {
    const moduleRepo = new MemoryRepository(options.modules || [enabledModule('taixu_workspace')]);
    const dependencyRepo = new MemoryRepository([]);
    const tenantModuleRepo = new MemoryRepository(options.tenantModules || []);
    const bridgeRepo = new MemoryRepository(options.bridgeRows || []);
    const saasModuleService = {
      listTenantModules: jest.fn().mockResolvedValue(
        (options.saasModuleCodes || []).map((code) => ({
          code,
          status: 1,
        })),
      ),
    };
    const accessService = new SystemModuleAccessService(
      moduleRepo as any,
      dependencyRepo as any,
      tenantModuleRepo as any,
      bridgeRepo as any,
      saasModuleService as any,
    );
    const guard = new SystemModuleGuard(new Reflector(), accessService);

    return { guard, saasModuleService };
  };

  const createRealTenantSaasGuard = (
    options: {
      saasModuleCodes?: string[];
      tenantModules?: EntityRecord[];
      bridgeRows?: EntityRecord[];
    } = {},
  ) =>
    createRealAccessGuard({
      ...options,
      modules: [enabledModule('tenant_saas')],
    });

  const createRealAiConsoleGuard = (
    options: {
      saasModuleCodes?: string[];
      tenantModules?: EntityRecord[];
      bridgeRows?: EntityRecord[];
    } = {},
  ) =>
    createRealAccessGuard({
      ...options,
      modules: [enabledModule('ai_console')],
    });

  const createRealSaasPlatformGuard = (
    options: {
      modules?: EntityRecord[];
      saasModuleCodes?: string[];
      tenantModules?: EntityRecord[];
      bridgeRows?: EntityRecord[];
    } = {},
  ) =>
    createRealAccessGuard({
      ...options,
      modules: options.modules || [enabledModule('saas_platform')],
    });

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

  it.each(['/api/saas/platform/usage/overview', '/nest-api/api/saas/platform/usage/overview'])(
    'allows SaaS platform route %s through the real access service without tenant context',
    async (path) => {
      const { guard, saasModuleService } = createRealSaasPlatformGuard();

      await expect(
        guard.canActivate(
          createContext(path, {
            userId: 9,
          }),
        ),
      ).resolves.toBe(true);

      expect(saasModuleService.listTenantModules).not.toHaveBeenCalled();
    },
  );

  it('denies SaaS platform routes through the real access service when the platform module is disabled', async () => {
    const { guard, saasModuleService } = createRealSaasPlatformGuard({
      modules: [{ ...enabledModule('saas_platform'), status: 'disabled' }],
    });

    await expect(
      guard.canActivate(
        createContext('/api/saas/platform/usage/overview', {
          userId: 9,
        }),
      ),
    ).rejects.toThrow('Module is disabled');

    expect(saasModuleService.listTenantModules).not.toHaveBeenCalled();
  });

  it('denies SaaS platform routes through the real access service when the platform module is missing', async () => {
    const { guard, saasModuleService } = createRealSaasPlatformGuard({
      modules: [],
    });

    await expect(
      guard.canActivate(
        createContext('/api/saas/platform/usage/overview', {
          userId: 9,
        }),
      ),
    ).rejects.toThrow('Module saas_platform not found');

    expect(saasModuleService.listTenantModules).not.toHaveBeenCalled();
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

  it('allows broad tenant SaaS routes through the real access service without purchased modules', async () => {
    const { guard, saasModuleService } = createRealTenantSaasGuard();

    await expect(
      guard.canActivate(
        createContext('/api/saas/tenant/usage', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(saasModuleService.listTenantModules).not.toHaveBeenCalled();
  });

  it.each([
    ['/api/saas/tenant/members', ['member_management'], true],
    ['/api/saas/tenant/members', ['resource_pack'], false],
    ['/api/saas/tenant/resource-pack-orders', ['resource_pack'], true],
    ['/api/saas/tenant/resource-pack-orders', ['member_management'], false],
    ['/api/saas/tenant/resource-packs', ['resource_pack'], true],
    ['/api/saas/tenant/resource-packs', ['member_management'], false],
  ])(
    'enforces tenant SaaS feature route %s through the real access service with SaaS modules %p',
    async (path, saasModuleCodes, shouldAllow) => {
      const { guard, saasModuleService } = createRealTenantSaasGuard({
        saasModuleCodes: saasModuleCodes as string[],
      });

      const request = guard.canActivate(
        createContext(path as string, {
          userId: 9,
          tenantId: 23,
        }),
      );

      if (shouldAllow) {
        await expect(request).resolves.toBe(true);
      } else {
        await expect(request).rejects.toThrow('Current plan has not enabled this module');
      }
      expect(saasModuleService.listTenantModules).toHaveBeenCalledWith(23);
    },
  );

  it.each(['/api/saas/tenant/members', '/api/saas/tenant/resource-pack-orders'])(
    'does not let explicit tenant_saas grants bypass SaaS feature gates for %s',
    async (path) => {
      const { guard } = createRealTenantSaasGuard({
        tenantModules: [{ tenantId: 23, moduleCode: 'tenant_saas', enabled: 1 }],
      });

      await expect(
        guard.canActivate(
          createContext(path, {
            userId: 9,
            tenantId: 23,
          }),
        ),
      ).rejects.toThrow('Current plan has not enabled this module');
    },
  );

  it('keeps tenant resource-pack feature bindings scoped to route segment boundaries through the real access service', async () => {
    const { guard, saasModuleService } = createRealTenantSaasGuard();

    await expect(
      guard.canActivate(
        createContext('/api/saas/tenant/resource-pack-orders-admin', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(saasModuleService.listTenantModules).not.toHaveBeenCalled();
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
    ['/api/ai/sessions', ['ai_chat'], true],
    ['/api/ai/sessions', ['rag'], false],
    ['/api/ai/models/options', ['ai_chat'], true],
    ['/api/ai/agents/options', ['ai_chat'], true],
  ])(
    'enforces AI console feature route %s through the real access service with SaaS modules %p',
    async (path, saasModuleCodes, shouldAllow) => {
      const { guard, saasModuleService } = createRealAiConsoleGuard({
        saasModuleCodes: saasModuleCodes as string[],
      });

      const request = guard.canActivate(
        createContext(path as string, {
          userId: 9,
          tenantId: 23,
        }),
      );

      if (shouldAllow) {
        await expect(request).resolves.toBe(true);
      } else {
        await expect(request).rejects.toThrow('Current plan has not enabled this module');
      }
      expect(saasModuleService.listTenantModules).toHaveBeenCalledWith(23);
    },
  );

  it('does not let explicit ai_console grants bypass AI chat feature gates', async () => {
    const { guard } = createRealAiConsoleGuard({
      tenantModules: [{ tenantId: 23, moduleCode: 'ai_console', enabled: 1 }],
    });

    await expect(
      guard.canActivate(
        createContext('/api/ai/sessions', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).rejects.toThrow('Current plan has not enabled this module');
  });

  it('keeps AI feature bindings scoped to route segment boundaries through the real access service', async () => {
    const { guard, saasModuleService } = createRealAiConsoleGuard({
      tenantModules: [{ tenantId: 23, moduleCode: 'ai_console', enabled: 1 }],
    });

    await expect(
      guard.canActivate(
        createContext('/api/ai/sessions-archive', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(saasModuleService.listTenantModules).not.toHaveBeenCalled();
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
    ['/api/taixu/llm/chat', ['ai_chat'], true],
    ['/api/taixu/llm/chat', ['rag'], false],
    ['/api/taixu/retrieval/rag', ['rag'], true],
    ['/api/taixu/retrieval/rag', ['ai_chat'], false],
  ])(
    'enforces static exact Taixu route %s through the real access service with SaaS modules %p',
    async (path, saasModuleCodes, shouldAllow) => {
      const { guard } = createRealAccessGuard({
        saasModuleCodes: saasModuleCodes as string[],
      });

      const request = guard.canActivate(
        createContext(path as string, {
          userId: 9,
          tenantId: 23,
        }),
      );

      if (shouldAllow) {
        await expect(request).resolves.toBe(true);
      } else {
        await expect(request).rejects.toThrow('Current plan has not enabled this module');
      }
    },
  );

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

  it('denies shared Taixu routes through the real access service when AI and RAG are both missing', async () => {
    const { guard, saasModuleService } = createRealAccessGuard();

    await expect(
      guard.canActivate(
        createContext('/api/taixu/model/page', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).rejects.toThrow('Current plan has not enabled this module');

    expect(saasModuleService.listTenantModules).toHaveBeenCalledWith(23);
  });

  it('allows shared Taixu routes through the real access service when RAG is enabled', async () => {
    const { guard, saasModuleService } = createRealAccessGuard({
      saasModuleCodes: ['rag'],
    });

    await expect(
      guard.canActivate(
        createContext('/api/taixu/model/page', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(saasModuleService.listTenantModules).toHaveBeenCalledWith(23);
  });

  it('allows shared Taixu routes through the real access service when AI chat is enabled', async () => {
    const { guard, saasModuleService } = createRealAccessGuard({
      saasModuleCodes: ['ai_chat'],
    });

    await expect(
      guard.canActivate(
        createContext('/api/taixu/model/page', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(saasModuleService.listTenantModules).toHaveBeenCalledWith(23);
  });

  it.each(['/api/taixu/model/page', '/api/taixu/llm/chat'])(
    'does not let explicit tenant module grants bypass SaaS feature gates for %s',
    async (path) => {
      const { guard } = createRealAccessGuard({
        tenantModules: [{ tenantId: 23, moduleCode: 'taixu_workspace', enabled: 1 }],
      });

      await expect(
        guard.canActivate(
          createContext(path, {
            userId: 9,
            tenantId: 23,
          }),
        ),
      ).rejects.toThrow('Current plan has not enabled this module');
    },
  );

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

  it('denies LLM setting routes through the real access service when only RAG is enabled', async () => {
    const { guard } = createRealAccessGuard({
      saasModuleCodes: ['rag'],
    });

    await expect(
      guard.canActivate(
        createContext(
          '/api/taixu/setting/detail',
          {
            userId: 9,
            tenantId: 23,
          },
          jest.fn(),
          { query: { source: 'llm' } },
        ),
      ),
    ).rejects.toThrow('Current plan has not enabled this module');
  });

  it('denies RAG setting routes through the real access service when only AI chat is enabled', async () => {
    const { guard } = createRealAccessGuard({
      saasModuleCodes: ['ai_chat'],
    });

    await expect(
      guard.canActivate(
        createContext(
          '/api/taixu/setting/list',
          {
            userId: 9,
            tenantId: 23,
          },
          jest.fn(),
          { query: { source: 'rag' } },
        ),
      ),
    ).rejects.toThrow('Current plan has not enabled this module');
  });

  it.each([
    ['/api/taixu/setting/detail', { query: { source: 'llm' } }, ['ai_chat']],
    ['/api/taixu/setting/list', { query: { source: 'rag' } }, ['rag']],
    ['/api/taixu/setting/save', { body: { source: 'rag' } }, ['rag']],
  ])(
    'allows matching Taixu setting source %s through the real access service',
    async (path, request, saasModuleCodes) => {
      const { guard } = createRealAccessGuard({
        saasModuleCodes: saasModuleCodes as string[],
      });

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
    },
  );

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

  it('allows broad Taixu home routes through explicit tenant system-module entitlement', async () => {
    const { guard, saasModuleService } = createRealAccessGuard({
      tenantModules: [{ tenantId: 23, moduleCode: 'taixu_workspace', enabled: 1 }],
    });

    await expect(
      guard.canActivate(
        createContext('/api/taixu/home/current_weather', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(saasModuleService.listTenantModules).not.toHaveBeenCalled();
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

  it('denies broad AI admin routes through the real access service without AI console entitlement', async () => {
    const { guard, saasModuleService } = createRealAiConsoleGuard();

    await expect(
      guard.canActivate(
        createContext('/api/ai/admin/providers/list', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).rejects.toThrow('Tenant has not enabled this module');

    expect(saasModuleService.listTenantModules).toHaveBeenCalledWith(23);
  });

  it('allows broad AI admin routes through the real access service with AI chat bridge entitlement', async () => {
    const { guard, saasModuleService } = createRealAiConsoleGuard({
      saasModuleCodes: ['ai_chat'],
    });

    await expect(
      guard.canActivate(
        createContext('/api/ai/admin/providers/list', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(saasModuleService.listTenantModules).toHaveBeenCalledWith(23);
  });

  it('allows broad AI admin routes through explicit tenant ai_console entitlement', async () => {
    const { guard, saasModuleService } = createRealAiConsoleGuard({
      tenantModules: [{ tenantId: 23, moduleCode: 'ai_console', enabled: 1 }],
    });

    await expect(
      guard.canActivate(
        createContext('/api/ai/admin/providers/list', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(saasModuleService.listTenantModules).not.toHaveBeenCalled();
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
