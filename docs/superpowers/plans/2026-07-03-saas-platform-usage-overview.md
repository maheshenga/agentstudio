# SaaS Platform Usage Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real platform SaaS usage overview API and dashboard for `#/saas-platform/usage`.

**Architecture:** Extend the existing SaaS platform service/controller and reuse current SaaS operational tables. Aggregate data in `SaasPlatformService` for this slice, expose it through a platform-scoped controller route, and render it in the existing Vue/Element Plus admin page.

**Tech Stack:** NestJS 11, TypeORM repositories, Jest, Vue 3, Vite, Element Plus, existing SaaS API wrapper and dynamic menu system.

## Global Constraints

- Do not add new database tables.
- Do not implement invoices, refunds, auto-renewal, subscription expiry jobs, payment failure reminder jobs, CSV export, revenue trend charts, or tenant health scoring.
- Use existing entities: `SaasSubscriptionEntity`, `SaasOrderEntity`, `SaasResourcePackOrderEntity`, `SaasTenantResourceEntity`, and `SaasPlanEntity`.
- Platform overview APIs must run outside tenant filtering by using the existing `runOutsideTenant` controller helper.
- Empty datasets must return zero counts and empty arrays.
- Missing plan rows in distribution must display `unknown` code/name instead of throwing.
- Preserve unrelated untracked `sdd/` files and frontend temp logs.
- Use TDD for backend service and controller behavior.

---

## File Structure

- Modify `server/src/module/saas/services/saas-platform.service.ts`: add overview response interfaces, inject tenant resource and resource-pack order repositories, implement aggregation helpers and `getUsageOverview()`.
- Modify `server/src/module/saas/services/saas-platform.service.spec.ts`: add repository mocks and tests for empty and populated overview data.
- Modify `server/src/module/saas/saas-platform.controller.ts`: add `GET /api/saas/platform/usage/overview` route.
- Modify `server/src/module/saas/saas-platform.controller.spec.ts`: add controller delegation test.
- Modify `web/src/api/saas.ts`: add overview response interfaces and `fetchPlatformUsageOverview()`.
- Replace `web/src/views/saas/platform/usage/index.vue`: build a real operational dashboard.

## Shared Interfaces

Backend and frontend should use this response shape:

```ts
export interface SaasPlatformUsageOverview {
  kpis: {
    active_subscriptions: number;
    trialing_subscriptions: number;
    expired_subscriptions: number;
    pending_plan_orders: number;
    pending_resource_pack_orders: number;
    paid_plan_order_amount_cents: number;
    paid_resource_pack_order_amount_cents: number;
    total_paid_amount_cents: number;
  };
  quota_summary: Array<{
    resource_type: string;
    total_quota: number;
    used_quota: number;
    remaining_quota: number;
    usage_rate: number;
  }>;
  plan_distribution: Array<{
    plan_id: number;
    plan_code: string;
    plan_name: string;
    active_count: number;
  }>;
  recent_plan_orders: Array<{
    order_no: string;
    tenant_id: number;
    plan_code: string;
    billing_cycle: string;
    amount_cents: number;
    status: string;
    paid_at?: Date;
    create_time?: Date;
  }>;
  recent_resource_pack_orders: Array<{
    order_no: string;
    tenant_id: number;
    resource_pack_code: string;
    resource_type: string;
    amount_cents: number;
    status: string;
    paid_at?: Date;
    create_time?: Date;
  }>;
}
```

`usage_rate` is a percentage from `0` to `100`, rounded to two decimals. If `total_quota` is `0`, return `0`.

## Task 1: Backend Usage Overview Aggregation Service

**Files:**
- Modify: `server/src/module/saas/services/saas-platform.service.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.spec.ts`

