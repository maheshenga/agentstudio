# Module Platform Hardening Implementation Plan

> **Execution:** Inline execution only. The user explicitly requested no subagents. Track every task with RED, GREEN, review, and commit checkpoints.

**Goal:** Remove the legacy plugin subsystem and close all P0-P3 module-platform audit findings in risk order.

**Architecture:** The application platform becomes the only executable extension model. `system-module` remains the policy and entitlement layer, while SaaS and app-commerce supply plan and license access.

**Tech Stack:** NestJS, TypeORM, MySQL, Redis, Jest, Vue 3, TypeScript, Element Plus, pnpm.

## Global Constraints

- Do not retain compatibility routes for `/api/system/plugin` because the product has not launched.
- Do not expose secrets, raw environment values, service logs, or payment credentials.
- Do not enable developer service execution by default.
- Do not hand-edit generated `out` files; rebuild them.
- Add schema changes through TypeORM migrations and migration specs.
- Keep each commit independently buildable and reviewable.

---

### Task 1: Remove Legacy Plugin CRUD

**Files:**
- Delete: `server/src/module/system/plugin/**`
- Modify: `server/src/module/system/system.module.ts`
- Delete: `web/src/views/system/plugin/index.vue`
- Delete: `web/src/api/system/plugin.ts`
- Modify: `web/src/router/modules/system.ts`
- Regenerate: `server/public/openApi.json`

- [ ] Add route/module consistency assertions proving the legacy controller and route are absent.
- [ ] Run the focused tests and confirm they fail while legacy references exist.
- [ ] Remove the backend module, frontend route, view, and API client.
- [ ] Regenerate OpenAPI output and verify no `/api/system/plugin` operation remains.
- [ ] Run backend build, frontend type check, route checks, and commit.

### Task 2: Define Service Installation Semantics

**Files:**
- Modify: `server/src/module/app/services/app-tenant.service.ts`
- Modify: `server/src/module/app/services/app-service-invocation-policy.service.ts`
- Modify: `server/src/module/app/app-tenant.controller.ts`
- Modify: `web/src/views/app-center/marketplace/index.vue`
- Modify: `web/src/views/app-center/installed/index.vue`
- Test: corresponding service/controller specs

- [ ] Add failing tests requiring service installation to bind the active healthy published version.
- [ ] Add failing tests preventing service apps from producing an empty iframe open response.
- [ ] Implement a shared service-version resolver and service-specific tenant response state.
- [ ] Display Install, Installed, and callable-service state without an Open action.
- [ ] Run application tenant and invocation suites, type check, review, and commit.

### Task 3: Enforce Package State Governance

**Files:**
- Modify: `server/src/module/app/services/app-platform.service.ts`
- Modify: `server/src/module/app/dto/app-platform.dto.ts`
- Modify: `web/src/views/app-platform/apps/index.vue`
- Modify: `web/src/views/app-platform/reviews/index.vue`
- Test: `app-platform.service.spec.ts` and controller specs

- [ ] Add failing tests for illegal transitions and generic publication attempts.
- [ ] Implement an explicit transition table with version/runtime preconditions.
- [ ] Require explicit capability selections during approval; omitted selections approve none.
- [ ] Remove duplicate approval controls from the application detail page.
- [ ] Run review, platform, capability and frontend checks, then commit.

### Task 4: Add Tenant Module Grants

**Files:**
- Create: tenant grant/revoke DTOs under `server/src/module/system-module/dto`
- Modify: `system-module-platform.controller.ts`
- Modify: `system-module-registry.service.ts`
- Modify: `system-module-event.entity.ts` usage
- Modify: `web/src/api/system-module.ts`
- Modify: tenant/module platform views
- Test: controller and registry specs

- [ ] Add failing service and controller tests for grant, revoke, idempotency, platform scope, and event history.
- [ ] Implement transactional grant/revoke operations with operator and reason.
- [ ] Add tenant module management controls to the platform tenant workflow.
- [ ] Verify access diagnosis changes immediately after grant/revoke.
- [ ] Run focused backend/frontend checks, review, and commit.

### Task 5: Harden Uploads And Service Package Scanning

**Files:**
- Modify: app platform/developer controllers
- Modify: `app-package-storage.service.ts`
- Modify: `app-service-package.service.ts`
- Modify: environment configuration and `.env.example`
- Test: storage, scanner, controller, and environment specs

- [ ] Add failing tests for controller pre-buffer limits, uncompressed byte limits, per-file limits, compression ratio, and constructor-chain escapes.
- [ ] Add shared Multer limits and bounded archive extraction accounting.
- [ ] Reject constructor/prototype escape primitives and document that the scanner is defense in depth.
- [ ] Keep developer service flags disabled by default.
- [ ] Run package/runtime/security suites, review, and commit.

### Task 6: Make Entitlements And Dependencies Deterministic

**Files:**
- Modify: `system-module-access.service.ts`
- Modify: `system-module-registry.service.ts`
- Modify: built-in manifest validation
- Test: access, registry, manifest and route-consistency specs

- [ ] Add failing tests for partial bridge rows, baseline module listing, semver mismatch, cycles, and transitive disabled dependencies.
- [ ] Merge database bridge overrides per SaaS module with static defaults.
- [ ] Centralize baseline entitlement rules.
- [ ] Implement dependency graph validation and semver checks using the existing dependency set or a minimal local comparator.
- [ ] Run module and SaaS entitlement suites, review, and commit.

### Task 7: Operationalize Module Metadata

**Files:**
- Create: `server/src/module/system-module/entities/system-module-config.entity.ts`
- Create: `server/src/module/system-module/entities/system-tenant-module-config.entity.ts`
- Create: `server/src/module/system-module/dto/system-module-config.dto.ts`
- Create: `server/src/migrations/1760000000047-CreateSystemModuleConfiguration.ts`
- Create: `server/src/migration-specs/create-system-module-configuration.spec.ts`
- Modify: module registry, controllers, guard, menu integration, and UI
- Test: migration, registry, guard, menu and controller specs

- [ ] Add failing tests for platform config, tenant overrides, schema validation, health updates, dynamic API binding, and menu/permission synchronization.
- [ ] Add configuration persistence and bounded JSON-schema validation.
- [ ] Add health-check execution and sanitized event recording.
- [ ] Compile enabled API metadata into validated route bindings with built-in fallback.
- [ ] Synchronize declared menus and permissions with existing menu records without bypassing role permissions.
- [ ] Run module, menu, migration, readiness and frontend checks, review, and commit.

### Task 8: Close P2/P3 Commerce, Analytics, And UI Gaps

**Files:**
- Add migration for `app_open_log(app_code, create_time)`
- Modify: app order creation service and tests
- Split: commercial, developer, runtime, apps and reviews Vue pages into focused modules
- Normalize: module/application user-facing copy

- [ ] Add failing migration and order-idempotency tests.
- [ ] Add the analytics index and reject or reuse duplicate pending orders.
- [ ] Extract page sections without changing API contracts.
- [ ] Normalize the affected workflows to Chinese and preserve responsive behavior.
- [ ] Run frontend type/build checks, backend commerce/analytics tests, review, and commit.

### Task 9: Final Verification And Audit

- [ ] Run all focused module/app/app-commerce tests.
- [ ] Run backend build, migration specs, environment contract, and route consistency.
- [ ] Run frontend type checking and production build.
- [ ] Run `verify:saas-readiness` and the root readiness script where the environment permits.
- [ ] Run `git diff --check`, inspect every commit and working-tree diff, and fix findings.
- [ ] Report any browser or Linux-only service-runtime verification that remains environment-blocked.
