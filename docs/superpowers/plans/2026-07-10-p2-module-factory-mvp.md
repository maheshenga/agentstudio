# P2 Module Factory MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe module factory MVP that lets platform admins create a simple HTML/CSS module and publish it as a marketplace app.

**Architecture:** Add factory-owned metadata tables under the existing `app` module. Publishing a factory module creates or updates a `static` `app_package`, creates an approved and published app version, writes a generated `dist/index.html` into the existing app package storage root, then uses `AppPackageStorageService.publishVersion()` so runtime delivery stays under `/apps-static/` and the existing sandboxed app runner.

**Tech Stack:** NestJS 11, TypeORM, MySQL migrations, Jest, Vue 3, Element Plus, existing app marketplace storage and request wrapper.

## Global Constraints

- P2 must not execute uploaded backend code.
- Factory output is static HTML/CSS only; no server-side runtime generation.
- Generated static apps are still opened through the existing sandboxed app runner.
- Generated HTML must reject `<script>`, inline event handlers, and `javascript:` URLs in P2.
- Tenant id must come from auth context, not request body.
- Existing app marketplace P0/P1 APIs must remain stable.
- No invoice functionality.
- Use `pnpm.cmd` commands in PowerShell.

---

## File Structure

Backend create:

- `server/src/module/app/entities/app-factory-module.entity.ts`: factory definition and publish state.
- `server/src/module/app/entities/app-factory-publish-log.entity.ts`: publish audit trail.
- `server/src/module/app/dto/app-factory.dto.ts`: list/create/update/publish DTOs.
- `server/src/module/app/services/app-factory.service.ts`: factory CRUD and publish operation.
- `server/src/module/app/services/app-factory.service.spec.ts`: service tests.
- `server/src/module/app/app-factory.controller.ts`: `/api/app-platform/factory/*` routes.
- `server/src/migrations/1760000000030-CreateAppFactoryTables.ts`: table migration.
- `server/src/migration-specs/create-app-factory-tables.spec.ts`: migration test.
- `server/src/migrations/1760000000031-SeedAppFactoryMenus.ts`: menu and permission seed.
- `server/src/migration-specs/seed-app-factory-menus.spec.ts`: menu migration test.

Backend modify:

- `server/src/module/app/app.module.ts`: register factory entities, controller, service.

Frontend create:

- `web/src/api/app-factory.ts`: platform factory API.
- `web/src/views/app-platform/factory/index.vue`: platform factory management page.
- `web/scripts/verify-app-factory-readiness.ts`: readiness gate.

Frontend modify:

- `web/package.json`: add `verify:app-factory-readiness`.
- `docs/saas-launch-readiness-checklist.md`: add factory manual and automated gates.

---

### Task 1: Factory database foundation

**Files:**

- Create: `server/src/module/app/entities/app-factory-module.entity.ts`
- Create: `server/src/module/app/entities/app-factory-publish-log.entity.ts`
- Create: `server/src/migrations/1760000000030-CreateAppFactoryTables.ts`
- Create: `server/src/migration-specs/create-app-factory-tables.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**

- Produces entity classes: `AppFactoryModuleEntity`, `AppFactoryPublishLogEntity`.
- Produces tables: `app_factory_module`, `app_factory_publish_log`.
- `AppFactoryModuleEntity.status` is `'draft' | 'published' | 'disabled' | 'archived'`.
- `AppFactoryModuleEntity.kind` is `'static_page'` in P2.

- [ ] **Step 1: Write failing migration spec**

Create `create-app-factory-tables.spec.ts` asserting migration SQL contains:

```ts
expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_factory_module`');
expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_factory_publish_log`');
expect(sql).toContain('UNIQUE KEY `uk_app_factory_module_code` (`code`)');
expect(sql).toContain('KEY `idx_app_factory_module_status` (`status`)');
expect(sql).toContain('KEY `idx_app_factory_publish_log_factory` (`factory_id`)');
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- create-app-factory-tables.spec.ts
```

Expected: fail because the migration does not exist.

- [ ] **Step 3: Implement entities and migration**

`app_factory_module` columns:

- `id` bigint primary key
- `code` varchar(80), unique
- `name` varchar(120)
- `kind` varchar(30), default `static_page`
- `category` varchar(50), default empty
- `icon` varchar(100), default empty
- `summary` varchar(255), default empty
- `description` text nullable
- `html_content` mediumtext nullable
- `css_content` mediumtext nullable
- `app_code` varchar(80), default empty
- `status` varchar(30), default `draft`
- `visibility` varchar(20), default `marketplace`
- `saas_module_code` varchar(50), default empty
- `system_module_code` varchar(80), default empty
- `latest_version` varchar(40), default empty
- `last_publish_time` datetime nullable
- `created_by` bigint nullable
- `sort` int default 100
- `remark` varchar(255) nullable
- `create_time`, `update_time`, `delete_time`

`app_factory_publish_log` columns:

- `id` bigint primary key
- `factory_id` bigint
- `app_id` bigint nullable
- `version_id` bigint nullable
- `version` varchar(40)
- `action` varchar(30)
- `message` varchar(500), default empty
- `operator_id` bigint nullable
- `metadata` json nullable
- `create_time`

- [ ] **Step 4: Run migration spec**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- create-app-factory-tables.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app/entities/app-factory-module.entity.ts server/src/module/app/entities/app-factory-publish-log.entity.ts server/src/migrations/1760000000030-CreateAppFactoryTables.ts server/src/migration-specs/create-app-factory-tables.spec.ts server/src/module/app/app.module.ts
git commit -m "feat: add app factory tables"
```

