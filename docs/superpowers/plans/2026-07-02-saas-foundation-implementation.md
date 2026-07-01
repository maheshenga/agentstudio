# SaaS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 1 of the SaaS transformation: self-service tenant signup, default tenant roles, free plan plus trial, basic subscription/quota records, and platform/tenant view foundations.

**Architecture:** Add a focused `saas` backend module beside existing `system` modules and reuse the current RBAC, tenant context, and dynamic menu system. Phase 1 stores SaaS plan, subscription, trial, and quota state but does not process real payments.

**Tech Stack:** NestJS 11, TypeORM, MySQL, Redis, Vue 3, Vite, Pinia, Element Plus, existing RBAC/menu infrastructure.

## Global Constraints

- Do not replace the existing RBAC system; extend `sa_system_menu`, `sa_system_role`, and role assignments.
- Do not implement real Alipay payment in Phase 1.
- Keep one frontend entry and one backend application.
- New tenant-facing APIs must require tenant context.
- New platform APIs must explicitly avoid accidental tenant filtering.
- Existing `admin / 123456` local login must keep working.
- Use TDD for backend service behavior.
- Preserve unrelated dirty worktree changes.

---

## File Structure

Backend files to create:

- `server/src/module/saas/saas.module.ts`: SaaS module registration.
- `server/src/module/saas/entities/saas-plan.entity.ts`: plan entity.
- `server/src/module/saas/entities/saas-plan-feature.entity.ts`: plan feature switch entity.
- `server/src/module/saas/entities/saas-plan-quota.entity.ts`: plan quota entity.
- `server/src/module/saas/entities/saas-subscription.entity.ts`: tenant subscription entity.
- `server/src/module/saas/entities/saas-trial.entity.ts`: trial entitlement entity.
- `server/src/module/saas/entities/saas-tenant-resource.entity.ts`: tenant quota summary entity.
- `server/src/module/saas/constants.ts`: plan codes, quota keys, statuses.
- `server/src/module/saas/dto/signup.dto.ts`: SaaS signup request DTO.
- `server/src/module/saas/dto/tenant-provision.dto.ts`: platform tenant provisioning DTO.
- `server/src/module/saas/services/saas-plan.service.ts`: plan lookup and seed helpers.
- `server/src/module/saas/services/saas-provisioning.service.ts`: tenant signup/provisioning orchestration.
- `server/src/module/saas/services/saas-quota.service.ts`: quota initialization and summary.
- `server/src/module/saas/saas-public.controller.ts`: public signup APIs.
- `server/src/module/saas/saas-platform.controller.ts`: platform SaaS management APIs.
- `server/src/module/saas/saas-tenant.controller.ts`: tenant SaaS APIs.
- `server/src/module/saas/services/saas-provisioning.service.spec.ts`: provisioning tests.
- `server/src/module/saas/services/saas-quota.service.spec.ts`: quota tests.

Backend files to modify:

- `server/src/app.module.ts`: import `SaasModule`.
- `server/src/module/main/main.service.ts`: optionally delegate register flow to SaaS signup in Phase 1.
- `server/src/module/main/main.controller.ts`: keep existing login and tenant lookup; do not break compatibility.
- `server/src/module/system/user/user.service.ts`: expose safe helpers for user creation and tenant membership if needed.

Frontend files to create:

- `web/src/api/saas.ts`: SaaS public, platform, and tenant API wrappers.
- `web/src/views/saas/signup/index.vue`: real SaaS registration page.
- `web/src/views/saas/tenant/plan/index.vue`: tenant plan overview.
- `web/src/views/saas/tenant/usage/index.vue`: tenant usage center.
- `web/src/views/saas/platform/dashboard/index.vue`: platform SaaS dashboard shell.
- `web/src/views/saas/platform/plans/index.vue`: platform plan list shell.
- `web/src/views/saas/platform/tenants/index.vue`: platform tenant list shell.

Frontend files to modify:

- `web/src/views/auth/register/index.vue`: replace simulated registration with real SaaS signup or redirect to SaaS signup.
- `web/src/views/auth/login/index.vue`: keep tenant selection; update copy if needed.
- `web/src/router/modules/system.ts` or backend menu seed data: ensure SaaS menus can resolve components.

