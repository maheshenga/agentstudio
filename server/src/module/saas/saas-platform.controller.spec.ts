import { Test, TestingModule } from '@nestjs/testing';

import { UpdateAlipayConfigDto } from './dto/update-alipay-config.dto';
import { SaasPlatformController } from './saas-platform.controller';
import { SaasPaymentConfigService } from './services/saas-payment-config.service';
import { SaasModuleService } from './services/saas-module.service';
import { SaasPlanService } from './services/saas-plan.service';
import { SaasPlatformService } from './services/saas-platform.service';
import { SaasProvisioningService } from './services/saas-provisioning.service';
import { SaasResourcePackService } from './services/saas-resource-pack.service';
import { SaasRevenueReportService } from './services/saas-revenue-report.service';
import { SaasRuntimeHealthService } from './services/saas-runtime-health.service';

describe('SaasPlatformController', () => {
  let controller: SaasPlatformController;

  const provisioning = {
    createTenantFromPlatform: jest.fn(),
  };
  const platformService = {
    getUsageOverview: jest.fn(),
    getOrderRiskOverview: jest.fn(),
    getPaymentReconciliationOverview: jest.fn(),
    listPaymentNotifyLogs: jest.fn(),
    getSubscriptionLifecycleOverview: jest.fn(),
    listTenants: jest.fn(),
    listOrders: jest.fn(),
    listSubscriptions: jest.fn(),
    findOrder: jest.fn(),
    findSubscription: jest.fn(),
    listResourcePacks: jest.fn(),
    listResourcePackOrders: jest.fn(),
    listQuotaLedgers: jest.fn(),
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
  const resourcePackService = {
    createPlatformResourcePack: jest.fn(),
    updatePlatformResourcePack: jest.fn(),
    updatePlatformResourcePackStatus: jest.fn(),
  };
  const revenueReportService = {
    getOverview: jest.fn(),
  };
  const runtimeHealthService = {
    getPlatformRuntimeHealth: jest.fn(),
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
        { provide: SaasResourcePackService, useValue: resourcePackService },
        { provide: SaasRevenueReportService, useValue: revenueReportService },
        { provide: SaasRuntimeHealthService, useValue: runtimeHealthService },
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

  it('returns SaaS runtime health outside tenant scope', async () => {
    runtimeHealthService.getPlatformRuntimeHealth.mockResolvedValue({
      status: 'degraded',
      required_env: { total_required: 10, configured_keys: ['DB_HOST'], missing_keys: [] },
    });

    const result = await controller.runtimeHealth({ userId: 1 } as any);

    expect(runtimeHealthService.getPlatformRuntimeHealth).toHaveBeenCalled();
    expect(result.data).toEqual({
      status: 'degraded',
      required_env: { total_required: 10, configured_keys: ['DB_HOST'], missing_keys: [] },
    });
  });

  it('returns payment notify logs outside tenant scope', async () => {
    platformService.listPaymentNotifyLogs.mockResolvedValue({
      list: [{ order_no: 'SO20260709000000001000001', result: 'confirmed' }],
      total: 1,
      page: 1,
      limit: 10,
    });

    const result = await controller.paymentNotifyLogs({ page: '1' } as any, { userId: 1 } as any);

    expect(platformService.listPaymentNotifyLogs).toHaveBeenCalledWith({ page: '1' });
    expect(result.data).toEqual({
      list: [{ order_no: 'SO20260709000000001000001', result: 'confirmed' }],
      total: 1,
      page: 1,
      limit: 10,
    });
  });

  it('lists platform SaaS orders outside tenant scope', async () => {
    platformService.listOrders.mockResolvedValue({ list: [{ order_no: 'SO20260702000000001000001' }], total: 1, page: 1, limit: 20 });

    const result = await controller.listOrders({ page: '1' }, { userId: 1 } as any);

    expect(platformService.listOrders).toHaveBeenCalledWith({ page: '1' });
    expect(result.data).toEqual({ list: [{ order_no: 'SO20260702000000001000001' }], total: 1, page: 1, limit: 20 });
  });

  it('lists platform tenants outside tenant scope', async () => {
    platformService.listTenants.mockResolvedValue({
      list: [{ id: 101, tenant_name: 'Acme Studio', user_count: 2, plan_code: 'pro' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.listTenants({ page: '1' } as any, { userId: 1 } as any);

    expect(platformService.listTenants).toHaveBeenCalledWith({ page: '1' });
    expect(result.data).toEqual({
      list: [{ id: 101, tenant_name: 'Acme Studio', user_count: 2, plan_code: 'pro' }],
      total: 1,
      page: 1,
      limit: 20,
    });
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

  it('returns SaaS payment reconciliation overview outside tenant scope', async () => {
    platformService.getPaymentReconciliationOverview.mockResolvedValue({
      checked_at: new Date('2026-07-04T12:00:00.000Z'),
      stale_minutes: 120,
      stale_plan_payment_count: 1,
      stale_resource_pack_payment_count: 2,
      recent_plan_orders: [],
      recent_resource_pack_orders: [],
    });

    const result = await controller.paymentReconciliationOverview({ stale_minutes: '120' }, { userId: 1 } as any);

    expect(platformService.getPaymentReconciliationOverview).toHaveBeenCalledWith({ stale_minutes: '120' });
    expect(result.data).toMatchObject({
      stale_minutes: 120,
      stale_plan_payment_count: 1,
      stale_resource_pack_payment_count: 2,
    });
  });

  it('runs a SaaS payment reconciliation scan outside tenant scope', async () => {
    platformService.getPaymentReconciliationOverview.mockResolvedValue({
      checked_at: new Date('2026-07-04T12:00:00.000Z'),
      stale_minutes: 120,
      stale_plan_payment_count: 0,
      stale_resource_pack_payment_count: 0,
      recent_plan_orders: [],
      recent_resource_pack_orders: [],
    });

    const result = await controller.scanPaymentReconciliation({ stale_minutes: 120 } as any, { userId: 1 } as any);

    expect(platformService.getPaymentReconciliationOverview).toHaveBeenCalledWith({ stale_minutes: 120 });
    expect(result.data).toMatchObject({
      stale_minutes: 120,
      stale_plan_payment_count: 0,
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

  it('creates a platform SaaS resource pack outside tenant scope', async () => {
    const body = {
      code: 'tokens_2m',
      name: 'Tokens 2M',
      resource_type: 'tokens',
      quota_amount: 2000000,
      price_cents: 29900,
    };
    resourcePackService.createPlatformResourcePack.mockResolvedValue({ code: 'tokens_2m' });

    const result = await controller.createResourcePack(body as any, { userId: 1 } as any);

    expect(resourcePackService.createPlatformResourcePack).toHaveBeenCalledWith(body);
    expect(result.data).toEqual({ code: 'tokens_2m' });
  });

  it('updates a platform SaaS resource pack outside tenant scope', async () => {
    const body = { name: 'Tokens 2M', quota_amount: 2000000 };
    resourcePackService.updatePlatformResourcePack.mockResolvedValue({ code: 'tokens_1m', name: 'Tokens 2M' });

    const result = await controller.updateResourcePack('tokens_1m', body as any, { userId: 1 } as any);

    expect(resourcePackService.updatePlatformResourcePack).toHaveBeenCalledWith('tokens_1m', body);
    expect(result.data).toEqual({ code: 'tokens_1m', name: 'Tokens 2M' });
  });

  it('updates a platform SaaS resource pack status outside tenant scope', async () => {
    resourcePackService.updatePlatformResourcePackStatus.mockResolvedValue({ code: 'tokens_1m', status: 0 });

    const result = await controller.updateResourcePackStatus('tokens_1m', { status: 0 } as any, { userId: 1 } as any);

    expect(resourcePackService.updatePlatformResourcePackStatus).toHaveBeenCalledWith('tokens_1m', 0);
    expect(result.data).toEqual({ code: 'tokens_1m', status: 0 });
  });

  it('lists platform SaaS resource pack orders outside tenant scope', async () => {
    platformService.listResourcePackOrders.mockResolvedValue({ list: [{ order_no: 'RPO20260703120000001000001' }], total: 1, page: 1, limit: 20 });

    const result = await controller.listResourcePackOrders({ status: 'paid' }, { userId: 1 } as any);

    expect(platformService.listResourcePackOrders).toHaveBeenCalledWith({ status: 'paid' });
    expect(result.data).toEqual({ list: [{ order_no: 'RPO20260703120000001000001' }], total: 1, page: 1, limit: 20 });
  });

  it('lists platform SaaS quota ledgers outside tenant scope', async () => {
    const query = { page: '2', limit: '10', tenant_id: '88', resource_type: 'tokens', change_type: 'consume', source_type: 'ai_chat', source_id: 'chat-1' };
    platformService.listQuotaLedgers.mockResolvedValue({ list: [{ id: 9, tenant_id: 88, source_id: 'chat-1' }], total: 1, page: 2, limit: 10 });

    const result = await controller.quotaLedgers(query, { userId: 1 } as any);

    expect(platformService.listQuotaLedgers).toHaveBeenCalledWith(query);
    expect(result.data).toEqual({ list: [{ id: 9, tenant_id: 88, source_id: 'chat-1' }], total: 1, page: 2, limit: 10 });
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
