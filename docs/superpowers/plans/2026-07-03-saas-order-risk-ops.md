# SaaS Order Risk Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add timeout closing, tenant cancellation, and platform risk visibility for unpaid SaaS plan and resource-pack orders.

**Architecture:** Extend the existing SaaS module instead of adding a new billing subsystem. Store close metadata on the existing plan-order and resource-pack-order tables, put shared close rules in one focused `SaasOrderRiskService`, then expose small tenant/platform APIs and enhance existing SaaS pages.

**Tech Stack:** NestJS 11, TypeORM, MySQL migrations, Jest, Vue 3, Element Plus, TypeScript, pnpm.

---

## Global Constraints

- Do not implement invoices, refunds, recurring payments, SMS, email, coupons, or reconciliation.
- Keep statuses as `pending`, `paid`, and `closed`; use `close_reason` for why an order closed.
- Default pending timeout is 120 minutes.
- Closed orders must remain non-payable through dev confirmation and Alipay notify.
- Treat `server/.env` and `server/pnpm-lock.yaml` as local noise unless the user explicitly asks to handle them.
- Use TDD for backend service, controller, and migration work.
- Commit after each completed task.

## File Structure

- Modify `server/src/module/saas/constants.ts`: add close-reason and timeout constants.
- Modify `server/src/module/saas/entities/saas-order.entity.ts`: add `closedAt` and `closeReason`.
- Modify `server/src/module/saas/entities/saas-resource-pack-order.entity.ts`: add `closedAt` and `closeReason`.
- Create `server/src/migrations/1760000000013-AddSaasOrderCloseMetadata.ts`: add close columns and indexes.
- Create `server/src/migration-specs/add-saas-order-close-metadata.spec.ts`: migration assertions.
- Create `server/src/module/saas/services/saas-order-risk.service.ts`: timeout close, tenant cancel, overview, response decorators, task target.
- Create `server/src/module/saas/services/saas-order-risk.service.spec.ts`: close and overview tests.
- Modify `server/src/module/saas/saas.module.ts`: register/export risk service.
- Modify `server/src/module/saas/services/saas-order.service.ts`: list tenant plan orders, list platform filters, response close metadata.
- Modify `server/src/module/saas/services/saas-order.service.spec.ts`: tenant list and platform filter tests.
- Modify `server/src/module/saas/services/saas-resource-pack-order.service.ts`: close metadata response and filters.
- Modify `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`: response and filter tests.
- Modify `server/src/module/saas/services/saas-platform.service.ts`: risk overview delegation, plan-order filters.
- Modify `server/src/module/saas/services/saas-platform.service.spec.ts`: platform delegation and response tests.
- Modify `server/src/module/saas/saas-tenant.controller.ts`: tenant plan order list/cancel and resource-pack cancel routes.
- Modify `server/src/module/saas/saas-tenant.controller.spec.ts`: tenant route tests.
- Modify `server/src/module/saas/saas-platform.controller.ts`: platform risk overview route.
- Modify `server/src/module/saas/saas-platform.controller.spec.ts`: platform route test.
- Modify `web/src/api/saas.ts`: API types and wrappers for risk overview, plan order list, and cancel actions.
- Modify `web/src/views/saas/platform/subscription/index.vue`: order risk summary and close metadata.
- Modify `web/src/views/saas/tenant/plan/index.vue`: tenant plan-order history, continue pay, cancel action.
- Modify `web/src/views/saas/tenant/resource-pack/index.vue`: cancel pending resource-pack orders and close metadata.
- Modify `web/src/views/saas/platform/resource-pack-order/index.vue`: close metadata and timeout-closed filter.

---

## Task 1: Add Close Metadata Schema

**Files:**
- Modify: `server/src/module/saas/constants.ts`
- Modify: `server/src/module/saas/entities/saas-order.entity.ts`
- Modify: `server/src/module/saas/entities/saas-resource-pack-order.entity.ts`
- Create: `server/src/migrations/1760000000013-AddSaasOrderCloseMetadata.ts`
- Create: `server/src/migration-specs/add-saas-order-close-metadata.spec.ts`

**Interfaces:**
- Produces constants:
  - `SAAS_ORDER_CLOSE_REASON_TIMEOUT`
  - `SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED`
  - `SAAS_ORDER_PENDING_TIMEOUT_MINUTES`
- Produces nullable order fields:
  - `closedAt?: Date`
  - `closeReason?: string`

- [ ] **Step 1: Write failing migration spec**

Create `server/src/migration-specs/add-saas-order-close-metadata.spec.ts`:

```ts
import { AddSaasOrderCloseMetadata1760000000013 } from '../migrations/1760000000013-AddSaasOrderCloseMetadata';

describe('AddSaasOrderCloseMetadata1760000000013', () => {
  it('adds close metadata columns and indexes to both SaaS order tables', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new AddSaasOrderCloseMetadata1760000000013().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');

    expect(sql).toContain('ALTER TABLE `saas_order` ADD COLUMN `closed_at`');
    expect(sql).toContain('ALTER TABLE `saas_order` ADD COLUMN `close_reason`');
    expect(sql).toContain('ALTER TABLE `saas_resource_pack_order` ADD COLUMN `closed_at`');
    expect(sql).toContain('ALTER TABLE `saas_resource_pack_order` ADD COLUMN `close_reason`');
    expect(sql).toContain('idx_saas_order_status_create_time');
    expect(sql).toContain('idx_saas_order_status_close_reason');
    expect(sql).toContain('idx_saas_resource_pack_order_status_create_time');
    expect(sql).toContain('idx_saas_resource_pack_order_status_close_reason');
  });
});
```

- [ ] **Step 2: Run migration spec to verify it fails**

Run:

```powershell
cd server
pnpm run test -- add-saas-order-close-metadata.spec.ts --runInBand
```

Expected: FAIL with module not found for `1760000000013-AddSaasOrderCloseMetadata`.

- [ ] **Step 3: Implement migration**