**Interfaces:**
- Produces: `SaasPlatformPlanOrderOverviewRecord`.
- Produces: `SaasPlatformResourcePackOrderOverviewRecord`.
- Produces: `SaasPlatformService.getUsageOverview(): Promise<SaasPlatformUsageOverview>`
- Consumes repositories for `SaasOrderEntity`, `SaasSubscriptionEntity`, `SaasPlanEntity`, `SaasTenantResourceEntity`, and `SaasResourcePackOrderEntity`.

- [ ] **Step 1: Write failing empty-overview service test**

Modify `server/src/module/saas/services/saas-platform.service.spec.ts` imports:

```ts
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasTenantResourceEntity } from '../entities/saas-tenant-resource.entity';
```

Extend existing mocks so they include every repository method used by the overview aggregation:

```ts
const orderRepo = {
  find: jest.fn(),
  findAndCount: jest.fn(),
  findOne: jest.fn(),
};
const planRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
};
```

Add mocks near existing repository mocks:

```ts
const tenantResourceRepo = {
  find: jest.fn(),
};
const resourcePackOrderRepo = {
  find: jest.fn(),
};
```

Register them in the testing module providers:

```ts
{ provide: getRepositoryToken(SaasTenantResourceEntity), useValue: tenantResourceRepo },
{ provide: getRepositoryToken(SaasResourcePackOrderEntity), useValue: resourcePackOrderRepo },
```

Add this test:

```ts
it('returns zero usage overview when there is no SaaS operating data', async () => {
  subscriptionRepo.findAndCount.mockResolvedValue([[], 0]);
  orderRepo.findAndCount.mockResolvedValue([[], 0]);
  orderRepo.find.mockResolvedValue([]);
  resourcePackOrderRepo.find.mockResolvedValue([]);
  tenantResourceRepo.find.mockResolvedValue([]);
  planRepo.find.mockResolvedValue([]);

  await expect(service.getUsageOverview()).resolves.toEqual({
    kpis: {
      active_subscriptions: 0,
      trialing_subscriptions: 0,
      expired_subscriptions: 0,
      pending_plan_orders: 0,
      pending_resource_pack_orders: 0,
      paid_plan_order_amount_cents: 0,
      paid_resource_pack_order_amount_cents: 0,
      total_paid_amount_cents: 0,
    },
    quota_summary: [],
    plan_distribution: [],
    recent_plan_orders: [],
    recent_resource_pack_orders: [],
  });
});
```

- [ ] **Step 2: Run service test to verify failure**

Run:

```powershell
cd server
pnpm run test -- saas-platform.service.spec.ts --runInBand
```

Expected: FAIL because `getUsageOverview`, additional repository injections, and new repo mocks are not implemented yet.

- [ ] **Step 3: Write populated aggregation service test**

Add this test in the same spec file:

```ts
it('aggregates platform usage KPIs, quotas, plan distribution, and recent orders', async () => {
  const now = new Date('2026-07-03T06:00:00.000Z');

  subscriptionRepo.findAndCount.mockResolvedValue([
    [
      { id: 1, tenantId: 10, planId: 2, billingCycle: 'yearly', status: 'active', createTime: now },
      { id: 2, tenantId: 11, planId: 2, billingCycle: 'monthly', status: 'active', createTime: now },
      { id: 3, tenantId: 12, planId: 3, billingCycle: 'monthly', status: 'trialing', createTime: now },
      { id: 4, tenantId: 13, planId: 99, billingCycle: 'monthly', status: 'expired', createTime: now },
    ],
    4,
  ]);

  orderRepo.findAndCount.mockResolvedValue([
    [
      { id: 20, orderNo: 'SO-PAID', tenantId: 10, planId: 2, planCode: 'pro', billingCycle: 'yearly', amountCents: 99000, status: 'paid', paidAt: now, createTime: now },
      { id: 21, orderNo: 'SO-PENDING', tenantId: 11, planId: 2, planCode: 'pro', billingCycle: 'monthly', amountCents: 9900, status: 'pending', createTime: now },
    ],
    2,
  ]);
  orderRepo.find.mockResolvedValue([
    { id: 21, orderNo: 'SO-PENDING', tenantId: 11, planId: 2, planCode: 'pro', billingCycle: 'monthly', amountCents: 9900, currency: 'CNY', paymentMethod: 'alipay', status: 'pending', createTime: now },
    { id: 20, orderNo: 'SO-PAID', tenantId: 10, planId: 2, planCode: 'pro', billingCycle: 'yearly', amountCents: 99000, currency: 'CNY', paymentMethod: 'alipay', status: 'paid', paidAt: now, createTime: now },
  ]);

  resourcePackOrderRepo.find.mockResolvedValue([
    { id: 30, orderNo: 'RPO-PAID', tenantId: 10, resourcePackCode: 'tokens_1m', resourcePackName: 'Tokens 1M', resourceType: 'tokens', quotaAmount: 1000000, amountCents: 19900, status: 'paid', paidAt: now, createTime: now },
    { id: 31, orderNo: 'RPO-PENDING', tenantId: 11, resourcePackCode: 'ai_1k', resourcePackName: 'AI 1K', resourceType: 'ai_calls', quotaAmount: 1000, amountCents: 9900, status: 'pending', createTime: now },
  ]);

  tenantResourceRepo.find.mockResolvedValue([
    { tenantId: 10, resourceType: 'tokens', totalQuota: 1000, usedQuota: 250 },
    { tenantId: 11, resourceType: 'tokens', totalQuota: 3000, usedQuota: 750 },
    { tenantId: 12, resourceType: 'ai_calls', totalQuota: 100, usedQuota: 40 },
  ]);

  planRepo.find.mockResolvedValue([
    { id: 2, code: 'pro', name: 'Pro' },
    { id: 3, code: 'enterprise', name: 'Enterprise' },
  ]);

  const result = await service.getUsageOverview();

  expect(result.kpis).toEqual({
    active_subscriptions: 2,
    trialing_subscriptions: 1,
    expired_subscriptions: 1,
    pending_plan_orders: 1,
    pending_resource_pack_orders: 1,
    paid_plan_order_amount_cents: 99000,
    paid_resource_pack_order_amount_cents: 19900,
    total_paid_amount_cents: 118900,
  });
  expect(result.quota_summary).toEqual([
    { resource_type: 'tokens', total_quota: 4000, used_quota: 1000, remaining_quota: 3000, usage_rate: 25 },
    { resource_type: 'ai_calls', total_quota: 100, used_quota: 40, remaining_quota: 60, usage_rate: 40 },
  ]);
  expect(result.plan_distribution).toEqual([
    { plan_id: 2, plan_code: 'pro', plan_name: 'Pro', active_count: 2 },
  ]);
  expect(result.recent_plan_orders).toHaveLength(2);
  expect(result.recent_resource_pack_orders).toHaveLength(2);
});
```

- [ ] **Step 4: Implement service interfaces and injections**

Modify `server/src/module/saas/services/saas-platform.service.ts` imports:

```ts
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasTenantResourceEntity } from '../entities/saas-tenant-resource.entity';
```

Add exported interfaces below `SaasPlatformListQuery`:

```ts
export interface SaasPlatformPlanOrderOverviewRecord {
  id?: number;
  order_no?: string;
  tenant_id?: number;
  plan_id?: number;
  plan_code?: string;
  billing_cycle?: string;
  amount_cents?: number;
  currency?: string;
  payment_method?: string;
  status?: string;
  alipay_trade_no?: string;
  paid_at?: Date;
  create_time?: Date;
}

export interface SaasPlatformResourcePackOrderOverviewRecord {
  order_no?: string;
  tenant_id?: number;
  resource_pack_code?: string;
  resource_pack_name?: string;
  resource_type?: string;
  quota_amount?: number;
  amount_cents?: number;
  currency?: string;
  payment_method?: string;
  status?: string;
  alipay_trade_no?: string;
  paid_at?: Date;
  delivered_at?: Date;
  create_time?: Date;
}

export interface SaasPlatformUsageOverview {
  kpis: {
    active_subscriptions: number;
    trialing_subscriptions: number;
    expired_subscriptions: number;
    pending_plan_orders: number;
    pending_resource_pack_orders: number;
    paid_plan_order_amount_cents: number;
    paid_resource_pack_order_amount_cents: number;
    total_paid_amount_cents: number;
  };
  quota_summary: Array<{
    resource_type: string;
    total_quota: number;
    used_quota: number;
    remaining_quota: number;
    usage_rate: number;
  }>;
  plan_distribution: Array<{
    plan_id: number;
    plan_code: string;
    plan_name: string;
    active_count: number;
  }>;
  recent_plan_orders: SaasPlatformPlanOrderOverviewRecord[];
  recent_resource_pack_orders: SaasPlatformResourcePackOrderOverviewRecord[];
}
```

Extend the constructor:

```ts
@InjectRepository(SaasTenantResourceEntity)
private readonly tenantResourceRepo: Repository<SaasTenantResourceEntity>,
@InjectRepository(SaasResourcePackOrderEntity)
private readonly resourcePackOrderRepo: Repository<SaasResourcePackOrderEntity>,
```

Place those two repository injections after `planRepo` and before service injections.

- [ ] **Step 5: Implement `getUsageOverview()` and helpers**

Add this method before `listResourcePacks`:

```ts
async getUsageOverview(): Promise<SaasPlatformUsageOverview> {
  const [[subscriptions], [orders], tenantResources, resourcePackOrders, recentPlanOrders, plans] = await Promise.all([
    this.subscriptionRepo.findAndCount({ order: { createTime: 'DESC', id: 'DESC' } }),
    this.orderRepo.findAndCount({ order: { createTime: 'DESC', id: 'DESC' } }),
    this.tenantResourceRepo.find({ order: { resourceType: 'ASC', id: 'ASC' } }),
    this.resourcePackOrderRepo.find({ order: { createTime: 'DESC', id: 'DESC' } }),
    this.orderRepo.find({ order: { createTime: 'DESC', id: 'DESC' }, take: 5 }),
    this.planRepo.find(),
  ]);

  const paidPlanAmount = this.sumAmount(orders.filter((order) => order.status === 'paid'));
  const paidResourcePackAmount = this.sumAmount(resourcePackOrders.filter((order) => order.status === 'paid'));

  return {
    kpis: {
      active_subscriptions: subscriptions.filter((item) => item.status === 'active').length,
      trialing_subscriptions: subscriptions.filter((item) => item.status === 'trialing').length,
      expired_subscriptions: subscriptions.filter((item) => item.status === 'expired').length,
      pending_plan_orders: orders.filter((item) => item.status === 'pending').length,
      pending_resource_pack_orders: resourcePackOrders.filter((item) => item.status === 'pending').length,
      paid_plan_order_amount_cents: paidPlanAmount,
      paid_resource_pack_order_amount_cents: paidResourcePackAmount,
      total_paid_amount_cents: paidPlanAmount + paidResourcePackAmount,
    },
    quota_summary: this.buildQuotaSummary(tenantResources),
    plan_distribution: this.buildPlanDistribution(subscriptions, plans),
    recent_plan_orders: recentPlanOrders.map((order) => this.toOrderResponse(order)),
    recent_resource_pack_orders: resourcePackOrders.slice(0, 5).map((order) => this.toResourcePackOrderResponse(order)),
  };
}
```

Add helpers near the existing private helpers:

```ts
private buildQuotaSummary(resources: Partial<SaasTenantResourceEntity>[]) {
  const groups = new Map<string, { resource_type: string; total_quota: number; used_quota: number }>();
  for (const resource of resources) {
    const resourceType = resource.resourceType || 'unknown';
    const current = groups.get(resourceType) || { resource_type: resourceType, total_quota: 0, used_quota: 0 };
    current.total_quota += Number(resource.totalQuota) || 0;
    current.used_quota += Number(resource.usedQuota) || 0;
    groups.set(resourceType, current);
  }

  return Array.from(groups.values()).map((item) => {
    const remaining = Math.max(item.total_quota - item.used_quota, 0);
    return {
      resource_type: item.resource_type,
      total_quota: item.total_quota,
      used_quota: item.used_quota,
      remaining_quota: remaining,
      usage_rate: item.total_quota > 0 ? Number(((item.used_quota / item.total_quota) * 100).toFixed(2)) : 0,
    };
  });
}

private buildPlanDistribution(subscriptions: Partial<SaasSubscriptionEntity>[], plans: Partial<SaasPlanEntity>[]) {
  const planMap = new Map(plans.map((plan) => [Number(plan.id), plan]));
  const groups = new Map<number, number>();
  for (const subscription of subscriptions) {
    if (subscription.status !== 'active') continue;
    const planId = Number(subscription.planId) || 0;
    groups.set(planId, (groups.get(planId) || 0) + 1);
  }

  return Array.from(groups.entries()).map(([planId, activeCount]) => {
    const plan = planMap.get(planId);
    return {
      plan_id: planId,
      plan_code: plan?.code || 'unknown',
      plan_name: plan?.name || 'unknown',
      active_count: activeCount,
    };
  });
}

private sumAmount(rows: Array<Partial<SaasOrderEntity> | Partial<SaasResourcePackOrderEntity>>) {
  return rows.reduce((sum, row) => sum + (Number(row.amountCents) || 0), 0);
}

private toResourcePackOrderResponse(order: Partial<SaasResourcePackOrderEntity>) {
  return {
    order_no: order.orderNo,
    tenant_id: order.tenantId,
    resource_pack_code: order.resourcePackCode,
    resource_pack_name: order.resourcePackName,
    resource_type: order.resourceType,
    quota_amount: order.quotaAmount,
    amount_cents: order.amountCents,
    currency: order.currency,
    payment_method: order.paymentMethod,
    status: order.status,
    alipay_trade_no: order.alipayTradeNo,
    paid_at: order.paidAt,
    delivered_at: order.deliveredAt,
    create_time: order.createTime,
  };
}
```

- [ ] **Step 6: Run service test to verify pass**

Run:

```powershell
cd server
pnpm run test -- saas-platform.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

Run:

```powershell
git add server/src/module/saas/services/saas-platform.service.ts server/src/module/saas/services/saas-platform.service.spec.ts
git commit -m "feat: aggregate SaaS platform usage overview"
```

## Task 2: Platform Usage Overview API Route

**Files:**
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`

**Interfaces:**
- Consumes: `SaasPlatformService.getUsageOverview()` from Task 1.
- Produces: `GET /api/saas/platform/usage/overview` with permission `saas:usage:index`.

- [ ] **Step 1: Write failing controller delegation test**

Modify the `platformService` mock in `server/src/module/saas/saas-platform.controller.spec.ts`:

```ts
getUsageOverview: jest.fn(),
```

Add this test:

```ts
it('returns platform SaaS usage overview outside tenant scope', async () => {
  platformService.getUsageOverview.mockResolvedValue({
    kpis: { active_subscriptions: 1, total_paid_amount_cents: 99000 },
    quota_summary: [],
    plan_distribution: [],
    recent_plan_orders: [],
    recent_resource_pack_orders: [],
  });

  const result = await controller.usageOverview({ userId: 1 } as any);

  expect(platformService.getUsageOverview).toHaveBeenCalled();
  expect(result.data).toEqual({
    kpis: { active_subscriptions: 1, total_paid_amount_cents: 99000 },
    quota_summary: [],
    plan_distribution: [],
    recent_plan_orders: [],
    recent_resource_pack_orders: [],
  });
});
```

