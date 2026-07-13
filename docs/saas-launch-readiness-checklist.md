# SaaS Launch Readiness Checklist

## Purpose

This checklist verifies the AgentStudio SaaS system is ready for local demo, QA acceptance, and pre-release review.

## Roles

- Visitor: can open registration and create a tenant owner account.
- Tenant owner: can log in, view subscription, usage, enabled modules, members, and resource packs.
- Platform admin: can manage tenants, plans, modules, subscriptions, usage, revenue, resource packs, resource-pack orders, and Alipay settings.
- Platform app admin: can create internal/iframe/static app records, upload static app zip packages, review versions, publish approved versions, and disable unsafe apps.
- Platform analytics admin: can inspect cross-tenant app adoption, open reliability, entitlement blockers, version adoption, and sanitized failures.
- Tenant app user: can browse approved marketplace apps, install tenant apps, view installed apps, and open installed apps through the sandboxed runner.
- Tenant owner or admin: can inspect only the authenticated tenant's app usage and sanitized failure history.

## Automated Gates

Run these before demo or release review:

```powershell
# Full repository gate
node scripts/run-saas-readiness.cjs
```

This aggregate gate runs frontend readiness, frontend build, frontend preview smoke, frontend browser smoke, backend build, and backend readiness.

```powershell
cd web
pnpm.cmd run verify:saas-readiness

# Expanded frontend gates
pnpm.cmd exec tsx scripts/verify-saas-launch-flow-readiness.ts
pnpm.cmd exec tsx scripts/verify-saas-route-contract.ts
pnpm.cmd exec tsx scripts/verify-saas-doc-route-baseline.ts
pnpm.cmd exec tsx scripts/verify-saas-ui-state-readiness.ts
pnpm.cmd exec tsx scripts/verify-saas-tenant-ui-state-readiness.ts
pnpm.cmd exec tsx scripts/verify-saas-visible-copy-encoding.ts
pnpm.cmd exec tsx scripts/verify-saas-signup-route.ts
pnpm.cmd exec tsx scripts/verify-saas-signup-password-policy.ts
pnpm.cmd exec tsx scripts/verify-saas-signup-activation.ts
pnpm.cmd exec tsx scripts/verify-saas-platform-tenant-page.ts
pnpm.cmd exec tsx scripts/verify-saas-payment-path-copy.ts
pnpm.cmd exec tsx scripts/verify-saas-resource-pack-crud.ts
pnpm.cmd exec tsx scripts/verify-no-legacy-saiadmin-composable.ts
pnpm.cmd exec tsx scripts/verify-saas-public-brand-surfaces.ts
pnpm.cmd exec tsx scripts/verify-saas-public-origin.ts
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run verify:app-factory-readiness
pnpm.cmd run verify:app-developer-readiness
pnpm.cmd run verify:app-analytics-readiness
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run verify:app-runtime-sdk
pnpm.cmd run verify:app-runtime-starter
pnpm.cmd run verify:app-runtime-live-e2e-contract
pnpm.cmd build
pnpm.cmd run verify:saas-preview-smoke
pnpm.cmd run verify:saas-browser-smoke
```

```powershell
cd server
pnpm.cmd run verify:saas-readiness

# Expanded backend gate is defined in server/package.json and guarded by:
pnpm.cmd exec jest --runInBand -- saas-readiness-command.spec.ts
```

Backend readiness also covers authentication rate limits, JWT strategy tenant context, user refresh-token tenant continuity, menu permissions, and system-module guards.
Backend readiness includes database initialization security, seed data integrity, migration menu alignment, and tenant role grant coverage.
Backend readiness includes AI provider/admin flows, chat runtime, Taixu LLM/model runtime, upload safety, scheduler tasks, log username length, and SaaS provisioning coverage.
Backend readiness guards Jest option ordering so serial execution cannot silently become a test-name pattern. Forced exit is intentionally not used, so leaked handles remain visible.

### Optional Public Live Smoke Gate

Run this after deploying the frontend through Baota/Nginx and binding the public domain:

```powershell
cd web
$env:SAAS_PUBLIC_LIVE_BASE_URL = 'https://studio.qingyouai.com'
pnpm.cmd run verify:saas-public-live-smoke
```

This command is read-only. It checks the deployed app shell, direct-route fallback, robots.txt, sitemap.xml, SEO origin replacement, and static asset reachability. Keep it outside the default repository gate because it depends on public DNS, TLS, and Nginx availability.

### Optional Live Backend E2E Gate

Run this against a running backend with seeded SaaS data before staging or production release:

```powershell
cd server
$env:SAAS_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_LIVE_E2E_USERNAME = '<seeded-tenant-owner-username>'
$env:SAAS_LIVE_E2E_PASSWORD = '<seeded-tenant-owner-password>'
# Optional: force a known tenant instead of using the first credential-matched tenant
$env:SAAS_LIVE_E2E_TENANT_ID = '<tenant-id>'
pnpm.cmd run verify:saas-live-e2e
```

The command validates credential-gated tenant lookup, tenant-scoped login, user profile, menu, usage, plan, subscription, module, and Alipay config-status APIs.

To validate dev payment confirmation in a non-production seeded environment:

```powershell
cd server
$env:SAAS_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_LIVE_E2E_USERNAME = '<seeded-tenant-owner-username>'
$env:SAAS_LIVE_E2E_PASSWORD = '<seeded-tenant-owner-password>'
$env:SAAS_LIVE_E2E_PLAN_CODE = 'pro'
$env:SAAS_LIVE_E2E_BILLING_CYCLE = 'monthly'
$env:SAAS_LIVE_E2E_RUN_PAYMENT = '1'
pnpm.cmd run verify:saas-live-e2e
```

Only enable `SAAS_LIVE_E2E_RUN_PAYMENT=1` against disposable or resettable data because it creates and confirms a real SaaS order through the development confirmation endpoint.

To validate resource-pack order creation and optional development payment in a non-production seeded environment:

