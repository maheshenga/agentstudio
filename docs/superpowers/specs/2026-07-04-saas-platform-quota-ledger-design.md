# SaaS Platform Quota Ledger Design

## Goal

Add a platform operations view for SaaS quota ledger records so administrators can investigate quota grants and consumption across tenants.

## Context

The system now records quota changes in `saas_quota_ledger` and tenants can view their own recent ledger records from the tenant usage page. Platform operators still lack a global view to answer questions such as:

- Which tenant consumed a quota resource?
- Did a resource-pack payment grant quota?
- What was the resource balance after a ledger entry?
- Which source type or source id produced a quota change?

## Scope

This slice adds:

- A backend platform API for quota ledger pagination and filters.
- Platform API tests covering tenant/resource/change/source filters.
- Frontend API types and wrapper.
- A compact quota ledger section on the existing SaaS platform usage page.

## Out Of Scope

This slice does not add invoices, refunds, tax accounting, auto-renewal, provider polling, quota clawback, resource-pack expiry, CSV export, or manual ledger edits.

## Backend Design

`SaasQuotaService` remains the source of quota ledger mapping because it already owns quota mutations and tenant ledger listing.

Add a platform listing method that accepts:

- `page`
- `limit`
- `tenant_id`
- `resource_type`
- `change_type`
- `source_type`
- `source_id`

The method queries `SaasQuotaLedgerEntity.findAndCount`, orders by `createTime DESC, id DESC`, maps entity fields to snake_case response records, and clamps pagination to the existing `1..100` pattern.

`SaasPlatformService` delegates to `SaasQuotaService`. `SaasPlatformController` exposes:

```text
GET /api/saas/platform/quota-ledgers
```

The route runs outside tenant scope and uses `saas:usage:index`, because the page belongs to the platform usage operations surface.

## Frontend Design

Extend `web/src/api/saas.ts` with platform quota ledger params and response types.

Enhance `web/src/views/saas/platform/usage/index.vue` with:

- A compact `Quota ledger` section.
- Filters for tenant id, resource type, change type, source type, and source id.
- A recent ledger table with resource, tenant, change type, deltas, balance, source, and time.
- Pagination so operators can inspect more than the latest page of records.
- Refresh behavior integrated with the existing page refresh.

## Testing

Backend:

- Add `SaasQuotaService` tests for platform listing filters and response mapping.
- Add `SaasPlatformService` delegation test.
- Add `SaasPlatformController` route delegation test.

Frontend:

- Run `vue-tsc --noEmit`.
- Run full web build.

Final verification:

- Targeted Jest tests.
- Backend typecheck and build.
- Frontend build.
- `git diff --check`.