### Task 2: Factory publish service

**Files:**

- Create: `server/src/module/app/dto/app-factory.dto.ts`
- Create: `server/src/module/app/services/app-factory.service.ts`
- Create: `server/src/module/app/services/app-factory.service.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**

- Produces `AppFactoryService.listModules(query)`.
- Produces `AppFactoryService.createModule(dto, operatorId?)`.
- Produces `AppFactoryService.updateModule(code, dto, operatorId?)`.
- Produces `AppFactoryService.publishModule(code, dto, operatorId?)`.
- Produces generated app code `factory_${code}`.

- [ ] **Step 1: Write failing service tests**

Tests:

```ts
it('creates a static page factory module in draft state', async () => {
  factoryRepo.findOne.mockResolvedValue(null);
  await expect(service.createModule({ code: 'landing_page', name: 'Landing Page', html_content: '<h1>Hello</h1>' }, 7))
    .resolves.toMatchObject({ code: 'landing_page', status: 'draft', app_code: 'factory_landing_page' });
});

it('rejects unsafe static page html before publish', async () => {
  factoryRepo.findOne.mockResolvedValue({ id: 1, code: 'bad_page', name: 'Bad', htmlContent: '<script>alert(1)</script>' });
  await expect(service.publishModule('bad_page', { version: '1.0.0' }, 7)).rejects.toThrow('Factory page HTML contains unsafe script');
});

it('publishes a safe static page as a marketplace app version', async () => {
  factoryRepo.findOne.mockResolvedValueOnce({ id: 1, code: 'landing_page', name: 'Landing Page', htmlContent: '<h1>Hello</h1>', cssContent: 'body{color:#111}', visibility: 'marketplace', status: 'draft', appCode: 'factory_landing_page' });
  appRepo.findOne.mockResolvedValue(null);
  versionRepo.findOne.mockResolvedValue(null);
  storage.resolvePackagePath.mockReturnValue(packagePath);
  storage.publishVersion.mockResolvedValue({ publishPath, entryUrl: '/apps-static/factory_landing_page/1.0.0/dist/index.html' });
  await expect(service.publishModule('landing_page', { version: '1.0.0' }, 7)).resolves.toMatchObject({ status: 'published', latest_version: '1.0.0' });
  expect(appRepo.save).toHaveBeenCalledWith(expect.objectContaining({ code: 'factory_landing_page', type: 'static', status: 'published' }));
  expect(versionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ version: '1.0.0', reviewStatus: 'approved', publishStatus: 'published' }));
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-factory.service.spec.ts
```

Expected: fail because service does not exist.

- [ ] **Step 3: Implement DTOs and service**

Validation:

- `code` matches `^[a-z][a-z0-9_]{2,79}$`.
- `version` matches `^\d+\.\d+\.\d+$`.
- `kind` only allows `static_page`.
- `html_content` max 200000 chars.
- `css_content` max 100000 chars.
- reject `<script`, `onload=`, `onclick=`, and `javascript:` case-insensitively during publish.

Publish behavior:

- `appCode = module.appCode || factory_${module.code}`.
- create source directory: `storage.resolvePackagePath(appCode, version)`.
- write `dist/index.html`.
- call `storage.publishVersion({ appCode, version, sourceDir, entryFile: 'dist/index.html' })`.
- create or update `AppPackageEntity` as `type = 'static'`, `status = 'published'`, `entryMode = 'static'`.
- create `AppPackageVersionEntity` as approved and published.
- write `AppReviewLogEntity` action `publish`.
- write `AppFactoryPublishLogEntity` action `publish`.
- update factory `status`, `latestVersion`, `lastPublishTime`, and `appCode`.

- [ ] **Step 4: Run service test**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-factory.service.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app/dto/app-factory.dto.ts server/src/module/app/services/app-factory.service.ts server/src/module/app/services/app-factory.service.spec.ts server/src/module/app/app.module.ts
git commit -m "feat: add app factory publish service"
```

### Task 3: Factory platform API and menus

**Files:**

