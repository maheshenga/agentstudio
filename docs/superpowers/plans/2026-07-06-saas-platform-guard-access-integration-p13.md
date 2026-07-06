# SaaS Platform Guard Access Integration P13 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add integration-style coverage proving non-tenant SaaS platform route bindings use the real `SystemModuleAccessService` correctly without tenant entitlement requirements.

**Architecture:** Reuse the P10-P12 in-memory guard harness and add a SaaS-platform helper that seeds the `saas_platform` system module. Keep production code unchanged unless these tests expose a real defect. Add tests for enabled, disabled, missing, and deployment-prefixed platform routes while asserting tenant SaaS modules are not loaded for non-tenant-scoped bindings.

**Tech Stack:** NestJS guard, Jest, TypeScript, in-memory TypeORM repository doubles, existing `SystemModuleAccessService`.

---

## File Structure

- Create: `docs/superpowers/plans/2026-07-06-saas-platform-guard-access-integration-p13.md`
  - Documents the P13 scope, exact tests, verification, review, and commit boundary.
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`
  - Add `createRealSaasPlatformGuard()` to build a real guard with `saas_platform` seeded by default.
  - Add integration-style tests for non-tenant SaaS platform route access.

## Scope

### In Scope

- Real guard + real access-service tests for:
  - `/api/saas/platform/usage/overview` allowed with enabled `saas_platform` and no tenant id;
  - `/nest-api/api/saas/platform/usage/overview` allowed behind a deployment prefix;
  - `/api/saas/platform/usage/overview` rejected when `saas_platform` is disabled;
  - `/api/saas/platform/usage/overview` rejected when `saas_platform` is missing;
  - platform routes do not call `SaasModuleService.listTenantModules`.
- Focused backend tests.
- Backend build.
- Local commit only.

### Out Of Scope

- Production route-binding changes.
- SaaS schema or migration changes.
- Frontend changes.
- Remote push.
- Invoice functionality.

Reasoning: P10-P12 covered tenant-scoped commercial feature gates. P13 closes the non-tenant platform side of the same guard/access integration boundary and verifies global module status failures are exercised through the real service.

---

## Task 1: Add SaaS Platform Real Access Guard Helper

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Add the SaaS platform helper**

Add this helper after `createRealAiConsoleGuard()`:

```ts
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
```

- [ ] **Step 2: Run the guard spec**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: PASS. This step only adds helper code.

---

## Task 2: Add SaaS Platform Integration Tests

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Add enabled and deployment-prefix allow tests**

Append these tests near the existing platform SaaS route test:

```ts
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
```

- [ ] **Step 2: Add disabled and missing module denial tests**

Append these tests after the allow tests:

```ts
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
```

- [ ] **Step 3: Run the guard spec**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: PASS.

---

## Task 3: Verify, Review, And Commit P13

**Files:**
- Review: `docs/superpowers/plans/2026-07-06-saas-platform-guard-access-integration-p13.md`
- Review: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Run focused backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts src/module/system-module/services/system-module-access.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run the platform/SaaS access regression set**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts src/module/system-module/services/system-module-access.service.spec.ts src/module/saas/saas-platform.controller.spec.ts src/module/saas/services/saas-platform.service.spec.ts --runInBand
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
- new P13 tests use the real `SystemModuleAccessService`;
- non-tenant platform routes do not require tenant context;
- module disabled/missing failures come from the real access service;
- deployment prefix normalization is covered with the real service;
- no unrelated local noise is staged.

- [ ] **Step 5: Review diff and local noise**

Run:

```powershell
git add -N docs/superpowers/plans/2026-07-06-saas-platform-guard-access-integration-p13.md
git diff -- docs/superpowers/plans/2026-07-06-saas-platform-guard-access-integration-p13.md server/src/module/system-module/system-module.guard.spec.ts
git diff --check -- docs/superpowers/plans/2026-07-06-saas-platform-guard-access-integration-p13.md server/src/module/system-module/system-module.guard.spec.ts
git status --short
```

Confirm these are not staged:

```text
server/pnpm-lock.yaml
.codebase-memory/
.codegraph/
```

- [ ] **Step 6: Commit P13**

Stage only:

```powershell
git add docs/superpowers/plans/2026-07-06-saas-platform-guard-access-integration-p13.md server/src/module/system-module/system-module.guard.spec.ts
git commit -m "test: add saas platform guard access integration coverage"
```

Expected: commit succeeds and unrelated local noise remains uncommitted.

---

## Self-Review

- Spec coverage: The plan covers non-tenant SaaS platform route bindings, global module enabled/disabled/missing behavior, deployment prefix normalization, and no tenant module loading.
- Placeholder scan: No TBD/TODO/fill-in instructions remain.
- Type consistency: Helper names, route strings, expected error text, and command paths match current files and P10-P12 helper patterns.
- Risk controls: P13 is test-first confidence hardening and does not change production code unless a real integration test exposes a defect.
