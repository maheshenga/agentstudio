# P4 SaaS Backend Readiness Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend one-command SaaS readiness gate so QA and release review can run all focused server SaaS tests without copying a long Jest command.

**Architecture:** Keep this as a thin package-script layer over existing Jest suites. Add one static verifier under `server/scripts/` that proves the package script, critical suite names, serial execution flags, and launch checklist documentation stay aligned.

**Tech Stack:** NestJS backend, Jest, pnpm, tsx, TypeScript, Markdown checklist.

## Global Constraints

- Do not change SaaS business behavior in this phase.
- Do not introduce new dependencies.
- Do not push to remote; commit locally only after verification.
- Invoice functionality remains out of scope.
- Use `pnpm.cmd` commands on Windows PowerShell.
- Preserve UTF-8 content and avoid broad formatting churn.

---

### Task 1: Add Backend Readiness Static Verifier

**Files:**
- Create: `server/scripts/verify-saas-readiness-command.ts`

**Interfaces:**
- Consumes: `server/package.json`, `docs/saas-launch-readiness-checklist.md`
- Produces: a command that exits `0` only when the backend readiness package script and checklist contain the expected SaaS focused test suites.

- [ ] **Step 1: Write the failing verifier**

Create `server/scripts/verify-saas-readiness-command.ts` with these checks:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const failures: string[] = []

const expectedSuites = [
  'saas-main-flow.integration.spec.ts',
  'saas-route-consistency.spec.ts',
  'saas-tenant.controller.spec.ts',
  'saas-platform.controller.spec.ts',
  'saas-payment.controller.spec.ts'
]

function readFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function assertIncludes(source: string, token: string, label: string) {
  assert(source.includes(token), `${label} must include ${token}`)
}

const packageJson = JSON.parse(readFile('package.json'))
const readinessScript = packageJson.scripts?.['verify:saas-readiness'] || ''

assert(readinessScript.startsWith('jest --'), 'package.json must define verify:saas-readiness with jest')
for (const suite of expectedSuites) {
  assertIncludes(readinessScript, suite, 'verify:saas-readiness script')
}
for (const token of ['--runInBand', '--forceExit']) {
  assertIncludes(readinessScript, token, 'verify:saas-readiness script')
}

const checklist = readFile('../docs/saas-launch-readiness-checklist.md')
assertIncludes(checklist, 'cd server', 'launch readiness checklist')
assertIncludes(checklist, 'pnpm.cmd run verify:saas-readiness', 'launch readiness checklist')
for (const suite of expectedSuites) {
  assertIncludes(checklist, suite, 'launch readiness checklist')
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS backend readiness command verified.')
```

- [ ] **Step 2: Run verifier to confirm RED**

Run:

```powershell
cd server
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: FAIL because `server/package.json` does not yet define `verify:saas-readiness`, and the checklist does not yet show the backend aggregate command.

---

### Task 2: Add Backend Readiness Package Script and Checklist Entry

**Files:**
- Modify: `server/package.json`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: the existing focused SaaS Jest suites.
- Produces: `pnpm.cmd run verify:saas-readiness` in `server/`.

- [ ] **Step 1: Add the package script**

In `server/package.json`, add this script next to the existing Jest scripts:

```json
"verify:saas-readiness": "jest -- saas-main-flow.integration.spec.ts saas-route-consistency.spec.ts saas-tenant.controller.spec.ts saas-platform.controller.spec.ts saas-payment.controller.spec.ts --runInBand --forceExit"
```

- [ ] **Step 2: Update the launch checklist backend gate**

Update `docs/saas-launch-readiness-checklist.md` backend block so it starts with:

```powershell
cd server
pnpm.cmd run verify:saas-readiness

# Expanded backend gate
pnpm.cmd test -- saas-main-flow.integration.spec.ts saas-route-consistency.spec.ts saas-tenant.controller.spec.ts saas-platform.controller.spec.ts saas-payment.controller.spec.ts --runInBand --forceExit
```

- [ ] **Step 3: Run verifier to confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: PASS and print `SaaS backend readiness command verified.`

---

### Task 3: Run Backend Readiness Gate and Review

**Files:**
- No additional edits expected.

**Interfaces:**
- Consumes: `server/package.json` script from Task 2.
- Produces: verification evidence suitable for release checklist usage.

- [ ] **Step 1: Run the backend aggregate gate**

Run:

```powershell
cd server
pnpm.cmd run verify:saas-readiness
```

Expected: PASS for the five focused SaaS suites.

- [ ] **Step 2: Run repository whitespace review**

Run:

```powershell
git diff --check
git diff --cached --check
```

Expected: both commands exit `0`.

- [ ] **Step 3: Review the diff**

Run:

```powershell
git diff -- docs/saas-launch-readiness-checklist.md server/package.json server/scripts/verify-saas-readiness-command.ts docs/superpowers/plans/2026-07-08-p4-saas-backend-readiness-command.md
```

Expected: only the plan, backend verifier, package script, and checklist backend command changed.

- [ ] **Step 4: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-08-p4-saas-backend-readiness-command.md docs/saas-launch-readiness-checklist.md server/package.json server/scripts/verify-saas-readiness-command.ts
git commit -m "test: add saas backend readiness command"
```

Expected: local commit created; do not push.

---

## Self-Review

- Spec coverage: The plan covers a backend aggregate command, static drift check, launch checklist update, execution of the aggregate gate, diff review, and local commit.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The package script name is consistently `verify:saas-readiness`; the verifier filename is consistently `server/scripts/verify-saas-readiness-command.ts`.