```powershell
cd server
$env:SAAS_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_LIVE_E2E_USERNAME = '<seeded-tenant-owner-username>'
$env:SAAS_LIVE_E2E_PASSWORD = '<seeded-tenant-owner-password>'
$env:SAAS_LIVE_E2E_RESOURCE_PACK_CODE = '<resource-pack-code>'
$env:SAAS_LIVE_E2E_RUN_RESOURCE_PACK = '1'
# Optional: also confirm the resource-pack order through the development payment endpoint
$env:SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT = '1'
pnpm.cmd run verify:saas-live-e2e
```

Only enable `SAAS_LIVE_E2E_RUN_RESOURCE_PACK=1` against disposable or resettable data because it creates a real SaaS resource-pack order. `SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT=1` additionally confirms the order through the development payment endpoint.

### Optional Platform Admin Live E2E Gate

Run this against a running backend with seeded platform administrator credentials before staging or production release:

```powershell
cd server
$env:SAAS_PLATFORM_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_PLATFORM_LIVE_E2E_USERNAME = '<seeded-platform-admin-username>'
$env:SAAS_PLATFORM_LIVE_E2E_PASSWORD = '<seeded-platform-admin-password>'
# Optional: force the tenant used only for the existing tenant-scoped login bootstrap
$env:SAAS_PLATFORM_LIVE_E2E_TENANT_ID = '<tenant-id>'
pnpm.cmd run verify:saas-platform-live-e2e
```

This command is read-only. It verifies platform administrator access to runtime health, tenant, plan, module, usage, revenue, order risk, reconciliation, subscription, quota ledger, resource-pack, notify-log, and Alipay configuration APIs without printing passwords or bearer tokens.

### Optional Platform Admin Live Browser E2E Gate

Run this after `cd web` and `pnpm.cmd build` when a live backend with seeded platform administrator credentials is available:

```powershell
cd web
$env:SAAS_PLATFORM_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_PLATFORM_LIVE_E2E_USERNAME = '<seeded-platform-admin-username>'
$env:SAAS_PLATFORM_LIVE_E2E_PASSWORD = '<seeded-platform-admin-password>'
# Optional: force the tenant used only for the existing tenant-scoped login bootstrap
$env:SAAS_PLATFORM_LIVE_E2E_TENANT_ID = '<tenant-id>'
# Optional: use an already running frontend instead of Vite preview
$env:SAAS_PLATFORM_LIVE_E2E_WEB_URL = 'http://127.0.0.1:5731'
pnpm.cmd run verify:saas-platform-live-browser-e2e
```

This command is read-only. It verifies the platform administrator can open tenant, plan, module, subscription, usage, revenue, resource-pack, resource-pack order, and payment configuration pages against a live backend.

### Optional Live Browser E2E Gate

Run this after `cd web` and `pnpm.cmd build` when a live backend with seeded SaaS data is available. The script opens the built tenant SaaS plan page in Chromium, proxies browser API calls to the live backend, creates an upgrade order through the UI, and verifies the order panel renders.

```powershell
cd web
$env:SAAS_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_LIVE_E2E_USERNAME = '<seeded-tenant-owner-username>'
$env:SAAS_LIVE_E2E_PASSWORD = '<seeded-tenant-owner-password>'
# Optional: force a known tenant and plan
$env:SAAS_LIVE_E2E_TENANT_ID = '<tenant-id>'
$env:SAAS_LIVE_E2E_PLAN_CODE = 'pro'
$env:SAAS_LIVE_E2E_BILLING_CYCLE = 'monthly'
pnpm.cmd run verify:saas-live-browser-e2e
```

Leave `SAAS_LIVE_E2E_WEB_URL` unset to let the script start Vite preview from `dist`. Set `SAAS_LIVE_E2E_WEB_URL` only when an already running frontend should be tested instead.

To also click the local development payment confirmation control, rebuild the frontend with `VITE_ENABLE_DEV_PAYMENT_CONFIRM=true`, then run:

```powershell
cd web
$env:SAAS_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_LIVE_E2E_USERNAME = '<seeded-tenant-owner-username>'
$env:SAAS_LIVE_E2E_PASSWORD = '<seeded-tenant-owner-password>'
$env:SAAS_LIVE_E2E_RUN_PAYMENT = '1'
pnpm.cmd run verify:saas-live-browser-e2e
```

Only run this command against disposable or resettable seeded data. The base browser check creates a SaaS upgrade order; `SAAS_LIVE_E2E_RUN_PAYMENT=1` additionally confirms the order through the development payment endpoint.

To also create a resource-pack order through the UI:

```powershell
cd web
$env:SAAS_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_LIVE_E2E_USERNAME = '<seeded-tenant-owner-username>'
$env:SAAS_LIVE_E2E_PASSWORD = '<seeded-tenant-owner-password>'
$env:SAAS_LIVE_E2E_RESOURCE_PACK_CODE = '<resource-pack-code>'
$env:SAAS_LIVE_E2E_RUN_RESOURCE_PACK = '1'
# Optional: also click the local development payment confirmation control
$env:SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT = '1'
pnpm.cmd run verify:saas-live-browser-e2e
```

Only run the resource-pack browser mutation against disposable or resettable seeded data. `SAAS_LIVE_E2E_RUN_RESOURCE_PACK=1` creates a resource-pack order, and `SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT=1` additionally confirms it through the development payment endpoint.

## Environment Contract

Required local/demo backend keys:

- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `LOGIN_CAPTCHA_ENABLED`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`
- `SAAS_DEV_PAYMENT_CONFIRM_ENABLED`
- `ALIPAY_ENABLED`, `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY`, `ALIPAY_NOTIFY_URL`, `ALIPAY_RETURN_URL`, `ALIPAY_GATEWAY_URL`

Use `server/.env.example` as a placeholder-only template. Replace `change_me_*` values before running shared, staging, or production environments.

## Manual Visitor Flow

1. Open `/#/saas/signup`.
2. Register a new tenant owner with username, real name, tenant name, phone, email, and a password that satisfies the password policy.
3. Confirm the app redirects to `/#/auth/login?signup_success=1&username=<username>`.
4. Confirm the login page shows the signup success alert and pre-fills username.

