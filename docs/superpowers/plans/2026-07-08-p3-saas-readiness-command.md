# P3 SaaS Readiness Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one frontend SaaS readiness command that runs every existing frontend SaaS readiness gate in order.

**Architecture:** Keep individual verification scripts unchanged. Add one runner under `web/scripts`, one static verifier, one `package.json` script alias, and one checklist entry so operators can run the frontend readiness pack with a single command.

**Tech Stack:** TypeScript, tsx, pnpm, Node `child_process`.

## Global Constraints

- Worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.
- Do not push to remote.
- Do not change business logic, Vue pages, backend services, database schema, payment behavior, or permission behavior.
- Keep the aggregate command frontend-only; backend focused tests stay documented separately.
- Use verification-first: write static verifier, run it red, then add the aggregate command.
- `apply_patch` is blocked by WindowsApps access denial in this session, so edits are applied with UTF-8-safe Node scripts and verified through tests and diff checks.

---

## File Structure

- Create: `web/scripts/verify-saas-readiness-command.ts` - static verifier for the aggregate command, package script, and checklist entry.
- Create: `web/scripts/run-saas-readiness.ts` - sequential runner for all frontend SaaS readiness scripts.
- Modify: `web/package.json` - add `verify:saas-readiness`.
- Modify: `docs/saas-launch-readiness-checklist.md` - add the aggregate command before the expanded command list.
- Create: `docs/superpowers/plans/2026-07-08-p3-saas-readiness-command.md` - this plan and evidence.

---

### Task 1: Add Static Verifier For The Aggregate Command

**Files:**
- Create: `web/scripts/verify-saas-readiness-command.ts`

**Interfaces:**
- Produces command: `pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts`.
- Checks `scripts/run-saas-readiness.ts`, `package.json`, and `docs/saas-launch-readiness-checklist.md`.

- [x] **Step 1: Write the failing verification script**

Create a script that requires:
- `scripts/run-saas-readiness.ts` exists.
- The runner lists, in order: `verify-saas-launch-flow-readiness.ts`, `verify-saas-ui-state-readiness.ts`, `verify-saas-tenant-ui-state-readiness.ts`, `verify-saas-signup-activation.ts`, `verify-saas-platform-tenant-page.ts`, `verify-saas-payment-path-copy.ts`, `verify-no-legacy-saiadmin-composable.ts`, and `verify-saas-public-brand-surfaces.ts`.
- The runner uses `spawnSync`, `stdio: 'inherit'`, and `process.exit(result.status || 1)`.
- `package.json` maps `verify:saas-readiness` to `tsx scripts/run-saas-readiness.ts`.
- The checklist includes `pnpm.cmd run verify:saas-readiness`.

- [x] **Step 2: Run RED verification**

Run from `web`: `pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts`

Expected: FAIL because the runner and package script do not exist yet.

---

### Task 2: Add The Aggregate Readiness Runner

**Files:**
- Create: `web/scripts/run-saas-readiness.ts`
- Modify: `web/package.json`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Produces command: `pnpm.cmd run verify:saas-readiness`.
- Runs all frontend SaaS readiness checks sequentially and stops on the first failure.

- [x] **Step 1: Create the runner**

Create `web/scripts/run-saas-readiness.ts` with an ordered `checks` array, `spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', script])`, inherited stdio, and non-zero exit on the first failure.

- [x] **Step 2: Add package script**

Add to `web/package.json` scripts: `"verify:saas-readiness": "tsx scripts/run-saas-readiness.ts"`.

- [x] **Step 3: Add checklist aggregate command**

Add `pnpm.cmd run verify:saas-readiness` before the expanded frontend command list in `docs/saas-launch-readiness-checklist.md`.

- [x] **Step 4: Run GREEN static verifier**

Run from `web`: `pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts`

Expected: PASS with `SaaS readiness command verified.`

---

### Task 3: Final Verification, Review, And Commit

**Files:**
- Test: `web/scripts/verify-saas-readiness-command.ts`
- Test: `web/scripts/run-saas-readiness.ts`
- Test: `web/package.json`
- Test: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Produces a local commit on `saas-order-risk-ops`.

- [x] **Step 1: Run the new aggregate command**

Run from `web`: `pnpm.cmd run verify:saas-readiness`

Expected: all frontend SaaS readiness scripts pass and the command exits 0.

- [x] **Step 2: Run static verifier**

Run from `web`: `pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts`

Expected: PASS.

- [x] **Step 3: Run frontend build**

Run from `web`: `pnpm.cmd build`

Expected: build exits 0.

- [x] **Step 4: Review diff**

Run from repo root: `git diff --check`, `git diff --stat`, and `git status --short`.

Expected: only the P3 plan, runner, verifier, package script, and checklist changed.

- [x] **Step 5: Commit**

Run: `git add docs/superpowers/plans/2026-07-08-p3-saas-readiness-command.md docs/saas-launch-readiness-checklist.md web/package.json web/scripts/run-saas-readiness.ts web/scripts/verify-saas-readiness-command.ts && git commit -m "test: add saas readiness command"`.

Expected: commit created locally. Do not push.

## Self-Review

- Spec coverage: aggregate command, verifier, package script, checklist update, verification, review, and commit are covered.
- Placeholder scan: no TBD/TODO/later placeholders remain.
- Type consistency: `verify:saas-readiness`, `run-saas-readiness.ts`, and the ordered script list are consistent across plan, verifier, package.json, and checklist.
