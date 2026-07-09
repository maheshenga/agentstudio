# P3 SaaS Doc Route Baseline Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent active SaaS launch/stability documents from drifting away from the real critical SaaS route contract.

**Architecture:** Add one frontend readiness script that reads active docs from `docs/` and asserts they contain the canonical tenant/platform route baseline while rejecting known stale aliases. Integrate the script into the existing frontend readiness runner and its command verifier so doc drift is caught by the root readiness gate.

**Tech Stack:** TypeScript, tsx, Node fs/path, existing frontend readiness runner.

## Global Constraints

- Do not edit historical specs or old implementation plans; only active checklists are authoritative for this P3.
- Keep the script ASCII-only to avoid PowerShell encoding confusion.
- Use TDD: add the failing script and runner expectation first, run red, then fix docs/runner.
- Do not change SaaS routes, backend APIs, or UI behavior.
- Do not push to remote.

---

### Task 1: Add Active Doc Route Baseline Readiness

**Files:**
- Create: `web/scripts/verify-saas-doc-route-baseline.ts`
- Modify: `web/scripts/run-saas-readiness.ts`
- Modify: `web/scripts/verify-saas-readiness-command.ts`
- Modify: `docs/saas/p0-local-stability-checklist.md`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: active docs `docs/saas-launch-readiness-checklist.md` and `docs/saas/p0-local-stability-checklist.md`.
- Produces: CLI command `pnpm.cmd exec tsx scripts/verify-saas-doc-route-baseline.ts` and inclusion in `pnpm.cmd run verify:saas-readiness`.

- [ ] **Step 1: Write the failing readiness script**

Create `web/scripts/verify-saas-doc-route-baseline.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(process.cwd(), '..')
const failures: string[] = []

const activeDocs = [
  'docs/saas-launch-readiness-checklist.md',
  'docs/saas/p0-local-stability-checklist.md'
]

const canonicalRoutes = [
  '/tenant-saas/usage',
  '/tenant-saas/plan',
  '/tenant-saas/members',
  '/tenant-saas/modules',
  '/tenant-saas/resource-packs',
  '/saas-platform/usage',
  '/saas-platform/tenants',
  '/saas-platform/plans',
  '/saas-platform/module',
  '/saas-platform/subscription',
  '/saas-platform/resource-packs',
  '/saas-platform/resource-pack-orders',
  '/saas-platform/payment-config',
  '/saas-platform/revenue'
]

const staleRoutes = ['/saas-platform/subscriptions', '/tenant-saas/resource-pack']

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function readDoc(path: string) {
  const fullPath = resolve(repoRoot, path)
  assert(existsSync(fullPath), `${path} must exist`)
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : ''
}

for (const docPath of activeDocs) {
  const source = readDoc(docPath)

  for (const route of canonicalRoutes) {
    assert(source.includes(route), `${docPath} must include canonical route ${route}`)
  }

  for (const staleRoute of staleRoutes) {
    assert(!source.includes(staleRoute), `${docPath} must not include stale route ${staleRoute}`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS doc route baseline verified.')
```

- [ ] **Step 2: Run script to verify it fails**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-doc-route-baseline.ts
```

Expected: FAIL because `docs/saas/p0-local-stability-checklist.md` still contains `/saas-platform/subscriptions`.

- [ ] **Step 3: Add runner expectation and verify it fails**

Add `'verify-saas-doc-route-baseline.ts'` to `expectedScripts` in `web/scripts/verify-saas-readiness-command.ts` after `verify-saas-route-contract.ts`.

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: FAIL because `web/scripts/run-saas-readiness.ts` does not include the new script yet.

- [ ] **Step 4: Fix the active docs**

In `docs/saas/p0-local-stability-checklist.md`, replace:

```markdown
- `/#/saas-platform/subscriptions`
```

with:

```markdown
- `/#/saas-platform/subscription`
```

In `docs/saas-launch-readiness-checklist.md`, add the missing canonical route `/#/saas-platform/subscription` to the platform admin manual flow if it is not already present. Keep the existing single route spelling.

- [ ] **Step 5: Integrate the readiness runner**

Add `'verify-saas-doc-route-baseline.ts'` to `checks` in `web/scripts/run-saas-readiness.ts` after `verify-saas-route-contract.ts`.

- [ ] **Step 6: Run focused verification**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-doc-route-baseline.ts
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
pnpm.cmd run verify:saas-readiness
```

Expected: all commands exit 0.

- [ ] **Step 7: Run root readiness**

Run from repo root:

```powershell
node scripts/run-saas-readiness.cjs
```

Expected: frontend readiness, frontend build, frontend preview smoke, backend build, and backend readiness all pass.

- [ ] **Step 8: Review and commit**

Run:

```powershell
git diff --check
git diff -- docs/superpowers/plans/2026-07-09-p3-saas-doc-route-baseline-readiness.md web/scripts/verify-saas-doc-route-baseline.ts web/scripts/run-saas-readiness.ts web/scripts/verify-saas-readiness-command.ts docs/saas/p0-local-stability-checklist.md docs/saas-launch-readiness-checklist.md
git status --short --branch
```

Then commit:

```powershell
git add docs/superpowers/plans/2026-07-09-p3-saas-doc-route-baseline-readiness.md web/scripts/verify-saas-doc-route-baseline.ts web/scripts/run-saas-readiness.ts web/scripts/verify-saas-readiness-command.ts docs/saas/p0-local-stability-checklist.md docs/saas-launch-readiness-checklist.md
git commit -m "test: guard saas doc route baseline"
```

Expected: one local commit on `saas-order-risk-ops`.

## Self-Review

- Spec coverage: The plan covers active doc route drift, runner integration, focused verification, root readiness, review, and commit.
- Placeholder scan: No TBD/TODO/fill-in-later items remain.
- Type consistency: Script names and route strings match the current route contract verifier and active checklists.
