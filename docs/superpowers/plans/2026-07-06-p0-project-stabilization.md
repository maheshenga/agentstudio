# P0 Project Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the current SaaS/Admin/AI project by adding repeatable checks for user-facing mojibake, SaaS route/page consistency, and a concise local verification runbook.

**Architecture:** Keep P0 as a guardrail layer rather than new product behavior. Add Jest-based audit specs under the backend test tree so the existing `pnpm.cmd exec jest` workflow can validate cross-project files, and add one documentation file that records the verified routes and commands.

**Tech Stack:** NestJS 11, Jest, Node `fs/path`, Vue 3 file layout, existing SaaS migrations and module manifests.

---

## File Structure

- Create: `server/src/module/saas/saas-visible-text-encoding.spec.ts`
  - Scans active SaaS/Admin user-facing source for common mojibake sequences and includes fixture tests proving the detector works.
- Create: `server/src/module/saas/saas-route-consistency.spec.ts`
  - Verifies SaaS API routes, seeded route paths, and menu components map to real backend/frontend surfaces.
- Modify: `server/src/migration-specs/align-saas-resource-pack-order-menu.spec.ts`
  - Keeps the existing localized resource-pack order menu migration test aligned with current seeded Chinese labels.
- Create: `docs/saas/p0-local-stability-checklist.md`
  - Documents the P0 verification scope, route map, known dirty-worktree exclusions, and commands.

---

### Task 1: Add Mojibake Regression Audit

**Files:**
- Create: `server/src/module/saas/saas-visible-text-encoding.spec.ts`

- [ ] **Step 1: Write the audit test**

Create a Jest spec that:

- includes a fixture with known UTF-8-as-GBK mojibake and verifies the detector flags it;
- includes a readable Chinese fixture and verifies the detector does not flag it;
- scans active SaaS source files and fails with file/line/column findings if known mojibake appears.

- [ ] **Step 2: Run the focused audit**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-visible-text-encoding.spec.ts --runInBand
```

Expected: PASS after the detector works and active SaaS source has no findings.

---

### Task 2: Add SaaS Route/Page Consistency Audit

**Files:**
- Create: `server/src/module/saas/saas-route-consistency.spec.ts`

- [ ] **Step 1: Write the route consistency test**

Create a Jest spec that:

- collects SaaS backend controller routes from Nest metadata;
- extracts `/api/saas/*` frontend request URLs from `web/src/api/saas.ts` and module routes from `web/src/api/system-module.ts`;
- verifies extracted frontend routes have matching backend methods;
- verifies key SaaS module route paths and seeded menu components point to existing Vue pages;
- keeps tenant resource-pack routes pluralized consistently.

- [ ] **Step 2: Run the focused route audit**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-route-consistency.spec.ts --runInBand
```

Expected: PASS.

---

### Task 3: Add P0 Local Stability Checklist

**Files:**
- Create: `docs/saas/p0-local-stability-checklist.md`

- [ ] **Step 1: Create the checklist**

Document:

- P0 scope;
- tenant and platform SaaS route baseline;
- focused backend audit command;
- backend full verification command;
- frontend build command;
- local files/directories that should not be staged unless intentionally changed.

- [ ] **Step 2: Review the checklist for current route names**

Confirm the route list matches `server/src/migrations` and `web/src/views/saas`.

---

### Task 4: Full Verification, Review, and Commit

**Files:**
- Stage only:
  - `docs/superpowers/plans/2026-07-06-p0-project-stabilization.md`
  - `docs/saas/p0-local-stability-checklist.md`
  - `server/src/migration-specs/align-saas-resource-pack-order-menu.spec.ts`
  - `server/src/module/saas/saas-visible-text-encoding.spec.ts`
  - `server/src/module/saas/saas-route-consistency.spec.ts`

- [ ] **Step 1: Run focused P0 audits**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-visible-text-encoding.spec.ts src/module/saas/saas-route-consistency.spec.ts src/migration-specs/align-saas-resource-pack-order-menu.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend verification**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand
pnpm.cmd run build
```

Expected: PASS and build exits 0.

- [ ] **Step 3: Run frontend build**

Run:

```powershell
cd web
pnpm.cmd run build
```

Expected: build exits 0.

- [ ] **Step 4: Review diff and local noise**

Run:

```powershell
git diff -- docs/superpowers/plans/2026-07-06-p0-project-stabilization.md docs/saas/p0-local-stability-checklist.md server/src/migration-specs/align-saas-resource-pack-order-menu.spec.ts server/src/module/saas/saas-visible-text-encoding.spec.ts server/src/module/saas/saas-route-consistency.spec.ts
git status --short
```

Confirm `server/pnpm-lock.yaml`, `.codebase-memory/`, and `.codegraph/` are not staged.

- [ ] **Step 5: Commit P0 stabilization**

Run:

```powershell
git add docs/superpowers/plans/2026-07-06-p0-project-stabilization.md docs/saas/p0-local-stability-checklist.md server/src/migration-specs/align-saas-resource-pack-order-menu.spec.ts server/src/module/saas/saas-visible-text-encoding.spec.ts server/src/module/saas/saas-route-consistency.spec.ts
git commit -m "test: add p0 saas stability audits"
```

Expected: commit succeeds and unrelated local noise remains uncommitted.

---

## Self-Review

- Spec coverage: This plan covers the P0 stabilization scope from the project analysis: mojibake regression guard, SaaS route/page consistency, verification commands, and clean commit boundaries.
- Placeholder scan: No TBD/TODO/fill-in instructions remain.
- Type consistency: Test filenames, route strings, and checklist route names match the planned files and current SaaS route convention.
