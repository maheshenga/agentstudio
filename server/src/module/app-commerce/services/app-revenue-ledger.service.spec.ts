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
    service = new AppRevenueLedgerService();
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
