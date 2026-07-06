# System Module Guard Access Integration P10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add integration-style coverage proving `SystemModuleGuard` and the real `SystemModuleAccessService` deny or allow Taixu routes from actual tenant SaaS entitlements, not only mocked guard arguments.

**Architecture:** Keep production code unchanged unless the new tests expose a regression. Extend `system-module.guard.spec.ts` with a small in-memory repository harness that instantiates a real `SystemModuleAccessService`, then route real guard requests through the existing Taixu bindings. These tests complement P7-P9 mock-argument tests by proving route metadata is enforced by the access service end to end.

**Tech Stack:** NestJS guard, Jest, TypeScript, in-memory TypeORM repository doubles, existing `SystemModuleAccessService`.

---

## File Structure

- Create: `docs/superpowers/plans/2026-07-06-system-module-guard-access-integration-p10.md`
  - Documents the P10 goal, test scope, verification commands, review, and commit boundary.
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`
  - Add `EntityRecord`, `MemoryRepository`, `enabledModule()`, and `createRealAccessGuard()` test helpers.
  - Add integration-style guard tests that use a real `SystemModuleAccessService` instead of a mocked `assertModuleAccess()`.

## Scope

### In Scope

- Real guard + real access-service tests for:
  - static exact Taixu generation route allow/deny with `ai_chat`;
  - static exact Taixu RAG route allow/deny with `rag`;
  - shared Taixu route denial when neither `ai_chat` nor `rag` is enabled;
  - shared Taixu route allow through both `ai_chat` and `rag` branches;
  - shared Taixu route allow when `rag` is enabled;
  - setting `source=llm` denial when only `rag` is enabled;
  - setting `source=rag` denial when only `ai_chat` is enabled;
  - setting exact-source allow for matching `ai_chat` and `rag` entitlements;
  - explicit tenant system-module grants cannot bypass exact or any-feature SaaS requirements;
  - broad Taixu home route allow through an explicit tenant system-module grant.
- Focused backend tests.
- Backend build.
- Local commit only.

### Out Of Scope

- Production route-binding changes.
- SaaS schema or migration changes.
- Frontend changes.
- Remote push.
- Invoice functionality.

Reasoning: P7-P9 already hardened the feature bindings. P10 is a confidence slice: it verifies those bindings with the actual access service before moving to the next functional priority.

---

## Task 1: Add Real Access-Service Guard Harness

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Add in-memory repository helpers**

Add these helpers after `createContext()` and before the first `it(...)`:

```ts
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
```

- [ ] **Step 2: Add the real guard factory**

Add this code after `MemoryRepository`:

```ts
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
      saasModuleCodes?: string[];
      tenantModules?: EntityRecord[];
      bridgeRows?: EntityRecord[];
    } = {},
  ) => {
    const moduleRepo = new MemoryRepository([enabledModule('taixu_workspace')]);
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
```

- [ ] **Step 3: Run the guard spec**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: PASS. This step only adds reusable test harness code; if it fails, fix the helper before adding behavior tests.

---

## Task 2: Add Integration-Style Guard Tests

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Add static exact-route integration tests**

Append these tests near the existing Taixu generation and knowledge-route tests:

```ts
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
```

- [ ] **Step 2: Add shared route denial and allow tests**

Append these tests near the existing Taixu shared-route tests:

```ts
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
```

- [ ] **Step 3: Add setting exact-source denial and allow tests**

Append these tests after the setting source-aware mock-argument tests:

```ts
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
```

- [ ] **Step 4: Add explicit-grant bypass regression tests**

Append these tests near the other real-access-service integration tests:

```ts
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
```

- [ ] **Step 5: Add broad-route explicit entitlement test**

Append this test near the existing broad Taixu home/user route tests:

```ts
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
```

- [ ] **Step 6: Run the guard spec**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: PASS if P7-P9 are correctly wired through `SystemModuleAccessService`. If any test fails, inspect the failing route and fix production code only for the failing behavior.

---

## Task 3: Verify, Review, And Commit P10

**Files:**
- Review: `docs/superpowers/plans/2026-07-06-system-module-guard-access-integration-p10.md`
- Review: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Run focused backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts src/module/system-module/services/system-module-access.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run the recent SaaS access regression set**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts src/module/system-module/services/system-module-access.service.spec.ts src/module/saas/services/saas-module.service.spec.ts src/module/ai/services/chat.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: PASS.

- [ ] **Step 4: Request review**

Ask reviewer agents to check:
- helper code is isolated to tests and does not hide production bugs;
- new tests use the real `SystemModuleAccessService`;
- explicit tenant module grants cannot bypass exact or any-feature SaaS requirements;
- broad Taixu home route behavior remains intentional;
- no unrelated local noise is staged.

- [ ] **Step 5: Review diff and local noise**

Run:

```powershell
git diff -- docs/superpowers/plans/2026-07-06-system-module-guard-access-integration-p10.md server/src/module/system-module/system-module.guard.spec.ts
git diff --check
git status --short
```

Confirm these are not staged:

```text
server/pnpm-lock.yaml
.codebase-memory/
.codegraph/
```

- [ ] **Step 6: Commit P10**

Stage only:

```powershell
git add docs/superpowers/plans/2026-07-06-system-module-guard-access-integration-p10.md server/src/module/system-module/system-module.guard.spec.ts
git commit -m "test: add system module guard access integration coverage"
```

Expected: commit succeeds and unrelated local noise remains uncommitted.

---

## Self-Review

- Spec coverage: The plan covers the missing guard + real access-service integration confidence for P7-P9 route gates.
- Placeholder scan: No TBD/TODO/fill-in instructions remain.
- Type consistency: Helper names, route strings, expected error text, and command paths match current files and test conventions.
- Risk controls: P10 is test-first confidence hardening and does not change production code unless a new integration test exposes a real defect.
