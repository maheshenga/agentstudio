# P0 SaaS Launch Flow Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a launch-readiness regression pack that verifies the SaaS user, tenant-admin, and platform-admin flow is wired end to end.

**Architecture:** Keep this P0 as a non-invasive readiness gate. Add one frontend static verification script that checks critical pages, API exports, API URLs, and backend controller bindings; add one checklist document that defines manual acceptance paths and release commands.

**Tech Stack:** Vue 3, TypeScript, Node/tsx verification scripts, NestJS, Jest, pnpm.

## Global Constraints

- Do not use subagents unless the user explicitly requests them again.
- Do not push to remote unless explicitly requested after this P0 is committed.
- Do not change business behavior in this P0 unless the verification script exposes a missing critical binding.
- Keep verification text mostly ASCII to avoid Windows PowerShell encoding confusion.
- Use `apply_patch` for manual file edits.
- Verify with fresh commands before committing.

---

### Task 1: Add SaaS Launch Flow Verification Script

**Files:**
- Create: `web/scripts/verify-saas-launch-flow-readiness.ts`

**Interfaces:**
- Consumes: frontend source files under `web/src` and backend source files under `server/src`.
- Produces: a CLI verification script runnable from `web/` with `pnpm.cmd exec tsx scripts/verify-saas-launch-flow-readiness.ts`.

- [x] **Step 1: Write the failing verification script**

