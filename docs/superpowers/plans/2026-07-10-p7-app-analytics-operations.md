# P7 App Analytics And Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give platform administrators and tenant administrators trustworthy operational visibility into application installs, opens, failed opens, entitlement blockers, and version adoption without exposing secrets or weakening tenant isolation.

**Architecture:** Extend the existing app-open audit record with a sanitized outcome and fixed reason code, then aggregate bounded 7/30/90-day windows directly from MySQL. Platform analytics run with tenant filtering explicitly disabled; tenant analytics derive the tenant solely from authenticated context. The implementation intentionally uses request-time aggregation rather than a new warehouse, queue, or rollup table because P7 needs operational visibility at the current scale, not a separate analytics platform.

**Tech Stack:** NestJS 11, TypeORM, MySQL, class-validator, Jest, Vue 3, Element Plus, existing chart components, Vite readiness scripts.

---

## Global Constraints

- Platform analytics require `app:analytics:platform` and execute inside `TenantContext.run({ ignoreTenant: true })`.
- Tenant analytics require `app:analytics:tenant` and derive tenant identity only from `getTenantId()`; no tenant id is accepted from query, params, or body.
- Only 7, 30, or 90 day windows are accepted; the default is 30 days.
- Failed opens are audited with fixed reason codes and fixed safe messages. Raw exception text, request headers, tokens, cookies, authorization values, IP addresses, and user agents are never returned by analytics APIs.
- Audit writes are best effort. A logging failure must not convert a successful open into a failure or replace the original business exception.
- Unknown app codes remain auditable, so `app_open_log.app_id` becomes nullable and `app_code` is recorded independently.
- Entitlement blockers are exactly `missing_plan_module`, `missing_system_module`, and `system_module_unavailable`.
- Aggregate installs and opens independently before joining them to applications; avoid many-to-many joins that inflate counts.
- Per-app tenant adoption is capped at 100 rows and recent failure lists are capped at 20 rows.
- P7 does not add billing, invoices, revenue analytics, external telemetry, a data warehouse, or the P8 browser runtime API.
- Use `pnpm.cmd` in PowerShell.

## API Contract

```text
GET /api/app-analytics/platform/overview?days=30
GET /api/app-analytics/platform/apps/:code?days=30
GET /api/app-analytics/tenant/overview?days=30
```

Platform overview returns published apps, active and newly activated installs, open outcomes, entitlement blockers, unique tenants and users, success rate, daily trend, per-app metrics, and 20 sanitized failures.

Platform app detail returns app identity, summary metrics, daily trend, version adoption, up to 100 tenant-adoption rows, and 20 sanitized failures.

Tenant overview returns enabled installed apps, open outcomes, entitlement blockers, success rate, daily trend, installed-app usage, version adoption, and 20 sanitized failures for the authenticated tenant only.

## File Structure

Backend create:

- `server/src/migrations/1760000000036-AddAppOpenOutcomeAnalytics.ts`
- `server/src/migration-specs/add-app-open-outcome-analytics.spec.ts`
- `server/src/module/app/dto/app-analytics.dto.ts`
- `server/src/module/app/services/app-analytics.service.ts`
- `server/src/module/app/services/app-analytics.service.spec.ts`
- `server/src/module/app/app-analytics.controller.ts`
- `server/src/module/app/app-analytics.controller.spec.ts`
- `server/src/migrations/1760000000037-SeedAppAnalyticsMenus.ts`
- `server/src/migration-specs/seed-app-analytics-menus.spec.ts`

Backend modify:

- `server/src/module/app/entities/app-open-log.entity.ts`
- `server/src/module/app/services/app-tenant.service.ts`
- `server/src/module/app/services/app-tenant.service.spec.ts`
- `server/src/module/app/app.module.ts`

Frontend create:

- `web/src/api/app-analytics.ts`
- `web/src/views/app-platform/analytics/index.vue`
- `web/src/views/app-center/usage/index.vue`
- `web/scripts/verify-app-analytics-readiness.ts`

Frontend modify:

