# P4 App Version Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe platform operations to unpublish and rollback static app versions while keeping tenant runtime behavior consistent and audited.

**Architecture:** Reuse `app_package_version.publish_status`, `app_package.entry_url`, and `app_review_log` rather than adding new tables. `AppPlatformService` owns the version state transitions, the platform controller exposes two permission-protected routes, and the platform app drawer adds reason prompts plus active-version visibility.

**Tech Stack:** NestJS 11, TypeORM repositories, Jest, Vue 3, Element Plus, existing app marketplace API wrappers, existing readiness scripts.

## Global Constraints

- P4 must not execute uploaded backend code.
- Static and iframe runtime must remain sandboxed and must not add `allow-same-origin`.
- Tenant id must come from auth context, not request body.
- Existing P0-P3 app marketplace and module factory APIs must remain stable.
- No invoice functionality.
- Use `pnpm.cmd` commands in PowerShell.

---

## File Structure

Backend modify:

- `server/src/module/app/entities/app-review-log.entity.ts`: extend `AppReviewAction` with `unpublish` and `rollback`.
- `server/src/module/app/services/app-platform.service.ts`: add version governance methods, active-version response fields, and audit events.
- `server/src/module/app/services/app-platform.service.spec.ts`: add RED/GREEN tests for unpublish, rollback, and invalid rollback.
- `server/src/module/app/app-platform.controller.ts`: add `unpublish` and `rollback` routes.

Frontend modify:

- `web/src/api/app-marketplace.ts`: add API wrappers for version governance and active version fields.
- `web/src/views/app-platform/apps/index.vue`: add active-version display, rollback/unpublish buttons, and reason prompts.
- `web/scripts/verify-app-marketplace-readiness.ts`: assert governance API/page tokens.
- `docs/saas-launch-readiness-checklist.md`: add manual checks for rollback/unpublish.

---

### Task 1: Backend Version Governance Service

**Files:**

- Modify: `server/src/module/app/entities/app-review-log.entity.ts`
- Modify: `server/src/module/app/services/app-platform.service.ts`
- Test: `server/src/module/app/services/app-platform.service.spec.ts`

**Interfaces:**

- Produces `AppPlatformService.unpublishVersion(code: string, version: string, message?: string, operatorId?: number)`.
- Produces `AppPlatformService.rollbackVersion(code: string, version: string, message?: string, operatorId?: number)`.
- Adds version response fields:
  - `is_active: boolean`
  - `entry_url: string`

- [ ] **Step 1: Write failing tests**

Add tests to `app-platform.service.spec.ts`:

