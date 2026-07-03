import configuration from './configuration';

describe('Configuration', () => {
  it('should return default values when env is not set', () => {
    const config = configuration();
    expect(config).toHaveProperty('app');
    expect(config).toHaveProperty('database');
    expect(config).toHaveProperty('jwt');
    expect(config).toHaveProperty('redis');
    expect(config).toHaveProperty('cors');
    expect(config).toHaveProperty('swagger');
    expect(config).toHaveProperty('log');
    expect(config).toHaveProperty('payment');

    expect(config.app.name).toBe('nextjs-server');
    expect(config.app.port).toBe(3000);
    expect(config.database.host).toBe('127.0.0.1');
    expect(config.swagger.enabled).toBe(false);
    expect(config.payment.alipay.enabled).toBe(false);
    expect(config.payment.alipay.gatewayUrl).toBe('https://openapi-sandbox.dl.alipaydev.com/gateway.do');
  });

  it('should respect environment variables', () => {
    process.env.APP_NAME = 'test-app';
    process.env.APP_PORT = '4000';
    process.env.ALIPAY_ENABLED = 'true';
    process.env.ALIPAY_APP_ID = '2026070200000001';
    process.env.ALIPAY_NOTIFY_URL = 'http://127.0.0.1:8181/api/saas/payment/alipay/notify';

    const config = configuration();
    expect(config.app.name).toBe('test-app');
    expect(config.app.port).toBe(4000);
    expect(config.payment.alipay.enabled).toBe(true);
    expect(config.payment.alipay.appId).toBe('2026070200000001');
    expect(config.payment.alipay.notifyUrl).toBe('http://127.0.0.1:8181/api/saas/payment/alipay/notify');

    delete process.env.APP_NAME;
    delete process.env.APP_PORT;
    delete process.env.ALIPAY_ENABLED;
    delete process.env.ALIPAY_APP_ID;
    delete process.env.ALIPAY_NOTIFY_URL;
  });
});
