# P1 SaaS Activation And Tenant Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the SaaS user activation path and give platform admins a basic tenant operations list instead of a create-only tenant page.

**Architecture:** Add a narrow platform tenant listing API under the existing SaaS platform controller/service. Keep the frontend in the existing Element Plus admin style. Add small script-based frontend verifications because the web app does not currently use a full test runner.

**Tech Stack:** NestJS, TypeORM, Jest, Vue 3, Element Plus, TypeScript, tsx.

## Global Constraints

- Worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.
- Do not push to remote.
- Do not rewrite unrelated SaaS pages.
- Keep all tenant-ops APIs platform-scoped and wrapped in `runOutsideTenant`.
- Keep UI as a compact admin console, not a marketing page.
- Use TDD or verification-first scripts before production changes.

---

## File Structure

- Modify: `server/src/module/saas/services/saas-platform.service.ts`
  - Add `listTenants()` with tenant status, user count, and latest subscription plan summary.
- Modify: `server/src/module/saas/services/saas-platform.service.spec.ts`
  - Cover tenant list aggregation and pagination.
- Modify: `server/src/module/saas/saas-platform.controller.ts`
  - Add `GET /api/saas/platform/tenants`.
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`
  - Cover controller delegation for tenant listing.
- Modify: `server/src/module/saas/saas.module.ts`
  - Register `TenantEntity` and `SysUserTenantEntity` repositories for SaaS platform tenant ops.
- Modify: `web/src/api/saas.ts`
  - Add tenant list types and `fetchPlatformTenants()`.
- Modify: `web/src/views/saas/platform/tenant/index.vue`
  - Upgrade the page from create-only form to list + create dialog.
- Create: `web/scripts/verify-saas-platform-tenant-page.ts`
  - Verify API and UI wiring for the platform tenant page.
- Modify: `web/src/views/saas/signup/index.vue`
  - Route successful signup to login with activation query params.
- Modify: `web/src/views/auth/login/index.vue`
  - Prefill username from signup query and show a lightweight success alert.
- Create: `web/scripts/verify-saas-signup-activation.ts`
  - Verify signup and login activation wiring.

---

## Task 1: Platform Tenant Operations List

**Files:**
- Modify: `server/src/module/saas/services/saas-platform.service.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.spec.ts`
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`
- Modify: `server/src/module/saas/saas.module.ts`

**Interfaces:**
- Produces: `SaasPlatformService.listTenants(query)`.
- Produces: `GET /api/saas/platform/tenants`.
- Response shape:

```ts
{
  list: Array<{
    id: number
    tenant_name: string
    tenant_code: string
    contact_name: string
    contact_phone: string
    contact_email: string
    status: number
    user_count: number
    plan_id: number | null
    plan_code: string
    plan_name: string
    subscription_status: string
    subscription_end_time: Date | null
    create_time: Date | null
  }>
  total: number
  page: number
  limit: number
}
```

- [ ] **Step 1: Write failing backend service test**

Add a test to `saas-platform.service.spec.ts` that constructs tenant rows, subscription rows, plan rows, and user-count rows. Expected output must include `user_count`, `plan_code`, `plan_name`, and `subscription_status`.

Run from `server`:

```powershell
pnpm.cmd test -- saas-platform.service.spec.ts --runInBand --forceExit
```

Expected: FAIL because `listTenants` does not exist.

- [ ] **Step 2: Implement service list method**

Inject `TenantEntity` and `SysUserTenantEntity`, add `listTenants()`, aggregate:

- paginated tenants ordered by newest id
- user counts from `sa_system_user_tenant`
- latest subscription per tenant
- plan code/name from `saas_plan`

- [ ] **Step 3: Run service test**

Run from `server`:

```powershell
pnpm.cmd test -- saas-platform.service.spec.ts --runInBand --forceExit
```

Expected: PASS.

- [ ] **Step 4: Write failing controller test**

Add a controller spec asserting `controller.listTenants({ page: '1' }, user)` delegates to `platformService.listTenants()`.

Run from `server`:

```powershell
pnpm.cmd test -- saas-platform.controller.spec.ts --runInBand --forceExit
```

Expected: FAIL because controller method does not exist.

- [ ] **Step 5: Implement controller and module wiring**

