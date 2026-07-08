# P2 SaaS AI Runtime Readiness Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure backend SaaS readiness covers the remaining AI, Taixu, upload, configuration, scheduler, logging, and SaaS provisioning specs that protect runtime module behavior.

**Architecture:** Extend the existing backend readiness command contract so it fails when these runtime module specs are omitted. Then add the missing spec filenames to `server/package.json` `verify:saas-readiness` and document that backend readiness includes AI/Taixu runtime and upload boundaries.

**Tech Stack:** NestJS/Jest service/controller specs, package-script contract spec, Markdown checklist.

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
  - Requires AI/Taixu/upload/config/scheduler/provisioning specs in backend SaaS readiness.
- Modify: `server/package.json`
  - Adds the required spec filenames to `verify:saas-readiness`.
- Modify: `docs/saas-launch-readiness-checklist.md`
  - Documents that backend readiness includes AI/Taixu runtime, upload, config, scheduler, and SaaS provisioning coverage.

## Required Added Specs

Add these spec filenames to the backend readiness command contract and package script:

```ts
const REQUIRED_AI_RUNTIME_SPECS = [
  'configuration.spec.ts',
  'ai-admin.controller.spec.ts',
  'openai-stream.util.spec.ts',
  'chat.service.spec.ts',
  'llm-provider.service.spec.ts',
  'taixu-llm-runtime.service.spec.ts',
  'taixu-model.service.spec.ts',
  'upload.service.spec.ts',
  'task.service.spec.ts',
  'log-username-length.spec.ts',
  'saas-provisioning.service.spec.ts',
];
```

### Task 1: Extend Backend Readiness Contract

**Files:**
- Modify: `server/src/config/saas-readiness-command.spec.ts`

**Interfaces:**
- Consumes: `server/package.json`.
- Produces: a Jest contract that fails when AI/Taixu/upload/config/scheduler/provisioning specs are omitted from `verify:saas-readiness`.

- [ ] **Step 1: Add the missing spec names to `REQUIRED_BACKEND_SAAS_READINESS_SPECS`**

Append the required AI runtime spec filenames to the existing array.

- [ ] **Step 2: Run contract spec to verify RED**

Run:

```powershell
cd server
npm.cmd test -- saas-readiness-command.spec.ts --runInBand
```

Expected: FAIL because the current package script does not include `chat.service.spec.ts`, `taixu-llm-runtime.service.spec.ts`, `upload.service.spec.ts`, or related runtime specs.

### Task 2: Expand Backend Readiness Script

**Files:**
- Modify: `server/package.json`

**Interfaces:**
- Produces: `npm.cmd run verify:saas-readiness` runs the runtime module specs together with the existing SaaS suite.

- [ ] **Step 1: Add required spec names to `verify:saas-readiness`**

Add the required spec names before `saas-readiness-command.spec.ts` so the command contract remains last:

```json
"configuration.spec.ts ai-admin.controller.spec.ts openai-stream.util.spec.ts chat.service.spec.ts llm-provider.service.spec.ts taixu-llm-runtime.service.spec.ts taixu-model.service.spec.ts upload.service.spec.ts task.service.spec.ts log-username-length.spec.ts saas-provisioning.service.spec.ts saas-readiness-command.spec.ts"
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
- Produces: release checklist copy that says backend readiness covers AI/Taixu runtime and upload boundaries.

- [ ] **Step 1: Add runtime coverage note**

Under the backend expanded gate block, add:

```markdown
Backend readiness includes AI provider/admin flows, chat runtime, Taixu LLM/model runtime, upload safety, scheduler tasks, log username length, and SaaS provisioning coverage.
```

- [ ] **Step 2: Confirm checklist mentions Taixu LLM**

Run:

```powershell
Select-String -Path docs/saas-launch-readiness-checklist.md -Pattern 'Taixu LLM'
```

Expected: at least one match.

### Task 4: Verification, Review, and Commit

**Files:**
- Modify: all files listed above plus this plan.

**Interfaces:**
- Produces: one local commit on `saas-order-risk-ops`.

- [ ] **Step 1: Run focused added runtime suites**

Run:

```powershell
cd server
npm.cmd test -- configuration.spec.ts ai-admin.controller.spec.ts openai-stream.util.spec.ts chat.service.spec.ts llm-provider.service.spec.ts taixu-llm-runtime.service.spec.ts taixu-model.service.spec.ts upload.service.spec.ts task.service.spec.ts log-username-length.spec.ts saas-provisioning.service.spec.ts --runInBand
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
git add docs/superpowers/plans/2026-07-09-p2-saas-ai-runtime-readiness-coverage.md docs/saas-launch-readiness-checklist.md server/package.json server/src/config/saas-readiness-command.spec.ts
git commit -m "test: expand saas ai runtime readiness coverage"
```

Expected: commit created on `saas-order-risk-ops`; do not push.

## Self-Review

- Spec coverage: Covers configuration, AI admin/controller, OpenAI stream utility, chat, LLM provider, Taixu LLM/model, upload, scheduler task, log username, SaaS provisioning, focused tests, full backend readiness, backend build, root verifier, review, and commit.
- Placeholder scan: No TBD/TODO/later placeholders remain.
- Type consistency: The spec filenames match current files under `server/src`.