## Manual Tenant Owner Flow

1. Log in with tenant owner credentials and select the created tenant.
2. Open `/#/tenant-saas/usage` and confirm quota cards and quota ledger sections render.
3. Open `/#/tenant-saas/plan` and confirm plan list, current subscription, payment action, and payment configuration state render.
4. Open `/#/tenant-saas/modules` and confirm enabled system modules render.
5. Open `/#/tenant-saas/members` and confirm member list, create, role/status update, reset password, and remove controls render according to permissions.
6. Open `/#/tenant-saas/resource-packs` and confirm resource packs, order history, Alipay status, payment action, and cancel action render.

## Manual Platform Admin Flow

1. Open `/#/saas-platform/tenants` and confirm tenant list, filters, pagination, and create-tenant dialog render.
2. Open `/#/saas-platform/plans` and confirm plan CRUD, status update, quota edit, and module assignment render.
3. Open `/#/saas-platform/module` and confirm module CRUD and status controls render.
4. Open `/#/saas-platform/subscription` and confirm subscription lifecycle, orders, order detail, and risk summary render.
5. Open `/#/saas-platform/usage` and confirm KPI cards, quota ledger, reconciliation scan, and recent order sections render.
6. Open `/#/saas-platform/revenue` and confirm revenue KPI, revenue split, daily trend, top tenants, and recent paid orders render.
7. Open `/#/saas-platform/resource-packs` and confirm resource-pack catalog management renders.
8. Open `/#/saas-platform/resource-pack-orders` and confirm resource-pack order operations render.
9. Open `/#/saas-platform/payment-config` and confirm Alipay config status and edit form render.
10. Open or call `GET /api/saas/platform/runtime-health` and confirm dependencies, required env keys, payment config, and operational switches render without exposing secret values.
11. Open `/#/app-platform/apps` and confirm platform admins can create internal/iframe/static apps, upload static zip packages, review pending versions, publish approved versions, unpublish unsafe versions, rollback to a previous approved version, and disable apps.
12. Open `/#/app-platform/factory` and confirm platform admins can use curated templates, create static HTML/CSS modules, bind optional SaaS/system modules, preview content, and publish a generated static marketplace app version.
13. Open `/#/app-platform/reviews` and confirm reviewers can filter pending versions and perform approve/reject/publish/rollback/unpublish actions from one queue.
14. Open `/#/app-platform/analytics` with `app:analytics:platform` and confirm 7/30/90-day overview metrics, app rows, sanitized failures, and per-app version and tenant adoption render.
15. Remove `app:analytics:platform` and confirm the platform analytics menu and API are unavailable to the account.

## Manual App Center Flow

1. Open `/#/app-center/marketplace` as a tenant user and confirm approved marketplace apps render with install state.
2. Install an available app and confirm the row changes to Installed.
3. Open `/#/app-center/installed` and confirm the installed app shows app name, type, source, and open/uninstall actions.
4. Open an installed internal app and confirm it redirects to the configured internal route.
5. Open an installed static or iframe app and confirm `/#/app-center/open?code=<app_code>` renders an iframe runner.
6. Confirm uploaded static apps run in a sandboxed iframe without `allow-same-origin`.
7. Confirm an app bound to a missing SaaS module shows Requires upgrade and cannot be installed.
8. Confirm an installed app bound to a disabled system module cannot be opened and shows Tenant has not enabled this module.
9. Confirm a platform rollback makes the tenant app runner open the restored static version instead of a retired installed version.
10. Open `/#/app-center/usage` as a tenant owner or tenant admin with `app:analytics:tenant` and confirm 7/30/90-day usage, installed-app metrics, version adoption, and sanitized failures render.
11. Confirm a tenant member without `app:analytics:tenant` cannot open the usage page or call `GET /api/app-analytics/tenant/overview`.
12. Sign in to two different tenants and confirm each usage response contains only the authenticated tenant's data; no tenant id can be supplied through query, path, or body.

### Manual Static App Runtime Flow

1. Publish and install a reviewed static app whose resolved version manifest declares `"permissions": ["runtime:context:read"]`.
2. Open the app through `/#/app-center/open?code=<app_code>` and confirm the iframe sandbox does not contain `allow-same-origin`.
3. From the static app, send `{"channel":"agentstudio:app-runtime","version":1,"type":"context.get","request_id":"manual-1"}` to `window.parent` with `targetOrigin: "*"`.
4. Confirm the current iframe receives one `context.result` response containing only tenant `{ id, name }`, user `{ id, display_name }`, and app `{ code, name, version }`, with tenant and user IDs serialized as strings.
5. Confirm `display_name` never falls back to the login username. A user without a real name receives an empty display name.
6. Publish a static version without `runtime:context:read`, open it, send the same request, and confirm the fixed `scope_denied` response contains no context.
7. Confirm a scoped static app with unavailable tenant, user, or membership identity receives the fixed `context_unavailable` response and still renders normally.
8. Confirm external iframe apps and internal-route apps receive no runtime bridge response.
9. Send the request from another window or a stale iframe and confirm the host ignores it because it is not the current iframe `WindowProxy`.

### Manual App Runtime SDK Flow

