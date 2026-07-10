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
- App analytics accept only 7, 30, or 90 day windows, default to 30 days, and aggregate installs separately from opens to avoid inflated counts.
- Platform overview and per-app detail include installs, open outcomes, entitlement blockers, tenant/user reach, trends, version adoption, and bounded sanitized failures.
- Tenant usage includes enabled apps, open outcomes, entitlement blockers, trends, installed-app usage, and version adoption without tenant ids or user ids in the UI response.
- Analytics responses and pages expose no authorization values, cookies, tokens, IP addresses, user agents, raw exception text, or request failure objects.
- Recent failure lists are capped at 20 rows and per-app tenant adoption is capped at 100 rows.
- The app analytics menu migration is insert-idempotent. Schema and menu rollback contracts are covered by migration specs and must be exercised on a disposable database before production.
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

P2 performance follow-up:

- Run MySQL `EXPLAIN` with representative `app_open_log` volume. Consider dedicated `create_time` and `(app_code, create_time)` indexes if platform window scans become expensive.
- Add pagination or explicit result caps if the published-app list or tenant version-adoption result can grow beyond the current operational dashboard scale.

## Known Out-of-Scope Items

- Invoice functionality is intentionally excluded.
- Backend-executable service plugins, app revenue sharing, and app-store SEO landing pages are intentionally excluded from P0.
- External payment settlement still depends on real Alipay credentials and callback reachability.
- The automated browser smoke verifies public signup rendering and protected-route login redirects. Seeded browser UI order and development-payment coverage is available through the optional live browser E2E gate, but remains outside the default repository gate because it depends on live seeded data and mutates orders.
