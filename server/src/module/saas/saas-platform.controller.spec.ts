import { Test, TestingModule } from '@nestjs/testing';

import { UpdateAlipayConfigDto } from './dto/update-alipay-config.dto';
import { SaasPlatformController } from './saas-platform.controller';
import { SaasPaymentConfigService } from './services/saas-payment-config.service';
import { SaasPlanService } from './services/saas-plan.service';
import { SaasPlatformService } from './services/saas-platform.service';
import { SaasProvisioningService } from './services/saas-provisioning.service';

describe('SaasPlatformController', () => {
  let controller: SaasPlatformController;

  const provisioning = {
    createTenantFromPlatform: jest.fn(),
  };
  const platformService = {
    getUsageOverview: jest.fn(),
    listOrders: jest.fn(),
    listSubscriptions: jest.fn(),
    findOrder: jest.fn(),
    findSubscription: jest.fn(),
    listResourcePacks: jest.fn(),
    listResourcePackOrders: jest.fn(),
    findResourcePackOrder: jest.fn(),
  };
  const paymentConfigService = {
    getAlipayConfigStatus: jest.fn(),
    updateAlipayConfig: jest.fn(),
  };
  const planService = {
    listPlatformPlans: jest.fn(),
    createPlatformPlan: jest.fn(),
    findPlatformPlan: jest.fn(),
    updatePlatformPlan: jest.fn(),
    updatePlatformPlanStatus: jest.fn(),
    updatePlatformPlanQuotas: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaasPlatformController],
      providers: [
        { provide: SaasProvisioningService, useValue: provisioning },
        { provide: SaasPlatformService, useValue: platformService },
        { provide: SaasPaymentConfigService, useValue: paymentConfigService },
        { provide: SaasPlanService, useValue: planService },
      ],
    }).compile();

    controller = module.get(SaasPlatformController);
  });

  it('returns platform SaaS usage overview outside tenant scope', async () => {
    platformService.getUsageOverview.mockResolvedValue({
      kpis: { active_subscriptions: 1, total_paid_amount_cents: 99000 },
      quota_summary: [],
      plan_distribution: [],
      recent_plan_orders: [],
      recent_resource_pack_orders: [],
    });

    const result = await controller.usageOverview({ userId: 1 } as any);

    expect(platformService.getUsageOverview).toHaveBeenCalled();
    expect(result.data).toEqual({
      kpis: { active_subscriptions: 1, total_paid_amount_cents: 99000 },
      quota_summary: [],
      plan_distribution: [],
      recent_plan_orders: [],
      recent_resource_pack_orders: [],
    });
  });

  it('lists platform SaaS orders outside tenant scope', async () => {
    platformService.listOrders.mockResolvedValue({ list: [{ order_no: 'SO20260702000000001000001' }], total: 1, page: 1, limit: 20 });

    const result = await controller.listOrders({ page: '1' }, { userId: 1 } as any);

    expect(platformService.listOrders).toHaveBeenCalledWith({ page: '1' });
    expect(result.data).toEqual({ list: [{ order_no: 'SO20260702000000001000001' }], total: 1, page: 1, limit: 20 });
  });

  it('lists platform SaaS subscriptions outside tenant scope', async () => {
    platformService.listSubscriptions.mockResolvedValue({ list: [{ tenant_id: 12, status: 'active' }], total: 1, page: 1, limit: 20 });

    const result = await controller.listSubscriptions({ status: 'active' }, { userId: 1 } as any);

    expect(platformService.listSubscriptions).toHaveBeenCalledWith({ status: 'active' });
    expect(result.data).toEqual({ list: [{ tenant_id: 12, status: 'active' }], total: 1, page: 1, limit: 20 });
  });

  it('lists platform SaaS plans outside tenant scope', async () => {
    planService.listPlatformPlans.mockResolvedValue({ list: [{ code: 'pro' }], total: 1, page: 1, limit: 20 });

    const result = await controller.listPlans({ status: '1' }, { userId: 1 } as any);

    expect(planService.listPlatformPlans).toHaveBeenCalledWith({ status: '1' });
    expect(result.data.list).toEqual([{ code: 'pro' }]);
  });

  it('creates a platform SaaS plan outside tenant scope', async () => {
    planService.createPlatformPlan.mockResolvedValue({ code: 'team' });

    const result = await controller.createPlan({ code: 'team', name: 'Team' } as any, { userId: 1 } as any);

    expect(planService.createPlatformPlan).toHaveBeenCalledWith({ code: 'team', name: 'Team' });
    expect(result.data).toEqual({ code: 'team' });
  });

  it('updates platform SaaS plan quotas outside tenant scope', async () => {
    planService.updatePlatformPlanQuotas.mockResolvedValue({ code: 'pro', quotas: [] });

    const body = { quotas: [{ quota_type: 'tokens', total_quota: 1000 }] };
    const result = await controller.updatePlanQuotas('pro', body as any, { userId: 1 } as any);

    expect(planService.updatePlatformPlanQuotas).toHaveBeenCalledWith('pro', body);
    expect(result.data).toEqual({ code: 'pro', quotas: [] });
  });

  it('returns platform SaaS order detail outside tenant scope', async () => {
    platformService.findOrder.mockResolvedValue({ order_no: 'SO1' });

    const result = await controller.getOrder('SO1', { userId: 1 } as any);

    expect(platformService.findOrder).toHaveBeenCalledWith('SO1');
    expect(result.data).toEqual({ order_no: 'SO1' });
  });

  it('lists platform SaaS resource packs outside tenant scope', async () => {
    platformService.listResourcePacks.mockResolvedValue({ list: [{ code: 'tokens_1m' }], total: 1, page: 1, limit: 20 });

    const result = await controller.listResourcePacks({ resource_type: 'tokens' }, { userId: 1 } as any);

    expect(platformService.listResourcePacks).toHaveBeenCalledWith({ resource_type: 'tokens' });
    expect(result.data).toEqual({ list: [{ code: 'tokens_1m' }], total: 1, page: 1, limit: 20 });
  });

  it('lists platform SaaS resource pack orders outside tenant scope', async () => {
    platformService.listResourcePackOrders.mockResolvedValue({ list: [{ order_no: 'RPO20260703120000001000001' }], total: 1, page: 1, limit: 20 });

    const result = await controller.listResourcePackOrders({ status: 'paid' }, { userId: 1 } as any);

    expect(platformService.listResourcePackOrders).toHaveBeenCalledWith({ status: 'paid' });
    expect(result.data).toEqual({ list: [{ order_no: 'RPO20260703120000001000001' }], total: 1, page: 1, limit: 20 });
  });

  it('returns platform SaaS resource pack order detail outside tenant scope', async () => {
    platformService.findResourcePackOrder.mockResolvedValue({ order_no: 'RPO1' });

    const result = await controller.getResourcePackOrder('RPO1', { userId: 1 } as any);

    expect(platformService.findResourcePackOrder).toHaveBeenCalledWith('RPO1');
    expect(result.data).toEqual({ order_no: 'RPO1' });
  });

  it('returns platform Alipay config status outside tenant scope', async () => {
    paymentConfigService.getAlipayConfigStatus.mockResolvedValue({ provider: 'alipay', configured: false });

    const result = await controller.getAlipayConfig({ userId: 1 } as any);

    expect(paymentConfigService.getAlipayConfigStatus).toHaveBeenCalled();
    expect(result.data).toEqual({ provider: 'alipay', configured: false });
  });

  it('updates platform Alipay config outside tenant scope', async () => {
    const body: UpdateAlipayConfigDto = { enabled: true, app_id: '2026070200000001' };
    paymentConfigService.updateAlipayConfig.mockResolvedValue({ provider: 'alipay', configured: true });

    const result = await controller.updateAlipayConfig(body, { userId: 1 } as any);

    expect(paymentConfigService.updateAlipayConfig).toHaveBeenCalledWith(body);
    expect(result.data).toEqual({ provider: 'alipay', configured: true });
  });
});