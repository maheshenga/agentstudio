# SaaS Subscription Lifecycle Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subscription expiry automation, platform lifecycle visibility, and tenant renewal cues on top of the existing SaaS order/payment flow.

**Architecture:** Add one focused lifecycle service in the SaaS module, then have platform and tenant APIs consume it for derived expiry fields and lifecycle summaries. Frontend changes stay inside the existing SaaS API wrapper and two existing pages, reusing current order/payment behavior for renewal.

**Tech Stack:** NestJS 11, TypeORM, Jest, Vue 3, Element Plus, TypeScript, pnpm.

## Global Constraints

- No new persistent tables are required for this slice.
- No auto-renewal charging, invoices, refunds, coupons, grace-period entitlements, dunning emails, SMS, or plan proration.
- Renewal must reuse `POST /api/saas/tenant/orders` and the existing payment confirmation flow.
- Free plans remain non-purchasable.
- Default expiring-soon threshold is 7 days.
- Platform lifecycle day filters clamp to a maximum of 365 days.
- Existing SaaS order activation, resource pack, usage overview, and plan management tests must continue to pass.

---

## File Structure

- Create `server/src/module/saas/services/saas-subscription-lifecycle.service.ts`: lifecycle calculations, expiry sweep, overview counts, and task registration.
- Create `server/src/module/saas/services/saas-subscription-lifecycle.service.spec.ts`: focused lifecycle service tests.
- Modify `server/src/module/saas/saas.module.ts`: register/export lifecycle service.
- Modify `server/src/module/saas/services/saas-platform.service.ts`: lifecycle query filters, decorated subscription responses, overview delegation.
- Modify `server/src/module/saas/services/saas-platform.service.spec.ts`: lifecycle filters and decorated response tests.
- Modify `server/src/module/saas/saas-platform.controller.ts`: add lifecycle overview endpoint.
- Modify `server/src/module/saas/saas-platform.controller.spec.ts`: controller delegation test.
- Modify `server/src/module/saas/saas-tenant.controller.ts`: add lifecycle fields to tenant subscription response.
- Modify `server/src/module/saas/saas-tenant.controller.spec.ts`: tenant lifecycle field tests.
- Modify `web/src/api/saas.ts`: add lifecycle types, fields, params, and API function.
- Modify `web/src/views/saas/platform/subscription/index.vue`: add summary cards, quick filters, remaining-days/lifecycle columns.
- Modify `web/src/views/saas/tenant/plan/index.vue`: add subscription remaining time, warning/expired states, renewal allowance for current paid plan.

---

### Task 1: Add Subscription Lifecycle Service

**Files:**
- Create: `server/src/module/saas/services/saas-subscription-lifecycle.service.ts`
- Create: `server/src/module/saas/services/saas-subscription-lifecycle.service.spec.ts`
- Modify: `server/src/module/saas/saas.module.ts`

**Interfaces:**
- Produces:
  - `SaasSubscriptionLifecycleService`
  - `LifecycleSweepResult`
  - `LifecycleOverview`
  - `SubscriptionLifecycleFields`
  - `decorateSubscription(subscription, now?, thresholdDays?)`
  - `sweepExpiredSubscriptions(now?)`
  - `getLifecycleOverview(now?)`
  - `sweepExpiredSubscriptionsTask()`
- Consumes:
  - `SaasSubscriptionEntity`
  - constants from `server/src/module/saas/constants.ts`

- [ ] **Step 1: Write failing lifecycle service tests**

