# SaaS Role Boundaries P0-P2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden ordinary user, tenant admin, and platform admin boundaries before continuing SaaS feature work.

**Architecture:** Keep tenant APIs protected by tenant-scoped permission slugs, and verify active tenant membership before issuing tenant-scoped login sessions. Extend existing tenant member service/controller boundaries without adding invitation tables in this commit.

**Tech Stack:** NestJS, TypeORM, Jest, Vue 3, Element Plus.

---

### Task 1: P0 Tenant-Scoped Login Safety

**Files:**
- Modify: `server/src/module/system/user/user.service.ts`
- Test: `server/src/module/system/user/user.service.spec.ts`

- [x] Add failing tests for login with a selected tenant that is not linked to the user.
- [x] Add failing tests for login with an inactive/deleted selected tenant.
- [x] Implement active membership and tenant status validation before login writes or token issuance.
- [x] Verify the user service spec passes.

### Task 2: P0 Tenant API Permission Metadata

**Files:**
- Modify: `server/src/module/saas/saas-tenant.controller.ts`
- Test: `server/src/module/saas/saas-tenant.controller.spec.ts`

- [x] Add failing metadata tests for tenant SaaS endpoint permissions.
- [x] Add `@RequirePermission` to tenant plan, usage, module, member, resource pack, subscription, and order routes.
- [x] Verify the tenant controller spec passes.

### Task 3: P1 Tenant Member Management

**Files:**
- Modify: `server/src/module/saas/services/saas-tenant-member.service.ts`
- Modify: `server/src/module/saas/saas-tenant.controller.ts`
- Modify: `web/src/api/saas.ts`
- Modify: `web/src/views/saas/tenant/member/index.vue`
- Test: `server/src/module/saas/services/saas-tenant-member.service.spec.ts`
- Test: `server/src/module/saas/saas-tenant.controller.spec.ts`

- [x] Add member role, status, remove, and reset password service tests.
- [x] Implement service methods with current-tenant checks and owner protection.
- [x] Expose tenant member management routes with member module gate and tenant permission.
- [x] Add frontend API functions and member page actions.

### Task 4: P2 User Profile SaaS Summary

**Files:**
- Modify: `web/src/views/dashboard/user-center/index.vue`

- [x] Display account scope, current tenant, tenant role, and permission count using existing `getCurrentUser()` fields.

### Task 5: Verification, Review, Commit

**Files:**
- Exclude `server/pnpm-lock.yaml`, `.codegraph/`, and `.codebase-memory/` from this feature commit.

- [x] Run targeted Jest specs.
- [x] Run full backend Jest.
- [x] Run backend build.
- [x] Run frontend build.
- [x] Review diff and stage only intended files.
