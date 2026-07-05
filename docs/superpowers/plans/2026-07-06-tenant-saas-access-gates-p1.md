# Tenant SaaS Access Gates P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move tenant SaaS member and resource-pack controller gates onto `SystemModuleAccessService` while preserving existing SaaS service checks as defense in depth.

**Architecture:** Keep `SaasModuleService` in `SaasTenantController` for the `/modules` listing endpoint only. Inject `SystemModuleAccessService` into `SaasTenantController` and add one private helper that asserts `tenant_saas` plus the exact commercial SaaS feature code. Member endpoints require `member_management`; resource-pack endpoints require `resource_pack`. Do not change `SaasResourcePackOrderService` in this slice, because it still protects non-controller callers with the legacy direct gate.

**Tech Stack:** NestJS controllers, Jest controller unit tests, existing `RequirePermission`, existing tenant context utility, `SystemModuleAccessService.assertModuleAccess`.

---

## File Structure

- Modify: `server/src/module/saas/saas-tenant.controller.ts`
  - Import and inject `SystemModuleAccessService`.
  - Add `assertTenantFeatureAccess(tenantId, requiredSaasModuleCode)`.
  - Replace member endpoint direct `SaasModuleService.assertTenantModuleEnabled(...)` calls with the helper.
  - Add the helper gate to tenant resource-pack endpoints.
- Modify: `server/src/module/saas/saas-tenant.controller.spec.ts`
  - Add a `SystemModuleAccessService` mock provider.
  - Update member endpoint tests to expect `assertModuleAccess`.
  - Add resource-pack endpoint access-gate expectations and denial tests.

## Scope

### In Scope

- `members`, `createMember`, `changeMemberRole`, `updateMemberStatus`, `removeMember`, `resetMemberPassword`.
- `resourcePacks`, `createResourcePackOrder`, `resourcePackOrders`, `cancelResourcePackOrder`, `resourcePackOrder`.
- Controller-level access gate tests.

### Out Of Scope

- Removing `SaasModuleService.assertTenantModuleEnabled` from `SaasResourcePackOrderService`.
- Changing SaaS plan tables or bridge tables.
- Frontend changes.
- Remote push.

Reasoning: P0 introduced precise feature gates in the generic access service. P1 applies those gates at tenant-facing controller boundaries first, which improves consistency without changing lower-level SaaS service dependencies.

---

## Task 1: Update Controller Tests To Expect System Module Gates

**Files:**
- Modify: `server/src/module/saas/saas-tenant.controller.spec.ts`

- [ ] **Step 1: Add the import and mock provider**

Add:

```ts
import { SystemModuleAccessService } from '../system-module/services/system-module-access.service';
```

Add the mock next to `moduleService`:

```ts
const systemModuleAccessService = {
  assertModuleAccess: jest.fn(),
};
```

Add this provider in `Test.createTestingModule`:

```ts
{
  provide: SystemModuleAccessService,
  useValue: systemModuleAccessService,
},
```

- [ ] **Step 2: Add expectation helpers**

Add near the existing mocks:

```ts
const expectTenantFeatureGate = (tenantId: number, requiredSaasModuleCode: string) => {
  expect(systemModuleAccessService.assertModuleAccess).toHaveBeenCalledWith({
    tenantId,
    moduleCode: 'tenant_saas',
    requiredSaasModuleCode,
  });
};
```

- [ ] **Step 3: Update member endpoint assertions**

Replace each member-management assertion:

```ts
expect(moduleService.assertTenantModuleEnabled).toHaveBeenCalledWith(88, 'member_management');
```

with:

```ts
expectTenantFeatureGate(88, 'member_management');
```

For disabled member tests, replace:

```ts
moduleService.assertTenantModuleEnabled.mockRejectedValueOnce(
  new BadRequestException('Current plan has not enabled this module'),
);
```

with:

```ts
systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(
  new BadRequestException('Current plan has not enabled this module'),
);
```

- [ ] **Step 4: Add resource-pack gate assertions**

For these success tests, add `expectTenantFeatureGate(88, 'resource_pack')` before the service expectation:

```ts
it('returns active tenant resource packs in tenant context', async () => {
  // existing setup
  const result = await controller.resourcePacks();

  expectTenantFeatureGate(88, 'resource_pack');
  expect(saasResourcePackService.listTenantResourcePacks).toHaveBeenCalled();
  expect(result.data).toEqual([{ code: 'ai_calls_1k' }]);
});
```

```ts
it('creates a tenant resource pack order in tenant context', async () => {
  // existing setup
  const result = await controller.createResourcePackOrder({
    resource_pack_code: 'tokens_1m',
    payment_method: 'alipay',
  });

  expectTenantFeatureGate(88, 'resource_pack');
  expect(saasResourcePackOrderService.createTenantOrder).toHaveBeenCalledWith(88, {
    resource_pack_code: 'tokens_1m',
    payment_method: 'alipay',
  });
  expect(result.data).toEqual({
    order_no: 'RPO20260703120000001000001',
    resource_pack_code: 'tokens_1m',
    status: 'pending',
    closed_at: null,
    close_reason: null,
  });
});
```

```ts
it('returns a tenant resource pack order by order number', async () => {
  // existing setup
  const result = await controller.resourcePackOrder('RPO20260703120000001000001');

  expectTenantFeatureGate(88, 'resource_pack');
  expect(saasResourcePackOrderService.findTenantOrder).toHaveBeenCalledWith(
    88,
    'RPO20260703120000001000001',
  );
  expect(result.data).toEqual({
    order_no: 'RPO20260703120000001000001',
    resource_pack_code: 'tokens_1m',
    status: 'paid',
    closed_at: null,
    close_reason: null,
  });
});
```

