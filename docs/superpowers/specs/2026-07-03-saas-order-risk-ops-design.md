# SaaS Order Risk Operations Design

## Goal

Add an order risk and failed-payment operations slice for the existing SaaS billing flow.

The current system can create upgrade orders, resource-pack orders, Alipay payment URLs, development payment confirmations, tenant order history, platform order lists, subscription lifecycle views, and revenue reports. The missing operational behavior is what happens when an order stays unpaid.

This slice adds:

- Automatic timeout closing for stale pending orders.
- Tenant-side cancel and continue-pay actions for unpaid orders.
- Platform-side visibility into pending, closed, and timeout-closed orders.
- Order risk metrics that help operators see whether payment conversion is healthy.

This is an operations and reliability slice. It does not implement invoices, refunds, tax reporting, stored payment methods, automatic recurring charging, SMS/email reminders, coupon logic, or financial reconciliation.

## Current State

Two paid order models exist:

- `saas_order`: paid plan upgrade and renewal orders.
- `saas_resource_pack_order`: resource-pack purchase orders.

Both tables already include:

- `order_no`
- `tenant_id`
- `amount_cents`
- `currency`
- `payment_method`
- `status`
- `alipay_trade_no`
- `paid_at`
- `remark`
- `create_time`
- `update_time`
- `delete_time`

Order confirmation already rejects non-pending orders and treats paid orders idempotently. Resource-pack orders already have tenant history and platform order lists. Plan upgrade orders are visible through the platform subscription/order page, but tenant-side plan order history is narrower than resource-pack order history.

The main gap is that stale pending orders stay pending forever unless paid or changed manually in the database. That makes operations pages noisy, allows very old pay URLs to be retried, and makes conversion metrics hard to read.

## Scope

### Backend

1. Add close metadata to both paid order tables:
   - `closed_at`
   - `close_reason`
2. Add a focused `SaasOrderRiskService` that can:
   - Close stale pending plan orders.
   - Close stale pending resource-pack orders.
   - Return an overview of pending and recently closed orders.
   - Share timeout rules between scheduled task and API flows.
3. Add a scheduled task target:
   - `saas.orderRisk.closeExpiredPendingOrders`
4. Add tenant APIs:
   - Cancel a pending plan order.
   - Cancel a pending resource-pack order.
   - Continue payment still reuses existing Alipay payment creation.
5. Add platform APIs:
   - Get risk overview for order operations.
   - Filter plan orders by order number, close reason, and age when useful.
   - Preserve existing resource-pack order list behavior while adding close metadata.

### Frontend

1. Platform subscription/order page:
   - Add an order risk summary.
   - Add filters for pending, closed, timeout closed, and order number.
   - Show close time and close reason in order tables/details.
2. Tenant plan page:
   - Show the tenant's recent plan orders, especially pending ones.
   - Allow continuing payment for pending plan orders.
   - Allow canceling pending plan orders.
3. Tenant resource-pack page:
   - Keep existing order history.
   - Add cancel action for pending resource-pack orders.
   - Show close time and close reason.
4. Platform resource-pack order page:
   - Show close time and close reason.
   - Add quick visibility for timeout-closed orders.

### Data

A migration is required because close metadata should be queryable and displayed without overloading `remark`.

No new table is required in this slice.

## Non-Goals

- Invoices.
- Refund processing or refund deductions.
- Net revenue accounting.
- Tax reporting.
- Payment reconciliation jobs.
- SMS, email, or in-app push reminders.
- Alipay recurring payments.
- Stored payment methods.
- Coupons, discounts, or proration.
- A separate payment failure ledger.

## Domain Rules

### Order Statuses

This slice keeps the existing status model:

- `pending`: unpaid and still payable.
- `paid`: paid and already activated or delivered.
- `closed`: no longer payable.

Failure and closure reasons are represented by `close_reason`, not by adding many new statuses.

Initial close reasons:

- `timeout`: closed by stale pending order sweep.
- `tenant_cancelled`: canceled by the tenant before payment.
- `platform_closed`: reserved for a future platform manual close action, not required for the first implementation.

### Default Timeout

Default pending order timeout is 2 hours.

The value should be represented as a constant in the backend service first. A later settings page can make it configurable if real operations need different windows.