Create `server/src/migrations/1760000000013-AddSaasOrderCloseMetadata.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaasOrderCloseMetadata1760000000013 implements MigrationInterface {
  name = 'AddSaasOrderCloseMetadata1760000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `saas_order` ADD COLUMN `closed_at` datetime NULL');
    await queryRunner.query('ALTER TABLE `saas_order` ADD COLUMN `close_reason` varchar(50) NULL');
    await queryRunner.query('CREATE INDEX `idx_saas_order_status_create_time` ON `saas_order` (`status`, `create_time`)');
    await queryRunner.query('CREATE INDEX `idx_saas_order_status_close_reason` ON `saas_order` (`status`, `close_reason`)');

    await queryRunner.query('ALTER TABLE `saas_resource_pack_order` ADD COLUMN `closed_at` datetime NULL');
    await queryRunner.query('ALTER TABLE `saas_resource_pack_order` ADD COLUMN `close_reason` varchar(50) NULL');
    await queryRunner.query(
      'CREATE INDEX `idx_saas_resource_pack_order_status_create_time` ON `saas_resource_pack_order` (`status`, `create_time`)',
    );
    await queryRunner.query(
      'CREATE INDEX `idx_saas_resource_pack_order_status_close_reason` ON `saas_resource_pack_order` (`status`, `close_reason`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX `idx_saas_resource_pack_order_status_close_reason` ON `saas_resource_pack_order`');
    await queryRunner.query('DROP INDEX `idx_saas_resource_pack_order_status_create_time` ON `saas_resource_pack_order`');
    await queryRunner.query('ALTER TABLE `saas_resource_pack_order` DROP COLUMN `close_reason`');
    await queryRunner.query('ALTER TABLE `saas_resource_pack_order` DROP COLUMN `closed_at`');

    await queryRunner.query('DROP INDEX `idx_saas_order_status_close_reason` ON `saas_order`');
    await queryRunner.query('DROP INDEX `idx_saas_order_status_create_time` ON `saas_order`');
    await queryRunner.query('ALTER TABLE `saas_order` DROP COLUMN `close_reason`');
    await queryRunner.query('ALTER TABLE `saas_order` DROP COLUMN `closed_at`');
  }
}
```

- [ ] **Step 4: Add constants and entity fields**

Modify `server/src/module/saas/constants.ts` after `SAAS_ORDER_CLOSED`:

```ts
export const SAAS_ORDER_CLOSE_REASON_TIMEOUT = 'timeout';
export const SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED = 'tenant_cancelled';
export const SAAS_ORDER_PENDING_TIMEOUT_MINUTES = 120;
```

Add to `server/src/module/saas/entities/saas-order.entity.ts` after `paidAt`:

```ts
@Column({ type: 'datetime', name: 'closed_at', nullable: true })
closedAt?: Date;

@Column({ type: 'varchar', name: 'close_reason', length: 50, nullable: true })
closeReason?: string;
```

Add the same two fields to `server/src/module/saas/entities/saas-resource-pack-order.entity.ts` after `deliveredAt`.

- [ ] **Step 5: Run migration spec**

Run:

```powershell
cd server
pnpm run test -- add-saas-order-close-metadata.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit schema task**

Run:

```powershell
git add server/src/module/saas/constants.ts server/src/module/saas/entities/saas-order.entity.ts server/src/module/saas/entities/saas-resource-pack-order.entity.ts server/src/migrations/1760000000013-AddSaasOrderCloseMetadata.ts server/src/migration-specs/add-saas-order-close-metadata.spec.ts
git commit -m "feat: add SaaS order close metadata"
```

---

## Task 2: Add Order Risk Service

**Files:**
- Create: `server/src/module/saas/services/saas-order-risk.service.ts`
- Create: `server/src/module/saas/services/saas-order-risk.service.spec.ts`
- Modify: `server/src/module/saas/saas.module.ts`

**Interfaces:**
- Produces `SaasOrderRiskService`
- Produces `closeExpiredPendingOrders(now?, timeoutMinutes?)`
- Produces `closeTenantPlanOrder(tenantId, orderNo, now?)`
- Produces `closeTenantResourcePackOrder(tenantId, orderNo, now?)`
- Produces `getOrderRiskOverview(now?)`
- Produces task target `saas.orderRisk.closeExpiredPendingOrders`

- [ ] **Step 1: Write failing service tests**

Create `server/src/module/saas/services/saas-order-risk.service.spec.ts`:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import {
  SAAS_ORDER_CLOSED,
  SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
  SAAS_ORDER_CLOSE_REASON_TIMEOUT,
  SAAS_ORDER_PAID,
  SAAS_ORDER_PENDING,
} from '../constants';
import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasOrderRiskService } from './saas-order-risk.service';

describe('SaasOrderRiskService', () => {
  let service: SaasOrderRiskService;

  const planOrderRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };
  const resourcePackOrderRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasOrderRiskService,
        { provide: getRepositoryToken(SaasOrderEntity), useValue: planOrderRepo },
        { provide: getRepositoryToken(SaasResourcePackOrderEntity), useValue: resourcePackOrderRepo },
      ],
    }).compile();

    service = module.get(SaasOrderRiskService);
  });

  it('closes stale pending plan and resource-pack orders', async () => {
    const now = new Date('2026-07-03T12:00:00.000Z');
    const cutoff = new Date('2026-07-03T10:00:00.000Z');
    planOrderRepo.find.mockResolvedValue([{ orderNo: 'SO1' }, { orderNo: 'SO2' }]);
    resourcePackOrderRepo.find.mockResolvedValue([{ orderNo: 'RPO1' }]);
    planOrderRepo.update.mockResolvedValue({ affected: 2 });
    resourcePackOrderRepo.update.mockResolvedValue({ affected: 1 });

    await expect(service.closeExpiredPendingOrders(now, 120)).resolves.toEqual({
      checked_at: now,
      timeout_minutes: 120,
      closed_plan_order_count: 2,
      closed_resource_pack_order_count: 1,
      closed_plan_order_nos: ['SO1', 'SO2'],
      closed_resource_pack_order_nos: ['RPO1'],
    });

    expect(planOrderRepo.find).toHaveBeenCalledWith({
      where: { status: SAAS_ORDER_PENDING, createTime: LessThanOrEqual(cutoff) },
      select: ['orderNo'],
    });
    expect(planOrderRepo.update).toHaveBeenCalledWith(
      { orderNo: expect.any(Object), status: SAAS_ORDER_PENDING },
      { status: SAAS_ORDER_CLOSED, closedAt: now, closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT },
    );
  });

  it('does not update when no stale pending orders exist', async () => {
    const now = new Date('2026-07-03T12:00:00.000Z');
    planOrderRepo.find.mockResolvedValue([]);
    resourcePackOrderRepo.find.mockResolvedValue([]);

    await expect(service.closeExpiredPendingOrders(now)).resolves.toMatchObject({
      closed_plan_order_count: 0,
      closed_resource_pack_order_count: 0,
    });
    expect(planOrderRepo.update).not.toHaveBeenCalled();
    expect(resourcePackOrderRepo.update).not.toHaveBeenCalled();
  });

  it('closes a tenant pending plan order', async () => {
    const now = new Date('2026-07-03T12:00:00.000Z');
    const order = { orderNo: 'SO1', tenantId: 12, status: SAAS_ORDER_PENDING };
    planOrderRepo.findOne.mockResolvedValue(order);
    planOrderRepo.save.mockImplementation(async (value) => value);

    await expect(service.closeTenantPlanOrder(12, 'SO1', now)).resolves.toMatchObject({
      status: SAAS_ORDER_CLOSED,
      closedAt: now,
      closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
    });
  });

  it('returns already closed tenant orders idempotently', async () => {
    const order = {
      orderNo: 'SO1',
      tenantId: 12,
      status: SAAS_ORDER_CLOSED,
      closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
    };
    planOrderRepo.findOne.mockResolvedValue(order);

    await expect(service.closeTenantPlanOrder(12, 'SO1')).resolves.toBe(order);
    expect(planOrderRepo.save).not.toHaveBeenCalled();
  });

  it('rejects tenant cancellation for paid orders', async () => {
    planOrderRepo.findOne.mockResolvedValue({ orderNo: 'SO1', tenantId: 12, status: SAAS_ORDER_PAID });

    await expect(service.closeTenantPlanOrder(12, 'SO1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found for another tenant plan order', async () => {
    planOrderRepo.findOne.mockResolvedValue(null);

    await expect(service.closeTenantPlanOrder(12, 'SO1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('closes a tenant pending resource-pack order', async () => {
    const now = new Date('2026-07-03T12:00:00.000Z');
    const order = { orderNo: 'RPO1', tenantId: 12, status: SAAS_ORDER_PENDING };
    resourcePackOrderRepo.findOne.mockResolvedValue(order);
    resourcePackOrderRepo.save.mockImplementation(async (value) => value);

    await expect(service.closeTenantResourcePackOrder(12, 'RPO1', now)).resolves.toMatchObject({
      status: SAAS_ORDER_CLOSED,
      closedAt: now,
      closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
    });
  });

  it('calculates risk overview counts', async () => {
    const now = new Date('2026-07-03T12:00:00.000Z');
    planOrderRepo.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    resourcePackOrderRepo.count.mockResolvedValueOnce(3).mockResolvedValueOnce(5).mockResolvedValueOnce(6);

    await expect(service.getOrderRiskOverview(now)).resolves.toEqual({
      pending_plan_orders: 4,
      pending_resource_pack_orders: 3,
      timeout_closed_plan_orders_7d: 2,
      timeout_closed_resource_pack_orders_7d: 5,
      tenant_cancelled_plan_orders_7d: 1,
      tenant_cancelled_resource_pack_orders_7d: 6,
    });

    expect(planOrderRepo.count).toHaveBeenNthCalledWith(2, {
      where: {
        status: SAAS_ORDER_CLOSED,
        closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT,
        closedAt: MoreThanOrEqual(new Date('2026-06-26T12:00:00.000Z')),
      },
    });
  });
});
```