- Create: `server/src/module/app/app-factory.controller.ts`
- Create: `server/src/migrations/1760000000031-SeedAppFactoryMenus.ts`
- Create: `server/src/migration-specs/seed-app-factory-menus.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**

- Produces routes:
  - `GET /api/app-platform/factory/modules`
  - `POST /api/app-platform/factory/modules`
  - `GET /api/app-platform/factory/modules/:code`
  - `PUT /api/app-platform/factory/modules/:code`
  - `POST /api/app-platform/factory/modules/:code/publish`
- Produces permissions:
  - `app:factory:list`
  - `app:factory:create`
  - `app:factory:update`
  - `app:factory:publish`

- [ ] **Step 1: Write controller smoke test or migration spec**

Create `seed-app-factory-menus.spec.ts` asserting:

```ts
expect(sql).toContain('AppFactory');
expect(sql).toContain('/app-platform/factory');
expect(sql).toContain('app:factory:list');
expect(sql).toContain('app:factory:publish');
```

- [ ] **Step 2: Run spec to verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- seed-app-factory-menus.spec.ts
```

Expected: fail because migration does not exist.

- [ ] **Step 3: Implement controller and menu migration**

Controller uses `ResultData.ok()` and `@RequirePermission()`.

Menu migration adds child menu under `AppPlatform`:

- code `AppFactory`
- path `factory`
- component `/app-platform/factory`
- icon `ri:tools-line`
- permissions listed above

- [ ] **Step 4: Run backend checks**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- seed-app-factory-menus.spec.ts app-factory.service.spec.ts
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app/app-factory.controller.ts server/src/module/app/app.module.ts server/src/migrations/1760000000031-SeedAppFactoryMenus.ts server/src/migration-specs/seed-app-factory-menus.spec.ts
git commit -m "feat: add app factory platform api"
```

### Task 4: Factory frontend MVP

**Files:**

- Create: `web/src/api/app-factory.ts`
- Create: `web/src/views/app-platform/factory/index.vue`
- Create: `web/scripts/verify-app-factory-readiness.ts`
- Modify: `web/package.json`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**

- Consumes factory API routes from Task 3.
- Produces a platform page to list, create/edit, and publish static page modules.

- [ ] **Step 1: Write failing readiness script**

`verify-app-factory-readiness.ts` checks:

```ts
expected files exist
api source includes '/api/app-platform/factory/modules'
page source includes 'fetchAppFactoryModules'
page source includes 'publishAppFactoryModule'
page source includes 'html_content'
page source includes 'css_content'
page source includes 'ElDialog'
page source includes 'ElTable'
menu migration includes '/app-platform/factory'
```

Add package script:

```json
"verify:app-factory-readiness": "tsx scripts/verify-app-factory-readiness.ts"
```

- [ ] **Step 2: Run readiness to verify RED**

Run:

```powershell
cd web
pnpm.cmd run verify:app-factory-readiness
```

Expected: fail because files do not exist.

- [ ] **Step 3: Implement API wrapper**

Create:

- `fetchAppFactoryModules(params)`
- `fetchAppFactoryModule(code)`
- `createAppFactoryModule(params)`
- `updateAppFactoryModule(code, params)`
- `publishAppFactoryModule(code, version)`

- [ ] **Step 4: Implement platform page**

Page behavior:

- table columns: module, status, app code, latest version, updated time.
- create/edit dialog fields: code, name, category, summary, html content, css content, visibility, saas module code, system module code.
- publish button asks for version, defaults to next `1.0.0` when empty.
- show a warning that scripts and inline event handlers are rejected.

- [ ] **Step 5: Run frontend checks**

Run:

```powershell
cd web
pnpm.cmd run verify:app-factory-readiness
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add web/src/api/app-factory.ts web/src/views/app-platform/factory/index.vue web/scripts/verify-app-factory-readiness.ts web/package.json docs/saas-launch-readiness-checklist.md
git commit -m "feat: add app factory frontend"
```

### Task 5: Final P2 review

**Files:**

- All files changed by Tasks 1-4.

**Interfaces:**

- Verifies factory output uses existing marketplace runtime and does not add backend code execution.

- [ ] **Step 1: Run targeted backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- create-app-factory-tables.spec.ts seed-app-factory-menus.spec.ts app-factory.service.spec.ts app-tenant.service.spec.ts app-package-storage.service.spec.ts
```

Expected: pass.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 3: Run frontend readiness and build**

Run:

```powershell
cd web
pnpm.cmd run verify:app-factory-readiness
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 4: Review safety invariants**

Run:

```powershell
rg -n "allow-same-origin|child_process|exec\\(|spawn\\(|eval\\(" server/src/module/app web/src/views/app-platform/factory web/src/views/app-center/open
git diff --check HEAD
git status --short --branch
```

Expected:

- no new `allow-same-origin`
- no new backend process execution in `server/src/module/app`
- no whitespace errors
- clean working tree after commits

## Self-Review

- Spec coverage: Task 1 creates factory data storage, Task 2 publishes safe static modules through the existing app marketplace runtime, Task 3 exposes platform APIs and menus, Task 4 adds the platform UI, Task 5 verifies tests, builds, and safety invariants.
- Placeholder scan: This plan contains concrete tasks, files, commands, expected outputs, and no deferred implementation notes.
- Type consistency: `AppFactoryModuleEntity`, `AppFactoryPublishLogEntity`, `AppFactoryService`, route paths, and frontend API names are consistent across tasks.
