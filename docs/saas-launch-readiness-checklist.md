# SaaS Launch Readiness Checklist

## Purpose

This checklist verifies the AgentStudio SaaS system is ready for local demo, QA acceptance, and pre-release review.

## Roles

- Visitor: can open registration and create a tenant owner account.
- Tenant owner: can log in, view subscription, usage, enabled modules, members, and resource packs.
- Platform admin: can manage tenants, plans, modules, subscriptions, usage, revenue, resource packs, resource-pack orders, and Alipay settings.

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

## Acceptance Criteria

- All automated gates exit with code 0.
- No critical SaaS page routes to 404.
- All tenant-owned APIs require tenant context and permissions.
- Platform admin APIs are not tenant-scoped.
- Tenant modules flow uses the system-module registry endpoint `GET /api/tenant/modules`.
- Resource-pack and plan payment paths show whether Alipay is configured before a user attempts payment.
- Empty, loading, and error states are visible for tenant and platform pages.
- If PowerShell `Get-Content` displays Chinese as mojibake, verify with Node UTF-8 reads or run `verify-saas-visible-copy-encoding.ts` before editing source files. The browser/Vite path reads these source files as UTF-8.

## Known Out-of-Scope Items

- Invoice functionality is intentionally excluded.
- External payment settlement still depends on real Alipay credentials and callback reachability.
- The automated browser smoke verifies public signup rendering and protected-route login redirects. Seeded browser UI order and development-payment coverage is available through the optional live browser E2E gate, but remains outside the default repository gate because it depends on live seeded data and mutates orders.