- [ ] **Step 2: Run service tests to verify they fail**

Run:

```powershell
cd server
pnpm run test -- saas-order-risk.service.spec.ts --runInBand
```

Expected: FAIL with module not found for `saas-order-risk.service`.

- [ ] **Step 3: Implement risk service**

Create `server/src/module/saas/services/saas-order-risk.service.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

import { Task } from '../../../common/decorators/task.decorator';
import {
  SAAS_ORDER_CLOSED,
  SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
  SAAS_ORDER_CLOSE_REASON_TIMEOUT,
  SAAS_ORDER_PAID,
  SAAS_ORDER_PENDING,
  SAAS_ORDER_PENDING_TIMEOUT_MINUTES,
} from '../constants';
import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';

export interface CloseExpiredPendingOrdersResult {
  checked_at: Date;
  timeout_minutes: number;
  closed_plan_order_count: number;
  closed_resource_pack_order_count: number;
  closed_plan_order_nos: string[];
  closed_resource_pack_order_nos: string[];
}

export interface OrderRiskOverview {
  pending_plan_orders: number;
  pending_resource_pack_orders: number;
  timeout_closed_plan_orders_7d: number;
  timeout_closed_resource_pack_orders_7d: number;
  tenant_cancelled_plan_orders_7d: number;
  tenant_cancelled_resource_pack_orders_7d: number;
}

@Injectable()
export class SaasOrderRiskService {
  constructor(
    @InjectRepository(SaasOrderEntity)
    private readonly planOrderRepo: Repository<SaasOrderEntity>,
    @InjectRepository(SaasResourcePackOrderEntity)
    private readonly resourcePackOrderRepo: Repository<SaasResourcePackOrderEntity>,
  ) {}

  async closeExpiredPendingOrders(
    now = new Date(),
    timeoutMinutes = SAAS_ORDER_PENDING_TIMEOUT_MINUTES,
  ): Promise<CloseExpiredPendingOrdersResult> {
    const cutoff = this.subtractMinutes(now, timeoutMinutes);
    const [planOrders, resourcePackOrders] = await Promise.all([
      this.planOrderRepo.find({
        where: { status: SAAS_ORDER_PENDING, createTime: LessThanOrEqual(cutoff) },
        select: ['orderNo'],
      }),
      this.resourcePackOrderRepo.find({
        where: { status: SAAS_ORDER_PENDING, createTime: LessThanOrEqual(cutoff) },
        select: ['orderNo'],
      }),
    ]);
    const planOrderNos = planOrders.map((order) => order.orderNo).filter(Boolean);
    const resourcePackOrderNos = resourcePackOrders.map((order) => order.orderNo).filter(Boolean);

    if (planOrderNos.length > 0) {
      await this.planOrderRepo.update(
        { orderNo: In(planOrderNos), status: SAAS_ORDER_PENDING },
        { status: SAAS_ORDER_CLOSED, closedAt: now, closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT },
      );
    }
    if (resourcePackOrderNos.length > 0) {
      await this.resourcePackOrderRepo.update(
        { orderNo: In(resourcePackOrderNos), status: SAAS_ORDER_PENDING },
        { status: SAAS_ORDER_CLOSED, closedAt: now, closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT },
      );
    }

    return {
      checked_at: now,
      timeout_minutes: timeoutMinutes,
      closed_plan_order_count: planOrderNos.length,
      closed_resource_pack_order_count: resourcePackOrderNos.length,
      closed_plan_order_nos: planOrderNos,
      closed_resource_pack_order_nos: resourcePackOrderNos,
    };
  }

  async closeTenantPlanOrder(tenantId: number, orderNo: string, now = new Date()): Promise<SaasOrderEntity> {
    const order = await this.planOrderRepo.findOne({ where: { tenantId, orderNo } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === SAAS_ORDER_CLOSED) return order;
    if (order.status === SAAS_ORDER_PAID) throw new BadRequestException('Paid orders cannot be cancelled');

    order.status = SAAS_ORDER_CLOSED;
    order.closedAt = now;
    order.closeReason = SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED;
    return this.planOrderRepo.save(order);
  }

  async closeTenantResourcePackOrder(
    tenantId: number,
    orderNo: string,
    now = new Date(),
  ): Promise<SaasResourcePackOrderEntity> {
    const order = await this.resourcePackOrderRepo.findOne({ where: { tenantId, orderNo } });
    if (!order) throw new NotFoundException('Resource pack order not found');
    if (order.status === SAAS_ORDER_CLOSED) return order;
    if (order.status === SAAS_ORDER_PAID) throw new BadRequestException('Paid orders cannot be cancelled');

    order.status = SAAS_ORDER_CLOSED;
    order.closedAt = now;
    order.closeReason = SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED;
    return this.resourcePackOrderRepo.save(order);
  }

  async getOrderRiskOverview(now = new Date()): Promise<OrderRiskOverview> {
    const since = this.subtractDays(now, 7);
    const [pendingPlan, pendingResourcePack, timeoutPlan, timeoutResourcePack, cancelledPlan, cancelledResourcePack] =
      await Promise.all([
        this.planOrderRepo.count({ where: { status: SAAS_ORDER_PENDING } }),
        this.resourcePackOrderRepo.count({ where: { status: SAAS_ORDER_PENDING } }),
        this.planOrderRepo.count({
          where: { status: SAAS_ORDER_CLOSED, closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT, closedAt: MoreThanOrEqual(since) },
        }),
        this.resourcePackOrderRepo.count({
          where: { status: SAAS_ORDER_CLOSED, closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT, closedAt: MoreThanOrEqual(since) },
        }),
        this.planOrderRepo.count({
          where: {
            status: SAAS_ORDER_CLOSED,
            closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
            closedAt: MoreThanOrEqual(since),
          },
        }),
        this.resourcePackOrderRepo.count({
          where: {
            status: SAAS_ORDER_CLOSED,
            closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
            closedAt: MoreThanOrEqual(since),
          },
        }),
      ]);

    return {
      pending_plan_orders: pendingPlan,
      pending_resource_pack_orders: pendingResourcePack,
      timeout_closed_plan_orders_7d: timeoutPlan,
      timeout_closed_resource_pack_orders_7d: timeoutResourcePack,
      tenant_cancelled_plan_orders_7d: cancelledPlan,
      tenant_cancelled_resource_pack_orders_7d: cancelledResourcePack,
    };
  }

  decoratePlanOrder(order: Partial<SaasOrderEntity>) {
    return {
      closed_at: order.closedAt ?? null,
      close_reason: order.closeReason ?? null,
    };
  }

  decorateResourcePackOrder(order: Partial<SaasResourcePackOrderEntity>) {
    return {
      closed_at: order.closedAt ?? null,
      close_reason: order.closeReason ?? null,
    };
  }

  @Task({
    name: 'saas.orderRisk.closeExpiredPendingOrders',
    description: 'Close stale pending SaaS orders',
  })
  closeExpiredPendingOrdersTask() {
    return this.closeExpiredPendingOrders();
  }

  private subtractMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() - minutes * 60_000);
  }

  private subtractDays(date: Date, days: number): Date {
    return new Date(date.getTime() - days * 86_400_000);
  }
}
```

