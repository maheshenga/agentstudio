# P6 Developer Submission Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let approved creators create and manage their own static apps, upload safe packages, and track or resubmit reviews without receiving platform review or publish authority.

**Architecture:** Add a developer-facing controller and ownership service on top of the existing app platform lifecycle. Existing RBAC assignment is the creator approval mechanism: the migration seeds developer permissions but grants them only to platform admins by default, so administrators can approve creators by assigning the menu and permissions through the current role management UI. Static package validation, extraction, audit logs, review, publish, rollback, and tenant runtime continue to use the existing platform services.

**Tech Stack:** NestJS 11, TypeORM, class-validator, Jest, Vue 3, Element Plus, Vite readiness scripts, existing app marketplace services.

---

## Global Constraints

- Developer routes derive the owner from authenticated `user.userId`; they never accept a developer id or tenant id from the request body.
- Developer routes create static apps only and never expose approve, reject, publish, rollback, unpublish, disable, or archive operations.
- A foreign app must be returned as not found so application codes cannot be used to enumerate another developer's data.
- Developers may edit metadata only while an app is `draft` or `rejected`.
- Developers may upload a new version to draft, rejected, approved, or published apps, but not disabled or archived apps.
- Resubmission is allowed only for a rejected version.
- Uploading or reviewing a new version must not hide an already published version from tenants.
- Static packages remain sandboxed; no uploaded server code is executed.
- No invoice, revenue sharing, paid marketplace, or service-plugin runtime is included in P6.
- Use `pnpm.cmd` in PowerShell.

## File Structure

Backend modify:

- `server/src/module/app/services/app-platform.service.ts`: add owner-scoped listing and preserve active published app state during new-version review.
- `server/src/module/app/services/app-platform.service.spec.ts`: cover owner filtering and published-state preservation.
- `server/src/module/app/app.module.ts`: register the developer controller and service.

Backend create:

- `server/src/module/app/dto/app-developer.dto.ts`: developer-safe create and update DTOs.
- `server/src/module/app/services/app-developer.service.ts`: enforce ownership and editable lifecycle states.
- `server/src/module/app/services/app-developer.service.spec.ts`: cover ownership, lifecycle, and delegated platform calls.
- `server/src/module/app/app-developer.controller.ts`: authenticated creator routes under `/api/app-developer/apps`.
- `server/src/migrations/1760000000035-SeedAppDeveloperMenus.ts`: seed creator workspace menu and permissions.
- `server/src/migration-specs/seed-app-developer-menus.spec.ts`: verify menu, permissions, and conservative grants.

Frontend create:

- `web/src/api/app-developer.ts`: owner-scoped developer API contracts.
- `web/src/views/app-center/developer/index.vue`: creator app list, metadata form, version drawer, upload, and rejected-version resubmission.
- `web/scripts/verify-app-developer-readiness.ts`: static contract verification for P6.

Frontend modify:

- `web/package.json`: add `verify:app-developer-readiness`.
- `docs/saas-launch-readiness-checklist.md`: add developer workflow and ownership checks.

---

### Task 1: Protect Published Apps During New-Version Review

**Files:**

- Modify: `server/src/module/app/services/app-platform.service.ts`
- Test: `server/src/module/app/services/app-platform.service.spec.ts`

**Interfaces:**

- Produces `AppPlatformService.listDeveloperApps(developerId)`.
- `uploadStaticVersion`, `submitVersion`, `approveVersion`, and `rejectVersion` preserve `app.status === 'published'` when an active version already exists.
- `submitVersion` accepts rejected versions only.

- [ ] **Step 1: Write failing owner-list test**

Add a test that makes `appRepo.find` return only the owner query result and asserts:

```ts
await expect(service.listDeveloperApps(17)).resolves.toEqual([
  expect.objectContaining({ code: 'creator_portal', developer_id: 17 }),
]);
expect(appRepo.find).toHaveBeenCalledWith(
  expect.objectContaining({
    where: expect.objectContaining({ developerId: 17 }),
  }),
);
```

