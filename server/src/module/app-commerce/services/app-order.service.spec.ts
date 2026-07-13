import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { AppPricePlanEntity } from '../entities/app-price-plan.entity';
import { AppOrderEntity } from '../entities/app-order.entity';
import { TenantAppLicenseEntity } from '../entities/tenant-app-license.entity';
import { AppOrderService } from './app-order.service';
import { AppPricePlanService } from './app-price-plan.service';
import { AppRevenueLedgerService } from './app-revenue-ledger.service';

describe('AppOrderService', () => {
  let service: AppOrderService;

  const configService = { get: jest.fn() };
  const pricePlanService = {
    findTenantApp: jest.fn(),
    listApplicablePlans: jest.fn(),
  };
  const orderRepo = {
    create: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const licenseRepo = { findOne: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const revenueLedgerService = { recordCharge: jest.fn(), recordRefund: jest.fn() };
  const manager = { getRepository: jest.fn() };
  const txOrderRepo = { findOne: jest.fn(), save: jest.fn() };
  const txLicenseRepo = { create: jest.fn(), findOne: jest.fn(), save: jest.fn() };

  const app = {
    id: 7,
    code: 'workflow',
    name: 'Workflow',
    status: 'published',
    visibility: 'marketplace',
    developerId: 17,
  };
  const paidPlan = createPlan();

  beforeEach(async () => {
    jest.clearAllMocks();
    configService.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'appMarketplace.commerce.enabled' ? true : fallback,
    );
    pricePlanService.findTenantApp.mockResolvedValue(app);
    pricePlanService.listApplicablePlans.mockResolvedValue([paidPlan]);
    orderRepo.create.mockImplementation((value) => value);
    orderRepo.save.mockImplementation(async (value) => ({ id: 31, ...value }));
    orderRepo.findOne.mockResolvedValue(null);
    licenseRepo.findOne.mockResolvedValue(null);
    txOrderRepo.save.mockImplementation(async (value) => value);
    txLicenseRepo.create.mockImplementation((value) => value);
    txLicenseRepo.save.mockImplementation(async (value) => ({ id: value.id || 41, ...value }));
    manager.getRepository.mockImplementation((entity) => {
      if (entity === AppOrderEntity) return txOrderRepo;
      if (entity === TenantAppLicenseEntity) return txLicenseRepo;
      throw new Error(`Unexpected repository ${entity?.name}`);
    });
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppOrderService,
        { provide: ConfigService, useValue: configService },
        { provide: AppPricePlanService, useValue: pricePlanService },
        { provide: getRepositoryToken(AppOrderEntity), useValue: orderRepo },
        { provide: getRepositoryToken(TenantAppLicenseEntity), useValue: licenseRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: AppRevenueLedgerService, useValue: revenueLedgerService },
      ],
    }).compile();

    service = module.get(AppOrderService);
  });

  afterEach(() => jest.useRealTimers());

  it('creates an AO order from the current backend price snapshot and ignores client-owned totals', async () => {
    const order = await service.createTenantOrder(
      23,
      9,
      'workflow',
      {
        price_plan_code: 'pro_monthly',
        payment_method: 'alipay',
        amount_cents: 1,
        currency: 'USD',
        developer_id: 999,
        developer_share_bps: 1,
        license_expires_at: '2099-01-01',
      } as any,
    );

    expect(orderRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 23,
        appId: 7,
        pricePlanId: 5,
        appCode: 'workflow',
        appName: 'Workflow',
        pricePlanCode: 'pro_monthly',
        pricingModel: 'subscription',
        billingPeriod: 'monthly',
        amountCents: 9900,
        currency: 'CNY',
        developerId: 17,
        developerShareBps: 7000,
        createdBy: 9,
        status: 'pending',
      }),
    );
    expect(order.orderNo).toMatch(/^AO\d{17}\d{6}$/);
    expect(order).not.toHaveProperty('license_expires_at');
  });

  it('rejects free, included, disabled, foreign-tenant, unpublished, or unavailable price plans', async () => {
    pricePlanService.listApplicablePlans.mockResolvedValue([
      createPlan({ code: 'free_plan', pricingModel: 'free', amountCents: 0, developerShareBps: 0 }),
    ]);
    await expect(
      service.createTenantOrder(23, 9, 'workflow', {
        price_plan_code: 'free_plan',
        payment_method: 'alipay',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    pricePlanService.listApplicablePlans.mockResolvedValue([
      createPlan({ code: 'included_plan', pricingModel: 'included', amountCents: 0, developerShareBps: 0 }),
    ]);
    await expect(
      service.createTenantOrder(23, 9, 'workflow', {
        price_plan_code: 'included_plan',
        payment_method: 'alipay',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    pricePlanService.listApplicablePlans.mockResolvedValue([]);
    await expect(
      service.createTenantOrder(23, 9, 'workflow', {
        price_plan_code: 'disabled_or_foreign',
        payment_method: 'alipay',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    pricePlanService.findTenantApp.mockRejectedValueOnce(new NotFoundException('App unavailable'));
    await expect(
      service.createTenantOrder(23, 9, 'draft_app', {
        price_plan_code: 'pro_monthly',
        payment_method: 'alipay',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a one-time purchase when a current one-time license already exists', async () => {
    pricePlanService.listApplicablePlans.mockResolvedValue([
      createPlan({
        code: 'lifetime',
        pricingModel: 'one_time',
        billingPeriod: 'none',
        amountCents: 29900,
      }),
    ]);
    licenseRepo.findOne.mockResolvedValue({ source: 'order', status: 'active', orderId: 44 });
    orderRepo.findOne.mockResolvedValue({ id: 44, pricingModel: 'one_time', status: 'paid' });

    await expect(
      service.createTenantOrder(23, 9, 'workflow', {
        price_plan_code: 'lifetime',
        payment_method: 'alipay',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(orderRepo.save).not.toHaveBeenCalled();
  });

  it('activates a subscription license and charge ledger in the same transaction while preserving one current license', async () => {
    const paidAt = new Date('2026-07-13T08:00:00.000Z');
    jest.useFakeTimers().setSystemTime(paidAt);
    const pendingOrder = createOrder();
    const currentLicense = createLicense({ id: 40, orderId: 30, status: 'active' });
    txOrderRepo.findOne.mockImplementation(async (options) => {
      if (options.where?.orderNo) return pendingOrder;
      if (options.where?.id === 30) return createOrder({ id: 30, pricingModel: 'subscription' });
      return null;
    });
    txLicenseRepo.findOne.mockResolvedValue(currentLicense);

    const result = await service.confirmAlipayPayment(
      pendingOrder.orderNo,
      '2026071322000000000001',
    );

    expect(txOrderRepo.findOne).toHaveBeenCalledWith({
      where: { orderNo: pendingOrder.orderNo },
      lock: { mode: 'pessimistic_write' },
    });
    expect(currentLicense.status).toBe('expired');
    expect(currentLicense.expiresAt).toEqual(paidAt);
    expect(txLicenseRepo.save).toHaveBeenCalledWith(currentLicense);
    expect(txLicenseRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 23,
        appId: 7,
        pricePlanId: 5,
        orderId: 31,
        source: 'order',
        status: 'active',
        effectiveAt: paidAt,
        expiresAt: expect.any(Date),
      }),
    );
    const activatedLicense = txLicenseRepo.save.mock.calls[1][0];
    expect(revenueLedgerService.recordCharge).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ status: 'paid', alipayTradeNo: '2026071322000000000001' }),
      expect.objectContaining({ source: 'order', status: 'active' }),
    );
    expect(activatedLicense.expiresAt.toISOString()).toBe('2026-08-13T08:00:00.000Z');
    expect(result.status).toBe('paid');
  });

  it('returns the existing paid order on duplicate confirmation without duplicate license or ledger rows', async () => {
    const paidOrder = createOrder({ status: 'paid', alipayTradeNo: 'TRADE-1' });
    txOrderRepo.findOne.mockResolvedValue(paidOrder);

    await expect(service.confirmAlipayPayment(paidOrder.orderNo, 'TRADE-1')).resolves.toBe(
      paidOrder,
    );

    expect(txLicenseRepo.findOne).not.toHaveBeenCalled();
    expect(txLicenseRepo.save).not.toHaveBeenCalled();
    expect(revenueLedgerService.recordCharge).not.toHaveBeenCalled();
    expect(txOrderRepo.save).not.toHaveBeenCalled();
  });

  it('clamps monthly license expiry to the last day of a shorter target month', async () => {
    const paidAt = new Date('2026-01-31T08:00:00.000Z');
    jest.useFakeTimers().setSystemTime(paidAt);
    txOrderRepo.findOne.mockResolvedValue(createOrder());
    txLicenseRepo.findOne.mockResolvedValue(null);

    await service.confirmAlipayPayment('AO20260713000000001000001', 'TRADE-MONTH-END');

    expect(txLicenseRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: new Date('2026-02-28T08:00:00.000Z'),
      }),
    );
  });

  it('starts one bounded trial and rejects every repeated trial attempt including deleted history', async () => {
    const startedAt = new Date('2026-07-13T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(startedAt);
    pricePlanService.listApplicablePlans.mockResolvedValue([createPlan({ trialDays: 7 })]);
    txLicenseRepo.findOne.mockResolvedValue(null);

    const license = await service.startTrial(23, 9, 'workflow', 'pro_monthly');

    expect(txLicenseRepo.findOne).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { tenantId: 23, appId: 7, source: 'trial' },
        withDeleted: true,
        lock: { mode: 'pessimistic_write' },
      }),
    );
    expect(txLicenseRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 23,
        appId: 7,
        source: 'trial',
        status: 'trialing',
        effectiveAt: startedAt,
        expiresAt: new Date('2026-07-20T10:00:00.000Z'),
      }),
    );
    expect(license.status).toBe('trialing');
    expect(revenueLedgerService.recordCharge).not.toHaveBeenCalled();

    txLicenseRepo.findOne.mockResolvedValueOnce({
      id: 39,
      tenantId: 23,
      appId: 7,
      source: 'trial',
      status: 'expired',
      deleteTime: new Date(),
    });
    await expect(service.startTrial(23, 9, 'workflow', 'pro_monthly')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('marks only the authoritative tenant pending order as payment requested', async () => {
    const requestedAt = new Date('2026-07-13T11:00:00.000Z');
    orderRepo.update.mockResolvedValue({ affected: 1 });
    orderRepo.findOne.mockResolvedValue(createOrder({ paymentRequestedAt: requestedAt }));

    await service.markTenantPaymentRequested(23, 'AO20260713000000001000001', requestedAt);

    expect(orderRepo.update).toHaveBeenCalledWith(
      { tenantId: 23, orderNo: 'AO20260713000000001000001', status: 'pending' },
      { paymentRequestedAt: requestedAt },
    );
  });

  it('records one full refund and revokes the order-backed current license in one transaction', async () => {
    const refundedAt = new Date('2026-07-13T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(refundedAt);
    const paidOrder = createOrder({ status: 'paid', paidAt: new Date('2026-07-01T00:00:00.000Z') });
    const activeLicense = createLicense({
      id: 41,
      orderId: paidOrder.id,
      status: 'active',
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    txOrderRepo.findOne.mockResolvedValue(paidOrder);
    txLicenseRepo.findOne.mockResolvedValue(activeLicense);

    const result = await service.recordFullRefund(
      paidOrder.orderNo,
      9,
      'Provider refund confirmed',
      'REFUND-20260713-1',
    );

    expect(txOrderRepo.findOne).toHaveBeenCalledWith({
      where: { orderNo: paidOrder.orderNo },
      lock: { mode: 'pessimistic_write' },
    });
    expect(txLicenseRepo.findOne).toHaveBeenCalledWith({
      where: { orderId: paidOrder.id },
      lock: { mode: 'pessimistic_write' },
    });
    expect(activeLicense).toMatchObject({
      status: 'refunded',
      expiresAt: refundedAt,
      revokedAt: refundedAt,
      revokeReason: 'Provider refund confirmed',
    });
    expect(result).toMatchObject({
      status: 'refunded',
      refundedAt,
      refundedBy: 9,
      refundReason: 'Provider refund confirmed',
      refundReference: 'REFUND-20260713-1',
    });
    expect(revenueLedgerService.recordRefund).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ status: 'refunded' }),
      expect.objectContaining({ status: 'refunded' }),
    );
  });

  it('returns the existing refunded state for duplicate refund recording', async () => {
    const refundedOrder = createOrder({
      status: 'refunded',
      refundedAt: new Date('2026-07-13T12:00:00.000Z'),
      refundedBy: 9,
      refundReason: 'Provider refund confirmed',
      refundReference: 'REFUND-20260713-1',
    });
    txOrderRepo.findOne.mockResolvedValue(refundedOrder);

    await expect(
      service.recordFullRefund(
        refundedOrder.orderNo,
        10,
        'Duplicate operator request',
        'REFUND-20260713-2',
      ),
    ).resolves.toBe(refundedOrder);

    expect(txLicenseRepo.findOne).not.toHaveBeenCalled();
    expect(txOrderRepo.save).not.toHaveBeenCalled();
    expect(txLicenseRepo.save).not.toHaveBeenCalled();
    expect(revenueLedgerService.recordRefund).not.toHaveBeenCalled();
  });

  it('revokes a current license without rewriting its original creator', async () => {
    const activeLicense = createLicense({
      id: 41,
      orderId: 31,
      status: 'active',
      createdBy: null,
      expiresAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    txLicenseRepo.findOne.mockResolvedValue(activeLicense);

    const result = await service.revokeLicense(41, 9, 'Platform policy revocation');

    expect(result).toMatchObject({
      status: 'revoked',
      revokeReason: 'Platform policy revocation',
      createdBy: null,
    });
    expect(result.revokedAt).toBeInstanceOf(Date);
    expect(result.expiresAt).toEqual(result.revokedAt);
  });
});

function createPlan(overrides: Partial<AppPricePlanEntity> = {}): AppPricePlanEntity {
  return {
    id: 5,
    appId: 7,
    code: 'pro_monthly',
    name: 'Pro monthly',
    pricingModel: 'subscription',
    billingPeriod: 'monthly',
    amountCents: 9900,
    currency: 'CNY',
    trialDays: 0,
    developerShareBps: 7000,
    includedPlanCodes: [],
    saleScope: 'all',
    tenantIds: [],
    status: 1,
    sort: 100,
    ...overrides,
  };
}

function createOrder(overrides: Partial<AppOrderEntity> = {}): AppOrderEntity {
  return {
    id: 31,
    orderNo: 'AO20260713000000001000001',
    tenantId: 23,
    appId: 7,
    pricePlanId: 5,
    appCode: 'workflow',
    appName: 'Workflow',
    pricePlanCode: 'pro_monthly',
    pricingModel: 'subscription',
    billingPeriod: 'monthly',
    amountCents: 9900,
    currency: 'CNY',
    developerId: 17,
    developerShareBps: 7000,
    paymentMethod: 'alipay',
    status: 'pending',
    refundReason: '',
    refundReference: '',
    closeReason: '',
    createdBy: 9,
    remark: '',
    ...overrides,
  };
}

function createLicense(overrides: Partial<TenantAppLicenseEntity> = {}): TenantAppLicenseEntity {
  return {
    id: 40,
    tenantId: 23,
    appId: 7,
    pricePlanId: 5,
    orderId: 30,
    source: 'order',
    status: 'active',
    effectiveAt: new Date('2026-06-13T08:00:00.000Z'),
    expiresAt: new Date('2026-07-13T08:00:00.000Z'),
    revokeReason: '',
    createdBy: 9,
    ...overrides,
  };
}
