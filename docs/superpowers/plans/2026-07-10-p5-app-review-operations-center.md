# P5 App Review Operations Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated platform review center so reviewers can process app versions without opening every app's version drawer one by one.

**Architecture:** Reuse existing `app_package`, `app_package_version`, and version action APIs. `AppPlatformService` will expose a read-only review queue by joining versions to apps in service code; the frontend review page will call this queue and reuse existing approve/reject/publish/rollback/unpublish wrappers for actions.

**Tech Stack:** NestJS 11, TypeORM repositories, Jest, Vue 3, Element Plus, existing app marketplace API wrappers, existing readiness scripts.

## Global Constraints

- P5 must not execute uploaded backend code.
- Static and iframe runtime must remain sandboxed and must not add `allow-same-origin`.
- Tenant id must come from auth context, not request body.
- Existing P0-P4 app marketplace and module factory APIs must remain stable.
- No invoice functionality.
- Use `pnpm.cmd` commands in PowerShell.

---

## File Structure

Backend modify:

- `server/src/module/app/services/app-platform.service.ts`: add `listReviewQueue(query)`.
- `server/src/module/app/services/app-platform.service.spec.ts`: add queue tests.
- `server/src/module/app/dto/app-platform.dto.ts`: add `AppReviewQueueQueryDto`.
- `server/src/module/app/app-platform-review.controller.ts`: add `GET /api/app-platform/reviews`.
- `server/src/module/app/app.module.ts`: register the review controller.

Backend create:

- `server/src/migrations/1760000000034-SeedAppReviewCenterMenus.ts`: add visible `/app-platform/reviews` menu.
- `server/src/migration-specs/seed-app-review-center-menus.spec.ts`: verify menu migration.

Frontend modify:

- `web/src/api/app-marketplace.ts`: add review queue types and `fetchPlatformAppReviews()`.
- `web/scripts/verify-app-marketplace-readiness.ts`: add review center readiness checks.
- `docs/saas-launch-readiness-checklist.md`: add review center manual checks.

Frontend create:

- `web/src/views/app-platform/reviews/index.vue`: review operations page.

---

### Task 1: Backend Review Queue

**Files:**

- Modify: `server/src/module/app/services/app-platform.service.ts`
- Modify: `server/src/module/app/dto/app-platform.dto.ts`
- Create: `server/src/module/app/app-platform-review.controller.ts`
- Modify: `server/src/module/app/app.module.ts`
- Test: `server/src/module/app/services/app-platform.service.spec.ts`

**Interfaces:**

- Produces `AppPlatformService.listReviewQueue(query: AppReviewQueueQuery)`.
- Produces route `GET /api/app-platform/reviews`.
- Reuses permission `app:platform:review`.
- Query fields:
  - `keyword?: string`
  - `type?: AppPackageType`
  - `review_status?: AppVersionReviewStatus`
  - `publish_status?: AppVersionPublishStatus`
- Response fields include:
  - `app_code`, `app_name`, `app_type`, `app_status`, `category`, `developer_name`
  - all version response fields from `toVersionResponse()`

- [ ] **Step 1: Write failing service test**

Add to `app-platform.service.spec.ts`:

```ts
it('lists review queue records with app and version context', async () => {
  versionRepo.find.mockResolvedValue([
    {
      id: 8,
      appId: 4,
      version: '1.0.0',
      reviewStatus: 'pending',
      publishStatus: 'unpublished',
      entryFile: 'dist/index.html',
      reviewMessage: '',
    },
  ]);
  appRepo.find.mockResolvedValue([
    {
      id: 4,
      code: 'job_board',
      name: 'Job Board',
      type: 'static',
      status: 'pending_review',
      category: 'Industry',
      developerName: 'Module Factory',
      entryUrl: '',
    },
  ]);

  await expect(service.listReviewQueue({ review_status: 'pending' })).resolves.toEqual([
    expect.objectContaining({
      app_code: 'job_board',
      app_name: 'Job Board',
      app_type: 'static',
      review_status: 'pending',
      publish_status: 'unpublished',
      entry_url: '/apps-static/job_board/1.0.0/dist/index.html',
    }),
  ]);
});

it('filters review queue records by keyword and app type', async () => {
  versionRepo.find.mockResolvedValue([
    { id: 8, appId: 4, version: '1.0.0', reviewStatus: 'pending', publishStatus: 'unpublished', entryFile: 'dist/index.html' },
    { id: 9, appId: 5, version: '1.0.0', reviewStatus: 'approved', publishStatus: 'published', entryFile: 'dist/index.html' },
  ]);
  appRepo.find.mockResolvedValue([
    { id: 4, code: 'job_board', name: 'Job Board', type: 'static', status: 'pending_review', entryUrl: '' },
    { id: 5, code: 'crm_iframe', name: 'CRM', type: 'iframe', status: 'published', entryUrl: 'https://crm.example.com' },
  ]);

  await expect(service.listReviewQueue({ keyword: 'job', type: 'static' })).resolves.toHaveLength(1);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-platform.service.spec.ts
```

