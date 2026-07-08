import { ConfigService } from '@nestjs/config';

import { DependencyMonitorService } from '../../../logging/dependency-monitor.service';
import { SaasPaymentConfigService } from './saas-payment-config.service';
import { SaasRuntimeHealthService } from './saas-runtime-health.service';

describe('SaasRuntimeHealthService', () => {
  const configValues: Record<string, unknown> = {
    'app.name': 'AgentStudio',
    'app.env': 'development',
    'app.debug': true,
    'database.host': '127.0.0.1',
    'database.port': 3306,
    'database.username': 'root',
    'database.password': 'change_me',
    'database.name': 'fssoa-net',
    'jwt.secret': 'this_is_jwt_secret_change_me_32_chars_min',
    'jwt.expiresIn': '2h',
    'redis.host': '127.0.0.1',
    'redis.port': 6379,
    'redis.db': 0,
    'payment.devConfirmEnabled': true,
  };

  const createConfigService = (overrides: Record<string, unknown> = {}) =>
    ({
      get: jest.fn((key: string, fallback?: unknown) => ({ ...configValues, ...overrides })[key] ?? fallback),
    }) as unknown as ConfigService;

  const createDependencyMonitorService = (
    overrides: Partial<ReturnType<DependencyMonitorService['getSnapshot']>> = {},
  ) =>
    ({
      getSnapshot: jest.fn(() => ({
        mysql: { name: 'mysql', status: 'up', lastCheckedAt: '2026-07-08T08:00:00.000Z' },
        redis: { name: 'redis', status: 'up', lastCheckedAt: '2026-07-08T08:00:00.000Z' },
        ...overrides,
      })),
    }) as unknown as DependencyMonitorService;

  const createPaymentConfigService = (status: Record<string, unknown> = {}) =>
    ({
      getAlipayConfigStatus: jest.fn().mockResolvedValue({
        provider: 'alipay',
        enabled: true,
        configured: true,
        missing_keys: [],
        app_id_masked: '2026********0001',
        gateway_url: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
        notify_url_configured: true,
        return_url_configured: true,
        private_key_configured: true,
        public_key_configured: true,
        ...status,
      }),
    }) as unknown as SaasPaymentConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LOGIN_CAPTCHA_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.LOGIN_CAPTCHA_ENABLED;
  });

  it('returns a sanitized ready SaaS runtime health report', async () => {
    const paymentConfigService = createPaymentConfigService();
    const service = new SaasRuntimeHealthService(
      createConfigService(),
      createDependencyMonitorService(),
      paymentConfigService,
    );

    const report = await service.getPlatformRuntimeHealth();

    expect(report.status).toBe('ready');
    expect(report.environment).toEqual({
      app_name: 'AgentStudio',
      node_env: 'development',
      debug_enabled: true,
      login_captcha_enabled: true,
      dev_payment_confirm_enabled: true,
    });
    expect(report.dependencies.mysql.status).toBe('up');
    expect(report.dependencies.redis.status).toBe('up');
    expect(report.payment.alipay.configured).toBe(true);
    expect(report.required_env.missing_keys).toEqual([]);
    expect(paymentConfigService.getAlipayConfigStatus).toHaveBeenCalled();
    expect(JSON.stringify(report)).not.toContain('this_is_jwt_secret_change_me_32_chars_min');
    expect(JSON.stringify(report)).not.toContain('change_me');
  });

  it('filters accidental secret fields from payment config status', async () => {
    const service = new SaasRuntimeHealthService(
      createConfigService(),
      createDependencyMonitorService(),
      createPaymentConfigService({
        app_id: '2026070800000001',
        private_key: 'raw-private-key',
        public_key: 'raw-public-key',
        notify_url: 'https://example.com/alipay/notify?token=callback-secret',
        return_url: 'https://example.com/alipay/return?token=return-secret',
      }),
    );

    const report = await service.getPlatformRuntimeHealth();

    expect(report.payment.alipay).toEqual(
      expect.objectContaining({
        provider: 'alipay',
        app_id_masked: '2026********0001',
      }),
    );
    expect(JSON.stringify(report)).not.toContain('raw-private-key');
    expect(JSON.stringify(report)).not.toContain('raw-public-key');
    expect(JSON.stringify(report)).not.toContain('2026070800000001');
    expect(JSON.stringify(report)).not.toContain('callback-secret');
    expect(JSON.stringify(report)).not.toContain('return-secret');
  });

  it('marks runtime health blocked when required config and dependencies are missing', async () => {
    const service = new SaasRuntimeHealthService(
      createConfigService({
        'database.password': '',
        'jwt.secret': '',
      }),
      createDependencyMonitorService({
        mysql: { name: 'mysql', status: 'down', lastError: 'connect ECONNREFUSED' },
        redis: { name: 'redis', status: 'down', lastError: 'NOAUTH Authentication required' },
      }),
      createPaymentConfigService({
        enabled: false,
        configured: false,
        missing_keys: ['ALIPAY_ENABLED', 'ALIPAY_APP_ID'],
      }),
    );

    const report = await service.getPlatformRuntimeHealth();

    expect(report.status).toBe('blocked');
    expect(report.required_env.missing_keys).toEqual(['DB_PASSWORD', 'JWT_SECRET']);
    expect(report.payment.alipay.configured).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'mysql', status: 'down' }),
        expect.objectContaining({ key: 'redis', status: 'down' }),
        expect.objectContaining({ key: 'JWT_SECRET', status: 'missing' }),
      ]),
    );
  });
});
