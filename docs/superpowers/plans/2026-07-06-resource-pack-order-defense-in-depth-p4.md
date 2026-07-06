# Resource Pack Order Defense In Depth P4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add service-layer resource-pack feature gates to tenant resource-pack order read, list, payment-request, payment-confirm, and cancellation paths so non-controller callers cannot bypass the P1/P3 controller and guard gates.

**Architecture:** Keep `SystemModuleAccessService.assertModuleAccess` as the single access decision. `SaasResourcePackOrderService` will use one private helper for tenant-facing order operations and will gate pending payment delivery after loading the locked order, because Alipay notify only carries the order number. `SaasOrderRiskService.closeTenantResourcePackOrder` will also use the same access decision for tenant-initiated cancellation; scheduled timeout cleanup and platform reconciliation remain ungated because they are platform operations, not tenant feature usage.

**Tech Stack:** NestJS injectable services, TypeORM repositories/transactions, Jest unit tests, existing `SystemModuleAccessService.assertModuleAccess`.

---

## File Structure

- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.ts`
  - Add `assertTenantResourcePackAccess(tenantId)` helper.
  - Use the helper in `createTenantOrder`, `findTenantOrder`, `markTenantPaymentRequested`, `listTenantOrders`, and `confirmPaidOrder` before quota delivery.
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
  - Add tests proving read/list/payment-request/payment-confirm paths stop before repository mutation or quota grant when the feature gate rejects.
  - Update existing expectations where the new helper adds access checks.
- Modify: `server/src/module/saas/services/saas-order-risk.service.ts`
  - Inject `SystemModuleAccessService`.
  - Add the same tenant resource-pack helper.
  - Gate `closeTenantResourcePackOrder` before the update.
- Modify: `server/src/module/saas/services/saas-order-risk.service.spec.ts`
  - Add the mock provider.
  - Assert tenant resource-pack cancellation calls the gate and blocked cancellation does not update/find orders.

## Scope

### In Scope

- Tenant resource-pack order service paths:
  - `createTenantOrder`
  - `findTenantOrder`
  - `markTenantPaymentRequested`
  - `listTenantOrders`
  - `confirmDevPayment`
  - `confirmAlipayPayment`
- Tenant resource-pack cancellation:
  - `SaasOrderRiskService.closeTenantResourcePackOrder`

### Out Of Scope

- Platform resource-pack order list/read/reconciliation APIs.
- Scheduled stale order cleanup.
- Plan-order payment and cancellation behavior.
- Database migrations.
- Frontend changes.
- Remote push.

Reasoning: platform operations need to observe and reconcile records regardless of tenant feature entitlement. Tenant resource-pack usage should be blocked consistently even when called below the controller layer.

---

## Task 1: Add Failing Service Tests

**Files:**
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
- Modify: `server/src/module/saas/services/saas-order-risk.service.spec.ts`

- [ ] **Step 1: Add resource-pack order service gate helper expectation**

In `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`, add this helper near the mocks:

```ts
const expectResourcePackAccessGate = (tenantId: number) => {
  expect(systemModuleAccessService.assertModuleAccess).toHaveBeenCalledWith({
    tenantId,
    moduleCode: 'tenant_saas',
    requiredSaasModuleCode: 'resource_pack',
  });
};
```

- [ ] **Step 2: Replace the duplicated create-order access expectation**

In the existing `creates a pending resource pack order from active pack values` test, replace:

```ts
expect(systemModuleAccessService.assertModuleAccess).toHaveBeenCalledWith({
  tenantId: 12,
  moduleCode: 'tenant_saas',
  requiredSaasModuleCode: 'resource_pack',
});
```

with:

```ts
expectResourcePackAccessGate(12);
```

In the existing `checks resource pack module access before looking up packs` test, replace the duplicated expectation with:

```ts
expectResourcePackAccessGate(12);
```

- [ ] **Step 3: Add read/list/payment-request denial tests**

Add these tests to `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`:

```ts
it('checks resource pack access before reading a tenant order', async () => {
  systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

  await expect(service.findTenantOrder(12, 'RPO1')).rejects.toThrow('Module disabled');

  expectResourcePackAccessGate(12);
  expect(orderRepo.findOne).not.toHaveBeenCalled();
});

it('checks resource pack access before listing tenant orders', async () => {
  systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

  await expect(service.listTenantOrders(12, { status: 'pending' })).rejects.toThrow('Module disabled');

  expectResourcePackAccessGate(12);
  expect(orderRepo.findAndCount).not.toHaveBeenCalled();
});

