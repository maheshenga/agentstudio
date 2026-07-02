# SaaS Plan Subscription Operations Design

## Goal

Build the next SaaS subscription slice on top of the existing tenant upgrade flow:

- Platform admins can manage sellable SaaS plans from the UI.
- Platform admins can configure plan quotas without editing seed data or code.
- Tenant users only see enabled plans and can create upgrade orders against backend prices.
- Paid upgrade orders activate the new subscription immediately, without remaining-time proration.
- Platform admins can inspect plan orders and subscriptions with stronger filters and detail views.

This slice turns the current seeded-plan upgrade flow into an operational plan management workflow. It intentionally excludes proration, delayed activation, auto-renewal, refunds, coupons, invoices, and multi-provider billing.

## Current Context

The SaaS module already has:

- Plan, quota, order, and subscription tables:
  - `saas_plan`
  - `saas_plan_quota`
  - `saas_order`
  - `saas_subscription`
- Tenant plan upgrade UI:
  - `web/src/views/saas/tenant/plan/index.vue`
- Platform plan page:
  - `web/src/views/saas/platform/plan/index.vue`
- Platform order and subscription pages:
  - `web/src/views/saas/platform/subscription/index.vue`
  - existing platform order API/listing support through `SaasPlatformService.listOrders`
- Upgrade order flow:
  - `POST /api/saas/tenant/orders`
  - `GET /api/saas/tenant/orders/:order_no`
  - `POST /api/saas/payment/dev-confirm`
  - `POST /api/saas/payment/alipay/create`
  - `POST /api/saas/payment/alipay/notify`
- Payment confirmation behavior in `SaasOrderService.confirmPaidOrder`:
  - marks active subscriptions as `expired`
  - creates a new active subscription
  - initializes tenant quota for the new plan

The missing pieces are platform-managed plans, quota editing, stronger order/subscription operations, and explicit subscription switching rules.

## Scope

### In Scope

1. Platform plan management:
   - List plans with pagination and filters.
   - Create plans.
   - Update plan name, billing cycle default, monthly price, yearly price, status, sort, and remark.
   - Enable or disable plans.
   - Read one plan with quota details.

2. Platform plan quota management:
   - Edit quota rows for a plan.
   - Supported resource types stay aligned with existing quota/resource usage conventions:
     - `ai_calls`
     - `tokens`
     - `storage_mb`
     - `rag_documents`
   - Saving quota configuration replaces the plan quota set for the supplied resource types.

3. Tenant plan catalog and upgrade flow:
   - Tenant plan list returns only enabled plans.
   - Tenant plan list includes quota summaries for display.
   - Upgrade orders always calculate prices from backend plan config.
   - Disabled plans cannot be ordered.
   - Free plan cannot be ordered as a paid upgrade.

4. Immediate subscription activation:
   - A paid upgrade order expires current active subscriptions immediately.
   - A paid upgrade order creates a new active subscription immediately.
   - Monthly end time is payment time plus one month.
   - Yearly end time is payment time plus one year.
   - Re-purchasing the same plan opens a new cycle immediately; it is not treated as renewal extension in this slice.

5. Platform order and subscription operations:
   - Platform order list supports order number and plan code filters.
   - Platform order detail endpoint returns one order by order number.
   - Platform subscription list supports plan ID or plan code filters where practical.
   - Platform subscription detail view exposes tenant, plan, status, cycle, dates, and remarks.

6. Menus and permissions:
   - Align platform plan management menu and permissions if current seeds are incomplete.
   - Use existing SaaS platform menu structure.
   - Migrations must work for existing local databases.

### Out Of Scope

- Remaining-time proration.
- Delayed activation at current subscription expiry.
- Auto-renewal.
- Renewal extension semantics.
- Refunds.
- Coupons or promotions.
- Invoices.
- Multi-currency billing.
- Multiple payment providers.
- Per-tenant custom plan pricing.
- Plan versioning/history snapshots beyond order and subscription rows.

## Subscription Switching Rule

This stage uses immediate activation without proration.

When an upgrade order is paid:

1. If the order is already `paid`, return it idempotently and do not create another subscription.
2. If the order is not `pending`, reject payment confirmation.
3. Set the order status to `paid` and record `paid_at` and trade number.
4. Expire all current active subscriptions for the order tenant:
   - `status = expired`
   - `end_time = paid_at`
