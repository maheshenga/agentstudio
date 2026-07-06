import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SAAS_ORDER_PAID, SAAS_ORDER_PENDING, SAAS_PAYMENT_ALIPAY } from '../constants';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasResourcePackEntity } from '../entities/saas-resource-pack.entity';
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
import { SaasQuotaService } from './saas-quota.service';
import { SaasResourcePackOrderService } from './saas-resource-pack-order.service';

describe('SaasResourcePackOrderService', () => {
  let service: SaasResourcePackOrderService;

  const packRepo = { findOne: jest.fn() };
  const orderRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
  };
  const dataSource = { transaction: jest.fn() };
  const manager = { getRepository: jest.fn() };
  const txOrderRepo = { findOne: jest.fn(), save: jest.fn() };
  const systemModuleAccessService = { assertModuleAccess: jest.fn() };
  const saasQuotaService = { grantTenantQuota: jest.fn() };

  const expectResourcePackAccessGate = (tenantId: number) => {
    expect(systemModuleAccessService.assertModuleAccess).toHaveBeenCalledWith({
      tenantId,
      moduleCode: 'tenant_saas',
      requiredSaasModuleCode: 'resource_pack',
    });
  };

  const expectResourcePackAccessGateNotChecked = () => {
    expect(systemModuleAccessService.assertModuleAccess).not.toHaveBeenCalled();
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    orderRepo.create.mockImplementation((payload) => payload);
    orderRepo.save.mockImplementation(async (payload) => ({ id: 88, ...payload }));
    txOrderRepo.save.mockImplementation(async (payload) => payload);
    saasQuotaService.grantTenantQuota.mockResolvedValue(undefined);
    manager.getRepository.mockImplementation((entity) => {
      if (entity === SaasResourcePackOrderEntity) return txOrderRepo;
      throw new Error(`Unexpected repository ${entity?.name}`);
    });
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasResourcePackOrderService,
        { provide: getRepositoryToken(SaasResourcePackEntity), useValue: packRepo },
        { provide: getRepositoryToken(SaasResourcePackOrderEntity), useValue: orderRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: SystemModuleAccessService, useValue: systemModuleAccessService },
        { provide: SaasQuotaService, useValue: saasQuotaService },
      ],
    }).compile();

    service = module.get(SaasResourcePackOrderService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a pending resource pack order from active pack values', async () => {
    packRepo.findOne.mockResolvedValue({
      id: 2,
      code: 'tokens_1m',
      name: 'Tokens 1,000,000',
      resourceType: 'tokens',
      quotaAmount: 1000000,
      priceCents: 19900,
      currency: 'CNY',
      status: 1,
    });

    const order = await service.createTenantOrder(12, {
      resource_pack_code: 'tokens_1m',
      payment_method: 'alipay',
    });

    expectResourcePackAccessGate(12);
    expect(packRepo.findOne).toHaveBeenCalledWith({ where: { code: 'tokens_1m', status: 1 } });
    expect(orderRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 12,
        resourcePackId: 2,
        resourcePackCode: 'tokens_1m',
        resourcePackName: 'Tokens 1,000,000',
        resourceType: 'tokens',
        quotaAmount: 1000000,
        amountCents: 19900,
        currency: 'CNY',
        paymentMethod: SAAS_PAYMENT_ALIPAY,
        status: SAAS_ORDER_PENDING,
      }),
    );
    expect(order.orderNo).toMatch(/^RPO\d{17}\d{6}$/);
  });

  it('rejects missing or inactive resource packs', async () => {
    packRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createTenantOrder(12, { resource_pack_code: 'missing', payment_method: 'alipay' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('confirms payment and grants quota through the quota ledger service', async () => {
    const paidAt = new Date('2026-07-03T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(paidAt);
    txOrderRepo.findOne.mockResolvedValue({
      id: 88,
      orderNo: 'RPO20260703120000001000001',
      tenantId: 12,
      resourceType: 'tokens',
      quotaAmount: 1000000,
      status: SAAS_ORDER_PENDING,
      paymentMethod: SAAS_PAYMENT_ALIPAY,
    });

    const order = await service.confirmDevPayment(12, 'RPO20260703120000001000001');

    expect(txOrderRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 12, orderNo: 'RPO20260703120000001000001' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(saasQuotaService.grantTenantQuota).toHaveBeenCalledWith(
      12,
      'tokens',
      1000000,
      expect.objectContaining({
        sourceType: 'resource_pack_order',
        sourceId: 'RPO20260703120000001000001',
      }),
      manager,
    );
    expect(order.status).toBe(SAAS_ORDER_PAID);
    expect(order.alipayTradeNo).toBe('DEV-RPO20260703120000001000001');
    expect(order.paidAt).toEqual(paidAt);
    expect(order.deliveredAt).toEqual(paidAt);
  });

  it('grants quota for a new tenant resource type', async () => {
    txOrderRepo.findOne.mockResolvedValue({
      orderNo: 'RPO20260703120000001000002',
      tenantId: 12,
      resourceType: 'rag_documents',
      quotaAmount: 1000,
      status: SAAS_ORDER_PENDING,
    });
    await service.confirmAlipayPayment('RPO20260703120000001000002', '2026070322000000000001');

    expect(txOrderRepo.findOne).toHaveBeenCalledWith({
      where: { orderNo: 'RPO20260703120000001000002' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(saasQuotaService.grantTenantQuota).toHaveBeenCalledWith(
      12,
      'rag_documents',
      1000,
      expect.objectContaining({
        sourceType: 'resource_pack_order',
        sourceId: 'RPO20260703120000001000002',
      }),
      manager,
    );
  });

  it('does not deliver quota again for already delivered paid orders', async () => {
    const deliveredAt = new Date('2026-07-03T12:00:00.000Z');
    txOrderRepo.findOne.mockResolvedValue({
      orderNo: 'RPO20260703120000001000003',
      tenantId: 12,
      resourceType: 'tokens',
      quotaAmount: 1000000,
      status: SAAS_ORDER_PAID,
      deliveredAt,
      paidAt: deliveredAt,
    });

    const order = await service.confirmAlipayPayment('RPO20260703120000001000003', '2026070322000000000001');

    expect(order.status).toBe(SAAS_ORDER_PAID);
    expect(saasQuotaService.grantTenantQuota).not.toHaveBeenCalled();
    expect(txOrderRepo.save).not.toHaveBeenCalled();
    expectResourcePackAccessGateNotChecked();
  });

  it('rejects non-pending resource pack orders that are not already delivered', async () => {
    txOrderRepo.findOne.mockResolvedValue({
      orderNo: 'RPO20260703120000001000004',
      tenantId: 12,
      status: 'closed',
    });

    await expect(service.confirmAlipayPayment('RPO20260703120000001000004', 'trade-no')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lists platform resource pack orders with filters and pagination', async () => {
    orderRepo.findAndCount.mockResolvedValue([
      [{ orderNo: 'RPO20260703120000001000001', tenantId: 12, resourcePackCode: 'tokens_1m' }],
      1,
    ]);

    await expect(
      service.listPlatformOrders({
        page: '2',
        limit: '10',
        tenant_id: '12',
        resource_pack_code: 'tokens_1m',
        resource_type: 'tokens',
        status: 'paid',
      }),
    ).resolves.toMatchObject({ total: 1, page: 2, limit: 10 });

    expect(orderRepo.findAndCount).toHaveBeenCalledWith({
      where: {
        tenantId: 12,
        resourcePackCode: 'tokens_1m',
        resourceType: 'tokens',
        status: 'paid',
      },
      order: { createTime: 'DESC', id: 'DESC' },
      skip: 10,
      take: 10,
    });
    expectResourcePackAccessGateNotChecked();
  });

  it('lists tenant resource pack orders scoped to the current tenant', async () => {
    const closedAt = new Date('2026-07-03T12:00:00.000Z');
    orderRepo.findAndCount.mockResolvedValue([
      [
        {
          orderNo: 'RPO20260703120000001000001',
          tenantId: 12,
          resourcePackCode: 'tokens_1m',
          status: 'closed',
          closedAt,
          closeReason: 'tenant_cancelled',
        },
      ],
      1,
    ]);

    await expect(
      service.listTenantOrders(12, {
        page: '1',
        limit: '20',
        status: 'closed',
        resource_pack_code: 'tokens_1m',
        order_no: 'RPO20260703120000001000001',
        close_reason: 'tenant_cancelled',
      }),
    ).resolves.toMatchObject({
      list: [
        expect.objectContaining({
          order_no: 'RPO20260703120000001000001',
          closed_at: closedAt,
          close_reason: 'tenant_cancelled',
        }),
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    expect(orderRepo.findAndCount).toHaveBeenCalledWith({
      where: {
        tenantId: 12,
        orderNo: 'RPO20260703120000001000001',
        resourcePackCode: 'tokens_1m',
        status: 'closed',
        closeReason: 'tenant_cancelled',
      },
      order: { createTime: 'DESC', id: 'DESC' },
      skip: 0,
      take: 20,
    });
  });

  it('filters platform resource pack orders by order number and close reason', async () => {
    orderRepo.findAndCount.mockResolvedValue([
      [{ orderNo: 'RPO20260703120000001000001', tenantId: 12 }],
      1,
    ]);

    await service.listPlatformOrders({ order_no: 'RPO20260703120000001000001', close_reason: 'timeout' });

    expect(orderRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderNo: 'RPO20260703120000001000001', closeReason: 'timeout' },
      }),
    );
    expectResourcePackAccessGateNotChecked();
  });

  it('checks resource pack module access before looking up packs', async () => {
    systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

    await expect(
      service.createTenantOrder(12, { resource_pack_code: 'tokens_1m', payment_method: 'alipay' }),
    ).rejects.toThrow('Module disabled');

    expectResourcePackAccessGate(12);
    expect(packRepo.findOne).not.toHaveBeenCalled();
    expect(orderRepo.create).not.toHaveBeenCalled();
  });

  it('defaults invalid tenant resource pack order pagination values without producing NaN offsets', async () => {
    orderRepo.findAndCount.mockResolvedValue([[{ orderNo: 'RPO1', tenantId: 12 }], 1]);

    await expect(service.listTenantOrders(12, { page: 'abc', limit: 'oops' })).resolves.toMatchObject({
      page: 1,
      limit: 20,
    });

    expect(orderRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
      }),
    );
  });

  it('does not mutate order as paid when quota delivery fails', async () => {
    const order: Partial<SaasResourcePackOrderEntity> = {
      orderNo: 'RPO1',
      tenantId: 12,
      resourceType: 'tokens',
      quotaAmount: 1000,
      status: SAAS_ORDER_PENDING,
    };
    txOrderRepo.findOne.mockResolvedValue(order);
    saasQuotaService.grantTenantQuota.mockRejectedValueOnce(new Error('grant failed'));

    await expect(service.confirmDevPayment(12, 'RPO1')).rejects.toThrow('grant failed');

    expect(order.status).toBe(SAAS_ORDER_PENDING);
    expect(order.paidAt).toBeUndefined();
    expect(order.deliveredAt).toBeUndefined();
    expect(txOrderRepo.save).not.toHaveBeenCalled();
  });

  it('rejects invalid platform tenant id filters instead of broadening resource pack order queries', async () => {
    await expect(service.listPlatformOrders({ tenant_id: 'abc' })).rejects.toBeInstanceOf(BadRequestException);

    expect(orderRepo.findAndCount).not.toHaveBeenCalled();
    expectResourcePackAccessGateNotChecked();
  });

  it('finds a platform resource pack order by order number', async () => {
    orderRepo.findOne.mockResolvedValue({
      orderNo: 'RPO20260703120000001000001',
      tenantId: 12,
      resourcePackCode: 'tokens_1m',
    });

    await expect(service.findPlatformOrder('RPO20260703120000001000001')).resolves.toMatchObject({
      order_no: 'RPO20260703120000001000001',
      tenant_id: 12,
    });

    expect(orderRepo.findOne).toHaveBeenCalledWith({
      where: { orderNo: 'RPO20260703120000001000001' },
    });
    expectResourcePackAccessGateNotChecked();
  });

  it('marks a tenant pending resource pack order as payment requested', async () => {
    const requestedAt = new Date('2026-07-03T12:00:00.000Z');
    const order = {
      orderNo: 'RPO1',
      tenantId: 12,
      status: SAAS_ORDER_PENDING,
      paymentRequestedAt: requestedAt,
    };
    orderRepo.update.mockResolvedValue({ affected: 1 });
    orderRepo.findOne.mockResolvedValue(order);

    await expect(service.markTenantPaymentRequested(12, 'RPO1', requestedAt)).resolves.toBe(order);
    expect(orderRepo.update).toHaveBeenCalledWith(
      { tenantId: 12, orderNo: 'RPO1', status: SAAS_ORDER_PENDING },
      { paymentRequestedAt: requestedAt },
    );
    expect(orderRepo.findOne).toHaveBeenCalledWith({ where: { tenantId: 12, orderNo: 'RPO1' } });
  });

  it('rejects marking a closed tenant resource pack order as payment requested', async () => {
    orderRepo.update.mockResolvedValue({ affected: 0 });
    orderRepo.findOne.mockResolvedValue({ orderNo: 'RPO1', tenantId: 12, status: 'closed' });

    await expect(service.markTenantPaymentRequested(12, 'RPO1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('checks resource pack access before reading a tenant order', async () => {
    systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

    await expect(service.findTenantOrder(12, 'RPO1')).rejects.toThrow('Module disabled');

    expectResourcePackAccessGate(12);
    expect(orderRepo.findOne).not.toHaveBeenCalled();
  });

  it('checks resource pack access before listing tenant orders', async () => {
    systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

    await expect(service.listTenantOrders(12, { status: 'pending' })).rejects.toThrow('Module disabled');

    expectResourcePackAccessGate(12);
    expect(orderRepo.findAndCount).not.toHaveBeenCalled();
  });

  it('checks resource pack access before marking tenant payment requested', async () => {
    systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

    await expect(service.markTenantPaymentRequested(12, 'RPO1')).rejects.toThrow('Module disabled');

    expectResourcePackAccessGate(12);
    expect(orderRepo.update).not.toHaveBeenCalled();
    expect(orderRepo.findOne).not.toHaveBeenCalled();
  });

  it('checks resource pack access before dev payment delivers quota', async () => {
    txOrderRepo.findOne.mockResolvedValue({
      orderNo: 'RPO1',
      tenantId: 12,
      resourceType: 'tokens',
      quotaAmount: 1000,
      status: SAAS_ORDER_PENDING,
    });
    systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

    await expect(service.confirmDevPayment(12, 'RPO1')).rejects.toThrow('Module disabled');

    expect(txOrderRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 12, orderNo: 'RPO1' },
      lock: { mode: 'pessimistic_write' },
    });
    expectResourcePackAccessGate(12);
    expect(txOrderRepo.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      systemModuleAccessService.assertModuleAccess.mock.invocationCallOrder[0],
    );
    expect(saasQuotaService.grantTenantQuota).not.toHaveBeenCalled();
    expect(txOrderRepo.save).not.toHaveBeenCalled();
  });

  it('checks resource pack access before alipay notify delivers quota', async () => {
    txOrderRepo.findOne.mockResolvedValue({
      orderNo: 'RPO1',
      tenantId: 12,
      resourceType: 'tokens',
      quotaAmount: 1000,
      status: SAAS_ORDER_PENDING,
    });
    systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

    await expect(service.confirmAlipayPayment('RPO1', 'trade-no')).rejects.toThrow('Module disabled');

    expect(txOrderRepo.findOne).toHaveBeenCalledWith({
      where: { orderNo: 'RPO1' },
      lock: { mode: 'pessimistic_write' },
    });
    expectResourcePackAccessGate(12);
    expect(txOrderRepo.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      systemModuleAccessService.assertModuleAccess.mock.invocationCallOrder[0],
    );
    expect(saasQuotaService.grantTenantQuota).not.toHaveBeenCalled();
    expect(txOrderRepo.save).not.toHaveBeenCalled();
  });
});