Expected: fail because `listReviewQueue()` does not exist.

- [ ] **Step 3: Implement queue and controller route**

In `AppPlatformService`:

- import version status types from `app-package-version.entity`.
- import `In` from `typeorm`.
- fetch versions ordered by newest id.
- fetch matching apps with `In(appIds)`.
- filter by query in service code.
- map each record to app fields plus `toVersionResponse(version, app.code, app.entryUrl)`.

Create `AppPlatformReviewController` with:

```ts
@ApiTags('App Platform')
@ApiBearerAuth('Authorization')
@Controller('api/app-platform/reviews')
export class AppPlatformReviewController {
  constructor(private readonly appPlatformService: AppPlatformService) {}

  @Get()
  @ApiOperation({ summary: 'List app review queue' })
  @RequirePermission('app:platform:review')
  listReviews(@Query() query: AppReviewQueueQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.appPlatformService.listReviewQueue(query).then((data) => ResultData.ok(data)));
  }
}
```

Use the same `TenantContext.run({ ignoreTenant: true })` pattern as `AppPlatformController`.

- [ ] **Step 4: Run backend tests and build**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-platform.service.spec.ts
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app/services/app-platform.service.ts server/src/module/app/services/app-platform.service.spec.ts server/src/module/app/app-platform-review.controller.ts server/src/module/app/app.module.ts server/src/module/app/dto/app-platform.dto.ts
git commit -m "feat: add app review queue api"
```

### Task 2: Review Center Menu

**Files:**

- Create: `server/src/migrations/1760000000034-SeedAppReviewCenterMenus.ts`
- Create: `server/src/migration-specs/seed-app-review-center-menus.spec.ts`

**Interfaces:**

- Produces visible menu:
  - code `AppReviewCenter`
  - path `/app-platform/reviews`
  - component `/app-platform/reviews`
  - permission reuse `app:platform:review`

- [ ] **Step 1: Write failing migration spec**

Create `seed-app-review-center-menus.spec.ts`:

```ts
import { SeedAppReviewCenterMenus1760000000034 } from '../migrations/1760000000034-SeedAppReviewCenterMenus';

describe('SeedAppReviewCenterMenus1760000000034', () => {
  it('seeds app review center menu for platform admins', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedAppReviewCenterMenus1760000000034().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(params).toContain('AppReviewCenter');
    expect(params).toContain('/app-platform/reviews');
    expect(params).toContain('/app-platform/reviews');
    expect(params).toContain('app:platform:review');
    expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
  });
});
```

- [ ] **Step 2: Run spec to verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- seed-app-review-center-menus.spec.ts
```

Expected: fail because the migration does not exist.

- [ ] **Step 3: Implement menu migration**

Migration behavior:

- insert child menu under `AppPlatform`.
- insert permission node under `AppReviewCenter` for `app:platform:review` only if missing.
- grant `AppReviewCenter` and `app:platform:review` to roles `admin` and `super_admin`.
- down migration removes `AppReviewCenter` role bindings/menu but must not remove `app:platform:review` globally if it already belongs to `AppPlatformApps`.

- [ ] **Step 4: Run migration spec**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- seed-app-review-center-menus.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/migrations/1760000000034-SeedAppReviewCenterMenus.ts server/src/migration-specs/seed-app-review-center-menus.spec.ts
git commit -m "feat: add app review center menu"
```

### Task 3: Frontend Review Center

**Files:**

- Modify: `web/src/api/app-marketplace.ts`
- Create: `web/src/views/app-platform/reviews/index.vue`
- Modify: `web/scripts/verify-app-marketplace-readiness.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**

