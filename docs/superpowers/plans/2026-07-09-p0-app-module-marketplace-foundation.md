# P0 App Module Marketplace Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the safe P0 app marketplace foundation with internal, iframe, and static app package lifecycle support.

**Architecture:** Add an `app` backend module that owns app package records, static manifest validation, review/publish state, tenant installation, and open metadata. The module consumes existing tenant context, permission guards, upload/static-serving conventions, and later can bridge into `system_module` and `saas_module` without rewriting those layers.

**Tech Stack:** NestJS 11, TypeORM, MySQL, Jest, Vue 3, Element Plus, existing request wrapper, existing dynamic menu model.

## Global Constraints

- P0 supports only `internal`, `iframe`, and `static` app types.
- P0 must not execute uploaded backend code.
- Static apps are opened through a sandboxed iframe runner.
- Uploaded static packages must include `manifest.json`.
- Tenant id must come from auth context, not request body.
- Existing SaaS module and system-module behavior must remain compatible.
- No invoice functionality.
- Use `pnpm.cmd` commands in PowerShell.

---

## File Structure

Backend create:

- `server/src/module/app/entities/app-package.entity.ts`: app identity and marketplace metadata.
- `server/src/module/app/entities/app-package-version.entity.ts`: version, review, package, and publish state.
- `server/src/module/app/entities/app-review-log.entity.ts`: review and lifecycle audit records.
- `server/src/module/app/entities/tenant-app-install.entity.ts`: tenant app installation state.
- `server/src/module/app/entities/app-open-log.entity.ts`: app open audit events.
- `server/src/module/app/dto/app-platform.dto.ts`: platform create/update/list/review DTOs.
- `server/src/module/app/dto/app-tenant.dto.ts`: tenant list/install/open DTOs.
- `server/src/module/app/services/app-manifest.service.ts`: static manifest and zip-entry validation.
- `server/src/module/app/services/app-platform.service.ts`: platform app lifecycle operations.
- `server/src/module/app/services/app-tenant.service.ts`: tenant marketplace/install/open operations.
- `server/src/module/app/app-platform.controller.ts`: `/api/app-platform/*` routes.
- `server/src/module/app/app-tenant.controller.ts`: `/api/app-tenant/*` routes.
- `server/src/module/app/app.module.ts`: module wiring.
- `server/src/migrations/1760000000028-CreateAppMarketplaceTables.ts`: P0 table migration.
- `server/src/migration-specs/create-app-marketplace-tables.spec.ts`: migration proof.
- `server/src/module/app/services/app-manifest.service.spec.ts`: manifest validation tests.
- `server/src/module/app/services/app-platform.service.spec.ts`: platform lifecycle tests.
- `server/src/module/app/services/app-tenant.service.spec.ts`: tenant install/open tests.

Backend modify:

- `server/src/app.module.ts`: import `AppMarketplaceModule`.
- `server/src/main.ts`: serve static app public root under `/apps-static/`.
- `server/src/config/configuration.ts`: add app package storage config.
- `server/src/config/env.validation.ts`: add optional app package env keys.

Frontend create:

- `web/src/api/app-marketplace.ts`: platform and tenant app APIs.
- `web/src/views/app-platform/apps/index.vue`: platform app management page.
- `web/src/views/app-center/marketplace/index.vue`: tenant app marketplace page.
- `web/src/views/app-center/installed/index.vue`: tenant installed apps page.
- `web/src/views/app-center/open/index.vue`: app runner page.

Frontend modify:

- Add route/menu seed through backend migration in a later task, not hardcoded router changes.

---

### Task 1: Database foundation

**Files:**

- Create: `server/src/module/app/entities/app-package.entity.ts`
- Create: `server/src/module/app/entities/app-package-version.entity.ts`
- Create: `server/src/module/app/entities/app-review-log.entity.ts`
- Create: `server/src/module/app/entities/tenant-app-install.entity.ts`
- Create: `server/src/module/app/entities/app-open-log.entity.ts`
- Create: `server/src/migrations/1760000000028-CreateAppMarketplaceTables.ts`
- Create: `server/src/migration-specs/create-app-marketplace-tables.spec.ts`

**Interfaces:**

