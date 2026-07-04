# SaaS Platform Usage Overview Design

Date: 2026-07-03

## Goal

Build a real platform SaaS usage overview for `#/saas-platform/usage` so platform operators can see whether the SaaS business is healthy without opening every operational page one by one.

This slice turns the existing empty platform usage page into an operational dashboard backed by real SaaS tables. It does not add invoices, refunds, auto-renewal, subscription reminder jobs, exports, charts beyond simple in-page summaries, or a new analytics warehouse.

## Current State

The SaaS module already includes:

- Tenant provisioning and self-service signup.
- SaaS plans, plan quotas, subscriptions, trials, tenant resources.
- Paid plan upgrade orders and Alipay payment flow.
- Resource pack catalog, purchase orders, and quota delivery.
- Platform pages for tenants, plans, subscriptions/orders, resource packs, resource-pack orders, and Alipay config.
- Tenant pages for plans, usage, and resource packs.

The gap is `web/src/views/saas/platform/usage/index.vue`: it is only a static empty state and says no platform usage API exists yet.

## Proposed Scope

Add one backend overview API and one frontend dashboard page.

Backend API:

- `GET /api/saas/platform/usage/overview`
- Requires platform permission `saas:usage:index`.
- Must run outside tenant filtering with `TenantContext.run({ ignoreTenant: true })` from the platform controller.
- Aggregates existing operational tables only.

Frontend page:

- Replace the static empty state at `web/src/views/saas/platform/usage/index.vue`.
- Use Element Plus and current admin-page conventions.
- Show KPI cards, quota summaries, plan distribution, and recent orders.

## Data Sources

Use existing entities and tables:

- `SaasSubscriptionEntity`: active/trialing/expired subscription counts and plan distribution.
- `SaasOrderEntity`: plan order count, paid amount, pending count, recent plan orders.
- `SaasResourcePackOrderEntity`: resource-pack paid amount, pending count, recent resource-pack orders.
- `SaasTenantResourceEntity`: total quota, used quota, remaining quota by resource type.
- `SaasPlanEntity`: map plan IDs to plan code/name for distribution display.

Do not add new tables in this slice.

## API Shape

Return this shape:

```ts
export interface SaasPlatformUsageOverview {
  kpis: {
    active_subscriptions: number;
    trialing_subscriptions: number;
    expired_subscriptions: number;
    pending_plan_orders: number;
    pending_resource_pack_orders: number;
    paid_plan_order_amount_cents: number;
    paid_resource_pack_order_amount_cents: number;
    total_paid_amount_cents: number;
  };
  quota_summary: Array<{
    resource_type: string;
    total_quota: number;
    used_quota: number;
    remaining_quota: number;
    usage_rate: number;
  }>;
  plan_distribution: Array<{
    plan_id: number;
    plan_code: string;
    plan_name: string;
    active_count: number;
  }>;
  recent_plan_orders: Array<{
    order_no: string;
    tenant_id: number;
    plan_code: string;
    billing_cycle: string;
    amount_cents: number;
    status: string;
    paid_at?: Date;
    create_time?: Date;
  }>;
  recent_resource_pack_orders: Array<{
    order_no: string;
    tenant_id: number;
    resource_pack_code: string;
    resource_type: string;
    amount_cents: number;
    status: string;
    paid_at?: Date;
    create_time?: Date;
  }>;
}
```

`usage_rate` is a percentage from `0` to `100`, rounded to two decimals. If `total_quota` is `0`, the usage rate is `0`.

## Backend Design

Extend `SaasPlatformService` with:

```ts
getUsageOverview(): Promise<SaasPlatformUsageOverview>
```

Implementation notes:

- Inject repositories for `SaasTenantResourceEntity` and `SaasResourcePackOrderEntity` if they are not already injected.
- Use repository `find` in this slice instead of raw SQL unless aggregation becomes too slow. The local data volume and testability favor simple service-level aggregation.
- Count subscriptions by status in memory from the subscription rows.
- Sum paid plan order amount from `SaasOrderEntity` rows with `status = 'paid'`.
- Sum paid resource-pack order amount from `SaasResourcePackOrderEntity` rows with `status = 'paid'`.
- Count pending rows with `status = 'pending'`.
- Build quota summaries by grouping `SaasTenantResourceEntity.resourceType`.
- Build plan distribution from active subscriptions grouped by `planId`, then map plan ID to code/name from `SaasPlanEntity`.
- Recent plan orders use the newest five `SaasOrderEntity` rows ordered by `createTime DESC, id DESC`.
- Recent resource-pack orders use the newest five `SaasResourcePackOrderEntity` rows ordered by `createTime DESC, id DESC`.

Extend `SaasPlatformController` with:

```ts
@Get('usage/overview')
@RequirePermission('saas:usage:index')
usageOverview(@User() user: UserDto)
```

The controller wraps the service call in the existing platform `TenantContext.run` pattern and returns `ResultData.ok(data)`.

## Frontend Design

Extend `web/src/api/saas.ts` with:

```ts
export interface SaasPlatformUsageOverview {
  kpis: {
    active_subscriptions: number
    trialing_subscriptions: number
    expired_subscriptions: number
    pending_plan_orders: number
    pending_resource_pack_orders: number
    paid_plan_order_amount_cents: number
    paid_resource_pack_order_amount_cents: number
    total_paid_amount_cents: number
  }
  quota_summary: Array<{
    resource_type: string
    total_quota: number
    used_quota: number
    remaining_quota: number
    usage_rate: number
  }>
  plan_distribution: Array<{
    plan_id: number
    plan_code: string
    plan_name: string
    active_count: number
  }>
  recent_plan_orders: Array<{
    order_no: string
    tenant_id: number
    plan_code: string
    billing_cycle: string
    amount_cents: number
    status: string
    paid_at?: string | Date
    create_time?: string | Date
  }>
  recent_resource_pack_orders: Array<{
    order_no: string
    tenant_id: number
    resource_pack_code: string
    resource_type: string
    amount_cents: number
    status: string
    paid_at?: string | Date
    create_time?: string | Date
  }>
}

export function fetchPlatformUsageOverview() {
  return request.get<SaasPlatformUsageOverview>({
    url: '/api/saas/platform/usage/overview'
  })
}
```

Replace `web/src/views/saas/platform/usage/index.vue` with:

- Header with refresh button.
- KPI grid:
  - Active subscriptions
  - Trialing subscriptions
  - Total paid revenue
  - Pending orders
- Quota summary table with usage progress bars.
- Plan distribution table.
- Two recent-order tables: plan orders and resource-pack orders.

Formatting rules:

- Money values display as yuan from backend cents.
- Quota values use compact integer formatting.
- Empty states should use `ElEmpty` inside each table section, not a full-page empty state.
- The page remains an admin dashboard, not a marketing page.

## Error Handling

Backend:

- Empty datasets return zero counts and empty arrays.
- Missing plans in plan distribution display `unknown` code/name instead of throwing.
- The overview API must not depend on current tenant context.

Frontend:

- Loading state covers the page while fetching.
- Failed request shows `ElMessage.error('Load usage overview failed')` and keeps existing data if present.
- Refresh button reuses the same load function.

## Testing

Backend tests:

- `SaasPlatformService.getUsageOverview` returns zero values for empty datasets.
- It aggregates subscription statuses, order amounts, pending counts, quota summaries, and plan distribution correctly.
- It returns recent plan/resource-pack orders in response shape.
- `SaasPlatformController.usageOverview` delegates through platform context and returns `ResultData.ok`.

Frontend verification:

- `pnpm exec vue-tsc --noEmit` passes.
- The page references only typed API fields.

Full verification:

- Backend target tests pass.
- Backend full Jest suite passes.
- Backend typecheck passes.
- Frontend typecheck passes.

## Out Of Scope

- Invoices.
- Refunds.
- Auto-renewal.
- Subscription expiry jobs.
- Payment failure reminder jobs.
- CSV export.
- Revenue trend charts by day/month.
- Tenant health scoring.
- New database tables.