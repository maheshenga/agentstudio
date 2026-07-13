import { getTenantId } from '../../common/utils/tenant.util';
import { AppCommerceTenantController } from './app-commerce-tenant.controller';
import { AppLicenseAccessService } from './services/app-license-access.service';
import { AppOrderService } from './services/app-order.service';
import { AppPricePlanService } from './services/app-price-plan.service';

jest.mock('../../common/utils/tenant.util', () => ({
  getTenantId: jest.fn(),
}));

describe('AppCommerceTenantController', () => {
  const pricePlanService = { findTenantApp: jest.fn() };
  const accessService = { getAccessState: jest.fn() };
  const orderService = {
    createTenantOrder: jest.fn(),
    getTenantOrder: jest.fn(),
    listTenantOrders: jest.fn(),
    startTrial: jest.fn(),
    toLicenseResponse: jest.fn(),
    toResponse: jest.fn(),
  };
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
    orderService.createTenantOrder.mockResolvedValue({ orderNo: 'AO1' });
    orderService.toResponse.mockImplementation((order) => ({ order_no: order.orderNo }));
    orderService.startTrial.mockResolvedValue({ id: 41, status: 'trialing' });
    orderService.toLicenseResponse.mockImplementation((license) => ({
      id: license.id,
      status: license.status,
    }));
    orderService.listTenantOrders.mockResolvedValue({ list: [], total: 0, page: 1, limit: 20 });
    orderService.getTenantOrder.mockResolvedValue({ order_no: 'AO1' });
    controller = new AppCommerceTenantController(
      pricePlanService as unknown as AppPricePlanService,
      accessService as unknown as AppLicenseAccessService,
      orderService as unknown as AppOrderService,
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

  it('creates an order and starts a trial with authoritative tenant and user identity', async () => {
    await controller.createOrder(
      'workflow',
      { price_plan_code: 'pro_monthly', payment_method: 'alipay' },
      { userId: 9 } as any,
    );
    await controller.startTrial(
      'workflow',
      { price_plan_code: 'pro_monthly' },
      { userId: 9 } as any,
    );

    expect(orderService.createTenantOrder).toHaveBeenCalledWith(
      23,
      9,
      'workflow',
      { price_plan_code: 'pro_monthly', payment_method: 'alipay' },
    );
    expect(orderService.startTrial).toHaveBeenCalledWith(23, 9, 'workflow', 'pro_monthly');
    expect(Reflect.getMetadata('requirePermission', controller.createOrder)).toEqual([
      'app:tenant:purchase',
    ]);
    expect(Reflect.getMetadata('requirePermission', controller.startTrial)).toEqual([
      'app:tenant:purchase',
    ]);
  });

  it('lists and reads only the authenticated tenant orders', async () => {
    await controller.listOrders({ page: 1, limit: 20 });
    await controller.getOrder('AO1');

    expect(orderService.listTenantOrders).toHaveBeenCalledWith(23, { page: 1, limit: 20 });
    expect(orderService.getTenantOrder).toHaveBeenCalledWith(23, 'AO1');
    expect(Reflect.getMetadata('requirePermission', controller.listOrders)).toEqual([
      'app:tenant:orders',
    ]);
    expect(Reflect.getMetadata('requirePermission', controller.getOrder)).toEqual([
      'app:tenant:orders',
    ]);
  });

  it('fails closed before order or trial mutations when user identity is absent', async () => {
    await expect(
      controller.createOrder(
        'workflow',
        { price_plan_code: 'pro_monthly', payment_method: 'alipay' },
        {} as any,
      ),
    ).resolves.toMatchObject({ code: 401 });
    await expect(
      controller.startTrial('workflow', { price_plan_code: 'pro_monthly' }, {} as any),
    ).resolves.toMatchObject({ code: 401 });

    expect(orderService.createTenantOrder).not.toHaveBeenCalled();
    expect(orderService.startTrial).not.toHaveBeenCalled();
  });
});
