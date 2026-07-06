# P3 Frontend Build Warning Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This run is inline-only because the user requested no more subagents.

**Goal:** Remove the actionable frontend build warning caused by invalid Vue deep selector syntax.

**Architecture:** Keep the existing Vue component and style structure unchanged. Replace deprecated `::deep` syntax with Vue 3 compatible `:deep()` syntax in the affected component, then verify by scanning source and rebuilding the frontend.

**Tech Stack:** Vue 3, Vite, lightningcss, PowerShell, `pnpm.cmd`.

---

## File Map

- Modify: `web/src/views/safeguard/redis/index.vue`
  - Replace `::deep(.dark)` with `:deep(.dark)`.
  - Clean nearby mojibake comments while touching the same style block.

## Task 1: Capture warning as a failing check

**Files:**
- Read only: `web/src/views/safeguard/redis/index.vue`

- [ ] **Step 1: Run RED check**

Run:

```powershell
if (rg -n "::deep" web/src -g "*.vue" -g "*.scss" -g "*.css") { exit 1 }
```

Expected: FAIL and print `web/src/views/safeguard/redis/index.vue`.

## Task 2: Replace invalid deep selector

**Files:**
- Modify: `web/src/views/safeguard/redis/index.vue`

- [ ] **Step 1: Implement minimal style fix**

Expected code:

```scss
// 深色模式
:deep(.dark) {
```

- [ ] **Step 2: Run GREEN source scan**

Run:

```powershell
if (rg -n "::deep" web/src -g "*.vue" -g "*.scss" -g "*.css") { exit 1 }
```

Expected: PASS with no output.

## Task 3: Verify frontend build

**Files:**
- Verify only.

- [ ] **Step 1: Type check**

Run:

```powershell
cd web
pnpm.cmd exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 2: Production build**

Run:

```powershell
cd web
pnpm.cmd run build
```

Expected: PASS, with no `::deep` lightningcss warning. Existing unrelated dynamic-import/plugin-timing warnings may remain.

- [ ] **Step 3: Commit intentional files**

Run:

```powershell
git add docs/superpowers/plans/2026-07-06-p3-frontend-build-warning-cleanup.md web/src/views/safeguard/redis/index.vue
git commit -m "fix: clean frontend deep selector warning"
```

Expected: Commit created. Do not stage `server/pnpm-lock.yaml`, `.codebase-memory/`, or `.codegraph/`.
