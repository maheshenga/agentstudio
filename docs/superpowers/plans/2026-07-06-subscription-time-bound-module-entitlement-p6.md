# Subscription Time Bound Module Entitlement P6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent expired-but-not-yet-swept active SaaS subscriptions from granting tenant SaaS modules and downstream system-module access.

**Architecture:** Keep `SaasModuleService.listTenantModules(tenantId)` as the single source of SaaS module entitlement. Tighten its active subscription lookup so only subscriptions with `endTime IS NULL` or `endTime > now` are considered active for entitlement. `SystemModuleAccessService.assertModuleAccess()` already loads tenant SaaS modules through this service, so this single service-level change protects member/resource-pack/system-module gates without adding duplicate date checks elsewhere.

**Tech Stack:** NestJS injectable services, TypeORM `IsNull` and `MoreThan` operators, Jest unit tests, existing SaaS module and system-module access service tests.

---

## File Structure

- Modify: `server/src/module/saas/services/saas-module.service.ts`
  - Import `MoreThan` from TypeORM.
  - Update `listTenantModules` to only find tenant active subscriptions where `endTime` is null or later than the current time.
- Modify: `server/src/module/saas/services/saas-module.service.spec.ts`
  - Import `IsNull` and `MoreThan` from TypeORM for query-shape assertions.
  - Restore real timers after tests that set system time.
  - Add failing tests for expired active subscriptions no longer granting modules or passing `assertTenantModuleEnabled`.
- Create: `docs/superpowers/plans/2026-07-06-subscription-time-bound-module-entitlement-p6.md`
  - This plan.

## Scope

### In Scope

- Tenant SaaS module entitlement from `SaasModuleService.listTenantModules`.
- Downstream behavior through `SaasModuleService.assertTenantModuleEnabled`.
- Regression coverage proving the query includes time-bound active subscription constraints.

### Out Of Scope

- Lifecycle sweep behavior, because it already expires ended subscriptions asynchronously.
- Platform subscription list/read behavior, because platform operators need to inspect expired records.
- Tenant subscription summary UI, because it can display lifecycle fields for expired-by-time subscriptions.
- Quota reset/reclamation behavior.
- Frontend changes.
- Database migrations.
- Remote push.

Reasoning: this is an authorization consistency fix. The smallest correct boundary is where tenant module entitlements are derived; duplicating `endTime` checks in every consumer would be easier to miss and harder to maintain.

---

## Task 1: Add Failing Module Entitlement Tests

**Files:**
- Modify: `server/src/module/saas/services/saas-module.service.spec.ts`

- [ ] **Step 1: Import TypeORM date operators**

Replace:

```ts
import { DataSource } from 'typeorm';
```

with:

```ts
import { DataSource, IsNull, MoreThan } from 'typeorm';
```

- [ ] **Step 2: Restore real timers after each test**

Add this block after the existing `beforeEach` block:

```ts
  afterEach(() => {
    jest.useRealTimers();
  });
```

- [ ] **Step 3: Add the expired active subscription list test**

Add this test after `lists tenant modules from the active subscription plan`:

```ts
  it('does not list tenant modules from an active subscription past its end time', async () => {
    const now = new Date('2026-07-06T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    subscriptionRepo.findOne.mockResolvedValue(null);

    await expect(service.listTenantModules(12)).resolves.toEqual([]);

    expect(subscriptionRepo.findOne).toHaveBeenCalledWith({
      where: [
        { tenantId: 12, status: 'active', endTime: IsNull(), deleteTime: IsNull() },
        { tenantId: 12, status: 'active', endTime: MoreThan(now), deleteTime: IsNull() },
      ],
      order: { id: 'DESC' },
    });
    expect(planFeatureRepo.find).not.toHaveBeenCalled();
    expect(moduleRepo.find).not.toHaveBeenCalled();
  });
```

Expected RED: current production code calls `subscriptionRepo.findOne` with `{ tenantId, status: 'active', deleteTime: IsNull() }`, so the query-shape assertion fails.

- [ ] **Step 4: Add the expired active subscription assertion test**

Add this test after the previous new test:

