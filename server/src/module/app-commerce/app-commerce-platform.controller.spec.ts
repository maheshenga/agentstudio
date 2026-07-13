import { TenantContext } from '../../common/tenant/tenant.context';
import { AppCommercePlatformController } from './app-commerce-platform.controller';
import { AppOrderService } from './services/app-order.service';
import { AppPricePlanService } from './services/app-price-plan.service';
import { AppRevenueLedgerService } from './services/app-revenue-ledger.service';
import { AppSettlementService } from './services/app-settlement.service';

describe('AppCommercePlatformController', () => {
  const pricePlanService = {
    listPlatformPlans: jest.fn(),
    savePlan: jest.fn(),
    updateStatus: jest.fn(),
  };
  const orderService = {
    listPlatformOrders: jest.fn(),
    listPlatformLicenses: jest.fn(),
    recordFullRefund: jest.fn(),
    revokeLicense: jest.fn(),
    toResponse: jest.fn((value) => value),
    toLicenseResponse: jest.fn((value) => value),
  };
  const revenueLedgerService = { getPlatformOverview: jest.fn() };
  const settlementService = {
    listPlatformSettlements: jest.fn(),
    createBatch: jest.fn(),
    approveBatch: jest.fn(),
    markPaid: jest.fn(),
    cancelBatch: jest.fn(),
  };
  let controller: AppCommercePlatformController;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(TenantContext, 'run').mockImplementation((_, callback) => callback() as any);
    pricePlanService.savePlan.mockResolvedValue({ code: 'pro_monthly' });
    pricePlanService.updateStatus.mockResolvedValue({ code: 'pro_monthly', status: 0 });
    orderService.listPlatformOrders.mockResolvedValue({ list: [], total: 0 });
    orderService.listPlatformLicenses.mockResolvedValue({ list: [], total: 0 });
    orderService.recordFullRefund.mockResolvedValue({ orderNo: 'AO1', status: 'refunded' });
    orderService.revokeLicense.mockResolvedValue({ id: 41, status: 'revoked' });
    revenueLedgerService.getPlatformOverview.mockResolvedValue({ totals: {}, apps: [] });
    settlementService.listPlatformSettlements.mockResolvedValue({ list: [], total: 0 });
    settlementService.createBatch.mockResolvedValue({ id: 51, status: 'draft' });
    settlementService.approveBatch.mockResolvedValue({ id: 51, status: 'approved' });
    settlementService.markPaid.mockResolvedValue({ id: 51, status: 'paid' });
    settlementService.cancelBatch.mockResolvedValue({ id: 51, status: 'cancelled' });
    controller = new AppCommercePlatformController(
      pricePlanService as unknown as AppPricePlanService,
      orderService as unknown as AppOrderService,
      revenueLedgerService as unknown as AppRevenueLedgerService,
      settlementService as unknown as AppSettlementService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('lists application prices outside tenant scope with the commerce view permission', async () => {
    pricePlanService.listPlatformPlans.mockResolvedValue([{ code: 'pro_monthly' }]);

    await expect(controller.listPrices('workflow', { userId: 9 } as any)).resolves.toMatchObject({
      data: [{ code: 'pro_monthly' }],
    });

    expect(pricePlanService.listPlatformPlans).toHaveBeenCalledWith('workflow');
    expect(Reflect.getMetadata('requirePermission', controller.listPrices)).toEqual([
      'app:commerce:view',
    ]);
  });

  it('creates and updates application prices with the authenticated platform operator', async () => {
    const createBody = {
      code: 'pro_monthly',
      name: 'Pro monthly',
      pricing_model: 'subscription',
      billing_period: 'monthly',
      amount_cents: 9900,
      developer_share_bps: 7000,
    } as any;
    const updateBody = { name: 'Pro monthly 2026', amount_cents: 12900 } as any;

    await controller.createPrice('workflow', createBody, { userId: 9 } as any);
    await controller.updatePrice('workflow', 'pro_monthly', updateBody, { userId: 9 } as any);

    expect(pricePlanService.savePlan).toHaveBeenNthCalledWith(1, 'workflow', createBody, 9);
    expect(pricePlanService.savePlan).toHaveBeenNthCalledWith(
      2,
      'workflow',
      expect.objectContaining({ code: 'pro_monthly', name: 'Pro monthly 2026' }),
      9,
      'pro_monthly',
    );
    expect(Reflect.getMetadata('requirePermission', controller.createPrice)).toEqual([
      'app:commerce:manage',
    ]);
    expect(Reflect.getMetadata('requirePermission', controller.updatePrice)).toEqual([
      'app:commerce:manage',
    ]);
  });

  it('updates price status through the backend-owned application and plan identity', async () => {
    await controller.updatePriceStatus(
      'workflow',
      'pro_monthly',
      { status: 0 },
      { userId: 9 } as any,
    );

    expect(pricePlanService.updateStatus).toHaveBeenCalledWith(
      'workflow',
      'pro_monthly',
      0,
      9,
    );
  });

  it('records a full refund only with the authenticated platform operator and bounded fields', async () => {
    await controller.refundOrder(
      'AO20260713000000001000001',
      { reason: 'Provider refund confirmed', provider_reference: 'REFUND-1' },
      { userId: 9 } as any,
    );

    expect(orderService.recordFullRefund).toHaveBeenCalledWith(
      'AO20260713000000001000001',
      9,
      'Provider refund confirmed',
      'REFUND-1',
    );
    expect(Reflect.getMetadata('requirePermission', controller.refundOrder)).toEqual([
      'app:commerce:manage',
    ]);
  });

  it('exposes platform order, license, revenue, and settlement operations outside tenant scope', async () => {
    await controller.listOrders({}, { userId: 9 } as any);
    await controller.listLicenses({}, { userId: 9 } as any);
    await controller.getRevenue({}, { userId: 9 } as any);
    await controller.listSettlements({}, { userId: 9 } as any);
    await controller.revokeLicense(41, { reason: 'Policy revocation' }, { userId: 9 } as any);
    await controller.createSettlement({ developer_id: 17, period: '2026-06' }, { userId: 9 } as any);
    await controller.approveSettlement(51, { note: 'Reviewed' }, { userId: 9 } as any);
    await controller.markSettlementPaid(
      51,
      { payment_reference: 'BANK-20260713-1' },
      { userId: 9 } as any,
    );

    expect(orderService.revokeLicense).toHaveBeenCalledWith(41, 9, 'Policy revocation');
    expect(settlementService.createBatch).toHaveBeenCalledWith(17, '2026-06', 9);
    expect(settlementService.approveBatch).toHaveBeenCalledWith(51, 9, 'Reviewed');
    expect(settlementService.markPaid).toHaveBeenCalledWith(51, 9, 'BANK-20260713-1');
    expect(Reflect.getMetadata('requirePermission', controller.listOrders)).toEqual([
      'app:commerce:view',
    ]);
    expect(Reflect.getMetadata('requirePermission', controller.createSettlement)).toEqual([
      'app:settlement:manage',
    ]);
  });
});
