import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasPlatformService } from './saas-platform.service';
import { SaasResourcePackService } from './saas-resource-pack.service';

describe('SaasPlatformService', () => {
  let service: SaasPlatformService;

  const orderRepo = {
    findAndCount: jest.fn(),
  };
  const subscriptionRepo = {
    findAndCount: jest.fn(),
  };
  const resourcePackService = {
    listPlatformResourcePacks: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasPlatformService,
        {
          provide: getRepositoryToken(SaasOrderEntity),
          useValue: orderRepo,
        },
        {
          provide: getRepositoryToken(SaasSubscriptionEntity),
          useValue: subscriptionRepo,
        },
        {
          provide: SaasResourcePackService,
          useValue: resourcePackService,
        },
      ],
    }).compile();

    service = module.get(SaasPlatformService);
  });

  it('lists SaaS orders with paging and filters', async () => {
    const paidAt = new Date('2026-07-02T00:00:00.000Z');
    orderRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 88,
          orderNo: 'SO20260702000000001000001',
          tenantId: 12,
          planId: 2,
          planCode: 'pro',
          billingCycle: 'yearly',
          amountCents: 99000,
          currency: 'CNY',
          paymentMethod: 'alipay',
          status: 'paid',
          alipayTradeNo: '2026070222000000000001',
          paidAt,
          createTime: paidAt,
        },
      ],
      1,
    ]);

    const result = await service.listOrders({
      page: '2',
      limit: '5',
      status: 'paid',
      tenant_id: '12',
    });

    expect(orderRepo.findAndCount).toHaveBeenCalledWith({
      where: {
        status: 'paid',
        tenantId: 12,
      },
      order: {
        createTime: 'DESC',
        id: 'DESC',
      },
      skip: 5,
      take: 5,
    });
    expect(result).toEqual({
      list: [
        {
          id: 88,
          order_no: 'SO20260702000000001000001',
          tenant_id: 12,
          plan_id: 2,
          plan_code: 'pro',
          billing_cycle: 'yearly',
          amount_cents: 99000,
          currency: 'CNY',
          payment_method: 'alipay',
          status: 'paid',
          alipay_trade_no: '2026070222000000000001',
          paid_at: paidAt,
          create_time: paidAt,
        },
      ],
      total: 1,
      page: 2,
      limit: 5,
    });
  });

  it('lists SaaS subscriptions with paging and filters', async () => {
    const startTime = new Date('2026-07-02T00:00:00.000Z');
    const endTime = new Date('2027-07-02T00:00:00.000Z');
    subscriptionRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 99,
          tenantId: 12,
          planId: 2,
          billingCycle: 'yearly',
          status: 'active',
          startTime,
          endTime,
          cancelAtPeriodEnd: 0,
          remark: 'Activated by order SO20260702000000001000001',
          createTime: startTime,
        },
      ],
      1,
    ]);

    const result = await service.listSubscriptions({
      page: '1',
      limit: '10',
      status: 'active',
      tenant_id: '12',
    });

    expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith({
      where: {
        status: 'active',
        tenantId: 12,
      },
      order: {
        createTime: 'DESC',
        id: 'DESC',
      },
      skip: 0,
      take: 10,
    });
    expect(result).toEqual({
      list: [
        {
          id: 99,
          tenant_id: 12,
          plan_id: 2,
          billing_cycle: 'yearly',
          status: 'active',
          start_time: startTime,
          end_time: endTime,
          cancel_at_period_end: 0,
          remark: 'Activated by order SO20260702000000001000001',
          create_time: startTime,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    });
  });

  it('delegates resource pack listing to the resource pack catalog service', async () => {
    resourcePackService.listPlatformResourcePacks.mockResolvedValue({
      list: [{ code: 'tokens_1m' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    await expect(service.listResourcePacks({ resource_type: 'tokens' })).resolves.toEqual({
      list: [{ code: 'tokens_1m' }],
      total: 1,
      page: 1,
      limit: 20,
    });
    expect(resourcePackService.listPlatformResourcePacks).toHaveBeenCalledWith({ resource_type: 'tokens' });
  });
});