Create `server/src/module/saas/services/saas-subscription-lifecycle.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LessThanOrEqual } from 'typeorm';

import {
  SAAS_SUBSCRIPTION_ACTIVE,
  SAAS_SUBSCRIPTION_EXPIRED,
  SAAS_SUBSCRIPTION_FROZEN,
  SAAS_SUBSCRIPTION_TRIALING,
} from '../constants';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasSubscriptionLifecycleService } from './saas-subscription-lifecycle.service';

describe('SaasSubscriptionLifecycleService', () => {
  let service: SaasSubscriptionLifecycleService;

  const subscriptionRepo = {
    find: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasSubscriptionLifecycleService,
        { provide: getRepositoryToken(SaasSubscriptionEntity), useValue: subscriptionRepo },
      ],
    }).compile();

    service = module.get(SaasSubscriptionLifecycleService);
  });

  it('expires only active subscriptions whose end time has passed', async () => {
    const now = new Date('2026-07-03T00:00:00.000Z');
    subscriptionRepo.find.mockResolvedValue([
      { id: 1, status: SAAS_SUBSCRIPTION_ACTIVE, endTime: new Date('2026-07-02T23:59:59.000Z') },
      { id: 2, status: SAAS_SUBSCRIPTION_ACTIVE, endTime: now },
    ]);
    subscriptionRepo.update.mockResolvedValue({ affected: 2 });

    const result = await service.sweepExpiredSubscriptions(now);

    expect(subscriptionRepo.find).toHaveBeenCalledWith({
      where: {
        status: SAAS_SUBSCRIPTION_ACTIVE,
        endTime: LessThanOrEqual(now),
      },
      select: ['id'],
    });
    expect(subscriptionRepo.update).toHaveBeenCalledWith(
      [1, 2],
      expect.objectContaining({
        status: SAAS_SUBSCRIPTION_EXPIRED,
        remark: 'Expired by SaaS lifecycle sweep at 2026-07-03T00:00:00.000Z',
      }),
    );
    expect(result).toEqual({
      checked_at: now,
      expired_count: 2,
      expired_subscription_ids: [1, 2],
    });
  });

  it('does not update when no subscriptions are expired by time', async () => {
    const now = new Date('2026-07-03T00:00:00.000Z');
    subscriptionRepo.find.mockResolvedValue([]);

    await expect(service.sweepExpiredSubscriptions(now)).resolves.toEqual({
      checked_at: now,
      expired_count: 0,
      expired_subscription_ids: [],
    });
    expect(subscriptionRepo.update).not.toHaveBeenCalled();
  });

  it('decorates subscriptions with remaining days and warning flags', () => {
    const now = new Date('2026-07-03T00:00:00.000Z');

    expect(
      service.decorateSubscription({
        status: SAAS_SUBSCRIPTION_ACTIVE,
        endTime: new Date('2026-07-05T00:00:00.000Z'),
      }, now, 7),
    ).toEqual({
      days_until_expiry: 2,
      is_expiring_soon: true,
      is_expired_by_time: false,
    });
  });

  it('marks active subscriptions with past end time as expired by time', () => {
    const now = new Date('2026-07-03T00:00:00.000Z');

    expect(
      service.decorateSubscription({
        status: SAAS_SUBSCRIPTION_ACTIVE,
        endTime: new Date('2026-07-02T00:00:00.000Z'),
      }, now, 7),
    ).toEqual({
      days_until_expiry: -1,
      is_expiring_soon: false,
      is_expired_by_time: true,
    });
  });

  it('does not mark null-end or inactive subscriptions as expiring soon', () => {
    const now = new Date('2026-07-03T00:00:00.000Z');

    expect(service.decorateSubscription({ status: SAAS_SUBSCRIPTION_ACTIVE }, now, 7)).toEqual({
      days_until_expiry: null,
      is_expiring_soon: false,
      is_expired_by_time: false,
    });
    expect(
      service.decorateSubscription({
        status: SAAS_SUBSCRIPTION_FROZEN,
        endTime: new Date('2026-07-05T00:00:00.000Z'),
      }, now, 7),
    ).toEqual({
      days_until_expiry: 2,
      is_expiring_soon: false,
      is_expired_by_time: false,
    });
    expect(
      service.decorateSubscription({
        status: SAAS_SUBSCRIPTION_TRIALING,
        endTime: new Date('2026-07-05T00:00:00.000Z'),
      }, now, 7),
    ).toEqual({
      days_until_expiry: 2,
      is_expiring_soon: false,
      is_expired_by_time: false,
    });
  });

  it('calculates lifecycle overview counts', async () => {
    const now = new Date('2026-07-03T00:00:00.000Z');
    subscriptionRepo.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3);

    await expect(service.getLifecycleOverview(now)).resolves.toEqual({
      active_count: 10,
      expiring_7_days_count: 2,
      expiring_30_days_count: 5,
      expired_count: 3,
    });

    expect(subscriptionRepo.count).toHaveBeenNthCalledWith(1, { where: { status: SAAS_SUBSCRIPTION_ACTIVE } });
    expect(subscriptionRepo.count).toHaveBeenNthCalledWith(4, { where: { status: SAAS_SUBSCRIPTION_EXPIRED } });
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd server
pnpm run test -- saas-subscription-lifecycle.service.spec.ts --runInBand
```

Expected: FAIL because `saas-subscription-lifecycle.service.ts` does not exist.

- [ ] **Step 3: Implement lifecycle service**

