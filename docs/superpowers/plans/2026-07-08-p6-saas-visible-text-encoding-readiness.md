# P6 SaaS Visible Text Encoding Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing SaaS visible text encoding audit part of the backend and repository SaaS readiness gates so mojibake cannot silently return to core SaaS flows.

**Architecture:** Do not rewrite visible copy in this phase. Use the existing Jest spec `server/src/module/saas/saas-visible-text-encoding.spec.ts` as the source of truth, add it to `server/package.json` `verify:saas-readiness`, and update the backend static verifier plus launch checklist so the gate stays documented and enforced.

**Tech Stack:** NestJS backend, Jest, pnpm, tsx static verifier, Markdown checklist.

## Global Constraints

- Do not change SaaS business behavior in this phase.
- Do not rewrite UI copy unless the encoding audit fails on active source files.
- Do not introduce new dependencies.
- Do not push to remote; commit locally only after verification.
- Use `pnpm.cmd` commands on Windows PowerShell.
- Treat PowerShell mojibake output as untrusted; rely on UTF-8 source reads and automated tests.

---

### Task 1: Extend Backend Readiness Static Verifier

**Files:**
- Modify: `server/scripts/verify-saas-readiness-command.ts`

**Interfaces:**
- Consumes: `server/package.json`, `docs/saas-launch-readiness-checklist.md`
- Produces: a static check that requires `saas-visible-text-encoding.spec.ts` in the backend readiness command and checklist backend gate.

- [ ] **Step 1: Add the missing suite to the verifier only**

Add this suite to `expectedSuites`:

```ts
'saas-visible-text-encoding.spec.ts'
```

- [ ] **Step 2: Run verifier to confirm RED**

Run:

```powershell
cd server
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: FAIL because the package script and checklist backend expanded gate do not yet contain `saas-visible-text-encoding.spec.ts`.

---

### Task 2: Add Encoding Spec to Backend Readiness

**Files:**
- Modify: `server/package.json`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: existing Jest spec `server/src/module/saas/saas-visible-text-encoding.spec.ts`
- Produces: `pnpm.cmd run verify:saas-readiness` includes visible text encoding audit.

- [ ] **Step 1: Update package script**

In `server/package.json`, update `verify:saas-readiness` so it includes:

```text
saas-visible-text-encoding.spec.ts
```

Keep `--runInBand --forceExit` at the end.

- [ ] **Step 2: Update launch checklist**

In `docs/saas-launch-readiness-checklist.md`, update the expanded backend gate command so it also lists:

```text
saas-visible-text-encoding.spec.ts
```

- [ ] **Step 3: Run verifier to confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: PASS and print `SaaS backend readiness command verified.`

---

### Task 3: Verify Encoding Audit and Aggregate Readiness

**Files:**
- No additional edits expected.

**Interfaces:**
- Consumes: updated backend readiness command from Task 2.
- Produces: evidence that visible text encoding audit passes alone and through aggregate gates.

- [ ] **Step 1: Run encoding audit directly**

Run:

```powershell
cd server
pnpm.cmd test -- saas-visible-text-encoding.spec.ts --runInBand --forceExit
```

Expected: PASS for the visible text encoding audit.

- [ ] **Step 2: Run backend SaaS readiness**

Run:

```powershell
cd server
pnpm.cmd run verify:saas-readiness
```

Expected: PASS for the focused SaaS backend suites, now including `saas-visible-text-encoding.spec.ts`.

- [ ] **Step 3: Run repository SaaS readiness**

Run:

```powershell
node scripts/run-saas-readiness.cjs
```

Expected: frontend readiness and backend readiness both pass.

- [ ] **Step 4: Run repository whitespace review**

Run:

```powershell
git diff --check
git diff --cached --check
```

Expected: both commands exit `0`.

- [ ] **Step 5: Review the diff**

Run:

```powershell
git diff -- docs/saas-launch-readiness-checklist.md server/package.json server/scripts/verify-saas-readiness-command.ts docs/superpowers/plans/2026-07-08-p6-saas-visible-text-encoding-readiness.md
```

Expected: only the plan, backend verifier, backend package script, and checklist backend expanded gate changed.

- [ ] **Step 6: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-08-p6-saas-visible-text-encoding-readiness.md docs/saas-launch-readiness-checklist.md server/package.json server/scripts/verify-saas-readiness-command.ts
git commit -m "test: include saas text encoding audit in readiness"
```

Expected: local commit created; do not push.

---

## Self-Review

- Spec coverage: The plan covers static verifier RED/GREEN, backend package script update, checklist update, direct encoding audit, backend readiness, root readiness, diff review, and local commit.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The suite name is consistently `saas-visible-text-encoding.spec.ts`; the readiness command remains `verify:saas-readiness`.