```typescript
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(process.cwd(), '..')
const webRoot = resolve(repoRoot, 'web')
const serverRoot = resolve(repoRoot, 'server')
const failures: string[] = []

function readProjectFile(root: string, path: string): string {
  const fullPath = resolve(root, path)
  if (!existsSync(fullPath)) {
    failures.push(`${path} must exist`)
    return ''
  }
  return readFileSync(fullPath, 'utf8')
}

function assertIncludes(source: string, token: string, label: string) {
  if (!source.includes(token)) {
    failures.push(`${label} must include ${token}`)
  }
}

function assertFileExists(root: string, path: string) {
  if (!existsSync(resolve(root, path))) {
    failures.push(`${path} must exist`)
  }
}

const requiredWebPages = [
  'src/views/saas/signup/index.vue',
  'src/views/auth/login/index.vue',
  'src/views/saas/tenant/usage/index.vue',
  'src/views/saas/tenant/plan/index.vue',
  'src/views/saas/tenant/modules/index.vue',
  'src/views/saas/tenant/member/index.vue',
  'src/views/saas/tenant/resource-pack/index.vue',
  'src/views/saas/platform/tenant/index.vue',
  'src/views/saas/platform/plan/index.vue',
  'src/views/saas/platform/module/index.vue',
  'src/views/saas/platform/subscription/index.vue',
  'src/views/saas/platform/usage/index.vue',
  'src/views/saas/platform/revenue/index.vue',
  'src/views/saas/platform/resource-pack/index.vue',
  'src/views/saas/platform/resource-pack-order/index.vue',
  'src/views/saas/platform/payment-config/index.vue'
]

for (const page of requiredWebPages) {
  assertFileExists(webRoot, page)
}

const staticRoutesSource = readProjectFile(webRoot, 'src/router/routes/staticRoutes.ts')
for (const token of ["path: '/auth/login'", "path: '/auth/register'", "path: '/saas/signup'"]) {
  assertIncludes(staticRoutesSource, token, 'static auth/signup routes')
}

const apiSource = readProjectFile(webRoot, 'src/api/saas.ts')
const systemModuleApiSource = readProjectFile(webRoot, 'src/api/system-module.ts')
for (const token of [
  "url: '/api/saas/signup'",
  "url: '/api/saas/tenant/usage'",
  "url: '/api/saas/tenant/subscription'",
  "url: '/api/saas/tenant/plans'",
  "url: '/api/saas/tenant/orders'",
  "url: '/api/saas/tenant/members'",
  "url: '/api/saas/tenant/resource-packs'",
  "url: '/api/saas/tenant/resource-pack-orders'",
  "url: '/api/saas/payment/alipay/create'",
  "url: '/api/saas/payment/alipay/config-status'",
  "url: '/api/saas/platform/tenants'",
  "url: '/api/saas/platform/usage/overview'",
  "url: '/api/saas/platform/revenue/overview'",
  "url: '/api/saas/platform/orders'",
  "url: '/api/saas/platform/subscriptions'",
  "url: '/api/saas/platform/plans'",
  "url: '/api/saas/platform/modules'",
  "url: '/api/saas/platform/resource-packs'",
  "url: '/api/saas/platform/resource-pack-orders'",
  "url: '/api/saas/platform/payment/alipay/config'"
]) {
  assertIncludes(apiSource, token, 'saas api')
}

assertIncludes(systemModuleApiSource, "url: '/api/tenant/modules'", 'tenant system module api')

for (const token of [
  'signupTenant',
  'fetchTenantUsage',
  'fetchTenantSubscription',
  'fetchTenantPlans',
  'createTenantUpgradeOrder',
  'fetchTenantMembers',
  'createTenantMember',
  'fetchTenantResourcePacks',
  'createTenantResourcePackOrder',
  'createAlipayPayment',
  'fetchAlipayConfigStatus',
  'createSaasTenantFromPlatform',
  'fetchPlatformTenants',
  'fetchPlatformUsageOverview',
  'fetchPlatformRevenueOverview',
  'fetchPlatformOrders',
  'fetchPlatformSubscriptions',
  'fetchPlatformPlans',
  'fetchPlatformModules',
  'fetchPlatformResourcePacks',
  'fetchPlatformResourcePackOrders',
  'fetchPlatformAlipayConfig',
  'updatePlatformAlipayConfig'
]) {
  assertIncludes(apiSource, `export function ${token}`, 'saas api export')
}

assertIncludes(systemModuleApiSource, 'export function fetchTenantSystemModules', 'tenant system module api export')

const signupPage = readProjectFile(webRoot, 'src/views/saas/signup/index.vue')
assertIncludes(signupPage, 'signupTenant', 'signup page')
assertIncludes(signupPage, "signup_success: '1'", 'signup success activation')
assertIncludes(signupPage, "name: 'Login'", 'signup success login route')

const loginPage = readProjectFile(webRoot, 'src/views/auth/login/index.vue')
assertIncludes(loginPage, 'route.query.signup_success', 'login activation alert')
assertIncludes(loginPage, 'formData.username = signupUsername', 'login username prefill')
assertIncludes(loginPage, 'fetchLogin(loginParams)', 'login submit')

const tenantUsagePage = readProjectFile(webRoot, 'src/views/saas/tenant/usage/index.vue')
for (const token of ['fetchTenantUsage', 'fetchTenantQuotaLedgers']) {
  assertIncludes(tenantUsagePage, token, 'tenant usage page')
}

const tenantPlanPage = readProjectFile(webRoot, 'src/views/saas/tenant/plan/index.vue')
for (const token of ['fetchTenantPlans', 'createTenantUpgradeOrder', 'createAlipayPayment', 'fetchAlipayConfigStatus']) {
  assertIncludes(tenantPlanPage, token, 'tenant plan page')
}

const tenantModulesPage = readProjectFile(webRoot, 'src/views/saas/tenant/modules/index.vue')
assertIncludes(tenantModulesPage, 'fetchTenantSystemModules', 'tenant modules page')

const tenantMemberPage = readProjectFile(webRoot, 'src/views/saas/tenant/member/index.vue')
for (const token of ['fetchTenantMembers', 'createTenantMember', 'changeTenantMemberRole', 'updateTenantMemberStatus', 'removeTenantMember', 'resetTenantMemberPassword']) {
  assertIncludes(tenantMemberPage, token, 'tenant member page')
}

const tenantResourcePackPage = readProjectFile(webRoot, 'src/views/saas/tenant/resource-pack/index.vue')
for (const token of ['fetchTenantResourcePacks', 'createTenantResourcePackOrder', 'fetchTenantResourcePackOrders', 'createAlipayPayment', 'fetchAlipayConfigStatus', 'tenant-resource-pack-page__payment-status']) {
  assertIncludes(tenantResourcePackPage, token, 'tenant resource pack page')
}

const platformTenantPage = readProjectFile(webRoot, 'src/views/saas/platform/tenant/index.vue')
for (const token of ['fetchPlatformTenants', 'createSaasTenantFromPlatform', '<ElTable', '<ElPagination', '<ElDialog']) {
  assertIncludes(platformTenantPage, token, 'platform tenant page')
}

const platformPlanPage = readProjectFile(webRoot, 'src/views/saas/platform/plan/index.vue')
for (const token of ['fetchPlatformPlans', 'createPlatformPlan', 'updatePlatformPlan', 'updatePlatformPlanStatus', 'updatePlatformPlanQuotas']) {
  assertIncludes(platformPlanPage, token, 'platform plan page')
}

const platformModulePage = readProjectFile(webRoot, 'src/views/saas/platform/module/index.vue')
for (const token of ['fetchPlatformModules', 'createPlatformModule', 'updatePlatformModule', 'updatePlatformModuleStatus']) {
  assertIncludes(platformModulePage, token, 'platform module page')
}

const platformSubscriptionPage = readProjectFile(webRoot, 'src/views/saas/platform/subscription/index.vue')
for (const token of ['fetchPlatformSubscriptions', 'fetchPlatformOrders', 'fetchPlatformOrderRiskOverview', 'fetchPlatformSubscriptionLifecycleOverview']) {
  assertIncludes(platformSubscriptionPage, token, 'platform subscription page')
}

const platformUsagePage = readProjectFile(webRoot, 'src/views/saas/platform/usage/index.vue')
for (const token of ['fetchPlatformUsageOverview', 'fetchPlatformPaymentReconciliationOverview', 'scanPlatformPaymentReconciliation', 'fetchPlatformQuotaLedgers']) {
  assertIncludes(platformUsagePage, token, 'platform usage page')
}

const platformPaymentConfigPage = readProjectFile(webRoot, 'src/views/saas/platform/payment-config/index.vue')
for (const token of ['fetchPlatformAlipayConfig', 'updatePlatformAlipayConfig']) {
  assertIncludes(platformPaymentConfigPage, token, 'platform payment config page')
}

const publicController = readProjectFile(serverRoot, 'src/module/saas/saas-public.controller.ts')
assertIncludes(publicController, '@Public()', 'saas public signup controller')
assertIncludes(publicController, "@Post('signup')", 'saas public signup controller')
assertIncludes(publicController, 'this.provisioning.signup(body)', 'saas public signup controller')

const tenantController = readProjectFile(serverRoot, 'src/module/saas/saas-tenant.controller.ts')
for (const token of [
  "@Get('usage')",
  "@Get('subscription')",
  "@Get('plans')",
  "@Post('orders')",
  "@Get('modules')",
  "@Get('members')",
  "@Post('members')",
  "@Get('resource-packs')",
  "@Post('resource-pack-orders')",
  "@Get('resource-pack-orders')"
]) {
  assertIncludes(tenantController, token, 'saas tenant controller')
}

const platformController = readProjectFile(serverRoot, 'src/module/saas/saas-platform.controller.ts')
for (const token of [
  "@Get('tenants')",
  "@Post('tenants')",
  "@Get('usage/overview')",
  "@Get('revenue/overview')",
  "@Get('subscriptions')",
  "@Get('plans')",
  "@Get('modules')",
  "@Get('resource-packs')",
  "@Get('resource-pack-orders')",
  "@Get('payment/alipay/config')",
  "@Put('payment/alipay/config')"
]) {
  assertIncludes(platformController, token, 'saas platform controller')
}

const paymentController = readProjectFile(serverRoot, 'src/module/saas/saas-payment.controller.ts')
assertIncludes(paymentController, "@Controller('api/saas/payment')", 'saas payment controller')
for (const token of ["@Post('alipay/create')", "@Get('alipay/config-status')", "@Post('dev-confirm')"]) {
  assertIncludes(paymentController, token, 'saas payment controller')
}

const moduleManifest = readProjectFile(serverRoot, 'src/module/system-module/manifests/built-in-modules.ts')
for (const token of ['saas_platform', 'tenant_saas', '/saas-platform/usage', '/tenant-saas/usage', '/api/saas/platform', '/api/saas/tenant']) {
  assertIncludes(moduleManifest, token, 'system module manifest')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS launch flow readiness verified.')
```

