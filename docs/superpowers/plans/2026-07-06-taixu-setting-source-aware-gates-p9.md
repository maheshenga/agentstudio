# Taixu Setting Source-Aware Gates P9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Taixu setting routes use exact SaaS feature gates when the request identifies `source=llm` or `source=rag`, while retaining P8's any-feature fallback for unfiltered setting views.

**Architecture:** Extend `SystemModuleGuard` route binding metadata with a request-aware `sourceSaasModuleCodeMap`. The guard resolves `source` from the same request location the controller uses: `setting/save` uses `body.source`, while `setting/detail` and `setting/list` use `query.source`. It maps `llm -> ai_chat` and `rag -> rag`, then passes an exact `requiredSaasModuleCode` to `SystemModuleAccessService`. If the source is missing or unknown, the route keeps the existing `requiredAnySaasModuleCodes: ['ai_chat', 'rag']` fallback.

**Tech Stack:** NestJS guard, Jest unit tests, TypeScript route binding metadata.

---

## File Structure

- Modify: `server/src/module/system-module/system-module.guard.ts`
  - Add `sourceSaasModuleCodeMap?: Record<string, string>` to route binding metadata.
  - Add `TAIXU_SETTING_SOURCE_SAAS_MODULE_CODES` mapping.
  - Resolve request `source` from the controller-relevant request location.
  - Use `body.source` for `setting/save` and `query.source` for `setting/detail` / `setting/list`.
  - Prefer exact source-derived `requiredSaasModuleCode` over any-feature fallback when recognized.
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`
  - Extend `createContext()` to accept `query` and `body`.
  - Add tests for `source=llm` and `source=rag` on setting detail/list/save routes.
  - Add tests proving missing or unknown source falls back to `requiredAnySaasModuleCodes`.

## Scope

### In Scope

- Source-aware route feature resolution for `/api/taixu/setting/*`.
- Exact feature mappings:
  - `source=llm` -> `requiredSaasModuleCode: 'ai_chat'`
  - `source=rag` -> `requiredSaasModuleCode: 'rag'`
- Fallback behavior:
  - Missing `source` -> `requiredAnySaasModuleCodes: ['ai_chat', 'rag']`
  - Unknown `source` -> `requiredAnySaasModuleCodes: ['ai_chat', 'rag']`
- Conflict behavior:
  - `POST /api/taixu/setting/save?source=rag` with body `{ source: 'llm' }` -> `requiredSaasModuleCode: 'ai_chat'`
  - `POST /api/taixu/setting/save/?source=rag` with body `{ source: 'llm' }` -> `requiredSaasModuleCode: 'ai_chat'`
  - `GET /api/taixu/setting/detail?source=rag` with body `{ source: 'llm' }` -> `requiredSaasModuleCode: 'rag'`
- Guard unit tests.
- Focused backend tests and build.
- Local commit only.

### Out Of Scope

- Service-level filtering of list results.
- New allowed-source validation in DTOs.
- Database migrations.
- Frontend changes.
- Remote push.
- Invoice functionality.

---

## Task 1: Add Failing Guard Tests

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Extend `createContext()` with query/body support**

Replace the helper with:

```ts
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
```

- [ ] **Step 2: Add setting query-source exact gate tests**

Append this test inside `describe('SystemModuleGuard', () => { ... })`:

```ts
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
          path,
          {
            userId: 9,
            tenantId: 23,
          },
          jest.fn(),
          request,
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
```

- [ ] **Step 3: Add setting body-source exact gate tests**

Append this test:

```ts
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
```

- [ ] **Step 4: Add a body-over-query conflict regression**

Append this test:

```ts
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
```

- [ ] **Step 5: Add trailing-slash save route regressions**

Append this test:

```ts
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
```

- [ ] **Step 6: Add query-over-body regressions for query routes**

Append this test:

```ts
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
```

- [ ] **Step 7: Add fallback tests for missing/unknown source**

Append this test:

```ts
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
          path,
          {
            userId: 9,
            tenantId: 23,
          },
          jest.fn(),
          request,
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
```

- [ ] **Step 8: Run guard tests and confirm RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: FAIL because setting routes currently always use the any-feature fallback.

---

## Task 2: Implement Source-Aware Setting Gate Resolution

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.ts`

- [ ] **Step 1: Extend route binding metadata**

Add:

```ts
  sourceSaasModuleCodeMap?: Record<string, string>;
```

- [ ] **Step 2: Add source mapping constant**

Add near `TAIXU_SHARED_SAAS_MODULE_CODES`:

```ts
const TAIXU_SETTING_SOURCE_SAAS_MODULE_CODES: Record<string, string> = {
  llm: 'ai_chat',
  rag: 'rag',
};
```

- [ ] **Step 3: Attach the source map to `/api/taixu/setting` binding**

Update the setting binding:

```ts
  {
    prefix: '/api/taixu/setting',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredAnySaasModuleCodes: TAIXU_SHARED_SAAS_MODULE_CODES,
    sourceSaasModuleCodeMap: TAIXU_SETTING_SOURCE_SAAS_MODULE_CODES,
  },
```

- [ ] **Step 4: Resolve mapped source before assigning static requirements**

Add helper and resolver code:

```ts
const resolveTaixuSettingSource = (request: Record<string, any>, path: string) => {
  const normalizedPath = (path.startsWith('/') ? path : `/${path}`).replace(/\/+$/, '');
  return normalizedPath.endsWith('/api/taixu/setting/save') ? request.body?.source : request.query?.source;
};
```

Add helper methods:

```ts
  private resolveSourceSaasModuleCode(
    binding: SystemModuleRouteBinding,
    request: Record<string, any>,
    path: string,
  ): string | undefined {
    if (!binding.sourceSaasModuleCodeMap) {
      return undefined;
    }
    const sourceValue = binding.sourceResolver
      ? binding.sourceResolver(request, path)
      : request.query?.source ?? request.body?.source;
    const source = this.normalizeRequestSource(sourceValue);
    return source ? binding.sourceSaasModuleCodeMap[source] : undefined;
  }

  private normalizeRequestSource(value: unknown): string | undefined {
    const raw = Array.isArray(value) ? value[0] : value;
    const source = String(raw ?? '').trim().toLowerCase();
    return source || undefined;
  }
```

Then replace the requirement assignment block with:

```ts
    const sourceSaasModuleCode = this.resolveSourceSaasModuleCode(binding, request, requestPath);
    if (sourceSaasModuleCode) {
      accessOptions.requiredSaasModuleCode = sourceSaasModuleCode;
    } else if (binding.requiredSaasModuleCode) {
      accessOptions.requiredSaasModuleCode = binding.requiredSaasModuleCode;
    }
    if (!sourceSaasModuleCode && binding.requiredAnySaasModuleCodes?.length) {
      accessOptions.requiredAnySaasModuleCodes = binding.requiredAnySaasModuleCodes;
    }
```

- [ ] **Step 5: Run guard tests and confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: PASS.

---

## Task 3: Review, Verify, And Commit P9

**Files:**
- Review: `server/src/module/system-module/system-module.guard.ts`
- Review: `server/src/module/system-module/system-module.guard.spec.ts`
- Review: `docs/superpowers/plans/2026-07-06-taixu-setting-source-aware-gates-p9.md`

- [ ] **Step 1: Run focused regression tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts src/module/system-module/services/system-module-access.service.spec.ts src/module/saas/services/saas-module.service.spec.ts src/module/ai/services/chat.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Request code review**

Ask review workers to check:

- `source=llm` uses exact `ai_chat`.
- `source=rag` uses exact `rag`.
- Missing/unknown source keeps the P8 any-feature fallback.
- Static exact route gates from P7 are not weakened.
- Shared route gates from P8 are not weakened.
- No unrelated files are staged.

- [ ] **Step 4: Commit P9**

Stage only:

```powershell
git add docs/superpowers/plans/2026-07-06-taixu-setting-source-aware-gates-p9.md server/src/module/system-module/system-module.guard.ts server/src/module/system-module/system-module.guard.spec.ts
git diff --cached --name-only
git diff --cached --check
git commit -m "fix: gate taixu settings by source feature"
```

Do not stage:

```text
server/pnpm-lock.yaml
.codebase-memory/
.codegraph/
```

---

## Self-Review

Spec coverage:
- Query-source and body-source setting routes are covered.
- Body-over-query conflict behavior is covered for `setting/save`.
- Body-over-query conflict behavior is covered for trailing-slash `setting/save` with and without a deployment prefix.
- Query-over-body conflict behavior is covered for `setting/detail` and `setting/list`.
- Missing and unknown source fallback behavior is covered.
- P7 exact and P8 any-feature behavior are preserved.

Placeholder scan:
- No TODO/TBD placeholders.
- Every implementation step includes concrete code and exact commands.

Risk controls:
- The feature is guard-only and additive.
- Unknown source values do not introduce new hard failures.
- Existing static route bindings continue to work without request-aware metadata.
