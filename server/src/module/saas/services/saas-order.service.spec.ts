import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasQuotaService } from './saas-quota.service';
import { SaasOrderService } from './saas-order.service';

describe('SaasOrderService', () => {
  let service: SaasOrderService;

  const planRepo = {
    findOne: jest.fn(),
  };

  const orderRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(),
  };

  const manager = {
    getRepository: jest.fn(),
  };

  const txOrderRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const txSubscriptionRepo = {
    update: jest.fn(),
    save: jest.fn(),
  };

  const saasQuotaService = {
    initializeTenantQuota: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    orderRepo.create.mockImplementation((payload) => payload);
    orderRepo.save.mockImplementation(async (payload) => ({ id: 88, ...payload }));

    manager.getRepository.mockImplementation((entity) => {
      if (entity === SaasOrderEntity) return txOrderRepo;
      if (entity === SaasSubscriptionEntity) return txSubscriptionRepo;
      throw new Error(`Unexpected repository ${entity?.name}`);
    });
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasOrderService,
        {
          provide: getRepositoryToken(SaasPlanEntity),
          useValue: planRepo,
        },
        {
          provide: getRepositoryToken(SaasOrderEntity),
          useValue: orderRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: SaasQuotaService,
          useValue: saasQuotaService,
        },
      ],
    }).compile();

    service = module.get(SaasOrderService);
  });

  it('creates a pending upgrade order using backend plan pricing', async () => {
    planRepo.findOne.mockResolvedValue({
      id: 2,
      code: 'pro',
      name: 'Pro',
      priceMonthly: 9900,
      priceYearly: 99000,
      billingCycle: 'monthly',
      status: 1,
    });

    const order = await service.createUpgradeOrder(12, {
      plan_code: 'pro',
      billing_cycle: 'yearly',
      payment_method: 'alipay',
    });

    expect(planRepo.findOne).toHaveBeenCalledWith({
      where: {
        code: 'pro',
        status: 1,
      },
    });
    expect(orderRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 12,
        planId: 2,
        planCode: 'pro',
        billingCycle: 'yearly',
        amountCents: 99000,
        currency: 'CNY',
        paymentMethod: 'alipay',
        status: 'pending',
      }),
    );
    expect(order.orderNo).toMatch(/^SO\d{17}\d{6}$/);
    expect(order.status).toBe('pending');
  });
  it('rejects free plan upgrade orders', async () => {
    planRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'free',
      name: 'Free',
      priceMonthly: 0,
      priceYearly: 0,
      billingCycle: 'monthly',
      status: 1,
    });

    await expect(
      service.createUpgradeOrder(12, {
        plan_code: 'free',
        billing_cycle: 'monthly',
        payment_method: 'alipay',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(orderRepo.create).not.toHaveBeenCalled();
    expect(orderRepo.save).not.toHaveBeenCalled();
  });

  it('marks an order paid and upgrades subscription and quotas in one transaction', async () => {
    const paidAt = new Date('2026-07-02T00:00:00.000Z');
    jest.useFakeTimers().setSystemTime(paidAt);

    txOrderRepo.findOne.mockResolvedValue({
      id: 88,
      orderNo: 'SO20260702000000001000001',
      tenantId: 12,
      planId: 2,
      planCode: 'pro',
      billingCycle: 'yearly',
      amountCents: 99000,
      status: 'pending',
      paymentMethod: 'alipay',
    });
    txOrderRepo.save.mockImplementation(async (payload) => payload);
    txSubscriptionRepo.save.mockImplementation(async (_entity, payload) => ({ id: 99, ...payload }));

    const order = await service.confirmDevPayment(12, 'SO20260702000000001000001');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(txSubscriptionRepo.update).toHaveBeenCalledWith(
      {
        tenantId: 12,
        status: 'active',
      },
      {
        status: 'expired',
        endTime: paidAt,
      },
    );
    expect(txSubscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 12,
        planId: 2,
        billingCycle: 'yearly',
        status: 'active',
        startTime: paidAt,
        endTime: expect.any(Date),
        cancelAtPeriodEnd: 0,
        remark: 'Activated by order SO20260702000000001000001',
      }),
    );
    expect(saasQuotaService.initializeTenantQuota).toHaveBeenCalledWith(12, 2, manager);
    expect(order.status).toBe('paid');
    expect(order.paidAt).toEqual(paidAt);
    expect(order.alipayTradeNo).toBe('DEV-SO20260702000000001000001');

    jest.useRealTimers();
  });

  it('confirms an Alipay notification payment by order number', async () => {
    const paidAt = new Date('2026-07-02T01:00:00.000Z');
    jest.useFakeTimers().setSystemTime(paidAt);

    txOrderRepo.findOne.mockResolvedValue({
      id: 89,
      orderNo: 'SO20260702010000001000001',
      tenantId: 12,
      planId: 2,
      planCode: 'pro',
      billingCycle: 'yearly',
      amountCents: 99000,
      status: 'pending',
      paymentMethod: 'alipay',
    });
    txOrderRepo.save.mockImplementation(async (payload) => payload);
    txSubscriptionRepo.save.mockImplementation(async (_entity, payload) => ({ id: 100, ...payload }));

    const order = await service.confirmAlipayPayment('SO20260702010000001000001', '2026070222000000000001');

    expect(txOrderRepo.findOne).toHaveBeenCalledWith({
      where: {
        orderNo: 'SO20260702010000001000001',
      },
    });
    expect(txSubscriptionRepo.update).toHaveBeenCalledWith(
      {
        tenantId: 12,
        status: 'active',
      },
      {
        status: 'expired',
        endTime: paidAt,
      },
    );
    expect(saasQuotaService.initializeTenantQuota).toHaveBeenCalledWith(12, 2, manager);
    expect(order.status).toBe('paid');
    expect(order.paidAt).toEqual(paidAt);
    expect(order.alipayTradeNo).toBe('2026070222000000000001');

    jest.useRealTimers();
  });

  it('starts a new same-plan cycle immediately after payment', async () => {
    const paidAt = new Date('2026-07-03T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(paidAt);

    txOrderRepo.findOne.mockResolvedValue({
      id: 90,
      orderNo: 'SO20260703120000001000001',
      tenantId: 12,
      planId: 2,
      planCode: 'pro',
      billingCycle: 'monthly',
      amountCents: 9900,
      status: 'pending',
      paymentMethod: 'alipay',
    });
    txOrderRepo.save.mockImplementation(async (payload) => payload);
    txSubscriptionRepo.save.mockImplementation(async (payload) => ({ id: 101, ...payload }));

    const order = await service.confirmDevPayment(12, 'SO20260703120000001000001');

    expect(txSubscriptionRepo.update).toHaveBeenCalledWith(
      {
        tenantId: 12,
        status: 'active',
      },
      {
        status: 'expired',
        endTime: paidAt,
      },
    );
    expect(txSubscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 12,
        planId: 2,
        billingCycle: 'monthly',
        status: 'active',
        startTime: paidAt,
        endTime: expect.any(Date),
        remark: 'Activated by order SO20260703120000001000001',
      }),
    );
    const savedSubscription = txSubscriptionRepo.save.mock.calls[0][0];
    expect(savedSubscription.endTime.getMonth()).toBe(new Date('2026-08-03T12:00:00.000Z').getMonth());
    expect(order.status).toBe('paid');

    jest.useRealTimers();
  });
  it('returns an already paid order for duplicate Alipay notifications without reopening subscription', async () => {
    const paidAt = new Date('2026-07-02T01:00:00.000Z');
    txOrderRepo.findOne.mockResolvedValue({
      id: 89,
      orderNo: 'SO20260702010000001000001',
      tenantId: 12,
      planId: 2,
      planCode: 'pro',
      billingCycle: 'yearly',
      amountCents: 99000,
      status: 'paid',
      paymentMethod: 'alipay',
      alipayTradeNo: '2026070222000000000001',
      paidAt,
    });

    const order = await service.confirmAlipayPayment('SO20260702010000001000001', '2026070222000000000001');

    expect(order.status).toBe('paid');
    expect(order.paidAt).toEqual(paidAt);
    expect(txSubscriptionRepo.update).not.toHaveBeenCalled();
    expect(txSubscriptionRepo.save).not.toHaveBeenCalled();
    expect(saasQuotaService.initializeTenantQuota).not.toHaveBeenCalled();
    expect(txOrderRepo.save).not.toHaveBeenCalled();
  });
});