Database/migration files to create:

- `server/src/migrations/1760000000000-CreateSaasFoundationTables.ts`: SaaS Phase 1 tables.
- `server/src/migrations/1760000000001-SeedSaasFoundationData.ts`: default plans, menus, and role seeds.

## Task 1: SaaS Constants, Entities, And Migrations

**Files:**
- Create: `server/src/module/saas/constants.ts`
- Create: `server/src/module/saas/entities/saas-plan.entity.ts`
- Create: `server/src/module/saas/entities/saas-plan-feature.entity.ts`
- Create: `server/src/module/saas/entities/saas-plan-quota.entity.ts`
- Create: `server/src/module/saas/entities/saas-subscription.entity.ts`
- Create: `server/src/module/saas/entities/saas-trial.entity.ts`
- Create: `server/src/module/saas/entities/saas-tenant-resource.entity.ts`
- Create: `server/src/migrations/1760000000000-CreateSaasFoundationTables.ts`

**Interfaces:**
- Produces `SaasPlanEntity`, `SaasPlanQuotaEntity`, `SaasSubscriptionEntity`, `SaasTrialEntity`, `SaasTenantResourceEntity`.
- Produces constants `SAAS_PLAN_FREE`, `SAAS_SUBSCRIPTION_ACTIVE`, `SAAS_QUOTA_USERS`, `SAAS_QUOTA_STORAGE_MB`, `SAAS_QUOTA_AI_CALLS`, `SAAS_QUOTA_RAG_DOCUMENTS`, `SAAS_QUOTA_TOKENS`.

- [ ] **Step 1: Create constants**

Create `server/src/module/saas/constants.ts`:

```ts
export const SAAS_PLAN_FREE = 'free';
export const SAAS_PLAN_PRO = 'pro';
export const SAAS_PLAN_ENTERPRISE = 'enterprise';

export const SAAS_SUBSCRIPTION_TRIALING = 'trialing';
export const SAAS_SUBSCRIPTION_ACTIVE = 'active';
export const SAAS_SUBSCRIPTION_EXPIRED = 'expired';
export const SAAS_SUBSCRIPTION_FROZEN = 'frozen';

export const SAAS_QUOTA_USERS = 'users';
export const SAAS_QUOTA_STORAGE_MB = 'storage_mb';
export const SAAS_QUOTA_AI_CALLS = 'ai_calls';
export const SAAS_QUOTA_RAG_DOCUMENTS = 'rag_documents';
export const SAAS_QUOTA_TOKENS = 'tokens';

export const SAAS_DEFAULT_TRIAL_DAYS = 14;
```

- [ ] **Step 2: Create entities**

Create each entity with `@Entity`, `@PrimaryGeneratedColumn`, tenant IDs as `bigint`, timestamps compatible with the current project, and soft delete fields where applicable. Use camelCase properties with snake_case column names, matching existing project style.

