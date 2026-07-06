# AI Console Guard Access Integration P12 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add integration-style coverage proving AI console route bindings and the real `SystemModuleAccessService` enforce broad `ai_console` entitlement and exact `ai_chat` feature gates together.

**Architecture:** Reuse the P10/P11 in-memory guard harness and add an AI-specific helper that seeds the `ai_console` system module. Keep production code unchanged unless these tests expose a real defect. Add real-access-service tests for AI admin routes, chat/session routes, option routes, explicit-grant bypass prevention, and route segment-boundary behavior.

**Tech Stack:** NestJS guard, Jest, TypeScript, in-memory TypeORM repository doubles, existing `SystemModuleAccessService`.

---

## File Structure

- Create: `docs/superpowers/plans/2026-07-06-ai-console-guard-access-integration-p12.md`
  - Documents the P12 scope, exact tests, verification, review, and commit boundary.
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`
  - Add `createRealAiConsoleGuard()` to build a real guard with `ai_console` seeded.
  - Add integration-style tests for AI admin and AI chat feature route gates.

## Scope

### In Scope

- Real guard + real access-service tests for:
  - `/api/ai/admin/providers/list` denied when the tenant has neither `ai_chat` entitlement nor explicit `ai_console` grant;
  - `/api/ai/admin/providers/list` allowed through `ai_chat` bridge entitlement without an exact feature requirement;
  - `/api/ai/admin/providers/list` allowed through explicit tenant `ai_console` grant without loading SaaS modules;
  - `/api/ai/sessions` allowed with `ai_chat`;
  - `/api/ai/sessions` denied with `rag`;
  - `/api/ai/models/options` and `/api/ai/agents/options` allowed with `ai_chat`;
  - explicit tenant `ai_console` grants cannot bypass exact `ai_chat` feature gates on `/api/ai/sessions`;
  - `/api/ai/sessions-archive` remains scoped to the broad `/api/ai` route, not the exact `/api/ai/sessions` feature gate.
- Focused backend tests.
- Backend build.
- Local commit only.

### Out Of Scope

- Production route-binding changes.
- SaaS schema or migration changes.
- Frontend changes.
- Remote push.
- Invoice functionality.

Reasoning: P10 covered Taixu and P11 covered tenant SaaS routes. P12 closes the remaining high-value route/access integration gap for the separate AI console surface, where some routes are broad `ai_console` and others require exact `ai_chat`.

---

## Task 1: Add AI Console Real Access Guard Harness

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Add the AI console helper**

Add this helper after `createRealTenantSaasGuard()`:

```ts
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
```

- [ ] **Step 2: Run the guard spec**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: PASS. This step only adds helper code; fix helper typing if needed before adding behavior tests.

---

## Task 2: Add AI Console Integration Tests

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Add broad AI admin entitlement tests**

Append these tests near the existing AI admin route test:

```ts
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
```

- [ ] **Step 2: Add exact AI chat feature route tests**

Append these tests near the existing `/api/ai/sessions` mock-argument test:

```ts
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
```

- [ ] **Step 3: Add explicit-grant bypass and segment-boundary tests**

Append these tests near the exact AI feature tests:

```ts
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
```

- [ ] **Step 4: Run the guard spec**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: PASS.

---

## Task 3: Verify, Review, And Commit P12

**Files:**
- Review: `docs/superpowers/plans/2026-07-06-ai-console-guard-access-integration-p12.md`
- Review: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Run focused backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts src/module/system-module/services/system-module-access.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run the AI/SaaS access regression set**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts src/module/system-module/services/system-module-access.service.spec.ts src/module/ai/services/chat.service.spec.ts src/module/saas/services/saas-module.service.spec.ts --runInBand
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
- new P12 tests use the real `SystemModuleAccessService`;
- broad AI admin routes and exact AI chat feature routes are distinct;
- explicit tenant `ai_console` grants cannot bypass `ai_chat`;
- route segment-boundary behavior is tested with the real access service;
- no unrelated local noise is staged.

- [ ] **Step 5: Review diff and local noise**

Run:

```powershell
git add -N docs/superpowers/plans/2026-07-06-ai-console-guard-access-integration-p12.md
git diff -- docs/superpowers/plans/2026-07-06-ai-console-guard-access-integration-p12.md server/src/module/system-module/system-module.guard.spec.ts
git diff --check -- docs/superpowers/plans/2026-07-06-ai-console-guard-access-integration-p12.md server/src/module/system-module/system-module.guard.spec.ts
git status --short
```

Confirm these are not staged:

```text
server/pnpm-lock.yaml
.codebase-memory/
.codegraph/
```

- [ ] **Step 6: Commit P12**

Stage only:

```powershell
git add docs/superpowers/plans/2026-07-06-ai-console-guard-access-integration-p12.md server/src/module/system-module/system-module.guard.spec.ts
git commit -m "test: add ai console guard access integration coverage"
```

Expected: commit succeeds and unrelated local noise remains uncommitted.

---

## Self-Review

- Spec coverage: The plan covers AI route bindings, exact SaaS feature requirements, broad AI admin behavior, explicit grant bypass prevention, and segment boundaries.
- Placeholder scan: No TBD/TODO/fill-in instructions remain.
- Type consistency: Helper names, route strings, expected error text, and command paths match current files and P10/P11 helper patterns.
- Risk controls: P12 is test-first confidence hardening and does not change production code unless a real integration test exposes a defect.
