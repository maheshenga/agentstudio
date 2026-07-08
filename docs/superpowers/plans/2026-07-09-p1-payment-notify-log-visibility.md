# P1 Payment Notify Log Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let platform admins inspect recent SaaS payment provider callback audit logs from the existing platform usage/payment operations surface.

**Architecture:** Add a paginated platform API backed by `SaasPaymentNotifyLogEntity`, expose it from `SaasPlatformController` under `GET /api/saas/platform/payment/notify-logs`, add a typed frontend API function, and render a compact "Recent payment callbacks" table inside `web/src/views/saas/platform/usage/index.vue` near the existing payment reconciliation section.

**Tech Stack:** NestJS, TypeORM repositories, Jest, Vue 3, Element Plus, TypeScript, existing SaaS readiness scripts.

## Global Constraints

- Do not expose payment secrets; only display audit metadata and the recorded reason, not raw callback payloads in the UI.
- Do not add a new menu/page in this slice; use the existing platform usage page.
- Use the same platform permission family as reconciliation: `saas:order:list`.
- Use TDD: add failing service/controller/frontend assertions first, then implement.
- Keep pagination minimal: default page 1, limit 10, max limit 50.

---

### Task 1: Backend Service Contract

**Files:**
- Modify: `server/src/module/saas/services/saas-platform.service.spec.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.ts`

**Interfaces:**
- Consumes: `SaasPaymentNotifyLogEntity`.
- Produces: `listPaymentNotifyLogs(query)` returning `{ list, total, page, limit }`.
- Response rows use snake_case fields: `id`, `provider`, `order_type`, `order_no`, `trade_no`, `trade_status`, `notify_id`, `result`, `reason`, `processed_at`, `create_time`.

- [ ] **Step 1: Write failing service test**

Add a mock repository provider for `SaasPaymentNotifyLogEntity`, then add:

```ts
it('lists payment notify audit logs with paging and filters', async () => {
  const processedAt = new Date('2026-07-09T02:00:00.000Z')
  paymentNotifyLogRepo.findAndCount.mockResolvedValue([
    [
      {
        id: 9,
        provider: 'alipay',
        orderType: 'plan',
        orderNo: 'SO20260709000000001000001',
        tradeNo: 'TRADE-1',
        tradeStatus: 'TRADE_SUCCESS',
        notifyId: 'NOTIFY-1',
        result: 'confirmed',
        reason: '',
        processedAt,
        createTime: processedAt,
      },
    ],
    1,
  ])

  await expect(
    service.listPaymentNotifyLogs({
      page: '2',
      limit: '5',
      order_no: 'SO20260709',
      trade_no: 'TRADE',
      order_type: 'plan',
      notify_result: 'confirmed',
    }),
  ).resolves.toEqual({
    list: [
      {
        id: 9,
        provider: 'alipay',
        order_type: 'plan',
        order_no: 'SO20260709000000001000001',
        trade_no: 'TRADE-1',
        trade_status: 'TRADE_SUCCESS',
        notify_id: 'NOTIFY-1',
        result: 'confirmed',
        reason: '',
        processed_at: processedAt,
        create_time: processedAt,
      },
    ],
    total: 1,
    page: 2,
    limit: 5,
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd server
npm.cmd test -- saas-platform.service.spec.ts --runInBand
```

Expected: FAIL because `listPaymentNotifyLogs` and/or the repository provider does not exist.

- [ ] **Step 3: Implement service method**

Inject `SaasPaymentNotifyLogEntity` repository in `SaasPlatformService`. Add:

```ts
export interface SaasPaymentNotifyLogListQuery extends SaasPlatformListQuery {
  order_type?: string
  trade_no?: string
  notify_result?: string
}
```

Implement `listPaymentNotifyLogs(query)` with:
- `resolvePagination(query, 10, 50)` behavior using the existing pagination helper or equivalent.
- `Like('%...%')` for `order_no` and `trade_no`.
- exact filters for `order_type` and `notify_result`.
- order by `processedAt DESC`, `createTime DESC`, `id DESC`.

### Task 2: Backend Controller Contract

