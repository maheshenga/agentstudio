# P7 Platform Resource Pack CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let platform admins create, edit, and enable/disable SaaS resource packs from the existing platform resource-pack management page.

**Architecture:** Extend the existing `SaasResourcePackService` from list-only to platform CRUD. Expose the operations through `SaasPlatformController`, add typed frontend API helpers, and upgrade the existing Vue resource-pack page with a compact dialog and row actions matching the platform module page pattern.

**Tech Stack:** NestJS, TypeORM repository pattern, Jest, Vue 3 script setup, Element Plus, pnpm/tsx readiness verifiers.

## Global Constraints

- Do not change tenant purchase or payment behavior in this phase.
- Do not introduce new dependencies.
- Do not add invoice functionality.
- Do not push to remote; commit locally only after verification.
- Use `pnpm.cmd` commands on Windows PowerShell.
- Preserve existing SaaS readiness gates and extend them only where they cover this feature.

---

### Task 1: Add Backend Resource Pack CRUD Tests

**Files:**
- Modify: `server/src/module/saas/services/saas-resource-pack.service.spec.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`

**Interfaces:**
- Consumes: current `SaasResourcePackService` and `SaasPlatformController`.
- Produces: failing tests for create/update/status controller and service behavior.

- [ ] **Step 1: Extend service repository mock**

In `server/src/module/saas/services/saas-resource-pack.service.spec.ts`, add mock methods:

```ts
findOne: jest.fn(),
create: jest.fn((input) => input),
save: jest.fn(),
```

- [ ] **Step 2: Add service create test**

Add a test that calls:

```ts
await service.createPlatformResourcePack({
  code: 'voice_minutes_1k',
  name: 'Voice Minutes 1K',
  resource_type: 'voice_minutes',
  quota_amount: 1000,
  price_cents: 4900,
  currency: 'CNY',
  status: 1,
  sort: 50,
  remark: 'Adds voice minutes',
})
```

Expected behavior:

```ts
expect(resourcePackRepo.findOne).toHaveBeenCalledWith({ where: { code: 'voice_minutes_1k' }, withDeleted: true })
expect(resourcePackRepo.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'voice_minutes_1k', resourceType: 'voice_minutes' }))
expect(resourcePackRepo.save).toHaveBeenCalled()
```

- [ ] **Step 3: Add service update test**

Add a test that stubs an existing pack and calls:

```ts
await service.updatePlatformResourcePack('tokens_1m', { name: 'Tokens 2M', quota_amount: 2000000 })
```

Expected behavior: saves the existing entity with updated `name` and `quotaAmount` and returns snake_case response.

- [ ] **Step 4: Add service status test**

Add a test that calls:

```ts
await service.updatePlatformResourcePackStatus('tokens_1m', 0)
```

Expected behavior: saves `status = 0` and returns response with `status: 0`.

- [ ] **Step 5: Add controller provider and controller tests**

In `server/src/module/saas/saas-platform.controller.spec.ts`, import `SaasResourcePackService`, provide a mock, and add tests for:

```ts
controller.createResourcePack(body, { userId: 1 } as any)
controller.updateResourcePack('tokens_1m', body, { userId: 1 } as any)
controller.updateResourcePackStatus('tokens_1m', { status: 0 } as any, { userId: 1 } as any)
```

Expected: each delegates to `resourcePackService` and returns `ResultData.ok(...).data`.

- [ ] **Step 6: Run tests to confirm RED**

Run:

```powershell
cd server
pnpm.cmd test -- saas-resource-pack.service.spec.ts saas-platform.controller.spec.ts --runInBand --forceExit
```

Expected: FAIL because the service and controller methods do not exist yet.

---

### Task 2: Implement Backend Resource Pack CRUD

**Files:**
- Create: `server/src/module/saas/dto/save-saas-resource-pack.dto.ts`
- Create: `server/src/module/saas/dto/save-saas-resource-pack.dto.spec.ts`
- Modify: `server/src/module/saas/services/saas-resource-pack.service.ts`
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Create: `server/src/migrations/1760000000026-AlignSaasResourcePackCrudPermissions.ts`
- Create: `server/src/migration-specs/align-saas-resource-pack-crud-permissions.spec.ts`
- Modify: `server/package.json`
- Modify: `server/scripts/verify-saas-readiness-command.ts`

**Interfaces:**
- Produces service methods:
  - `createPlatformResourcePack(dto: SaveSaasResourcePackDto)`
  - `updatePlatformResourcePack(code: string, dto: SaveSaasResourcePackDto)`
  - `updatePlatformResourcePackStatus(code: string, status: number)`