- [x] **Step 2: Run script to verify it fails**

Run: `cd web && pnpm.cmd exec tsx scripts/verify-saas-launch-flow-readiness.ts`

Expected: FAIL because `web/scripts/verify-saas-launch-flow-readiness.ts` does not exist yet before this task is implemented.

### Task 2: Add SaaS Launch Readiness Checklist

**Files:**
- Create: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: current SaaS system capabilities.
- Produces: a manual launch-readiness checklist that product, engineering, and QA can run before demo or release.

- [x] **Step 1: Create the checklist document**

Add sections:

```markdown
# SaaS Launch Readiness Checklist

## Purpose

This checklist verifies the AgentStudio SaaS system is ready for local demo, QA acceptance, and pre-release review.

## Roles

- Visitor: can open registration and create a tenant account.
- Tenant owner: can log in, see subscription, usage, enabled modules, members, and resource packs.
- Platform admin: can manage tenants, plans, modules, subscriptions, usage, revenue, resource packs, and Alipay settings.

## Automated Gates

- `cd web && pnpm.cmd exec tsx scripts/verify-saas-launch-flow-readiness.ts`
- `cd web && pnpm.cmd exec tsx scripts/verify-saas-signup-activation.ts`
- `cd web && pnpm.cmd exec tsx scripts/verify-saas-platform-tenant-page.ts`
- `cd web && pnpm.cmd exec tsx scripts/verify-saas-payment-path-copy.ts`
- `cd web && pnpm.cmd build`
- `cd server && pnpm.cmd test -- saas-main-flow.integration.spec.ts saas-route-consistency.spec.ts saas-tenant.controller.spec.ts saas-platform.controller.spec.ts saas-payment.controller.spec.ts --runInBand --forceExit`

## Manual Visitor Flow

1. Open `/#/saas/signup`.
2. Register a new tenant owner with username, real name, tenant name, phone, email, and a password that satisfies the password policy.
3. Confirm the app redirects to `/#/auth/login?signup_success=1&username=<username>`.
4. Confirm the login page shows the signup success alert and pre-fills username.