**Files:**
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`
- Modify: `server/src/module/saas/saas-platform.controller.ts`

**Interfaces:**
- Consumes: `SaasPlatformService.listPaymentNotifyLogs(query)`.
- Produces: `GET /api/saas/platform/payment/notify-logs`.

- [ ] **Step 1: Write failing controller test**

Add `listPaymentNotifyLogs: jest.fn()` to the mocked platform service and add:

```ts
it('returns payment notify logs outside tenant scope', async () => {
  platformService.listPaymentNotifyLogs.mockResolvedValue({
    list: [{ order_no: 'SO20260709000000001000001', result: 'confirmed' }],
    total: 1,
    page: 1,
    limit: 10,
  })

  const result = await controller.paymentNotifyLogs({ page: '1' } as any, { userId: 1 } as any)

  expect(platformService.listPaymentNotifyLogs).toHaveBeenCalledWith({ page: '1' })
  expect(result.data).toEqual({
    list: [{ order_no: 'SO20260709000000001000001', result: 'confirmed' }],
    total: 1,
    page: 1,
    limit: 10,
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd server
npm.cmd test -- saas-platform.controller.spec.ts --runInBand
```

Expected: FAIL because `paymentNotifyLogs` does not exist.

- [ ] **Step 3: Implement controller route**

Add:

```ts
@Get('payment/notify-logs')
@ApiOperation({ summary: 'List SaaS payment notify callback audit logs' })
@RequirePermission('saas:order:list')
paymentNotifyLogs(@Query() query: SaasPaymentNotifyLogListQuery, @User() user: UserDto) {
  return this.runOutsideTenant(user, () => this.platformService.listPaymentNotifyLogs(query).then((data) => ResultData.ok(data)))
}
```

### Task 3: Frontend API And Usage Page

**Files:**
- Modify: `web/src/api/saas.ts`
- Modify: `web/src/views/saas/platform/usage/index.vue`
- Modify: `web/scripts/verify-saas-launch-flow-readiness.ts`
- Modify: `web/scripts/verify-saas-visible-copy-encoding.ts`

**Interfaces:**
- Consumes: `GET /api/saas/platform/payment/notify-logs`.
- Produces: `fetchPlatformPaymentNotifyLogs(params)`.
- Produces: a usage-page table with class `saas-platform-usage-page__notify-logs`.

- [ ] **Step 1: Write failing frontend readiness assertions**

In `verify-saas-launch-flow-readiness.ts`, assert:
- `web/src/api/saas.ts` contains `fetchPlatformPaymentNotifyLogs`.
- platform usage page contains `fetchPlatformPaymentNotifyLogs` and `saas-platform-usage-page__notify-logs`.
- platform controller contains `@Get('payment/notify-logs')`.

In `verify-saas-visible-copy-encoding.ts`, add expected readable copy on platform usage page:
- `Recent payment callbacks`

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-launch-flow-readiness.ts
pnpm.cmd exec tsx scripts/verify-saas-visible-copy-encoding.ts
```

Expected: FAIL on the new missing tokens.

- [ ] **Step 2: Implement API types and function**

Add interfaces:

```ts
export interface SaasPaymentNotifyLogRecord {
  id: number
  provider: string
  order_type?: string
  order_no?: string
  trade_no?: string
  trade_status?: string
  notify_id?: string
  result: string
  reason?: string
  processed_at?: string | Date
  create_time?: string | Date
}

export interface SaasPaymentNotifyLogListParams {
  page?: number
  limit?: number
  order_no?: string
  trade_no?: string
  order_type?: string
  notify_result?: string
}
```

Add:

```ts
export function fetchPlatformPaymentNotifyLogs(params: SaasPaymentNotifyLogListParams) {
  return request.get<SaasPlatformPageResult<SaasPaymentNotifyLogRecord>>({
    url: '/api/saas/platform/payment/notify-logs',
    params
  })
}
```

- [ ] **Step 3: Render recent callback logs**

In `platform/usage/index.vue`:
- import `fetchPlatformPaymentNotifyLogs` and `type SaasPaymentNotifyLogRecord`.
- add `notifyLogLoading`, `notifyLogs`, and `loadNotifyLogs()`.
- call `loadNotifyLogs()` inside `loadPage()`.
- render a compact table below the reconciliation exception grid with columns: order no, order type, result, trade status, reason, processed time.
- use `ElEmpty description="No payment callbacks yet"` for empty state.

### Task 4: Full Verification, Review, Commit

**Files:**
- Review all changed files.

- [ ] **Step 1: Run focused backend tests**

```powershell
cd server
npm.cmd test -- saas-platform.service.spec.ts saas-platform.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend SaaS readiness**

```powershell
cd server
npm.cmd run verify:saas-readiness
```

Expected: PASS.

- [ ] **Step 3: Run frontend readiness and build**

```powershell
cd web
pnpm.cmd run verify:saas-readiness
pnpm.cmd run build
```

Expected: PASS.

- [ ] **Step 4: Review and commit**

```powershell
git diff --check
git diff --stat
git add docs/superpowers/plans/2026-07-09-p1-payment-notify-log-visibility.md server/src/module/saas web/src/api/saas.ts web/src/views/saas/platform/usage/index.vue web/scripts
git commit -m "feat: expose saas payment notify logs"
```

Expected: commit succeeds and working tree is clean.

## Self-Review

- Spec coverage: Adds operational visibility for the P0 callback audit table without exposing raw payloads.
- Placeholder scan: No TBD/TODO/later placeholders remain.
- Type consistency: Frontend snake_case fields match backend response fields.