- [ ] **Step 1: Create DTO**

Create `server/src/module/saas/dto/save-saas-resource-pack.dto.ts`:

```ts
import { PartialType } from '@nestjs/swagger'
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator'

const RESOURCE_PACK_TYPES = ['users', 'storage_mb', 'ai_calls', 'rag_documents', 'tokens'] as const

export class SaveSaasResourcePackDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_-]+$/)
  @MaxLength(50)
  code?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string

  @IsString()
  @IsIn(RESOURCE_PACK_TYPES)
  resource_type: string

  @IsInt()
  @Min(1)
  quota_amount: number

  @IsInt()
  @Min(0)
  price_cents: number

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string

  @IsOptional()
  @IsInt()
  status?: number

  @IsOptional()
  @IsInt()
  sort?: number

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string
}

export class UpdateSaasResourcePackDto extends PartialType(SaveSaasResourcePackDto) {}

export class UpdateSaasResourcePackStatusDto {
  @IsInt()
  status: number
}
```

- [ ] **Step 2: Add DTO validation test**

Create `server/src/module/saas/dto/save-saas-resource-pack.dto.spec.ts` to verify blank names, invalid codes/types/amounts/statuses, and a valid payload.

- [ ] **Step 3: Implement service methods**

In `SaasResourcePackService`, import `BadRequestException`, `NotFoundException`, `IsNull`, and the DTO types. Implement:

```ts
async createPlatformResourcePack(dto: SaveSaasResourcePackDto) { ... }
async updatePlatformResourcePack(code: string, dto: UpdateSaasResourcePackDto) { ... }
async updatePlatformResourcePackStatus(code: string, status: number) { ... }
private async findActiveResourcePack(code: string) { ... }
private assertResourcePackCode(code: string) { ... }
```

Rules:
- Create requires a nonblank `code` matching `/^[a-z0-9_-]+$/`.
- Duplicate code, including soft-deleted rows, throws `BadRequestException`.
- Update/status only target rows with `deleteTime: IsNull()`.
- Response remains the existing snake_case shape.

- [ ] **Step 4: Expose controller routes**

In `SaasPlatformController`, inject `SaasResourcePackService` and add routes:

```ts
@Post('resource-packs')
@RequirePermission('saas:resource-pack:save')
createResourcePack(...)

@Put('resource-packs/:code')
@RequirePermission('saas:resource-pack:update')
updateResourcePack(...)

@Put('resource-packs/:code/status')
@RequirePermission('saas:resource-pack:status')
updateResourcePackStatus(...)
```

- [ ] **Step 5: Run tests to confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd test -- save-saas-resource-pack.dto.spec.ts saas-resource-pack.service.spec.ts saas-platform.controller.spec.ts --runInBand --forceExit
```

Expected: PASS.

- [ ] **Step 6: Add upgrade migration for new operation permissions**

Add a latest alignment migration for the controller permissions so existing databases that already ran older migrations still receive the new operations:

```ts
'saas:resource-pack:save'
'saas:resource-pack:update'
'saas:resource-pack:status'
```

The migration should insert permission rows under `SaasResourcePack`, grant them to `admin`/`super_admin`, and grant them to roles that already have `SaasResourcePack` or `saas:resource-pack:index`. The down migration should remove role grants and these permission rows.

- [ ] **Step 7: Run migration specs**

Run:

```powershell
cd server
pnpm.cmd test -- align-saas-resource-pack-crud-permissions.spec.ts --runInBand --forceExit
```

Expected: PASS.

- [ ] **Step 8: Add backend readiness coverage**

Add the resource-pack service, DTO, and migration specs to `server/package.json` `verify:saas-readiness`, update `server/scripts/verify-saas-readiness-command.ts`, and mirror the expanded command in `docs/saas-launch-readiness-checklist.md`.

---

### Task 3: Add Frontend API and Resource Pack Page CRUD

**Files:**
- Modify: `web/src/api/saas.ts`
- Modify: `web/src/views/saas/platform/resource-pack/index.vue`

**Interfaces:**
- Produces frontend API helpers:
  - `createPlatformResourcePack(params)`
  - `updatePlatformResourcePack(code, params)`
  - `updatePlatformResourcePackStatus(code, status)`

- [ ] **Step 1: Extend API types and helpers**

In `web/src/api/saas.ts`, add:

```ts
export interface SaveSaasResourcePackParams {
  code?: string
  name: string
  resource_type: string
  quota_amount: number
  price_cents: number
  currency?: string
  status?: number
  sort?: number
  remark?: string
}
```

Add helpers using `/api/saas/platform/resource-packs`.

- [ ] **Step 2: Upgrade page header and actions**

In `web/src/views/saas/platform/resource-pack/index.vue`:
- Add a primary `新建资源包` button.
- Add an `操作` table column with `编辑` and `启用/停用` link buttons.
- Keep existing filters, empty state, loading, and error block.

- [ ] **Step 3: Add dialog form**

Add an `ElDialog` with fields:
- code, disabled while editing
- name
- resource_type select
- quota_amount input number
- price_cents input number
- currency
- status switch
- sort input number
- remark textarea

- [ ] **Step 4: Add save/toggle handlers**

Implement `openCreateDialog`, `openEditDialog`, `saveResourcePack`, `toggleStatus`, and `buildPayload` using the same shape as `platform/module/index.vue`.

---

### Task 4: Add Static Frontend Readiness Coverage

**Files:**
- Create: `web/scripts/verify-saas-resource-pack-crud.ts`
- Modify: `web/scripts/run-saas-readiness.ts`
- Modify: `web/scripts/verify-saas-readiness-command.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Produces a lightweight verifier that ensures the resource-pack page contains CRUD APIs, dialog controls, and row actions.