- Produces entity classes: `AppPackageEntity`, `AppPackageVersionEntity`, `AppReviewLogEntity`, `TenantAppInstallEntity`, `AppOpenLogEntity`.
- Produces tables: `app_package`, `app_package_version`, `app_review_log`, `tenant_app_install`, `app_open_log`.

- [ ] **Step 1: Write failing migration spec**

Create `server/src/migration-specs/create-app-marketplace-tables.spec.ts` that imports `CreateAppMarketplaceTables1760000000028`, calls `up()` and `down()` with a fake query runner, and asserts:

```ts
expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_package`');
expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_package_version`');
expect(sql).toContain('CREATE TABLE IF NOT EXISTS `tenant_app_install`');
expect(sql).toContain('UNIQUE KEY `uk_app_package_code` (`code`)');
expect(sql).toContain('UNIQUE KEY `uk_app_package_version` (`app_id`, `version`)');
expect(sql).toContain('UNIQUE KEY `uk_tenant_app_install_pair` (`tenant_id`, `app_id`)');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- create-app-marketplace-tables.spec.ts
```

Expected: fail because migration does not exist.

- [ ] **Step 3: Add entities and migration**

Implement the five TypeORM entities and the migration with idempotent `CREATE TABLE IF NOT EXISTS` statements. Use bigint primary keys on every table; add `uk_app_package_code`, `idx_app_package_status`, `idx_app_package_type`, `uk_app_package_version`, `idx_app_package_version_review`, `idx_app_package_version_publish`, `idx_app_review_log_app`, `uk_tenant_app_install_pair`, `idx_tenant_app_install_tenant`, `idx_app_open_log_tenant`, and `idx_app_open_log_app`; add `create_time`, `update_time`, and `delete_time` to `app_package`, `app_package_version`, and `tenant_app_install`; add `create_time` to review and open logs.

- [ ] **Step 4: Run migration spec**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- create-app-marketplace-tables.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app/entities server/src/migrations/1760000000028-CreateAppMarketplaceTables.ts server/src/migration-specs/create-app-marketplace-tables.spec.ts
git commit -m "feat: add app marketplace tables"
```

### Task 2: Manifest validation

**Files:**

- Create: `server/src/module/app/services/app-manifest.service.ts`
- Create: `server/src/module/app/services/app-manifest.service.spec.ts`

**Interfaces:**

- Produces `AppManifestService.validateStaticManifest(input: { manifest: unknown; entries: string[] }): StaticAppManifest`.
- Produces `StaticAppManifest` interface with `code`, `name`, `version`, `type`, `entry`, `category`, `summary`, `description`, `icon`, `tenant_scoped`, and `permissions`.

- [ ] **Step 1: Write failing tests**

Test cases:

```ts
expect(service.validateStaticManifest({ manifest: validManifest, entries })).toMatchObject({ code: 'job_board' });
expect(() => service.validateStaticManifest({ manifest: { ...validManifest, code: '../bad' }, entries })).toThrow('Invalid app code');
expect(() => service.validateStaticManifest({ manifest: { ...validManifest, version: '1' }, entries })).toThrow('Invalid app version');
expect(() => service.validateStaticManifest({ manifest: { ...validManifest, entry: '../index.html' }, entries })).toThrow('Invalid app entry');
expect(() => service.validateStaticManifest({ manifest: validManifest, entries: ['manifest.json'] })).toThrow('App entry file not found');
expect(() => service.validateStaticManifest({ manifest: validManifest, entries: [...entries, 'dist/server.php'] })).toThrow('Executable files are not allowed');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-manifest.service.spec.ts
```

Expected: fail because service does not exist.

- [ ] **Step 3: Implement validator**

Use path normalization without extracting files. Reject absolute paths, `..`, backslash traversal, executable extensions, missing entry, bad code, bad version, non-static type, and non-html entry.

- [ ] **Step 4: Run test**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-manifest.service.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app/services/app-manifest.service.ts server/src/module/app/services/app-manifest.service.spec.ts
git commit -m "feat: validate static app manifests"
```

### Task 3: Platform app lifecycle API

**Files:**

