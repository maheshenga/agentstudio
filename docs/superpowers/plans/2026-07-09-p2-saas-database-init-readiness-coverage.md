# P2 SaaS Database Init Readiness Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure backend SaaS readiness covers database initialization, bootstrap security, seed data, and migration integrity specs needed for reliable SaaS deployment.

**Architecture:** Extend the existing backend readiness command contract so it fails when migration/init specs are omitted. Then add the missing migration/init spec filenames to `server/package.json` `verify:saas-readiness` and document that backend readiness covers database bootstrap and seed integrity.

**Tech Stack:** NestJS/Jest migration specs, package-script contract spec, Markdown checklist.

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
  - Requires database init, seed, menu, role grant, and migration specs in backend SaaS readiness.
- Modify: `server/package.json`
  - Adds the required spec filenames to `verify:saas-readiness`.
- Modify: `docs/saas-launch-readiness-checklist.md`
  - Documents that backend readiness includes database bootstrap and seed integrity coverage.

## Required Added Specs

Add these spec filenames to the backend readiness command contract and package script:

```ts
const REQUIRED_DATABASE_INIT_SPECS = [
  'database-init-bootstrap-security.spec.ts',
  'database-init-sanitization.spec.ts',
  'verify-db-init-script.spec.ts',
  'seed-saas-foundation-data.spec.ts',
  'seed-saas-modules.spec.ts',
  'seed-system-modules.spec.ts',
  'create-saas-modules.spec.ts',
  'create-system-modules.spec.ts',
  'create-system-module-saas-bridge.spec.ts',
  'create-saas-orders-and-plan-prices.spec.ts',
  'create-saas-quota-ledger.spec.ts',
  'create-saas-resource-pack-orders.spec.ts',
  'align-saas-plan-operations-menu.spec.ts',
  'align-saas-platform-permissions.spec.ts',
  'align-saas-resource-pack-catalog.spec.ts',
  'align-saas-resource-pack-order-menu.spec.ts',
  'align-tenant-resource-pack-role-grants-and-labels.spec.ts',
  'align-tenant-system-module-role-grants.spec.ts',
  'widen-log-username-columns.spec.ts',
];
```

### Task 1: Extend Backend Readiness Contract

**Files:**
- Modify: `server/src/config/saas-readiness-command.spec.ts`

**Interfaces:**
- Consumes: `server/package.json`.
- Produces: a Jest contract that fails when database init or migration integrity specs are omitted from `verify:saas-readiness`.

- [ ] **Step 1: Add the missing spec names to `REQUIRED_BACKEND_SAAS_READINESS_SPECS`**

Append the required database/init spec filenames to the existing array.

- [ ] **Step 2: Run contract spec to verify RED**

Run:

```powershell
cd server
npm.cmd test -- saas-readiness-command.spec.ts --runInBand
```

Expected: FAIL because the current package script does not include `database-init-bootstrap-security.spec.ts`, `seed-saas-foundation-data.spec.ts`, or related migration specs.

### Task 2: Expand Backend Readiness Script

**Files:**
- Modify: `server/package.json`

**Interfaces:**
- Produces: `npm.cmd run verify:saas-readiness` runs the database init and migration integrity specs together with the existing SaaS suite.

- [ ] **Step 1: Add required spec names to `verify:saas-readiness`**

Add the required spec names before `saas-readiness-command.spec.ts` so the command contract remains last:

```json
"database-init-bootstrap-security.spec.ts database-init-sanitization.spec.ts verify-db-init-script.spec.ts seed-saas-foundation-data.spec.ts seed-saas-modules.spec.ts seed-system-modules.spec.ts create-saas-modules.spec.ts create-system-modules.spec.ts create-system-module-saas-bridge.spec.ts create-saas-orders-and-plan-prices.spec.ts create-saas-quota-ledger.spec.ts create-saas-resource-pack-orders.spec.ts align-saas-plan-operations-menu.spec.ts align-saas-platform-permissions.spec.ts align-saas-resource-pack-catalog.spec.ts align-saas-resource-pack-order-menu.spec.ts align-tenant-resource-pack-role-grants-and-labels.spec.ts align-tenant-system-module-role-grants.spec.ts widen-log-username-columns.spec.ts saas-readiness-command.spec.ts"
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
- Produces: release checklist copy that says backend readiness covers database bootstrap and seed integrity.

- [ ] **Step 1: Add database/init coverage note**

Under the backend expanded gate block, add:

```markdown
Backend readiness includes database initialization security, seed data integrity, migration menu alignment, and tenant role grant coverage.
```

- [ ] **Step 2: Confirm checklist mentions database initialization security**

Run:

```powershell
Select-String -Path docs/saas-launch-readiness-checklist.md -Pattern 'database initialization security'
```

Expected: at least one match.

### Task 4: Verification, Review, and Commit

**Files:**
- Modify: all files listed above plus this plan.

**Interfaces:**
- Produces: one local commit on `saas-order-risk-ops`.

- [ ] **Step 1: Run focused added database/init suites**

Run:

```powershell
cd server
npm.cmd test -- database-init-bootstrap-security.spec.ts database-init-sanitization.spec.ts verify-db-init-script.spec.ts seed-saas-foundation-data.spec.ts seed-saas-modules.spec.ts seed-system-modules.spec.ts create-saas-modules.spec.ts create-system-modules.spec.ts create-system-module-saas-bridge.spec.ts create-saas-orders-and-plan-prices.spec.ts create-saas-quota-ledger.spec.ts create-saas-resource-pack-orders.spec.ts align-saas-plan-operations-menu.spec.ts align-saas-platform-permissions.spec.ts align-saas-resource-pack-catalog.spec.ts align-saas-resource-pack-order-menu.spec.ts align-tenant-resource-pack-role-grants-and-labels.spec.ts align-tenant-system-module-role-grants.spec.ts widen-log-username-columns.spec.ts --runInBand
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
git add docs/superpowers/plans/2026-07-09-p2-saas-database-init-readiness-coverage.md docs/saas-launch-readiness-checklist.md server/package.json server/src/config/saas-readiness-command.spec.ts
git commit -m "test: expand saas database init readiness coverage"
```

Expected: commit created on `saas-order-risk-ops`; do not push.

## Self-Review

- Spec coverage: Covers database bootstrap security, init sanitization, seed data, migration table/menu/role grants, focused tests, full backend readiness, backend build, root verifier, review, and commit.
- Placeholder scan: No TBD/TODO/later placeholders remain.
- Type consistency: The spec filenames match current files under `server/src/migration-specs`.