1. Build `@agentstudio/app-runtime-sdk` and confirm ESM `dist/index.js`, browser IIFE `dist/agentstudio-runtime.global.js`, and TypeScript declarations rooted at `dist/index.d.ts` exist.
2. Import `getContext`, `AppRuntimeError`, `AppRuntimeContext`, and `GetContextOptions` from the package in a TypeScript consumer.
3. Load the IIFE in a plain HTML app and confirm `window.AgentStudioRuntime.getContext()` exposes the same context and fixed errors.
4. Publish and install the generated `Runtime Starter` ZIP, then confirm loading, success, fixed error, and Retry states are keyboard accessible and responsive.
5. Confirm concurrent requests use different request IDs; timeout, abort, invalid response, and host errors remove their timer and listeners exactly once.
6. Confirm the SDK and starter contain no HTTP client, storage facade, token accessor, write capability, management API reference, source map, or backend executable.
7. Confirm the iframe still omits `allow-same-origin`, a reload creates one fresh request/result pair, and no username, contact field, role, permission, credential, or raw exception appears in the runtime payload or page.

The disposable full-lifecycle gate is opt-in because it creates and drops a MySQL database and starts local backend/frontend processes. Provide these variable names through the local secret environment, never through committed scripts or documentation:

```text
APP_RUNTIME_E2E_DB_HOST
APP_RUNTIME_E2E_DB_PORT
APP_RUNTIME_E2E_DB_USERNAME
APP_RUNTIME_E2E_DB_PASSWORD
APP_RUNTIME_E2E_PLATFORM_USERNAME
APP_RUNTIME_E2E_PLATFORM_PASSWORD
APP_RUNTIME_E2E_REDIS_DB
APP_RUNTIME_E2E_REDIS_ISOLATED=1
```

`APP_RUNTIME_E2E_REDIS_DB` must identify an empty, dedicated Redis logical database from `1` to `15`. The gate atomically claims that database before starting the backend, then atomically compares ownership and runs `FLUSHDB` only on that selected database after the backend has fully exited. Any process, Redis, MySQL, or artifact cleanup failure fails the gate. Redis host, port, and password remain optional connection settings.

Then run:

```powershell
cd web
pnpm.cmd run verify:app-runtime-live-e2e
```

10. Change the app route or click Reload while an earlier metadata request is still pending and confirm the older response cannot remount stale app metadata or runtime context.
11. Inspect the open metadata and iframe response and confirm they contain no username, tenant code, email, phone, avatar, department, role, permission list, access token, refresh token, authorization value, cookie, IP address, user agent, request object, or raw exception.
12. Confirm the static app never receives a platform token or direct authenticated backend API client.

## Manual Developer App Flow

1. Grant an approved creator the `AppDeveloperApps` menu and `app:developer:*` permissions through role management.
2. Open `/#/app-center/developer` and confirm the creator can create a static app draft and edit draft metadata.
3. Upload a valid ZIP package and confirm the latest version becomes Pending without changing metadata or availability of an already published version.
4. Reject the version as a platform reviewer, then confirm the creator sees the review message and can resubmit it.
5. Request another creator's app code through the developer detail, update, upload, and submit APIs and confirm each foreign app request returns not found.
6. Confirm the developer page has no approve, reject, publish, rollback, unpublish, disable, archive, module-binding, or visibility controls.

## Acceptance Criteria

- All automated gates exit with code 0.
- No critical SaaS page routes to 404.
- All tenant-owned APIs require tenant context and permissions.
- Platform admin APIs are not tenant-scoped.
- Tenant modules flow uses the system-module registry endpoint `GET /api/tenant/modules`.
- App marketplace flow uses `GET /api/app-tenant/marketplace`, `POST /api/app-tenant/apps/:code/install`, and `GET /api/app-tenant/apps/:code/open`.
- Static app packages are reviewed before publishing and served from `/apps-static/`.
- Platform app versions can be unpublished or rolled back with audit reasons.
- Module factory flow uses `GET /api/app-platform/factory/modules`, creates static HTML/CSS modules only, and publishes generated apps through the existing marketplace runtime.
- Module factory template flow uses `GET /api/app-platform/factory/templates`, applies curated static templates into drafts, and never executes template code on the backend.
- Developer app flow uses authenticated ownership checks for every detail and mutation and exposes no platform governance action.
- Platform app analytics require `app:analytics:platform` and run with tenant filtering explicitly disabled only inside the platform controller boundary.
- Tenant app analytics require `app:analytics:tenant` and derive tenant identity only from authenticated context through `getTenantId()`.
- New tenant provisioning grants app marketplace, install, open, and analytics access to owner/admin roles. Member roles retain marketplace/open access without install or analytics access.
- App analytics accept only 7, 30, or 90 day windows, default to 30 days, and aggregate installs separately from opens to avoid inflated counts.
- Platform overview and per-app detail include installs, open outcomes, entitlement blockers, tenant/user reach, trends, version adoption, and bounded sanitized failures.
- Tenant usage includes enabled apps, open outcomes, entitlement blockers, trends, installed-app usage, and version adoption without tenant ids or user ids in the UI response.
- Analytics responses and pages expose no authorization values, cookies, tokens, IP addresses, user agents, raw exception text, or request failure objects.
- Recent failure lists are capped at 20 rows and per-app tenant adoption is capped at 100 rows.
- The app analytics menu migration is insert-idempotent. Schema and menu rollback contracts are covered by migration specs and have been exercised on a disposable MySQL database.
- Only reviewed static app versions declaring the exact `runtime:context:read` scope receive a runtime context bootstrap.
- Runtime context is derived from authenticated tenant/user state and a non-deleted tenant membership, then rebuilt from an explicit allowlist on both backend and frontend boundaries.
- External iframe and internal-route apps cannot activate the runtime bridge, and messages from any window other than the currently rendered static iframe are ignored.
- Missing scope returns `scope_denied`; missing or unusable context returns `context_unavailable`; neither condition prevents the static app from rendering.
- Route changes, retries, reloads, and unmounts invalidate stale metadata requests and stale iframe sources.
- The runtime bridge exposes no platform credential, contact field, login identity, role/permission list, network identity, request object, or raw exception.
- Uploaded apps are never executed as backend code in P0.
- Resource-pack and plan payment paths show whether Alipay is configured before a user attempts payment.
- Empty, loading, and error states are visible for tenant and platform pages.
- If PowerShell `Get-Content` displays Chinese as mojibake, verify with Node UTF-8 reads or run `verify-saas-visible-copy-encoding.ts` before editing source files. The browser/Vite path reads these source files as UTF-8.