it('checks resource pack access before marking tenant payment requested', async () => {
  systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

  await expect(service.markTenantPaymentRequested(12, 'RPO1')).rejects.toThrow('Module disabled');

  expectResourcePackAccessGate(12);
  expect(orderRepo.update).not.toHaveBeenCalled();
  expect(orderRepo.findOne).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Add payment delivery denial tests**

Add these tests to `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`:

```ts
it('checks resource pack access before dev payment delivers quota', async () => {
  txOrderRepo.findOne.mockResolvedValue({
    orderNo: 'RPO1',
    tenantId: 12,
    resourceType: 'tokens',
    quotaAmount: 1000,
    status: SAAS_ORDER_PENDING,
  });
  systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

  await expect(service.confirmDevPayment(12, 'RPO1')).rejects.toThrow('Module disabled');

  expectResourcePackAccessGate(12);
  expect(saasQuotaService.grantTenantQuota).not.toHaveBeenCalled();
  expect(txOrderRepo.save).not.toHaveBeenCalled();
});

it('checks resource pack access before alipay notify delivers quota', async () => {
  txOrderRepo.findOne.mockResolvedValue({
    orderNo: 'RPO1',
    tenantId: 12,
    resourceType: 'tokens',
    quotaAmount: 1000,
    status: SAAS_ORDER_PENDING,
  });
  systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

  await expect(service.confirmAlipayPayment('RPO1', 'trade-no')).rejects.toThrow('Module disabled');

  expectResourcePackAccessGate(12);
  expect(saasQuotaService.grantTenantQuota).not.toHaveBeenCalled();
  expect(txOrderRepo.save).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: Add order-risk service access mock and expectation helper**

In `server/src/module/saas/services/saas-order-risk.service.spec.ts`, add:

```ts
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
```

Add this mock near the repositories:

```ts
const systemModuleAccessService = {
  assertModuleAccess: jest.fn(),
};
```

Add this provider to the testing module:

```ts
{ provide: SystemModuleAccessService, useValue: systemModuleAccessService },
```

Add this helper near the mocks:

```ts
const expectResourcePackAccessGate = (tenantId: number) => {
  expect(systemModuleAccessService.assertModuleAccess).toHaveBeenCalledWith({
    tenantId,
    moduleCode: 'tenant_saas',
    requiredSaasModuleCode: 'resource_pack',
  });
};
```

- [ ] **Step 6: Update resource-pack cancellation success and denial tests**

In `closes a tenant pending resource-pack order`, add after the service call:

```ts
expectResourcePackAccessGate(12);
```

Add this denial test:

```ts
it('checks resource pack access before tenant resource-pack cancellation', async () => {
  systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

  await expect(service.closeTenantResourcePackOrder(12, 'RPO1')).rejects.toThrow('Module disabled');

  expectResourcePackAccessGate(12);
  expect(resourcePackOrderRepo.update).not.toHaveBeenCalled();
  expect(resourcePackOrderRepo.findOne).not.toHaveBeenCalled();
});
```

- [ ] **Step 7: Run focused tests and confirm RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/services/saas-resource-pack-order.service.spec.ts src/module/saas/services/saas-order-risk.service.spec.ts --runInBand
```

Expected: FAIL because `findTenantOrder`, `listTenantOrders`, `markTenantPaymentRequested`, `confirmPaidOrder`, and `closeTenantResourcePackOrder` do not yet call the system module access gate.

---

## Task 2: Implement Service-Layer Resource-Pack Gates

**Files:**
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.ts`
- Modify: `server/src/module/saas/services/saas-order-risk.service.ts`

- [ ] **Step 1: Add helper to `SaasResourcePackOrderService`**

Add this private helper before `resolvePagination`:

```ts
  private async assertTenantResourcePackAccess(tenantId: number): Promise<void> {
    await this.systemModuleAccessService.assertModuleAccess({
      tenantId,
      moduleCode: 'tenant_saas',
      requiredSaasModuleCode: 'resource_pack',
    });
  }
```

- [ ] **Step 2: Use helper in tenant order creation**

Replace the inline call at the start of `createTenantOrder`:

```ts
await this.systemModuleAccessService.assertModuleAccess({
  tenantId,
  moduleCode: 'tenant_saas',
  requiredSaasModuleCode: 'resource_pack',
});
```

with:

```ts
await this.assertTenantResourcePackAccess(tenantId);
```

- [ ] **Step 3: Gate read/list/payment-request methods before repository calls**

Update methods as follows:

```ts
async findTenantOrder(tenantId: number, orderNo: string): Promise<SaasResourcePackOrderEntity | null> {
  await this.assertTenantResourcePackAccess(tenantId);
  return this.resourcePackOrderRepo.findOne({
    where: {
      tenantId,
      orderNo,
    },
  });
}
```

```ts
async markTenantPaymentRequested(
  tenantId: number,
  orderNo: string,
  now = new Date(),
): Promise<SaasResourcePackOrderEntity> {
  await this.assertTenantResourcePackAccess(tenantId);
  const updateResult = await this.resourcePackOrderRepo.update(
    { tenantId, orderNo, status: SAAS_ORDER_PENDING },
    { paymentRequestedAt: now },
  );
  // keep the existing remainder of the method unchanged
}
```

```ts
async listTenantOrders(tenantId: number, query: SaasResourcePackOrderListQuery = {}) {
  await this.assertTenantResourcePackAccess(tenantId);
  const { page, limit, skip } = this.resolvePagination(query);
  // keep the existing remainder of the method unchanged
}
```

- [ ] **Step 4: Gate pending payment delivery inside the transaction**

In `confirmPaidOrder`, after the already-delivered idempotency return and before the pending-status check, add:

```ts
      await this.assertTenantResourcePackAccess(order.tenantId);
```

The resulting control flow must remain:

```ts
      if (!order) {
        throw new NotFoundException('Resource pack order not found');
      }
      if (order.status === SAAS_ORDER_PAID && order.deliveredAt) {
        return order;
      }
      await this.assertTenantResourcePackAccess(order.tenantId);
      if (order.status !== SAAS_ORDER_PENDING) {
        throw new BadRequestException('Only pending resource pack orders can be paid');
      }
```

Reasoning: already-delivered duplicate Alipay notifications remain idempotent and do not grant quota again; pending delivery is blocked when the tenant no longer has the resource-pack feature.

- [ ] **Step 5: Add `SystemModuleAccessService` to `SaasOrderRiskService`**

In `server/src/module/saas/services/saas-order-risk.service.ts`, add:

```ts
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
```

Update the constructor:

```ts
  constructor(
    @InjectRepository(SaasOrderEntity)
    private readonly planOrderRepo: Repository<SaasOrderEntity>,
    @InjectRepository(SaasResourcePackOrderEntity)
    private readonly resourcePackOrderRepo: Repository<SaasResourcePackOrderEntity>,
    private readonly systemModuleAccessService: SystemModuleAccessService,
  ) {}
```

Add this helper before `sumAmount`:

```ts
  private async assertTenantResourcePackAccess(tenantId: number): Promise<void> {
    await this.systemModuleAccessService.assertModuleAccess({
      tenantId,
      moduleCode: 'tenant_saas',
      requiredSaasModuleCode: 'resource_pack',
    });
  }
```

- [ ] **Step 6: Gate tenant resource-pack cancellation before repository update**

At the start of `closeTenantResourcePackOrder`, add:

```ts
    await this.assertTenantResourcePackAccess(tenantId);
```

Do not add this gate to `closeExpiredPendingOrders` or platform overview/reconciliation methods.

- [ ] **Step 7: Run focused tests and confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/services/saas-resource-pack-order.service.spec.ts src/module/saas/services/saas-order-risk.service.spec.ts --runInBand
```

Expected: PASS.

---

## Task 3: Verify, Review, And Commit P4

**Files:**
- Review: `docs/superpowers/plans/2026-07-06-resource-pack-order-defense-in-depth-p4.md`
- Review: `server/src/module/saas/services/saas-resource-pack-order.service.ts`
- Review: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
- Review: `server/src/module/saas/services/saas-order-risk.service.ts`
- Review: `server/src/module/saas/services/saas-order-risk.service.spec.ts`

- [ ] **Step 1: Run focused tests**

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
- The new service gates cover tenant read/list/payment-request/payment-delivery/cancel paths.
- Platform operations and scheduled stale-order cleanup remain ungated.
- Already-delivered paid resource-pack orders remain idempotent and do not grant quota again.
- No provider cycle or module import change was introduced.
- No unrelated local noise is staged.

- [ ] **Step 4: Commit P4**

Stage only:

```powershell
git add docs/superpowers/plans/2026-07-06-resource-pack-order-defense-in-depth-p4.md server/src/module/saas/services/saas-resource-pack-order.service.ts server/src/module/saas/services/saas-resource-pack-order.service.spec.ts server/src/module/saas/services/saas-order-risk.service.ts server/src/module/saas/services/saas-order-risk.service.spec.ts
git commit -m "fix: harden resource pack order service gates"
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
- The plan covers non-controller access gaps found after P2: resource-pack order read, list, payment-request, payment delivery, and tenant cancellation.
- The plan keeps platform operations and scheduled cleanup out of tenant entitlement checks.
- The plan preserves existing P1/P3 controller and route guard behavior as defense in depth.

Placeholder scan:
- No TODO/TBD placeholders.
- Every code-changing step includes the exact code snippet or command needed.

Type consistency:
- `SystemModuleAccessService.assertModuleAccess` payload uses the same `{ tenantId, moduleCode: 'tenant_saas', requiredSaasModuleCode: 'resource_pack' }` shape already used by P1/P2/P3.
- No new DTO, entity, migration, or frontend contract is introduced.
