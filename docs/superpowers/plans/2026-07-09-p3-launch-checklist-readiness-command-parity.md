# P3 Launch Checklist Readiness Command Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the launch checklist's expanded frontend readiness command list in parity with the actual frontend readiness runner.

**Architecture:** Extend the existing frontend readiness command verifier instead of adding a second source of truth. The verifier already owns the canonical `expectedScripts` array, so it should also assert that `docs/saas-launch-readiness-checklist.md` documents every corresponding manual command.

**Tech Stack:** TypeScript, tsx, Markdown documentation, existing SaaS readiness scripts.

## Global Constraints

- Do not change SaaS runtime behavior, routes, APIs, permissions, payment behavior, or UI pages.
- Keep the canonical frontend readiness script order in `web/scripts/verify-saas-readiness-command.ts`.
- Do not push to remote.
- Invoice functionality remains out of scope.

---

### Task 1: Guard Launch Checklist Frontend Command Parity

**Files:**
- Modify: `web/scripts/verify-saas-readiness-command.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`
- Create: `docs/superpowers/plans/2026-07-09-p3-launch-checklist-readiness-command-parity.md`

**Interfaces:**
- Consumes: `expectedScripts: string[]` in `web/scripts/verify-saas-readiness-command.ts`.
- Produces: a readiness assertion that every expected frontend script appears in the launch checklist as `pnpm.cmd exec tsx scripts/<script>`.

- [ ] **Step 1: Add the failing checklist parity assertion**

In `web/scripts/verify-saas-readiness-command.ts`, replace the current launch-checklist assertions:

```typescript
const checklist = readFile('../docs/saas-launch-readiness-checklist.md')
assertIncludes(checklist, 'pnpm.cmd run verify:saas-readiness', 'launch readiness checklist')
assertIncludes(
  checklist,
  'pnpm.cmd run verify:saas-preview-smoke',
  'launch readiness checklist'
)
```

with:

```typescript
const checklist = readFile('../docs/saas-launch-readiness-checklist.md')
assertIncludes(checklist, 'pnpm.cmd run verify:saas-readiness', 'launch readiness checklist')
for (const script of expectedScripts) {
  assertIncludes(
    checklist,
    `pnpm.cmd exec tsx scripts/${script}`,
    'launch readiness checklist'
  )
}
assertIncludes(
  checklist,
  'pnpm.cmd run verify:saas-preview-smoke',
  'launch readiness checklist'
)
```

- [ ] **Step 2: Run the verifier and confirm it fails for the stale checklist**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: FAIL with messages that the launch readiness checklist must include at least:

```text
pnpm.cmd exec tsx scripts/verify-saas-doc-route-baseline.ts
pnpm.cmd exec tsx scripts/verify-saas-public-origin.ts
```

- [ ] **Step 3: Update the launch checklist expanded frontend gates**

In `docs/saas-launch-readiness-checklist.md`, under `# Expanded frontend gates`, insert the missing commands so the list mirrors the runner:

```powershell
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
```

- [ ] **Step 4: Run focused verification**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
pnpm.cmd run verify:saas-readiness
```

Expected: both commands exit 0.

- [ ] **Step 5: Run root readiness**

Run from repo root:

```powershell
node scripts/run-saas-readiness.cjs
```

Expected: frontend readiness, frontend build, frontend preview smoke, backend build, and backend readiness all exit 0.

- [ ] **Step 6: Review and commit**

Run:

```powershell
git diff --check
git diff -- docs/superpowers/plans/2026-07-09-p3-launch-checklist-readiness-command-parity.md web/scripts/verify-saas-readiness-command.ts docs/saas-launch-readiness-checklist.md
git status --short --branch
```

Then commit:

```powershell
git add docs/superpowers/plans/2026-07-09-p3-launch-checklist-readiness-command-parity.md web/scripts/verify-saas-readiness-command.ts docs/saas-launch-readiness-checklist.md
git commit -m "test: guard saas launch checklist command parity"
```

Expected: one local commit on `saas-order-risk-ops`.

## Self-Review

- Spec coverage: The plan covers the documented drift found after adding frontend readiness checks and protects against future checklist omissions.
- Placeholder scan: No TBD, TODO, fill-in-later, or deferred implementation placeholders remain.
- Type consistency: The verifier reuses the existing `expectedScripts` array and existing `assertIncludes` helper; no new public API is introduced.
