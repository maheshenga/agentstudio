# SaaS Resource Pack Purchase Design

Date: 2026-07-03

## Goal

Add a complete tenant purchase flow for SaaS resource packs: create a resource-pack order, initiate Alipay payment, confirm payment, and deliver purchased quota to the tenant's existing resource totals.

This slice turns the existing resource-pack catalog into a usable commercial flow while keeping the implementation narrow.

## Current State

The SaaS system already has:

- Tenant plans, subscriptions, and plan upgrade orders.
- Alipay page payment creation and notify verification.
- Tenant quota rows in `saas_tenant_resource`.
- Active resource-pack catalog records in `saas_resource_pack`.
- Tenant resource-pack catalog page with disabled purchase buttons.

The current upgrade order flow is plan-specific. `saas_order` stores `plan_id`, `plan_code`, and `billing_cycle`, and payment confirmation activates a subscription plus initializes plan quota. Resource-pack purchases should not reuse that entity directly because payment success must deliver extra resource quota instead of changing the tenant's plan.

## Product Behavior

Tenant user flow:

1. Tenant opens `/tenant-saas/resource-packs`.
2. Tenant clicks buy on an active resource pack.
3. Backend creates a pending resource-pack order using server-side pack price and quota values.
4. Tenant starts Alipay payment for that order.
5. If Alipay is not configured, the UI shows the existing sandbox configuration message.
6. If Alipay is configured, the UI opens the payment URL and polls the order status.
7. When payment is confirmed by dev confirm or Alipay notify, the tenant's matching `saas_tenant_resource.total_quota` increases by the purchased pack amount.
8. Repeated payment confirmations are idempotent and do not add quota twice.

Platform behavior:

- Platform can list resource-pack orders for operations support.
- Platform can filter by tenant, pack code, resource type, and status.

## Scope

Included:

- Dedicated resource-pack order table and entity.
- Tenant API to create resource-pack orders.
- Tenant API to read a resource-pack order by order number.
- Payment service support for resource-pack orders.
- Alipay notify routing for resource-pack order payment confirmation.
- Dev confirmation for local testing.
- Quota delivery by incrementing `saas_tenant_resource.total_quota`.
- Tenant resource-pack page buttons wired to order and payment flow.
- Platform resource-pack order list API and a dedicated platform table page.

Not included:

- Refunds.
- Invoices.
- Resource-pack expiry dates.
- Separate purchased balance buckets.
- Consumption priority between plan quota and purchased quota.
- Partial delivery.
- Platform create/edit UI for resource packs.

## Data Model

Add table `saas_resource_pack_order`.

Fields:

- `id`
- `order_no`
- `tenant_id`
- `resource_pack_id`
- `resource_pack_code`
- `resource_pack_name`
- `resource_type`
- `quota_amount`
- `amount_cents`
- `currency`
- `payment_method`
- `status`
- `alipay_trade_no`
- `paid_at`
- `delivered_at`
- `remark`
- `create_time`
- `update_time`
- `delete_time`

Rules:

- `order_no` is unique.
- Resource-pack order numbers use prefix `RPO` to distinguish them from plan order numbers.
- Pack price and quota are copied into the order at creation time. Later catalog edits must not mutate existing orders.
- Only active packs (`status = 1`) can be purchased.
- Only pending orders can be paid.
- A paid order with `delivered_at` already set must not deliver quota again.

Delivery target:

- Use existing `saas_tenant_resource` rows.
- On successful resource-pack payment, find the row where:
  - `tenant_id = order.tenant_id`
  - `resource_type = order.resource_type`
- If it exists, increase `total_quota` by `order.quota_amount`, keep `used_quota` unchanged, and set `status = 1`.
- If it does not exist, create it with `total_quota = order.quota_amount`, `used_quota = 0`, and `status = 1`.

This deliberately avoids a separate balance ledger in this slice. A later slice can introduce a ledger if expiry, refunds, or purchased-balance reporting become required.

## Backend Design

Create:

- `SaasResourcePackOrderEntity`
- `CreateResourcePackOrderDto`
- `SaasResourcePackOrderService`
- migration for `saas_resource_pack_order`

Extend:

- `SaasModule` to register the new entity and service.
- `SaasTenantController` with resource-pack order endpoints.
- `SaasPlatformController` and `SaasPlatformService` with resource-pack order listing.
- `SaasPaymentService` so it can create Alipay page-pay URLs for either plan orders or resource-pack orders.
- `SaasPaymentController` so dev confirm and Alipay notify can confirm the correct order type.
- Seed migration with a platform permission for resource-pack order list and tenant permissions for create/view/pay.

Tenant APIs:

- `POST /api/saas/tenant/resource-pack-orders`
  - body: `{ "resource_pack_code": "tokens_1m", "payment_method": "alipay" }`
  - creates a pending order using server-side pack values
  - requires tenant context

- `GET /api/saas/tenant/resource-pack-orders/:order_no`
  - returns the tenant's order
  - requires tenant context

