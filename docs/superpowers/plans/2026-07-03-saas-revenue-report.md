# SaaS Revenue Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a platform-only SaaS revenue report MVP backed by existing paid plan orders and resource-pack orders.

**Architecture:** Add a focused `SaasRevenueReportService` for cash-basis revenue aggregation so `SaasPlatformService` does not keep growing. Expose it through `SaasPlatformController`, seed one platform menu/permission, then add typed frontend API bindings and a new Element Plus report page.

**Tech Stack:** NestJS 11, TypeORM repositories, Jest/ts-jest, Vue 3, Vite, Element Plus, TypeScript.

## Global Constraints

- Do not add invoice functionality; invoices are explicitly out of product scope.
- Do not add refund processing, refund deduction, net revenue, tax reporting, or deferred revenue recognition.
- Use existing tables only; do not add revenue tables.
- Count revenue only from rows with `status = 'paid'`.
- Use `paidAt` for day, month, and 30-day trend buckets.
- Paid rows without `paidAt` count in total revenue but not day, month, or trend buckets.
- Use server-local day/month boundaries.
- The new API path is `GET /api/saas/platform/revenue/overview`.
- The required permission is `saas:revenue:index`.
- The frontend route/menu path is `#/saas-platform/revenue`.
- Keep the page platform-only; do not add tenant menus.

---

## File Structure

- Create `server/src/module/saas/services/saas-revenue-report.service.ts`: revenue aggregation service and response interfaces.
- Create `server/src/module/saas/services/saas-revenue-report.service.spec.ts`: focused service tests for empty data, paid revenue aggregation, date buckets, split percentages, top tenants, and recent orders.
- Modify `server/src/module/saas/saas.module.ts`: register and export `SaasRevenueReportService`.
- Modify `server/src/module/saas/saas-platform.controller.ts`: inject revenue report service and add `GET revenue/overview`.
- Modify `server/src/module/saas/saas-platform.controller.spec.ts`: mock the new service and test tenant-isolated controller delegation.
- Modify `server/src/module/saas/saas-platform.controller.imports.spec.ts`: update import expectations if this file checks controller imports exactly.
- Create `server/src/migrations/1760000000012-AlignSaasRevenueReportMenu.ts`: seed platform menu and permission.
- Create `server/src/migration-specs/align-saas-revenue-report-menu.spec.ts`: verify migration inserts path/component/permission.
- Modify `web/src/api/saas.ts`: add revenue overview types and fetcher.
- Create `web/src/views/saas/platform/revenue/index.vue`: revenue report page.

---

### Task 1: Backend Revenue Aggregation Service

**Files:**
- Create: `server/src/module/saas/services/saas-revenue-report.service.ts`
- Create: `server/src/module/saas/services/saas-revenue-report.service.spec.ts`

**Interfaces:**
- Produces: `SaasRevenueReportService.getOverview(): Promise<SaasRevenueOverview>`
- Produces: exported interfaces `SaasRevenueOverview`, `SaasRevenueSource`, `SaasRevenueOrderType`
- Consumes: TypeORM repositories for `SaasOrderEntity`, `SaasResourcePackOrderEntity`, `SaasSubscriptionEntity`

- [ ] **Step 1: Write the failing empty-dataset service test**

Add this test setup and first test to `server/src/module/saas/services/saas-revenue-report.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasRevenueReportService } from './saas-revenue-report.service';

describe('SaasRevenueReportService', () => {
  let service: SaasRevenueReportService;

  const orderRepo = { find: jest.fn() };
  const resourcePackOrderRepo = { find: jest.fn() };
  const subscriptionRepo = { count: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasRevenueReportService,
        { provide: getRepositoryToken(SaasOrderEntity), useValue: orderRepo },
        { provide: getRepositoryToken(SaasResourcePackOrderEntity), useValue: resourcePackOrderRepo },
        { provide: getRepositoryToken(SaasSubscriptionEntity), useValue: subscriptionRepo },
      ],
    }).compile();

    service = module.get(SaasRevenueReportService);
  });

  it('returns zero revenue overview with a 30-day zero trend for empty datasets', async () => {
    orderRepo.find.mockResolvedValue([]);
    resourcePackOrderRepo.find.mockResolvedValue([]);
    subscriptionRepo.count.mockResolvedValue(0);

    const result = await service.getOverview();

    expect(result.kpis).toEqual({
      today_revenue_cents: 0,
      month_revenue_cents: 0,
      total_revenue_cents: 0,
      plan_revenue_cents: 0,
      resource_pack_revenue_cents: 0,
      today_paid_order_count: 0,
      month_paid_order_count: 0,
      total_paid_order_count: 0,
      month_paid_tenant_count: 0,
      total_paid_tenant_count: 0,
      active_subscription_count: 0,
      average_order_value_cents: 0,
      month_average_order_value_cents: 0,
    });
    expect(result.revenue_split).toEqual([
      { source: 'plan', revenue_cents: 0, order_count: 0, percent: 0 },
      { source: 'resource_pack', revenue_cents: 0, order_count: 0, percent: 0 },
    ]);
    expect(result.daily_trend).toHaveLength(30);
    expect(result.daily_trend.every((row) => row.total_revenue_cents === 0 && row.paid_order_count === 0)).toBe(true);
    expect(result.top_tenants).toEqual([]);
    expect(result.recent_paid_orders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd server
pnpm exec jest src/module/saas/services/saas-revenue-report.service.spec.ts --runInBand
```

Expected: FAIL because `./saas-revenue-report.service` does not exist.

