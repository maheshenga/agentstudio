# P1 Payment Notify Payload Redaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent sensitive Alipay callback fields from being stored verbatim in SaaS payment notify audit logs.

**Architecture:** Keep `SaasPaymentService.handleAlipayNotify()` behavior unchanged, but update its raw-payload normalization helper so audit logs retain operational fields while redacting signatures and buyer identifiers before `SaasPaymentNotifyLogEntity.rawPayload` is persisted.

**Tech Stack:** NestJS service tests with Jest, TypeScript helper logic, existing `npm.cmd run verify:saas-readiness`.

## Global Constraints

- Do not change Alipay signature verification or expected callback acknowledgement behavior.
- Do not change the payment notify log table schema.
- Do not expose or persist raw signature/buyer identifiers in clear text.
- Use TDD: add a failing service test first, run red, implement, then run green.

---

### Task 1: Add Redaction Test

**Files:**
- Modify: `server/src/module/saas/services/saas-payment.service.spec.ts`

**Interfaces:**
- Consumes: `SaasPaymentService.handleAlipayNotify()`.
- Produces: A test proving `rawPayload` redacts `sign`, `buyer_id`, and `buyer_logon_id` while preserving order/trade metadata.

- [ ] **Step 1: Write failing test**

Add this test near the existing paid plan notify audit test:

```ts
it('redacts sensitive Alipay notify payload fields before recording audit', async () => {
  saasOrderService.findPlatformOrder.mockResolvedValue({
    order_no: 'SO20260702000000001000001',
    amount_cents: 99000,
    status: SAAS_ORDER_PENDING,
  })
  jest.spyOn(service, 'verifyAlipayPaidNotify').mockResolvedValue({ valid: true, tradeNo: 'TRADE-1' })
  saasOrderService.confirmAlipayPayment.mockResolvedValue({ status: SAAS_ORDER_PAID })

  await service.handleAlipayNotify({
    out_trade_no: 'SO20260702000000001000001',
    trade_no: 'TRADE-1',
    trade_status: 'TRADE_SUCCESS',
    sign: 'raw-signature',
    buyer_id: '2088123456789012',
    buyer_logon_id: 'buyer@example.com',
  })

  expect(paymentNotifyLogRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({
      rawPayload: expect.objectContaining({
        out_trade_no: 'SO20260702000000001000001',
        trade_no: 'TRADE-1',
        trade_status: 'TRADE_SUCCESS',
        sign: '[redacted]',
        buyer_id: '[redacted]',
        buyer_logon_id: '[redacted]',
      }),
    }),
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd server
npm.cmd test -- saas-payment.service.spec.ts --runInBand
```

Expected: FAIL because `rawPayload` still stores sensitive values verbatim.

### Task 2: Implement Payload Redaction

**Files:**
- Modify: `server/src/module/saas/services/saas-payment.service.ts`

**Interfaces:**
- Consumes: `Record<string, any>` callback body.
- Produces: `Record<string, unknown>` where sensitive keys are replaced with `[redacted]`.

- [ ] **Step 1: Add sensitive key set**

Add near the paid status set:

```ts
const ALIPAY_NOTIFY_REDACTED_KEYS = new Set([
  'sign',
  'buyer_id',
  'buyer_logon_id',
  'buyer_user_id',
  'buyer_open_id'
])
```

- [ ] **Step 2: Update `toSafeNotifyPayload`**

Change the helper so it lowercases keys for matching and returns `[redacted]` for sensitive keys, preserving all other values unchanged.

- [ ] **Step 3: Run focused test**

Run:

```powershell
cd server
npm.cmd test -- saas-payment.service.spec.ts --runInBand
```

Expected: PASS.

### Task 3: Full Verification, Review, Commit

**Files:**
- Review changed files.

- [ ] **Step 1: Run backend SaaS readiness**

```powershell
cd server
npm.cmd run verify:saas-readiness
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

```powershell
cd server
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Review and commit**

```powershell
git diff --check
git diff --stat
git add docs/superpowers/plans/2026-07-09-p1-payment-notify-payload-redaction.md server/src/module/saas/services/saas-payment.service.spec.ts server/src/module/saas/services/saas-payment.service.ts
git commit -m "fix: redact saas payment notify audit payloads"
```

Expected: commit succeeds and working tree is clean.

## Self-Review

- Spec coverage: Redacts sensitive callback payload fields without changing payment behavior.
- Placeholder scan: No TBD/TODO/later placeholders remain.
- Type consistency: Redaction helper still returns `Record<string, unknown>`.