- [ ] **Step 4: Register risk service in module**

Modify `server/src/module/saas/saas.module.ts`:

```ts
import { SaasOrderRiskService } from './services/saas-order-risk.service';
```

Add `SaasOrderRiskService` to `providers` and `exports`.

- [ ] **Step 5: Run risk service tests**

Run:

```powershell
cd server
pnpm run test -- saas-order-risk.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit risk service**

Run:

```powershell
git add server/src/module/saas/services/saas-order-risk.service.ts server/src/module/saas/services/saas-order-risk.service.spec.ts server/src/module/saas/saas.module.ts
git commit -m "feat: add SaaS order risk service"
```

---

## Task 3: Add Backend Order APIs And Response Metadata

**Files:**
- Modify: `server/src/module/saas/services/saas-order.service.ts`
- Modify: `server/src/module/saas/services/saas-order.service.spec.ts`
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.ts`
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.spec.ts`
- Modify: `server/src/module/saas/saas-tenant.controller.ts`
- Modify: `server/src/module/saas/saas-tenant.controller.spec.ts`
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`

**Interfaces:**
- Produces `GET /api/saas/tenant/orders`
- Produces `POST /api/saas/tenant/orders/:order_no/cancel`
- Produces `POST /api/saas/tenant/resource-pack-orders/:order_no/cancel`
- Produces `GET /api/saas/platform/orders/risk/overview`
- Extends order filters with `order_no` and `close_reason`

- [ ] **Step 1: Add order service tests**

Add tests to `server/src/module/saas/services/saas-order.service.spec.ts`:

```ts
it('lists tenant plan orders scoped to the current tenant', async () => {
  orderRepo.findAndCount.mockResolvedValue([
    [{ orderNo: 'SO1', tenantId: 12, planCode: 'pro', status: 'pending', closeReason: null }],
    1,
  ]);

  await expect(service.listTenantOrders(12, { status: 'pending', order_no: 'SO1' } as any)).resolves.toMatchObject({
    total: 1,
    page: 1,
    limit: 20,
  });

  expect(orderRepo.findAndCount).toHaveBeenCalledWith({
    where: { tenantId: 12, status: 'pending', orderNo: 'SO1' },
    order: { createTime: 'DESC', id: 'DESC' },
    skip: 0,
    take: 20,
  });
});

it('includes close metadata in order responses', () => {
  const closedAt = new Date('2026-07-03T12:00:00.000Z');

  expect(service.toResponse({ orderNo: 'SO1', status: 'closed', closedAt, closeReason: 'timeout' } as any)).toMatchObject({
    order_no: 'SO1',
    status: 'closed',
    closed_at: closedAt,
    close_reason: 'timeout',
  });
});
```

- [ ] **Step 2: Add resource-pack order service tests**

Add tests to `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`:

```ts
it('filters platform resource pack orders by close reason', async () => {
  orderRepo.findAndCount.mockResolvedValue([[{ orderNo: 'RPO1', status: 'closed', closeReason: 'timeout' }], 1]);

  await service.listPlatformOrders({ status: 'closed', close_reason: 'timeout' } as any);

  expect(orderRepo.findAndCount).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ status: 'closed', closeReason: 'timeout' }),
    }),
  );
});

it('includes close metadata in resource pack order responses', () => {
  const closedAt = new Date('2026-07-03T12:00:00.000Z');

  expect(service.toResponse({ orderNo: 'RPO1', status: 'closed', closedAt, closeReason: 'tenant_cancelled' } as any)).toMatchObject({
    order_no: 'RPO1',
    status: 'closed',
    closed_at: closedAt,
    close_reason: 'tenant_cancelled',
  });
});
```

