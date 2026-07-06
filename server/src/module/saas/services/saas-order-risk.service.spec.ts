import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import {
  SAAS_ORDER_CLOSED,
  SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
  SAAS_ORDER_CLOSE_REASON_TIMEOUT,
  SAAS_ORDER_PAID,
  SAAS_ORDER_PENDING,
} from '../constants';
import { SaasOrderEntity } from '../entities/saas-order.entity';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
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
  const systemModuleAccessService = {
    assertModuleAccess: jest.fn(),
  };

  const expectResourcePackAccessGate = (tenantId: number) => {
    expect(systemModuleAccessService.assertModuleAccess).toHaveBeenCalledWith({
      tenantId,
      moduleCode: 'tenant_saas',
      requiredSaasModuleCode: 'resource_pack',
    });
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasOrderRiskService,
        { provide: getRepositoryToken(SaasOrderEntity), useValue: planOrderRepo },
        { provide: getRepositoryToken(SaasResourcePackOrderEntity), useValue: resourcePackOrderRepo },
        { provide: SystemModuleAccessService, useValue: systemModuleAccessService },
      ],
    }).compile();

    service = module.get(SaasOrderRiskService);
  });

  it('closes stale pending plan and resource-pack orders', async () => {
    const now = new Date('2026-07-03T12:00:00.000Z');
    const cutoff = new Date('2026-07-03T10:00:00.000Z');
    planOrderRepo.find.mockResolvedValue([{ orderNo: 'SO1' }, { orderNo: 'SO2' }]);
    resourcePackOrderRepo.find.mockResolvedValue([{ orderNo: 'RPO1' }]);
    planOrderRepo.update.mockResolvedValue({ affected: 1 });
    resourcePackOrderRepo.update.mockResolvedValue({ affected: 0 });

    await expect(service.closeExpiredPendingOrders(now, 120)).resolves.toEqual({
      checked_at: now,
      timeout_minutes: 120,
      closed_plan_order_count: 1,
      closed_resource_pack_order_count: 0,
      closed_plan_order_nos: ['SO1', 'SO2'],
      closed_resource_pack_order_nos: ['RPO1'],
    });

    expect(planOrderRepo.find).toHaveBeenCalledWith({
      where: { status: SAAS_ORDER_PENDING, createTime: LessThanOrEqual(cutoff), paymentRequestedAt: IsNull() },
      select: { orderNo: true },
    });
    expect(planOrderRepo.update).toHaveBeenCalledWith(
      { orderNo: expect.any(Object), status: SAAS_ORDER_PENDING, paymentRequestedAt: IsNull() },
      { status: SAAS_ORDER_CLOSED, closedAt: now, closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT },
    );
    expect(resourcePackOrderRepo.find).toHaveBeenCalledWith({
      where: { status: SAAS_ORDER_PENDING, createTime: LessThanOrEqual(cutoff), paymentRequestedAt: IsNull() },
      select: { orderNo: true },
    });
    expect(resourcePackOrderRepo.update).toHaveBeenCalledWith(
      { orderNo: expect.any(Object), status: SAAS_ORDER_PENDING, paymentRequestedAt: IsNull() },
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
    const order = {
      orderNo: 'SO1',
      tenantId: 12,
      status: SAAS_ORDER_CLOSED,
      closedAt: now,
      closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
    };
    planOrderRepo.update.mockResolvedValue({ affected: 1 });
    planOrderRepo.findOne.mockResolvedValue(order);

    await expect(service.closeTenantPlanOrder(12, 'SO1', now)).resolves.toMatchObject({
      status: SAAS_ORDER_CLOSED,
      closedAt: now,
      closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
    });
    expect(planOrderRepo.update).toHaveBeenCalledWith(
      { tenantId: 12, orderNo: 'SO1', status: SAAS_ORDER_PENDING, paymentRequestedAt: IsNull() },
      { status: SAAS_ORDER_CLOSED, closedAt: now, closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED },
    );
    expect(planOrderRepo.findOne).toHaveBeenCalledWith({ where: { tenantId: 12, orderNo: 'SO1' } });
    expect(planOrderRepo.update.mock.invocationCallOrder[0]).toBeLessThan(
      planOrderRepo.findOne.mock.invocationCallOrder[0],
    );
    expect(planOrderRepo.save).not.toHaveBeenCalled();
  });

  it('returns already closed tenant orders idempotently', async () => {
    const order = {
      orderNo: 'SO1',
      tenantId: 12,
      status: SAAS_ORDER_CLOSED,
      closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
    };
    planOrderRepo.update.mockResolvedValue({ affected: 0 });
    planOrderRepo.findOne.mockResolvedValue(order);

    await expect(service.closeTenantPlanOrder(12, 'SO1')).resolves.toBe(order);
    expect(planOrderRepo.update).toHaveBeenCalledWith(
      { tenantId: 12, orderNo: 'SO1', status: SAAS_ORDER_PENDING, paymentRequestedAt: IsNull() },
      expect.any(Object),
    );
    expect(planOrderRepo.save).not.toHaveBeenCalled();
  });

  it('rejects tenant cancellation for paid orders', async () => {
    planOrderRepo.update.mockResolvedValue({ affected: 0 });
    planOrderRepo.findOne.mockResolvedValue({ orderNo: 'SO1', tenantId: 12, status: SAAS_ORDER_PAID });

    await expect(service.closeTenantPlanOrder(12, 'SO1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects tenant cancellation for pending plan orders with requested external payment', async () => {
    const paymentRequestedAt = new Date('2026-07-03T11:50:00.000Z');
    planOrderRepo.update.mockResolvedValue({ affected: 0 });
    planOrderRepo.findOne.mockResolvedValue({
      orderNo: 'SO1',
      tenantId: 12,
      status: SAAS_ORDER_PENDING,
      paymentRequestedAt,
    });

    await expect(service.closeTenantPlanOrder(12, 'SO1')).rejects.toThrow(
      'Payment has already been requested for this order',
    );
  });

  it('returns not found for another tenant plan order', async () => {
    planOrderRepo.update.mockResolvedValue({ affected: 0 });
    planOrderRepo.findOne.mockResolvedValue(null);

    await expect(service.closeTenantPlanOrder(12, 'SO1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('closes a tenant pending resource-pack order', async () => {
    const now = new Date('2026-07-03T12:00:00.000Z');
    const order = {
      orderNo: 'RPO1',
      tenantId: 12,
      status: SAAS_ORDER_CLOSED,
      closedAt: now,
      closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
    };
    resourcePackOrderRepo.update.mockResolvedValue({ affected: 1 });
    resourcePackOrderRepo.findOne.mockResolvedValue(order);

    await expect(service.closeTenantResourcePackOrder(12, 'RPO1', now)).resolves.toMatchObject({
      status: SAAS_ORDER_CLOSED,
      closedAt: now,
      closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
    });
    expectResourcePackAccessGate(12);
    expect(resourcePackOrderRepo.update).toHaveBeenCalledWith(
      { tenantId: 12, orderNo: 'RPO1', status: SAAS_ORDER_PENDING, paymentRequestedAt: IsNull() },
      { status: SAAS_ORDER_CLOSED, closedAt: now, closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED },
    );
    expect(resourcePackOrderRepo.findOne).toHaveBeenCalledWith({ where: { tenantId: 12, orderNo: 'RPO1' } });
    expect(resourcePackOrderRepo.update.mock.invocationCallOrder[0]).toBeLessThan(
      resourcePackOrderRepo.findOne.mock.invocationCallOrder[0],
    );
    expect(resourcePackOrderRepo.save).not.toHaveBeenCalled();
  });

  it('returns already closed tenant resource-pack orders idempotently', async () => {
    const order = {
      orderNo: 'RPO1',
      tenantId: 12,
      status: SAAS_ORDER_CLOSED,
      closeReason: SAAS_ORDER_CLOSE_REASON_TENANT_CANCELLED,
    };
    resourcePackOrderRepo.update.mockResolvedValue({ affected: 0 });
    resourcePackOrderRepo.findOne.mockResolvedValue(order);

    await expect(service.closeTenantResourcePackOrder(12, 'RPO1')).resolves.toBe(order);
    expect(resourcePackOrderRepo.update).toHaveBeenCalledWith(
      { tenantId: 12, orderNo: 'RPO1', status: SAAS_ORDER_PENDING, paymentRequestedAt: IsNull() },
      expect.any(Object),
    );
    expect(resourcePackOrderRepo.save).not.toHaveBeenCalled();
  });

  it('rejects tenant cancellation for paid resource-pack orders', async () => {
    resourcePackOrderRepo.update.mockResolvedValue({ affected: 0 });
    resourcePackOrderRepo.findOne.mockResolvedValue({ orderNo: 'RPO1', tenantId: 12, status: SAAS_ORDER_PAID });

    await expect(service.closeTenantResourcePackOrder(12, 'RPO1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects tenant cancellation for pending resource-pack orders with requested external payment', async () => {
    const paymentRequestedAt = new Date('2026-07-03T11:50:00.000Z');
    resourcePackOrderRepo.update.mockResolvedValue({ affected: 0 });
    resourcePackOrderRepo.findOne.mockResolvedValue({
      orderNo: 'RPO1',
      tenantId: 12,
      status: SAAS_ORDER_PENDING,
      paymentRequestedAt,
    });

    await expect(service.closeTenantResourcePackOrder(12, 'RPO1')).rejects.toThrow(
      'Payment has already been requested for this order',
    );
  });

  it('returns not found for another tenant resource-pack order', async () => {
    resourcePackOrderRepo.update.mockResolvedValue({ affected: 0 });
    resourcePackOrderRepo.findOne.mockResolvedValue(null);

    await expect(service.closeTenantResourcePackOrder(12, 'RPO1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('checks resource pack access before tenant resource-pack cancellation', async () => {
    systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

    await expect(service.closeTenantResourcePackOrder(12, 'RPO1')).rejects.toThrow('Module disabled');

    expectResourcePackAccessGate(12);
    expect(resourcePackOrderRepo.update).not.toHaveBeenCalled();
    expect(resourcePackOrderRepo.findOne).not.toHaveBeenCalled();
  });

  it('decorates order close metadata with null fallback', () => {
    const closedAt = new Date('2026-07-03T12:00:00.000Z');

    expect(service.decoratePlanOrder({ closedAt, closeReason: SAAS_ORDER_CLOSE_REASON_TIMEOUT })).toEqual({
      closed_at: closedAt,
      close_reason: SAAS_ORDER_CLOSE_REASON_TIMEOUT,
      payment_requested_at: null,
    });
    expect(service.decorateResourcePackOrder({})).toEqual({
      closed_at: null,
      close_reason: null,
      payment_requested_at: null,
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

  it('summarizes stale payment requested orders for reconciliation', async () => {
    const now = new Date('2026-07-04T12:00:00.000Z');
    const cutoff = new Date('2026-07-04T10:00:00.000Z');
    const planOrders = Array.from({ length: 21 }, (_, index) => ({
      orderNo: `SO${index + 1}`,
      tenantId: 12,
      amountCents: 100,
      paymentRequestedAt: new Date(`2026-07-04T09:${String(index).padStart(2, '0')}:00.000Z`),
      createTime: new Date('2026-07-04T09:00:00.000Z'),
    }));
    const resourcePackOrders = [
      {
        orderNo: 'RPO1',
        tenantId: 12,
        amountCents: 19900,
        paymentRequestedAt: new Date('2026-07-04T09:20:00.000Z'),
        createTime: new Date('2026-07-04T09:00:00.000Z'),
      },
      {
        orderNo: 'RPO2',
        tenantId: 13,
        amountCents: 29900,
        paymentRequestedAt: new Date('2026-07-04T09:10:00.000Z'),
        createTime: new Date('2026-07-04T09:00:00.000Z'),
      },
    ];
    planOrderRepo.find.mockImplementation((options) => Promise.resolve(options?.take === 20 ? planOrders.slice(0, 20) : planOrders));
    resourcePackOrderRepo.find.mockImplementation((options) =>
      Promise.resolve(options?.take === 20 ? resourcePackOrders.slice(0, 20) : resourcePackOrders),
    );

    const result = await service.getPaymentReconciliationOverview(now, 120);

    expect(result).toEqual({
      checked_at: now,
      stale_minutes: 120,
      stale_plan_payment_count: 21,
      stale_resource_pack_payment_count: 2,
      stale_plan_payment_amount_cents: 2100,
      stale_resource_pack_payment_amount_cents: 49800,
      recent_plan_orders: expect.arrayContaining([
        expect.objectContaining({ order_no: 'SO1', amount_cents: 100, exception_type: 'payment_requested_stale' }),
      ]),
      recent_resource_pack_orders: [
        expect.objectContaining({ order_no: 'RPO1', exception_type: 'payment_requested_stale' }),
        expect.objectContaining({ order_no: 'RPO2', exception_type: 'payment_requested_stale' }),
      ],
    });
    expect(result.recent_plan_orders).toHaveLength(20);

    expect(planOrderRepo.find).toHaveBeenCalledWith({
      where: {
        status: SAAS_ORDER_PENDING,
        paymentRequestedAt: LessThanOrEqual(cutoff),
      },
      select: { amountCents: true },
    });
    expect(planOrderRepo.find).toHaveBeenCalledWith({
      where: {
        status: SAAS_ORDER_PENDING,
        paymentRequestedAt: LessThanOrEqual(cutoff),
      },
      order: { paymentRequestedAt: 'ASC', id: 'DESC' },
      take: 20,
    });
    expect(resourcePackOrderRepo.find).toHaveBeenCalledWith({
      where: {
        status: SAAS_ORDER_PENDING,
        paymentRequestedAt: LessThanOrEqual(cutoff),
      },
      select: { amountCents: true },
    });
    expect(resourcePackOrderRepo.find).toHaveBeenCalledWith({
      where: {
        status: SAAS_ORDER_PENDING,
        paymentRequestedAt: LessThanOrEqual(cutoff),
      },
      order: { paymentRequestedAt: 'ASC', id: 'DESC' },
      take: 20,
    });
  });
});