- `web/package.json`
- `docs/saas-launch-readiness-checklist.md`

---

### Task 1: Add Open Outcome Audit Fields

**Files:** migration, migration spec, and `app-open-log.entity.ts`.

**Schema:** `appCode`, `outcome`, `reasonCode`, and `failureMessage`; `appId` becomes nullable.

- [ ] **Step 1: Write a failing migration contract spec**

Assert that the migration makes `app_id` nullable, adds all outcome fields, backfills legacy rows, adds `(outcome, create_time)` and `(reason_code, create_time)` indexes, and restores the original schema in `down`.

- [ ] **Step 2: Run the migration spec to verify RED**

```powershell
cd server
pnpm.cmd exec jest --runInBand -- add-app-open-outcome-analytics.spec.ts
```

- [ ] **Step 3: Implement the migration and entity mapping**

Legacy rows use `outcome = success`, `reason_code = none`, and an empty failure message. Backfill `app_code` from `app_package.code` before making it non-null. Keep the app foreign key nullable for unknown codes.

- [ ] **Step 4: Run the migration spec to verify GREEN**

- [ ] **Step 5: Commit the schema slice**

```powershell
git add server/src/migrations/1760000000036-AddAppOpenOutcomeAnalytics.ts server/src/migration-specs/add-app-open-outcome-analytics.spec.ts server/src/module/app/entities/app-open-log.entity.ts
git commit -m "feat: record app open outcomes"
```

### Task 2: Audit Successful And Failed Open Attempts

**Files:** `app-tenant.service.ts` and its service spec.

**Safe reason mapping:**

```ts
const APP_OPEN_FAILURE_MESSAGES = {
  app_not_found: 'App was not found',
  app_not_published: 'App is not published',
  app_not_installed: 'App is not installed',
  missing_plan_module: 'Required plan module is not enabled',
  missing_system_module: 'Required tenant module is not enabled',
  system_module_unavailable: 'Required system module is unavailable',
  published_version_missing: 'App has no published version',
  open_metadata_error: 'Unable to open app',
} as const;
```

- [ ] **Step 1: Replace the old no-log failure assertion with failing audit tests**

Cover successful opens, unknown codes, uninstalled and unpublished apps, plan and system-module blockers, missing versions, and unexpected errors. Each failed path must save the exact fixed reason and message. Unknown codes use `appId: null` and preserve the normalized requested code.

- [ ] **Step 2: Run the tenant service spec to verify RED**

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-tenant.service.spec.ts
```

- [ ] **Step 3: Implement one outcome recorder**

Add a private best-effort recorder built only from explicit safe fields. Wrap only the save operation in `try/catch`; never swallow or rewrite the original open result. Map known business failures at their validation points and map unexpected exceptions to `open_metadata_error` before rethrowing the original exception.

- [ ] **Step 4: Add logging-failure tests**

Verify a rejected log save does not fail an otherwise successful open and does not replace either a business exception or an unexpected exception.

- [ ] **Step 5: Run the tenant service spec to verify GREEN**

- [ ] **Step 6: Commit the audit behavior**

```powershell
git add server/src/module/app/services/app-tenant.service.ts server/src/module/app/services/app-tenant.service.spec.ts
git commit -m "feat: audit failed app opens"
```

### Task 3: Build Tenant-Isolated Analytics APIs

**Files:** analytics DTO, service, controller, their specs, and `app.module.ts`.

- [ ] **Step 1: Write failing DTO and service tests**

Test that `days` defaults to 30 and rejects values outside `7 | 30 | 90`. Cover platform totals and zero-safe success rate, per-app version adoption, authenticated tenant scoping in every tenant query, separately aggregated install/open queries, and allowlist-only recent failure responses.

Assert recursively that no response object contains `ip`, `userAgent`, `token`, `cookie`, `authorization`, or raw exception data.

- [ ] **Step 2: Run analytics specs to verify RED**

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-analytics.service.spec.ts app-analytics.controller.spec.ts
```

- [ ] **Step 3: Implement bounded aggregation**

