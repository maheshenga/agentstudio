import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

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
    const row = { id: payload.id ?? this.rows.length + 1, ...payload } as unknown as T;
    const index = this.rows.findIndex((item) => item.id === row.id);
    if (index >= 0) {
      this.rows[index] = { ...this.rows[index], ...row };
      return this.rows[index];
    }
    this.rows.push(row);
    return row;
  }

  async findOne(options: { where: EntityRecord | EntityRecord[]; order?: Record<string, 'ASC' | 'DESC'> }) {
    const whereList = Array.isArray(options.where) ? options.where : [options.where];
    const candidates = this.rows.filter((row) => whereList.some((where) => matchesWhere(row, where)));
    sortRows(candidates, options.order);
    return candidates[0] ?? null;
  }

  async find(options: { where?: EntityRecord | EntityRecord[]; order?: Record<string, 'ASC' | 'DESC'> } = {}) {
    const whereList = Array.isArray(options.where) ? options.where : options.where ? [options.where] : [];
    const candidates = whereList.length
      ? this.rows.filter((row) => whereList.some((where) => matchesWhere(row, where)))
      : [...this.rows];
    sortRows(candidates, options.order);
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

function sortRows(rows: EntityRecord[], order?: Record<string, 'ASC' | 'DESC'>) {
  if (!order) return;
  const entries = Object.entries(order);
  rows.sort((left, right) => {
    for (const [key, direction] of entries) {
      const leftValue = left[key] ?? 0;
      const rightValue = right[key] ?? 0;
      if (leftValue === rightValue) continue;
      const result = leftValue > rightValue ? 1 : -1;
      return direction === 'DESC' ? -result : result;
    }
    return 0;
  });
}

function matchesWhere(row: EntityRecord, where: EntityRecord) {
  return Object.entries(where).every(([key, expected]) => matchesValue(row[key], expected));
}

function matchesValue(actual: unknown, expected: unknown) {
  if (expected && typeof expected === 'object') {
    const operator = expected as { type?: string; _type?: string; value?: unknown; _value?: unknown };
    const operatorType = operator.type || operator._type;
    const operatorValue = operator.value ?? operator._value;
    if (operatorType === 'isNull') return actual === null || actual === undefined;
    if (operatorType === 'moreThan') return actual > (operatorValue as any);
    if (operatorType === 'in') return Array.isArray(operatorValue) && operatorValue.includes(actual);
  }
  return actual === expected;
}

describe('SaaS tenant main flow integration', () => {
  const tenantId = 202;
  const plans: EntityRecord[] = [
    { id: 1, code: 'free', name: 'Free', priceMonthly: 0, priceYearly: 0, billingCycle: 'monthly', status: 1 },
    { id: 2, code: 'pro', name: 'Pro', priceMonthly: 9900, priceYearly: 99000, billingCycle: 'monthly', status: 1 },
  ];
  const subscriptions: EntityRecord[] = [];
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
    jest.useFakeTimers().setSystemTime(new Date('2026-07-06T12:00:00.000Z'));
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

  afterEach(() => {
    jest.useRealTimers();
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
    expect(paidOrder.paidAt).toEqual(new Date('2026-07-06T12:00:00.000Z'));
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
