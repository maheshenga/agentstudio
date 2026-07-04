# SaaS Platform Quota Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a platform-wide SaaS quota ledger API and dashboard section for administrator quota investigation.

**Architecture:** Reuse `SaasQuotaService` as the quota ledger owner, expose platform delegation through `SaasPlatformService` and `SaasPlatformController`, then render the data on the existing platform usage page. Keep the feature read-only.

**Tech Stack:** NestJS 11, TypeORM, Jest, Vue 3, Element Plus, TypeScript, pnpm.

---

## File Structure

- Modify `server/src/module/saas/services/saas-quota.service.ts`: add platform quota ledger list query and mapping.
- Modify `server/src/module/saas/services/saas-quota.service.spec.ts`: add platform listing filter and mapping test.
- Modify `server/src/module/saas/services/saas-platform.service.ts`: inject/delegate quota ledger listing.
- Modify `server/src/module/saas/services/saas-platform.service.spec.ts`: add delegation test.
- Modify `server/src/module/saas/saas-platform.controller.ts`: add `GET /api/saas/platform/quota-ledgers`.
- Modify `server/src/module/saas/saas-platform.controller.spec.ts`: add controller route test.
- Modify `web/src/api/saas.ts`: add platform quota ledger types and fetcher.
- Modify `web/src/views/saas/platform/usage/index.vue`: add platform quota ledger filters/table.

---

### Task 1: Backend Platform Quota Ledger API

**Files:**
- Modify: `server/src/module/saas/services/saas-quota.service.ts`
- Modify: `server/src/module/saas/services/saas-quota.service.spec.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.spec.ts`
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`

- [x] **Step 1: Write failing quota service test**

Add a test that calls `listPlatformQuotaLedgers({ page: '2', limit: '10', tenant_id: '88', resource_type: 'tokens', change_type: 'consume', source_type: 'ai_chat', source_id: 'chat-1' })`.

Expected response:

```ts
{
  list: [{
    id: 9,
    tenant_id: 88,
    resource_type: 'tokens',
    change_type: 'consume',
    quota_delta: 0,
    used_delta: 321,
    balance_total_quota: 1000,
    balance_used_quota: 521,
    source_type: 'ai_chat',
    source_id: 'chat-1',
    remark: 'AI chat completed',
    create_time: createdAt,
  }],
  total: 1,
  page: 2,
  limit: 10,
}
```

Assert `findAndCount` receives:

```ts
{
  where: {
    tenantId: 88,
    resourceType: 'tokens',
    changeType: 'consume',
    sourceType: 'ai_chat',
    sourceId: 'chat-1',
  },
  order: { createTime: 'DESC', id: 'DESC' },
  skip: 10,
  take: 10,
}
```

- [x] **Step 2: Verify RED**

Run:

```powershell
cd server
pnpm exec jest saas-quota.service.spec.ts --runInBand
```

Expected: FAIL because `listPlatformQuotaLedgers` does not exist.

- [x] **Step 3: Implement service method**

Add `SaasQuotaLedgerPlatformListQuery` extending the tenant query with:

```ts
tenant_id?: string | number;
source_type?: string;
source_id?: string;
```

Implement `listPlatformQuotaLedgers(query = {})` using `findAndCount`, the existing pagination helper, and existing ledger response mapper.

- [x] **Step 4: Add platform service and controller tests**

Add a `SaasPlatformService` test asserting `listQuotaLedgers(query)` delegates to `saasQuotaService.listPlatformQuotaLedgers(query)`.

Add a `SaasPlatformController` test asserting `quotaLedgers(query, user)` runs outside tenant scope and returns `ResultData.ok(...)`.

- [x] **Step 5: Implement platform delegation and route**

Inject `SaasQuotaService` into `SaasPlatformService`, add `listQuotaLedgers(query)`, and expose:

```ts
@Get('quota-ledgers')
@RequirePermission('saas:usage:index')
quotaLedgers(@Query() query: SaasQuotaLedgerPlatformListQuery, @User() user: UserDto)
```

- [x] **Step 6: Verify GREEN**

Run:

```powershell
cd server
pnpm exec jest saas-quota.service.spec.ts saas-platform.service.spec.ts saas-platform.controller.spec.ts --runInBand
pnpm exec tsc --noEmit
```

Expected: PASS.

### Task 2: Frontend Platform Quota Ledger UI

**Files:**
- Modify: `web/src/api/saas.ts`
- Modify: `web/src/views/saas/platform/usage/index.vue`

- [x] **Step 1: Add API types and fetcher**

Add:

```ts
export interface SaasPlatformQuotaLedgerListParams {
  page?: number
  limit?: number
  tenant_id?: number | string
  resource_type?: string
  change_type?: string
  source_type?: string
  source_id?: string
}
```

Reuse `TenantQuotaLedgerRecord` or add an equivalent exported record type. Add:

```ts
export function fetchPlatformQuotaLedgers(params: SaasPlatformQuotaLedgerListParams) {
  return request.get<SaasPlatformPageResult<TenantQuotaLedgerRecord>>({ url: '/api/saas/platform/quota-ledgers', params })
}
```

- [x] **Step 2: Add usage-page state and loader**

In `web/src/views/saas/platform/usage/index.vue`, add:

- `quotaLedgerLoading`
- `quotaLedgers`
- `quotaLedgerFilters`
- `loadQuotaLedgers()`

Load the ledgers from `loadPage()` alongside usage overview and payment reconciliation.

- [x] **Step 3: Add UI section**

Add a `Quota ledger` section with tenant id input, resource select, change type select, refresh button, and table columns:

- Tenant
- Resource
- Change
- Quota delta
- Used delta
- Balance
- Source
- Time

Also expose source type/source id filters and pagination so platform operators can inspect the full ledger history, not only the first page.

- [x] **Step 4: Verify frontend**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
pnpm run build
```

Expected: PASS, allowing existing build warnings unrelated to this page.

### Task 3: Final Verification And Commit

**Files:** all files from Tasks 1 and 2 plus this design and plan.

- [ ] **Step 1: Run targeted backend tests**

```powershell
cd server
pnpm exec jest saas-quota.service.spec.ts saas-platform.service.spec.ts saas-platform.controller.spec.ts --runInBand
```

- [ ] **Step 2: Run backend checks**

```powershell
cd server
pnpm exec tsc --noEmit
pnpm run build
```

- [ ] **Step 3: Run frontend checks**

```powershell
cd web
pnpm exec vue-tsc --noEmit
pnpm run build
```

- [ ] **Step 4: Check whitespace and status**

```powershell
git diff --check
git status --short --untracked-files=all
```

Expected: only pre-existing `server/pnpm-lock.yaml` remains unstaged after commit.

- [ ] **Step 5: Commit**

```powershell
git add docs/superpowers/specs/2026-07-04-saas-platform-quota-ledger-design.md `
  docs/superpowers/plans/2026-07-04-saas-platform-quota-ledger.md `
  server/src/module/saas/services/saas-quota.service.ts `
  server/src/module/saas/services/saas-quota.service.spec.ts `
  server/src/module/saas/services/saas-platform.service.ts `
  server/src/module/saas/services/saas-platform.service.spec.ts `
  server/src/module/saas/saas-platform.controller.ts `
  server/src/module/saas/saas-platform.controller.spec.ts `
  web/src/api/saas.ts `
  web/src/views/saas/platform/usage/index.vue

git commit -m "feat: add platform SaaS quota ledger"
```
