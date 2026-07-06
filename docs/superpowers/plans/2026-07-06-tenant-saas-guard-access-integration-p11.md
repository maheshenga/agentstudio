# Tenant SaaS Guard Access Integration P11 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add integration-style coverage proving tenant SaaS route bindings and the real `SystemModuleAccessService` enforce member-management and resource-pack feature gates together.

**Architecture:** Extend the P10 in-memory guard harness so tests can seed the system modules required by the route under test. Keep production code unchanged unless these tests expose a real defect. Add real-access-service tests for broad tenant SaaS routes, exact member/resource-pack feature routes, explicit-grant bypass prevention, and route segment-boundary behavior.

**Tech Stack:** NestJS guard, Jest, TypeScript, in-memory TypeORM repository doubles, existing `SystemModuleAccessService`.

---

## File Structure

- Create: `docs/superpowers/plans/2026-07-06-tenant-saas-guard-access-integration-p11.md`
  - Documents the P11 scope, exact tests, verification, review, and commit boundary.
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`
  - Extend `createRealAccessGuard()` with optional seeded system modules.
  - Add `createRealTenantSaasGuard()` to build a real guard with `tenant_saas` seeded.
  - Add integration-style tests for tenant SaaS member/resource-pack route feature gates.

## Scope

### In Scope

- Real guard + real access-service tests for:
  - broad `/api/saas/tenant/usage` allowed without purchased SaaS modules because `tenant_saas` is a baseline tenant system module;
  - `/api/saas/tenant/members` allowed with `member_management`;
  - `/api/saas/tenant/members` denied without `member_management`;
  - `/api/saas/tenant/resource-pack-orders` and `/api/saas/tenant/resource-packs` allowed with `resource_pack`;
  - resource-pack routes denied without `resource_pack`;
  - explicit tenant `tenant_saas` grants cannot bypass exact SaaS feature gates;
  - `/api/saas/tenant/resource-pack-orders-admin` remains scoped to the broad tenant SaaS route, not the resource-pack exact gate.
- Focused backend tests.
- Backend build.
- Local commit only.

### Out Of Scope

- Production route-binding changes.
- SaaS schema or migration changes.
- Frontend changes.
- Remote push.
- Invoice functionality.

Reasoning: P10 integrated the Taixu side of the route guard with the real access service. P11 closes the same integration confidence gap for tenant-facing SaaS management routes that control membership and resource-pack commercial features.

---

## Task 1: Extend Real Access Guard Harness For Tenant SaaS

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Write failing tenant SaaS integration tests**

Append these tests near the existing tenant SaaS route tests, before the Taixu route tests:

```ts
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
```

- [ ] **Step 2: Run the guard spec and confirm RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: FAIL with `Cannot find name 'createRealTenantSaasGuard'` or equivalent, proving the new tests require harness support.

- [ ] **Step 3: Extend the real guard factory**

Update the `createRealAccessGuard()` options type and module repository setup:

```ts
  const createRealAccessGuard = (
    options: {
      modules?: EntityRecord[];
      saasModuleCodes?: string[];
      tenantModules?: EntityRecord[];
      bridgeRows?: EntityRecord[];
    } = {},
  ) => {
    const moduleRepo = new MemoryRepository(options.modules || [enabledModule('taixu_workspace')]);
```

Then add this helper after `createRealAccessGuard()`:

```ts
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
```

- [ ] **Step 4: Run the guard spec and confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: PASS.

---

## Task 2: Verify, Review, And Commit P11

**Files:**
- Review: `docs/superpowers/plans/2026-07-06-tenant-saas-guard-access-integration-p11.md`
- Review: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Run focused backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts src/module/system-module/services/system-module-access.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run the SaaS access regression set**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts src/module/system-module/services/system-module-access.service.spec.ts src/module/saas/saas-tenant.controller.spec.ts src/module/saas/services/saas-module.service.spec.ts --runInBand
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
- new P11 tests use the real `SystemModuleAccessService`;
- `tenant_saas` baseline behavior remains intentionally broad only for non-feature-specific routes;
- explicit tenant `tenant_saas` grants cannot bypass `member_management` or `resource_pack`;
- route segment-boundary behavior is tested with the real access service;
- no unrelated local noise is staged.

- [ ] **Step 5: Review diff and local noise**

Run:

```powershell
git diff -- docs/superpowers/plans/2026-07-06-tenant-saas-guard-access-integration-p11.md server/src/module/system-module/system-module.guard.spec.ts
git diff --check -- docs/superpowers/plans/2026-07-06-tenant-saas-guard-access-integration-p11.md server/src/module/system-module/system-module.guard.spec.ts
git status --short
```

Confirm these are not staged:

```text
server/pnpm-lock.yaml
.codebase-memory/
.codegraph/
```

- [ ] **Step 6: Commit P11**

Stage only:

```powershell
git add docs/superpowers/plans/2026-07-06-tenant-saas-guard-access-integration-p11.md server/src/module/system-module/system-module.guard.spec.ts
git commit -m "test: add tenant saas guard access integration coverage"
```

Expected: commit succeeds and unrelated local noise remains uncommitted.

---

## Self-Review

- Spec coverage: The plan covers tenant SaaS route bindings, exact SaaS feature requirements, broad tenant self-service behavior, explicit grant bypass prevention, and segment boundaries.
- Placeholder scan: No TBD/TODO/fill-in instructions remain.
- Type consistency: Helper names, route strings, expected error text, and command paths match current files and P10 helper patterns.
- Risk controls: P11 is test-first confidence hardening and does not change production code unless a real integration test exposes a defect.
