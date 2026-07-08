# P2 Root Backend Build Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repository-root SaaS readiness gate run the backend TypeScript build as well as backend tests.

**Architecture:** Strengthen the existing root readiness static verifier so it fails unless `scripts/run-saas-readiness.cjs` contains a distinct `backend build` check. Then add that check to the root runner and document it in the SaaS launch checklist.

**Tech Stack:** Node.js CommonJS readiness runner, pnpm scripts, Markdown checklist.

## Global Constraints

- Worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.
- Branch: `saas-order-risk-ops`.
- Do not push unless the user explicitly asks.
- Do not change SaaS runtime behavior.
- Keep this slice limited to root readiness coverage, documentation, verification, review, and commit.
- Use TDD: update the verifier first, run it red, update runner/docs, run green.

---

## File Structure

- Modify: `scripts/verify-saas-root-readiness-command.cjs`
  - Requires the root runner to include a `backend build` check and the server package to define `build`.
- Modify: `scripts/run-saas-readiness.cjs`
  - Adds `{ label: 'backend build', cwd: path.join(rootDir, 'server'), script: 'build' }`.
- Modify: `docs/saas-launch-readiness-checklist.md`
  - States the full repository gate includes frontend readiness/build/preview smoke plus backend build/readiness.

### Task 1: Strengthen Root Readiness Static Verifier

**Files:**
- Modify: `scripts/verify-saas-root-readiness-command.cjs`

**Interfaces:**
- Consumes: `scripts/run-saas-readiness.cjs`, `server/package.json`.
- Produces: a verifier that fails when backend build coverage is missing from the root gate.

- [ ] **Step 1: Add backend build assertions**

Add these tokens to the root runner assertions:

```js
"label: 'backend build'",
"path.join(rootDir, 'server'), script: 'build'",
```

Add this package script assertion:

```js
assert(serverPackage.scripts?.build, 'server/package.json must define build')
```

- [ ] **Step 2: Run verifier to confirm RED**

Run:

```powershell
node scripts/verify-saas-root-readiness-command.cjs
```

Expected: FAIL because `scripts/run-saas-readiness.cjs` currently has `backend readiness` but no `backend build` check.

### Task 2: Add Backend Build to Root Runner

**Files:**
- Modify: `scripts/run-saas-readiness.cjs`

**Interfaces:**
- Produces: `node scripts/run-saas-readiness.cjs` now runs `pnpm.cmd run build` in `server` before backend readiness.

- [ ] **Step 1: Insert backend build check**

Update `checks`:

```js
const checks = [
  { label: 'frontend readiness', cwd: path.join(rootDir, 'web'), script: 'verify:saas-readiness' },
  { label: 'frontend build', cwd: path.join(rootDir, 'web'), script: 'build' },
  { label: 'frontend preview smoke', cwd: path.join(rootDir, 'web'), script: 'verify:saas-preview-smoke' },
  { label: 'backend build', cwd: path.join(rootDir, 'server'), script: 'build' },
  { label: 'backend readiness', cwd: path.join(rootDir, 'server'), script: 'verify:saas-readiness' }
]
```

- [ ] **Step 2: Run verifier to confirm GREEN**

Run:

```powershell
node scripts/verify-saas-root-readiness-command.cjs
```

Expected: PASS and print `SaaS root readiness command verified.`

### Task 3: Sync Launch Checklist

**Files:**
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Produces: documentation that the root gate covers backend build.

- [ ] **Step 1: Update Full repository gate copy**

Add one sentence after the root command:

```markdown
This aggregate gate runs frontend readiness, frontend build, frontend preview smoke, backend build, and backend readiness.
```

- [ ] **Step 2: Confirm checklist mentions backend build**

Run:

```powershell
Select-String -Path docs/saas-launch-readiness-checklist.md -Pattern 'backend build'
```

Expected: at least one match.

### Task 4: Verification, Review, and Commit

**Files:**
- Modify: all files listed above plus this plan.

**Interfaces:**
- Produces: one local commit on `saas-order-risk-ops`.

- [ ] **Step 1: Run root verifier**

Run:

```powershell
node scripts/verify-saas-root-readiness-command.cjs
```

Expected: PASS.

- [ ] **Step 2: Run root SaaS readiness**

Run:

```powershell
node scripts/run-saas-readiness.cjs
```

Expected: frontend readiness, frontend build, frontend preview smoke, backend build, and backend readiness all pass.

- [ ] **Step 3: Run diff checks**

Run:

```powershell
git diff --check
git diff --stat
git status --short --branch
```

Expected: no whitespace errors; only this P2 root backend build readiness slice is modified.

- [ ] **Step 4: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-09-p2-root-backend-build-readiness.md docs/saas-launch-readiness-checklist.md scripts/run-saas-readiness.cjs scripts/verify-saas-root-readiness-command.cjs
git commit -m "test: include backend build in saas root readiness"
```

Expected: commit created on `saas-order-risk-ops`; do not push.

## Self-Review

- Spec coverage: Covers root verifier, backend build in root runner, launch checklist, full root verification, review, and commit.
- Placeholder scan: No TBD/TODO/later placeholders remain.
- Type consistency: The new runner label is consistently `backend build`, and it runs server script `build`.