## P7 App Analytics Verification - 2026-07-10

Verified in the `saas-order-risk-ops` worktree:

- Backend focused Jest gate passed: 5 suites and 32 tests covering the analytics schema migration, app-open outcomes, analytics aggregation, controller permissions and tenant context, and analytics menu seeding.
- Backend TypeScript production build passed with `pnpm.cmd run build`.
- Frontend app analytics readiness gate passed, including API contracts, both dashboard states, failure-code labels, sensitive-field prohibitions, and stale-data clearing after failed window refreshes.
- Focused ESLint passed for the app analytics API, both dashboards, and the readiness script.
- Frontend type-check and production Vite build passed with `pnpm.cmd run build`.
- `git diff --check` passed. The analytics security search matched only readiness-script assertion variables and forbidden-field regular expressions; no token, cookie, authorization, IP, or user-agent field is mapped by the analytics API client or dashboards.
- Code review confirmed platform endpoints require `app:analytics:platform` and run outside tenant filtering, while the tenant endpoint requires `app:analytics:tenant` and derives its tenant only from authenticated `getTenantId()` context.
- Code review confirmed installs and opens aggregate independently, recent failures are limited to 20 rows, per-app tenant adoption is limited to 100 rows, audit writes are best effort, and tenant analytics omit tenant and user identifiers.

Environment-dependent checks not verified on 2026-07-10:

- Local MySQL at `127.0.0.1:3306` was unavailable (`TcpTestSucceeded: False`), so the analytics migrations were not executed against a real database.
- Authenticated platform and tenant endpoint smoke tests, failed-open audit-row persistence, and live cross-tenant isolation remain unverified until MySQL and seeded identities are available.
- Before production, exercise both migration rollback paths on a disposable database. The menu rollback removes rows and grants matching the analytics codes and slugs, so it should not be tested first against shared production data.

These environment-dependent gaps were closed on 2026-07-11 in the disposable verification environment below.

### P7 Database And Authenticated Smoke Verification - 2026-07-11

- A local MySQL 8.4 instance bound to `127.0.0.1:3306` and the existing local Redis instance were used only for disposable verification data; no credentials were printed or added to repository files.
- `pnpm.cmd run db:verify-init` passed against `fssoa_net_verify_p7`: the base `database/init.sql` loaded, all 38 source migrations ran, P7 migrations `1760000000036` and `1760000000037` completed, bootstrap identity checks passed, and the verification database was retained for authenticated smoke testing.
- The backend started from the production build on port `3100`; `/api/health` reported both MySQL and Redis as `up`.
- Seeded platform administrator login and `GET /api/app-analytics/platform/overview?days=30` succeeded. The overview aggregated three failed opens across two tenants, kept recent failures within 20 rows, and exposed no credential fields.
- Two disposable tenants completed public signup and authenticated login. Their owner roles received `app:tenant:open` and `app:analytics:tenant` through tenant provisioning.
- Each tenant triggered an unknown-app open. Both calls returned business code `404`, two matching `app_not_found` audit rows were persisted, and each tenant analytics response contained only its own failure.
- Supplying another tenant id through the tenant overview query did not change the authenticated tenant scope. Tenant responses contained no tenant id, user id, authorization, cookie, token, or user-agent field.
- Both P7 migrations were reverted in reverse order on the disposable database. The analytics menu/grants and schema fields were removed, `app_id` returned to `NOT NULL`, and both migrations then reapplied successfully with columns, indexes, menus, grants, and migration records restored.
- Focused backend regression passed after the provisioning fix: 6 suites and 37 tests. The backend production TypeScript build also passed.

P2 performance follow-up:

- Run MySQL `EXPLAIN` with representative `app_open_log` volume. Consider dedicated `create_time` and `(app_code, create_time)` indexes if platform window scans become expensive.
- Add pagination or explicit result caps if the published-app list or tenant version-adoption result can grow beyond the current operational dashboard scale.

## P8 Safe App Runtime API Verification - 2026-07-11

Verified in the `saas-order-risk-ops` worktree:

- Backend focused Jest gate passed: 4 suites and 39 tests covering sanitized runtime context resolution, exact static-version scope handling, tenant/user/membership failures, sensitive-field exclusion, open metadata integration, best-effort runtime failure containment, existing open audits, and P7 analytics regressions.
- Backend production TypeScript build passed with `pnpm.cmd run build`.
- `pnpm.cmd run verify:app-runtime-readiness` passed. It covers success and fixed-error responses, plain-object requests, bounded request IDs, request/bootstrap protocol versions, exact scope enforcement, unavailable context, frontend context allowlisting, current-iframe source binding, static-only bridge activation, listener cleanup, stale-load sequencing, and sandbox same-origin rejection.
- `pnpm.cmd run verify:app-marketplace-readiness` passed, confirming the existing marketplace and runner readiness contract remains green.
- Focused ESLint passed for the runtime protocol, marketplace API type, app runner, and runtime readiness script.
- Frontend type-check and production Vite build passed with `pnpm.cmd run build`.
- `git diff --check` passed. The runtime security search matched only the readiness script's hostile fixtures and forbidden-field assertions, the runner's explicit `allow-same-origin` removal, and the pre-existing app-open audit client-info fields. No sensitive field is mapped into runtime context or iframe responses.
- TDD mutation verification proved the backend sensitive-field test fails if `display_name` falls back to `username`; the safe `realname`-only implementation was restored and the full focused suite passed.
- Code review confirmed runtime scope is derived only from the resolved reviewed version manifest after installation, publication, and SaaS/system-module entitlement checks.
- Code review confirmed tenant and user records must be active and non-deleted, membership must exist and be non-deleted, entity queries select only approved response fields, and all runtime IDs are serialized as strings.
- Code review confirmed runtime resolution failures degrade to `runtime: null` without failing app opening or replacing the success audit outcome.
- Code review confirmed the frontend rebuilds context from the approved allowlist, validates both request and bootstrap protocol version `1`, returns only fixed error messages, and never forwards an API client, token, cookie, request object, or backend exception.
- Code review confirmed the host accepts messages only from the current sandboxed static iframe, uses `targetOrigin: "*"` only for the opaque sandbox origin, removes the listener on unmount, and rejects stale metadata responses with `loadSequence`.

