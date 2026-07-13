import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

import { AppOrderEntity } from '../entities/app-order.entity';
import { AppRevenueLedgerEntity } from '../entities/app-revenue-ledger.entity';
import { TenantAppLicenseEntity } from '../entities/tenant-app-license.entity';
import { AppRevenueLedgerService } from './app-revenue-ledger.service';

describe('AppRevenueLedgerService', () => {
  const ledgerRepo = {
    create: jest.fn(),
    findOne: jest.fn(),
    query: jest.fn(),
    save: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn(),
  } as unknown as EntityManager;
  let service: AppRevenueLedgerService;

  beforeEach(() => {
    jest.clearAllMocks();
    (manager.getRepository as jest.Mock).mockReturnValue(ledgerRepo);
    ledgerRepo.create.mockImplementation((value) => value);
    ledgerRepo.save.mockImplementation(async (value) => ({ id: 91, ...value }));
    ledgerRepo.findOne.mockResolvedValue(null);
    ledgerRepo.query.mockResolvedValue([]);
    service = new AppRevenueLedgerService(ledgerRepo as any);
  });

  it('calculates developer share with integer basis points and assigns the remainder to platform share', async () => {
    const order = createOrder({ amountCents: 101, developerShareBps: 3333 });
    const license = createLicense();

    await service.recordCharge(manager, order, license);

    expect(ledgerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: `charge:${order.orderNo}`,
        eventType: 'charge',
        grossAmountCents: 101,
        developerAmountCents: 33,
        platformAmountCents: 68,
        currency: 'CNY',
      }),
    );
  });

  it('returns an existing charge event without creating a duplicate ledger row', async () => {
    const existing = { id: 91, eventKey: 'charge:AO20260713000000001000001' };
    ledgerRepo.findOne.mockResolvedValue(existing);

    await expect(
      service.recordCharge(manager, createOrder(), createLicense()),
    ).resolves.toBe(existing);

    expect(ledgerRepo.create).not.toHaveBeenCalled();
    expect(ledgerRepo.save).not.toHaveBeenCalled();
  });

  it('never creates a paid ledger row for free, included, or trial access', async () => {
    await expect(
      service.recordCharge(
        manager,
        createOrder({ pricingModel: 'free' as any }),
        createLicense(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.recordCharge(
        manager,
        createOrder({ pricingModel: 'included' as any }),
        createLicense(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.recordCharge(
        manager,
        createOrder(),
        createLicense({ source: 'trial', status: 'trialing', orderId: null }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ledgerRepo.save).not.toHaveBeenCalled();
  });

  it('records one negative immutable refund row from the original charge split', async () => {
    const order = createOrder({ status: 'refunded' });
    const license = createLicense({ status: 'refunded' });
    const charge = {
      id: 91,
      eventKey: `charge:${order.orderNo}`,
      eventType: 'charge',
      orderId: order.id,
      licenseId: license.id,
      tenantId: order.tenantId,
      appId: order.appId,
      developerId: order.developerId,
      grossAmountCents: 9900,
      platformAmountCents: 2970,
      developerAmountCents: 6930,
      currency: 'CNY',
      settlementBatchId: 77,
    };
    ledgerRepo.findOne.mockImplementation(async ({ where }) =>
      where.eventKey === charge.eventKey ? charge : null,
    );

    await service.recordRefund(manager, order, license);

    expect(ledgerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: `refund:${order.orderNo}`,
        eventType: 'refund',
        grossAmountCents: -9900,
        platformAmountCents: -2970,
        developerAmountCents: -6930,
        settlementBatchId: null,
      }),
    );
    expect(charge).toMatchObject({ settlementBatchId: 77, grossAmountCents: 9900 });
  });

  it('returns the existing refund ledger row without creating a duplicate', async () => {
    const order = createOrder({ status: 'refunded' });
    const license = createLicense({ status: 'refunded' });
    const existing = { id: 92, eventKey: `refund:${order.orderNo}`, eventType: 'refund' };
    ledgerRepo.findOne.mockImplementation(async ({ where }) =>
      where.eventKey === existing.eventKey ? existing : null,
    );

    await expect(service.recordRefund(manager, order, license)).resolves.toBe(existing);

    expect(ledgerRepo.create).not.toHaveBeenCalled();
    expect(ledgerRepo.save).not.toHaveBeenCalled();
  });

  it('aggregates platform revenue without exposing tenant or provider details', async () => {
    ledgerRepo.query.mockResolvedValue([
      {
        app_id: '7',
        app_code: 'workflow',
        app_name: 'Workflow',
        developer_id: '17',
        gross_amount_cents: '9900',
        refund_amount_cents: '0',
        platform_amount_cents: '2970',
        developer_amount_cents: '6930',
        unsettled_developer_amount_cents: '6930',
        order_count: '1',
      },
      {
        app_id: '8',
        app_code: 'directory',
        app_name: 'Directory',
        developer_id: '18',
        gross_amount_cents: '19900',
        refund_amount_cents: '19900',
        platform_amount_cents: '0',
        developer_amount_cents: '0',
        unsettled_developer_amount_cents: '-13930',
        order_count: '1',
      },
    ]);

    const result = await service.getPlatformOverview({});

    expect(result.totals).toMatchObject({
      gross_amount_cents: 29800,
      refund_amount_cents: 19900,
      platform_amount_cents: 2970,
      developer_amount_cents: 6930,
      unsettled_developer_amount_cents: -7000,
      order_count: 2,
    });
    expect(JSON.stringify(result)).not.toContain('tenant_id');
    expect(JSON.stringify(result)).not.toContain('alipay_trade_no');
    expect(JSON.stringify(result)).not.toContain('refund_reference');
  });

  it('scopes developer revenue to the authenticated developer id', async () => {
    ledgerRepo.query.mockResolvedValue([
      {
        app_id: '7',
        app_code: 'workflow',
        app_name: 'Workflow',
        developer_id: '17',
        gross_amount_cents: '9900',
        refund_amount_cents: '0',
        platform_amount_cents: '2970',
        developer_amount_cents: '6930',
        unsettled_developer_amount_cents: '6930',
        order_count: '1',
      },
    ]);

    const result = await service.getDeveloperOverview(17, {});

    expect(ledgerRepo.query).toHaveBeenCalledWith(
      expect.stringContaining('ledger.developer_id = ?'),
      expect.arrayContaining([17]),
    );
    expect(result.apps).toEqual([
      expect.objectContaining({
        app_code: 'workflow',
        app_name: 'Workflow',
        developer_amount_cents: 6930,
      }),
    ]);
    expect(result.apps[0]).not.toHaveProperty('developer_id');
    expect(JSON.stringify(result)).not.toContain('platform_amount_cents');
  });
});

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
    status: 'paid',
    paidAt: new Date('2026-07-13T00:00:00.000Z'),
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
    id: 41,
    tenantId: 23,
    appId: 7,
    pricePlanId: 5,
    orderId: 31,
    source: 'order',
    status: 'active',
    effectiveAt: new Date('2026-07-13T00:00:00.000Z'),
    expiresAt: new Date('2026-08-13T00:00:00.000Z'),
    revokeReason: '',
    createdBy: 9,
    ...overrides,
  };
}
