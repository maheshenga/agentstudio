import { Test, TestingModule } from '@nestjs/testing';

import { UpdateAlipayConfigDto } from './dto/update-alipay-config.dto';
import { SaasPlatformController } from './saas-platform.controller';
import { SaasPaymentConfigService } from './services/saas-payment-config.service';
import { SaasModuleService } from './services/saas-module.service';
import { SaasPlanService } from './services/saas-plan.service';
import { SaasPlatformService } from './services/saas-platform.service';
import { SaasProvisioningService } from './services/saas-provisioning.service';
import { SaasRevenueReportService } from './services/saas-revenue-report.service';

describe('SaasPlatformController', () => {
  let controller: SaasPlatformController;

  const provisioning = {
    createTenantFromPlatform: jest.fn(),
  };
  const platformService = {
    getUsageOverview: jest.fn(),
    getOrderRiskOverview: jest.fn(),
    getSubscriptionLifecycleOverview: jest.fn(),
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
  const moduleService = {
    listPlatformModules: jest.fn(),
    createPlatformModule: jest.fn(),
    updatePlatformModule: jest.fn(),
    updatePlatformModuleStatus: jest.fn(),
    updatePlanModules: jest.fn(),
  };
  const revenueReportService = {
    getOverview: jest.fn(),
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
        { provide: SaasModuleService, useValue: moduleService },
        { provide: SaasRevenueReportService, useValue: revenueReportService },
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

  it('returns SaaS revenue overview outside tenant scope', async () => {
    revenueReportService.getOverview.mockResolvedValue({
      kpis: { today_revenue_cents: 1000, total_revenue_cents: 5000 },
      revenue_split: [],
      daily_trend: [],
      top_tenants: [],
      recent_paid_orders: [],
    });

    const result = await controller.revenueOverview({ userId: 1 } as any);

    expect(revenueReportService.getOverview).toHaveBeenCalled();
    expect(result.data).toEqual({
      kpis: { today_revenue_cents: 1000, total_revenue_cents: 5000 },
      revenue_split: [],
      daily_trend: [],
      top_tenants: [],
      recent_paid_orders: [],
    });
  });

  it('lists platform SaaS orders outside tenant scope', async () => {
    platformService.listOrders.mockResolvedValue({ list: [{ order_no: 'SO20260702000000001000001' }], total: 1, page: 1, limit: 20 });

    const result = await controller.listOrders({ page: '1' }, { userId: 1 } as any);

    expect(platformService.listOrders).toHaveBeenCalledWith({ page: '1' });
    expect(result.data).toEqual({ list: [{ order_no: 'SO20260702000000001000001' }], total: 1, page: 1, limit: 20 });
  });

  it('returns SaaS order risk overview outside tenant scope', async () => {
    platformService.getOrderRiskOverview.mockResolvedValue({
      pending_plan_orders: 2,
      pending_resource_pack_orders: 1,
      timeout_closed_plan_orders_7d: 3,
      timeout_closed_resource_pack_orders_7d: 4,
      tenant_cancelled_plan_orders_7d: 5,
      tenant_cancelled_resource_pack_orders_7d: 6,
    });

    const result = await controller.orderRiskOverview({ userId: 1 } as any);

    expect(platformService.getOrderRiskOverview).toHaveBeenCalled();
    expect(result.data).toEqual({
      pending_plan_orders: 2,
      pending_resource_pack_orders: 1,
      timeout_closed_plan_orders_7d: 3,
      timeout_closed_resource_pack_orders_7d: 4,
      tenant_cancelled_plan_orders_7d: 5,
      tenant_cancelled_resource_pack_orders_7d: 6,
    });
  });

  it('lists platform SaaS subscriptions outside tenant scope', async () => {
    platformService.listSubscriptions.mockResolvedValue({ list: [{ tenant_id: 12, status: 'active' }], total: 1, page: 1, limit: 20 });

    const result = await controller.listSubscriptions({ status: 'active' }, { userId: 1 } as any);

    expect(platformService.listSubscriptions).toHaveBeenCalledWith({ status: 'active' });
    expect(result.data).toEqual({ list: [{ tenant_id: 12, status: 'active' }], total: 1, page: 1, limit: 20 });
  });

  it('returns SaaS subscription lifecycle overview outside tenant scope', async () => {
    platformService.getSubscriptionLifecycleOverview.mockResolvedValue({
      active_count: 3,
      expiring_7_days_count: 1,
      expiring_30_days_count: 2,
      expired_count: 4,
    });

    const result = await controller.subscriptionLifecycleOverview({ userId: 1 } as any);

    expect(result.data).toEqual({
      active_count: 3,
      expiring_7_days_count: 1,
      expiring_30_days_count: 2,
      expired_count: 4,
    });
    expect(platformService.getSubscriptionLifecycleOverview).toHaveBeenCalled();
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

  it('lists platform SaaS modules outside tenant scope', async () => {
    moduleService.listPlatformModules.mockResolvedValue([{ code: 'crm' }]);

    const result = await controller.listModules({ status: '1' }, { userId: 1 } as any);

    expect(moduleService.listPlatformModules).toHaveBeenCalledWith({ status: '1' });
    expect(result.data).toEqual([{ code: 'crm' }]);
  });

  it('creates a platform SaaS module outside tenant scope', async () => {
    moduleService.createPlatformModule.mockResolvedValue({ code: 'crm' });
    const body = { code: 'crm', name: 'CRM' };

    const result = await controller.createModule(body as any, { userId: 1 } as any);

    expect(moduleService.createPlatformModule).toHaveBeenCalledWith(body);
    expect(result.data).toEqual({ code: 'crm' });
  });

  it('updates a platform SaaS module outside tenant scope', async () => {
    moduleService.updatePlatformModule.mockResolvedValue({ code: 'crm', name: 'CRM Plus' });
    const body = { name: 'CRM Plus' };

    const result = await controller.updateModule('crm', body as any, { userId: 1 } as any);

    expect(moduleService.updatePlatformModule).toHaveBeenCalledWith('crm', body);
    expect(result.data).toEqual({ code: 'crm', name: 'CRM Plus' });
  });

  it('updates platform SaaS module status outside tenant scope', async () => {
    moduleService.updatePlatformModuleStatus.mockResolvedValue({ code: 'crm', status: 0 });

    const result = await controller.updateModuleStatus('crm', { status: 0 } as any, { userId: 1 } as any);

    expect(moduleService.updatePlatformModuleStatus).toHaveBeenCalledWith('crm', 0);
    expect(result.data).toEqual({ code: 'crm', status: 0 });
  });

  it('updates plan modules outside tenant scope', async () => {
    moduleService.updatePlanModules.mockResolvedValue({ code: 'pro', module_codes: ['crm'] });

    const result = await controller.updatePlanModules('pro', { module_codes: ['crm'] }, { userId: 1 } as any);

    expect(moduleService.updatePlanModules).toHaveBeenCalledWith('pro', ['crm']);
    expect(result.data).toEqual({ code: 'pro', module_codes: ['crm'] });
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