- Create: `server/src/module/app/dto/app-platform.dto.ts`
- Create: `server/src/module/app/services/app-platform.service.ts`
- Create: `server/src/module/app/services/app-platform.service.spec.ts`
- Create: `server/src/module/app/app-platform.controller.ts`
- Create: `server/src/module/app/app.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**

- Produces `AppPlatformService.listApps(query)`.
- Produces `AppPlatformService.createApp(dto, operatorId?)`.
- Produces `AppPlatformService.updateApp(code, dto, operatorId?)`.
- Produces `AppPlatformService.updateStatus(code, status, operatorId?)`.
- Produces routes under `/api/app-platform/apps`.

- [ ] **Step 1: Write service tests**

Tests cover:

- create iframe app sets `status = published`, `entryMode = iframe`, and `entryUrl`.
- create internal app sets `entryMode = internal_route`.
- duplicate code throws `BadRequestException`.
- update status records an app review log row.

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-platform.service.spec.ts
```

Expected: fail because service does not exist.

- [ ] **Step 3: Implement DTOs, service, controller, module wiring**

Use existing `ResultData.ok()` controller response style and `@RequirePermission()` slugs from the spec.

- [ ] **Step 4: Run tests**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-platform.service.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app server/src/app.module.ts
git commit -m "feat: add app platform lifecycle api"
```

### Task 4: Static upload review and publish

**Files:**

- Modify: `server/src/module/app/dto/app-platform.dto.ts`
- Modify: `server/src/module/app/services/app-platform.service.ts`
- Modify: `server/src/module/app/app-platform.controller.ts`
- Create: `server/src/module/app/services/app-package-storage.service.ts`
- Create: `server/src/module/app/services/app-package-storage.service.spec.ts`
- Modify: `server/src/config/configuration.ts`
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/src/main.ts`

**Interfaces:**

- Produces `AppPackageStorageService.getPackageRoot()`.
- Produces `AppPackageStorageService.getPublicRoot()`.
- Produces `AppPackageStorageService.publishVersion(input)`.
- Produces `AppPlatformService.submitVersion()`, `approveVersion()`, `rejectVersion()`, and `publishVersion()`.

- [ ] **Step 1: Write storage tests**

Tests cover safe path resolution, path traversal rejection, and publish target under the app public root.

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-package-storage.service.spec.ts
```

Expected: fail because storage service does not exist.

- [ ] **Step 3: Implement storage and static serving**

Add config defaults:

```text
APP_PACKAGE_DIR=../upload/app-packages
APP_PUBLIC_DIR=../upload/app-public
APP_PUBLIC_PREFIX=/apps-static/
```

Add `app.useStaticAssets(appPublicPath, { prefix: appPublicPrefix, maxAge: 86400000 })` before SPA fallback.

- [ ] **Step 4: Implement review/publish service methods**

Approval requires a pending version. Publish requires approved version and copies only that version to the public app root.

- [ ] **Step 5: Run tests**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-package-storage.service.spec.ts app-platform.service.spec.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add server/src/module/app server/src/config/configuration.ts server/src/config/env.validation.ts server/src/main.ts
git commit -m "feat: add static app review publishing"
```

### Task 5: Tenant marketplace install and open

**Files:**

- Create: `server/src/module/app/dto/app-tenant.dto.ts`
- Create: `server/src/module/app/services/app-tenant.service.ts`
- Create: `server/src/module/app/services/app-tenant.service.spec.ts`
- Create: `server/src/module/app/app-tenant.controller.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**

- Produces `AppTenantService.listMarketplace(tenantId)`.
- Produces `AppTenantService.listInstalled(tenantId)`.
- Produces `AppTenantService.installApp(tenantId, code, userId?)`.
- Produces `AppTenantService.uninstallApp(tenantId, code, userId?)`.
- Produces `AppTenantService.getOpenMetadata(tenantId, code, userId?, clientInfo?)`.

- [ ] **Step 1: Write tenant service tests**

Tests cover:

- marketplace lists published apps.
- install rejects unpublished static app.
- install creates `tenant_app_install`.
- open rejects uninstalled app.
- open returns iframe metadata for static and iframe apps.
- open returns internal route metadata for internal apps.

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-tenant.service.spec.ts
```

Expected: fail because service does not exist.

- [ ] **Step 3: Implement tenant service and controller**

Controllers must read tenant id from `getTenantId()` and return `Tenant context is required` when missing.