Payment APIs:

- Keep current endpoints:
  - `POST /api/saas/payment/alipay/create`
  - `POST /api/saas/payment/dev-confirm`
  - `POST /api/saas/payment/alipay/notify`
- Extend request bodies with optional `order_type`.
- Default `order_type` is `plan` for backward compatibility.
- Resource-pack payment requests use `order_type = "resource_pack"`.

Platform API:

- `GET /api/saas/platform/resource-pack-orders`
  - supports pagination, `tenant_id`, `resource_pack_code`, `resource_type`, and `status`
  - runs outside tenant scope with `ignoreTenant: true`
  - permission: `saas:resource-pack-order:list`

Menu additions:

- Platform menu path: `/saas-platform/resource-pack-orders`
- Platform component: `/saas/platform/resource-pack-order`
- Tenant permissions:
  - `tenant:resource-pack-order:create`
  - `tenant:resource-pack-order:view`
  - `tenant:resource-pack-order:pay`

Response shape for tenant order:

```json
{
  "order_no": "RPO20260703120000001000001",
  "resource_pack_code": "tokens_1m",
  "resource_pack_name": "Tokens 1,000,000",
  "resource_type": "tokens",
  "quota_amount": 1000000,
  "amount_cents": 19900,
  "currency": "CNY",
  "payment_method": "alipay",
  "status": "pending",
  "alipay_trade_no": null,
  "paid_at": null,
  "delivered_at": null
}
```

## Payment Design

The Alipay signing logic should remain centralized in `SaasPaymentService`.

The service should resolve payable order details through a small internal shape:

```ts
type SaasPayableOrder = {
  orderNo: string;
  amountCents: number;
  subject: string;
};
```

For plan orders:

- subject: `SaaS plan ${planCode}`

For resource-pack orders:

- subject: `SaaS resource pack ${resourcePackCode}`

Alipay notify receives only `out_trade_no`, so the system needs deterministic routing:

- If order number starts with `RPO`, confirm it through `SaasResourcePackOrderService`.
- Otherwise, confirm through the existing `SaasOrderService`.

## Frontend Design

Extend `web/src/api/saas.ts` with:

- `createTenantResourcePackOrder(params)`
- `fetchTenantResourcePackOrder(orderNo)`
- updated payment helpers that accept optional `order_type`
- platform resource-pack order list wrapper

Create platform page:

- `web/src/views/saas/platform/resource-pack-order/index.vue`
- Table columns: order number, tenant ID, pack code, resource type, quota amount, amount, status, paid time, delivered time.
- Filters: tenant ID, pack code, resource type, status.

Update tenant resource-pack page:

- Enable the buy button.
- On click, create a resource-pack order.
- Show current pending order information.
- Start Alipay payment with `order_type = "resource_pack"`.
- Support local dev confirm with `order_type = "resource_pack"`.
- Poll order status after opening Alipay payment.
- Show paid/delivered status once complete.

The page should remain an operational SaaS UI, not a marketing checkout page. It should use compact cards, clear amounts, disabled/loading states, and direct actions.

## Testing

Backend unit tests:

- Creating a resource-pack order copies pack values from the catalog.
- Inactive or missing packs cannot be ordered.
- Confirming a resource-pack payment increments `saas_tenant_resource.total_quota`.
- Repeated confirmation for a paid/delivered order does not increment quota again.
- Alipay payment creation builds a resource-pack subject and amount.
- Alipay notify routes `RPO` orders to the resource-pack order service.
- Platform resource-pack order list respects filters and pagination.

Migration tests:

- `saas_resource_pack_order` has unique `order_no`.
- Seed migration adds resource-pack order permissions.

Frontend verification:

- `pnpm exec vue-tsc --noEmit`
- Tenant resource-pack page can create an order and call payment APIs with `order_type = "resource_pack"`.
- Platform resource-pack order list page type-checks.

Backend verification:

- `pnpm exec jest --runInBand`
- `pnpm exec tsc --noEmit`

## Risks And Decisions

Decision: use a dedicated resource-pack order table instead of extending `saas_order`.

Reason: current plan orders have plan-specific fulfillment. Resource-pack orders have a different fulfillment action and should remain independently testable.

Decision: deliver quota by increasing `saas_tenant_resource.total_quota`.

Reason: current runtime quota checks already use `saas_tenant_resource`, so this produces a real purchase-to-usage loop with the least new surface area.

Risk: direct quota increment does not preserve the source of purchased quota.

Mitigation: order records preserve purchase history. A future ledger can be added without changing the tenant-facing purchase flow.

Risk: Alipay notify only contains an order number.

Mitigation: use `RPO` prefix for resource-pack orders and keep existing `SO` plan order numbers unchanged.

## Out Of Scope

- Balance ledger.
- Expiry and renewal of purchased resource packs.
- Refunds and quota clawback.
- Invoices.
- Platform pack create/edit forms.
- Consumption priority reporting.