- [ ] **Step 3: Create the service with zero-state behavior**

Create `server/src/module/saas/services/saas-revenue-report.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';

export type SaasRevenueSource = 'plan' | 'resource_pack';
export type SaasRevenueOrderType = SaasRevenueSource;

export interface SaasRevenueOverview {
  kpis: {
    today_revenue_cents: number;
    month_revenue_cents: number;
    total_revenue_cents: number;
    plan_revenue_cents: number;
    resource_pack_revenue_cents: number;
    today_paid_order_count: number;
    month_paid_order_count: number;
    total_paid_order_count: number;
    month_paid_tenant_count: number;
    total_paid_tenant_count: number;
    active_subscription_count: number;
    average_order_value_cents: number;
    month_average_order_value_cents: number;
  };
  revenue_split: Array<{ source: SaasRevenueSource; revenue_cents: number; order_count: number; percent: number }>;
  daily_trend: Array<{ date: string; plan_revenue_cents: number; resource_pack_revenue_cents: number; total_revenue_cents: number; paid_order_count: number }>;
  top_tenants: Array<{ tenant_id: number; tenant_name?: string; revenue_cents: number; order_count: number; last_paid_at?: Date }>;
  recent_paid_orders: Array<{ order_no: string; order_type: SaasRevenueOrderType; tenant_id: number; label: string; amount_cents: number; payment_method: string; paid_at?: Date }>;
}

type NormalizedPaidOrder = {
  orderNo: string;
  orderType: SaasRevenueOrderType;
  tenantId: number;
  label: string;
  amountCents: number;
  paymentMethod: string;
  paidAt?: Date;
};

@Injectable()
export class SaasRevenueReportService {
  constructor(
    @InjectRepository(SaasOrderEntity)
    private readonly orderRepo: Repository<SaasOrderEntity>,
    @InjectRepository(SaasResourcePackOrderEntity)
    private readonly resourcePackOrderRepo: Repository<SaasResourcePackOrderEntity>,
    @InjectRepository(SaasSubscriptionEntity)
    private readonly subscriptionRepo: Repository<SaasSubscriptionEntity>,
  ) {}

  async getOverview(): Promise<SaasRevenueOverview> {
    const [planOrders, resourcePackOrders, activeSubscriptionCount] = await Promise.all([
      this.orderRepo.find({ where: { status: 'paid' } }),
      this.resourcePackOrderRepo.find({ where: { status: 'paid' } }),
      this.subscriptionRepo.count({ where: { status: 'active' } }),
    ]);
    const paidOrders = this.normalizeOrders(planOrders, resourcePackOrders);
    return this.buildOverview(paidOrders, activeSubscriptionCount, new Date());
  }

  private normalizeOrders(planOrders: SaasOrderEntity[], resourcePackOrders: SaasResourcePackOrderEntity[]): NormalizedPaidOrder[] {
    return [
      ...planOrders.map((order) => ({
        orderNo: order.orderNo,
        orderType: 'plan' as const,
        tenantId: Number(order.tenantId) || 0,
        label: order.planCode || 'unknown',
        amountCents: Number(order.amountCents) || 0,
        paymentMethod: order.paymentMethod || '',
        paidAt: order.paidAt || undefined,
      })),
      ...resourcePackOrders.map((order) => ({
        orderNo: order.orderNo,
        orderType: 'resource_pack' as const,
        tenantId: Number(order.tenantId) || 0,
        label: order.resourcePackName || order.resourcePackCode || 'unknown',
        amountCents: Number(order.amountCents) || 0,
        paymentMethod: order.paymentMethod || '',
        paidAt: order.paidAt || undefined,
      })),
    ];
  }

  private buildOverview(paidOrders: NormalizedPaidOrder[], activeSubscriptionCount: number, now: Date): SaasRevenueOverview {
    const dailyTrend = this.createEmptyDailyTrend(now);
    return {
      kpis: {
        today_revenue_cents: 0,
        month_revenue_cents: 0,
        total_revenue_cents: paidOrders.reduce((sum, order) => sum + order.amountCents, 0),
        plan_revenue_cents: paidOrders.filter((order) => order.orderType === 'plan').reduce((sum, order) => sum + order.amountCents, 0),
        resource_pack_revenue_cents: paidOrders.filter((order) => order.orderType === 'resource_pack').reduce((sum, order) => sum + order.amountCents, 0),
        today_paid_order_count: 0,
        month_paid_order_count: 0,
        total_paid_order_count: paidOrders.length,
        month_paid_tenant_count: 0,
        total_paid_tenant_count: new Set(paidOrders.map((order) => order.tenantId)).size,
        active_subscription_count: activeSubscriptionCount,
        average_order_value_cents: paidOrders.length ? Math.floor(paidOrders.reduce((sum, order) => sum + order.amountCents, 0) / paidOrders.length) : 0,
        month_average_order_value_cents: 0,
      },
      revenue_split: [
        { source: 'plan', revenue_cents: 0, order_count: 0, percent: 0 },
        { source: 'resource_pack', revenue_cents: 0, order_count: 0, percent: 0 },
      ],
      daily_trend: dailyTrend,
      top_tenants: [],
      recent_paid_orders: [],
    };
  }

  private createEmptyDailyTrend(now: Date): SaasRevenueOverview['daily_trend'] {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29);
    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        date: this.formatDateKey(date),
        plan_revenue_cents: 0,
        resource_pack_revenue_cents: 0,
        total_revenue_cents: 0,
        paid_order_count: 0,
      };
    });
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
```