- [ ] **Step 4: Run tests**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-tenant.service.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app
git commit -m "feat: add tenant app marketplace api"
```

### Task 6: Frontend app center MVP

**Files:**

- Create: `web/src/api/app-marketplace.ts`
- Create: `web/src/views/app-platform/apps/index.vue`
- Create: `web/src/views/app-center/marketplace/index.vue`
- Create: `web/src/views/app-center/installed/index.vue`
- Create: `web/src/views/app-center/open/index.vue`

**Interfaces:**

- Produces API wrappers for platform and tenant endpoints.
- Produces platform app list with create iframe/internal dialogs.
- Produces tenant marketplace install/open flow.
- Produces sandboxed app runner.

- [ ] **Step 1: Add API wrapper**

Implement typed request functions for the P0 endpoints.

- [ ] **Step 2: Add platform page**

Use Element Plus table, compact filters, status tags, and action buttons. Include empty, loading, and error states.

- [ ] **Step 3: Add tenant marketplace and installed pages**

Use compact cards or table layout. Show type, category, install state, and open button.

- [ ] **Step 4: Add runner page**

Read `code` from route query, fetch open metadata, then render:

```html
<iframe sandbox="allow-scripts allow-forms allow-popups allow-downloads" />
```

Do not use `allow-same-origin` for uploaded static apps in P0.

- [ ] **Step 5: Run frontend build**

Run:

```powershell
cd web
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add web/src/api/app-marketplace.ts web/src/views/app-platform web/src/views/app-center
git commit -m "feat: add app marketplace frontend"
```

### Task 7: Menu and readiness checks

**Files:**

- Create: `server/src/migrations/1760000000025-SeedAppMarketplaceMenus.ts`
- Create: `server/src/migration-specs/seed-app-marketplace-menus.spec.ts`
- Create: `web/scripts/verify-app-marketplace-readiness.ts`
- Modify: `web/package.json`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**

- Produces menu entries for `/app-platform/apps`, `/app-center/marketplace`, `/app-center/installed`, and `/app-center/open`.
- Produces readiness command `verify:app-marketplace-readiness`.

- [ ] **Step 1: Add menu migration tests**

Assert menu code, route path, component path, and permission slugs.

- [ ] **Step 2: Implement menu migration**

Use idempotent inserts and grant admin role platform permissions.

- [ ] **Step 3: Add readiness script**

Verify key files, route paths, API URLs, sandbox attribute, and static prefix config exist.

- [ ] **Step 4: Run checks**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- seed-app-marketplace-menus.spec.ts
cd ..\web
pnpm.cmd run verify:app-marketplace-readiness
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/migrations/1760000000025-SeedAppMarketplaceMenus.ts server/src/migration-specs/seed-app-marketplace-menus.spec.ts web/scripts/verify-app-marketplace-readiness.ts web/package.json docs/saas-launch-readiness-checklist.md
git commit -m "test: add app marketplace readiness"
```

### Task 8: Final P0 review

**Files:**

- All files changed by Tasks 1-7.

**Interfaces:**

- Verifies P0 scope against `docs/superpowers/specs/2026-07-09-app-module-platform-design.md`.

- [ ] **Step 1: Run targeted backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- create-app-marketplace-tables.spec.ts app-manifest.service.spec.ts app-platform.service.spec.ts app-package-storage.service.spec.ts app-tenant.service.spec.ts seed-app-marketplace-menus.spec.ts
```

Expected: pass.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 3: Run frontend build and readiness**

Run:

```powershell
cd web
pnpm.cmd run build
pnpm.cmd run verify:app-marketplace-readiness
```

Expected: pass.

- [ ] **Step 4: Review diff**

Run:

```powershell
git status --short
git diff --stat HEAD
```

Expected: no uncommitted changes after final commit, or only intentionally staged final review updates.

- [ ] **Step 5: Final commit if needed**

```powershell
git add .
git commit -m "chore: review app marketplace p0"
```

Use this only if review updates were made after earlier task commits.

## Self-Review

- Spec coverage: Tasks 1-7 cover P0 database, app lifecycle, manifest validation, review/publish, tenant install/open, frontend pages, menus, and readiness checks.
- Placeholder scan: This plan contains no `TBD`, `TODO`, or open-ended implementation placeholders.
- Type consistency: Entity, service, route, and DTO names are consistent across tasks.
