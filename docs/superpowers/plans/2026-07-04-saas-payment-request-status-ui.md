# SaaS Payment Request Status UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show `payment_requested_at` clearly in SaaS tenant and platform order UIs, and prevent misleading tenant cancel actions for externally requested payments.

**Architecture:** Add a small pure helper module for payment request state and reuse it from tenant and platform SaaS pages. Keep backend APIs unchanged because they already return `payment_requested_at`.

**Tech Stack:** Vue 3, TypeScript, Element Plus, existing SaaS API wrappers, `tsx` for focused helper tests, `vue-tsc` for frontend typecheck.

## Global Constraints

- Do not add invoice, refund, reconciliation, notification, or recurring billing functionality.
- Do not add a new order status value.
- Keep backend enforcement as the source of truth.
- Do not touch `server/.env`.
- Do not commit `server/pnpm-lock.yaml`.

---

### Task 1: Payment Request State Helper

**Files:**
- Create: `web/src/utils/saas/payment-request-state.ts`
- Test: `web/src/utils/saas/payment-request-state.test.ts`

**Interfaces:**
- Produces: `hasPaymentRequestedAt(value: unknown): boolean`
- Produces: `isPaymentRequestedPendingOrder(order: { status?: string | null; payment_requested_at?: unknown; paymentRequestedAt?: unknown } | null | undefined): boolean`
- Produces: `getPaymentRequestTagType(order): 'warning' | 'info'`

- [ ] **Step 1: Write failing test**

```ts
import assert from 'node:assert/strict';
import {
  hasPaymentRequestedAt,
  isPaymentRequestedPendingOrder
} from './payment-request-state';

assert.equal(hasPaymentRequestedAt(null), false);
assert.equal(hasPaymentRequestedAt(''), false);
assert.equal(hasPaymentRequestedAt('2026-07-04T00:00:00.000Z'), true);
assert.equal(isPaymentRequestedPendingOrder({ status: 'pending', payment_requested_at: '2026-07-04T00:00:00.000Z' }), true);
assert.equal(isPaymentRequestedPendingOrder({ status: 'closed', payment_requested_at: '2026-07-04T00:00:00.000Z' }), false);
```

- [ ] **Step 2: Verify RED**

Run: `pnpm exec tsx src/utils/saas/payment-request-state.test.ts`

Expected: FAIL because `payment-request-state.ts` does not exist.

- [ ] **Step 3: Implement helper**

```ts
export function hasPaymentRequestedAt(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

export function isPaymentRequestedPendingOrder(order: { status?: string | null; payment_requested_at?: unknown; paymentRequestedAt?: unknown } | null | undefined): boolean {
  if (!order) return false;
  return String(order.status || '').toLowerCase() === 'pending' && (hasPaymentRequestedAt(order.payment_requested_at) || hasPaymentRequestedAt(order.paymentRequestedAt));
}

export function getPaymentRequestTagType(order: { status?: string | null; payment_requested_at?: unknown; paymentRequestedAt?: unknown } | null | undefined): 'warning' | 'info' {
  return isPaymentRequestedPendingOrder(order) ? 'warning' : 'info';
}
```

- [ ] **Step 4: Verify GREEN**

Run: `pnpm exec tsx src/utils/saas/payment-request-state.test.ts`

Expected: PASS.

### Task 2: Tenant Order Pages

**Files:**
- Modify: `web/src/views/saas/tenant/plan/index.vue`
- Modify: `web/src/views/saas/tenant/resource-pack/index.vue`

**Interfaces:**
- Consumes: Task 1 helper functions.
- Produces: visible payment-requested tag/time and hidden cancel action for payment-requested pending tenant orders.

- [ ] **Step 1: Import helpers**
- [ ] **Step 2: Add current-order payment request text**
- [ ] **Step 3: Add table column for payment request state/time**
- [ ] **Step 4: Use `isPaymentRequestedPendingOrder(row)` to hide or disable cancel buttons**
- [ ] **Step 5: Run `pnpm exec vue-tsc --noEmit`**

### Task 3: Platform Order Pages

**Files:**
- Modify: `web/src/views/saas/platform/subscription/index.vue`
- Modify: `web/src/views/saas/platform/resource-pack-order/index.vue`

**Interfaces:**
- Consumes: Task 1 helper functions.
- Produces: visible payment-requested tag/time in platform order tables and detail drawers.

- [ ] **Step 1: Import helpers**
- [ ] **Step 2: Add table columns for payment request state/time**
- [ ] **Step 3: Add detail drawer descriptions for payment request state/time**
- [ ] **Step 4: Run `pnpm exec vue-tsc --noEmit`**

### Task 4: Final Verification And Commit

**Files:**
- Modified files from Tasks 1-3.

- [ ] **Step 1: Run focused helper test**

Run: `pnpm exec tsx src/utils/saas/payment-request-state.test.ts`

- [ ] **Step 2: Run frontend typecheck**

Run: `pnpm exec vue-tsc --noEmit`

- [ ] **Step 3: Run whitespace check**

Run: `git diff --check HEAD`

- [ ] **Step 4: Commit only planned files**

Run:

```bash
git add docs/superpowers/plans/2026-07-04-saas-payment-request-status-ui.md web/src/utils/saas/payment-request-state.ts web/src/utils/saas/payment-request-state.test.ts web/src/views/saas/tenant/plan/index.vue web/src/views/saas/tenant/resource-pack/index.vue web/src/views/saas/platform/subscription/index.vue web/src/views/saas/platform/resource-pack-order/index.vue
git commit -m "feat: show SaaS payment request state"
```
