import { TenantContext } from '../../common/tenant/tenant.context';
import { AppCommercePlatformController } from './app-commerce-platform.controller';
import { AppPricePlanService } from './services/app-price-plan.service';

describe('AppCommercePlatformController', () => {
  const pricePlanService = {
    listPlatformPlans: jest.fn(),
    savePlan: jest.fn(),
    updateStatus: jest.fn(),
  };
  let controller: AppCommercePlatformController;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(TenantContext, 'run').mockImplementation((_, callback) => callback() as any);
    pricePlanService.savePlan.mockResolvedValue({ code: 'pro_monthly' });
    pricePlanService.updateStatus.mockResolvedValue({ code: 'pro_monthly', status: 0 });
    controller = new AppCommercePlatformController(
      pricePlanService as unknown as AppPricePlanService,
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
});
