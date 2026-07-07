# P5 SaaS Root Readiness Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repository-root SaaS readiness command that runs both frontend and backend SaaS readiness gates from one stable command.

**Architecture:** Do not create a root package or add dependencies. Add a small CommonJS runner under root `scripts/` that shells into `web` and `server` and runs their existing `pnpm.cmd run verify:saas-readiness` commands. Add a static verifier so the root runner, frontend/backend subcommands, and launch checklist cannot drift silently.

**Tech Stack:** Node.js CommonJS script, pnpm on Windows PowerShell, existing frontend/backend readiness scripts, Markdown checklist.

## Global Constraints

- Do not change SaaS business behavior in this phase.
- Do not introduce a root `package.json` or new dependencies.
- Do not push to remote; commit locally only after verification.
- Invoice functionality remains out of scope.
- Use `pnpm.cmd` commands on Windows PowerShell.
- Preserve UTF-8 content and avoid broad formatting churn.

---

### Task 1: Add Root Readiness Static Verifier

**Files:**
- Create: `scripts/verify-saas-root-readiness-command.cjs`

**Interfaces:**
- Consumes: `scripts/run-saas-readiness.cjs`, `docs/saas-launch-readiness-checklist.md`, `web/package.json`, `server/package.json`
- Produces: a command that exits `0` only when the root SaaS readiness runner exists, invokes both subprojects, and the checklist documents the root command.

- [ ] **Step 1: Write the failing verifier**

Create `scripts/verify-saas-root-readiness-command.cjs` with these checks:

```js
const { existsSync, readFileSync } = require('node:fs')
const { resolve } = require('node:path')

const failures = []

function readFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function assert(condition, message) {
  if (!condition) failures.push(message)
}

function assertIncludes(source, token, label) {
  assert(source.includes(token), `${label} must include ${token}`)
}

function readPackage(path) {
  return JSON.parse(readFile(path))
}

const runnerPath = 'scripts/run-saas-readiness.cjs'
assert(existsSync(resolve(process.cwd(), runnerPath)), `${runnerPath} must exist`)

const runner = existsSync(resolve(process.cwd(), runnerPath)) ? readFile(runnerPath) : ''
for (const token of [
  'spawnSync',
  "path.join(rootDir, 'web')",
  "path.join(rootDir, 'server')",
  "pnpm.cmd",
  'verify:saas-readiness',
  'SaaS repository readiness verified.'
]) {
  assertIncludes(runner, token, 'root readiness runner')
}

const webPackage = readPackage('web/package.json')
const serverPackage = readPackage('server/package.json')
assert(webPackage.scripts?.['verify:saas-readiness'], 'web/package.json must define verify:saas-readiness')
assert(serverPackage.scripts?.['verify:saas-readiness'], 'server/package.json must define verify:saas-readiness')

const checklist = readFile('docs/saas-launch-readiness-checklist.md')
assertIncludes(checklist, 'node scripts/run-saas-readiness.cjs', 'launch readiness checklist')
assertIncludes(checklist, 'cd web', 'launch readiness checklist')
assertIncludes(checklist, 'cd server', 'launch readiness checklist')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS root readiness command verified.')
```

- [ ] **Step 2: Run verifier to confirm RED**

Run:

```powershell
node scripts/verify-saas-root-readiness-command.cjs
```

Expected: FAIL because `scripts/run-saas-readiness.cjs` and the root checklist command do not exist yet.

---

### Task 2: Add Root Readiness Runner and Checklist Entry

**Files:**
- Create: `scripts/run-saas-readiness.cjs`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: `web/package.json` script `verify:saas-readiness`, `server/package.json` script `verify:saas-readiness`
- Produces: `node scripts/run-saas-readiness.cjs` from repository root.

- [ ] **Step 1: Add the runner**

Create `scripts/run-saas-readiness.cjs`:

```js
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')
const checks = [
  { label: 'frontend', cwd: path.join(rootDir, 'web') },
  { label: 'backend', cwd: path.join(rootDir, 'server') }
]

for (const check of checks) {
  console.log(`\n[saas-readiness] ${check.label}`)
  const result = spawnSync('pnpm.cmd', ['run', 'verify:saas-readiness'], {
    cwd: check.cwd,
    stdio: 'inherit',
    shell: false
  })

  if (result.status !== 0) {
    console.error(`[saas-readiness] ${check.label} failed`)
    process.exit(result.status || 1)
  }
}

console.log('\nSaaS repository readiness verified.')
```

- [ ] **Step 2: Update the launch checklist root gate**

In `docs/saas-launch-readiness-checklist.md`, add this command at the start of `Automated Gates`:

```powershell
# Full repository gate
node scripts/run-saas-readiness.cjs
```

Keep the existing frontend and backend expanded gates below it.

- [ ] **Step 3: Run verifier to confirm GREEN**

Run:

```powershell
node scripts/verify-saas-root-readiness-command.cjs
```

Expected: PASS and print `SaaS root readiness command verified.`

---

### Task 3: Run Root Readiness Gate and Review

**Files:**
- No additional edits expected.

**Interfaces:**
- Consumes: root runner from Task 2.
- Produces: verification evidence that one root command runs both SaaS readiness gates.

- [ ] **Step 1: Run the root aggregate gate**

Run:

```powershell
node scripts/run-saas-readiness.cjs
```

Expected: frontend readiness and backend readiness both pass.

- [ ] **Step 2: Run focused static verifiers**

Run:

```powershell
node scripts/verify-saas-root-readiness-command.cjs
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
cd ../server
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: all three verifiers pass.

- [ ] **Step 3: Run repository whitespace review**

Run:

```powershell
git diff --check
git diff --cached --check
```

Expected: both commands exit `0`.

- [ ] **Step 4: Review the diff**

Run:

```powershell
git diff -- docs/saas-launch-readiness-checklist.md scripts/run-saas-readiness.cjs scripts/verify-saas-root-readiness-command.cjs docs/superpowers/plans/2026-07-08-p5-saas-root-readiness-command.md
```

Expected: only the P5 plan, root runner, root verifier, and checklist root command changed.

- [ ] **Step 5: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-08-p5-saas-root-readiness-command.md docs/saas-launch-readiness-checklist.md scripts/run-saas-readiness.cjs scripts/verify-saas-root-readiness-command.cjs
git commit -m "test: add repository saas readiness command"
```

Expected: local commit created; do not push.

---

## Self-Review

- Spec coverage: The plan covers root command design, static drift protection, checklist documentation, full command verification, focused verifier verification, diff review, and local commit.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The root command is consistently `node scripts/run-saas-readiness.cjs`; the static verifier is consistently `scripts/verify-saas-root-readiness-command.cjs`.