- P8 adds no database migration, runtime bearer token, direct iframe backend API, write API, external iframe bridge, or backend-executable plugin path.

## P9-A App Runtime SDK Verification - 2026-07-11

Verified in the `saas-order-risk-ops` worktree:

- `pnpm.cmd run verify:app-runtime-sdk` passed for source behavior, ESM/IIFE exports, declarations, zero runtime dependencies, fixed errors, timeout normalization, abort, concurrency, request isolation, malformed responses, allowlist reconstruction, exact cleanup, bundle denylist, and the `10KB` limit.
- SDK outputs were ESM 4.48KB and IIFE 3.56KB before gzip; both are generated, source-map-free, and ignored by Git.
- `pnpm.cmd run verify:app-runtime-starter` passed twice and proved deterministic ZIP bytes, exact manifest and five-file allowlist, SDK SHA-256 equality, no symlink/executable/environment/source-map entry, and no credential or browser-storage reference.
- The full disposable browser E2E passed against MySQL 8.4 and an isolated Redis database. It built backend/frontend/SDK/starter, created a fresh database, authenticated a platform administrator, created/uploaded/approved/published `runtime_starter`, registered and authenticated a tenant owner, installed the app, and opened it through the real tenant runner.
- Playwright proved the iframe sandbox contains `allow-scripts` but not `allow-same-origin`, all seven allowlisted context fields match disposable identities with string IDs, forbidden identity/credential fields are absent, and reload produces exactly one fresh result with a different request ID.
- The E2E stopped backend/frontend processes, dropped the disposable database, atomically flushed its owned Redis DB, and left zero disposable MySQL databases and zero Redis test keys.
- Focused ESLint and Stylelint passed for the SDK, starter, build/verifier scripts, and live E2E.
- Review findings for future-protocol handling, runtime freezing of the public error catalog, exact timeout/abort cleanup assertions, export metadata coverage, identity redaction, atomic Redis ownership/cleanup, forced-process exit waiting, signal cleanup, runner-only reload, repeated leak scans, production manifest validation, and Starter source allowlisting were fixed and reverified.
- P9-A still adds no runtime token, storage API, write API, capability gateway, backend plugin, external iframe bridge, npm publication, or CDN publication.

## P9-B Runtime Sessions And Capability Gateway Verification - 2026-07-12

Implemented and covered by deterministic gates:

- Platform review records an allowlisted `context.read` capability, tenant installation requires explicit consent, and effective grants are revalidated for every runtime request.
- Runtime open metadata returns a short-lived one-time bearer token only when the feature flag is enabled. Persistence contains only a SHA-256 digest with tenant, user, app, version, and installation bindings.
- The dedicated `/api/app-runtime/context` endpoint accepts exactly one bounded `X-App-Runtime-Token` header and preserves strict HTTP 400/401/403/429/503 status semantics without changing the admin API's legacy envelope behavior.
- Session authorization fails closed after expiry, revocation, uninstall, publication loss, membership loss, tenant consent loss, SaaS entitlement loss, or system-module disablement.
- Redis atomically limits each session and capability to `120` requests per minute by default. `APP_RUNTIME_CAPABILITY_RATE_LIMIT_PER_MINUTE` is clamped from `1` to `1000`; keys contain only session IDs and capability names, never raw tokens.
- Rate-limit responses expose only a fixed message and a `retry_after` value bounded from `1` to `60`. One window writes at most one `rate_limited` audit, and Redis failures return a fixed 503 even if audit persistence is unavailable.
- Browser host bridging keeps the token outside the child iframe and SDK. The SDK adds capability metadata types without changing protocol version `1` or the existing `getContext` API.
- The disposable live E2E contract covers approval, consent, digest-only persistence, direct context access, per-session rate limiting, cross-tenant denial, expiry, revocation, uninstall invalidation, bounded audits, secret redaction, and owned MySQL/Redis cleanup.

Environment-dependent verification:

- Run `pnpm.cmd run verify:app-runtime-live-e2e` only with explicitly isolated `APP_RUNTIME_E2E_*` MySQL and Redis targets. The script refuses Redis DB `0`, leases an empty isolated DB, creates and drops its disposable MySQL database, and never prints credentials or raw runtime tokens.
- Keep `APP_RUNTIME_CAPABILITIES_ENABLED` disabled by default until the P9-B migration, Redis connectivity, and authenticated platform/tenant smoke flow have passed in the target environment.

## P9-C Shared Runtime Capability Verification - 2026-07-12

Deterministic repository gates:

- `pnpm.cmd run verify:app-runtime-sdk` verifies the additive protocol-v1 SDK surface for context, KV, files, HTTP, and webhooks without exposing a runtime bearer, authenticated API client, Cookie, or browser-storage dependency.
- `pnpm.cmd run verify:app-runtime-readiness` verifies exact source/origin binding, explicit host capability dispatch, one-time iframe launch exchange, static opaque-origin isolation, and external iframe exact-origin responses.
- `pnpm.cmd run verify:app-runtime-live-e2e-contract` verifies the disposable lifecycle script covers positive and negative KV/file/HTTP/webhook flows, cross-tenant isolation, private and redirected-private address rejection, iframe replay/origin denial, capability revocation, uninstall invalidation, redaction, and complete cleanup.
- Backend focused Jest, frontend/backend production builds, the SaaS readiness runner, and `git diff --check` remain required before integration.

Environment-dependent live verification:

- Run `pnpm.cmd run verify:app-runtime-live-e2e` only against a disposable MySQL target and an explicitly isolated, empty Redis logical database. The gate refuses Redis DB `0`, claims the selected DB atomically, and drops its generated MySQL database after the backend exits.
- In addition to the existing database, platform login, and Redis variables, provide `APP_RUNTIME_E2E_HTTP_URL`, `APP_RUNTIME_E2E_WEBHOOK_URL`, and `APP_RUNTIME_E2E_REDIRECT_PRIVATE_URL` through the local secret environment. These must be credential-free HTTPS URLs owned for testing; the redirect URL must return a redirect to a private or loopback destination so redirect revalidation can be proven.
- The external iframe fixture uses `https://runtime-e2e.invalid` only inside Playwright route interception. Production DNS, HTTPS, origin, and private-address validation remain unchanged and receive no test bypass.
- File verification points `APP_RUNTIME_STORAGE_DIR` at disposable local inert storage, confirms object responses expose no storage path, and removes object bytes during cleanup.
- Generated runtime sessions and iframe launch tokens are registered with the diagnostic redactor before assertions, screenshots, browser console output, or process tails can include them.
- A successful run must leave zero keys in the leased Redis DB, no generated MySQL database, and no package, public, upload, or runtime-storage directories owned by the run.

Feature flags remain disabled by default. Enable `APP_RUNTIME_CAPABILITIES_ENABLED` and `APP_RUNTIME_IFRAME_LAUNCH_ENABLED` in a target environment only after migrations, Redis, runtime storage, approved public upstreams, and authenticated tenant lifecycle smoke tests pass there.

## P10 Administrator Service Runtime Verification - 2026-07-13

Deterministic gate:

```powershell
cd server
pnpm.cmd run verify:app-service-runtime-live-e2e-contract
pnpm.cmd exec jest src/module/app src/common/utils/safe-url.util.spec.ts src/migration-specs/create-app-service-runtime.spec.ts src/migration-specs/seed-app-service-runtime-menus.spec.ts --runInBand
pnpm.cmd run build

cd ../web
pnpm.cmd run verify:app-service-runtime-readiness
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run build

cd ..
node scripts/run-saas-readiness.cjs
git diff --check
```

The deterministic contract verifies upload and parser scan, independent approval, candidate health, publish, failed candidate preservation, active/standby role swap, rollback, crash reconciliation, bounded redacted logs, feature-disabled denial, signal cleanup, and zero owned database, Redis, PM2, release, and generated-database residue.

Run the live gate only from Linux with a disposable MySQL target, an empty isolated Redis logical database, an empty runtime root outside the repository, an empty isolated PM2 home, and a dedicated non-root runtime user. Provide these names through the protected local environment without printing their values:

```text
APP_SERVICE_E2E_DB_HOST
APP_SERVICE_E2E_DB_PORT
APP_SERVICE_E2E_DB_USERNAME
APP_SERVICE_E2E_DB_PASSWORD
APP_SERVICE_E2E_PLATFORM_USERNAME
APP_SERVICE_E2E_PLATFORM_PASSWORD
APP_SERVICE_E2E_REDIS_DB
APP_SERVICE_E2E_REDIS_ISOLATED=1
APP_SERVICE_E2E_RUNTIME_ROOT
APP_SERVICE_E2E_PM2_HOME
APP_SERVICE_E2E_RUNTIME_USER
```

Optional connection and range settings are `APP_SERVICE_E2E_REDIS_HOST`, `APP_SERVICE_E2E_REDIS_PORT`, `APP_SERVICE_E2E_REDIS_PASSWORD`, `APP_SERVICE_E2E_PM2_COMMAND`, `APP_SERVICE_E2E_PORT_MIN`, and `APP_SERVICE_E2E_PORT_MAX`.

```powershell
cd server
pnpm.cmd run verify:app-service-runtime-live-e2e
```

The live gate refuses Windows/macOS, a root runtime user, Redis DB `0`, a non-empty Redis database, production-like database names, runtime or PM2 paths inside the repository, shared/non-empty PM2 state, and missing isolation settings. It never uses `sudo`, shell mode, dependency installation, lifecycle scripts, or request-provided commands.

Production rollout follows [app-service-runtime-baota.md](deployment/app-service-runtime-baota.md). Keep `APP_SERVICE_RUNTIME_ENABLED=false` until backup, migrations, non-login user, directory modes, loopback-only ports, host firewall rules, candidate smoke, rollback readiness, and a 15-minute observation window are complete.

The live gate is environment-blocked in ordinary Windows development sessions and must not be bypassed. Record either a green disposable Linux run or the exact missing isolation prerequisites before production enablement.

Current local environment evidence on 2026-07-12:

- MySQL and Redis CLI executables are available.
- The required `APP_RUNTIME_E2E_*` database, seeded platform identity, isolated Redis, HTTP, webhook, and redirect fixture variables are not configured in this worktree session.
- The live E2E was therefore not started. No database name, credential, Redis DB, or public upstream was guessed, and no shared resource was touched.

## P11 Certified Developer Service Verification - 2026-07-13

Deterministic gate:

```powershell
cd server
pnpm.cmd run verify:app-developer-service-live-e2e-contract
pnpm.cmd exec jest app-developer-service-entities.spec.ts create-certified-developer-service-runtime.spec.ts app-developer-certification.service.spec.ts app-developer-profile.controller.spec.ts app-developer-certification.controller.spec.ts seed-certified-developer-service-menus.spec.ts app-review-snapshot.service.spec.ts app-developer.service.spec.ts app-developer.controller.spec.ts app-platform.service.spec.ts app-service-package.service.spec.ts app-service-runtime.service.spec.ts app-service-platform.controller.spec.ts app-service-invocation-policy.service.spec.ts app-runtime.constants.spec.ts app-runtime.controller.spec.ts app-service-loopback.transport.spec.ts --runInBand
pnpm.cmd run build

cd ../web
pnpm.cmd run verify:app-developer-readiness
pnpm.cmd run verify:app-service-runtime-readiness
pnpm.cmd run verify:app-developer-service-readiness
pnpm.cmd run verify:app-runtime-sdk
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run build

cd ..
node scripts/run-saas-readiness.cjs
git diff --check
```