```ts
  it('does not allow an expired active subscription to satisfy tenant module assertions', async () => {
    const now = new Date('2026-07-06T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    subscriptionRepo.findOne.mockResolvedValue(null);

    await expect(service.assertTenantModuleEnabled(12, 'crm')).rejects.toThrow(
      'Current plan has not enabled this module',
    );

    expect(subscriptionRepo.findOne).toHaveBeenCalledWith({
      where: [
        { tenantId: 12, status: 'active', endTime: IsNull(), deleteTime: IsNull() },
        { tenantId: 12, status: 'active', endTime: MoreThan(now), deleteTime: IsNull() },
      ],
      order: { id: 'DESC' },
    });
    expect(planFeatureRepo.find).not.toHaveBeenCalled();
    expect(moduleRepo.find).not.toHaveBeenCalled();
  });
```

Expected RED: current production code does not include `endTime` in the active subscription query.

- [ ] **Step 5: Run focused test and confirm RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/services/saas-module.service.spec.ts --runInBand
```

Expected: FAIL, with the two new tests reporting that `subscriptionRepo.findOne` was called without the `endTime IS NULL OR endTime > now` where array.

---

## Task 2: Implement Time-Bound Active Subscription Lookup

**Files:**
- Modify: `server/src/module/saas/services/saas-module.service.ts`

- [ ] **Step 1: Import `MoreThan`**

Replace:

```ts
import { DataSource, In, IsNull, Like, Repository } from 'typeorm';
```

with:

```ts
import { DataSource, In, IsNull, Like, MoreThan, Repository } from 'typeorm';
```

- [ ] **Step 2: Update `listTenantModules` subscription lookup**

Replace the existing subscription lookup:

```ts
    const subscription = await this.subscriptionRepo.findOne({
      where: { tenantId, status: 'active', deleteTime: IsNull() },
      order: { id: 'DESC' },
    });
```

with:

```ts
    const now = new Date();
    const subscription = await this.subscriptionRepo.findOne({
      where: [
        { tenantId, status: 'active', endTime: IsNull(), deleteTime: IsNull() },
        { tenantId, status: 'active', endTime: MoreThan(now), deleteTime: IsNull() },
      ],
      order: { id: 'DESC' },
    });
```

Reasoning: a free/current subscription with no end time should still grant modules; a paid subscription with a future end time should grant modules; an active row with an already-past end time should stop granting modules even before lifecycle sweep updates its status.

- [ ] **Step 3: Run focused test and confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/services/saas-module.service.spec.ts --runInBand
```

Expected: PASS.

---

## Task 3: Verify, Review, And Commit P6

**Files:**
- Review: `docs/superpowers/plans/2026-07-06-subscription-time-bound-module-entitlement-p6.md`
- Review: `server/src/module/saas/services/saas-module.service.ts`
- Review: `server/src/module/saas/services/saas-module.service.spec.ts`

- [ ] **Step 1: Run focused module/access tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/services/saas-module.service.spec.ts src/module/system-module/services/system-module-access.service.spec.ts src/module/system-module/system-module.guard.spec.ts src/module/saas/saas-tenant.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Request review**

Ask a review worker to check:
- The change is limited to tenant module entitlement.
- `endTime IS NULL` and `endTime > now` both remain entitled.
- Expired active rows no longer grant modules before lifecycle sweep.
- `SystemModuleAccessService` still benefits through `SaasModuleService.listTenantModules`.
- No platform subscription list/read behavior changed.
- No unrelated local noise is staged.

- [ ] **Step 4: Commit P6**

Stage only:

```powershell
git add docs/superpowers/plans/2026-07-06-subscription-time-bound-module-entitlement-p6.md server/src/module/saas/services/saas-module.service.ts server/src/module/saas/services/saas-module.service.spec.ts
git commit -m "fix: enforce subscription end time for module access"
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
- The plan covers the observed gap where `status: active` alone can grant modules after `endTime` has passed.
- The plan preserves active subscriptions with `endTime = null`.
- The plan relies on the existing system-module access flow loading SaaS modules from `SaasModuleService`, avoiding duplicate checks.

Placeholder scan:
- No TODO/TBD placeholders.
- Every code-changing step includes the exact code snippet or command needed.

Type consistency:
- TypeORM operators are imported from `typeorm` in both production and spec files.
- No DTO, entity, migration, frontend contract, or controller API shape changes are introduced.
