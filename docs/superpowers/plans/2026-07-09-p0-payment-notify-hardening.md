# P0 Payment Notify Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden Alipay payment callbacks so every notification has a clear audited outcome and repeated callbacks are explicitly idempotent.

**Architecture:** Move Alipay notify processing out of `SaasPaymentController` into `SaasPaymentService.handleAlipayNotify()`. Add a `saas_payment_notify_log` table/entity that records every callback attempt with order number, trade number, trade status, result, reason, and raw payload. Keep existing order confirmation services as the source of truth for subscription/quota activation, and add explicit duplicate handling when an order is already paid.

**Tech Stack:** NestJS, TypeORM, MySQL migrations, Jest, existing SaaS order/resource-pack services.

## Global Constraints

- Do not weaken Alipay signature, app id, order number, status, or amount validation.
- Controller must still return exactly `success` or `fail` to Alipay.
- Duplicate paid notifications for already-paid orders must return `success` and must not call confirmation again.
- Non-paid but valid Alipay notifications must return `success` and must not mutate orders.
- Invalid or mismatched paid notifications must return `fail`.
- Store callback audit records without storing application private keys or platform secrets.

---

### Task 1: Payment Notify Audit Table

**Files:**
- Create: `server/src/module/saas/entities/saas-payment-notify-log.entity.ts`
- Create: `server/src/migrations/1760000000027-CreateSaasPaymentNotifyLogs.ts`
- Create: `server/src/migration-specs/create-saas-payment-notify-logs.spec.ts`
- Modify: `server/src/module/saas/saas.module.ts`

**Interfaces:**
- Produces entity `SaasPaymentNotifyLogEntity`.
- Produces DB table `saas_payment_notify_log`.

- [ ] **Step 1: Write failing migration spec**

Create `server/src/migration-specs/create-saas-payment-notify-logs.spec.ts`:

```ts
import { CreateSaasPaymentNotifyLogs1760000000027 } from '../migrations/1760000000027-CreateSaasPaymentNotifyLogs';

describe('CreateSaasPaymentNotifyLogs1760000000027', () => {
  it('creates SaaS payment notify log table for callback audit', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateSaasPaymentNotifyLogs1760000000027().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE `saas_payment_notify_log`');
    expect(sql).toContain('`provider` varchar(20) NOT NULL');
    expect(sql).toContain('`order_no` varchar(64) NULL');
    expect(sql).toContain('`result` varchar(30) NOT NULL');
    expect(sql).toContain('`raw_payload` json NULL');
    expect(sql).toContain('KEY `idx_saas_payment_notify_order` (`provider`, `order_no`)');
  });
});
```

- [ ] **Step 2: Run migration spec to verify it fails**

Run: `npm.cmd test -- create-saas-payment-notify-logs.spec.ts --runInBand`

Expected: FAIL because migration does not exist.

- [ ] **Step 3: Add entity and migration**

Entity fields:

```ts
provider: string;
orderType?: string;
orderNo?: string;
tradeNo?: string;
tradeStatus?: string;
notifyId?: string;
result: string;
reason?: string;
rawPayload?: Record<string, unknown> | null;
processedAt?: Date;
createTime?: Date;
updateTime?: Date;
```

Migration creates `saas_payment_notify_log` with indexes:
- `idx_saas_payment_notify_order` on `provider`, `order_no`
- `idx_saas_payment_notify_trade` on `provider`, `trade_no`
- `idx_saas_payment_notify_result` on `provider`, `result`
- `idx_saas_payment_notify_notify_id` on `provider`, `notify_id`

- [ ] **Step 4: Register entity**

Add `SaasPaymentNotifyLogEntity` to `TypeOrmModule.forFeature([...])` in `server/src/module/saas/saas.module.ts`.

- [ ] **Step 5: Run migration spec**

Run: `npm.cmd test -- create-saas-payment-notify-logs.spec.ts --runInBand`

Expected: PASS.

### Task 2: Payment Service Notify Processor

**Files:**
- Modify: `server/src/module/saas/services/saas-payment.service.ts`
- Modify: `server/src/module/saas/services/saas-payment.service.spec.ts`

**Interfaces:**
- Produces:
  - `SaasPaymentNotifyOutcome = 'confirmed' | 'duplicate' | 'ignored' | 'rejected' | 'failed'`
  - `SaasPaymentNotifyResult`
  - `SaasPaymentService.handleAlipayNotify(body: Record<string, any>): Promise<SaasPaymentNotifyResult>`

- [ ] **Step 1: Write failing service tests**

Add tests:

```ts
it('handles a paid plan notify by confirming and recording audit', async () => {
  saasOrderService.findPlatformOrder.mockResolvedValue({
    order_no: 'SO20260702000000001000001',
    amount_cents: 99000,
    status: SAAS_ORDER_PENDING,
  });
  jest.spyOn(service, 'verifyAlipayPaidNotify').mockResolvedValue({ valid: true, tradeNo: 'TRADE-1' });
  saasOrderService.confirmAlipayPayment.mockResolvedValue({ status: SAAS_ORDER_PAID });

  await expect(service.handleAlipayNotify({
    out_trade_no: 'SO20260702000000001000001',
    trade_no: 'TRADE-1',
    trade_status: 'TRADE_SUCCESS',
  })).resolves.toEqual(expect.objectContaining({
    ack: 'success',
    outcome: 'confirmed',
    order_type: 'plan',
    order_no: 'SO20260702000000001000001',
  }));

  expect(saasOrderService.confirmAlipayPayment).toHaveBeenCalledWith('SO20260702000000001000001', 'TRADE-1');
  expect(paymentNotifyLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ result: 'confirmed' }));
});
```

Also cover:
- already-paid plan order returns `duplicate` and does not call confirm
- valid non-paid notify returns `ignored`
- invalid paid notify returns `rejected`
- missing/unknown order returns `failed`

- [ ] **Step 2: Run service tests to verify they fail**

Run: `npm.cmd test -- saas-payment.service.spec.ts --runInBand`

Expected: FAIL because `handleAlipayNotify` and notify log repo are not implemented.

- [ ] **Step 3: Implement processor**

Implementation rules:
- Determine paid status using existing `TRADE_SUCCESS`/`TRADE_FINISHED` set.
- Verify non-paid notifications with `verifyAlipayNotify()`, record `ignored`, return `success`.
- Reject missing `out_trade_no` with `failed`, return `fail`.
- Derive `order_type` by prefix: `RPO` = `resource_pack`, otherwise `plan`.
- Load platform order by derived type.
- Validate paid notify with `verifyAlipayPaidNotify(body, expectedOrder)`.
- If validation fails, record `rejected` with validation reason, return `fail`.
- If local order status is already `paid`, record `duplicate`, return `success`, and do not confirm again.
- Confirm pending order using the correct order service, record `confirmed`, return `success`.
- Catch unexpected exceptions, record `failed`, return `fail`.

- [ ] **Step 4: Run service tests**

Run: `npm.cmd test -- saas-payment.service.spec.ts --runInBand`

Expected: PASS.

### Task 3: Controller Delegation

**Files:**
- Modify: `server/src/module/saas/saas-payment.controller.ts`
- Modify: `server/src/module/saas/saas-payment.controller.spec.ts`

**Interfaces:**
- Controller delegates `POST /api/saas/payment/alipay/notify` to `saasPaymentService.handleAlipayNotify()`.

- [ ] **Step 1: Write failing controller test**

Replace direct confirmation expectations with:

```ts
it('delegates Alipay notify handling to payment service', async () => {
  saasPaymentService.handleAlipayNotify.mockResolvedValue({ ack: 'success', outcome: 'confirmed' });

  await expect(controller.alipayNotify({ out_trade_no: 'SO1', trade_status: 'TRADE_SUCCESS' })).resolves.toBe('success');

  expect(saasPaymentService.handleAlipayNotify).toHaveBeenCalledWith({ out_trade_no: 'SO1', trade_status: 'TRADE_SUCCESS' });
});
```

Also assert `ack: 'fail'` returns `fail`.

- [ ] **Step 2: Run controller tests to verify failure**

Run: `npm.cmd test -- saas-payment.controller.spec.ts --runInBand`

Expected: FAIL until controller delegates to service and mocks include `handleAlipayNotify`.

- [ ] **Step 3: Simplify controller**

Remove controller-local Alipay notify validation/confirmation helpers that become unused. Keep:

```ts
const result = await this.saasPaymentService.handleAlipayNotify(body);
return result.ack;
```

- [ ] **Step 4: Run controller tests**

Run: `npm.cmd test -- saas-payment.controller.spec.ts --runInBand`

Expected: PASS.

### Task 4: Verification and Commit

**Files:**
- Review all changed files.

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
npm.cmd test -- create-saas-payment-notify-logs.spec.ts saas-payment.service.spec.ts saas-payment.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend readiness and build**

Run:

```powershell
npm.cmd run verify:saas-readiness
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Review staged scope**

Run:

```powershell
git diff --check
git diff --stat
git status --short
```

Expected: only planned files changed.

- [ ] **Step 4: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-09-p0-payment-notify-hardening.md server/src/module/saas server/src/migrations/1760000000027-CreateSaasPaymentNotifyLogs.ts server/src/migration-specs/create-saas-payment-notify-logs.spec.ts
git commit -m "feat: harden saas payment notify handling"
```

Expected: commit succeeds.