- [ ] **Step 3: Add controller and platform tests**

In `server/src/module/saas/saas-tenant.controller.spec.ts`, add:

```ts
it('lists current tenant plan orders', async () => {
  orderService.listTenantOrders.mockResolvedValue({ list: [{ order_no: 'SO1' }], total: 1, page: 1, limit: 20 });

  const result = await controller.orders({ status: 'pending' } as any);

  expect(result.data).toEqual({ list: [{ order_no: 'SO1' }], total: 1, page: 1, limit: 20 });
  expect(orderService.listTenantOrders).toHaveBeenCalledWith(12, { status: 'pending' });
});

it('cancels a current tenant plan order', async () => {
  orderRiskService.closeTenantPlanOrder.mockResolvedValue({ orderNo: 'SO1', status: 'closed' });

  const result = await controller.cancelOrder('SO1');

  expect(result.data).toMatchObject({ order_no: 'SO1', status: 'closed' });
  expect(orderRiskService.closeTenantPlanOrder).toHaveBeenCalledWith(12, 'SO1');
});

it('cancels a current tenant resource pack order', async () => {
  orderRiskService.closeTenantResourcePackOrder.mockResolvedValue({ orderNo: 'RPO1', status: 'closed' });
  resourcePackOrderService.toResponse.mockReturnValue({ order_no: 'RPO1', status: 'closed' });

  const result = await controller.cancelResourcePackOrder('RPO1');

  expect(result.data).toEqual({ order_no: 'RPO1', status: 'closed' });
  expect(orderRiskService.closeTenantResourcePackOrder).toHaveBeenCalledWith(12, 'RPO1');
});
```

In `server/src/module/saas/services/saas-platform.service.spec.ts`, add:

```ts
it('delegates order risk overview to the risk service', async () => {
  orderRiskService.getOrderRiskOverview.mockResolvedValue({ pending_plan_orders: 1 });

  await expect(service.getOrderRiskOverview()).resolves.toEqual({ pending_plan_orders: 1 });
});
```

In `server/src/module/saas/saas-platform.controller.spec.ts`, add:

```ts
it('returns SaaS order risk overview outside tenant scope', async () => {
  platformService.getOrderRiskOverview.mockResolvedValue({
    pending_plan_orders: 1,
    pending_resource_pack_orders: 2,
    timeout_closed_plan_orders_7d: 3,
    timeout_closed_resource_pack_orders_7d: 4,
    tenant_cancelled_plan_orders_7d: 5,
    tenant_cancelled_resource_pack_orders_7d: 6,
  });

  const result = await controller.orderRiskOverview({ userId: 1 } as any);

  expect(result.data.pending_plan_orders).toBe(1);
  expect(platformService.getOrderRiskOverview).toHaveBeenCalled();
});
```

- [ ] **Step 4: Run tests to verify failures**

Run:

```powershell
cd server
pnpm run test -- saas-order.service.spec.ts saas-resource-pack-order.service.spec.ts saas-tenant.controller.spec.ts saas-platform.service.spec.ts saas-platform.controller.spec.ts --runInBand
```

Expected: FAIL because APIs and methods are not implemented yet.

- [ ] **Step 5: Implement service methods and response metadata**

Modify `server/src/module/saas/services/saas-order.service.ts`:

```ts
import { FindOptionsWhere, Repository } from 'typeorm';

export interface SaasOrderListQuery {
  page?: string | number;
  limit?: string | number;
  tenant_id?: string | number;
  order_no?: string;
  plan_code?: string;
  status?: string;
  close_reason?: string;
}
```

Add public methods:

```ts
async listTenantOrders(tenantId: number, query: SaasOrderListQuery = {}) {
  const { page, limit, skip } = this.resolvePagination(query);
  const where: FindOptionsWhere<SaasOrderEntity> = { tenantId };
  if (query.order_no) where.orderNo = query.order_no;
  if (query.plan_code) where.planCode = query.plan_code;
  if (query.status) where.status = query.status;
  if (query.close_reason) where.closeReason = query.close_reason;

  const [list, total] = await this.saasOrderRepo.findAndCount({
    where,
    order: { createTime: 'DESC', id: 'DESC' },
    skip,
    take: limit,
  });

  return { list: list.map((order) => this.toResponse(order)), total, page, limit };
}

async listPlatformOrders(query: SaasOrderListQuery = {}) {
  const { page, limit, skip } = this.resolvePagination(query);
  const where: FindOptionsWhere<SaasOrderEntity> = {};
  const tenantId = this.resolvePositiveNumber(query.tenant_id);
  if (tenantId !== undefined) where.tenantId = tenantId;
  if (query.order_no) where.orderNo = query.order_no;
  if (query.plan_code) where.planCode = query.plan_code;
  if (query.status) where.status = query.status;
  if (query.close_reason) where.closeReason = query.close_reason;

  const [list, total] = await this.saasOrderRepo.findAndCount({
    where,
    order: { createTime: 'DESC', id: 'DESC' },
    skip,
    take: limit,
  });

  return { list: list.map((order) => this.toResponse(order)), total, page, limit };
}

async findPlatformOrder(orderNo: string) {
  const order = await this.saasOrderRepo.findOne({ where: { orderNo } });
  return order ? this.toResponse(order) : null;
}

toResponse(order: Partial<SaasOrderEntity>) {
  return {
    order_no: order.orderNo,
    tenant_id: order.tenantId,
    plan_id: order.planId,
    plan_code: order.planCode,
    billing_cycle: order.billingCycle,
    amount_cents: Number(order.amountCents) || 0,
    currency: order.currency,
    payment_method: order.paymentMethod,
    status: order.status,
    alipay_trade_no: order.alipayTradeNo,
    paid_at: order.paidAt,
    closed_at: order.closedAt ?? null,
    close_reason: order.closeReason ?? null,
    create_time: order.createTime,
  };
}
```

Add private helpers:

```ts
private resolvePagination(query: SaasOrderListQuery) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  return { page, limit, skip: (page - 1) * limit };
}

private resolvePositiveNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}
```

Modify `server/src/module/saas/services/saas-resource-pack-order.service.ts`:

```ts
export interface SaasResourcePackOrderListQuery {
  page?: string | number;
  limit?: string | number;
  tenant_id?: string | number;
  order_no?: string;
  resource_pack_code?: string;
  resource_type?: string;
  status?: string;
  close_reason?: string;
}
```

In `listTenantOrders` and `listPlatformOrders`, add:

```ts
if (query.close_reason) {
  where.closeReason = query.close_reason;
}
```

