# SaaS Resource Pack Foundation Design

Date: 2026-07-03

## Goal

Add the foundation for SaaS resource packs so the platform can define extra purchasable quota products and tenants can view the packs available for purchase.

This slice covers definition and discovery only:

- Platform resource pack list API
- Platform resource pack management page shell
- Tenant available resource pack list API
- Tenant resource pack catalog page
- Seeded resource pack examples for AI calls, tokens, storage, and RAG documents

This slice does not cover:

- Creating resource-pack purchase orders
- Alipay payment for resource packs
- Resource-pack balance delivery after payment
- Quota consumption priority between plan quota and purchased packs
- Refunds, invoices, or resource-pack expiry automation

## Current State

The SaaS system already has plans, quotas, subscriptions, orders for plan upgrades, Alipay payment support, tenant usage display, and AI quota consumption.

The remaining gap for the next commercial step is that tenants can consume plan quota but cannot see or buy add-on quota packs.

Existing code boundaries to reuse:

- Backend SaaS module under `server/src/module/saas`
- Platform APIs under `SaasPlatformController`
- Tenant APIs under `SaasTenantController`
- Frontend SaaS API wrappers in `web/src/api/saas.ts`
- Frontend platform pages under `web/src/views/saas/platform`
- Frontend tenant pages under `web/src/views/saas/tenant`
- Backend menu seeding in `1760000000001-SeedSaasFoundationData.ts`

## Product Behavior

Platform operator can open a resource-pack page and see seeded packs:

- AI call pack
- Token pack
- Storage pack
- RAG document pack

Each pack shows:

- pack code
- pack name
- resource type
- quota amount
- price in cents
- status
- sort order
- description

Tenant owner/admin can open a resource-pack catalog page and see only active packs, sorted by resource type and sort order.

The tenant catalog has purchase buttons disabled or marked as upcoming because actual resource-pack order and payment are outside this slice.

## Data Model

Add table `saas_resource_pack`.

Fields:

- `id`
- `code`
- `name`
- `resource_type`
- `quota_amount`
- `price_cents`
- `currency`
- `status`
- `sort`
- `remark`
- `create_time`
- `update_time`
- `delete_time`

Rules:

- `code` is unique.
- `resource_type` uses the same quota keys as `saas_tenant_resource`: `ai_calls`, `tokens`, `storage_mb`, `rag_documents`.
- `quota_amount` is stored as integer units.
- `price_cents` is stored as integer cents.
- `status = 1` means visible and purchasable later.
- Deleted records are ignored by list APIs.

No tenant ownership is stored in this table. It is a platform catalog.

## Backend Design

Create:

- `SaasResourcePackEntity`
- `SaasResourcePackService`
- resource pack list DTO/query type if needed
- migration to create `saas_resource_pack`
- migration or extension seed to insert starter packs

Extend:

- `SaasModule` imports/exports
- `SaasPlatformController`
- `SaasTenantController`

APIs:

- `GET /api/saas/platform/resource-packs`
  - platform permission: `saas:resource-pack:index`
  - supports pagination, `status`, and `resource_type`
  - runs with `ignoreTenant: true`

- `GET /api/saas/tenant/resource-packs`
  - requires tenant context
  - returns active packs only
  - no tenant-specific filtering yet

Response shape:

```json
{
  "id": 1,
  "code": "ai_calls_1k",
  "name": "AI Calls 1,000",
  "resource_type": "ai_calls",
  "quota_amount": 1000,
  "price_cents": 9900,
  "currency": "CNY",
  "status": 1,
  "sort": 10,
  "remark": "Adds 1,000 AI calls"
}
```

## Frontend Design

Extend `web/src/api/saas.ts` with:

- `SaasResourcePackRecord`
- `fetchPlatformResourcePacks(params)`
- `fetchTenantResourcePacks()`

Create platform page:

- `web/src/views/saas/platform/resource-pack/index.vue`
- Dense table view, matching current SaaS platform pages
- Filters: resource type, status
- No create/edit modal in this slice unless the existing implementation is trivial; seeded catalog is enough for foundation.

Create tenant page:

- `web/src/views/saas/tenant/resource-pack/index.vue`
- Resource pack catalog grouped visually by resource type
- Shows quota amount and price
- Purchase button disabled with text `即将开放`

Menu seed additions:

- Platform menu under SaaS management: `Resource Packs`
- Tenant menu under subscription service: `Resource Packs`
- Permissions:
  - `saas:resource-pack:index`
  - `tenant:resource-pack:view`

## Testing

Backend unit tests:

- platform list returns paginated packs and respects filters
- tenant list returns only active packs
- platform API uses `ignoreTenant`

Migration tests:

- resource-pack table creation migration contains unique `code`
- seed migration inserts starter packs and menu permissions idempotently

Frontend verification:

- `pnpm exec vue-tsc --noEmit`
- Open platform resource-pack page and confirm table renders
- Open tenant resource-pack page and confirm active packs render

Backend verification:

- `pnpm exec jest --runInBand`
- `pnpm exec tsc --noEmit`

## Risks And Decisions

The biggest design decision is to keep this slice catalog-only. That avoids mixing three concerns:

- defining what can be bought
- collecting money
- applying purchased quota to runtime consumption

The next slice can add resource-pack orders and reuse the existing `SaasOrderEntity` by adding `order_type` and source object fields, or introduce a dedicated resource-pack order path if that proves cleaner.

## Out Of Scope

- Buying resource packs
- Paying for resource packs
- Delivering purchased quota
- Expiring resource packs
- Consumption priority across plan quota and resource-pack balance
- Platform create/edit forms beyond seeded catalog display