```ts
it('unpublishes the active static version and records an audit log', async () => {
  appRepo.findOne.mockResolvedValue({
    id: 4,
    code: 'job_board',
    name: 'Job Board',
    type: 'static',
    status: 'published',
    entryMode: 'static',
    entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
  });
  versionRepo.findOne.mockResolvedValue({
    id: 8,
    appId: 4,
    version: '1.0.0',
    reviewStatus: 'approved',
    publishStatus: 'published',
    publishPath: '/safe/public/job_board/1.0.0',
    entryFile: 'dist/index.html',
  });
  versionRepo.find.mockResolvedValue([]);
  versionRepo.save.mockImplementation(async (value) => value);

  await expect(service.unpublishVersion('job_board', '1.0.0', 'bad release', 66)).resolves.toMatchObject({
    version: '1.0.0',
    publish_status: 'unpublished_retired',
  });

  expect(versionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ publishStatus: 'unpublished_retired' }));
  expect(appRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved', entryUrl: '' }));
  expect(reviewLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({
    appId: 4,
    versionId: 8,
    action: 'unpublish',
    message: 'bad release',
    operatorId: 66,
  }));
});

it('rolls back to an approved publishable version and retires competing published versions', async () => {
  appRepo.findOne.mockResolvedValue({
    id: 4,
    code: 'job_board',
    name: 'Job Board',
    type: 'static',
    status: 'published',
    entryMode: 'static',
    entryUrl: '/apps-static/job_board/2.0.0/dist/index.html',
  });
  const rollbackTarget = {
    id: 8,
    appId: 4,
    version: '1.0.0',
    reviewStatus: 'approved',
    publishStatus: 'unpublished_retired',
    publishPath: '/safe/public/job_board/1.0.0',
    entryFile: 'dist/index.html',
  };
  const currentVersion = {
    id: 9,
    appId: 4,
    version: '2.0.0',
    reviewStatus: 'approved',
    publishStatus: 'published',
    publishPath: '/safe/public/job_board/2.0.0',
    entryFile: 'dist/index.html',
  };
  versionRepo.findOne.mockResolvedValue(rollbackTarget);
  versionRepo.find.mockResolvedValue([currentVersion]);
  versionRepo.save.mockImplementation(async (value) => value);

  await expect(service.rollbackVersion('job_board', '1.0.0', 'restore stable', 66)).resolves.toMatchObject({
    version: '1.0.0',
    publish_status: 'published',
    entry_url: '/apps-static/job_board/1.0.0/dist/index.html',
  });

  expect(versionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 9, publishStatus: 'unpublished_retired' }));
  expect(versionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 8, publishStatus: 'published' }));
  expect(appRepo.save).toHaveBeenCalledWith(expect.objectContaining({
    status: 'published',
    entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
  }));
  expect(reviewLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({
    appId: 4,
    versionId: 8,
    action: 'rollback',
    message: 'restore stable',
    operatorId: 66,
  }));
});

it('rejects rollback when the target version has no published path', async () => {
  appRepo.findOne.mockResolvedValue({ id: 4, code: 'job_board', type: 'static', status: 'published' });
  versionRepo.findOne.mockResolvedValue({
    id: 8,
    appId: 4,
    version: '1.0.0',
    reviewStatus: 'approved',
    publishStatus: 'unpublished',
    publishPath: '',
    entryFile: 'dist/index.html',
  });

  await expect(service.rollbackVersion('job_board', '1.0.0', '', 66)).rejects.toThrow('App version has no published artifact');
  expect(appRepo.save).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-platform.service.spec.ts
```

Expected: fail because the service methods and review actions do not exist.

- [ ] **Step 3: Implement governance service methods**

Add `unpublish` and `rollback` to `AppReviewAction`.

In `AppPlatformService`:

- add `createStaticEntryUrl(code, version, entryFile)`.
- add `findPublishedVersions(appId)`.
- add `retirePublishedVersions(appId, exceptVersionId?)`.
- `unpublishVersion()`:
  - app must be `static`.
  - target version must have `publishStatus === 'published'`.
  - set target `publishStatus = 'unpublished_retired'`.
  - if app `entryUrl` matches the target entry URL, choose the newest other published version; otherwise set `entryUrl = ''` and `status = 'approved'`.
  - record action `unpublish`.
- `rollbackVersion()`:
  - app must be `static`.
  - target version must be approved.
  - target must have `publishPath` and `entryFile`.
  - retire other published versions.
  - set target `publishStatus = 'published'`.
  - set app `status = 'published'`, `entryMode = 'static'`, and `entryUrl` to the target URL.
  - record action `rollback`.
- version responses include `entry_url` and `is_active`.

- [ ] **Step 4: Run backend service tests**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-platform.service.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app/entities/app-review-log.entity.ts server/src/module/app/services/app-platform.service.ts server/src/module/app/services/app-platform.service.spec.ts
git commit -m "feat: add app version governance service"
```

### Task 2: Backend Governance API

**Files:**

- Modify: `server/src/module/app/app-platform.controller.ts`
- Test: `server/src/module/app/services/app-platform.service.spec.ts`

**Interfaces:**

- Produces routes:
  - `POST /api/app-platform/apps/:code/versions/:version/unpublish`
  - `POST /api/app-platform/apps/:code/versions/:version/rollback`
- Reuses permission `app:platform:publish`.
- Consumes `ReviewAppPackageVersionDto.message`.

- [ ] **Step 1: Add controller routes**

Add two controller methods using `runOutsideTenant()` and `user?.userId`:

```ts
@Post(':code/versions/:version/unpublish')
@ApiOperation({ summary: 'Unpublish app version' })
@RequirePermission('app:platform:publish')
unpublishVersion(@Param('code') code: string, @Param('version') version: string, @Body() body: ReviewAppPackageVersionDto, @User() user: UserDto) {
  return this.runOutsideTenant(user, () =>
    this.appPlatformService.unpublishVersion(code, version, body.message || '', user?.userId).then((data) => ResultData.ok(data)),
  );
}

