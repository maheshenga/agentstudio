# SaaS Order And Payment Operations Design

## Goal

Build the next SaaS operations slice on top of the existing resource-pack purchase flow:

- Tenant users can review their resource-pack order history and continue payment for pending orders.
- Platform admins can inspect resource-pack orders with a detail view and stronger filters.
- Platform admins can manage Alipay configuration from the UI without exposing secret values.

This slice turns the current working purchase flow into a repeatable operational workflow, while keeping refunds, invoices, exports, reconciliation, and advanced payment provider abstraction out of scope.

## Current Context

The SaaS module already has:

- Resource-pack catalog and order tables:
  - `saas_resource_pack`
  - `saas_resource_pack_order`
- Tenant resource-pack purchase UI:
  - `web/src/views/saas/tenant/resource-pack/index.vue`
- Platform resource-pack order list:
  - `web/src/views/saas/platform/resource-pack-order/index.vue`
- Payment entry points:
  - `POST /api/saas/payment/alipay/create`
  - `POST /api/saas/payment/dev-confirm`
  - `GET /api/saas/payment/alipay/config-status`
  - `POST /api/saas/payment/alipay/notify`
- Payment service currently reads Alipay settings from environment-backed Nest config.

The missing pieces are tenant order history, platform order detail, and writable payment configuration.

## Scope

### In Scope

1. Tenant resource-pack order history:
   - Add `GET /api/saas/tenant/resource-pack-orders`.
   - Support pagination and filters for status and resource-pack code.
   - Return the same order response shape already used by single-order lookup.
   - Tenant UI shows recent/paged orders and lets users continue pending payments.

2. Platform resource-pack order operations:
   - Add order number filtering to `GET /api/saas/platform/resource-pack-orders`.
   - Add optional single-order detail endpoint or reuse list row data with a detail drawer.
   - Platform UI adds a detail drawer with order, payment, delivery, tenant, and timestamps.

3. Alipay configuration management:
   - Create a dedicated `saas_payment_config` table.
   - Store one active Alipay config row for platform scope.
   - Add platform APIs to read masked status and save configuration.
   - Payment service reads database config first and falls back to environment config.
   - Private key and public key are accepted on save, but private key is never returned in plaintext.

4. Menus and permissions:
   - Add platform menu for Alipay configuration.
   - Add permission slugs for tenant order list and platform payment config read/update.
   - Seed/align migrations must work for existing local databases, not only fresh installs.

### Out Of Scope

- Refunds.
- Invoices.
- Exports/downloads.
- Alipay reconciliation jobs.
- Multiple concurrent payment providers.
- Per-tenant payment provider credentials.
- Encrypting secrets at rest with a KMS.
- Consumption priority or purchased-balance ledger.

## Data Model

### `saas_payment_config`

Dedicated table, because Alipay configuration includes sensitive key material and should not be treated like ordinary dictionary/config rows.

Fields:

- `id`: bigint primary key.
- `provider`: varchar(20), value `alipay`.
- `scope`: varchar(20), value `platform`.
- `enabled`: tinyint, `1` or `0`.
- `app_id`: varchar(64).
- `private_key`: text, nullable.
- `public_key`: text, nullable.
- `gateway_url`: varchar(255).
- `notify_url`: varchar(255).
- `return_url`: varchar(255).
- `remark`: varchar(255), nullable.
- `create_time`, `update_time`, `delete_time`.

Indexes:

- Unique active lookup by `provider` and `scope`.

Secret handling:

- `private_key` can be saved or replaced.
- API responses never return `private_key`.
- Status responses include `private_key_configured: boolean`.
- `app_id` is returned only as `app_id_masked`.
- `public_key` may be returned as configured/not configured, but not required to be displayed in full. The UI should treat both private and public key textareas as write-only by default.

## Backend Design

### Tenant Order History

Add service method:

```ts
SaasResourcePackOrderService.listTenantOrders(tenantId: number, query: SaasTenantResourcePackOrderListQuery)
```

Query fields:

- `page`
- `limit`
- `status`
- `resource_pack_code`

Behavior:

- Always filters by current tenant ID.
- Orders by `createTime DESC, id DESC`.
- Reuses `toResponse`.
- Limits page size to 100.

Add controller route:

```ts
GET /api/saas/tenant/resource-pack-orders
```

Permission seed:

- Existing `tenant:resource-pack-order:view` covers this route.

### Platform Order Operations

Extend platform order query with:

- `order_no`

The current list endpoint remains:

```ts
GET /api/saas/platform/resource-pack-orders
```

Add optional detail route if the UI needs a clean detail fetch:

```ts
GET /api/saas/platform/resource-pack-orders/:order_no
```

The service should return the same response shape as the list row, with no tenant secret data.

Permission seed:

- Existing `saas:resource-pack-order:list` covers list and detail for this slice.

### Alipay Config APIs

Create:

```ts
SaasPaymentConfigEntity
SaasPaymentConfigService
UpdateAlipayConfigDto
```

Routes under existing SaaS platform controller or a small payment-config controller:

```ts
GET /api/saas/platform/payment/alipay/config
PUT /api/saas/platform/payment/alipay/config
```

Read response:

```ts
{
  provider: 'alipay',
  enabled: boolean,
  configured: boolean,
  missing_keys: string[],
  app_id_masked: string,
  gateway_url: string,
  notify_url: string,
  return_url: string,
  private_key_configured: boolean,
  public_key_configured: boolean,
  remark?: string
}
```

Update request:

```ts
{
  enabled: boolean,
  app_id?: string,
  private_key?: string,
  public_key?: string,
  gateway_url?: string,
  notify_url?: string,
  return_url?: string,
  remark?: string
}
```

Update behavior:

- Empty `private_key` or `public_key` means keep existing key.
- A supplied non-empty key replaces the stored key.
- App ID, gateway URL, notify URL, and return URL update normally.
- `enabled=false` is allowed and makes the config unconfigured for payment creation.
- Responses never echo private key or public key.

Payment service resolution:

1. Try active database Alipay config.
2. If no database row exists, fall back to existing environment config.
3. Existing `GET /api/saas/payment/alipay/config-status` uses the same resolver, so tenant pages reflect platform config.

## Frontend Design

### Tenant Resource-Pack Page

Extend `web/src/views/saas/tenant/resource-pack/index.vue`.

Add:

- Order history section below resource-pack cards and current order panel.
- Filters:
  - status
  - resource-pack code
- Table columns:
  - order number
  - resource pack
  - quota
  - amount
  - status
  - paid time
  - delivered time
  - actions
- Actions for pending orders:
  - continue Alipay payment
  - local dev confirm

Interaction:

- Creating an order adds it to current order and refreshes order history.
- Confirming payment refreshes resource-pack list, usage-dependent data when present, current order, and order history.
- Continue payment uses existing `createAlipayPayment(orderNo, 'resource_pack')`.

### Platform Resource-Pack Order Page

Extend `web/src/views/saas/platform/resource-pack-order/index.vue`.

Add:

- Order number filter.
- Detail button column.
- Detail drawer with:
  - order number
  - tenant ID
  - resource pack code/name
  - resource type
  - quota
  - amount/currency
  - payment method
  - status
  - Alipay trade number
  - paid time
  - delivered time
  - create time

No export in this slice.

### Platform Alipay Config Page

Create:

```text
web/src/views/saas/platform/payment-config/index.vue
```

UI:

- Quiet admin form, not a landing page.
- Status panel:
  - enabled/configured
  - missing keys
  - masked App ID
  - notify and return URL configured flags
- Form:
  - enabled switch
  - app ID input
  - gateway URL input
  - notify URL input
  - return URL input
  - private key textarea
  - public key textarea
  - remark input
- Save button.

Secret UX:

- Private/public key fields are blank on load.
- Placeholder says leaving blank keeps the existing key.
- After save, fields clear again.

API wrappers in `web/src/api/saas.ts`:

```ts
fetchPlatformAlipayConfig()
updatePlatformAlipayConfig(params)
fetchTenantResourcePackOrders(params)
fetchPlatformResourcePackOrder(orderNo)
```

## Migrations And Permissions

Add migrations that are safe for existing local databases:

1. Create `saas_payment_config`.
2. Seed/align platform Alipay config menu:
   - menu code: `SaasPaymentConfig`
   - path: `payment-config`
   - component: `/saas/platform/payment-config`
3. Seed permission slugs:
   - `saas:payment-config:view`
   - `saas:payment-config:update`
4. Ensure tenant order list permission remains present:
   - `tenant:resource-pack-order:view`

Menu cache note:

- After migrations change `sa_system_menu`, the local Redis menu cache may need clearing.
- The implementation should clear menu cache from the migration only if a safe project helper exists; otherwise document `redis-cli DEL "sys_menu:<tenantId>:<userId>"` as local verification guidance.

## Error Handling

- Missing tenant context returns `ResultData.fail(401, 'Tenant context is required')`, matching existing SaaS controllers.
- Payment creation still rejects non-pending orders.
- Tenant order history never returns orders from another tenant.
- Platform order detail returns `null` or `404` style not found behavior consistently with existing controller patterns.
- Alipay config update validates string lengths and trims URL-like fields.
- Invalid key format is not deeply parsed on save; signature/payment creation remains the final correctness check.

## Testing

Backend TDD coverage:

- Tenant resource-pack order list filters by tenant and status.
- Tenant controller exposes order list route.
- Platform order list supports `order_no`.
- Platform order detail returns one order by order number.
- Payment config service masks secrets and preserves existing keys on blank update.
- Payment service prefers database config over environment config.
- Payment config controller read/update tests.
- Migrations assert table, menu, and permission SQL.

Frontend verification:

- `pnpm exec vue-tsc --noEmit`.
- Browser smoke:
  - tenant order history shows a created pending order.
  - pending history row can be locally confirmed.
  - platform detail drawer opens for the confirmed order.
  - payment config page loads, saves non-secret fields, and does not display secret key values.

## Acceptance Criteria

- Tenant can see resource-pack order history and continue pending payments.
- Platform can filter resource-pack orders by order number and inspect details.
- Platform can save Alipay config from UI.
- Tenant payment config status reflects DB config when present.
- Private key is never returned to the frontend.
- Existing resource-pack purchase and payment flow still works.
- Backend tests, backend typecheck, and frontend typecheck pass.
