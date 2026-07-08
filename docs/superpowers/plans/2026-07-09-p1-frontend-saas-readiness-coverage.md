# P1 Frontend SaaS Readiness Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the frontend SaaS readiness runner includes every existing high-value SaaS verification script, especially signup route, signup password policy, and the readiness-command self-check.

**Architecture:** Update the existing `verify-saas-readiness-command.ts` contract first so it fails against the current runner. Then add the missing scripts to `run-saas-readiness.ts` in the same order and sync the launch checklist's expanded frontend gate.

**Tech Stack:** Vue/Vite frontend utility scripts, `tsx`, Node `fs` reads, pnpm scripts, Markdown checklist.

## Global Constraints

- Worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.
- Branch: `saas-order-risk-ops`.
- Do not push unless the user explicitly asks.
- Do not change frontend runtime UI behavior.
- Keep this slice limited to readiness coverage, documentation, verification, review, and commit.
- Use TDD: update the command contract first, run it red, update the runner/docs, run green.

---

## File Structure

- Modify: `web/scripts/verify-saas-readiness-command.ts`
  - Owns the frontend readiness runner contract and expected script order.
- Modify: `web/scripts/run-saas-readiness.ts`
  - Runs the missing existing verification scripts.
- Modify: `web/scripts/verify-saas-signup-route.ts`
  - Keeps the signup route check aligned with the current SaaS signup page.
- Modify: `docs/saas-launch-readiness-checklist.md`
  - Documents the expanded frontend gate commands.

## Required Frontend Readiness Scripts

The contract and runner must include these scripts in order:

```ts
const expectedScripts = [
  'verify-saas-launch-flow-readiness.ts',
  'verify-saas-route-contract.ts',
  'verify-saas-ui-state-readiness.ts',
  'verify-saas-tenant-ui-state-readiness.ts',
  'verify-saas-visible-copy-encoding.ts',
  'verify-saas-signup-route.ts',
  'verify-saas-signup-password-policy.ts',
  'verify-saas-signup-activation.ts',
  'verify-saas-platform-tenant-page.ts',
  'verify-saas-payment-path-copy.ts',
  'verify-saas-resource-pack-crud.ts',
  'verify-no-legacy-saiadmin-composable.ts',
  'verify-saas-public-brand-surfaces.ts',
  'verify-saas-readiness-command.ts',
];
```

### Task 1: Strengthen Frontend Readiness Command Contract

**Files:**
- Modify: `web/scripts/verify-saas-readiness-command.ts`

**Interfaces:**
- Consumes: `web/scripts/run-saas-readiness.ts`.
- Produces: a script that fails when any required frontend readiness script is missing or out of order.

- [ ] **Step 1: Update `expectedScripts`**

Replace `expectedScripts` with the required list above.

- [ ] **Step 2: Run the contract script to verify RED**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: FAIL because the current runner omits `verify-saas-signup-route.ts`, `verify-saas-signup-password-policy.ts`, and `verify-saas-readiness-command.ts`.

### Task 2: Expand Frontend Readiness Runner

**Files:**
- Modify: `web/scripts/run-saas-readiness.ts`

**Interfaces:**
- Produces: `pnpm.cmd run verify:saas-readiness` runs all required frontend readiness scripts.

- [ ] **Step 1: Update runner `checks`**

Replace `checks` with the same required list:

```ts
const checks = [
  'verify-saas-launch-flow-readiness.ts',
  'verify-saas-route-contract.ts',
  'verify-saas-ui-state-readiness.ts',
  'verify-saas-tenant-ui-state-readiness.ts',
  'verify-saas-visible-copy-encoding.ts',
  'verify-saas-signup-route.ts',
  'verify-saas-signup-password-policy.ts',
  'verify-saas-signup-activation.ts',
  'verify-saas-platform-tenant-page.ts',
  'verify-saas-payment-path-copy.ts',
  'verify-saas-resource-pack-crud.ts',
  'verify-no-legacy-saiadmin-composable.ts',
  'verify-saas-public-brand-surfaces.ts',
  'verify-saas-readiness-command.ts'
]
```

- [ ] **Step 2: Run the contract script to verify GREEN**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: PASS.

### Task 3: Sync Launch Checklist

**Files:**
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Produces: manual frontend expanded-gate docs that match the runner.

- [ ] **Step 1: Add the missing frontend verification commands**

The expanded frontend gate block must include:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-signup-route.ts
pnpm.cmd exec tsx scripts/verify-saas-signup-password-policy.ts
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

- [ ] **Step 2: Confirm checklist mentions all three**

Run:

```powershell
Select-String -Path docs/saas-launch-readiness-checklist.md -Pattern 'verify-saas-signup-route|verify-saas-signup-password-policy|verify-saas-readiness-command'
```

Expected: three matches.

### Task 4: Align Signup Route Verification

**Files:**
- Modify: `web/scripts/verify-saas-signup-route.ts`

**Interfaces:**
- Consumes: `web/src/router/routes/staticRoutes.ts`.
- Produces: a route check that verifies `/saas/signup` uses the SaaS signup page and stable `SaasSignup` route name.

- [ ] **Step 1: Update stale component expectation**

Use:

```ts
assert(routeBlock.includes('@views/saas/signup/index.vue'), 'route alias must use SaaS signup page')
```

instead of expecting `@views/auth/register/index.vue`.

- [ ] **Step 2: Run the route script**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-signup-route.ts
```

Expected: PASS.

### Task 5: Verification, Review, and Commit

**Files:**
- Modify: all files listed above plus this plan.

**Interfaces:**
- Produces: one local commit on `saas-order-risk-ops`.

- [ ] **Step 1: Run frontend readiness**

Run:

```powershell
cd web
pnpm.cmd run verify:saas-readiness
```

Expected: every frontend readiness script passes.

- [ ] **Step 2: Run frontend build**

Run:

```powershell
cd web
pnpm.cmd run build
```

Expected: exit code 0.

- [ ] **Step 3: Run repository root readiness smoke**

Run:

```powershell
node scripts/run-saas-readiness.cjs
```

Expected: frontend readiness, frontend build, frontend preview smoke, and backend readiness all pass.

- [ ] **Step 4: Run diff checks**

Run:

```powershell
git diff --check
git diff --stat
git status --short --branch
```

Expected: no whitespace errors; only this P1 frontend readiness coverage slice is modified.

- [ ] **Step 5: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-09-p1-frontend-saas-readiness-coverage.md docs/saas-launch-readiness-checklist.md web/scripts/verify-saas-readiness-command.ts web/scripts/run-saas-readiness.ts
git commit -m "test: expand saas frontend readiness coverage"
```

Expected: commit created on `saas-order-risk-ops`; do not push.

## Self-Review

- Spec coverage: Covers frontend runner contract, missing signup route/password/readiness scripts, launch checklist alignment, full frontend verification, repository root smoke, review, and commit.
- Placeholder scan: No TBD/TODO/later placeholders remain.
- Type consistency: The required script order is identical between this plan, the contract script, and the runner.