- [ ] **Step 4: Run the empty-state test**

Run:

```bash
cd server
pnpm exec jest src/module/saas/services/saas-revenue-report.service.spec.ts --runInBand
```

Expected: PASS for the empty-state test.

- [ ] **Step 5: Add aggregation tests**

Append these tests inside the same `describe` block:

```ts
it('aggregates paid plan and resource-pack revenue by period and source', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-07-03T10:00:00.000Z'));
  const today = new Date('2026-07-03T08:00:00.000Z');
  const yesterday = new Date('2026-07-02T08:00:00.000Z');
  const previousMonth = new Date('2026-06-30T08:00:00.000Z');

  orderRepo.find.mockResolvedValue([
    { orderNo: 'SO-TODAY', tenantId: 10, planCode: 'pro', amountCents: 9900, paymentMethod: 'alipay', status: 'paid', paidAt: today },
    { orderNo: 'SO-MONTH', tenantId: 11, planCode: 'team', amountCents: 19900, paymentMethod: 'alipay', status: 'paid', paidAt: yesterday },
    { orderNo: 'SO-OLD', tenantId: 10, planCode: 'pro', amountCents: 29900, paymentMethod: 'alipay', status: 'paid', paidAt: previousMonth },
    { orderNo: 'SO-NO-PAID-AT', tenantId: 12, planCode: 'legacy', amountCents: 1000, paymentMethod: 'manual', status: 'paid' },
  ]);
  resourcePackOrderRepo.find.mockResolvedValue([
    { orderNo: 'RPO-TODAY', tenantId: 10, resourcePackCode: 'tokens_1m', resourcePackName: 'Tokens 1M', amountCents: 4900, paymentMethod: 'alipay', status: 'paid', paidAt: today },
    { orderNo: 'RPO-OLD', tenantId: 13, resourcePackCode: 'ai_1k', resourcePackName: 'AI 1K', amountCents: 5900, paymentMethod: 'alipay', status: 'paid', paidAt: previousMonth },
  ]);
  subscriptionRepo.count.mockResolvedValue(3);

  const result = await service.getOverview();

  expect(orderRepo.find).toHaveBeenCalledWith({ where: { status: 'paid' } });
  expect(resourcePackOrderRepo.find).toHaveBeenCalledWith({ where: { status: 'paid' } });
  expect(subscriptionRepo.count).toHaveBeenCalledWith({ where: { status: 'active' } });
  expect(result.kpis).toMatchObject({
    today_revenue_cents: 14800,
    month_revenue_cents: 34700,
    total_revenue_cents: 71500,
    plan_revenue_cents: 60700,
    resource_pack_revenue_cents: 10800,
    today_paid_order_count: 2,
    month_paid_order_count: 3,
    total_paid_order_count: 6,
    month_paid_tenant_count: 2,
    total_paid_tenant_count: 4,
    active_subscription_count: 3,
    average_order_value_cents: 11916,
    month_average_order_value_cents: 11566,
  });
  expect(result.revenue_split).toEqual([
    { source: 'plan', revenue_cents: 60700, order_count: 4, percent: 84.9 },
    { source: 'resource_pack', revenue_cents: 10800, order_count: 2, percent: 15.1 },
  ]);
  expect(result.daily_trend.find((row) => row.date === '2026-07-03')).toMatchObject({
    plan_revenue_cents: 9900,
    resource_pack_revenue_cents: 4900,
    total_revenue_cents: 14800,
    paid_order_count: 2,
  });

  jest.useRealTimers();
});

it('returns deterministic top tenants and recent paid orders', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-07-03T10:00:00.000Z'));
  const newer = new Date('2026-07-03T09:00:00.000Z');
  const older = new Date('2026-07-02T09:00:00.000Z');

  orderRepo.find.mockResolvedValue([
    { orderNo: 'SO-2', tenantId: 20, planCode: 'pro', amountCents: 2000, paymentMethod: 'alipay', status: 'paid', paidAt: newer },
    { orderNo: 'SO-1', tenantId: 10, planCode: 'free', amountCents: 1000, paymentMethod: 'manual', status: 'paid', paidAt: older },
  ]);
  resourcePackOrderRepo.find.mockResolvedValue([
    { orderNo: 'RPO-1', tenantId: 10, resourcePackCode: 'tokens', resourcePackName: 'Tokens', amountCents: 3000, paymentMethod: 'alipay', status: 'paid', paidAt: newer },
  ]);
  subscriptionRepo.count.mockResolvedValue(0);

  const result = await service.getOverview();

  expect(result.top_tenants).toEqual([
    { tenant_id: 10, revenue_cents: 4000, order_count: 2, last_paid_at: newer },
    { tenant_id: 20, revenue_cents: 2000, order_count: 1, last_paid_at: newer },
  ]);
  expect(result.recent_paid_orders.map((order) => order.order_no)).toEqual(['RPO-1', 'SO-2', 'SO-1']);
  expect(result.recent_paid_orders[0]).toMatchObject({
    order_type: 'resource_pack',
    tenant_id: 10,
    label: 'Tokens',
    amount_cents: 3000,
    payment_method: 'alipay',
  });

  jest.useRealTimers();
});
```

- [ ] **Step 6: Run tests to verify aggregation failures**

Run:

```bash
cd server
pnpm exec jest src/module/saas/services/saas-revenue-report.service.spec.ts --runInBand
```

Expected: FAIL because month/today buckets, split percentages, top tenants, and recent order sorting are not implemented yet.