Create `server/src/module/saas/services/saas-subscription-lifecycle.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { Task } from '../../../common/decorators/task.decorator';
import { SAAS_SUBSCRIPTION_ACTIVE, SAAS_SUBSCRIPTION_EXPIRED } from '../constants';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';

export interface LifecycleSweepResult {
  checked_at: Date;
  expired_count: number;
  expired_subscription_ids: number[];
}

export interface LifecycleOverview {
  active_count: number;
  expiring_7_days_count: number;
  expiring_30_days_count: number;
  expired_count: number;
}

export interface SubscriptionLifecycleFields {
  days_until_expiry: number | null;
  is_expiring_soon: boolean;
  is_expired_by_time: boolean;
}

@Injectable()
export class SaasSubscriptionLifecycleService {
  constructor(
    @InjectRepository(SaasSubscriptionEntity)
    private readonly subscriptionRepo: Repository<SaasSubscriptionEntity>,
  ) {}

  async sweepExpiredSubscriptions(now = new Date()): Promise<LifecycleSweepResult> {
    const expiredSubscriptions = await this.subscriptionRepo.find({
      where: {
        status: SAAS_SUBSCRIPTION_ACTIVE,
        endTime: LessThanOrEqual(now),
      },
      select: ['id'],
    });
    const ids = expiredSubscriptions.map((item) => Number(item.id)).filter((id) => Number.isFinite(id) && id > 0);

    if (ids.length) {
      await this.subscriptionRepo.update(ids, {
        status: SAAS_SUBSCRIPTION_EXPIRED,
        remark: `Expired by SaaS lifecycle sweep at ${now.toISOString()}`,
      });
    }

    return {
      checked_at: now,
      expired_count: ids.length,
      expired_subscription_ids: ids,
    };
  }

  async getLifecycleOverview(now = new Date()): Promise<LifecycleOverview> {
    const [activeCount, expiring7DaysCount, expiring30DaysCount, expiredCount] = await Promise.all([
      this.subscriptionRepo.count({ where: { status: SAAS_SUBSCRIPTION_ACTIVE } }),
      this.subscriptionRepo.count({ where: this.buildExpiringWhere(now, 7) }),
      this.subscriptionRepo.count({ where: this.buildExpiringWhere(now, 30) }),
      this.subscriptionRepo.count({ where: { status: SAAS_SUBSCRIPTION_EXPIRED } }),
    ]);

    return {
      active_count: activeCount,
      expiring_7_days_count: expiring7DaysCount,
      expiring_30_days_count: expiring30DaysCount,
      expired_count: expiredCount,
    };
  }

  decorateSubscription(
    subscription: Pick<SaasSubscriptionEntity, 'status' | 'endTime'> | Partial<SaasSubscriptionEntity>,
    now = new Date(),
    thresholdDays = 7,
  ): SubscriptionLifecycleFields {
    const endTime = subscription.endTime ? new Date(subscription.endTime) : null;
    if (!endTime || Number.isNaN(endTime.getTime())) {
      return {
        days_until_expiry: null,
        is_expiring_soon: false,
        is_expired_by_time: false,
      };
    }

    const daysUntilExpiry = Math.ceil((endTime.getTime() - now.getTime()) / 86_400_000);
    const isActive = subscription.status === SAAS_SUBSCRIPTION_ACTIVE;

    return {
      days_until_expiry: daysUntilExpiry,
      is_expiring_soon: isActive && daysUntilExpiry >= 0 && daysUntilExpiry <= thresholdDays,
      is_expired_by_time: isActive && daysUntilExpiry < 0,
    };
  }

  buildExpiringWhere(now = new Date(), rawDays = 7) {
    const days = this.clampDays(rawDays);
    return {
      status: SAAS_SUBSCRIPTION_ACTIVE,
      endTime: Between(now, this.addDays(now, days)),
    };
  }

  buildExpiredSinceWhere(now = new Date(), rawDays = 30) {
    const days = this.clampDays(rawDays);
    return {
      status: SAAS_SUBSCRIPTION_EXPIRED,
      endTime: MoreThanOrEqual(this.addDays(now, -days)),
    };
  }

  clampDays(value: unknown, fallback = 7): number {
    const days = Number(value || fallback);
    if (!Number.isFinite(days) || days <= 0) return fallback;
    return Math.min(365, Math.floor(days));
  }

  addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86_400_000);
  }

  @Task({
    name: 'saas.subscriptionLifecycle.sweep',
    description: 'Expire ended SaaS subscriptions',
  })
  async sweepExpiredSubscriptionsTask() {
    return this.sweepExpiredSubscriptions();
  }
}
```

- [ ] **Step 4: Register lifecycle service in SaaS module**

Modify `server/src/module/saas/saas.module.ts`:

```ts
import { SaasSubscriptionLifecycleService } from './services/saas-subscription-lifecycle.service';
```

Add `SaasSubscriptionLifecycleService` to both `providers` and `exports`.

- [ ] **Step 5: Run lifecycle tests**

Run:

```bash
cd server
pnpm run test -- saas-subscription-lifecycle.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit lifecycle service**

```bash
git add server/src/module/saas/saas.module.ts server/src/module/saas/services/saas-subscription-lifecycle.service.ts server/src/module/saas/services/saas-subscription-lifecycle.service.spec.ts
git commit -m "feat: add SaaS subscription lifecycle service"
```

---

### Task 2: Add Platform Lifecycle APIs

**Files:**
- Modify: `server/src/module/saas/services/saas-platform.service.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.spec.ts`
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`

**Interfaces:**
- Consumes:
  - `SaasSubscriptionLifecycleService.getLifecycleOverview()`
  - `SaasSubscriptionLifecycleService.decorateSubscription()`
  - `SaasSubscriptionLifecycleService.buildExpiringWhere()`
  - `SaasSubscriptionLifecycleService.buildExpiredSinceWhere()`
- Produces:
  - `GET /api/saas/platform/subscriptions/lifecycle/overview`
  - query params on subscription list: `lifecycle_status`, `expires_within_days`, `expired_since_days`

- [ ] **Step 1: Extend platform service tests first**

Modify `server/src/module/saas/services/saas-platform.service.spec.ts`:

Add import:

```ts
import { SaasSubscriptionLifecycleService } from './saas-subscription-lifecycle.service';
```

Add mock:

```ts
const lifecycleService = {
  getLifecycleOverview: jest.fn(),
  decorateSubscription: jest.fn((subscription) => ({
    days_until_expiry: subscription.endTime ? 10 : null,
    is_expiring_soon: false,
    is_expired_by_time: false,
  })),
  buildExpiringWhere: jest.fn(() => ({ status: 'active', endTime: expect.any(Object) })),
  buildExpiredSinceWhere: jest.fn(() => ({ status: 'expired', endTime: expect.any(Object) })),
};
```

Register provider:

```ts
{ provide: SaasSubscriptionLifecycleService, useValue: lifecycleService },
```

Add tests:

```ts
it('decorates platform subscription list rows with lifecycle fields', async () => {
  const startTime = new Date('2026-07-02T00:00:00.000Z');
  const endTime = new Date('2026-07-13T00:00:00.000Z');
  lifecycleService.decorateSubscription.mockReturnValueOnce({
    days_until_expiry: 10,
    is_expiring_soon: false,
    is_expired_by_time: false,
  });
  subscriptionRepo.findAndCount.mockResolvedValue([
    [{ id: 99, tenantId: 12, planId: 2, billingCycle: 'yearly', status: 'active', startTime, endTime }],
    1,
  ]);

  const result = await service.listSubscriptions({ status: 'active' });

  expect(result.list[0]).toMatchObject({
    id: 99,
    days_until_expiry: 10,
    is_expiring_soon: false,
    is_expired_by_time: false,
  });
  expect(lifecycleService.decorateSubscription).toHaveBeenCalledWith(expect.objectContaining({ id: 99 }));
});

it('filters subscriptions by expiring lifecycle status', async () => {
  subscriptionRepo.findAndCount.mockResolvedValue([[], 0]);

  await service.listSubscriptions({ lifecycle_status: 'expiring', expires_within_days: '14' } as any);

  expect(lifecycleService.buildExpiringWhere).toHaveBeenCalledWith(expect.any(Date), '14');
  expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ status: 'active' }),
  }));
});

it('filters subscriptions by expired lifecycle status', async () => {
  subscriptionRepo.findAndCount.mockResolvedValue([[], 0]);

  await service.listSubscriptions({ lifecycle_status: 'expired', expired_since_days: '30' } as any);

  expect(lifecycleService.buildExpiredSinceWhere).toHaveBeenCalledWith(expect.any(Date), '30');
  expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ status: 'expired' }),
  }));
});

it('lets explicit status override lifecycle status', async () => {
  subscriptionRepo.findAndCount.mockResolvedValue([[], 0]);

  await service.listSubscriptions({ status: 'frozen', lifecycle_status: 'expiring' } as any);

  expect(lifecycleService.buildExpiringWhere).not.toHaveBeenCalled();
  expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ status: 'frozen' }),
  }));
});

it('returns lifecycle overview from lifecycle service', async () => {
  lifecycleService.getLifecycleOverview.mockResolvedValue({
    active_count: 3,
    expiring_7_days_count: 1,
    expiring_30_days_count: 2,
    expired_count: 4,
  });

  await expect(service.getSubscriptionLifecycleOverview()).resolves.toEqual({
    active_count: 3,
    expiring_7_days_count: 1,
    expiring_30_days_count: 2,
    expired_count: 4,
  });
});
```

- [ ] **Step 2: Run platform service tests to see them fail**

Run:

```bash
cd server
pnpm run test -- saas-platform.service.spec.ts --runInBand
```