5. Create a new active subscription:
   - `tenant_id = order.tenantId`
   - `plan_id = order.planId`
   - `billing_cycle = order.billingCycle`
   - `status = active`
   - `start_time = paid_at`
   - `end_time = paid_at + 1 month` for monthly orders
   - `end_time = paid_at + 1 year` for yearly orders
   - `remark = Activated by order <orderNo>`
6. Initialize tenant quota from `saas_plan_quota` for the new plan.

There is no credit for unused time. This keeps the current implementation understandable and gives later proration work a clean, explicit boundary.

## Data Model

### `saas_plan`

Reuse the existing table.

Fields used by this stage:

- `id`
- `code`
- `name`
- `billing_cycle`
- `price_monthly`
- `price_yearly`
- `status`
- `sort`
- `remark`
- `create_time`
- `update_time`
- `delete_time`

Rules:

- `code` is immutable after creation in the UI.
- `code` must be unique.
- `status = 1` means sellable/visible to tenants.
- `status = 0` means hidden from tenants and not orderable.
- `free` is reserved as the default registration/initialization plan and cannot be ordered as a paid upgrade.

### `saas_plan_quota`

Reuse the existing table.

Expected fields are already represented by existing quota initialization logic:

- `plan_id`
- `resource_type`
- `quota_limit` or equivalent quota amount column currently used by `SaasQuotaService`
- status/sort/remark fields if present locally

Implementation must inspect the current entity before coding and use existing column names instead of inventing a new quota schema.

Quota save behavior:

- Save accepts an array of resource quota inputs for one plan.
- Each resource type is upserted for that plan.
- Omitted supported resource types are set to `0` or disabled only if the explicit API contract says so in the implementation plan.
- This design prefers explicit entries for all supported resource types to avoid accidental quota removal.

### `saas_order`

Reuse the existing table for plan upgrade orders.

Enhancements are service/API level unless a missing filter index becomes necessary. This stage does not add order lifecycle fields.

### `saas_subscription`

Reuse the existing table for active and historical subscriptions.

No new subscription status is introduced in this stage. The existing `active` and `expired` states are enough for immediate activation.

## Backend Design

### Plan Service

Extend `SaasPlanService` from a lookup helper into the authoritative plan catalog service.

Produce methods:

```ts
listPlatformPlans(query)
findPlatformPlan(code)
createPlatformPlan(dto)
updatePlatformPlan(code, dto)
updatePlatformPlanStatus(code, status)
updatePlatformPlanQuotas(code, quotas)
listTenantPlans()
```

Behavior:

- Platform list can show enabled and disabled plans.
- Tenant list only shows enabled plans.
- Tenant list includes quota summaries.
- `getPlanByCode` continues to enforce `status = 1` for order creation.
- Create/update validates prices as non-negative integers in cents.
- Create/update validates `billing_cycle` as `monthly` or `yearly`.
- Create validates code format with a conservative lowercase code rule.

### DTOs

Create DTOs for platform operations:

```ts
CreateSaasPlanDto
UpdateSaasPlanDto
UpdateSaasPlanStatusDto
UpdateSaasPlanQuotasDto
```

Validation rules:

- `code`: required on create, lowercase letters, digits, underscore, and hyphen only.
- `name`: required on create, max 100.
- `billing_cycle`: optional, `monthly` or `yearly`.
- `price_monthly`: optional non-negative integer.
- `price_yearly`: optional non-negative integer.
- `status`: `0` or `1`.
- `sort`: optional integer.
- `remark`: optional max 255.
- quota resource type: one of the supported resource types.
- quota amount: non-negative integer.

### Platform Controller

Add routes under `SaasPlatformController`:

```ts
GET /api/saas/platform/plans
POST /api/saas/platform/plans
GET /api/saas/platform/plans/:code
PUT /api/saas/platform/plans/:code
PUT /api/saas/platform/plans/:code/status
PUT /api/saas/platform/plans/:code/quotas
GET /api/saas/platform/orders/:order_no
GET /api/saas/platform/subscriptions/:id
```

Permissions:

- `saas:plan:list`
- `saas:plan:create`
- `saas:plan:update`
- `saas:plan:status`
- `saas:plan:quota:update`
- existing order/subscription list permissions can cover detail routes unless the existing permission model requires separate slugs.

### Order Service

Keep immediate activation behavior, but make it explicit and better tested.

Enhancements:

- Reject disabled plans at order creation through `getPlanByCode` or equivalent status check.
- Reject `free` plan upgrade orders.
- Preserve idempotency for already-paid orders.
- Add tests for same-plan repurchase immediate cycle behavior.