Timeout checks use `create_time <= now - timeout`.

### Idempotency

Closing an order is idempotent:

- If the order is already `closed`, return the current closed order.
- If the order is `paid`, reject cancellation/close with a clear business error.
- If the order is still `pending`, set `status = closed`, `closed_at = now`, and `close_reason`.

Payment confirmation must continue to only accept pending orders. A timeout-closed or tenant-canceled order must not be payable through development confirmation or Alipay notify.

### Revenue

Revenue reports remain cash-basis:

- Only `paid` orders count.
- `pending` and `closed` orders do not count.
- No refund or net revenue logic is added.

## Backend Design

### Entity Changes

Extend both:

- `SaasOrderEntity`
- `SaasResourcePackOrderEntity`

New nullable columns:

```ts
@Column({ type: 'datetime', name: 'closed_at', nullable: true })
closedAt?: Date;

@Column({ type: 'varchar', name: 'close_reason', length: 50, nullable: true })
closeReason?: string;
```

Migration:

- Add `closed_at` and `close_reason` to `saas_order`.
- Add `closed_at` and `close_reason` to `saas_resource_pack_order`.
- Add indexes suitable for pending timeout scans:
  - `(status, create_time)`
  - `(status, close_reason)`

### Constants

Reuse the existing `SAAS_ORDER_CLOSED = 'closed'` constant and add constants for shared use:

- `SAAS_ORDER_CLOSE_REASON_TIMEOUT = 'timeout'`
- `SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED = 'tenant_cancelled'`
- `SAAS_ORDER_PENDING_TIMEOUT_MINUTES = 120`

Backend constants remain the source of truth for status and close-reason comparisons.

### `SaasOrderRiskService`

Create a focused service under `server/src/module/saas/services/`.

Primary responsibilities:

```ts
type CloseExpiredPendingOrdersResult = {
  checked_at: Date;
  timeout_minutes: number;
  closed_plan_order_count: number;
  closed_resource_pack_order_count: number;
  closed_plan_order_nos: string[];
  closed_resource_pack_order_nos: string[];
};

type OrderRiskOverview = {
  pending_plan_orders: number;
  pending_resource_pack_orders: number;
  timeout_closed_plan_orders_7d: number;
  timeout_closed_resource_pack_orders_7d: number;
  tenant_cancelled_plan_orders_7d: number;
  tenant_cancelled_resource_pack_orders_7d: number;
};
```

Methods:

- `closeExpiredPendingOrders(now?, timeoutMinutes?)`
- `closeTenantPlanOrder(tenantId, orderNo, now?)`
- `closeTenantResourcePackOrder(tenantId, orderNo, now?)`
- `getOrderRiskOverview(now?)`
- `decoratePlanOrder(order)`
- `decorateResourcePackOrder(order)`

The service should use repositories directly for focused operations. It should avoid changing subscription or quota state, because only unpaid pending orders are closed.

### Scheduled Task

Register:

```ts
@Task({
  name: 'saas.orderRisk.closeExpiredPendingOrders',
  description: 'Close stale pending SaaS orders',
})
```

The task calls `closeExpiredPendingOrders()`.

Menu seeding for a cron job is optional in this slice. The existing task framework can expose the target for manual cron configuration. If existing SaaS task seed conventions are extended later, the recommended schedule is every 10 minutes.

### Plan Order APIs

Add tenant plan-order history and cancel support:

- `GET /api/saas/tenant/orders`
- `POST /api/saas/tenant/orders/:order_no/cancel`

The list returns current tenant orders with pagination and filters:

- `status`
- `order_no`

The cancel endpoint requires tenant context and only closes that tenant's pending order.

Extend platform order listing for plan orders:

- `order_no`
- `close_reason`

The platform subscription page currently mixes subscriptions and plan orders. The existing page can consume these fields without introducing a new platform page.

### Resource-Pack Order APIs

Extend existing APIs:

- Tenant resource-pack order list returns `closed_at` and `close_reason`.
- Platform resource-pack order list/detail returns `closed_at` and `close_reason`.
- Add tenant cancel endpoint:
  - `POST /api/saas/tenant/resource-pack-orders/:order_no/cancel`

### Platform Risk Overview API

Add:

```http
GET /api/saas/platform/orders/risk/overview
```

Permission:

- Reuse `saas:order:index` or the existing platform order list permission if that is the local convention.
- If the menu seed uses more specific slugs, add `saas:order-risk:index` only when necessary.

The controller must run outside tenant filtering with the existing `TenantContext.run({ ignoreTenant: true })` pattern.

## Frontend Design

### API Wrapper

Extend `web/src/api/saas.ts` with:

- Plan order list params and result types.
- `fetchTenantSaasOrders(params)`
- `cancelTenantSaasOrder(orderNo)`
- `cancelTenantResourcePackOrder(orderNo)`
- `fetchPlatformOrderRiskOverview()`
- close metadata on plan and resource-pack order records.

### Platform Subscription/Order Page

Enhance the existing platform subscription page's orders tab:

- Add risk summary values above the order table.
- Add quick filters for:
  - All
  - Pending
  - Timeout closed
  - Tenant canceled
- Show:
  - Order number
  - Tenant ID
  - Plan code
  - Amount
  - Status
  - Close reason
  - Closed at
  - Created at

The page should keep the current tabs and layout. No separate "risk center" page is required for the first version.

### Tenant Plan Page

Add a compact recent orders section below the current subscription and plan cards:

- Show recent plan orders.
- Pending orders expose:
  - Continue payment.
  - Cancel order.
- Closed orders show close reason and close time.

The continue-payment action reuses existing payment creation and polling logic. It must not create a duplicate order.

### Tenant Resource-Pack Page

Enhance the current order history:

- Add close metadata columns.
- Add cancel action for pending rows.
- Refresh order history after cancel.

### Platform Resource-Pack Order Page

Enhance current table and detail drawer:

- Show close reason.
- Show close time.
- Add quick filter for timeout-closed rows by `status = closed` and `close_reason = timeout`.

## Error Handling

- Cancel without tenant context returns the existing tenant-context error shape.
- Canceling a paid order returns a business error such as `Paid orders cannot be cancelled`.
- Canceling an unknown order returns `Order not found`.
- Canceling an already closed order returns the current order as success.
- Alipay notify for a closed order continues to fail through the existing "only pending orders can be paid" rule.
- The timeout sweep should never close paid orders, even if `create_time` is old.

## Testing

### Backend Unit Tests

Add focused service tests:

- Closes stale pending plan orders.
- Closes stale pending resource-pack orders.
- Leaves paid orders unchanged.
- Leaves recent pending orders unchanged.
- Is idempotent for already closed orders.
- Rejects tenant cancel for paid orders.
- Returns order risk overview counts.

Extend existing controller/service tests:

- Tenant plan order list is scoped to tenant context.
- Tenant plan order cancel delegates to risk service.
- Tenant resource-pack order cancel delegates to risk service.
- Platform risk overview route runs outside tenant context.
- Platform order lists include `closed_at` and `close_reason`.

### Frontend Verification

Run:

- `cd server; pnpm run test -- saas-order-risk.service.spec.ts --runInBand`
- `cd server; pnpm run test -- saas-order.service.spec.ts saas-resource-pack-order.service.spec.ts saas-platform.controller.spec.ts saas-tenant.controller.spec.ts --runInBand`
- `cd server; pnpm exec tsc --noEmit`
- `cd web; pnpm exec vue-tsc --noEmit`

Manual smoke:

1. Create a tenant plan order and leave it pending.
2. Confirm it appears in the tenant plan recent orders section.
3. Continue payment from the pending row.
4. Create another pending plan order and cancel it.
5. Confirm the canceled row shows `closed` and `tenant_cancelled`.
6. Create a resource-pack order and cancel it from tenant resource-pack history.
7. Confirm platform order pages show close metadata.
8. Run the task target for timeout close and confirm old pending orders become closed.

## Acceptance Criteria

- Stale pending plan and resource-pack orders can be closed automatically.
- Tenants can cancel their own pending plan and resource-pack orders.
- Tenants can continue paying still-pending orders without creating duplicates.
- Platform admins can see pending and recently closed order risk metrics.
- Closed orders cannot be paid by dev confirmation or Alipay notify.
- Revenue reports remain based only on paid orders.
- No invoice, refund, recurring charge, SMS, or email functionality is added.