In `toResponse`, add:

```ts
closed_at: order.closedAt ?? null,
close_reason: order.closeReason ?? null,
```

- [ ] **Step 6: Implement controllers and platform delegation**

Modify `server/src/module/saas/services/saas-platform.service.ts`:

```ts
import { SaasOrderRiskService } from './saas-order-risk.service';
import type { SaasOrderListQuery } from './saas-order.service';
```

Inject `private readonly orderRiskService: SaasOrderRiskService`.

Update order methods:

```ts
listOrders(query: SaasOrderListQuery = {}) {
  return this.orderService.listPlatformOrders(query);
}

findOrder(orderNo: string) {
  return this.orderService.findPlatformOrder(orderNo);
}

getOrderRiskOverview() {
  return this.orderRiskService.getOrderRiskOverview();
}
```

Modify `server/src/module/saas/saas-tenant.controller.ts`:

```ts
import type { SaasOrderListQuery } from './services/saas-order.service';
import { SaasOrderRiskService } from './services/saas-order-risk.service';
```

Inject `private readonly orderRiskService: SaasOrderRiskService`.

Add before `@Get('orders/:order_no')`:

```ts
@Get('orders')
@ApiOperation({ summary: 'List current tenant SaaS plan orders' })
async orders(@Query() query: SaasOrderListQuery) {
  const tenantId = getTenantId();
  if (!tenantId) {
    return ResultData.fail(401, 'Tenant context is required');
  }

  return ResultData.ok(await this.saasOrderService.listTenantOrders(tenantId, query));
}

@Post('orders/:order_no/cancel')
@ApiOperation({ summary: 'Cancel current tenant SaaS plan order' })
async cancelOrder(@Param('order_no') orderNo: string) {
  const tenantId = getTenantId();
  if (!tenantId) {
    return ResultData.fail(401, 'Tenant context is required');
  }

  return ResultData.ok(this.saasOrderService.toResponse(await this.orderRiskService.closeTenantPlanOrder(tenantId, orderNo)));
}
```

Add before `@Get('resource-pack-orders/:order_no')`:

```ts
@Post('resource-pack-orders/:order_no/cancel')
@ApiOperation({ summary: 'Cancel current tenant SaaS resource pack order' })
async cancelResourcePackOrder(@Param('order_no') orderNo: string) {
  const tenantId = getTenantId();
  if (!tenantId) {
    return ResultData.fail(401, 'Tenant context is required');
  }

  return ResultData.ok(
    this.saasResourcePackOrderService.toResponse(
      await this.orderRiskService.closeTenantResourcePackOrder(tenantId, orderNo),
    ),
  );
}
```

Modify private `toOrderResponse` by either removing it in favor of `this.saasOrderService.toResponse(order)` or adding:

```ts
closed_at: order.closedAt ?? null,
close_reason: order.closeReason ?? null,
create_time: order.createTime,
```

Modify `server/src/module/saas/saas-platform.controller.ts` before `@Get('orders/:order_no')`:

```ts
@Get('orders/risk/overview')
@ApiOperation({ summary: 'Get SaaS order risk overview' })
@RequirePermission('saas:order:list')
orderRiskOverview(@User() user: UserDto) {
  return this.runOutsideTenant(user, () => this.platformService.getOrderRiskOverview().then((data) => ResultData.ok(data)));
}
```

Place the static route before `orders/:order_no`.

- [ ] **Step 7: Run backend API tests**

Run:

```powershell
cd server
pnpm run test -- saas-order.service.spec.ts saas-resource-pack-order.service.spec.ts saas-tenant.controller.spec.ts saas-platform.service.spec.ts saas-platform.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit backend API task**

Run:

```powershell
git add server/src/module/saas/services/saas-order.service.ts server/src/module/saas/services/saas-order.service.spec.ts server/src/module/saas/services/saas-resource-pack-order.service.ts server/src/module/saas/services/saas-resource-pack-order.service.spec.ts server/src/module/saas/services/saas-platform.service.ts server/src/module/saas/services/saas-platform.service.spec.ts server/src/module/saas/saas-tenant.controller.ts server/src/module/saas/saas-tenant.controller.spec.ts server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-platform.controller.spec.ts
git commit -m "feat: expose SaaS order risk operations"
```

---

## Task 4: Add Frontend API Types And Wrappers

**Files:**
- Modify: `web/src/api/saas.ts`

**Interfaces:**
- Produces `SaasOrderRiskOverview`
- Produces `fetchPlatformOrderRiskOverview()`
- Produces `fetchTenantSaasOrders(params)`
- Produces `cancelTenantSaasOrder(orderNo)`
- Produces `cancelTenantResourcePackOrder(orderNo)`
- Extends order records with `closed_at` and `close_reason`

- [ ] **Step 1: Extend API types**

Modify `web/src/api/saas.ts`:

```ts
export interface SaasOrderRiskOverview {
  pending_plan_orders: number
  pending_resource_pack_orders: number
  timeout_closed_plan_orders_7d: number
  timeout_closed_resource_pack_orders_7d: number
  tenant_cancelled_plan_orders_7d: number
  tenant_cancelled_resource_pack_orders_7d: number
}

export interface SaasTenantOrderListParams {
  page?: number
  limit?: number
  order_no?: string
  plan_code?: string
  status?: string
  close_reason?: string
}
```

Extend plan order records so these fields exist:

```ts
closed_at?: string | Date | null
close_reason?: string | null
create_time?: string | Date
```

Extend `SaasResourcePackOrderRecord` with:

```ts
closed_at?: string | Date | null
close_reason?: string | null
```

- [ ] **Step 2: Add API wrappers**

Add:

```ts
export function fetchPlatformOrderRiskOverview() {
  return request.get<SaasOrderRiskOverview>({ url: '/api/saas/platform/orders/risk/overview' })
}

export function fetchTenantSaasOrders(params: SaasTenantOrderListParams) {
  return request.get<SaasPlatformPageResult<SaasPlatformOrderRecord>>({
    url: '/api/saas/tenant/orders',
    params
  })
}

export function cancelTenantSaasOrder(orderNo: string) {
  return request.post<SaasPlatformOrderRecord>({
    url: `/api/saas/tenant/orders/${orderNo}/cancel`
  })
}