Expected: FAIL because `SaasPlatformService` does not inject or use lifecycle service yet.

- [ ] **Step 3: Implement platform service lifecycle support**

Modify `server/src/module/saas/services/saas-platform.service.ts`:

Add query fields:

```ts
  lifecycle_status?: string;
  expires_within_days?: string | number;
  expired_since_days?: string | number;
```

Inject lifecycle service:

```ts
import { SaasSubscriptionLifecycleService } from './saas-subscription-lifecycle.service';
```

Add constructor param:

```ts
private readonly lifecycleService: SaasSubscriptionLifecycleService,
```

In `listSubscriptions`, after plan filters and before `findAndCount`, apply:

```ts
    if (!query.status) {
      if (query.lifecycle_status === 'active') {
        where.status = 'active';
      } else if (query.lifecycle_status === 'expiring') {
        Object.assign(where, this.lifecycleService.buildExpiringWhere(new Date(), query.expires_within_days || 7));
      } else if (query.lifecycle_status === 'expired') {
        Object.assign(where, this.lifecycleService.buildExpiredSinceWhere(new Date(), query.expired_since_days || 365));
      }
    }
```

Add method:

```ts
  getSubscriptionLifecycleOverview() {
    return this.lifecycleService.getLifecycleOverview();
  }
```

Extend `toSubscriptionResponse`:

```ts
      ...this.lifecycleService.decorateSubscription(subscription),
```

- [ ] **Step 4: Add platform controller test first**

Modify `server/src/module/saas/saas-platform.controller.spec.ts`:

Ensure `platformService` mock includes:

```ts
getSubscriptionLifecycleOverview: jest.fn(),
```

Add test:

```ts
it('returns SaaS subscription lifecycle overview outside tenant scope', async () => {
  platformService.getSubscriptionLifecycleOverview.mockResolvedValue({
    active_count: 3,
    expiring_7_days_count: 1,
    expiring_30_days_count: 2,
    expired_count: 4,
  });

  const result = await controller.subscriptionLifecycleOverview({ userId: 1 } as any);

  expect(result.data).toEqual({
    active_count: 3,
    expiring_7_days_count: 1,
    expiring_30_days_count: 2,
    expired_count: 4,
  });
  expect(platformService.getSubscriptionLifecycleOverview).toHaveBeenCalled();
});
```

- [ ] **Step 5: Add controller endpoint**

Modify `server/src/module/saas/saas-platform.controller.ts` before `@Get('subscriptions/:id')`:

```ts
  @Get('subscriptions/lifecycle/overview')
  @ApiOperation({ summary: 'Get SaaS subscription lifecycle overview' })
  @RequirePermission('saas:subscription:list')
  subscriptionLifecycleOverview(@User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.platformService.getSubscriptionLifecycleOverview().then((data) => ResultData.ok(data)));
  }
```

Place this route before `subscriptions/:id` so `lifecycle/overview` is not captured as an `id`.

- [ ] **Step 6: Run platform tests**

Run:

```bash
cd server
pnpm run test -- saas-platform.service.spec.ts saas-platform.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit platform lifecycle APIs**

```bash
git add server/src/module/saas/services/saas-platform.service.ts server/src/module/saas/services/saas-platform.service.spec.ts server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-platform.controller.spec.ts
git commit -m "feat: expose SaaS subscription lifecycle APIs"
```

---

### Task 3: Add Tenant Subscription Lifecycle Fields

**Files:**
- Modify: `server/src/module/saas/saas-tenant.controller.ts`
- Modify: `server/src/module/saas/saas-tenant.controller.spec.ts`

**Interfaces:**
- Consumes:
  - `SaasSubscriptionLifecycleService.decorateSubscription()`
- Produces:
  - `GET /api/saas/tenant/subscription` fields `days_until_expiry`, `is_expiring_soon`, `is_expired_by_time`

- [ ] **Step 1: Add failing tenant controller tests**

Modify `server/src/module/saas/saas-tenant.controller.spec.ts`:

Add import:

```ts
import { SaasSubscriptionLifecycleService } from './services/saas-subscription-lifecycle.service';
```

Add mock provider:

```ts
const lifecycleService = {
  decorateSubscription: jest.fn(() => ({
    days_until_expiry: 5,
    is_expiring_soon: true,
    is_expired_by_time: false,
  })),
};
```

Register:

```ts
{ provide: SaasSubscriptionLifecycleService, useValue: lifecycleService },
```

In the existing subscription summary test, extend expected data:

```ts
      days_until_expiry: 5,
      is_expiring_soon: true,
      is_expired_by_time: false,
