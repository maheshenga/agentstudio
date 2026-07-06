# P1 SaaS Main Flow Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cross-service regression test proving a signed-up tenant can upgrade from the free plan to a paid plan, confirm payment, refresh quota, and receive paid module entitlements.

**Architecture:** Keep production code unchanged unless the new regression exposes a real defect. Use real `SaasOrderService` and `SaasModuleService` with shared in-memory repositories so the test verifies service integration rather than controller mocks. Treat the initial free active subscription as the state produced by signup, which is already covered in `saas-provisioning.service.spec.ts`.

**Tech Stack:** NestJS service classes, Jest, TypeScript, TypeORM-compatible in-memory repository fakes.

---

## File Structure

- Create `server/src/module/saas/saas-main-flow.integration.spec.ts`
  - Owns the P1 cross-service happy path.
  - Seeds free and pro plans, active free subscription, pro plan features, and platform module rows.
  - Uses real `SaasOrderService.createUpgradeOrder()`, `SaasOrderService.confirmDevPayment()`, and `SaasModuleService.listTenantModules()`.

- Modify only if the test exposes a real issue:
  - `server/src/module/saas/services/saas-order.service.ts`
  - `server/src/module/saas/services/saas-module.service.ts`

---

### Task 1: Paid Plan Upgrade to Module Entitlement Flow

**Files:**
- Create: `server/src/module/saas/saas-main-flow.integration.spec.ts`

- [ ] **Step 1: Write the failing integration test**

Create `server/src/module/saas/saas-main-flow.integration.spec.ts` with a real service harness:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In, IsNull, MoreThan } from 'typeorm';

import { SaasModuleEntity } from './entities/saas-module.entity';
import { SaasOrderEntity } from './entities/saas-order.entity';
import { SaasPlanFeatureEntity } from './entities/saas-plan-feature.entity';
import { SaasPlanEntity } from './entities/saas-plan.entity';
import { SaasSubscriptionEntity } from './entities/saas-subscription.entity';
import { SaasModuleService } from './services/saas-module.service';
import { SaasOrderService } from './services/saas-order.service';
import { SaasQuotaService } from './services/saas-quota.service';

type EntityRecord = Record<string, any>;

class MemoryRepository<T extends EntityRecord> {
  constructor(private readonly rows: T[]) {}

  create(payload: Partial<T>) {
    return payload as T;
  }

  async save(payload: Partial<T>) {
    const row = { id: payload.id ?? this.rows.length + 1, ...payload } as T;
    const index = this.rows.findIndex((item) => item.id === row.id);
    if (index >= 0) this.rows[index] = { ...this.rows[index], ...row };
    else this.rows.push(row);
    return row;
  }

  async findOne(options: { where: EntityRecord | EntityRecord[]; order?: Record<string, 'ASC' | 'DESC'> }) {
    const whereList = Array.isArray(options.where) ? options.where : [options.where];
    const candidates = this.rows.filter((row) => whereList.some((where) => matchesWhere(row, where)));
    if (options.order?.id === 'DESC') {
      candidates.sort((left, right) => Number(right.id || 0) - Number(left.id || 0));
    }
    return candidates[0] ?? null;
  }

  async find(options: { where?: EntityRecord; order?: Record<string, 'ASC' | 'DESC'> } = {}) {
    const candidates = options.where ? this.rows.filter((row) => matchesWhere(row, options.where || {})) : [...this.rows];
    if (options.order?.id === 'ASC') {
      candidates.sort((left, right) => Number(left.id || 0) - Number(right.id || 0));
    }
    return candidates;
  }

  async update(where: EntityRecord, patch: Partial<T>) {
    let affected = 0;
    for (const row of this.rows) {
      if (matchesWhere(row, where)) {
        Object.assign(row, patch);
        affected += 1;
      }
    }
    return { affected };
  }
}

function matchesWhere(row: EntityRecord, where: EntityRecord) {
  return Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === 'object') {
      const operatorType = expected.type || expected._type;
      const operatorValue = expected.value ?? expected._value;
      if (operatorType === 'isNull') return row[key] === null || row[key] === undefined;
      if (operatorType === 'moreThan') return row[key] > operatorValue;
      if (operatorType === 'in') return operatorValue.includes(row[key]);
    }
    return row[key] === expected;
  });
}