- [ ] **Step 7: Complete service aggregation**

Replace `buildOverview` in `server/src/module/saas/services/saas-revenue-report.service.ts` with logic equivalent to:

```ts
private buildOverview(paidOrders: NormalizedPaidOrder[], activeSubscriptionCount: number, now: Date): SaasRevenueOverview {
  const todayStart = this.startOfDay(now);
  const todayEnd = this.endOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const datedOrders = paidOrders.filter((order) => order.paidAt);
  const todayOrders = datedOrders.filter((order) => this.isBetween(order.paidAt!, todayStart, todayEnd));
  const monthOrders = datedOrders.filter((order) => this.isBetween(order.paidAt!, monthStart, monthEnd));
  const planOrders = paidOrders.filter((order) => order.orderType === 'plan');
  const resourcePackOrders = paidOrders.filter((order) => order.orderType === 'resource_pack');
  const totalRevenue = this.sumAmount(paidOrders);
  const planRevenue = this.sumAmount(planOrders);
  const resourcePackRevenue = this.sumAmount(resourcePackOrders);
  const monthRevenue = this.sumAmount(monthOrders);

  return {
    kpis: {
      today_revenue_cents: this.sumAmount(todayOrders),
      month_revenue_cents: monthRevenue,
      total_revenue_cents: totalRevenue,
      plan_revenue_cents: planRevenue,
      resource_pack_revenue_cents: resourcePackRevenue,
      today_paid_order_count: todayOrders.length,
      month_paid_order_count: monthOrders.length,
      total_paid_order_count: paidOrders.length,
      month_paid_tenant_count: new Set(monthOrders.map((order) => order.tenantId)).size,
      total_paid_tenant_count: new Set(paidOrders.map((order) => order.tenantId)).size,
      active_subscription_count: activeSubscriptionCount,
      average_order_value_cents: paidOrders.length ? Math.floor(totalRevenue / paidOrders.length) : 0,
      month_average_order_value_cents: monthOrders.length ? Math.floor(monthRevenue / monthOrders.length) : 0,
    },
    revenue_split: [
      { source: 'plan', revenue_cents: planRevenue, order_count: planOrders.length, percent: this.percent(planRevenue, totalRevenue) },
      { source: 'resource_pack', revenue_cents: resourcePackRevenue, order_count: resourcePackOrders.length, percent: this.percent(resourcePackRevenue, totalRevenue) },
    ],
    daily_trend: this.buildDailyTrend(now, datedOrders),
    top_tenants: this.buildTopTenants(paidOrders),
    recent_paid_orders: this.buildRecentPaidOrders(paidOrders),
  };
}
```

Also add helpers:

```ts
private startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

private endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

private isBetween(value: Date, start: Date, end: Date): boolean {
  const time = value.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

private sumAmount(orders: NormalizedPaidOrder[]): number {
  return orders.reduce((sum, order) => sum + order.amountCents, 0);
}

private percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 10000) / 100;
}
```

Implement `buildDailyTrend`, `buildTopTenants`, and `buildRecentPaidOrders`:

```ts
private buildDailyTrend(now: Date, datedOrders: NormalizedPaidOrder[]): SaasRevenueOverview['daily_trend'] {
  const trend = this.createEmptyDailyTrend(now);
  const byDate = new Map(trend.map((row) => [row.date, row]));
  for (const order of datedOrders) {
    const row = byDate.get(this.formatDateKey(order.paidAt!));
    if (!row) continue;
    if (order.orderType === 'plan') row.plan_revenue_cents += order.amountCents;
    if (order.orderType === 'resource_pack') row.resource_pack_revenue_cents += order.amountCents;
    row.total_revenue_cents += order.amountCents;
    row.paid_order_count += 1;
  }
  return trend;
}

private buildTopTenants(paidOrders: NormalizedPaidOrder[]): SaasRevenueOverview['top_tenants'] {
  const tenantMap = new Map<number, { tenant_id: number; revenue_cents: number; order_count: number; last_paid_at?: Date }>();
  for (const order of paidOrders) {
    const current = tenantMap.get(order.tenantId) || { tenant_id: order.tenantId, revenue_cents: 0, order_count: 0 };
    current.revenue_cents += order.amountCents;
    current.order_count += 1;
    if (order.paidAt && (!current.last_paid_at || order.paidAt.getTime() > current.last_paid_at.getTime())) {
      current.last_paid_at = order.paidAt;
    }
    tenantMap.set(order.tenantId, current);
  }
  return [...tenantMap.values()]
    .sort((a, b) => b.revenue_cents - a.revenue_cents || b.order_count - a.order_count || a.tenant_id - b.tenant_id)
    .slice(0, 10);
}

private buildRecentPaidOrders(paidOrders: NormalizedPaidOrder[]): SaasRevenueOverview['recent_paid_orders'] {
  return [...paidOrders]
    .sort((a, b) => {
      const timeDiff = (b.paidAt?.getTime() || 0) - (a.paidAt?.getTime() || 0);
      if (timeDiff) return timeDiff;
      return b.orderNo.localeCompare(a.orderNo);
    })
    .slice(0, 10)
    .map((order) => ({
      order_no: order.orderNo,
      order_type: order.orderType,
      tenant_id: order.tenantId,
      label: order.label,
      amount_cents: order.amountCents,
      payment_method: order.paymentMethod,
      paid_at: order.paidAt,
    }));
}
```

- [ ] **Step 8: Run service tests**

Run:

```bash
cd server
pnpm exec jest src/module/saas/services/saas-revenue-report.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit backend service**

```bash
git add server/src/module/saas/services/saas-revenue-report.service.ts server/src/module/saas/services/saas-revenue-report.service.spec.ts
git commit -m "feat: add SaaS revenue report service"
```

---

### Task 2: Backend Controller and Module Wiring

**Files:**
- Modify: `server/src/module/saas/saas.module.ts`
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`
- Modify if needed: `server/src/module/saas/saas-platform.controller.imports.spec.ts`

**Interfaces:**
- Consumes: `SaasRevenueReportService.getOverview(): Promise<SaasRevenueOverview>` from Task 1
- Produces: `GET /api/saas/platform/revenue/overview`

- [ ] **Step 1: Write failing controller test**

Modify `server/src/module/saas/saas-platform.controller.spec.ts`:

```ts
import { SaasRevenueReportService } from './services/saas-revenue-report.service';
```

Add mock:

```ts
const revenueReportService = {
  getOverview: jest.fn(),
};
```

Add provider:

```ts
{ provide: SaasRevenueReportService, useValue: revenueReportService },
```

Add test:

```ts
it('returns SaaS revenue overview outside tenant scope', async () => {
  revenueReportService.getOverview.mockResolvedValue({
    kpis: { today_revenue_cents: 1000, total_revenue_cents: 5000 },
    revenue_split: [],
    daily_trend: [],
    top_tenants: [],
    recent_paid_orders: [],
  });

  const result = await controller.revenueOverview({ userId: 1 } as any);

  expect(revenueReportService.getOverview).toHaveBeenCalled();
  expect(result.data).toEqual({
    kpis: { today_revenue_cents: 1000, total_revenue_cents: 5000 },
    revenue_split: [],
    daily_trend: [],
    top_tenants: [],
    recent_paid_orders: [],
  });
});
```

- [ ] **Step 2: Run controller test to verify it fails**

Run:

```bash
cd server
pnpm exec jest src/module/saas/saas-platform.controller.spec.ts --runInBand
```

Expected: FAIL because `revenueOverview` and/or provider injection is missing.

- [ ] **Step 3: Wire module provider**

Modify `server/src/module/saas/saas.module.ts`:

```ts
import { SaasRevenueReportService } from './services/saas-revenue-report.service';
```

Add `SaasRevenueReportService` to `providers` and `exports`.

- [ ] **Step 4: Add controller route**

Modify `server/src/module/saas/saas-platform.controller.ts`:

```ts
import { SaasRevenueReportService } from './services/saas-revenue-report.service';
```

Add constructor parameter:

```ts
private readonly revenueReportService: SaasRevenueReportService,
```

Add route near `usageOverview`:

```ts
@Get('revenue/overview')
@ApiOperation({ summary: 'Get SaaS revenue overview' })
@RequirePermission('saas:revenue:index')
revenueOverview(@User() user: UserDto) {
  return this.runOutsideTenant(user, () => this.revenueReportService.getOverview().then((data) => ResultData.ok(data)));
}
```

- [ ] **Step 5: Update import assertion test if it fails**

If `server/src/module/saas/saas-platform.controller.imports.spec.ts` fails, add expectations:

```ts
expect(source).toContain("import { SaasRevenueReportService } from './services/saas-revenue-report.service';");
expect(source).toContain('private readonly revenueReportService: SaasRevenueReportService');
```

- [ ] **Step 6: Run backend target tests**

Run:

```bash
cd server
pnpm exec jest src/module/saas/saas-platform.controller.spec.ts src/module/saas/saas-platform.controller.imports.spec.ts src/module/saas/services/saas-revenue-report.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit controller wiring**

```bash
git add server/src/module/saas/saas.module.ts server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-platform.controller.spec.ts server/src/module/saas/saas-platform.controller.imports.spec.ts
git commit -m "feat: expose SaaS revenue overview API"
```

---

### Task 3: Platform Menu and Permission Migration

**Files:**
- Create: `server/src/migrations/1760000000012-AlignSaasRevenueReportMenu.ts`
- Create: `server/src/migration-specs/align-saas-revenue-report-menu.spec.ts`

**Interfaces:**
- Produces menu code: `SaasRevenueReport`
- Produces route path: `revenue`
- Produces component: `/saas/platform/revenue`
- Produces permission slug: `saas:revenue:index`

- [ ] **Step 1: Write failing migration spec**

Create `server/src/migration-specs/align-saas-revenue-report-menu.spec.ts`:

```ts
import { AlignSaasRevenueReportMenu1760000000012 } from '../migrations/1760000000012-AlignSaasRevenueReportMenu';

describe('AlignSaasRevenueReportMenu1760000000012', () => {
  it('inserts platform revenue report menu and permission', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new AlignSaasRevenueReportMenu1760000000012().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement);
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(sql.some((statement) => statement.includes('INSERT INTO `sa_system_menu`'))).toBe(true);
    expect(params).toContain('SaasRevenueReport');
    expect(params).toContain('revenue');
    expect(params).toContain('/saas/platform/revenue');
    expect(params).toContain('saas:revenue:index');
  });
});
```

- [ ] **Step 2: Run migration spec to verify it fails**

Run:

```bash
cd server
pnpm exec jest src/migration-specs/align-saas-revenue-report-menu.spec.ts --runInBand
```

Expected: FAIL because migration file does not exist.

- [ ] **Step 3: Add migration**

Create `server/src/migrations/1760000000012-AlignSaasRevenueReportMenu.ts` using the same style as `1760000000010-AlignSaasPaymentConfigMenu.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