- [ ] **Step 2: Run controller test to verify failure**

Run:

```powershell
cd server
pnpm run test -- saas-platform.controller.spec.ts --runInBand
```

Expected: FAIL because `usageOverview` does not exist on the controller.

- [ ] **Step 3: Implement controller route**

Add this route in `server/src/module/saas/saas-platform.controller.ts`, near the order/subscription platform routes:

```ts
@Get('usage/overview')
@ApiOperation({ summary: 'Get SaaS platform usage overview' })
@RequirePermission('saas:usage:index')
usageOverview(@User() user: UserDto) {
  return this.runOutsideTenant(user, () => this.platformService.getUsageOverview().then((data) => ResultData.ok(data)));
}
```

- [ ] **Step 4: Run controller test to verify pass**

Run:

```powershell
cd server
pnpm run test -- saas-platform.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Run backend typecheck**

Run:

```powershell
cd server
pnpm exec tsc --noEmit
```

Expected: exit code `0`. Remove `server/tsconfig.tsbuildinfo` if generated.

- [ ] **Step 6: Commit Task 2**

Run:

```powershell
git add server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-platform.controller.spec.ts
git commit -m "feat: expose SaaS platform usage overview API"
```

## Task 3: Frontend Usage Overview API And Dashboard

**Files:**
- Modify: `web/src/api/saas.ts`
- Replace: `web/src/views/saas/platform/usage/index.vue`

**Interfaces:**
- Consumes: `GET /api/saas/platform/usage/overview`.
- Produces: `fetchPlatformUsageOverview()` and a real platform usage dashboard page.

- [ ] **Step 1: Add frontend API types and wrapper**

Modify `web/src/api/saas.ts` after the Alipay config interfaces:

```ts
export interface SaasPlatformUsageKpis {
  active_subscriptions: number
  trialing_subscriptions: number
  expired_subscriptions: number
  pending_plan_orders: number
  pending_resource_pack_orders: number
  paid_plan_order_amount_cents: number
  paid_resource_pack_order_amount_cents: number
  total_paid_amount_cents: number
}

export interface SaasPlatformQuotaSummaryRecord {
  resource_type: string
  total_quota: number
  used_quota: number
  remaining_quota: number
  usage_rate: number
}

export interface SaasPlatformPlanDistributionRecord {
  plan_id: number
  plan_code: string
  plan_name: string
  active_count: number
}

export interface SaasPlatformUsageOverview {
  kpis: SaasPlatformUsageKpis
  quota_summary: SaasPlatformQuotaSummaryRecord[]
  plan_distribution: SaasPlatformPlanDistributionRecord[]
  recent_plan_orders: SaasPlatformOrderRecord[]
  recent_resource_pack_orders: SaasResourcePackOrderRecord[]
}
```

Add this function near platform API wrappers:

```ts
export function fetchPlatformUsageOverview() {
  return request.get<SaasPlatformUsageOverview>({ url: '/api/saas/platform/usage/overview' })
}
```

- [ ] **Step 2: Replace platform usage page**

Replace `web/src/views/saas/platform/usage/index.vue` with a Vue page that imports:

```ts
import { ElMessage } from 'element-plus'
import {
  fetchPlatformUsageOverview,
  type SaasPlatformUsageOverview,
  type SaasPlatformQuotaSummaryRecord,
  type SaasPlatformOrderRecord,
  type SaasResourcePackOrderRecord
} from '@/api/saas'
```

Use this state:

```ts
const loading = ref(false)
const overview = ref<SaasPlatformUsageOverview>({
  kpis: {
    active_subscriptions: 0,
    trialing_subscriptions: 0,
    expired_subscriptions: 0,
    pending_plan_orders: 0,
    pending_resource_pack_orders: 0,
    paid_plan_order_amount_cents: 0,
    paid_resource_pack_order_amount_cents: 0,
    total_paid_amount_cents: 0
  },
  quota_summary: [],
  plan_distribution: [],
  recent_plan_orders: [],
  recent_resource_pack_orders: []
})
```

Use these helpers:

```ts
function formatMoney(cents: number) {
  return `¥${((Number(cents) || 0) / 100).toFixed(2)}`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
}

