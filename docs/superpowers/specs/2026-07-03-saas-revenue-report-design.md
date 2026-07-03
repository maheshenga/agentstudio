# SaaS Revenue Report Design

Date: 2026-07-03

## Goal

Build a SaaS revenue report MVP for platform operators so they can understand commercial performance from the paid plan orders and resource-pack orders that already exist in the system.

This slice intentionally does not add invoice functionality. The user explicitly rejected invoices as a product direction for now, so invoices must not be included as a default SaaS roadmap item in this feature.

The first version is a cash-basis operating report: revenue is counted when an order is marked `paid`, using its `paidAt` time and stored amount in cents. It is not financial accounting, tax reporting, deferred revenue recognition, or a refund ledger.

## Current State

The SaaS module already includes:

- Tenant provisioning and self-service signup.
- SaaS plans, subscriptions, lifecycle status, and renewal cues.
- Paid plan upgrade and renewal orders.
- Resource-pack catalog, purchase orders, payment, and quota delivery.
- Platform pages for tenants, plans, subscriptions/orders, usage overview, resource packs, resource-pack orders, and Alipay config.
- A platform usage overview page that shows broad operational KPIs, including total paid revenue.

The remaining gap is a focused revenue report page. The current usage overview is useful for SaaS health, but it does not answer business questions such as:

- How much revenue came in today, this month, and cumulatively?
- How much revenue came from plan orders versus resource-pack orders?
- How many paid orders and paid tenants contributed to the period?
- What does the last 30 days of paid revenue look like?
- Which tenants generated the most paid revenue recently?

## Proposed Scope

Add one backend revenue overview API and one platform frontend report page.

Backend API:

- `GET /api/saas/platform/revenue/overview`
- Requires platform permission `saas:revenue:index`.
- Runs outside tenant filtering with the existing platform controller `TenantContext.run({ ignoreTenant: true })` pattern.
- Aggregates existing SaaS order tables only.

Frontend page:

- New page: `web/src/views/saas/platform/revenue/index.vue`.
- Intended route/menu path: `#/saas-platform/revenue`.
- Use Element Plus and the existing SaaS platform page conventions.
- Show KPI cards, period comparison, revenue split, 30-day trend table, and top tenant revenue table.

Menu and permission seed:

- Add a platform menu item under the SaaS platform group named `Revenue Report` or `经营报表`.
- Permission slug: `saas:revenue:index`.
- The page is platform-only and must not appear in tenant menus.

## Data Sources

Use existing entities and tables:

- `SaasOrderEntity`: paid plan order amounts, payment method, tenant ID, paid time, create time.
- `SaasResourcePackOrderEntity`: paid resource-pack order amounts, resource type, payment method, tenant ID, paid time, create time.
- `SaasSubscriptionEntity`: active subscription count and paid tenant cross-checks where useful.
- `SaasPlanEntity`: optional plan code/name enrichment for plan revenue breakdown.
- `sa_system_tenant` data if an existing tenant repository/service is already available in the SaaS module; otherwise display tenant IDs in the first MVP.

Do not add new database tables in this slice.

## Metric Definitions

Revenue metrics:

- `today_revenue_cents`: sum of paid plan and resource-pack order amounts where `paidAt` falls within the current local day.
- `month_revenue_cents`: sum of paid order amounts where `paidAt` falls within the current local month.
- `total_revenue_cents`: sum of all paid plan and resource-pack order amounts.
- `plan_revenue_cents`: sum of paid plan orders.
- `resource_pack_revenue_cents`: sum of paid resource-pack orders.

Order and tenant metrics:

- `today_paid_order_count`: paid plan and resource-pack orders paid today.
- `month_paid_order_count`: paid plan and resource-pack orders paid this month.
- `total_paid_order_count`: all paid plan and resource-pack orders.
- `month_paid_tenant_count`: distinct tenants with at least one paid order this month.
- `total_paid_tenant_count`: distinct tenants with at least one paid order ever.
- `active_subscription_count`: subscriptions with status `active`.

Derived metrics:

- `average_order_value_cents`: total paid revenue divided by total paid order count, rounded down to an integer. If no paid orders exist, return `0`.
- `month_average_order_value_cents`: monthly paid revenue divided by monthly paid order count, rounded down to an integer. If no monthly paid orders exist, return `0`.

Period boundaries:

- Use server-local day/month boundaries in this MVP.
- A later implementation can add explicit timezone selection if operators need it.

Revenue basis:

- Count only rows with `status = 'paid'`.
- Prefer `paidAt` for period aggregation.
- If a paid historical row has a missing `paidAt`, include it in total revenue but exclude it from day/month/trend buckets.
- Because no refund ledger exists yet, all values are gross paid revenue.

## API Shape

Return this shape:

```ts
export interface SaasRevenueOverview {
  kpis: {
    today_revenue_cents: number;
    month_revenue_cents: number;
    total_revenue_cents: number;
    plan_revenue_cents: number;
    resource_pack_revenue_cents: number;
    today_paid_order_count: number;
    month_paid_order_count: number;
    total_paid_order_count: number;
    month_paid_tenant_count: number;
    total_paid_tenant_count: number;
    active_subscription_count: number;
    average_order_value_cents: number;
    month_average_order_value_cents: number;
  };
  revenue_split: Array<{
    source: 'plan' | 'resource_pack';
    revenue_cents: number;
    order_count: number;
    percent: number;
  }>;
  daily_trend: Array<{
    date: string;
    plan_revenue_cents: number;
    resource_pack_revenue_cents: number;
    total_revenue_cents: number;
    paid_order_count: number;
  }>;
  top_tenants: Array<{
    tenant_id: number;
    tenant_name?: string;
    revenue_cents: number;
    order_count: number;
    last_paid_at?: Date;
  }>;
  recent_paid_orders: Array<{
    order_no: string;
    order_type: 'plan' | 'resource_pack';
    tenant_id: number;
    label: string;
    amount_cents: number;
    payment_method: string;
    paid_at?: Date;
  }>;
}
```

`percent` is a percentage from `0` to `100`, rounded to two decimals. If total revenue is `0`, all percentages are `0`.

`daily_trend` returns the most recent 30 calendar days including today, in ascending date order. Missing days are returned with zero values so the frontend can render a stable table or chart later.

## Backend Design

Add a focused service:

```ts
SaasRevenueReportService.getOverview(): Promise<SaasRevenueOverview>
```

Implementation notes:

- Keep revenue aggregation separate from `SaasPlatformService` so the already-large platform service does not keep growing.
- Inject repositories for `SaasOrderEntity`, `SaasResourcePackOrderEntity`, and `SaasSubscriptionEntity`.
- Optionally inject a tenant repository or use an existing tenant service if the module already has a clean pattern for tenant name lookup.
- Query paid plan orders and paid resource-pack orders. For the first MVP, service-level aggregation is acceptable and easier to test.
- Normalize both order types into an internal array with:
  - `orderNo`
  - `orderType`
  - `tenantId`
  - `amountCents`
  - `paymentMethod`
  - `paidAt`
  - display `label`
- Build KPI totals, revenue split, 30-day daily trend, top tenants, and recent paid orders from the normalized array.
- Sort recent paid orders by `paidAt DESC, orderNo DESC` and return the newest 10.
- Sort top tenants by `revenue_cents DESC, order_count DESC` and return the top 10.

Extend `SaasPlatformController` with:

```ts
@Get('revenue/overview')
@RequirePermission('saas:revenue:index')
revenueOverview(@User() user: UserDto)
```

The controller wraps the service call in the existing platform `runOutsideTenant` pattern and returns `ResultData.ok(data)`.

## Frontend Design

Extend `web/src/api/saas.ts` with:

```ts
export interface SaasRevenueOverview { ... }

export function fetchPlatformRevenueOverview() {
  return request.get<SaasRevenueOverview>({
    url: '/api/saas/platform/revenue/overview'
  })
}
```

Create `web/src/views/saas/platform/revenue/index.vue`:

- Header with page title and refresh button.
- KPI grid:
  - Today revenue
  - Month revenue
  - Total revenue
  - Month paid tenants
  - Month paid orders
  - Month average order value
- Revenue split section:
  - Plan revenue
  - Resource-pack revenue
  - Percent contribution
- Daily trend section:
  - The MVP can use an Element Plus table for the last 30 days.
  - A chart can be added later without changing the backend shape.
- Top tenants table:
  - Tenant ID/name
  - Revenue
  - Order count
  - Last paid time
- Recent paid orders table:
  - Order number
  - Type
  - Tenant
  - Label
  - Amount
  - Payment method
  - Paid time

Formatting rules:

- Money values display as yuan from backend cents.
- Empty states use `ElEmpty` inside each section.
- Loading state covers the page while fetching.
- The page stays quiet and operational, matching the existing admin dashboard style.

## Error Handling

Backend:

- Empty datasets return zero KPI values and empty arrays, except `daily_trend`, which still returns 30 zero-filled days.
- Paid rows with missing `paidAt` are counted in total revenue and recent orders only if they can be sorted consistently after dated paid rows.
- Unknown or deleted tenant names do not break the report; the response can omit `tenant_name`.
- Missing plan/resource-pack labels fall back to the stored plan code or resource-pack code.

Frontend:

- Failed requests show `ElMessage.error('Load revenue report failed')`.
- If refresh fails after initial data loaded, keep the previous data visible.
- Undefined optional fields display as `-`.

## Testing

Backend tests:

- `SaasRevenueReportService.getOverview` returns zero KPI values and a 30-day zero trend for empty datasets.
- It aggregates plan and resource-pack paid revenue correctly.
- It excludes pending/cancelled orders from revenue.
- It includes paid rows without `paidAt` in total revenue but excludes them from today/month/trend buckets.
- It computes average order values and revenue split percentages safely.
- It returns top tenants and recent paid orders in deterministic order.
- `SaasPlatformController.revenueOverview` delegates through platform tenant isolation and returns `ResultData.ok`.

Frontend verification:

- `pnpm exec vue-tsc --noEmit` passes.
- The page references only typed API fields.
- The route/page loads with empty API data without layout breakage.

Full verification:

- Backend target tests pass.
- Backend full Jest suite passes.
- Backend typecheck passes.
- Frontend typecheck passes.

## Out Of Scope

- Invoice application or invoice management.
- Refund processing and refund deduction.
- Net revenue after refunds.
- Tax reporting.
- Deferred revenue recognition.
- Export to CSV or Excel.
- Multi-currency conversion.
- Advanced BI dashboards.
- Revenue forecast.
- Tenant health scoring.
- Automatic notification jobs.
- New database tables.
