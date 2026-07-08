# P1 SaaS Identity And Module Readiness Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure backend SaaS readiness covers the identity, authentication, tenant-switching, rate-limit, and system-module guard tests that protect the ordinary user, tenant, and platform-admin boundaries.

**Architecture:** Extend the existing backend readiness command contract first so it fails against the current package script. Then add the missing identity/module/security spec filenames to `server/package.json` `verify:saas-readiness` and document the expanded identity/module coverage in the launch checklist.

**Tech Stack:** NestJS/Jest, package-script contract spec, Markdown checklist.

## Global Constraints

- Worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.
- Branch: `saas-order-risk-ops`.
- Do not push unless the user explicitly asks.
- Do not change runtime behavior in this slice.
- Keep this slice limited to readiness coverage, documentation, verification, review, and commit.
- Use TDD: update the backend readiness command contract first, run it red, update package/docs, run green.

---

## File Structure

- Modify: `server/src/config/saas-readiness-command.spec.ts`
  - Requires identity/auth/rate-limit/system-module specs in backend SaaS readiness.
- Modify: `server/package.json`
  - Adds the required spec filenames to `verify:saas-readiness`.
- Modify: `docs/saas-launch-readiness-checklist.md`
  - Documents that backend readiness includes identity and system-module guard coverage.

## Required Added Specs

Add these spec filenames to the backend readiness command contract and package script:

```ts
const REQUIRED_IDENTITY_AND_MODULE_SPECS = [
  'auth-rate-limit.config.spec.ts',
  'auth.strategy.spec.ts',
  'user.service.spec.ts',
  'main.service.permissions.spec.ts',
  'menu.service.spec.ts',
  'built-in-modules.spec.ts',
  'system-module-access.service.spec.ts',
  'system-module-registry.service.spec.ts',
  'system-module.guard.spec.ts',
  'system-module-platform.controller.spec.ts',
  'system-module-tenant.controller.spec.ts',
  'system-module-route-consistency.spec.ts',
];
```

### Task 1: Extend Backend Readiness Contract

**Files:**
- Modify: `server/src/config/saas-readiness-command.spec.ts`

**Interfaces:**
- Consumes: `server/package.json`.
- Produces: a Jest contract that fails when identity/module boundary specs are omitted from `verify:saas-readiness`.

- [ ] **Step 1: Add the missing spec names to `REQUIRED_BACKEND_SAAS_READINESS_SPECS`**

Append the required identity/module spec filenames to the existing array.

- [ ] **Step 2: Run contract spec to verify RED**

Run:

```powershell
cd server
npm.cmd test -- saas-readiness-command.spec.ts --runInBand
```

Expected: FAIL because the current package script does not include `auth-rate-limit.config.spec.ts`, `user.service.spec.ts`, or system-module guard specs.

### Task 2: Expand Backend Readiness Script

**Files:**
- Modify: `server/package.json`

**Interfaces:**
- Produces: `npm.cmd run verify:saas-readiness` runs the identity/auth/module boundary specs together with the existing SaaS suite.

- [ ] **Step 1: Add required spec names to `verify:saas-readiness`**

Add the required spec names before `saas-readiness-command.spec.ts` so the command contract remains last:

```json
"auth-rate-limit.config.spec.ts auth.strategy.spec.ts user.service.spec.ts main.service.permissions.spec.ts menu.service.spec.ts built-in-modules.spec.ts system-module-access.service.spec.ts system-module-registry.service.spec.ts system-module.guard.spec.ts system-module-platform.controller.spec.ts system-module-tenant.controller.spec.ts system-module-route-consistency.spec.ts saas-readiness-command.spec.ts"
```

- [ ] **Step 2: Run contract spec to verify GREEN**

Run:

```powershell
cd server
npm.cmd test -- saas-readiness-command.spec.ts --runInBand
```

Expected: PASS.

### Task 3: Sync Launch Checklist

**Files:**
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Produces: release checklist copy that says backend readiness covers identity and module guards.

- [ ] **Step 1: Add backend coverage note**

Under the backend expanded gate block, add:

```markdown
Backend readiness also covers authentication rate limits, JWT strategy tenant context, user refresh-token tenant continuity, menu permissions, and system-module guards.
```

- [ ] **Step 2: Confirm checklist mentions system-module guards**

Run:

```powershell
Select-String -Path docs/saas-launch-readiness-checklist.md -Pattern 'system-module guards'
```

Expected: at least one match.

### Task 4: Verification, Review, and Commit

**Files:**
- Modify: all files listed above plus this plan.

**Interfaces:**
- Produces: one local commit on `saas-order-risk-ops`.

- [ ] **Step 1: Run focused added identity/module suites**

Run:

```powershell
cd server
npm.cmd test -- auth-rate-limit.config.spec.ts auth.strategy.spec.ts user.service.spec.ts main.service.permissions.spec.ts menu.service.spec.ts built-in-modules.spec.ts system-module-access.service.spec.ts system-module-registry.service.spec.ts system-module.guard.spec.ts system-module-platform.controller.spec.ts system-module-tenant.controller.spec.ts system-module-route-consistency.spec.ts --runInBand
```

Expected: all selected suites pass.

- [ ] **Step 2: Run full backend readiness**

Run:

```powershell
cd server
npm.cmd run verify:saas-readiness
```

Expected: all selected backend readiness suites pass.

- [ ] **Step 3: Run backend build**

Run:

```powershell
cd server
npm.cmd run build
```

Expected: exit code 0.

- [ ] **Step 4: Run root verifier**

Run:

```powershell
node scripts/verify-saas-root-readiness-command.cjs
```

Expected: PASS.

- [ ] **Step 5: Review and commit**

Run:

```powershell
git diff --check
git diff --stat
git status --short --branch
git add docs/superpowers/plans/2026-07-09-p1-saas-identity-module-readiness-coverage.md docs/saas-launch-readiness-checklist.md server/package.json server/src/config/saas-readiness-command.spec.ts
git commit -m "test: expand saas identity and module readiness coverage"
```

Expected: commit created on `saas-order-risk-ops`; do not push.

## Self-Review

- Spec coverage: Covers identity/auth/rate-limit/user refresh/menu/system-module readiness coverage, docs, focused tests, full backend readiness, backend build, root verifier, review, and commit.
- Placeholder scan: No TBD/TODO/later placeholders remain.
- Type consistency: The spec filenames match current files under `server/src`.