function formatDate(value?: string | Date) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function quotaLabel(type: string) {
  const labels: Record<string, string> = {
    users: 'Users',
    storage_mb: 'Storage MB',
    ai_calls: 'AI Calls',
    rag_documents: 'RAG Documents',
    tokens: 'Tokens'
  }
  return labels[type] || type
}
```

Use this loader:

```ts
async function loadOverview() {
  loading.value = true
  try {
    overview.value = await fetchPlatformUsageOverview()
  } catch (error) {
    console.error('[SaasPlatformUsagePage] load overview failed:', error)
    ElMessage.error('Load usage overview failed')
  } finally {
    loading.value = false
  }
}

onMounted(loadOverview)
```

Template requirements:

- Keep outer wrapper: `<div class="art-full-height p-5">`.
- Use a single top-level `ElCard` shell, not nested cards.
- Header title: `SaaS Usage`.
- Header subtitle: `Platform subscription, order, revenue, and quota overview.`.
- Header action: refresh `ElButton` bound to `loadOverview`.
- KPI grid with four boxes:
  - Active subscriptions: `overview.kpis.active_subscriptions`
  - Trialing subscriptions: `overview.kpis.trialing_subscriptions`
  - Total paid revenue: `formatMoney(overview.kpis.total_paid_amount_cents)`
  - Pending orders: sum of pending plan and pending resource-pack orders
- Quota summary table with columns resource type, total, used, remaining, usage rate. Use `ElProgress` for usage rate.
- Plan distribution table with columns plan code, plan name, active count.
- Recent plan orders table with order number, tenant, plan, amount, status, created time.
- Recent resource-pack orders table with order number, tenant, pack, resource type, amount, status, created time.

- [ ] **Step 3: Run frontend typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit Task 3**

Run:

```powershell
git add web/src/api/saas.ts web/src/views/saas/platform/usage/index.vue
git commit -m "feat: add SaaS platform usage dashboard"
```

## Task 4: Final Verification

**Files:**
- Modify only files required to fix defects found during verification.

**Interfaces:**
- Confirms backend tests pass.
- Confirms backend typecheck passes.
- Confirms frontend typecheck passes.
- Confirms route responds under local auth constraints.

- [ ] **Step 1: Run target backend tests**

Run:

```powershell
cd server
pnpm run test -- saas-platform.service.spec.ts --runInBand
pnpm run test -- saas-platform.controller.spec.ts --runInBand
```

Expected: both pass.

- [ ] **Step 2: Run full backend test suite**

Run:

```powershell
cd server
pnpm exec jest --runInBand
```

Expected: all test suites pass.

- [ ] **Step 3: Run backend typecheck**

Run:

```powershell
cd server
pnpm exec tsc --noEmit
```

Expected: exit code `0`. Remove `server/tsconfig.tsbuildinfo` if generated.

- [ ] **Step 4: Run frontend typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: exit code `0`.

- [ ] **Step 5: Confirm local route accessibility**

Run while local backend is up:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/api/saas/platform/usage/overview'
```

Expected without login: HTTP response or app-level auth failure, not a missing route caused by Nest route registration. If local backend is not running, record that route runtime smoke was not executed.

- [ ] **Step 6: Commit verification fixes if required**

If verification required code fixes:

```powershell
git add server/src/module/saas web/src/api/saas.ts web/src/views/saas/platform/usage/index.vue
git commit -m "fix: stabilize SaaS platform usage overview"
```

If no fixes were required, do not create an empty commit.