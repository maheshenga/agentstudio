# SaaS Readiness Jest Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the backend SaaS readiness Jest options apply reliably so the readiness gate runs serially and does not produce avoidable worker shutdown warnings.

**Architecture:** Keep the existing root and backend readiness entry points. Add a backend contract test that verifies Jest CLI options are placed before the `--` pattern separator, then update `server/package.json` so `--runInBand` is parsed as a Jest option rather than a test name pattern. Remove `--forceExit` because, once correctly applied, it creates a forced-exit warning and can hide real open handles.

**Tech Stack:** NestJS backend, Jest, pnpm, TypeScript contract tests.

## Global Constraints

- Do not change SaaS business behavior or test coverage scope.
- Keep the backend readiness command listing the same required specs.
- Use TDD: write the failing command-order assertion first, verify it fails, then fix the package script.
- Do not push; commit locally after verification.

---

### Task 1: Guard Jest Option Ordering

**Files:**
- Modify: `server/src/config/saas-readiness-command.spec.ts`
- Modify: `server/package.json`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: `server/package.json` script `verify:saas-readiness`
- Produces: A contract that treats tokens before the first ` -- ` as Jest command/options and tokens after it as spec patterns.

- [ ] **Step 1: Write the failing test**

Replace the existing option assertions in `server/src/config/saas-readiness-command.spec.ts` with:

```typescript
    expect(command).toContain('--runInBand');
    expect(command).not.toContain('--forceExit');

    const [jestCommand, specPatternSegment] = command.split(' -- ');
    expect(jestCommand).toContain('--runInBand');
    expect(jestCommand).not.toContain('--forceExit');
    expect(specPatternSegment).not.toContain('--runInBand');
    expect(specPatternSegment).not.toContain('--forceExit');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm.cmd exec jest --runInBand saas-readiness-command.spec.ts
```

Expected: FAIL because current command still contains `--forceExit`.

- [ ] **Step 3: Write minimal implementation**

In `server/package.json`, change the `verify:saas-readiness` script from:

```json
"verify:saas-readiness": "jest -- saas-main-flow.integration.spec.ts ... saas-readiness-command.spec.ts --runInBand --forceExit"
```

to:

```json
"verify:saas-readiness": "jest --runInBand -- saas-main-flow.integration.spec.ts ... saas-readiness-command.spec.ts"
```

Keep the spec list unchanged.

- [ ] **Step 4: Update launch readiness notes**

In `docs/saas-launch-readiness-checklist.md`, add a short note that backend readiness now verifies Jest option ordering so serial execution flags cannot silently become test patterns, and that forced exit is intentionally not used.

- [ ] **Step 5: Run test to verify it passes**

Run:

```powershell
pnpm.cmd exec jest --runInBand saas-readiness-command.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Run readiness gates**

Run:

```powershell
pnpm.cmd run verify:saas-readiness
```

Expected: 82 suites and 537 tests pass, with `--runInBand` no longer listed in the "matching" regex and no forced-exit warning.

Then run from repo root:

```powershell
node scripts/run-saas-readiness.cjs
```

Expected: frontend readiness, frontend build, frontend preview smoke, backend build, and backend readiness all pass.

- [ ] **Step 7: Review and commit**

Run:

```powershell
git diff -- server/package.json server/src/config/saas-readiness-command.spec.ts docs/saas-launch-readiness-checklist.md
git status --short --branch
git add server/package.json server/src/config/saas-readiness-command.spec.ts docs/saas-launch-readiness-checklist.md docs/superpowers/plans/2026-07-09-saas-readiness-jest-options.md
git commit -m "test: enforce saas readiness jest option ordering"
```

Expected: one local commit on `saas-order-risk-ops`.

## Self-Review

- Spec coverage: The plan covers the observed readiness warning root cause, the contract test, the command fix, documentation, verification, and local commit.
- Placeholder scan: No TBD/TODO/fill-in-later items remain.
- Type consistency: The test uses the existing `command` string and Jest assertions already present in the file.
