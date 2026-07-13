import { TenantContext } from '../../common/tenant/tenant.context';
import { AppCommerceDeveloperController } from './app-commerce-developer.controller';
import { AppRevenueLedgerService } from './services/app-revenue-ledger.service';
import { AppSettlementService } from './services/app-settlement.service';

describe('AppCommerceDeveloperController', () => {
  const revenueService = { getDeveloperOverview: jest.fn() };
  const settlementService = { listDeveloperSettlements: jest.fn() };
  let controller: AppCommerceDeveloperController;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(TenantContext, 'run').mockImplementation((_, callback) => callback() as any);
    revenueService.getDeveloperOverview.mockResolvedValue({ totals: {}, apps: [] });
    settlementService.listDeveloperSettlements.mockResolvedValue({ list: [], total: 0 });
    controller = new AppCommerceDeveloperController(
      revenueService as unknown as AppRevenueLedgerService,
      settlementService as unknown as AppSettlementService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('scopes revenue and settlement history to the authenticated developer user', async () => {
    await controller.getRevenue({}, { userId: 17 } as any);
    await controller.listSettlements({}, { userId: 17 } as any);

    expect(revenueService.getDeveloperOverview).toHaveBeenCalledWith(17, {});
    expect(settlementService.listDeveloperSettlements).toHaveBeenCalledWith(17, {});
    expect(Reflect.getMetadata('requirePermission', controller.getRevenue)).toEqual([
      'app:developer:revenue',
    ]);
    expect(Reflect.getMetadata('requirePermission', controller.listSettlements)).toEqual([
      'app:developer:revenue',
    ]);
    expect(TenantContext.run).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: undefined, userId: 17, ignoreTenant: true }),
      expect.any(Function),
    );
  });
});
