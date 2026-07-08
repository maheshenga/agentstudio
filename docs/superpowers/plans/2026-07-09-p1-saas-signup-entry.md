# P1 SaaS Signup Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the login page's "register" entry explicitly route new users to the SaaS tenant signup flow while keeping the legacy `/auth/register` compatibility route available.

**Architecture:** Update the existing static readiness script to assert the login page links to the stable `SaasSignup` route. Then change only the login page RouterLink target from `Register` to `SaasSignup`; `/auth/register` remains a wrapper around the SaaS signup component for backward compatibility.

**Tech Stack:** Vue 3, Vue Router named routes, TypeScript static readiness scripts, existing `pnpm.cmd run verify:saas-readiness`.

## Global Constraints

- Do not remove `/auth/register`; it remains a compatibility route.
- Do not change signup API payloads, backend provisioning, password policy, or login behavior.
- Use TDD: update the readiness assertion first, run it red, change the Vue link, then run it green.
- Keep scope to `web/src/views/auth/login/index.vue`, `web/scripts/verify-saas-signup-activation.ts`, and this plan unless verification shows a related wiring gap.

---

### Task 1: Add Signup Entry Contract

**Files:**
- Modify: `web/scripts/verify-saas-signup-activation.ts`

**Interfaces:**
- Consumes: `web/src/views/auth/login/index.vue`.
- Produces: A failing assertion until the login page RouterLink uses `{ name: 'SaasSignup' }`.

- [ ] **Step 1: Write the failing assertion**

Add this assertion after the existing login source assertions:

```ts
assert(
  loginSource.includes(":to=\"{ name: 'SaasSignup' }\""),
  'login page register link must route directly to SaaS signup'
)
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-signup-activation.ts
```

Expected: FAIL with `login page register link must route directly to SaaS signup`.

### Task 2: Point Login Register Link To SaaS Signup

**Files:**
- Modify: `web/src/views/auth/login/index.vue`

**Interfaces:**
- Consumes: named route `SaasSignup` from `web/src/router/routes/staticRoutes.ts`.
- Produces: Login page "register" link routes to `/#/saas/signup`.

- [ ] **Step 1: Change the RouterLink target**

Replace:

```vue
<RouterLink class="text-theme" :to="{ name: 'Register' }">{{
```

with:

```vue
<RouterLink class="text-theme" :to="{ name: 'SaasSignup' }">{{
```

- [ ] **Step 2: Run focused verification**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-signup-activation.ts
```

Expected: PASS.

### Task 3: Full Verification, Review, Commit

**Files:**
- Review changed files from Tasks 1 and 2.

**Interfaces:**
- Consumes: Task 1 and Task 2 outputs.
- Produces: A committed P1 signup entry slice.

- [ ] **Step 1: Run frontend SaaS readiness**

Run:

```powershell
cd web
pnpm.cmd run verify:saas-readiness
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run:

```powershell
cd web
pnpm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Review diff**

Run:

```powershell
git diff --check
git diff --stat
git diff -- web/src/views/auth/login/index.vue web/scripts/verify-saas-signup-activation.ts
```

Expected: no whitespace errors; only the route target and assertion changed.

- [ ] **Step 4: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-09-p1-saas-signup-entry.md web/scripts/verify-saas-signup-activation.ts web/src/views/auth/login/index.vue
git commit -m "fix: route login signup entry to saas signup"
```

Expected: commit succeeds and working tree is clean.

## Self-Review

- Spec coverage: The plan improves the new-user path from login to SaaS registration while preserving the compatibility register route.
- Placeholder scan: No TBD/TODO/later placeholders remain.
- Type consistency: The asserted route name `SaasSignup` already exists in `staticRoutes.ts`.