export function cancelTenantResourcePackOrder(orderNo: string) {
  return request.post<SaasResourcePackOrderRecord>({
    url: `/api/saas/tenant/resource-pack-orders/${orderNo}/cancel`
  })
}
```

- [ ] **Step 3: Run frontend typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit API task**

Run:

```powershell
git add web/src/api/saas.ts
git commit -m "feat: add SaaS order risk frontend API"
```

---

## Task 5: Enhance Tenant Order UIs

**Files:**
- Modify: `web/src/views/saas/tenant/plan/index.vue`
- Modify: `web/src/views/saas/tenant/resource-pack/index.vue`

**Interfaces:**
- Consumes `fetchTenantSaasOrders`
- Consumes `cancelTenantSaasOrder`
- Consumes `cancelTenantResourcePackOrder`
- Shows `closed_at` and `close_reason`

- [ ] **Step 1: Update tenant plan page imports and state**

Modify imports in `web/src/views/saas/tenant/plan/index.vue`:

```ts
import {
  cancelTenantSaasOrder,
  createAlipayPayment,
  createTenantUpgradeOrder,
  devConfirmTenantPayment,
  fetchTenantSaasOrders,
  fetchTenantSaasPlans,
  fetchTenantSubscription,
  type SaasPlatformOrderRecord
} from '@/api/saas'
```

Add state:

```ts
const orderHistory = ref<SaasPlatformOrderRecord[]>([])
const orderHistoryLoading = ref(false)
const orderPager = reactive({
  page: 1,
  limit: 10,
  total: 0
})
```

- [ ] **Step 2: Add tenant plan order methods**

Add:

```ts
async function loadOrderHistory() {
  orderHistoryLoading.value = true
  try {
    const result = await fetchTenantSaasOrders({
      page: orderPager.page,
      limit: orderPager.limit
    })
    orderHistory.value = result.list || []
    orderPager.total = Number(result.total) || 0
  } finally {
    orderHistoryLoading.value = false
  }
}

async function resumePlanOrderPayment(order: SaasPlatformOrderRecord) {
  currentOrder.value = order
  await startAlipayPayment()
}

async function cancelPlanOrder(order: SaasPlatformOrderRecord) {
  if (order.status !== 'pending') return
  await cancelTenantSaasOrder(order.order_no)
  ElMessage.success('Order cancelled')
  if (currentOrder.value?.order_no === order.order_no) {
    currentOrder.value = null
  }
  await loadOrderHistory()
}

function formatCloseReason(value: string | null | undefined) {
  const labels: Record<string, string> = {
    timeout: '超时关闭',
    tenant_cancelled: '租户取消'
  }
  return value ? labels[value] || value : '-'
}
```

Call `await loadOrderHistory()` after creating an order, after dev confirm, and inside `onMounted`.

- [ ] **Step 3: Add tenant plan order table**

Add a section below the current payment panel:

```vue
<section class="tenant-plan-page__orders">
  <div class="tenant-plan-page__section-header">
    <h2 class="tenant-plan-page__section-title">套餐订单</h2>
    <ElButton :loading="orderHistoryLoading" @click="loadOrderHistory">刷新</ElButton>
  </div>
  <ElTable v-loading="orderHistoryLoading" :data="orderHistory" border>
    <ElTableColumn prop="order_no" label="订单号" min-width="220" show-overflow-tooltip />
    <ElTableColumn prop="plan_code" label="套餐" width="120" />
    <ElTableColumn label="金额" width="130">
      <template #default="{ row }">{{ formatPrice(row.amount_cents, row.currency) }}</template>
    </ElTableColumn>
    <ElTableColumn label="状态" width="110">
      <template #default="{ row }">
        <ElTag :type="getOrderStatusTagType(row.status)" effect="light">{{ formatOrderStatus(row.status) }}</ElTag>
      </template>
    </ElTableColumn>
    <ElTableColumn label="关闭原因" width="130">
      <template #default="{ row }">{{ formatCloseReason(row.close_reason) }}</template>
    </ElTableColumn>
    <ElTableColumn label="创建时间" min-width="170">
      <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
    </ElTableColumn>
    <ElTableColumn label="关闭时间" min-width="170">
      <template #default="{ row }">{{ formatDateTime(row.closed_at) }}</template>
    </ElTableColumn>
    <ElTableColumn label="操作" width="160" fixed="right">
      <template #default="{ row }">
        <ElButton v-if="row.status === 'pending'" type="primary" link @click="resumePlanOrderPayment(row)">继续支付</ElButton>
        <ElButton v-if="row.status === 'pending'" type="danger" link @click="cancelPlanOrder(row)">取消</ElButton>
      </template>
    </ElTableColumn>
  </ElTable>
</section>
```

Add compact styles:

```css
.tenant-plan-page__orders {
  display: grid;
  gap: 14px;
}

.tenant-plan-page__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
```

- [ ] **Step 4: Update tenant resource-pack page**

Modify imports in `web/src/views/saas/tenant/resource-pack/index.vue`:

```ts
cancelTenantResourcePackOrder,
```

Add cancel method:

```ts
async function cancelResourcePackOrder(order: SaasResourcePackOrderRecord) {
  if (order.status !== 'pending') return
  await cancelTenantResourcePackOrder(order.order_no)
  ElMessage.success('Order cancelled')
  if (currentOrder.value?.order_no === order.order_no) {
    currentOrder.value = null
  }
  await loadOrderHistory()
}
```

Add close columns after status:

```vue
<ElTableColumn label="关闭原因" width="130">
  <template #default="{ row }">{{ formatCloseReason(row.close_reason) }}</template>
</ElTableColumn>
<ElTableColumn label="关闭时间" min-width="180">
  <template #default="{ row }">{{ formatDateTime(row.closed_at) }}</template>
</ElTableColumn>
```

Add cancel action in the operation column:

```vue
<ElButton v-if="row.status === 'pending'" type="danger" link @click="cancelResourcePackOrder(row)">
  取消
</ElButton>
```

Add helper:

```ts
function formatCloseReason(value: string | null | undefined) {
  const labels: Record<string, string> = {
    timeout: '超时关闭',
    tenant_cancelled: '租户取消'
  }
  return value ? labels[value] || value : '-'
}
```

- [ ] **Step 5: Run frontend typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit tenant UI task**

Run:

```powershell
git add web/src/views/saas/tenant/plan/index.vue web/src/views/saas/tenant/resource-pack/index.vue
git commit -m "feat: add tenant SaaS order cancellation"
```

---

## Task 6: Enhance Platform Order UIs

**Files:**
- Modify: `web/src/views/saas/platform/subscription/index.vue`
- Modify: `web/src/views/saas/platform/resource-pack-order/index.vue`

**Interfaces:**
- Consumes `fetchPlatformOrderRiskOverview`
- Shows close metadata and timeout-closed filters

- [ ] **Step 1: Add platform order risk summary**

Modify imports in `web/src/views/saas/platform/subscription/index.vue`:

```ts
fetchPlatformOrderRiskOverview,
type SaasOrderRiskOverview,
```

Add state:

```ts
const orderRiskOverview = ref<SaasOrderRiskOverview>({
  pending_plan_orders: 0,
  pending_resource_pack_orders: 0,
  timeout_closed_plan_orders_7d: 0,
  timeout_closed_resource_pack_orders_7d: 0,
  tenant_cancelled_plan_orders_7d: 0,
  tenant_cancelled_resource_pack_orders_7d: 0
})
const orderRiskFilter = ref<'all' | 'pending' | 'timeout' | 'tenant_cancelled'>('all')
```

Add loader:

```ts
async function loadOrderRiskOverview() {
  orderRiskOverview.value = await fetchPlatformOrderRiskOverview()
}

