# SaaS Subscription Lifecycle Governance Design

## Goal

Add the next SaaS operations slice after plans, payments, resource packs, tenant usage, and platform usage overview:

- Automatically mark ended active subscriptions as expired.
- Surface near-expiry and expired subscription risk to platform admins.
- Show tenants clear renewal timing and renewal actions before or after expiry.

This turns the current payment-driven subscription activation flow into an operational lifecycle flow. It intentionally stays small: no auto-renewal charging, invoices, refunds, coupons, grace-period entitlements, dunning emails, SMS, or plan proration.

## Current State

The existing SaaS module already has the core data and workflow needed for this slice:

- `saas_subscription` stores `tenant_id`, `plan_id`, `billing_cycle`, `status`, `start_time`, `end_time`, and `cancel_at_period_end`.
- `SaasOrderService.confirmPaidOrder()` expires current active subscriptions and creates a new active subscription with a calculated `end_time`.
- `SaasTenantController.subscription()` returns the current tenant subscription and plan/trial summary.
- `SaasPlatformService.listSubscriptions()` supports paging plus `tenant_id`, `plan_id`, `plan_code`, and `status` filters.
- The monitor job framework supports registered `@Task()` handlers executed through `sa_job.invoke_target`.
- Frontend pages already exist:
  - `web/src/views/saas/platform/subscription/index.vue`
  - `web/src/views/saas/tenant/plan/index.vue`

The missing behavior is a daily lifecycle sweep, deadline-aware platform filtering, and tenant-facing renewal clarity.

## Scope

### Backend

1. Add a focused `SaasSubscriptionLifecycleService`.
2. Add a registered task, `saas.subscriptionLifecycle.sweep`, that:
   - Finds active subscriptions whose `end_time <= now`.
   - Marks them `expired`.
   - Leaves already expired/frozen/trialing rows unchanged.
   - Returns a compact summary for logs/tests.
3. Add platform lifecycle query support:
   - `expires_within_days`: active subscriptions ending within N days.
   - `expired_since_days`: expired subscriptions whose `end_time` is within the last N days.
   - `lifecycle_status`: derived filter aliases for `active`, `expiring`, `expired`.
4. Add lifecycle fields to subscription responses:
   - `days_until_expiry`
   - `is_expiring_soon`
   - `is_expired_by_time`
5. Add a platform lifecycle overview endpoint:
   - `GET /api/saas/platform/subscriptions/lifecycle/overview`
   - Returns counts for active, expiring in 7 days, expiring in 30 days, and expired.

### Frontend

1. Enhance platform subscription operations page:
   - Add quick filters for active, expiring soon, and expired.
   - Show expiry countdown and warning tags in the subscription table.
   - Add a compact lifecycle summary row above the tabs.
2. Enhance tenant plan page:
   - Show subscription end time and remaining days.
   - Show a warning state when renewal is needed soon.
   - Show an expired state when the subscription has passed its end time.
   - Keep renewal action wired to the existing upgrade order flow.

### Data

No new persistent tables are required for this slice.

No migration is required unless a menu/permission seed already uses migrations for SaaS menu changes. The implementation should first inspect the existing SaaS menu seed pattern. If needed, seed only the lifecycle overview permission and any menu metadata through the existing migration style.

## Non-Goals

- Automatic Alipay recurring payments.
- Charging stored payment methods.
- Invoice generation.
- Renewal reminder emails/SMS.
- Grace-period entitlement rules.
- Downgrades at period end.
- Cancel subscription APIs.
- Proration or remaining-time credits.
- Historical lifecycle event table.

These are valid future features, but they would expand this slice into billing automation.

## Domain Rules

### Expiry Sweep

The lifecycle sweep is idempotent.

For every subscription row where:

- `status = active`
- `end_time IS NOT NULL`
- `end_time <= now`

the service updates:

- `status = expired`
- `remark` appends or replaces with a concise lifecycle note when practical
- `update_time` is handled by TypeORM

The sweep must not update:

- rows with `end_time = null`
- already expired rows
- frozen rows
- trialing rows
- future active rows

### Expiring Soon

For UI and reporting, a subscription is expiring soon when:

- `status = active`
- `end_time` exists
- `0 <= days_until_expiry <= threshold`

Default threshold is 7 days for warnings. Platform filters may request 7, 14, or 30 days with an upper clamp of 365 days to avoid accidental broad scans.

### Expired by Time

Some rows may still be `active` even if `end_time` has passed because the sweep has not run yet. API response fields should expose this as `is_expired_by_time = true`. This lets the UI display a risk state immediately, while the scheduled task remains the source of persisted status cleanup.

### Renewal

Renewal is implemented through the existing tenant order flow:

- Tenant selects the same plan or a higher plan.
- `POST /api/saas/tenant/orders` creates an order.
- Payment confirmation reuses `SaasOrderService.confirmPaidOrder()`.
- Paid order immediately expires current active subscriptions and creates a fresh active subscription.

The existing rule that free plans cannot be purchased remains unchanged.

## Backend Design

### `SaasSubscriptionLifecycleService`

Add a new service under `server/src/module/saas/services/`.

Primary methods:

```ts
type LifecycleSweepResult = {
  checked_at: Date;
  expired_count: number;
  expired_subscription_ids: number[];
};

type LifecycleOverview = {
  active_count: number;
  expiring_7_days_count: number;
  expiring_30_days_count: number;
  expired_count: number;
};

sweepExpiredSubscriptions(now = new Date()): Promise<LifecycleSweepResult>
getLifecycleOverview(now = new Date()): Promise<LifecycleOverview>
decorateSubscriptionResponse(subscription): SubscriptionResponse
```

The service should use repository methods or query builders, depending on what is easiest to express safely with date comparisons. The update should be batch-oriented but return IDs for observability and tests.

### Task Registration

Add a `@Task()` method in the SaaS lifecycle service:

```ts
@Task({
  name: 'saas.subscriptionLifecycle.sweep',
  description: 'Expire ended SaaS subscriptions',
})
async sweepExpiredSubscriptionsTask() {
  return this.sweepExpiredSubscriptions();
}
```

The existing task registry can discover tasks from injectable services if the service is registered in `SaasModule`. A seed for `sa_job` is optional for this design; the task can also be run manually if an operator creates a cron job from the tool UI. If existing SaaS migrations already seed scheduled jobs, follow that pattern and add a daily cron, such as `0 5 0 * * *`.

### Platform Subscription APIs

Extend `SaasPlatformService.listSubscriptions()` to understand lifecycle filters:

- `lifecycle_status=expiring`
- `expires_within_days=7`
- `expired_since_days=30`

Filtering should combine predictably with existing filters:

- `tenant_id`, `plan_id`, and `plan_code` still narrow the result set.
- Explicit `status` takes precedence over `lifecycle_status` if both are supplied.
- `lifecycle_status=expiring` implies active subscriptions with a bounded `end_time`.

Add:

```http
GET /api/saas/platform/subscriptions/lifecycle/overview
```

Permission can reuse `saas:subscription:list` unless existing menu seed conventions require a separate `saas:subscription:lifecycle` slug.

### Tenant Subscription API

Enhance `GET /api/saas/tenant/subscription` response with:

- `days_until_expiry`
- `is_expiring_soon`
- `is_expired_by_time`

The existing response shape remains backward compatible.

## Frontend Design

### Platform Subscription Page

Enhance `web/src/views/saas/platform/subscription/index.vue`.

Add a lifecycle summary band above the tabs:

- Active
- Expiring in 7 days
- Expiring in 30 days
- Expired

Add quick filter buttons:

- All
- Active
- Expiring soon
- Expired

Add table columns:

- End time
- Remaining days
- Lifecycle tag

The table should continue to support existing text filters for tenant, plan, status, and order number.

### Tenant Plan Page

Enhance `web/src/views/saas/tenant/plan/index.vue`.

The current subscription summary should show:

- Current plan
- Status
- End time
- Remaining days
- Trial end time when relevant

Display states:

- Normal: active with more than 7 days remaining.
- Warning: active and expiring within 7 days.
- Expired: `subscription_status = expired` or `is_expired_by_time = true`.

Renewal action reuses the existing plan cards and order creation button. If the current plan is paid and expiring/expired, the current plan button should allow renewal instead of being disabled. Free plan remains non-purchasable.

## Error Handling

- Invalid lifecycle day filters return a bounded default instead of throwing when possible.
- Unknown `lifecycle_status` is ignored or treated as no lifecycle filter; implementation should follow the current query DTO style.
- Missing tenant context continues to return the existing `ResultData.fail(401, 'Tenant context is required')`.
- The sweep task should log failures through existing job logging. It should not partially fail the app startup.

## Testing

### Backend Unit Tests

Add tests for the lifecycle service:

- It expires active subscriptions with `end_time <= now`.
- It leaves future active subscriptions untouched.
- It leaves null-end subscriptions untouched.
- It leaves already expired/frozen/trialing subscriptions untouched.
- It returns a correct sweep summary.
- It calculates lifecycle overview counts.

Extend platform service/controller tests:

- Lifecycle overview route delegates outside tenant scope.
- `lifecycle_status=expiring` filters subscriptions by active status and end-time window.
- Decorated subscription responses include remaining days and warning flags.

Extend tenant controller tests:

- Tenant subscription response includes lifecycle fields.
- Expired-by-time is true when active status has a past end time.

### Frontend Verification

Run:

- `cd server; pnpm run test -- saas-subscription-lifecycle.service.spec.ts --runInBand`
- `cd server; pnpm run test -- saas-platform.service.spec.ts saas-platform.controller.spec.ts saas-tenant.controller.spec.ts --runInBand`
- `cd server; pnpm exec tsc --noEmit`
- `cd web; pnpm exec vue-tsc --noEmit`

Manual smoke:

1. Start MySQL, Redis, backend, and frontend.
2. Open `http://localhost:5731/#/saas-platform/subscriptions`.
3. Confirm lifecycle summary loads.
4. Use quick filters for expiring and expired subscriptions.
5. Open `http://localhost:5731/#/tenant-saas/plan`.
6. Confirm end time, remaining days, warning/expired state, and renewal action.

## Acceptance Criteria

- A daily-capable task can expire ended active subscriptions without changing unrelated rows.
- Platform admins can see lifecycle counts and filter subscriptions by expiring/expired state.
- Tenant users can see remaining subscription time and renew through the existing order/payment flow.
- Existing SaaS order activation, resource pack, usage overview, and plan management tests continue to pass.
- No new billing automation responsibilities are introduced in this slice.