type MenuSeed = {
  name: string;
  code: string;
  type: number;
  path: string;
  component: string;
  icon: string;
  sort: number;
  remark: string;
};

type PermissionSeed = {
  parentCode: string;
  name: string;
  slug: string;
  method: string;
  sort: number;
  remark: string;
};

const REVENUE_REPORT_MENU: MenuSeed = {
  name: 'Revenue Report',
  code: 'SaasRevenueReport',
  type: 2,
  path: 'revenue',
  component: '/saas/platform/revenue',
  icon: 'ri:line-chart-line',
  sort: 75,
  remark: 'Seeded SaaS revenue report menu',
};

const REVENUE_REPORT_PERMISSIONS: PermissionSeed[] = [
  {
    parentCode: 'SaasRevenueReport',
    name: 'View',
    slug: 'saas:revenue:index',
    method: 'GET',
    sort: 10,
    remark: 'Seeded SaaS revenue report view permission',
  },
];

export class AlignSaasRevenueReportMenu1760000000012 implements MigrationInterface {
  name = 'AlignSaasRevenueReportMenu1760000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insertChildMenu(queryRunner, 'SaasManage', REVENUE_REPORT_MENU);
    for (const permission of REVENUE_REPORT_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`slug\` IN ('saas:revenue:index')
        AND \`delete_time\` IS NULL
    `);

    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`code\` = 'SaasRevenueReport'
        AND \`delete_time\` IS NULL
    `);
  }

  private async insertChildMenu(queryRunner: QueryRunner, parentCode: string, menu: MenuSeed): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_menu\` (
          \`parent_id\`,
          \`name\`,
          \`code\`,
          \`slug\`,
          \`type\`,
          \`path\`,
          \`component\`,
          \`icon\`,
          \`sort\`,
          \`status\`,
          \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, ?, NULL, ?, ?, ?, ?, ?, 1, ?
        FROM \`sa_system_menu\` \`parent\`
        WHERE \`parent\`.\`code\` = ?
          AND \`parent\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM \`sa_system_menu\`
            WHERE \`code\` = ?
              AND \`delete_time\` IS NULL
          )
        ORDER BY \`parent\`.\`id\` ASC
        LIMIT 1
      `,
      [menu.name, menu.code, menu.type, menu.path, menu.component, menu.icon, menu.sort, menu.remark, parentCode, menu.code],
    );
  }

  private async insertPermission(queryRunner: QueryRunner, permission: PermissionSeed): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_menu\` (
          \`parent_id\`,
          \`name\`,
          \`code\`,
          \`slug\`,
          \`type\`,
          \`path\`,
          \`component\`,
          \`method\`,
          \`sort\`,
          \`status\`,
          \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, NULL, ?, 3, '', '', ?, ?, 1, ?
        FROM \`sa_system_menu\` \`parent\`
        WHERE \`parent\`.\`code\` = ?
          AND \`parent\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM \`sa_system_menu\`
            WHERE \`slug\` = ?
              AND \`delete_time\` IS NULL
          )
        ORDER BY \`parent\`.\`id\` ASC
        LIMIT 1
      `,
      [permission.name, permission.slug, permission.method, permission.sort, permission.remark, permission.parentCode, permission.slug],
    );
  }
}
```

- [ ] **Step 4: Run migration spec**

Run:

```bash
cd server
pnpm exec jest src/migration-specs/align-saas-revenue-report-menu.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit migration**

```bash
git add server/src/migrations/1760000000012-AlignSaasRevenueReportMenu.ts server/src/migration-specs/align-saas-revenue-report-menu.spec.ts
git commit -m "feat: add SaaS revenue report menu"
```

---

### Task 4: Frontend API Types and Fetcher

**Files:**
- Modify: `web/src/api/saas.ts`

**Interfaces:**
- Produces: `SaasRevenueOverview`
- Produces: `fetchPlatformRevenueOverview(): Promise<SaasRevenueOverview>`
- Consumes backend endpoint: `GET /api/saas/platform/revenue/overview`

- [ ] **Step 1: Add revenue types**

In `web/src/api/saas.ts`, after `SaasPlatformUsageOverview`, add:

```ts
export interface SaasRevenueKpis {
  today_revenue_cents: number
  month_revenue_cents: number
  total_revenue_cents: number
  plan_revenue_cents: number
  resource_pack_revenue_cents: number
  today_paid_order_count: number
  month_paid_order_count: number
  total_paid_order_count: number
  month_paid_tenant_count: number
  total_paid_tenant_count: number
  active_subscription_count: number
  average_order_value_cents: number
  month_average_order_value_cents: number
}

export interface SaasRevenueSplitRecord {
  source: 'plan' | 'resource_pack'
  revenue_cents: number
  order_count: number
  percent: number
}

export interface SaasRevenueDailyTrendRecord {
  date: string
  plan_revenue_cents: number
  resource_pack_revenue_cents: number
  total_revenue_cents: number
  paid_order_count: number
}

export interface SaasRevenueTopTenantRecord {
  tenant_id: number
  tenant_name?: string
  revenue_cents: number
  order_count: number
  last_paid_at?: string | Date
}

export interface SaasRevenuePaidOrderRecord {
  order_no: string
  order_type: 'plan' | 'resource_pack'
  tenant_id: number
  label: string
  amount_cents: number
  payment_method: string
  paid_at?: string | Date
}

export interface SaasRevenueOverview {
  kpis: SaasRevenueKpis
  revenue_split: SaasRevenueSplitRecord[]
  daily_trend: SaasRevenueDailyTrendRecord[]
  top_tenants: SaasRevenueTopTenantRecord[]
  recent_paid_orders: SaasRevenuePaidOrderRecord[]
}
```

