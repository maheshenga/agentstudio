# Resource Pack Non Tenant Gate Regression P5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit regression tests proving resource-pack feature gates do not leak into platform, scheduled, plan-order, and idempotent already-delivered payment paths.

**Architecture:** This phase is test-only. P4 intentionally gates tenant resource-pack usage, but platform operations, scheduled cleanup/reconciliation, plan-order cancellation, and duplicate already-delivered payment notifications must stay available regardless of a tenant's resource-pack entitlement. Tests will assert `SystemModuleAccessService.assertModuleAccess` is not called on those paths.

**Tech Stack:** NestJS unit tests, Jest mock call assertions, existing SaaS service specs.

---

## File Structure

- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
  - Add a local negative gate helper.
  - Assert platform list/read, invalid platform filters, and already-delivered duplicate payment notifications do not call `SystemModuleAccessService.assertModuleAccess`.
- Modify: `server/src/module/saas/services/saas-order-risk.service.spec.ts`
  - Add a local negative gate helper.
  - Assert scheduled stale cleanup, no-stale cleanup, plan-order cancellation, risk overview, and reconciliation overview do not call `SystemModuleAccessService.assertModuleAccess`.

## Scope

### In Scope

- Test assertions only.
- Resource-pack order service non-tenant/platform paths.
- Order-risk service scheduled/platform/plan paths.

### Out Of Scope

- Production service changes.
- Controller/guard changes.
- Database migrations.
- Frontend changes.
- Remote push.

Reasoning: P4 already implemented the runtime behavior. P5 locks the deliberately ungated paths into tests so a later defense-in-depth change cannot accidentally block platform operations or idempotent payment notifications.

---

## Task 1: Add Negative Gate Regression Assertions

**Files:**
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
- Modify: `server/src/module/saas/services/saas-order-risk.service.spec.ts`

- [ ] **Step 1: Add resource-pack order negative helper**

In `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`, add this helper immediately after `expectResourcePackAccessGate`:

```ts
  const expectResourcePackAccessGateNotChecked = () => {
    expect(systemModuleAccessService.assertModuleAccess).not.toHaveBeenCalled();
  };
```

- [ ] **Step 2: Assert already-delivered payment notifications remain ungated**

In `does not deliver quota again for already delivered paid orders`, add after `expect(txOrderRepo.save).not.toHaveBeenCalled();`:

```ts
    expectResourcePackAccessGateNotChecked();
```

- [ ] **Step 3: Assert platform resource-pack order list stays ungated**

In `lists platform resource pack orders with filters and pagination`, add after the `expect(orderRepo.findAndCount).toHaveBeenCalledWith(...)` assertion:

```ts
    expectResourcePackAccessGateNotChecked();
```

In `filters platform resource pack orders by order number and close reason`, add after the `expect(orderRepo.findAndCount).toHaveBeenCalledWith(...)` assertion:

```ts
    expectResourcePackAccessGateNotChecked();
```

- [ ] **Step 4: Assert invalid platform tenant filters stay ungated**

In `rejects invalid platform tenant id filters instead of broadening resource pack order queries`, add after `expect(orderRepo.findAndCount).not.toHaveBeenCalled();`:

```ts
    expectResourcePackAccessGateNotChecked();
```

- [ ] **Step 5: Assert platform resource-pack order read stays ungated**

In `finds a platform resource pack order by order number`, add after `expect(orderRepo.findOne).toHaveBeenCalledWith(...)`:

```ts
    expectResourcePackAccessGateNotChecked();
```

- [ ] **Step 6: Add order-risk negative helper**

In `server/src/module/saas/services/saas-order-risk.service.spec.ts`, add this helper immediately after `expectResourcePackAccessGate`:

```ts
  const expectResourcePackAccessGateNotChecked = () => {
    expect(systemModuleAccessService.assertModuleAccess).not.toHaveBeenCalled();
  };
```

- [ ] **Step 7: Assert scheduled cleanup paths stay ungated**

In `closes stale pending plan and resource-pack orders`, add after the final `expect(resourcePackOrderRepo.update).toHaveBeenCalledWith(...)` assertion:

```ts
    expectResourcePackAccessGateNotChecked();
```

In `does not update when no stale pending orders exist`, add after `expect(resourcePackOrderRepo.update).not.toHaveBeenCalled();`:

```ts
    expectResourcePackAccessGateNotChecked();
```

- [ ] **Step 8: Assert plan-order cancellation stays ungated**

In `closes a tenant pending plan order`, add after `expect(planOrderRepo.save).not.toHaveBeenCalled();`:

```ts
    expectResourcePackAccessGateNotChecked();
```

- [ ] **Step 9: Assert risk and reconciliation overviews stay ungated**

In `calculates risk overview counts`, add after the existing `expect(planOrderRepo.count).toHaveBeenNthCalledWith(...)` assertion:

```ts
    expectResourcePackAccessGateNotChecked();
```

In `summarizes stale payment requested orders for reconciliation`, add after the final `expect(resourcePackOrderRepo.find).toHaveBeenCalledWith(...)` assertion:

```ts
    expectResourcePackAccessGateNotChecked();
```

- [ ] **Step 10: Run focused tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/services/saas-resource-pack-order.service.spec.ts src/module/saas/services/saas-order-risk.service.spec.ts --runInBand
```

Expected: PASS. This phase is test hardening for already-correct behavior, so the new assertions should pass immediately.

---

## Task 2: Verify, Review, And Commit P5

**Files:**
- Review: `docs/superpowers/plans/2026-07-06-resource-pack-non-tenant-gate-regression-p5.md`
- Review: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
- Review: `server/src/module/saas/services/saas-order-risk.service.spec.ts`

- [ ] **Step 1: Run focused SaaS access tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/services/saas-resource-pack-order.service.spec.ts src/module/saas/services/saas-order-risk.service.spec.ts src/module/saas/saas-tenant.controller.spec.ts src/module/system-module/system-module.guard.spec.ts --runInBand
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
- P5 is test-only.
- The tests explicitly lock platform, scheduled, plan-order, and already-delivered duplicate payment paths as ungated.
- The assertions do not weaken P4 tenant resource-pack gates.
- No unrelated local noise is staged.

- [ ] **Step 4: Commit P5**

Stage only:

```powershell
git add docs/superpowers/plans/2026-07-06-resource-pack-non-tenant-gate-regression-p5.md server/src/module/saas/services/saas-resource-pack-order.service.spec.ts server/src/module/saas/services/saas-order-risk.service.spec.ts
git commit -m "test: lock resource pack non-tenant gate boundaries"
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
- The plan covers platform resource-pack list/read and invalid filter paths.
- The plan covers scheduled stale cleanup, plan-order cancellation, risk overview, and reconciliation overview paths.
- The plan covers already-delivered duplicate resource-pack payment notifications.

Placeholder scan:
- No TODO/TBD placeholders.
- Every test assertion and verification command is specified exactly.

Type consistency:
- Helper names match existing Jest mock names in the two spec files.
- No production code, DTO, entity, migration, or frontend contract is introduced.
