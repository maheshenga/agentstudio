# Task 2 Report: Backend Controller and Module Wiring

## Outcome

Implemented the platform revenue overview wiring for SaaS, exposing `GET /api/saas/platform/revenue/overview` behind `saas:revenue:index` and running it outside tenant scope through the existing `TenantContext` helper.

## Files Updated

- `server/src/module/saas/saas.module.ts`
- `server/src/module/saas/saas-platform.controller.ts`
- `server/src/module/saas/saas-platform.controller.spec.ts`
- `server/src/module/saas/saas-platform.controller.imports.spec.ts`

## What Changed

### Module wiring

Added `SaasRevenueReportService` to the SaaS module `providers` and `exports` so the platform controller can inject the service and other modules can reuse it if needed.

### Controller route

Added `revenueOverview(@User() user: UserDto)` to `SaasPlatformController`:

- route: `GET /api/saas/platform/revenue/overview`
- permission: `saas:revenue:index`
- behavior: calls `SaasRevenueReportService.getOverview()`
- scope: executed via `runOutsideTenant(...)`
- response shape: wrapped with `ResultData.ok(data)`

### Controller tests

Extended the controller spec with:

- a mocked `SaasRevenueReportService`
- a provider binding for that mock
- a new test covering the revenue overview path and asserting the returned `data`

### Import assertion test

Updated the imports spec to verify the new service import and constructor injection are present in the controller source.

## Verification

Ran the following checks in `server`:

- `pnpm exec jest src/module/saas/saas-platform.controller.spec.ts --runInBand`
- `pnpm exec jest src/module/saas/saas-platform.controller.imports.spec.ts src/module/saas/services/saas-revenue-report.service.spec.ts --runInBand`
- `pnpm exec tsc -p tsconfig.json --noEmit`

All passed.

## Notes

- No invoice, refund, tax, or net-revenue logic was added.
- The route uses only the existing SaaS tables through the committed revenue report service.