- [ ] **Step 2: Add fetcher**

In `web/src/api/saas.ts`, after `fetchPlatformUsageOverview`, add:

```ts
export function fetchPlatformRevenueOverview() {
  return request.get<SaasRevenueOverview>({ url: '/api/saas/platform/revenue/overview' })
}
```

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit frontend API**

```bash
git add web/src/api/saas.ts
git commit -m "feat: add SaaS revenue frontend API"
```

---

### Task 5: Frontend Revenue Report Page

**Files:**
- Create: `web/src/views/saas/platform/revenue/index.vue`

**Interfaces:**
- Consumes: `fetchPlatformRevenueOverview()` from Task 4
- Consumes: `SaasRevenueOverview` from Task 4
- Produces Vue component name: `SaasPlatformRevenuePage`

- [ ] **Step 1: Create page with typed state and template**

Create `web/src/views/saas/platform/revenue/index.vue`:

```vue
<template>
  <div class="art-full-height p-5">
    <ElCard v-loading="loading" shadow="never" class="saas-revenue-page">
      <template #header>
        <div class="saas-revenue-page__header">
          <div>
            <h1 class="saas-revenue-page__title">SaaS Revenue</h1>
            <p class="saas-revenue-page__subtitle">Cash-basis revenue from paid plan and resource-pack orders.</p>
          </div>
          <ElButton :loading="loading" @click="loadOverview">Refresh</ElButton>
        </div>
      </template>

      <div class="saas-revenue-page__kpis">
        <div class="saas-revenue-page__kpi">
          <span>Today revenue</span>
          <strong>{{ formatMoney(overview.kpis.today_revenue_cents) }}</strong>
        </div>
        <div class="saas-revenue-page__kpi">
          <span>Month revenue</span>
          <strong>{{ formatMoney(overview.kpis.month_revenue_cents) }}</strong>
        </div>
        <div class="saas-revenue-page__kpi">
          <span>Total revenue</span>
          <strong>{{ formatMoney(overview.kpis.total_revenue_cents) }}</strong>
        </div>
        <div class="saas-revenue-page__kpi">
          <span>Month paid tenants</span>
          <strong>{{ formatNumber(overview.kpis.month_paid_tenant_count) }}</strong>
        </div>
        <div class="saas-revenue-page__kpi">
          <span>Month paid orders</span>
          <strong>{{ formatNumber(overview.kpis.month_paid_order_count) }}</strong>
        </div>
        <div class="saas-revenue-page__kpi">
          <span>Month AOV</span>
          <strong>{{ formatMoney(overview.kpis.month_average_order_value_cents) }}</strong>
        </div>
      </div>

      <section class="saas-revenue-page__section">
        <div class="saas-revenue-page__section-header">
          <h2>Revenue split</h2>
        </div>
        <ElTable :data="overview.revenue_split" border>
          <ElTableColumn label="Source" min-width="160">
            <template #default="{ row }">{{ sourceLabel(row.source) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Revenue" min-width="160" align="right">
            <template #default="{ row }">{{ formatMoney(row.revenue_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Orders" min-width="120" align="right">
            <template #default="{ row }">{{ formatNumber(row.order_count) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Percent" min-width="180">
            <template #default="{ row }">
              <ElProgress :percentage="normalizePercent(row.percent)" :stroke-width="10" />
            </template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No revenue split" />
          </template>
        </ElTable>
      </section>

      <section class="saas-revenue-page__section">
        <div class="saas-revenue-page__section-header">
          <h2>Last 30 days</h2>
        </div>
        <ElTable :data="overview.daily_trend" border height="360">
          <ElTableColumn prop="date" label="Date" width="130" />
          <ElTableColumn label="Plan revenue" min-width="150" align="right">
            <template #default="{ row }">{{ formatMoney(row.plan_revenue_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Resource-pack revenue" min-width="190" align="right">
            <template #default="{ row }">{{ formatMoney(row.resource_pack_revenue_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Total revenue" min-width="150" align="right">
            <template #default="{ row }">{{ formatMoney(row.total_revenue_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Orders" width="110" align="right">
            <template #default="{ row }">{{ formatNumber(row.paid_order_count) }}</template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No trend data" />
          </template>
        </ElTable>
      </section>

      <section class="saas-revenue-page__section">
        <div class="saas-revenue-page__section-header">
          <h2>Top tenants</h2>
        </div>
        <ElTable :data="overview.top_tenants" border>
          <ElTableColumn label="Tenant" min-width="160">
            <template #default="{ row }">{{ row.tenant_name || `#${row.tenant_id}` }}</template>
          </ElTableColumn>
          <ElTableColumn label="Revenue" min-width="160" align="right">
            <template #default="{ row }">{{ formatMoney(row.revenue_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Orders" width="120" align="right">
            <template #default="{ row }">{{ formatNumber(row.order_count) }}</template>
          </ElTableColumn>
          <ElTableColumn label="Last paid" min-width="180">
            <template #default="{ row }">{{ formatDate(row.last_paid_at) }}</template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No paid tenants" />
          </template>
        </ElTable>
      </section>

      <section class="saas-revenue-page__section">
        <div class="saas-revenue-page__section-header">
          <h2>Recent paid orders</h2>
        </div>
        <ElTable :data="overview.recent_paid_orders" border>
          <ElTableColumn prop="order_no" label="Order no" min-width="210" />
          <ElTableColumn label="Type" width="140">
            <template #default="{ row }">{{ sourceLabel(row.order_type) }}</template>
          </ElTableColumn>
          <ElTableColumn prop="tenant_id" label="Tenant" width="110" />
          <ElTableColumn prop="label" label="Label" min-width="150" />
          <ElTableColumn label="Amount" width="140" align="right">
            <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
          </ElTableColumn>
          <ElTableColumn prop="payment_method" label="Payment" width="120" />
          <ElTableColumn label="Paid time" min-width="180">
            <template #default="{ row }">{{ formatDate(row.paid_at) }}</template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty description="No paid orders" />
          </template>
        </ElTable>
      </section>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import {
    fetchPlatformRevenueOverview,
    type SaasRevenueOverview
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformRevenuePage' })

  const loading = ref(false)
  const overview = ref<SaasRevenueOverview>({
    kpis: {
      today_revenue_cents: 0,
      month_revenue_cents: 0,
      total_revenue_cents: 0,
      plan_revenue_cents: 0,
      resource_pack_revenue_cents: 0,
      today_paid_order_count: 0,
      month_paid_order_count: 0,
      total_paid_order_count: 0,
      month_paid_tenant_count: 0,
      total_paid_tenant_count: 0,
      active_subscription_count: 0,
      average_order_value_cents: 0,
      month_average_order_value_cents: 0
    },
    revenue_split: [],
    daily_trend: [],
    top_tenants: [],
    recent_paid_orders: []
  })

  function formatMoney(cents: number) {
    return `CNY ${((Number(cents) || 0) / 100).toFixed(2)}`
  }

  function formatNumber(value: number) {
    return new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
  }

  function formatDate(value?: string | Date) {
    if (!value) return '-'
    return new Date(value).toLocaleString('zh-CN', { hour12: false })
  }

  function sourceLabel(source: string) {
    if (source === 'plan') return 'Plan'
    if (source === 'resource_pack') return 'Resource pack'
    return source || '-'
  }

  function normalizePercent(value: number) {
    return Math.min(100, Math.max(0, Number(value) || 0))
  }

  async function loadOverview() {
    loading.value = true
    try {
      overview.value = await fetchPlatformRevenueOverview()
    } catch (error) {
      console.error('[SaasPlatformRevenuePage] load overview failed:', error)
      ElMessage.error('Load revenue report failed')
    } finally {
      loading.value = false
    }
  }

  onMounted(loadOverview)
</script>

<style scoped>
  .saas-revenue-page {
    min-height: 100%;
  }

  .saas-revenue-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .saas-revenue-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
  }

  .saas-revenue-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .saas-revenue-page__kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .saas-revenue-page__kpi {
    min-height: 86px;
    padding: 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
    background: var(--el-fill-color-blank);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .saas-revenue-page__kpi span {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.4;
  }

  .saas-revenue-page__kpi strong {
    color: var(--el-text-color-primary);
    font-size: 24px;
    font-weight: 700;
    line-height: 1.2;
  }

  .saas-revenue-page__section {
    margin-top: 20px;
  }

  .saas-revenue-page__section-header {
    margin-bottom: 10px;
  }

  .saas-revenue-page__section-header h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
  }

  @media (max-width: 1200px) {
    .saas-revenue-page__kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .saas-revenue-page__header {
      flex-direction: column;
      align-items: stretch;
    }

    .saas-revenue-page__kpis {
      grid-template-columns: 1fr;
    }
  }
