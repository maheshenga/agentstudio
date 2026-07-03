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