Example for `SaasPlanEntity`:

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('saas_plan')
export class SaasPlanEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'code', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', name: 'name', length: 100 })
  name: string;

  @Column({ type: 'tinyint', name: 'status', default: 1 })
  status: number;

  @Column({ type: 'int', name: 'sort', default: 100 })
  sort: number;

  @Column({ type: 'varchar', name: 'remark', length: 255, nullable: true })
  remark?: string;

  @Column({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @Column({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @Column({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
```

- [ ] **Step 3: Write migration**

Create tables for the seven Phase 1 SaaS entities. Include unique indexes:

```sql
UNIQUE KEY uk_saas_plan_code (code)
UNIQUE KEY uk_saas_plan_quota_plan_type (plan_id, quota_type)
UNIQUE KEY uk_saas_subscription_tenant_active (tenant_id, status)
UNIQUE KEY uk_saas_tenant_resource_tenant_type (tenant_id, resource_type)
```

- [ ] **Step 4: Run backend typecheck**

Run:

```powershell
pnpm exec tsc --noEmit
```

Expected: command exits with code `0`.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/saas/constants.ts server/src/module/saas/entities server/src/migrations/1760000000000-CreateSaasFoundationTables.ts
git commit -m "feat: add SaaS foundation entities"
```

## Task 2: Plan And Quota Services

**Files:**
- Create: `server/src/module/saas/services/saas-plan.service.ts`
- Create: `server/src/module/saas/services/saas-quota.service.ts`
- Create: `server/src/module/saas/services/saas-quota.service.spec.ts`
- Create: `server/src/module/saas/saas.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Produces `SaasPlanService.getFreePlan(): Promise<SaasPlanEntity>`.
- Produces `SaasQuotaService.initializeTenantQuota(tenantId: number, planId: number): Promise<void>`.
- Produces `SaasQuotaService.getTenantUsageSummary(tenantId: number): Promise<Array<{ resource_type: string; quota: number; used: number; remaining: number }>>`.

- [ ] **Step 1: Write failing quota service test**

Create `server/src/module/saas/services/saas-quota.service.spec.ts` with tests that verify quota initialization creates rows for users, storage, AI calls, RAG documents, and tokens.

Run:

```powershell
pnpm run test -- saas-quota.service.spec.ts --runInBand
```

Expected: FAIL because `SaasQuotaService` does not exist yet.

- [ ] **Step 2: Implement `SaasPlanService`**

Implement `getFreePlan()` to find an active plan with code `free`. If no plan exists, throw `Error('Free plan is not configured')`.

- [ ] **Step 3: Implement `SaasQuotaService`**

Implement quota initialization by reading `SaasPlanQuotaEntity` rows for the plan and upserting `SaasTenantResourceEntity` rows with `used = 0`.

Use this output shape:

```ts
{
  resource_type: item.resourceType,
  quota: Number(item.totalQuota),
  used: Number(item.usedQuota),
  remaining: Math.max(Number(item.totalQuota) - Number(item.usedQuota), 0),
}
```

- [ ] **Step 4: Register `SaasModule`**

`SaasModule` imports TypeORM repositories for all SaaS entities and exports `SaasPlanService` and `SaasQuotaService`.

Modify `server/src/app.module.ts` to import `SaasModule`.

- [ ] **Step 5: Run tests**

```powershell
pnpm run test -- saas-quota.service.spec.ts --runInBand
pnpm exec tsc --noEmit
```

Expected: both commands exit with code `0`.

- [ ] **Step 6: Commit**

```powershell
git add server/src/module/saas/services server/src/module/saas/saas.module.ts server/src/app.module.ts
git commit -m "feat: add SaaS plan and quota services"
```

## Task 3: Tenant Provisioning Service

**Files:**
- Create: `server/src/module/saas/dto/signup.dto.ts`
- Create: `server/src/module/saas/dto/tenant-provision.dto.ts`
- Create: `server/src/module/saas/services/saas-provisioning.service.ts`
- Create: `server/src/module/saas/services/saas-provisioning.service.spec.ts`

**Interfaces:**
- Produces `SaasProvisioningService.signup(dto: SaasSignupDto): Promise<{ userId: number; tenantId: number }>`
- Produces `SaasProvisioningService.createTenantFromPlatform(dto: TenantProvisionDto): Promise<{ userId: number; tenantId: number }>`

- [ ] **Step 1: Write failing provisioning test**

Test that signup:

1. Creates a user.
2. Creates a tenant.
3. Creates user-tenant membership.
4. Creates free subscription.
5. Creates trial.
6. Initializes quota.

Run:

```powershell
pnpm run test -- saas-provisioning.service.spec.ts --runInBand
```

Expected: FAIL because provisioning service does not exist.

- [ ] **Step 2: Create DTOs**

`SaasSignupDto` fields:

```ts
export class SaasSignupDto {
  username: string;
  password: string;
  realname?: string;
  tenant_name: string;
  phone?: string;
  email?: string;
  industry?: string;
  team_size?: string;
}
```

`TenantProvisionDto` fields:

```ts
export class TenantProvisionDto {
  tenant_name: string;
  tenant_code: string;
  owner_username: string;
  owner_password: string;
  owner_realname?: string;
  plan_code?: string;
  with_trial?: boolean;
}
```

- [ ] **Step 3: Implement signup orchestration**

Use a TypeORM transaction. Hash password with `bcryptjs`. Create tenant code from a safe prefix plus timestamp when no explicit code is provided. Use current existing entities for user, tenant, user-tenant, role, user-role.

Create default roles:

```text
owner
admin
member
```

Assign `owner` to the registering user.

- [ ] **Step 4: Create subscription and trial**

Create `SaasSubscriptionEntity` with free plan, status `active`, start time now, and no forced end time.

Create `SaasTrialEntity` with start time now and end time `now + 14 days`.

- [ ] **Step 5: Initialize quota**

Call:

```ts
await this.saasQuotaService.initializeTenantQuota(tenantId, freePlan.id);
```

- [ ] **Step 6: Run tests and typecheck**

```powershell
pnpm run test -- saas-provisioning.service.spec.ts --runInBand
pnpm exec tsc --noEmit
```

Expected: both commands exit with code `0`.

- [ ] **Step 7: Commit**

```powershell
git add server/src/module/saas/dto server/src/module/saas/services/saas-provisioning.service.ts server/src/module/saas/services/saas-provisioning.service.spec.ts
git commit -m "feat: add SaaS tenant provisioning"
```

## Task 4: Public Signup And Platform/Tenant APIs

**Files:**
- Create: `server/src/module/saas/saas-public.controller.ts`
- Create: `server/src/module/saas/saas-platform.controller.ts`
- Create: `server/src/module/saas/saas-tenant.controller.ts`
- Modify: `server/src/module/saas/saas.module.ts`

**Interfaces:**
- `POST /api/saas/signup`
- `POST /api/saas/platform/tenants`
- `GET /api/saas/tenant/usage`
- `GET /api/saas/tenant/subscription`

- [ ] **Step 1: Add public signup controller**

Create `SaasPublicController` with:

```ts
@Public()
@Post('signup')
signup(@Body() body: SaasSignupDto) {
  return this.provisioning.signup(body).then((data) => ResultData.ok(data));
}
```

- [ ] **Step 2: Add platform tenant creation controller**

Create `SaasPlatformController` with `@RequirePermission('saas:tenant:save')` and route `POST /api/saas/platform/tenants`.

- [ ] **Step 3: Add tenant usage controller**

Create `SaasTenantController` with routes:

```text
GET /api/saas/tenant/usage
GET /api/saas/tenant/subscription
```

Read current tenant ID from existing tenant context. Return 401-style failure when tenant ID is missing.

- [ ] **Step 4: Register controllers**

Update `SaasModule` controllers array.

- [ ] **Step 5: Verify**

Run:

```powershell
pnpm exec tsc --noEmit
```

Expected: exits with code `0`.

- [ ] **Step 6: Commit**

```powershell
git add server/src/module/saas/saas-public.controller.ts server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-tenant.controller.ts server/src/module/saas/saas.module.ts
git commit -m "feat: expose SaaS foundation APIs"
```

## Task 5: Seed Plans, Menus, And Permissions

**Files:**
- Create: `server/src/migrations/1760000000001-SeedSaasFoundationData.ts`

**Interfaces:**
- Produces default plans: free, pro, enterprise.
- Produces platform menu permissions under SaaS management.
- Produces tenant billing and usage menus.

- [ ] **Step 1: Add plan seed data**

Seed:

```text
free: enabled
pro: enabled
enterprise: enabled
```

Seed free quotas:

```text
users = 3
storage_mb = 512
ai_calls = 100
rag_documents = 10
tokens = 100000
```

- [ ] **Step 2: Add SaaS platform menus**

Insert menu rows with slugs:

```text
saas:tenant:index
saas:tenant:save
saas:plan:index
saas:plan:update
saas:subscription:index
saas:usage:index
```

- [ ] **Step 3: Add tenant menus**

Insert menu rows with slugs:

```text
tenant:billing:view
tenant:billing:upgrade
tenant:quota:view
tenant:resource:buy
```

- [ ] **Step 4: Verify migration compiles**

```powershell
pnpm exec tsc --noEmit
```

Expected: exits with code `0`.

- [ ] **Step 5: Commit**

```powershell
git add server/src/migrations/1760000000001-SeedSaasFoundationData.ts
git commit -m "feat: seed SaaS foundation data"
```

## Task 6: Frontend API And Signup Page

**Files:**
- Create: `web/src/api/saas.ts`
- Create: `web/src/views/saas/signup/index.vue`
- Modify: `web/src/views/auth/register/index.vue`

**Interfaces:**
- Produces `signupTenant(params)` in `web/src/api/saas.ts`.
- Produces a real signup page that calls `POST /api/saas/signup`.

- [ ] **Step 1: Create API wrapper**

Create:

```ts
import request from '@/utils/http';

export function signupTenant(params: Record<string, any>) {
  return request.post<{ userId: number; tenantId: number }>({
    url: '/api/saas/signup',
    data: params
  });
}

export function fetchTenantUsage() {
  return request.get<any>({
    url: '/api/saas/tenant/usage'
  });
}
```

- [ ] **Step 2: Build signup page**

Create form fields:

```text
username
password
confirmPassword
realname
tenant_name
phone
email
agreement
```

On submit call `signupTenant`.

- [ ] **Step 3: Replace mock register behavior**

Modify `web/src/views/auth/register/index.vue` so it either imports and reuses the SaaS signup page or calls `signupTenant` directly. Remove simulated success timer.

- [ ] **Step 4: Verify frontend typecheck**

```powershell
pnpm exec vue-tsc --noEmit
```

Expected: exits with code `0`.

- [ ] **Step 5: Commit**

```powershell
git add web/src/api/saas.ts web/src/views/saas/signup/index.vue web/src/views/auth/register/index.vue
git commit -m "feat: add SaaS signup UI"
```

## Task 7: Tenant Plan And Usage Pages

**Files:**
- Create: `web/src/views/saas/tenant/plan/index.vue`
- Create: `web/src/views/saas/tenant/usage/index.vue`
- Modify: `web/src/api/saas.ts`

**Interfaces:**
- Produces tenant plan overview page.
- Produces tenant usage center page.

- [ ] **Step 1: Add API methods**

Add:

```ts
export function fetchTenantSubscription() {
  return request.get<any>({
    url: '/api/saas/tenant/subscription'
  });
}
```

- [ ] **Step 2: Create plan page**

Render:

```text
current plan
trial end time
subscription status
upgrade button disabled with text "支付功能将在第二期开放"
```

- [ ] **Step 3: Create usage page**

Render quota cards for:

```text
用户数
存储空间
AI 调用次数
知识库文档数
Token 用量
```

- [ ] **Step 4: Verify frontend typecheck**

```powershell
pnpm exec vue-tsc --noEmit
```

Expected: exits with code `0`.

- [ ] **Step 5: Commit**

```powershell
git add web/src/api/saas.ts web/src/views/saas/tenant/plan/index.vue web/src/views/saas/tenant/usage/index.vue
git commit -m "feat: add tenant SaaS plan and usage pages"
```

## Task 8: End-To-End Verification

**Files:**
- Modify only files required to fix defects found during verification.

**Interfaces:**
- Confirms signup creates a tenant and user membership.
- Confirms login still works.
- Confirms usage endpoint returns initialized quota.

- [ ] **Step 1: Run backend tests**

```powershell
pnpm run test -- saas --runInBand
pnpm exec tsc --noEmit
```

Expected: all tests pass and typecheck exits with code `0`.

- [ ] **Step 2: Run frontend typecheck**

```powershell
pnpm exec vue-tsc --noEmit
```

Expected: exits with code `0`.

- [ ] **Step 3: Verify local health**

```powershell
Invoke-RestMethod -Uri 'http://localhost:8181/api/health' -Method Get
```

Expected: response contains `status: ok`, `mysql: up`, and `redis: up`.

- [ ] **Step 4: Verify signup API manually**

```powershell
Invoke-RestMethod -Uri 'http://localhost:8181/api/saas/signup' -Method Post -ContentType 'application/json' -Body '{"username":"saas_demo_001","password":"123456","tenant_name":"SaaS Demo Tenant"}'
```

Expected: response code is `200` and data contains `userId` and `tenantId`.

- [ ] **Step 5: Commit fixes**

If verification required fixes:

```powershell
git add server/src/module/saas web/src/api/saas.ts web/src/views/saas
git commit -m "fix: stabilize SaaS foundation flow"
```

If no fixes were required, do not create an empty commit.