function buildOrderRiskQuery() {
  if (orderRiskFilter.value === 'pending') return { status: 'pending' }
  if (orderRiskFilter.value === 'timeout') return { status: 'closed', close_reason: 'timeout' }
  if (orderRiskFilter.value === 'tenant_cancelled') return { status: 'closed', close_reason: 'tenant_cancelled' }
  return {}
}
```

Merge `...buildOrderRiskQuery()` into the orders-tab `fetchPlatformOrders` query and call `loadOrderRiskOverview()` on mount/refresh.

- [ ] **Step 2: Add platform subscription page markup**

Add above the orders table when `activeTab === 'orders'`:

```vue
<div v-if="activeTab === 'orders'" class="saas-platform-page__risk-summary">
  <div class="saas-platform-page__summary-item">
    <span>待支付套餐订单</span>
    <strong>{{ orderRiskOverview.pending_plan_orders }}</strong>
  </div>
  <div class="saas-platform-page__summary-item">
    <span>7 天超时关闭</span>
    <strong>{{ orderRiskOverview.timeout_closed_plan_orders_7d }}</strong>
  </div>
  <div class="saas-platform-page__summary-item">
    <span>7 天租户取消</span>
    <strong>{{ orderRiskOverview.tenant_cancelled_plan_orders_7d }}</strong>
  </div>
</div>

<ElSegmented
  v-if="activeTab === 'orders'"
  v-model="orderRiskFilter"
  class="saas-platform-page__risk-filter"
  :options="[
    { label: '全部', value: 'all' },
    { label: '待支付', value: 'pending' },
    { label: '超时关闭', value: 'timeout' },
    { label: '租户取消', value: 'tenant_cancelled' }
  ]"
  @change="refreshCurrentTab"
/>
```

Add order table columns:

```vue
<ElTableColumn label="关闭原因" width="130">
  <template #default="{ row }">{{ formatCloseReason(row.close_reason) }}</template>
</ElTableColumn>
<ElTableColumn label="关闭时间" min-width="170">
  <template #default="{ row }">{{ formatDateTime(row.closed_at) }}</template>
</ElTableColumn>
```

Add helper:

```ts
function formatCloseReason(value: string | null | undefined) {
  const labels: Record<string, string> = {
    timeout: '超时关闭',
    tenant_cancelled: '租户取消'
  }
  return value ? labels[value] || value : '-'
}
```

- [ ] **Step 3: Update platform resource-pack order page**

Modify `web/src/views/saas/platform/resource-pack-order/index.vue` filters:

```ts
close_reason: ''
```

Merge into query:

```ts
close_reason: filters.close_reason || undefined
```

Add filter control:

```vue
<ElSelect v-model="filters.close_reason" clearable placeholder="关闭原因" class="saas-resource-pack-order-page__filter-item" @change="loadOrders">
  <ElOption label="超时关闭" value="timeout" />
  <ElOption label="租户取消" value="tenant_cancelled" />
</ElSelect>
```

Add table/detail fields:

```vue
<ElTableColumn label="关闭原因" width="130">
  <template #default="{ row }">{{ formatCloseReason(row.close_reason) }}</template>
</ElTableColumn>
<ElTableColumn label="关闭时间" min-width="170">
  <template #default="{ row }">{{ formatDateTime(row.closed_at) }}</template>
</ElTableColumn>
```

Use the same `formatCloseReason` helper from Step 2.

- [ ] **Step 4: Run frontend typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit platform UI task**

Run:

```powershell
git add web/src/views/saas/platform/subscription/index.vue web/src/views/saas/platform/resource-pack-order/index.vue
git commit -m "feat: add SaaS order risk dashboard"
```

---

## Task 7: Final Verification And Review

**Files:**
- No planned source edits unless verification finds a defect.

- [ ] **Step 1: Run targeted backend tests**

Run:

```powershell
cd server
pnpm run test -- add-saas-order-close-metadata.spec.ts saas-order-risk.service.spec.ts saas-order.service.spec.ts saas-resource-pack-order.service.spec.ts saas-tenant.controller.spec.ts saas-platform.service.spec.ts saas-platform.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run full backend tests**

Run:

```powershell
cd server
pnpm exec jest --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run backend typecheck**

Run:

```powershell
cd server
pnpm exec tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 4: Run frontend typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Run whitespace check**

Run:

```powershell
git diff --check HEAD~6..HEAD
```

Expected: no output.

- [ ] **Step 6: Apply migration locally if backend database is available**

Run:

```powershell
cd server
pnpm run migration:run
```

Expected: `AddSaasOrderCloseMetadata1760000000013` applies or is already recorded.

- [ ] **Step 7: Runtime smoke**

Use the local browser if servers are running:

1. Open `http://localhost:5731/#/tenant-saas/plan`.
2. Create a paid plan order and confirm it appears in the plan order table as `pending`.
3. Click continue payment and confirm Alipay payment creation still opens or reports config status.
4. Create another paid plan order and cancel it; confirm it becomes `closed` with `tenant_cancelled`.
5. Open `http://localhost:5731/#/tenant-saas/resource-packs`.
6. Create and cancel a pending resource-pack order; confirm close metadata appears.
7. Open `http://localhost:5731/#/saas-platform/subscriptions`.
8. On the orders tab, confirm risk cards and quick filters load.
9. Open `http://localhost:5731/#/saas-platform/resource-pack-orders`.
10. Filter closed timeout or tenant-canceled resource-pack orders and open the detail drawer.

If local services are not running, record that browser smoke was not executed.

- [ ] **Step 8: Review git status**

Run:

```powershell
git status --short --untracked-files=all
```

Expected: source changes are committed. `server/.env` and `server/pnpm-lock.yaml` may remain modified and should not be committed unless the user asks.

- [ ] **Step 9: Commit verification fixes only if needed**

If verification required a source fix:

```powershell
git add server/src/module/saas server/src/migrations server/src/migration-specs web/src/api/saas.ts web/src/views/saas
git commit -m "fix: stabilize SaaS order risk operations"
```

Do not create an empty commit.