```ts
it('lists tenant resource pack orders in tenant context', async () => {
  // existing setup
  const result = await controller.resourcePackOrders({ status: 'pending' });

  expectTenantFeatureGate(88, 'resource_pack');
  expect(saasResourcePackOrderService.listTenantOrders).toHaveBeenCalledWith(88, { status: 'pending' });
  expect(result.data).toEqual({
    list: [{ order_no: 'RPO20260703120000001000001' }],
    total: 1,
    page: 1,
    limit: 20,
  });
});
```

```ts
it('cancels a current tenant resource pack order', async () => {
  // existing setup
  const result = await controller.cancelResourcePackOrder('RPO20260703120000001000001');

  expectTenantFeatureGate(88, 'resource_pack');
  expect(saasOrderRiskService.closeTenantResourcePackOrder).toHaveBeenCalledWith(
    88,
    'RPO20260703120000001000001',
  );
  expect(result.data).toEqual({
    order_no: 'RPO20260703120000001000001',
    resource_pack_code: 'tokens_1m',
    status: 'closed',
    closed_at: new Date('2026-07-03T01:00:00.000Z'),
    close_reason: 'tenant_cancelled',
  });
});
```

- [ ] **Step 5: Add resource-pack denial tests**

Add:

```ts
it('does not list resource packs when the resource pack feature is disabled', async () => {
  jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
  systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(
    new BadRequestException('Current plan has not enabled this module'),
  );

  await expect(controller.resourcePacks()).rejects.toThrow('Current plan has not enabled this module');

  expectTenantFeatureGate(88, 'resource_pack');
  expect(saasResourcePackService.listTenantResourcePacks).not.toHaveBeenCalled();
});

it('does not create resource pack orders when the resource pack feature is disabled', async () => {
  jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
  systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(
    new BadRequestException('Current plan has not enabled this module'),
  );

  await expect(
    controller.createResourcePackOrder({
      resource_pack_code: 'tokens_1m',
      payment_method: 'alipay',
    }),
  ).rejects.toThrow('Current plan has not enabled this module');

  expectTenantFeatureGate(88, 'resource_pack');
  expect(saasResourcePackOrderService.createTenantOrder).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Run the controller test and confirm RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-tenant.controller.spec.ts --runInBand
```

Expected: FAIL because `SaasTenantController` does not inject or call `SystemModuleAccessService` yet.

---

## Task 2: Implement Tenant Feature Gate Helper In SaasTenantController

**Files:**
- Modify: `server/src/module/saas/saas-tenant.controller.ts`

- [ ] **Step 1: Add the import**

```ts
import { SystemModuleAccessService } from '../system-module/services/system-module-access.service';
```

- [ ] **Step 2: Inject the service**

In the constructor, add after `moduleService`:

```ts
private readonly systemModuleAccessService: SystemModuleAccessService,
```

- [ ] **Step 3: Add the helper**

Add near the end of the controller class before the closing brace:

```ts
  private async assertTenantFeatureAccess(tenantId: number, requiredSaasModuleCode: string) {
    await this.systemModuleAccessService.assertModuleAccess({
      tenantId,
      moduleCode: 'tenant_saas',
      requiredSaasModuleCode,
    });
  }
```

- [ ] **Step 4: Replace member endpoint gates**

Replace every member-management direct check:

```ts
await this.moduleService.assertTenantModuleEnabled(tenantId, 'member_management');
```

with:

```ts
await this.assertTenantFeatureAccess(tenantId, 'member_management');
```

Affected methods:
- `members`
- `createMember`
- `changeMemberRole`
- `updateMemberStatus`
- `removeMember`
- `resetMemberPassword`

- [ ] **Step 5: Add resource-pack endpoint gates**

Add this line after tenant context validation in each resource-pack method:

```ts
await this.assertTenantFeatureAccess(tenantId, 'resource_pack');
```

Affected methods:
- `resourcePacks`
- `createResourcePackOrder`
- `resourcePackOrders`
- `cancelResourcePackOrder`
- `resourcePackOrder`

- [ ] **Step 6: Run the controller test and confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-tenant.controller.spec.ts --runInBand
```

Expected: PASS.

---

## Task 3: Verify, Review, And Commit P1

**Files:**
- Review: `server/src/module/saas/saas-tenant.controller.ts`
- Review: `server/src/module/saas/saas-tenant.controller.spec.ts`
- Review: `docs/superpowers/plans/2026-07-06-tenant-saas-access-gates-p1.md`

- [ ] **Step 1: Run focused backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-tenant.controller.spec.ts src/module/system-module/services/system-module-access.service.spec.ts src/module/system-module/system-module.guard.spec.ts --runInBand
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
- No provider cycle was introduced.
- `SaasModuleService` remains only for tenant module listing inside the controller.
- Member/resource-pack service calls are blocked when `SystemModuleAccessService` rejects.
- No unrelated files are staged.

- [ ] **Step 4: Commit P1**

Stage only:

```powershell
git add docs/superpowers/plans/2026-07-06-tenant-saas-access-gates-p1.md server/src/module/saas/saas-tenant.controller.ts server/src/module/saas/saas-tenant.controller.spec.ts
git commit -m "fix: unify tenant saas feature access gates"
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
- Member-management endpoints are covered.
- Resource-pack read/write/order endpoints are covered.
- Tenant context remains the source of tenant id.
- Existing SaaS module listing remains unchanged.

Placeholder scan:
- No TODO/TBD placeholders.
- Every implementation and test step includes exact code or concrete commands.

Risk controls:
- `SaasResourcePackOrderService` keeps its legacy direct gate, so non-controller callers remain protected.
- Controller-level gates add system-module/global disable behavior without removing plan-feature enforcement.
- No database migration or frontend route changes are included in P1.