- [ ] **Step 2: Run the service spec to verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-platform.service.spec.ts
```

Expected: FAIL because `listDeveloperApps` does not exist.

- [ ] **Step 3: Implement owner-scoped listing**

Add:

```ts
async listDeveloperApps(developerId: number) {
  const apps = await this.appRepo.find({
    where: { developerId, deleteTime: IsNull() },
    order: { sort: 'ASC', id: 'ASC' },
  });
  return apps.map((app) => this.toResponse(app));
}
```

- [ ] **Step 4: Run the owner-list test to verify GREEN**

Run the same Jest command and expect the suite to pass.

- [ ] **Step 5: Write failing lifecycle tests**

Add tests that start with a static app whose status is `published` and entry URL points at `1.0.0`, then assert:

```ts
await service.uploadStaticVersion('creator_portal', zipFile, 17);
expect(appRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'published' }));
```

Add rejection coverage:

```ts
await service.rejectVersion('creator_portal', '2.0.0', 'Needs changes', 1);
expect(appRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'published' }));
```

Add resubmission validation:

```ts
await expect(service.submitVersion('creator_portal', '1.0.0', 17)).rejects.toThrow(
  'Only rejected versions can be resubmitted',
);
```

- [ ] **Step 6: Run lifecycle tests to verify RED**

Run the service spec and expect failures showing that published state is overwritten and non-rejected versions are accepted.

- [ ] **Step 7: Implement minimal lifecycle protection**

Add a helper:

```ts
private updateAppReviewStatus(app: AppPackageEntity, status: AppPackageStatus) {
  if (app.status !== 'published') app.status = status;
}
```

Use it in upload, submit, approve, and reject. Before changing a submitted version, require `reviewStatus === 'rejected'`.

- [ ] **Step 8: Run service tests and commit**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-platform.service.spec.ts
```

Expected: all service tests pass.

Commit:

```powershell
git add server/src/module/app/services/app-platform.service.ts server/src/module/app/services/app-platform.service.spec.ts
git commit -m "fix: preserve published apps during version review"
```

### Task 2: Developer Ownership Service And API

**Files:**

- Create: `server/src/module/app/dto/app-developer.dto.ts`
- Create: `server/src/module/app/services/app-developer.service.ts`
- Create: `server/src/module/app/services/app-developer.service.spec.ts`
- Create: `server/src/module/app/app-developer.controller.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**

- `GET /api/app-developer/apps`
- `POST /api/app-developer/apps`
- `GET /api/app-developer/apps/:code`
- `PUT /api/app-developer/apps/:code`
- `POST /api/app-developer/apps/:code/versions/upload`
- `POST /api/app-developer/apps/:code/versions/:version/submit`

Permissions:

- `app:developer:list`
- `app:developer:read`
- `app:developer:create`
- `app:developer:update`
- `app:developer:upload`
- `app:developer:submit`

- [ ] **Step 1: Write failing service tests**

Create a service test with mocked `Repository<AppPackageEntity>` and `AppPlatformService`. Cover these exact behaviors:

```ts
it('creates a static marketplace app owned by the authenticated developer', async () => {
  await service.createApp(
    { code: 'creator_portal', name: 'Creator Portal' },
    17,
    'Alice',
  );
  expect(platformService.createApp).toHaveBeenCalledWith(
    expect.objectContaining({
      code: 'creator_portal',
      type: 'static',
      visibility: 'marketplace',
      developer_name: 'Alice',
    }),
    17,
  );
});

it('returns not found for another developer app', async () => {
  appRepo.findOne.mockResolvedValue(null);
  await expect(service.getApp('private_app', 17)).rejects.toThrow('App private_app not found');
});

it('blocks metadata edits while review is pending', async () => {
  appRepo.findOne.mockResolvedValue({ code: 'creator_portal', developerId: 17, status: 'pending_review' });
  await expect(service.updateApp('creator_portal', { name: 'Changed' }, 17)).rejects.toThrow(
    'Only draft or rejected apps can be edited',
  );
});

it('blocks uploads for archived apps', async () => {
  appRepo.findOne.mockResolvedValue({ code: 'creator_portal', developerId: 17, status: 'archived' });
  await expect(service.uploadVersion('creator_portal', file, 17)).rejects.toThrow(
    'Disabled or archived apps cannot upload versions',
  );
});
```

Also assert list, detail, allowed update, allowed upload, and resubmit delegate to owner-scoped platform methods.

- [ ] **Step 2: Run developer service tests to verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-developer.service.spec.ts
```

Expected: FAIL because the service and DTOs do not exist.

- [ ] **Step 3: Implement developer-safe DTOs**

`CreateDeveloperAppDto` contains `code`, `name`, `category`, `icon`, `summary`, and `description` with the same limits as the platform DTO. `UpdateDeveloperAppDto` contains the same mutable metadata except `code`. It must not accept type, visibility, entry URL, module bindings, developer id, status, sort, or remark.

- [ ] **Step 4: Implement ownership service**

Use this ownership query:

```ts
private async findOwnedApp(code: string, developerId: number) {
  const app = await this.appRepo.findOne({
    where: { code, developerId, deleteTime: IsNull() },
  });
  if (!app) throw new NotFoundException(`App ${code} not found`);
  return app;
}
```

Create fixed static marketplace apps, permit metadata update only in `draft` or `rejected`, reject upload for `disabled` or `archived`, and delegate package processing and audit logging to `AppPlatformService`.

- [ ] **Step 5: Run developer service tests to verify GREEN**

Run the developer service spec and expect all tests to pass.

- [ ] **Step 6: Implement developer controller**

Use `TenantContext.run({ tenantId: undefined, userId, ignoreTenant: true })` exactly like the platform controller. Derive the display name from authenticated data:

```ts
const developerName = String(
  user?.user?.nickname || user?.user?.nickName || user?.user?.username || `User ${user.userId}`,
);
```

Each route uses only its matching `app:developer:*` permission. The controller contains no review or publish route.

- [ ] **Step 7: Register controller and service**

Add `AppDeveloperController` to controllers, `AppDeveloperService` to providers, and optionally exports if later platform modules need it.

- [ ] **Step 8: Run backend tests and build**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-developer.service.spec.ts app-platform.service.spec.ts
pnpm.cmd run build
```

Expected: tests and build pass.

- [ ] **Step 9: Commit**

```powershell
git add server/src/module/app/dto/app-developer.dto.ts server/src/module/app/services/app-developer.service.ts server/src/module/app/services/app-developer.service.spec.ts server/src/module/app/app-developer.controller.ts server/src/module/app/app.module.ts
git commit -m "feat: add developer app submission api"
```

### Task 3: Developer Workspace Menu And Permissions

**Files:**

- Create: `server/src/migrations/1760000000035-SeedAppDeveloperMenus.ts`
- Create: `server/src/migration-specs/seed-app-developer-menus.spec.ts`

**Interfaces:**

- Visible menu code: `AppDeveloperApps`
- Parent: `AppCenter`
- Path: `developer`
- Component: `/app-center/developer`
- Six permissions listed in Task 2.
- Default grants: `admin` and `super_admin` only. Other creators are approved through existing role/menu assignment.

- [ ] **Step 1: Write failing migration spec**

Create:

```ts
it('seeds developer workspace permissions without granting every tenant member', async () => {
  const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  await new SeedAppDeveloperMenus1760000000035().up(queryRunner as any);
  const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
  const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

  expect(params).toContain('AppDeveloperApps');
  expect(params).toContain('/app-center/developer');
  expect(params).toEqual(expect.arrayContaining([
    'app:developer:list',
    'app:developer:read',
    'app:developer:create',
    'app:developer:update',
    'app:developer:upload',
    'app:developer:submit',
  ]));
  expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
  expect(sql).not.toContain("REGEXP '^tenant:[0-9]+:member$'");
});
```

- [ ] **Step 2: Run migration spec to verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- seed-app-developer-menus.spec.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement idempotent migration**

Insert the menu only when `AppDeveloperApps` is absent, insert each permission only when its slug is absent, and grant menu plus permissions to `admin` and `super_admin`. The down migration removes the role-menu links, six permission nodes, and menu node created by P6.

- [ ] **Step 4: Run migration spec and commit**

Run the migration spec and expect it to pass.

Commit:

```powershell
git add server/src/migrations/1760000000035-SeedAppDeveloperMenus.ts server/src/migration-specs/seed-app-developer-menus.spec.ts
git commit -m "feat: add developer app workspace menu"
```

### Task 4: Developer Submission Frontend

**Files:**

- Create: `web/src/api/app-developer.ts`
- Create: `web/src/views/app-center/developer/index.vue`
- Create: `web/scripts/verify-app-developer-readiness.ts`
- Modify: `web/package.json`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**

- API wrappers: `fetchDeveloperApps`, `fetchDeveloperApp`, `createDeveloperApp`, `updateDeveloperApp`, `uploadDeveloperAppVersion`, `submitDeveloperAppVersion`.
- Page supports list, create, edit in allowed states, version detail, zip upload, and rejected-version resubmission.
- Page never imports platform approval, rejection, publish, rollback, unpublish, or status wrappers.

- [ ] **Step 1: Write failing readiness script**

The script must verify:

```ts
const expectedFiles = [
  'web/src/api/app-developer.ts',
  'web/src/views/app-center/developer/index.vue',
  'server/src/module/app/app-developer.controller.ts',
  'server/src/module/app/services/app-developer.service.ts',
  'server/src/migrations/1760000000035-SeedAppDeveloperMenus.ts',
];
```

Require all developer route and wrapper tokens, `ElTable`, `ElDialog`, `ElDrawer`, `ElUpload`, ownership-safe menu permissions, and checklist entries. Explicitly fail if the developer page contains `approvePlatformAppVersion`, `publishPlatformAppVersion`, `rollbackPlatformAppVersion`, or `unpublishPlatformAppVersion`.

- [ ] **Step 2: Add package script and verify RED**

Add:

```json
"verify:app-developer-readiness": "tsx scripts/verify-app-developer-readiness.ts"
```

Run:

```powershell
cd web
pnpm.cmd run verify:app-developer-readiness
```

Expected: FAIL because API and page files do not exist.

- [ ] **Step 3: Implement developer API**

Reuse `AppPackageRecord`, `AppPackageDetailRecord`, and `AppPackageVersionRecord` types from `app-marketplace.ts`. Use only `/api/app-developer/apps` routes. Upload uses `FormData` with a `file` field.

- [ ] **Step 4: Implement developer page**

Page behavior:

- table columns: app, status, category, latest version, latest review message, updated, actions;
- create dialog: code, name, category, icon, summary, description;
- edit action enabled only for draft or rejected apps;
- version drawer loads owner-scoped detail and shows version, review status, publish status, review message, hash, size, and time;
- upload accepts one `.zip` file, does not auto-upload through Element Plus, and calls the developer API explicitly;
- resubmit appears only for rejected versions;
- loading, empty, request error, and action loading states are visible;
- responsive form grid collapses to one column below 760px.

- [ ] **Step 5: Update launch checklist**

Add commands and manual acceptance:

```md
pnpm.cmd run verify:app-developer-readiness
```

Manual checks must cover create, edit, upload, rejection reason, resubmit, foreign-app 404, and absence of review/publish actions.

- [ ] **Step 6: Run frontend checks and build**

Run:

```powershell
cd web
pnpm.cmd run verify:app-developer-readiness
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run build
```

Expected: all commands pass.

- [ ] **Step 7: Commit**

```powershell
git add web/src/api/app-developer.ts web/src/views/app-center/developer/index.vue web/scripts/verify-app-developer-readiness.ts web/package.json docs/saas-launch-readiness-checklist.md
git commit -m "feat: add developer app submission frontend"
```

### Task 5: P6 Security Review And Final Verification

**Files:**

- Review all files changed by Tasks 1-4.

- [ ] **Step 1: Review ownership and route surface**

Confirm every developer read and mutation reaches `findOwnedApp(code, userId)` or `listDeveloperApps(userId)`. Confirm there is no developer route for approve, reject, publish, rollback, unpublish, status, module binding, entry URL, visibility, or developer id.

- [ ] **Step 2: Run targeted backend verification**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-developer.service.spec.ts app-platform.service.spec.ts seed-app-developer-menus.spec.ts seed-app-review-center-menus.spec.ts
pnpm.cmd run build
```