```

Add assertion:

```ts
expect(lifecycleService.decorateSubscription).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
```

- [ ] **Step 2: Run tenant controller test to see it fail**

Run:

```bash
cd server
pnpm run test -- saas-tenant.controller.spec.ts --runInBand
```

Expected: FAIL because tenant controller does not inject lifecycle service.

- [ ] **Step 3: Implement tenant lifecycle fields**

Modify `server/src/module/saas/saas-tenant.controller.ts`:

Add import:

```ts
import { SaasSubscriptionLifecycleService } from './services/saas-subscription-lifecycle.service';
```

Add constructor param:

```ts
private readonly lifecycleService: SaasSubscriptionLifecycleService,
```

In `subscription()`, before returning:

```ts
    const lifecycleFields = this.lifecycleService.decorateSubscription(subscription);
```

Add to response object:

```ts
      ...lifecycleFields,
```

- [ ] **Step 4: Run tenant test**

Run:

```bash
cd server
pnpm run test -- saas-tenant.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit tenant lifecycle fields**

```bash
git add server/src/module/saas/saas-tenant.controller.ts server/src/module/saas/saas-tenant.controller.spec.ts
git commit -m "feat: add tenant subscription lifecycle fields"
```

---

### Task 4: Add Frontend Lifecycle API Types

**Files:**
- Modify: `web/src/api/saas.ts`

**Interfaces:**
- Produces:
  - `SaasSubscriptionLifecycleOverview`
  - extended `SaasPlatformSubscriptionListParams`
  - extended `SaasPlatformSubscriptionRecord`
  - extended `TenantSubscriptionSummary`
  - `fetchPlatformSubscriptionLifecycleOverview()`

- [ ] **Step 1: Extend API types**

Modify `web/src/api/saas.ts`:

```ts
export interface SaasPlatformSubscriptionListParams extends SaasPlatformListParams {
  plan_id?: number | string
  plan_code?: string
  lifecycle_status?: 'active' | 'expiring' | 'expired' | string
  expires_within_days?: number | string
  expired_since_days?: number | string
}

export interface SaasPlatformSubscriptionRecord {
  id: number
  tenant_id: number
  plan_id: number
  billing_cycle: string
  status: string
  start_time?: string | Date
  end_time?: string | Date
  cancel_at_period_end?: number
  remark?: string
  create_time?: string | Date
  days_until_expiry?: number | null
  is_expiring_soon?: boolean
  is_expired_by_time?: boolean
}

export interface SaasSubscriptionLifecycleOverview {
  active_count: number
  expiring_7_days_count: number
  expiring_30_days_count: number
  expired_count: number
}
```

Extend `TenantSubscriptionSummary`:

```ts
  startTime?: string | number
  start_time?: string | number
  endTime?: string | number
  end_time?: string | number
  daysUntilExpiry?: number | null
  days_until_expiry?: number | null
  isExpiringSoon?: boolean
  is_expiring_soon?: boolean
  isExpiredByTime?: boolean
  is_expired_by_time?: boolean
```

Add function:

```ts
export function fetchPlatformSubscriptionLifecycleOverview() {
  return request.get<SaasSubscriptionLifecycleOverview>({ url: '/api/saas/platform/subscriptions/lifecycle/overview' })
}
```

- [ ] **Step 2: Run frontend typecheck**

Run:

```bash
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit API types**

```bash
git add web/src/api/saas.ts
git commit -m "feat: add SaaS lifecycle frontend API types"
```

---

### Task 5: Enhance Platform Subscription UI

**Files:**
- Modify: `web/src/views/saas/platform/subscription/index.vue`

**Interfaces:**
- Consumes:
  - `fetchPlatformSubscriptionLifecycleOverview()`
  - lifecycle fields on `SaasPlatformSubscriptionRecord`
  - lifecycle list params from Task 4

- [ ] **Step 1: Add imports and state**

Modify imports in `web/src/views/saas/platform/subscription/index.vue`:

```ts
    fetchPlatformSubscriptionLifecycleOverview,
    type SaasSubscriptionLifecycleOverview,
```

Add state:

```ts
  const lifecycleFilter = ref<'all' | 'active' | 'expiring' | 'expired'>('all')
  const lifecycleOverview = ref<SaasSubscriptionLifecycleOverview>({
    active_count: 0,
    expiring_7_days_count: 0,
    expiring_30_days_count: 0,
    expired_count: 0
  })
```

- [ ] **Step 2: Add lifecycle query support**

Add:

```ts
  function buildLifecycleQuery() {
    if (lifecycleFilter.value === 'active') return { lifecycle_status: 'active' }
    if (lifecycleFilter.value === 'expiring') return { lifecycle_status: 'expiring', expires_within_days: 7 }
    if (lifecycleFilter.value === 'expired') return { lifecycle_status: 'expired', expired_since_days: 365 }
    return {}
  }
