# P2 Route Menu Permission Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This run is explicitly inline-only because the user requested no more subagents.

**Goal:** Keep SaaS tenant/platform frontend menu routes, backend route permissions, and seeded permission/menu metadata aligned.

**Architecture:** Add regression tests around the existing metadata-driven route system instead of refactoring routing. The backend controller decorators remain the source of API permission enforcement, while migrations remain the source of seeded menu and permission rows.

**Tech Stack:** NestJS, TypeORM migrations, Jest, Vue route components loaded through the existing backend-menu-driven frontend router.

---

## File Map

- Modify: `server/src/module/saas/saas-route-consistency.spec.ts`
  - Adds a metadata regression test proving SaaS controller `@RequirePermission()` slugs are backed by seeded menu permissions.
  - Adds an explicit assertion that `GET /api/saas/tenant/modules` uses `tenant:module:list`.
- Modify: `server/src/module/saas/saas-tenant.controller.spec.ts`
  - Updates the existing controller metadata expectation for `modules`.
- Modify: `server/src/module/saas/saas-tenant.controller.ts`
  - Changes only the `modules()` permission decorator from `tenant:billing:view` to `tenant:module:list`.
- Modify: `server/src/migration-specs/seed-system-modules.spec.ts`
  - Adds regression coverage for the readable tenant module label.

## Task 1: Add route permission regression tests

**Files:**
- Modify: `server/src/module/saas/saas-route-consistency.spec.ts`
- Modify: `server/src/module/saas/saas-tenant.controller.spec.ts`

- [ ] **Step 1: Write failing tests**

Expected changes:

```typescript
expect(findRoutePermission('/api/saas/tenant/modules', 'GET')).toEqual(['tenant:module:list']);
expect(Reflect.getMetadata('requirePermission', controller.modules)).toEqual(['tenant:module:list']);
```

- [ ] **Step 2: Run RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-route-consistency.spec.ts src/module/saas/saas-tenant.controller.spec.ts --runInBand
```

Expected: FAIL because `SaasTenantController.modules()` still uses `tenant:billing:view`.

## Task 2: Align tenant module endpoint permission

**Files:**
- Modify: `server/src/module/saas/saas-tenant.controller.ts`

- [ ] **Step 1: Implement minimal change**

Expected code:

```typescript
@Get('modules')
@RequirePermission('tenant:module:list')
@ApiOperation({ summary: 'Get current tenant SaaS modules' })
async modules() {
```

- [ ] **Step 2: Run GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-route-consistency.spec.ts src/module/saas/saas-tenant.controller.spec.ts --runInBand
```

Expected: PASS.

## Task 3: Lock tenant module seed label

**Files:**
- Modify: `server/src/migration-specs/seed-system-modules.spec.ts`

- [ ] **Step 1: Add seed-label regression coverage**

Expected assertion:

```typescript
expect(params).toContain('租户模块');
expect(params).not.toContain('绉熸埛妯″潡');
```

- [ ] **Step 2: Run focused seed-label check**

Run:

```powershell
cd server
pnpm.cmd exec jest src/migration-specs/seed-system-modules.spec.ts --runInBand
```

Expected: PASS if the current seed is already readable. If it fails, change only `TENANT_MENU.name` in `server/src/migrations/1760000000021-SeedSystemModules.ts` to `租户模块` and re-run this command.

## Task 4: Verify, review, commit

**Files:**
- All intentional files above.

- [ ] **Step 1: Focused regression**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-route-consistency.spec.ts src/module/saas/saas-tenant.controller.spec.ts src/migration-specs/seed-system-modules.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Broader SaaS/menu regression**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-visible-text-encoding.spec.ts src/module/saas/saas-route-consistency.spec.ts src/module/saas/saas-tenant.controller.spec.ts src/migration-specs/seed-system-modules.spec.ts src/migration-specs/align-tenant-system-module-role-grants.spec.ts src/migration-specs/align-tenant-resource-pack-role-grants-and-labels.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: PASS.

- [ ] **Step 4: Review diff**

Run:

```powershell
git diff -- server/src/module/saas/saas-route-consistency.spec.ts server/src/module/saas/saas-tenant.controller.spec.ts server/src/module/saas/saas-tenant.controller.ts server/src/migration-specs/seed-system-modules.spec.ts docs/superpowers/plans/2026-07-06-p2-route-menu-permission-consistency.md
```

Expected: Only planned files changed.

- [ ] **Step 5: Commit intentional files**

Run:

```powershell
git add docs/superpowers/plans/2026-07-06-p2-route-menu-permission-consistency.md server/src/module/saas/saas-route-consistency.spec.ts server/src/module/saas/saas-tenant.controller.spec.ts server/src/module/saas/saas-tenant.controller.ts server/src/migration-specs/seed-system-modules.spec.ts
git commit -m "fix: align saas tenant module permissions"
```

Expected: Commit created. Do not stage `server/pnpm-lock.yaml`, `.codebase-memory/`, or `.codegraph/`.