Expected: all tests and build pass.

- [ ] **Step 3: Run frontend verification**

Run:

```powershell
cd web
pnpm.cmd run verify:app-developer-readiness
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run verify:app-factory-readiness
pnpm.cmd run build
```

Expected: all readiness checks and build pass.

- [ ] **Step 4: Run security and diff checks**

Run:

```powershell
rg -n "allow-same-origin|child_process|exec\(|spawn\(|eval\(" server/src/module/app web/src/views/app-center/developer web/src/views/app-center/open
rg -n "approvePlatformAppVersion|publishPlatformAppVersion|rollbackPlatformAppVersion|unpublishPlatformAppVersion" web/src/views/app-center/developer
git diff --check HEAD
git status --short --branch
```

Expected:

- the only `allow-same-origin` occurrence is the existing runner filter that removes it;
- no process execution or `eval` is introduced;
- no platform governance action appears in the developer page;
- no whitespace errors;
- worktree is clean after commits.

## Self-Review

- Spec coverage: P6 includes approved-creator access through existing RBAC, static app creation, owner-only metadata and versions, package upload, rejection visibility, resubmission, and platform-only governance.
- Scope: developer profiles, monetization, screenshots, support links, scoped runtime APIs, analytics, and executable plugins remain later roadmap work.
- Security: user id comes only from auth context, foreign resources return not found, DTOs omit privileged fields, and package processing stays in the existing static validator/storage flow.
- Type consistency: `/api/app-developer/apps`, `AppDeveloperService`, `AppDeveloperApps`, and all six `app:developer:*` permissions are consistent across backend, migration, API, page, and readiness script.
- Placeholder scan: every task has concrete files, commands, behavior, and expected results.