### Platform Order And Subscription Operations

Extend `SaasPlatformService`:

```ts
listOrders({ order_no, plan_code, tenant_id, status, page, limit })
findOrder(orderNo)
listSubscriptions({ tenant_id, plan_id, plan_code, status, page, limit })
findSubscription(id)
```

If filtering subscriptions by `plan_code` cannot be expressed cleanly with the current repository calls, use a query builder or resolve `plan_code` to `plan_id` before querying.

## Frontend Design

### Platform Plan Page

Replace the current static `web/src/views/saas/platform/plan/index.vue` data with real API data.

UI:

- Dense admin table, not a marketing page.
- Filters:
  - plan code/name keyword
  - status
- Columns:
  - code
  - name
  - billing cycle
  - monthly price
  - yearly price
  - status
  - sort
  - remark
  - update time
  - actions
- Actions:
  - create
  - edit
  - enable/disable
  - configure quotas

Plan form:

- code input disabled on edit
- name
- billing cycle select
- monthly price input in yuan, converted to cents for API
- yearly price input in yuan, converted to cents for API
- status switch
- sort number input
- remark textarea

Quota dialog:

- one row per supported resource type
- number input for amount
- clear labels for units, e.g. storage is MB
- save updates plan quotas

### Tenant Plan Page

Enhance `web/src/views/saas/tenant/plan/index.vue`.

Changes:

- Plan cards show quota summaries.
- Disabled plans are absent because tenant API filters them out.
- Free plan is shown as current/default when applicable but cannot create a paid upgrade order.
- Upgrade button remains disabled for current plan.
- Payment success refreshes subscription and quotas.

### Platform Orders And Subscriptions

Enhance existing pages rather than creating new major surfaces.

Orders:

- order number filter
- plan code filter
- detail drawer

Subscriptions:

- plan filter
- detail drawer
- status tags for active/expired

## Migrations And Permissions

If current local databases already have the tables, migrations should only align menus and permissions.

Migration requirements:

- Add missing plan management permissions idempotently.
- Ensure platform plan menu points to `/saas/platform/plan`.
- Preserve existing menu IDs and do not duplicate menu rows.

Menu cache note:

- After menu migrations, local Redis menu cache may need clearing, e.g. `redis-cli DEL sys_menu:1:1`.

## Error Handling

- Missing tenant context returns the existing `ResultData.fail(401, 'Tenant context is required')` pattern.
- Creating a plan with duplicate code returns a clear bad request or conflict error.
- Creating an upgrade order for a disabled plan returns not found or bad request consistently with current service style.
- Creating an upgrade order for the free plan returns a bad request.
- Updating quotas for an unknown plan returns not found.
- Invalid quota resource type returns bad request.
- Payment confirmation for non-pending orders remains rejected except already-paid idempotency.

## Testing

Backend TDD coverage:

- Platform plan list supports filters and pagination.
- Platform plan create rejects duplicate or invalid code.
- Platform plan update preserves code and updates editable fields.
- Platform plan status update toggles tenant visibility.
- Plan quota update persists supported resource amounts.
- Tenant plan list excludes disabled plans and includes quotas.
- Upgrade order rejects disabled and free plans.
- Paid upgrade immediately expires old subscription and creates a new active subscription.
- Paid same-plan order starts a new cycle immediately instead of extending the old one.
- Platform order list supports order number and plan code filters.
- Platform order/subscription detail routes delegate to service methods.
- Menu migration inserts required plan permissions idempotently.

Frontend verification:

- `pnpm exec vue-tsc --noEmit`.
- Browser smoke:
  - platform plan page loads real data.
  - platform admin can create or edit a non-free plan.
  - platform admin can update quotas.
  - disabled plan disappears from tenant plan page.
  - tenant can create and locally confirm an upgrade order for an enabled paid plan.
  - subscription page shows the new active subscription.

## Acceptance Criteria

- Platform plans are managed through backend APIs and UI, not static frontend arrays.
- Plan quotas are editable from platform UI.
- Tenant plan catalog only shows enabled plans and includes quota summaries.
- Free plan cannot be purchased as an upgrade order.
- Disabled plans cannot be ordered.
- Paid upgrade orders immediately activate the new subscription and expire old active subscriptions.
- Platform admins can filter and inspect plan orders and subscriptions.
- Backend tests, backend typecheck, frontend typecheck, migrations, and browser smoke pass.