- Produces `fetchPlatformAppReviews(params)`.
- Consumes existing action wrappers:
  - `approvePlatformAppVersion`
  - `rejectPlatformAppVersion`
  - `publishPlatformAppVersion`
  - `rollbackPlatformAppVersion`
  - `unpublishPlatformAppVersion`

- [ ] **Step 1: Write failing readiness checks**

Update `verify-app-marketplace-readiness.ts`:

- add expected file `web/src/views/app-platform/reviews/index.vue`.
- require API token `/api/app-platform/reviews`.
- require API wrapper `fetchPlatformAppReviews`.
- require page tokens `Review Center`, `fetchPlatformAppReviews`, `approvePlatformAppVersion`, `rollbackPlatformAppVersion`, `unpublishPlatformAppVersion`, `ElTable`, `ElMessageBox`.
- require menu migration token `AppReviewCenter`.

- [ ] **Step 2: Run readiness to verify RED**

Run:

```powershell
cd web
pnpm.cmd run verify:app-marketplace-readiness
```

Expected: fail because API wrapper/page/menu do not exist.

- [ ] **Step 3: Implement API wrapper**

Add:

```ts
export interface AppReviewQueueParams {
  keyword?: string
  type?: AppPackageType | ''
  review_status?: AppPackageVersionRecord['review_status'] | ''
  publish_status?: AppPackageVersionRecord['publish_status'] | ''
}

export interface AppReviewQueueRecord extends AppPackageVersionRecord {
  app_code: string
  app_name: string
  app_type: AppPackageType
  app_status: AppPackageStatus
  category?: string
  developer_name?: string
}

export function fetchPlatformAppReviews(params: AppReviewQueueParams = {}) {
  return request.get<AppReviewQueueRecord[]>({ url: '/api/app-platform/reviews', params })
}
```

- [ ] **Step 4: Implement review page**

Page behavior:

- filters: keyword, type, review status, publish status.
- table columns: app, version, review, publish, active, developer, entry, updated.
- actions:
  - Approve pending version with prompt.
  - Reject pending version with prompt.
  - Publish approved unpublished version.
  - Rollback approved version with publish path and not active.
  - Unpublish published version.
- after action reload queue.

- [ ] **Step 5: Update checklist**

Add manual check:

```md
13. Open `/#/app-platform/reviews` and confirm reviewers can filter pending versions and perform approve/reject/publish/rollback/unpublish actions from one queue.
```

- [ ] **Step 6: Run frontend checks**

Run:

```powershell
cd web
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 7: Commit**

```powershell
git add web/src/api/app-marketplace.ts web/src/views/app-platform/reviews/index.vue web/scripts/verify-app-marketplace-readiness.ts docs/saas-launch-readiness-checklist.md
git commit -m "feat: add app review center frontend"
```

### Task 4: Final P5 Review

**Files:**

- All files changed by Tasks 1-3.

**Interfaces:**

- Verifies P5 against `docs/superpowers/specs/2026-07-10-extensible-saas-app-platform-roadmap.md`.

- [ ] **Step 1: Run targeted backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-platform.service.spec.ts seed-app-review-center-menus.spec.ts
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
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 4: Review safety invariants**

Run:

```powershell
rg -n "allow-same-origin|child_process|exec\\(|spawn\\(|eval\\(" server/src/module/app web/src/views/app-platform/reviews web/src/views/app-center/open
git diff --check HEAD
git status --short --branch
```

Expected:

- no new `allow-same-origin`
- no backend process execution in `server/src/module/app`
- no whitespace errors
- clean working tree after commits

## Self-Review

- Spec coverage: P5 implements the roadmap's review operations center with queue API, menu, frontend actions, readiness, and manual checklist.
- Placeholder scan: The plan has exact files, method names, routes, expected tests, commands, and commit points.
- Type consistency: `listReviewQueue`, `fetchPlatformAppReviews`, `/api/app-platform/reviews`, and `AppReviewCenter` are consistent across tasks.
