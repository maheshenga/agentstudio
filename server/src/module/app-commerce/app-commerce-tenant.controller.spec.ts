import { getTenantId } from '../../common/utils/tenant.util';
import { AppCommerceTenantController } from './app-commerce-tenant.controller';
import { AppLicenseAccessService } from './services/app-license-access.service';
import { AppPricePlanService } from './services/app-price-plan.service';

jest.mock('../../common/utils/tenant.util', () => ({
  getTenantId: jest.fn(),
}));

describe('AppCommerceTenantController', () => {
  const pricePlanService = { findTenantApp: jest.fn() };
  const accessService = { getAccessState: jest.fn() };
  const mockedGetTenantId = getTenantId as jest.MockedFunction<typeof getTenantId>;
  let controller: AppCommerceTenantController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetTenantId.mockReturnValue(23);
    pricePlanService.findTenantApp.mockResolvedValue({ id: 7, code: 'workflow' });
    accessService.getAccessState.mockResolvedValue({
      commerce_enabled: true,
      access_status: 'purchase_required',
      can_install: false,
      can_open: false,
      action: 'purchase',
      license_expires_at: null,
      plans: [],
    });
    controller = new AppCommerceTenantController(
      pricePlanService as unknown as AppPricePlanService,
      accessService as unknown as AppLicenseAccessService,
    );
  });

  it('evaluates commerce access with the authenticated tenant identity', async () => {
    await expect(controller.getCommerce('workflow')).resolves.toMatchObject({
      data: { access_status: 'purchase_required' },
    });

    expect(pricePlanService.findTenantApp).toHaveBeenCalledWith('workflow');
    expect(accessService.getAccessState).toHaveBeenCalledWith(
      23,
      expect.objectContaining({ id: 7, code: 'workflow' }),
    );
    expect(Reflect.getMetadata('requirePermission', controller.getCommerce)).toEqual([
      'app:tenant:marketplace',
    ]);
  });

  it('fails closed before querying an application when tenant context is absent', async () => {
    mockedGetTenantId.mockReturnValue(null);

    await expect(controller.getCommerce('workflow')).resolves.toMatchObject({ code: 401 });
    expect(pricePlanService.findTenantApp).not.toHaveBeenCalled();
    expect(accessService.getAccessState).not.toHaveBeenCalled();
  });
});