## Manual Tenant Owner Flow

1. Log in with tenant owner credentials and select the created tenant.
2. Open `/#/tenant-saas/usage` and confirm quota summary and ledger sections render.
3. Open `/#/tenant-saas/plan` and confirm plan list, current subscription, payment action, and payment configuration state render.
4. Open `/#/tenant-saas/modules` and confirm enabled modules render.
5. Open `/#/tenant-saas/members` and confirm member list, create, role/status update, reset password, and remove controls render according to permissions.
6. Open `/#/tenant-saas/resource-packs` and confirm resource packs, order history, Alipay status, and payment/cancel actions render.

## Manual Platform Admin Flow

1. Open `/#/saas-platform/tenants` and confirm tenant list, filters, pagination, and create-tenant dialog render.
2. Open `/#/saas-platform/plans` and confirm plan CRUD, status, quotas, and module assignment render.
3. Open `/#/saas-platform/module` and confirm module CRUD/status controls render.
4. Open `/#/saas-platform/subscription` and confirm subscription lifecycle, orders, and risk summary render.
5. Open `/#/saas-platform/usage` and confirm KPI cards, quota ledger, reconciliation scan, and recent order sections render.
6. Open `/#/saas-platform/revenue` and confirm revenue KPI, split, trend, top tenants, and recent paid orders render.
7. Open `/#/saas-platform/resource-packs` and `/#/saas-platform/resource-pack-orders` and confirm catalog/order operations render.
8. Open `/#/saas-platform/payment-config` and confirm Alipay config status and edit form render.

## Acceptance Criteria

- All automated gates exit with code 0.
- No critical SaaS page routes to 404.
- All tenant-owned APIs require tenant context and permissions.
- Platform admin APIs are not tenant-scoped.
- Resource-pack and plan payment paths show whether Alipay is configured before a user attempts payment.
- Empty, loading, and error states are visible for tenant and platform pages.
```

- [x] **Step 2: Ensure the checklist references the new verification script**

Run: `rg -n "verify-saas-launch-flow-readiness" docs/saas-launch-readiness-checklist.md`

Expected: one or more matches.

### Task 3: Verify, Review, Commit

**Files:**
- Test: `web/scripts/verify-saas-launch-flow-readiness.ts`
- Test: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: completed verification script and checklist.
- Produces: verified git commit.

- [x] **Step 1: Run new launch flow verification**

Run: `cd web && pnpm.cmd exec tsx scripts/verify-saas-launch-flow-readiness.ts`

Expected: PASS with `SaaS launch flow readiness verified.`

- [x] **Step 2: Run existing frontend SaaS verification scripts**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-signup-activation.ts
pnpm.cmd exec tsx scripts/verify-saas-platform-tenant-page.ts
pnpm.cmd exec tsx scripts/verify-saas-payment-path-copy.ts
pnpm.cmd exec tsx scripts/verify-no-legacy-saiadmin-composable.ts
pnpm.cmd exec tsx scripts/verify-saas-public-brand-surfaces.ts
```

Expected: all commands exit 0.

- [x] **Step 3: Run backend SaaS focused tests**

Run:

```powershell
cd server
pnpm.cmd test -- saas-main-flow.integration.spec.ts saas-route-consistency.spec.ts saas-tenant.controller.spec.ts saas-platform.controller.spec.ts saas-payment.controller.spec.ts --runInBand --forceExit
```

Expected: all selected tests pass.

- [x] **Step 4: Run frontend build**

Run: `cd web && pnpm.cmd build`

Expected: PASS.

- [x] **Step 5: Review diff**

Run: `git diff --check` and `git diff --stat`.

Expected: no whitespace errors and only the plan, checklist, and verification script changed.

- [x] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-07-07-p0-saas-launch-flow-readiness.md docs/saas-launch-readiness-checklist.md web/scripts/verify-saas-launch-flow-readiness.ts
git commit -m "test: add saas launch readiness gate"
```