</style>
```

- [ ] **Step 2: Run frontend typecheck**

Run:

```bash
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS. If auto-imported Vue globals such as `ref`, `onMounted`, or `computed` are unexpectedly not available, follow the existing SaaS page pattern and add explicit Vue imports.

- [ ] **Step 3: Commit page**

```bash
git add web/src/views/saas/platform/revenue/index.vue
git commit -m "feat: add SaaS revenue report page"
```

---

### Task 6: Final Verification and Review

**Files:**
- No source files expected unless verification reveals a defect.

**Interfaces:**
- Verifies: backend service, controller route, menu migration, frontend API, frontend page

- [ ] **Step 1: Run focused backend tests**

```bash
cd server
pnpm exec jest src/module/saas/services/saas-revenue-report.service.spec.ts src/module/saas/saas-platform.controller.spec.ts src/migration-specs/align-saas-revenue-report-menu.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run full backend test suite**

```bash
cd server
pnpm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run backend typecheck**

```bash
cd server
pnpm exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Run frontend typecheck**

```bash
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Check whitespace**

```bash
git diff --check HEAD
```

Expected: no output.

- [ ] **Step 6: Review final diff**

```bash
git diff --stat HEAD~5..HEAD
git diff HEAD~5..HEAD -- server/src/module/saas web/src/api/saas.ts web/src/views/saas/platform/revenue server/src/migrations server/src/migration-specs
```

Expected:

- No invoice code.
- No refund deduction code.
- No new revenue tables.
- New endpoint requires `saas:revenue:index`.
- New frontend page calls `/api/saas/platform/revenue/overview`.

- [ ] **Step 7: Commit verification fixes if needed**

Only if verification required changes:

```bash
git add <fixed-files>
git commit -m "fix: stabilize SaaS revenue report"
```

Expected: no commit if all prior tasks passed cleanly.