Add `@Get('tenants')` before `@Post('tenants')`, permission `saas:tenant:index`, and register the two repositories in `SaasModule`.

- [ ] **Step 6: Run controller test**

Run from `server`:

```powershell
pnpm.cmd test -- saas-platform.controller.spec.ts --runInBand --forceExit
```

Expected: PASS.

---

## Task 2: Platform Tenant Page List + Create Dialog

**Files:**
- Modify: `web/src/api/saas.ts`
- Modify: `web/src/views/saas/platform/tenant/index.vue`
- Create: `web/scripts/verify-saas-platform-tenant-page.ts`

**Interfaces:**
- Produces: `fetchPlatformTenants(params)`.
- Page behavior:
  - Shows tenant list table by default.
  - Supports keyword/status filters.
  - Keeps create tenant form in a dialog.
  - Refreshes list after successful tenant creation.

- [ ] **Step 1: Write failing frontend verification script**

Create `web/scripts/verify-saas-platform-tenant-page.ts` to assert:

- `web/src/api/saas.ts` exports `fetchPlatformTenants`
- tenant API path is `/api/saas/platform/tenants`
- `platform/tenant/index.vue` imports `fetchPlatformTenants`
- page contains labels `租户运营`, `新建租户`, `当前套餐`, `成员数`

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-platform-tenant-page.ts
```

Expected: FAIL because the API and page list are missing.

- [ ] **Step 2: Add API types and function**

Add `SaasPlatformTenantRecord`, `SaasPlatformTenantListParams`, and `fetchPlatformTenants()`.

- [ ] **Step 3: Upgrade tenant page**

Replace the create-only page with:

- header title `租户运营`
- filter row
- create button
- tenant table
- pagination
- create dialog using existing form

- [ ] **Step 4: Run frontend verification**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-platform-tenant-page.ts
```

Expected: PASS.

---

## Task 3: Signup Activation Handoff To Login

**Files:**
- Modify: `web/src/views/saas/signup/index.vue`
- Modify: `web/src/views/auth/login/index.vue`
- Create: `web/scripts/verify-saas-signup-activation.ts`

**Interfaces:**
- Signup success routes to login with query:

```ts
{
  name: 'Login',
  query: {
    signup_success: '1',
    username: formData.username.trim()
  }
}
```

- Login page pre-fills username and shows a visible alert telling the user to use the password they just created.

- [ ] **Step 1: Write failing frontend verification script**

Create `web/scripts/verify-saas-signup-activation.ts` to assert:

- signup page includes `signup_success`
- signup page passes `username`
- login page reads `route.query.signup_success`
- login page renders an `ElAlert`
- login page pre-fills `formData.username`

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-signup-activation.ts
```

Expected: FAIL because activation wiring is missing.

- [ ] **Step 2: Update signup success route**

Change successful signup route to push login with activation query.

- [ ] **Step 3: Update login page**

Add a computed activation flag/message, render `ElAlert` above the login form, and prefill username from query on mount.

- [ ] **Step 4: Run frontend verification**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-signup-activation.ts
```

Expected: PASS.

---

## Final Verification

- [ ] Run backend focused tests:

```powershell
pnpm.cmd test -- saas-platform.service.spec.ts saas-platform.controller.spec.ts --runInBand --forceExit
```

- [ ] Run frontend verifications:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-platform-tenant-page.ts
pnpm.cmd exec tsx scripts/verify-saas-signup-activation.ts
pnpm.cmd exec tsx scripts/verify-saas-signup-password-policy.ts
pnpm.cmd exec tsx scripts/verify-saas-signup-route.ts
```

- [ ] Run frontend build:

```powershell
pnpm.cmd build
```

- [ ] Review diff and commit:

```powershell
git status --short
git diff --stat
git add server/src/module/saas/services/saas-platform.service.ts server/src/module/saas/services/saas-platform.service.spec.ts server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-platform.controller.spec.ts server/src/module/saas/saas.module.ts web/src/api/saas.ts web/src/views/saas/platform/tenant/index.vue web/src/views/saas/signup/index.vue web/src/views/auth/login/index.vue web/scripts/verify-saas-platform-tenant-page.ts web/scripts/verify-saas-signup-activation.ts docs/superpowers/plans/2026-07-07-p1-saas-activation-tenant-ops.md
git commit -m "feat: improve saas activation and tenant ops"
```
