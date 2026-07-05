# Resource Pack Order Access Gate P2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the remaining service-level resource-pack order feature check from direct SaaS module checks to `SystemModuleAccessService`, so non-controller callers receive the same system-module and exact SaaS feature enforcement.

**Architecture:** Replace `SaasResourcePackOrderService`'s dependency on `SaasModuleService` with `SystemModuleAccessService`. `createTenantOrder()` will call `assertModuleAccess({ tenantId, moduleCode: 'tenant_saas', requiredSaasModuleCode: 'resource_pack' })` before looking up resource packs. This keeps the legacy SaaS package behavior through `SystemModuleAccessService` while adding system-module disable/dependency gates.

**Tech Stack:** NestJS services, Jest unit tests, TypeScript dependency injection, existing `SystemModuleAccessService.assertModuleAccess`.

---

## File Structure

- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.ts`
  - Replace `SaasModuleService` import/injection with `SystemModuleAccessService`.
  - Replace direct `assertTenantModuleEnabled(tenantId, 'resource_pack')` with `assertModuleAccess(...)`.
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
  - Replace `SaasModuleService` mock/provider with `SystemModuleAccessService`.
  - Update access-gate expectations and denial test names.

## Scope

### In Scope

- Only resource-pack order creation service gate.
- Unit tests for service-level access.
- Focused backend tests and build.

### Out Of Scope

- Removing `SaasModuleService.assertTenantModuleEnabled` method itself; its own tests remain valid for SaaS catalog behavior.
- Changing tenant controller behavior from P1.
- Frontend changes.
- Database migrations.
- Remote push.

---

## Task 1: Update Resource Pack Order Service Tests

**Files:**
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`

- [ ] **Step 1: Replace the access service import**

Replace:

```ts
import { SaasModuleService } from './saas-module.service';
```

with:

```ts
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
```

- [ ] **Step 2: Replace the mock**

Replace:

```ts
const saasModuleService = { assertTenantModuleEnabled: jest.fn() };
```

with:

```ts
const systemModuleAccessService = { assertModuleAccess: jest.fn() };
```

- [ ] **Step 3: Replace the testing provider**

Replace:

```ts
{ provide: SaasModuleService, useValue: saasModuleService },
```

with:

```ts
{ provide: SystemModuleAccessService, useValue: systemModuleAccessService },
```

- [ ] **Step 4: Update success assertion**

In `creates a pending resource pack order from active pack values`, replace:

```ts
expect(saasModuleService.assertTenantModuleEnabled).toHaveBeenCalledWith(12, 'resource_pack');
```

with:

```ts
expect(systemModuleAccessService.assertModuleAccess).toHaveBeenCalledWith({
  tenantId: 12,
  moduleCode: 'tenant_saas',
  requiredSaasModuleCode: 'resource_pack',
});
```

- [ ] **Step 5: Update denial test**

Replace the denial test with:

```ts
it('checks resource pack module access before looking up packs', async () => {
  systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

  await expect(
    service.createTenantOrder(12, { resource_pack_code: 'tokens_1m', payment_method: 'alipay' }),
  ).rejects.toThrow('Module disabled');

  expect(systemModuleAccessService.assertModuleAccess).toHaveBeenCalledWith({
    tenantId: 12,
    moduleCode: 'tenant_saas',
    requiredSaasModuleCode: 'resource_pack',
  });
  expect(packRepo.findOne).not.toHaveBeenCalled();
  expect(orderRepo.create).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Run the focused service test and confirm RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/services/saas-resource-pack-order.service.spec.ts --runInBand
```

Expected: FAIL because `SaasResourcePackOrderService` still injects `SaasModuleService`.

---

## Task 2: Implement SystemModuleAccessService Gate In Resource Pack Order Service

**Files:**
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.ts`

- [ ] **Step 1: Replace imports**

Replace:

```ts
import { SaasModuleService } from './saas-module.service';
```

with:

```ts
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
```

- [ ] **Step 2: Replace constructor dependency**

Replace:

```ts
private readonly saasModuleService: SaasModuleService,
```

with:

```ts
private readonly systemModuleAccessService: SystemModuleAccessService,
```

- [ ] **Step 3: Replace createTenantOrder gate**

Replace:

```ts
await this.saasModuleService.assertTenantModuleEnabled(tenantId, 'resource_pack');
```

with:

```ts
await this.systemModuleAccessService.assertModuleAccess({
  tenantId,
  moduleCode: 'tenant_saas',
  requiredSaasModuleCode: 'resource_pack',
});
```

- [ ] **Step 4: Run focused service test and confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/services/saas-resource-pack-order.service.spec.ts --runInBand
```

Expected: PASS.

---

## Task 3: Verify, Review, And Commit P2

**Files:**
- Review: `server/src/module/saas/services/saas-resource-pack-order.service.ts`
- Review: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
- Review: `docs/superpowers/plans/2026-07-06-resource-pack-order-access-gate-p2.md`

- [ ] **Step 1: Run focused backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/services/saas-resource-pack-order.service.spec.ts src/module/saas/saas-tenant.controller.spec.ts src/module/system-module/services/system-module-access.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Review the remaining direct call sites**

Run:

```powershell
rg "assertTenantModuleEnabled" server/src
```

Expected: only `SaasModuleService.assertTenantModuleEnabled` itself and its own unit tests should remain.

- [ ] **Step 4: Request code review**

Ask a review worker to check:
- No Nest dependency cycle risk was introduced.
- `createTenantOrder` still blocks before `resourcePackRepo.findOne`.
- Tests cover the new service-level gate.
- No unrelated files are staged.

- [ ] **Step 5: Commit P2**

Stage only:

```powershell
git add docs/superpowers/plans/2026-07-06-resource-pack-order-access-gate-p2.md server/src/module/saas/services/saas-resource-pack-order.service.ts server/src/module/saas/services/saas-resource-pack-order.service.spec.ts
git commit -m "fix: unify resource pack order access gate"
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
- The remaining production direct service call is covered.
- Service-level protection remains before pack lookup and order creation.
- Existing SaaS module catalog service remains intact.

Placeholder scan:
- No TODO/TBD placeholders.
- Every step has concrete code and commands.

Risk controls:
- The service now depends on the global `SystemModuleAccessService`, which already depends only on `SaasModuleService`, not on `SaasResourcePackOrderService`.
- Focused DI and build verification catch constructor/provider mistakes.