Create private helpers for UTC window calculation, complete zero-filled daily series, division-by-zero-safe percentages, and allowlist-only failure mapping. Use database grouping for counts and trends; do not load all open logs into Node.js.

Aggregate installations and opens separately before composing per-app rows. Cap failure results at 20 and tenant adoption at 100.

- [ ] **Step 4: Implement permission-protected controllers**

Platform methods require `app:analytics:platform` and execute service calls inside:

```ts
this.tenantContext.run({ ignoreTenant: true }, () => ...)
```

The tenant method requires `app:analytics:tenant`, calls `getTenantId()`, and never reads a tenant identifier from the request.

- [ ] **Step 5: Register the controller and service**

Update `AppModule` without exporting analytics internals unless another module requires them.

- [ ] **Step 6: Run analytics and tenant service tests**

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-analytics.service.spec.ts app-analytics.controller.spec.ts app-tenant.service.spec.ts
```

- [ ] **Step 7: Commit the analytics API slice**

```powershell
git add server/src/module/app/dto/app-analytics.dto.ts server/src/module/app/services/app-analytics.service.ts server/src/module/app/services/app-analytics.service.spec.ts server/src/module/app/app-analytics.controller.ts server/src/module/app/app-analytics.controller.spec.ts server/src/module/app/app.module.ts
git commit -m "feat: add app analytics APIs"
```

### Task 4: Seed Analytics Menus And Permissions

**Files:** `1760000000037-SeedAppAnalyticsMenus.ts` and its migration spec.

**Menus and permissions:**

```text
AppPlatformAnalytics -> /app-platform/analytics -> /app-platform/analytics
  app:analytics:platform

AppTenantUsage -> /app-center/usage -> /app-center/usage
  app:analytics:tenant