describe('SaaS tenant main flow integration', () => {
  const tenantId = 202;
  const plans: EntityRecord[] = [
    { id: 1, code: 'free', name: 'Free', priceMonthly: 0, priceYearly: 0, billingCycle: 'monthly', status: 1 },
    { id: 2, code: 'pro', name: 'Pro', priceMonthly: 9900, priceYearly: 99000, billingCycle: 'monthly', status: 1 },
  ];
  const subscriptions: EntityRecord[] = [
    { id: 1, tenantId, planId: 1, billingCycle: 'monthly', status: 'active', startTime: new Date('2026-07-01T00:00:00.000Z'), endTime: null, deleteTime: null },
  ];
  const orders: EntityRecord[] = [];
  const planFeatures: EntityRecord[] = [
    { id: 1, planId: 2, featureKey: 'ai_chat', enabled: 1, deleteTime: null },
    { id: 2, planId: 2, featureKey: 'rag', enabled: 1, deleteTime: null },
  ];
  const modules: EntityRecord[] = [
    { id: 1, code: 'ai_chat', name: 'AI Chat', routePath: '/ai/chat', status: 1, sort: 10, deleteTime: null },
    { id: 2, code: 'rag', name: 'RAG', routePath: '/taixu/document', status: 1, sort: 20, deleteTime: null },
  ];

  let orderService: SaasOrderService;
  let moduleService: SaasModuleService;
  const quotaService = { initializeTenantQuota: jest.fn() };

  beforeEach(async () => {
    orders.length = 0;
    subscriptions.splice(0, subscriptions.length, {
      id: 1,
      tenantId,
      planId: 1,
      billingCycle: 'monthly',
      status: 'active',
      startTime: new Date('2026-07-01T00:00:00.000Z'),
      endTime: null,
      deleteTime: null,
    });
    quotaService.initializeTenantQuota.mockReset();

    const planRepo = new MemoryRepository(plans);
    const orderRepo = new MemoryRepository(orders);
    const subscriptionRepo = new MemoryRepository(subscriptions);
    const planFeatureRepo = new MemoryRepository(planFeatures);
    const moduleRepo = new MemoryRepository(modules);
    const dataSource = {
      transaction: jest.fn((callback) =>
        callback({
          getRepository: (entity: Function) => {
            if (entity === SaasOrderEntity) return orderRepo;
            if (entity === SaasSubscriptionEntity) return subscriptionRepo;
            throw new Error(`Unexpected repository ${entity.name}`);
          },
        }),
      ),
    };

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        SaasOrderService,
        SaasModuleService,
        { provide: DataSource, useValue: dataSource },
        { provide: SaasQuotaService, useValue: quotaService },
        { provide: getRepositoryToken(SaasPlanEntity), useValue: planRepo },
        { provide: getRepositoryToken(SaasOrderEntity), useValue: orderRepo },
        { provide: getRepositoryToken(SaasModuleEntity), useValue: moduleRepo },
        { provide: getRepositoryToken(SaasPlanFeatureEntity), useValue: planFeatureRepo },
        { provide: getRepositoryToken(SaasSubscriptionEntity), useValue: subscriptionRepo },
      ],
    }).compile();

    orderService = testingModule.get(SaasOrderService);
    moduleService = testingModule.get(SaasModuleService);
  });

  it('upgrades a signed-up tenant to a paid plan and exposes paid modules after payment', async () => {
    await expect(moduleService.listTenantModules(tenantId)).resolves.toEqual([]);

    const pendingOrder = await orderService.createUpgradeOrder(tenantId, {
      plan_code: 'pro',
      billing_cycle: 'yearly',
      payment_method: 'alipay',
    });

    expect(pendingOrder).toMatchObject({
      tenantId,
      planId: 2,
      planCode: 'pro',
      billingCycle: 'yearly',
      amountCents: 99000,
      status: 'pending',
    });

    const paidOrder = await orderService.confirmDevPayment(tenantId, pendingOrder.orderNo);

    expect(paidOrder.status).toBe('paid');
    expect(quotaService.initializeTenantQuota).toHaveBeenCalledWith(tenantId, 2, expect.any(Object));
    expect(subscriptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, tenantId, planId: 1, status: 'expired' }),
        expect.objectContaining({ tenantId, planId: 2, billingCycle: 'yearly', status: 'active' }),
      ]),
    );
    await expect(moduleService.listTenantModules(tenantId)).resolves.toEqual([
      expect.objectContaining({ code: 'ai_chat', name: 'AI Chat' }),
      expect.objectContaining({ code: 'rag', name: 'RAG' }),
    ]);
  });
});
```

- [ ] **Step 2: Run the new spec and verify RED or GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-main-flow.integration.spec.ts --runInBand
```

Expected: Prefer PASS if current behavior is correct. If it fails, the failure must point to a real integration mismatch in repository fake support or production service behavior.

- [ ] **Step 3: Fix only real integration issues**

If the spec fails because `MemoryRepository` does not emulate the TypeORM operator shape used by the services, update only the test fake. If it fails because production code does not persist the paid subscription or module entitlement as expected, make the smallest production fix in the relevant service.

- [ ] **Step 4: Run P1 focused verification**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-main-flow.integration.spec.ts src/module/saas/services/saas-order.service.spec.ts src/module/saas/services/saas-module.service.spec.ts src/module/saas/services/saas-provisioning.service.spec.ts --runInBand
pnpm.cmd run build
```

Expected: all listed suites pass and backend build exits 0.

---

## Self-Review

- Spec coverage: P1 covers the paid upgrade path missing from existing isolated specs: free starting subscription, paid order creation, dev payment confirmation, quota refresh, old subscription expiration, new active paid subscription, and module entitlement visibility.
- Placeholder scan: No TBD or unresolved implementation step remains.
- Type consistency: The new spec imports existing service/entity names and uses `plan_code`, `billing_cycle`, and `payment_method` DTO keys already accepted by `SaasOrderService`.
- Scope check: No invoice work, no remote push, no UI work, and no DB migration is included in P1.