```

Modify `loadSubscriptions()` call:

```ts
      const result = await fetchPlatformSubscriptions({
        ...buildBaseQuery(subscriptionPager.page, subscriptionPager.limit),
        ...buildLifecycleQuery(),
        plan_id: filters.plan_id || undefined,
        plan_code: filters.plan_code || undefined
      })
```

Add overview loader:

```ts
  async function loadLifecycleOverview() {
    lifecycleOverview.value = await fetchPlatformSubscriptionLifecycleOverview()
  }
```

Call it from `refreshCurrentTab()` and `onMounted()`:

```ts
  onMounted(() => {
    loadLifecycleOverview()
    loadSubscriptions()
  })
```

- [ ] **Step 3: Add summary and quick filters to template**

Add above filters:

```vue
      <div class="saas-platform-page__lifecycle-summary">
        <div class="saas-platform-page__summary-item">
          <span>正常订阅</span>
          <strong>{{ lifecycleOverview.active_count }}</strong>
        </div>
        <div class="saas-platform-page__summary-item">
          <span>7 天内到期</span>
          <strong>{{ lifecycleOverview.expiring_7_days_count }}</strong>
        </div>
        <div class="saas-platform-page__summary-item">
          <span>30 天内到期</span>
          <strong>{{ lifecycleOverview.expiring_30_days_count }}</strong>
        </div>
        <div class="saas-platform-page__summary-item">
          <span>已过期</span>
          <strong>{{ lifecycleOverview.expired_count }}</strong>
        </div>
      </div>
```

Add before `ElTabs`:

```vue
      <ElSegmented
        v-model="lifecycleFilter"
        class="saas-platform-page__lifecycle-filter"
        :options="[
          { label: '全部', value: 'all' },
          { label: '正常', value: 'active' },
          { label: '即将到期', value: 'expiring' },
          { label: '已过期', value: 'expired' }
        ]"
        @change="refreshCurrentTab"
      />
```

- [ ] **Step 4: Add lifecycle table columns and helpers**

Add columns after end time:

```vue
            <ElTableColumn label="剩余天数" width="120">
              <template #default="{ row }">{{ formatRemainingDays(row.days_until_expiry) }}</template>
            </ElTableColumn>
            <ElTableColumn label="生命周期" width="130">
              <template #default="{ row }">
                <ElTag :type="getLifecycleTagType(row)" effect="light">{{ getLifecycleText(row) }}</ElTag>
              </template>
            </ElTableColumn>
```

Add helpers:

```ts
  function formatRemainingDays(value: number | null | undefined) {
    if (value === null || value === undefined) return '-'
    if (value < 0) return `已过期 ${Math.abs(value)} 天`
    if (value === 0) return '今天到期'
    return `${value} 天`
  }

  function getLifecycleText(row: SaasPlatformSubscriptionRecord) {
    if (row.is_expired_by_time || row.status === 'expired') return '已过期'
    if (row.is_expiring_soon) return '即将到期'
    if (row.status === 'active') return '正常'
    return row.status || '-'
  }

  function getLifecycleTagType(row: SaasPlatformSubscriptionRecord) {
    if (row.is_expired_by_time || row.status === 'expired') return 'danger'
    if (row.is_expiring_soon) return 'warning'
    if (row.status === 'active') return 'success'
    return 'info'
  }
```

- [ ] **Step 5: Add styles**

Add scoped CSS:

```css
  .saas-platform-page__lifecycle-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .saas-platform-page__summary-item {
    display: grid;
    gap: 4px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    padding: 14px 16px;
    background: var(--el-bg-color);
  }

  .saas-platform-page__summary-item span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.4;
  }

  .saas-platform-page__summary-item strong {
    font-size: 22px;
    line-height: 1.2;
  }

  .saas-platform-page__lifecycle-filter {
    margin-bottom: 16px;
  }
```

- [ ] **Step 6: Run frontend typecheck**

Run:

```bash
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit platform UI**

```bash
git add web/src/views/saas/platform/subscription/index.vue
git commit -m "feat: add SaaS subscription lifecycle dashboard"
```

---

### Task 6: Enhance Tenant Renewal UI

**Files:**
- Modify: `web/src/views/saas/tenant/plan/index.vue`

**Interfaces:**
- Consumes:
  - lifecycle fields on `TenantSubscriptionSummary`
  - existing `createTenantUpgradeOrder()`

- [ ] **Step 1: Add computed lifecycle fields**

Modify `web/src/views/saas/tenant/plan/index.vue` script:

```ts
  const subscriptionEndTimeText = computed(() => formatDateTime(pickValue(subscriptionInfo.value, ['end_time', 'endTime'])))
  const daysUntilExpiry = computed(() => {
    const value = pickValue(subscriptionInfo.value, ['days_until_expiry', 'daysUntilExpiry'])
    if (value === undefined) return null
    const days = Number(value)
    return Number.isFinite(days) ? days : null
  })
  const isExpiringSoon = computed(() => Boolean(pickValue(subscriptionInfo.value, ['is_expiring_soon', 'isExpiringSoon'])))
  const isExpiredByTime = computed(() => Boolean(pickValue(subscriptionInfo.value, ['is_expired_by_time', 'isExpiredByTime'])))
  const renewalState = computed(() => {
    if (isExpiredByTime.value || String(pickValue(subscriptionInfo.value, ['subscription_status', 'subscriptionStatus', 'status'])).toLowerCase() === 'expired') {
      return { type: 'danger' as const, text: '订阅已过期，请续费或升级套餐' }
    }
    if (isExpiringSoon.value) {
      return { type: 'warning' as const, text: `订阅即将到期，剩余 ${formatRemainingDays(daysUntilExpiry.value)}` }
    }
    return { type: 'success' as const, text: `订阅正常，剩余 ${formatRemainingDays(daysUntilExpiry.value)}` }
  })
```

Add helper:

```ts
  function formatRemainingDays(value: number | null) {
    if (value === null) return '-'
    if (value < 0) return `已过期 ${Math.abs(value)} 天`
    if (value === 0) return '今天到期'
    return `${value} 天`
  }
```

- [ ] **Step 2: Extend subscription summary template**

Inside the summary `ElDescriptions`, add:

```vue
          <ElDescriptionsItem label="订阅结束时间">{{ subscriptionEndTimeText }}</ElDescriptionsItem>
          <ElDescriptionsItem label="剩余时间">
            <ElTag :type="renewalState.type" effect="light">{{ renewalState.text }}</ElTag>
          </ElDescriptionsItem>
```

- [ ] **Step 3: Allow renewal of current paid plan when expiring or expired**

Modify `isPlanOrderDisabled(plan)`:

```ts
  function isCurrentPlanRenewable(plan: SaasPlanOption) {
    return plan.code === currentPlanCode.value && plan.code !== 'free' && getPlanAmount(plan) > 0 && (isExpiringSoon.value || isExpiredByTime.value)
  }

  function isPlanOrderDisabled(plan: SaasPlanOption) {
    if (isCurrentPlanRenewable(plan)) return false
    return plan.code === currentPlanCode.value || plan.code === 'free' || getPlanAmount(plan) <= 0
  }
```

Modify `getPlanButtonText(plan)`:

```ts
    if (isCurrentPlanRenewable(plan)) return '续费当前套餐'
```

Place it before the existing current-plan branch.

- [ ] **Step 4: Run frontend typecheck**

Run:

```bash
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit tenant UI**

```bash
git add web/src/views/saas/tenant/plan/index.vue
git commit -m "feat: add tenant SaaS renewal cues"
```

---

### Task 7: Final Verification and Review

**Files:**
- No planned source edits unless verification finds a defect.

**Interfaces:**
- Consumes all tasks.
- Produces final validated branch state.

- [ ] **Step 1: Run targeted backend tests**

```bash
cd server
pnpm run test -- saas-subscription-lifecycle.service.spec.ts saas-platform.service.spec.ts saas-platform.controller.spec.ts saas-tenant.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run full backend tests**

```bash
cd server
pnpm exec jest --runInBand
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

- [ ] **Step 5: Run diff whitespace check**

```bash
git diff --check HEAD~6..HEAD
```

Expected: no output.

- [ ] **Step 6: Runtime smoke**

Ensure local dependencies are running:

```powershell
Get-NetTCPConnection -LocalPort 3306 -State Listen
redis-cli -h 127.0.0.1 -p 6379 PING
```

Start services if needed:

```powershell
cd E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-foundation-phase1\server
pnpm run dev:node
```

Probe API:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/api/saas/platform/subscriptions/lifecycle/overview'
```

Expected without login: HTTP 200 with app-level `403 请重新登录`, proving route exists and auth applies.

- [ ] **Step 7: Review git status**

```bash
git status --short --untracked-files=all
```

Expected tracked source clean after commits. Untracked `sdd/*` and `web/tmp-frontend-5731.*.log` may remain and must not be committed.

- [ ] **Step 8: Commit fixes only if verification required changes**

If a small verification fix was needed:

```bash
git add <changed-source-files>
git commit -m "fix: stabilize SaaS subscription lifecycle"
```

Do not commit runtime logs or unrelated `sdd/*` files.