```

- [ ] **Step 1: Write a failing migration contract spec**

Assert that platform analytics is a child of `AppPlatform`, tenant usage is a child of `AppCenter`, `admin` and `super_admin` receive platform access, tenant owner/admin roles receive tenant access, tenant member roles do not, and rerunning the migration cannot duplicate menus or bindings.

- [ ] **Step 2: Run the migration spec to verify RED**

```powershell
cd server
pnpm.cmd exec jest --runInBand -- seed-app-analytics-menus.spec.ts
```

- [ ] **Step 3: Implement idempotent menu seeding**

Follow existing app-platform migration helpers and exact role-name conventions. Do not grant tenant analytics to every role.

- [ ] **Step 4: Run the migration spec to verify GREEN**

- [ ] **Step 5: Commit menus and permissions**

```powershell
git add server/src/migrations/1760000000037-SeedAppAnalyticsMenus.ts server/src/migration-specs/seed-app-analytics-menus.spec.ts
git commit -m "feat: seed app analytics access"
```

### Task 5: Build Platform And Tenant Analytics UI

**Files:** analytics API client, platform page, tenant page, readiness script, and `web/package.json`.

- [ ] **Step 1: Write a failing readiness contract**

Verify all three API paths and both permission keys. The platform page must include window controls, KPIs, trend, app table, detail drawer, version and tenant adoption, sanitized failures, refresh, loading, retry, and empty states. The tenant page must include window controls, tenant KPIs, trend, installed-app usage, version adoption, sanitized failures, refresh, loading, retry, and empty states.

The script must reject UI source that renders IP, user-agent, token, cookie, or authorization fields.

- [ ] **Step 2: Run readiness to verify RED**

```powershell
cd web
pnpm.cmd tsx scripts/verify-app-analytics-readiness.ts
```

- [ ] **Step 3: Implement the typed API client**

Define explicit response types for summaries, trends, app rows, version adoption, tenant adoption, and safe failures. Keep platform and tenant calls separate so tenant UI cannot accidentally call a cross-tenant endpoint.

- [ ] **Step 4: Implement platform analytics**

Use `ElSegmented` for 7/30/90-day selection, an icon-only refresh button with tooltip, compact KPI layout, existing `ArtLineChart`, a metrics table, and a detail drawer for version/tenant adoption and failures. Provide stable loading dimensions, inline retry, empty state, and responsive table overflow.

- [ ] **Step 5: Implement tenant usage analytics**

Show only authenticated-tenant aggregate usage. Do not display tenant ids, user ids, IP addresses, or user agents. Include installed-app usage, version adoption, and safe recent failures.

- [ ] **Step 6: Run readiness and focused lint**

```powershell
cd web
pnpm.cmd tsx scripts/verify-app-analytics-readiness.ts
pnpm.cmd exec eslint src/api/app-analytics.ts src/views/app-platform/analytics/index.vue src/views/app-center/usage/index.vue scripts/verify-app-analytics-readiness.ts
```

- [ ] **Step 7: Commit the UI slice**

```powershell
git add web/src/api/app-analytics.ts web/src/views/app-platform/analytics/index.vue web/src/views/app-center/usage/index.vue web/scripts/verify-app-analytics-readiness.ts web/package.json
git commit -m "feat: add app usage dashboards"
```

### Task 6: Review, Verify, And Document P7

**Files:** `docs/saas-launch-readiness-checklist.md`.

- [ ] **Step 1: Add acceptance checks**

Document platform/tenant permission boundaries, authenticated tenant derivation, fixed failure sanitization, secret-field absence, all required metrics, supported time windows, and migration/menu rollback checks.

- [ ] **Step 2: Run backend verification**

```powershell
cd server
pnpm.cmd exec jest --runInBand -- add-app-open-outcome-analytics.spec.ts app-tenant.service.spec.ts app-analytics.service.spec.ts app-analytics.controller.spec.ts seed-app-analytics-menus.spec.ts
pnpm.cmd run build
```

- [ ] **Step 3: Run frontend verification**

```powershell
cd web
pnpm.cmd tsx scripts/verify-app-analytics-readiness.ts
pnpm.cmd exec eslint src/api/app-analytics.ts src/views/app-platform/analytics/index.vue src/views/app-center/usage/index.vue scripts/verify-app-analytics-readiness.ts
pnpm.cmd run build
```

- [ ] **Step 4: Run repository and security checks**

```powershell
git diff --check
rg -n "(authorization|cookie|token|userAgent|user_agent|\bip\b)" server/src/module/app/services/app-analytics.service.ts server/src/module/app/app-analytics.controller.ts web/src/api/app-analytics.ts web/src/views/app-platform/analytics web/src/views/app-center/usage
git status --short
```

Review every search match and confirm it is a test prohibition or absent from response/UI mapping.

- [ ] **Step 5: Run database-backed smoke checks when MySQL is available**

Run pending migrations against the local development database, start the server, and verify all three endpoints with platform and tenant identities. Confirm a failed app open creates a safe audit row and a tenant cannot query another tenant's usage.

If local MySQL on port 3306 is unavailable, record migration execution and authenticated endpoint smoke testing as unverified; do not report them as passing.

- [ ] **Step 6: Perform final code review**

Inspect the complete P7 diff for tenant-id trust violations, permission over-grants, count inflation, raw error leakage, audit failures that alter business behavior, unbounded queries, missing UI states, and unrelated P8 scope.

- [ ] **Step 7: Commit P7 completion**

```powershell
git add docs/saas-launch-readiness-checklist.md
git commit -m "docs: verify app analytics operations"
```

Do not push unless the user explicitly requests it.

## P7 Definition Of Done

- Every app-open attempt has a successful or sanitized failed audit outcome.
- Platform administrators can inspect overview and per-app analytics across tenants.
- Tenant owners and administrators can inspect only their own tenant's installed-app usage.
- Metrics include installs, opens, failed opens, entitlement blockers, and version adoption.
- Analytics API and UI responses do not expose IP, user agent, token, cookie, authorization, or raw exception text.
- Backend tests, frontend readiness, focused lint, backend build, frontend build, and `git diff --check` pass.
- Database migration and authenticated smoke-test status is reported honestly.
- P7 changes are reviewed and committed locally, with no push unless requested.
