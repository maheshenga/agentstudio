# P3 App Factory Template Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a curated template library to the module factory so platform admins can start new marketplace apps from safe, reusable static HTML/CSS templates.

**Architecture:** Store templates in a new `app_factory_template` table owned by the existing app module. Seed several safe templates through migrations, expose read-only platform APIs under `/api/app-platform/factory/templates`, and let the existing factory page apply a template into the draft form before saving/publishing through the existing static app runtime.

**Tech Stack:** NestJS 11, TypeORM, MySQL migrations, Jest, Vue 3, Element Plus, existing app factory service, existing request wrapper, existing readiness scripts.

## Global Constraints

- P3 template output remains static HTML/CSS only.
- P3 must not execute uploaded or generated backend code.
- Templates must pass the same unsafe HTML/CSS rejection rules before publish.
- Existing P0/P1/P2 marketplace and factory APIs must remain stable.
- Tenant id must come from auth context where tenant-scoped flows exist; P3 platform template APIs are not tenant-scoped.
- No invoice functionality.
- Use `pnpm.cmd` commands in PowerShell.

---

## File Structure

Backend create:

- `server/src/module/app/entities/app-factory-template.entity.ts`: template metadata and static HTML/CSS content.
- `server/src/migrations/1760000000032-CreateAppFactoryTemplateTables.ts`: template table migration.
- `server/src/migration-specs/create-app-factory-template-tables.spec.ts`: table migration test.
- `server/src/migrations/1760000000033-SeedAppFactoryTemplates.ts`: template seed and menu permission seed.
- `server/src/migration-specs/seed-app-factory-templates.spec.ts`: seed migration test.
- `server/src/module/app/services/app-factory-template.service.ts`: read-only template list/detail service.
- `server/src/module/app/services/app-factory-template.service.spec.ts`: service tests.

Backend modify:

- `server/src/module/app/app.module.ts`: register template entity and service.
- `server/src/module/app/app-factory.controller.ts`: add template list/detail endpoints.

Frontend modify:

- `web/src/api/app-factory.ts`: add template types and API wrappers.
- `web/src/views/app-platform/factory/index.vue`: add template drawer and apply-template action.
- `web/scripts/verify-app-factory-readiness.ts`: add template-library readiness checks.
- `docs/saas-launch-readiness-checklist.md`: add manual and automated factory template checks.

---

### Task 1: Template database and seed foundation

**Files:**

- Create: `server/src/module/app/entities/app-factory-template.entity.ts`
- Create: `server/src/migrations/1760000000032-CreateAppFactoryTemplateTables.ts`
- Create: `server/src/migration-specs/create-app-factory-template-tables.spec.ts`
- Create: `server/src/migrations/1760000000033-SeedAppFactoryTemplates.ts`
- Create: `server/src/migration-specs/seed-app-factory-templates.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**

- Produces entity class `AppFactoryTemplateEntity`.
- Produces table `app_factory_template`.
- Produces seeded template codes: `landing_page`, `job_board`, `classifieds`, `team_directory`.
- Produces permission slug `app:factory:template:list`.

- [ ] **Step 1: Write failing migration specs**

`create-app-factory-template-tables.spec.ts` asserts:

```ts
expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_factory_template`');
expect(sql).toContain('UNIQUE KEY `uk_app_factory_template_code` (`code`)');
expect(sql).toContain('KEY `idx_app_factory_template_category` (`category`)');
expect(sql).toContain('KEY `idx_app_factory_template_status` (`status`)');
```

`seed-app-factory-templates.spec.ts` asserts:

```ts
expect(params).toContain('landing_page');
expect(params).toContain('job_board');
expect(params).toContain('classifieds');
expect(params).toContain('team_directory');
expect(params).toContain('app:factory:template:list');
expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- create-app-factory-template-tables.spec.ts seed-app-factory-templates.spec.ts
```

Expected: fail because the migrations do not exist.

- [ ] **Step 3: Implement entity and migrations**

`app_factory_template` columns:

- `id` bigint primary key
- `code` varchar(80), unique
- `name` varchar(120)
- `category` varchar(50), default empty
- `icon` varchar(100), default empty
- `summary` varchar(255), default empty
- `description` text nullable
- `html_content` mediumtext nullable
- `css_content` mediumtext nullable
- `default_visibility` varchar(20), default `marketplace`
- `default_saas_module_code` varchar(50), default empty
- `default_system_module_code` varchar(80), default empty
- `status` tinyint default 1
- `sort` int default 100
- `remark` varchar(255) nullable
- `create_time`, `update_time`, `delete_time`

Seed migration inserts:

- `landing_page`: marketing landing page template
- `job_board`: recruitment/job board template
- `classifieds`: classified information template
- `team_directory`: directory/listing template
- permission `app:factory:template:list` under `AppFactory`
- role grants to `admin` and `super_admin`

- [ ] **Step 4: Run migration specs**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- create-app-factory-template-tables.spec.ts seed-app-factory-templates.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app/entities/app-factory-template.entity.ts server/src/migrations/1760000000032-CreateAppFactoryTemplateTables.ts server/src/migration-specs/create-app-factory-template-tables.spec.ts server/src/migrations/1760000000033-SeedAppFactoryTemplates.ts server/src/migration-specs/seed-app-factory-templates.spec.ts server/src/module/app/app.module.ts
git commit -m "feat: add app factory templates"
```

### Task 2: Template read API

**Files:**

- Create: `server/src/module/app/services/app-factory-template.service.ts`
- Create: `server/src/module/app/services/app-factory-template.service.spec.ts`
- Modify: `server/src/module/app/app-factory.controller.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**

