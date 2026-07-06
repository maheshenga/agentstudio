# Taixu Route Feature Gates P7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Taixu tenant routes enforce exact SaaS feature requirements instead of relying only on broad `taixu_workspace` entitlement.

**Architecture:** Keep `SystemModuleGuard` as the route-level gate and `SystemModuleAccessService.assertModuleAccess()` as the single access decision point. Add specific Taixu route bindings before the broad `/api/taixu` binding, using `requiredSaasModuleCode: 'ai_chat'` for direct LLM/agent generation routes and `requiredSaasModuleCode: 'rag'` for retrieval/document knowledge-base routes. Leave generic workspace routes and public common routes on the existing broad `taixu_workspace` behavior.

**Tech Stack:** NestJS guard, Jest unit tests, TypeScript route binding metadata.

---

## File Structure

- Modify: `server/src/module/system-module/system-module.guard.ts`
  - Add exact Taixu LLM/agent route bindings for `ai_chat`.
  - Add Taixu retrieval/document route bindings for `rag`.
  - Match legacy compatible generation routes with or without a custom deployment prefix.
  - Keep the broad `/api/taixu` binding as fallback for dashboard/model/history/settings/home routes.
  - Preserve longest-prefix and segment-boundary matching.
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`
  - Add table-driven tests for Taixu `ai_chat` route gates.
  - Add table-driven tests for Taixu `rag` route gates.
  - Add regressions for generic workspace fallback and segment-boundary matching.

## Scope

### In Scope

- Route-level SaaS feature gates for:
  - `/api/taixu/agent/invoke` -> `taixu_workspace` + `ai_chat`
  - `/api/taixu/agentic/invoke` -> `taixu_workspace` + `ai_chat`
  - `/api/taixu/search/invoke` -> `taixu_workspace` + `ai_chat`
  - `/api/taixu/topic/invoke` -> `taixu_workspace` + `ai_chat`
  - `/api/taixu/travel/invoke` -> `taixu_workspace` + `ai_chat`
  - `/api/taixu/llm/chat` -> `taixu_workspace` + `ai_chat`
  - `/api/taixu/image/generate` -> `taixu_workspace` + `ai_chat`
  - `/llm/chat` -> `taixu_workspace` + `ai_chat`
  - `/image/generate` -> `taixu_workspace` + `ai_chat`
  - `/nest-api/llm/chat` style deployment-prefixed compatible routes -> `taixu_workspace` + `ai_chat`
  - `/api/taixu/retrieval/*` -> `taixu_workspace` + `rag`
  - `/api/taixu/special/*` -> `taixu_workspace` + `rag`
  - `/api/taixu/program/*` -> `taixu_workspace` + `rag`
  - `/api/taixu/arxiv/*` -> `taixu_workspace` + `rag`
  - `/api/taixu/document/*` -> `taixu_workspace` + `rag`
- Guard unit tests.
- Focused backend tests and build.
- Local commit only.

### Out Of Scope

- New SaaS module codes.
- Database migrations.
- Frontend changes.
- Controller/service rewrites.
- Remote push.
- Invoice functionality.

---

## Task 1: Add Failing Guard Tests

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Add a table-driven Taixu AI chat feature-gate test**

Append this test inside `describe('SystemModuleGuard', () => { ... })`:

```ts
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
```

- [ ] **Step 2: Add a table-driven Taixu compat AI chat feature-gate test**

Append this test:

```ts
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
```

- [ ] **Step 3: Add a table-driven deployment-prefixed Taixu compat feature-gate test**

Append this test:

```ts
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
```

- [ ] **Step 4: Add a table-driven Taixu RAG feature-gate test**

Append this test:

```ts
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
```

- [ ] **Step 5: Add a generic Taixu fallback regression test**

Append this test:

```ts
  it('keeps generic Taixu workspace routes on the broad workspace gate', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/taixu/model/page', {
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
```

- [ ] **Step 6: Add a Taixu segment-boundary regression test**

Append this test:

```ts
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
```

- [ ] **Step 7: Run the focused guard test and confirm RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: FAIL because Taixu routes currently match only the broad `/api/taixu` binding and do not pass `requiredSaasModuleCode`.

---

## Task 2: Implement Exact Taixu Route Feature Bindings

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.ts`

- [ ] **Step 1: Add AI chat Taixu route bindings before the broad `/api/taixu` binding**

Insert these bindings before `{ prefix: '/api/taixu', moduleCode: 'taixu_workspace', tenantScoped: true }`:

```ts
  {
    prefix: '/llm/chat',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/image/generate',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/agent/invoke',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/agentic/invoke',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/search/invoke',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/topic/invoke',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/travel/invoke',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/llm/chat',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/image/generate',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
```

- [ ] **Step 2: Add RAG Taixu route bindings before the broad `/api/taixu` binding**

Insert these bindings after the AI chat bindings and before the broad `/api/taixu` binding:

```ts
  {
    prefix: '/api/taixu/retrieval',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'rag',
  },
  {
    prefix: '/api/taixu/special',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'rag',
  },
  {
    prefix: '/api/taixu/program',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'rag',
  },
  {
    prefix: '/api/taixu/arxiv',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'rag',
  },
  {
    prefix: '/api/taixu/document',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'rag',
  },
```

- [ ] **Step 3: Run focused guard test and confirm GREEN**

Update `matchBinding()` to build candidate paths from the request path before matching:

```ts
  private matchBinding(path: string): SystemModuleRouteBinding | undefined {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const candidatePaths = this.buildCandidatePaths(normalizedPath);
    return ROUTE_BINDINGS.filter((binding) =>
      candidatePaths.some((candidatePath) => this.matchesRoutePrefix(candidatePath, binding.prefix)),
    ).sort((left, right) => right.prefix.length - left.prefix.length)[0];
  }

  private buildCandidatePaths(normalizedPath: string): string[] {
    const paths = new Set<string>([normalizedPath]);
    const apiIndex = normalizedPath.indexOf('/api/');
    if (apiIndex > 0) {
      paths.add(normalizedPath.slice(apiIndex));
    }
    const secondSlashIndex = normalizedPath.indexOf('/', 1);
    if (secondSlashIndex > 0) {
      paths.add(normalizedPath.slice(secondSlashIndex));
    }
    return [...paths];
  }

  private matchesRoutePrefix(path: string, prefix: string): boolean {
    return path === prefix || path.startsWith(`${prefix}/`);
  }
```

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: PASS.

---

## Task 3: Review, Verify, And Commit P7

**Files:**
- Review: `server/src/module/system-module/system-module.guard.ts`
- Review: `server/src/module/system-module/system-module.guard.spec.ts`
- Review: `docs/superpowers/plans/2026-07-06-taixu-route-feature-gates-p7.md`

- [ ] **Step 1: Run focused module/access regression tests**

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

- Taixu LLM/agent routes require `ai_chat`.
- Taixu retrieval/document routes require `rag`.
- Generic Taixu routes still use broad `taixu_workspace`.
- Public Taixu common routes still skip module access through `IS_PUBLIC_KEY`.
- Segment-boundary matching prevents accidental feature-gate overmatching.
- No unrelated files are staged.

- [ ] **Step 4: Commit P7**

Stage only:

```powershell
git add docs/superpowers/plans/2026-07-06-taixu-route-feature-gates-p7.md server/src/module/system-module/system-module.guard.ts server/src/module/system-module/system-module.guard.spec.ts
git diff --cached --name-only
git diff --cached --check
git commit -m "fix: enforce taixu route feature gates"
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
- Direct Taixu generation endpoints are covered by exact `ai_chat` feature requirements.
- Legacy compatible Taixu generation endpoints are covered by exact `ai_chat` feature requirements.
- Custom deployment prefixes for legacy compatible Taixu generation endpoints are normalized and covered.
- Taixu retrieval and document endpoints are covered by exact `rag` feature requirements.
- Generic model/history/settings/home routes continue to rely on broad `taixu_workspace` entitlement.
- Existing public common route behavior remains unchanged because public metadata is checked before route binding.

Placeholder scan:
- No TODO/TBD placeholders.
- Every implementation step includes concrete code and exact commands.

Risk controls:
- All new bindings are route-level only and do not change controller/service behavior.
- Route matching already uses longest-prefix and segment-boundary logic.
- Verification includes guard tests, access service tests, SaaS module entitlement tests, AI chat gate tests, and backend build.