The contract verifies Linux-only execution, disposable MySQL and isolated Redis ownership, a non-root runtime user, runtime and PM2 paths outside the repository and production roots, initially disabled feature flags, two distinct platform reviewers, a distinct certified developer, immutable service submission snapshots, independent candidate review, same-tenant invocation, undeclared/foreign-tenant/foreign-developer denial, disabled/expired certification denial, quota and circuit rejection, P10 administrator-service compatibility, payload-free metrics, bounded redacted logs, signal cleanup, and zero owned PM2/release/database/Redis residue.

Run the live gate only from Linux with the protected environment names documented in [app-developer-service-runtime-baota.md](deployment/app-developer-service-runtime-baota.md):

```powershell
cd server
pnpm.cmd run verify:app-developer-service-live-e2e
```

The gate refuses Windows/macOS, Redis DB `0`, a non-empty Redis logical database, production-like database names, root runtime users, shared or non-empty PM2 state, runtime paths inside the repository or production roots, and missing isolation variables. It does not use `sudo`, shell mode, dependency installers, lifecycle scripts, request-provided commands, or credential output.

Keep `APP_DEVELOPER_SERVICE_ENABLED` disabled in production until migrations, two-reviewer readiness, the P10/P9 regression gates, host firewall rules, candidate health, tenant install/consent, seven-day retention, circuit visibility, rollback readiness, and a 15-minute observation window are complete.

Current local environment evidence on 2026-07-13:

- The P11 live script parses and exits before resource creation when the required `APP_DEVELOPER_SERVICE_E2E_*` isolation variables are absent.
- This Windows worktree is not a valid live environment; no database, Redis DB, PM2 home, runtime directory, reviewer credential, or tenant identity was guessed.
- A green disposable Linux run remains required before production enablement.

## P12 Application Commerce Verification - 2026-07-13

Deterministic gate:

```powershell
cd server
pnpm.cmd run verify:app-commerce-live-e2e-contract
pnpm.cmd run test -- app-commerce-entities.spec.ts create-app-commercialization.spec.ts seed-app-commercialization-menus.spec.ts app-price-plan.service.spec.ts app-license-access.service.spec.ts app-order.service.spec.ts app-revenue-ledger.service.spec.ts app-settlement.service.spec.ts app-commerce-platform.controller.spec.ts app-commerce-tenant.controller.spec.ts app-commerce-developer.controller.spec.ts saas-payment.service.spec.ts saas-payment.controller.spec.ts app-tenant.service.spec.ts app-runtime-session.service.spec.ts app-service-invocation-policy.service.spec.ts saas-provisioning.service.spec.ts --runInBand
pnpm.cmd run verify:saas-readiness
pnpm.cmd run build

cd ../web
pnpm.cmd run verify:app-commerce-readiness
pnpm.cmd run verify:app-developer-readiness
pnpm.cmd run verify:app-developer-service-readiness
pnpm.cmd run verify:app-runtime-sdk
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run verify:saas-readiness
pnpm.cmd run build
```

The contract verifies a disabled-first feature launch, disposable MySQL ownership, atomic isolated non-zero Redis ownership, legacy/free/included/paid access, a single-use trial, backend-owned order snapshots, cross-tenant denial, development payment replay safety, runtime invalidation after expiry/refund/revocation/uninstall, immutable refund ledger values, developer ownership isolation, manual settlement transitions, signal cleanup, and zero owned database/Redis residue.

Run the live gate only on Linux with these protected variable names. Do not print or persist their values:

```text
APP_COMMERCE_E2E_DB_HOST
APP_COMMERCE_E2E_DB_PORT
APP_COMMERCE_E2E_DB_USERNAME
APP_COMMERCE_E2E_DB_PASSWORD
APP_COMMERCE_E2E_PLATFORM_USERNAME
APP_COMMERCE_E2E_PLATFORM_PASSWORD
APP_COMMERCE_E2E_REDIS_HOST
APP_COMMERCE_E2E_REDIS_PORT
APP_COMMERCE_E2E_REDIS_PASSWORD
APP_COMMERCE_E2E_REDIS_DB
APP_COMMERCE_E2E_REDIS_ISOLATED
```

```powershell
cd server
pnpm.cmd run verify:app-commerce-live-e2e
```

The live gate refuses Windows/macOS, Redis DB `0`, non-isolated or non-empty Redis state, production-like database names, and missing protected variables before creating resources. It starts the disposable backend with `APP_COMMERCE_ENABLED` false, restarts the same database with the flag true, keeps `NODE_ENV` set to test, uses only the development payment confirmation route, and never calls the Alipay network.

Production rollout follows [app-commerce-baota.md](deployment/app-commerce-baota.md). Keep `APP_COMMERCE_ENABLED` disabled until backup, migration, callback reachability, internal free/paid smoke, developer share review, full refund recording, manual settlement review, rollback readiness, and a 15-minute observation window are complete.

Current local environment evidence on 2026-07-13:

- The P12 live script parses and exits before resource creation on Windows.
- No database, Redis logical database, platform identity, credential, application code, order, provider reference, or production path was guessed.
- A green disposable Linux run remains required before production enablement.

## Known Out-of-Scope Items

- Invoice functionality is intentionally excluded.
- Coupons, tax, foreign currency, usage charging, automatic renewal, stored payment methods, automatic payout, invoices, and app-store SEO landing pages remain intentionally excluded.
- External payment settlement still depends on real Alipay credentials and callback reachability.
- The automated browser smoke verifies public signup rendering and protected-route login redirects. Seeded browser UI order and development-payment coverage is available through the optional live browser E2E gate, but remains outside the default repository gate because it depends on live seeded data and mutates orders.