- [ ] **Step 1: Create verifier**

Create `web/scripts/verify-saas-resource-pack-crud.ts` checking:
- `web/src/api/saas.ts` includes the three helper functions.
- resource-pack page imports the helper functions.
- page includes `openCreateDialog`, `openEditDialog`, `saveResourcePack`, `toggleStatus`.
- page includes labels `新建资源包`, `编辑`, `启用`, `停用`, `保存`.

- [ ] **Step 2: Add verifier to frontend runner**

Add `verify-saas-resource-pack-crud.ts` to `web/scripts/run-saas-readiness.ts` and `web/scripts/verify-saas-readiness-command.ts` expected list.

- [ ] **Step 3: Update checklist**

Add the expanded command:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-resource-pack-crud.ts
```

- [ ] **Step 4: Run frontend static verifier**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-resource-pack-crud.ts
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: PASS.

---

### Task 5: Full Verification and Commit

**Files:**
- No additional edits expected.

- [ ] **Step 1: Run focused backend tests**

```powershell
cd server
pnpm.cmd test -- save-saas-resource-pack.dto.spec.ts saas-resource-pack.service.spec.ts saas-platform.controller.spec.ts align-saas-resource-pack-crud-permissions.spec.ts --runInBand --forceExit
```

- [ ] **Step 2: Run backend SaaS readiness**

```powershell
cd server
pnpm.cmd run verify:saas-readiness
```

- [ ] **Step 3: Run frontend build and root readiness**

```powershell
cd web
pnpm.cmd build
cd ..
node scripts/run-saas-readiness.cjs
```

- [ ] **Step 4: Review diff and whitespace**

```powershell
git diff --check
git diff --cached --check
git diff --stat
```

- [ ] **Step 5: Commit**

```powershell
git add docs/superpowers/plans/2026-07-08-p7-platform-resource-pack-crud.md docs/saas-launch-readiness-checklist.md server/package.json server/scripts/verify-saas-readiness-command.ts server/src/migrations/1760000000026-AlignSaasResourcePackCrudPermissions.ts server/src/migration-specs/align-saas-resource-pack-crud-permissions.spec.ts server/src/module/saas/dto/save-saas-resource-pack.dto.ts server/src/module/saas/dto/save-saas-resource-pack.dto.spec.ts server/src/module/saas/services/saas-resource-pack.service.ts server/src/module/saas/services/saas-resource-pack.service.spec.ts server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-platform.controller.spec.ts web/src/api/saas.ts web/src/views/saas/platform/resource-pack/index.vue web/scripts/verify-saas-resource-pack-crud.ts web/scripts/run-saas-readiness.ts web/scripts/verify-saas-readiness-command.ts
git commit -m "feat: add platform resource pack management"
```

---

## Self-Review

- Spec coverage: The plan covers backend service CRUD, DTO validation, controller routes, permission seeds for route consistency, frontend API, UI dialog/actions, static readiness coverage, focused tests, aggregate readiness, build, diff review, and local commit.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: Resource pack DTO and frontend payload use snake_case API fields matching existing response shape.