- Produces `AppFactoryTemplateService.listTemplates(query)`.
- Produces `AppFactoryTemplateService.getTemplate(code)`.
- Produces routes:
  - `GET /api/app-platform/factory/templates`
  - `GET /api/app-platform/factory/templates/:code`

- [ ] **Step 1: Write failing service tests**

Create tests:

```ts
it('lists active templates by sort order', async () => {
  templateRepo.find.mockResolvedValue([{ code: 'job_board', name: 'Job Board', status: 1, sort: 20 }]);
  await expect(service.listTemplates({})).resolves.toEqual([
    expect.objectContaining({ code: 'job_board', name: 'Job Board', status: 1 }),
  ]);
  expect(templateRepo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { sort: 'ASC', id: 'ASC' } }));
});

it('filters templates by keyword and category', async () => {
  templateRepo.find.mockResolvedValue([]);
  await service.listTemplates({ keyword: 'job', category: 'Industry' });
  expect(templateRepo.find).toHaveBeenCalled();
});

it('returns a template detail by code', async () => {
  templateRepo.findOne.mockResolvedValue({ code: 'landing_page', name: 'Landing Page', status: 1 });
  await expect(service.getTemplate('landing_page')).resolves.toMatchObject({ code: 'landing_page' });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-factory-template.service.spec.ts
```

Expected: fail because service does not exist.

- [ ] **Step 3: Implement service and controller routes**

Service behavior:

- default to `status = 1`.
- filter by `keyword` against `code` or `name`.
- filter by `category` when provided.
- use `deleteTime: IsNull()`.
- return snake_case response keys matching factory form fields.
- throw `NotFoundException` for missing template detail.

Controller behavior:

- inject `AppFactoryTemplateService`.
- add `@RequirePermission('app:factory:template:list')`.
- return `ResultData.ok(...)`.

- [ ] **Step 4: Run backend checks**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-factory-template.service.spec.ts seed-app-factory-templates.spec.ts
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app/services/app-factory-template.service.ts server/src/module/app/services/app-factory-template.service.spec.ts server/src/module/app/app-factory.controller.ts server/src/module/app/app.module.ts
git commit -m "feat: add app factory template api"
```

### Task 3: Template picker frontend

**Files:**

- Modify: `web/src/api/app-factory.ts`
- Modify: `web/src/views/app-platform/factory/index.vue`
- Modify: `web/scripts/verify-app-factory-readiness.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**

- Consumes `fetchAppFactoryTemplates(params)`.
- Consumes `fetchAppFactoryTemplate(code)`.
- Produces a template drawer with an Apply action that fills the existing factory form.

- [ ] **Step 1: Extend readiness script first**

Add checks for:

```ts
assertIncludes(apiSource, '/api/app-platform/factory/templates', 'app factory API');
assertIncludes(apiSource, 'fetchAppFactoryTemplates', 'app factory API');
assertIncludes(apiSource, 'fetchAppFactoryTemplate', 'app factory API');
assertIncludes(pageSource, 'templateDrawerVisible', 'app factory page');
assertIncludes(pageSource, 'applyTemplate', 'app factory page');
assertIncludes(pageSource, 'Use Template', 'app factory page');
assertIncludes(pageSource, 'fetchAppFactoryTemplates', 'app factory page');
```

- [ ] **Step 2: Run readiness to verify RED**

Run:

```powershell
cd web
pnpm.cmd run verify:app-factory-readiness
```

Expected: fail because API/page template tokens do not exist.

- [ ] **Step 3: Implement frontend API wrappers**

Add:

- `AppFactoryTemplateRecord`
- `AppFactoryTemplateListParams`
- `fetchAppFactoryTemplates(params)`
- `fetchAppFactoryTemplate(code)`

- [ ] **Step 4: Implement template drawer**

UI behavior:

- Add `Use Template` button next to `Create Module`.
- Opening the drawer loads template cards/table.
- Template rows show `name`, `category`, `summary`, and default bindings.
- `Apply` opens the create dialog and fills:
  - `name`
  - `category`
  - `icon`
  - `summary`
  - `description`
  - `html_content`
  - `css_content`
  - `visibility`
  - `saas_module_code`
  - `system_module_code`
- Existing module editing remains unchanged.
- Preview remains sandboxed iframe without `allow-same-origin`.

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
git add web/src/api/app-factory.ts web/src/views/app-platform/factory/index.vue web/scripts/verify-app-factory-readiness.ts docs/saas-launch-readiness-checklist.md
git commit -m "feat: add app factory template picker"
```

### Task 4: Final P3 review

**Files:**

- All files changed by Tasks 1-3.

**Interfaces:**

- Verifies templates improve module factory creation without changing publish security boundaries.

- [ ] **Step 1: Run targeted backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- create-app-factory-template-tables.spec.ts seed-app-factory-templates.spec.ts app-factory-template.service.spec.ts app-factory.service.spec.ts
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
- no backend process execution
- no whitespace errors
- clean working tree after commits

## Self-Review

- Spec coverage: This P3 implements the first developer-ecosystem stepping stone by making the factory reusable through curated templates, while deferring developer center, ratings, monetization, and service-plugin runtime to later phases.
- Placeholder scan: This plan contains concrete files, tests, commands, expected outputs, and no deferred implementation placeholders.
- Type consistency: `AppFactoryTemplateEntity`, `AppFactoryTemplateService`, route paths, frontend API names, and readiness tokens are consistent across tasks.