@Post(':code/versions/:version/rollback')
@ApiOperation({ summary: 'Rollback app version' })
@RequirePermission('app:platform:publish')
rollbackVersion(@Param('code') code: string, @Param('version') version: string, @Body() body: ReviewAppPackageVersionDto, @User() user: UserDto) {
  return this.runOutsideTenant(user, () =>
    this.appPlatformService.rollbackVersion(code, version, body.message || '', user?.userId).then((data) => ResultData.ok(data)),
  );
}
```

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 3: Commit**

```powershell
git add server/src/module/app/app-platform.controller.ts
git commit -m "feat: expose app version governance api"
```

### Task 3: Frontend Version Governance UI

**Files:**

- Modify: `web/src/api/app-marketplace.ts`
- Modify: `web/src/views/app-platform/apps/index.vue`
- Modify: `web/scripts/verify-app-marketplace-readiness.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**

- Produces API wrappers:
  - `unpublishPlatformAppVersion(code: string, version: string, message?: string)`
  - `rollbackPlatformAppVersion(code: string, version: string, message?: string)`
- Consumes version fields `is_active` and `entry_url`.

- [ ] **Step 1: Write failing readiness checks**

Update `verify-app-marketplace-readiness.ts` to require:

```ts
'unpublishPlatformAppVersion'
'rollbackPlatformAppVersion'
'/api/app-platform/apps/${code}/versions/${version}/unpublish'
'/api/app-platform/apps/${code}/versions/${version}/rollback'
'is_active'
'entry_url'
'Rollback'
'Unpublish'
'versionGovernance'
```

- [ ] **Step 2: Run readiness to verify RED**

Run:

```powershell
cd web
pnpm.cmd run verify:app-marketplace-readiness
```

Expected: fail because the wrappers and page controls do not exist.

- [ ] **Step 3: Implement API wrappers and types**

In `AppPackageVersionRecord`, add:

```ts
entry_url?: string
is_active?: boolean
```

Add the two request wrappers above with `data: { message }`.

- [ ] **Step 4: Implement version drawer actions**

In `apps/index.vue`:

- import the two wrappers.
- add `versionGovernanceLoading = ref('')`.
- show an `Active` tag when `row.is_active`.
- show `row.review_message || '-'` and `row.entry_url || '-'`.
- add `Rollback` button for approved versions with `publish_path`.
- add `Unpublish` button for `row.publish_status === 'published'`.
- prompt for a reason with `ElMessageBox.prompt`.
- after action, refresh selected detail and app list.

- [ ] **Step 5: Update checklist**

Add manual checks:

```md
- Confirm a platform admin can unpublish a published static app version and the app no longer opens that retired version.
- Confirm a platform admin can rollback to an earlier approved static version and the app runner opens the restored entry URL.
```

- [ ] **Step 6: Run frontend verification**

Run:

```powershell
cd web
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add web/src/api/app-marketplace.ts web/src/views/app-platform/apps/index.vue web/scripts/verify-app-marketplace-readiness.ts docs/saas-launch-readiness-checklist.md
git commit -m "feat: add app version governance frontend"
```

### Task 4: Final P4 Review

**Files:**

- All files changed by Tasks 1-3.

**Interfaces:**

- Verifies version governance against `docs/superpowers/specs/2026-07-10-extensible-saas-app-platform-roadmap.md`.

- [ ] **Step 1: Run targeted backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-platform.service.spec.ts app-tenant.service.spec.ts app-package-storage.service.spec.ts
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
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run verify:app-factory-readiness
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 4: Review safety invariants**

Run:

```powershell
rg -n "allow-same-origin|child_process|exec\\(|spawn\\(|eval\\(" server/src/module/app web/src/views/app-platform/apps web/src/views/app-center/open
git diff --check HEAD
git status --short --branch
```

Expected:

- no new `allow-same-origin`
- no backend process execution in `server/src/module/app`
- no whitespace errors
- clean working tree after commits

## Self-Review

- Spec coverage: P4 implements the roadmap's version governance requirement: unpublish, rollback, audit, active version visibility, and tenant-safe runtime state.
- Placeholder scan: The plan has exact files, method names, routes, expected tests, commands, and commit points.
- Type consistency: `unpublishVersion`, `rollbackVersion`, `unpublishPlatformAppVersion`, `rollbackPlatformAppVersion`, `is_active`, and `entry_url` are consistent across backend and frontend tasks.

