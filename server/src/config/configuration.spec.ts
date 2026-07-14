import configuration from './configuration';
import { envValidationSchema } from './env.validation';

const SERVICE_ENV_KEYS = [
  'APP_SERVICE_RUNTIME_DRIVER',
  'APP_SERVICE_PODMAN_COMMAND',
  'APP_SERVICE_PODMAN_IMAGE',
  'APP_SERVICE_PODMAN_HOME',
  'APP_SERVICE_PODMAN_XDG_RUNTIME_DIR',
  'APP_SERVICE_SOCKET_DIR',
  'APP_SERVICE_CPU_LIMIT',
  'APP_SERVICE_PIDS_LIMIT',
  'APP_SERVICE_TMPFS_MB',
  'APP_SERVICE_CONTAINER_UID',
] as const;

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
    expect(config.payment.alipay.gatewayUrl).toBe(
      'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
    );
    expect(config.appMarketplace.serviceRuntime).toMatchObject({
      driver: 'pm2',
      podmanCommand: '/usr/bin/podman',
      podmanImage: '',
      podmanHome: '',
      podmanXdgRuntimeDir: '',
      socketDir: '',
      cpuLimit: 1,
      pidsLimit: 64,
      tmpfsMb: 16,
      containerUid: 65532,
    });
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
    expect(config.payment.alipay.notifyUrl).toBe(
      'http://127.0.0.1:8181/api/saas/payment/alipay/notify',
    );

    delete process.env.APP_NAME;
    delete process.env.APP_PORT;
    delete process.env.ALIPAY_ENABLED;
    delete process.env.ALIPAY_APP_ID;
    delete process.env.ALIPAY_NOTIFY_URL;
  });

  it('maps Podman service runtime environment values without exposing them elsewhere', () => {
    const values = {
      APP_SERVICE_RUNTIME_DRIVER: 'podman',
      APP_SERVICE_PODMAN_COMMAND: '/usr/bin/podman',
      APP_SERVICE_PODMAN_IMAGE: `registry.example/runtime@sha256:${'a'.repeat(64)}`,
      APP_SERVICE_PODMAN_HOME: '/home/agentstudio_app',
      APP_SERVICE_PODMAN_XDG_RUNTIME_DIR: '/run/user/1001',
      APP_SERVICE_SOCKET_DIR: '/home/agentstudio_app/sockets',
      APP_SERVICE_CPU_LIMIT: '2',
      APP_SERVICE_PIDS_LIMIT: '96',
      APP_SERVICE_TMPFS_MB: '32',
      APP_SERVICE_CONTAINER_UID: '65532',
    };
    Object.assign(process.env, values);
    try {
      expect(configuration().appMarketplace.serviceRuntime).toMatchObject({
        driver: 'podman',
        podmanCommand: '/usr/bin/podman',
        podmanImage: values.APP_SERVICE_PODMAN_IMAGE,
        podmanHome: '/home/agentstudio_app',
        podmanXdgRuntimeDir: '/run/user/1001',
        socketDir: '/home/agentstudio_app/sockets',
        cpuLimit: 2,
        pidsLimit: 96,
        tmpfsMb: 32,
        containerUid: 65532,
      });
    } finally {
      for (const key of SERVICE_ENV_KEYS) delete process.env[key];
    }
  });

  it('rejects enabled PM2 in production and accepts a complete Podman configuration', () => {
    const productionPm2 = validateServiceEnv({
      NODE_ENV: 'production',
      APP_SERVICE_RUNTIME_ENABLED: true,
      APP_SERVICE_RUNTIME_DRIVER: 'pm2',
      APP_SERVICE_RUNTIME_DIR: '/srv/agentstudio/releases',
      APP_SERVICE_RUNTIME_USER: 'agentstudio_app',
      APP_SERVICE_PM2_HOME: '/home/agentstudio_app/.pm2',
    });
    expect(productionPm2.error?.message).toContain('APP_SERVICE_RUNTIME_DRIVER');

    const productionPodman = validateServiceEnv(validPodmanEnv());
    expect(productionPodman.error).toBeUndefined();
    expect(productionPodman.value).toMatchObject({
      APP_SERVICE_RUNTIME_DRIVER: 'podman',
      APP_SERVICE_CPU_LIMIT: 1,
      APP_SERVICE_PIDS_LIMIT: 64,
      APP_SERVICE_TMPFS_MB: 16,
      APP_SERVICE_CONTAINER_UID: 65532,
    });
  });

  it('keeps an unconfigured Podman runtime valid while the feature flag is disabled', () => {
    const disabled = validateServiceEnv({ APP_SERVICE_RUNTIME_DRIVER: 'podman' });

    expect(disabled.error).toBeUndefined();
    expect(disabled.value).toMatchObject({
      APP_SERVICE_RUNTIME_ENABLED: false,
      APP_SERVICE_RUNTIME_DRIVER: 'podman',
      APP_SERVICE_PODMAN_COMMAND: '/usr/bin/podman',
      APP_SERVICE_PODMAN_IMAGE: '',
      APP_SERVICE_PODMAN_HOME: '',
      APP_SERVICE_PODMAN_XDG_RUNTIME_DIR: '',
      APP_SERVICE_SOCKET_DIR: '',
    });
  });

  it.each([
    ['tagged image', { APP_SERVICE_PODMAN_IMAGE: 'registry.example/runtime:latest' }],
    [
      'credential-bearing image',
      { APP_SERVICE_PODMAN_IMAGE: `user:secret@registry.example/runtime@sha256:${'a'.repeat(64)}` },
    ],
    ['relative command', { APP_SERVICE_PODMAN_COMMAND: 'podman' }],
    ['relative home', { APP_SERVICE_PODMAN_HOME: 'home' }],
    ['relative XDG path', { APP_SERVICE_PODMAN_XDG_RUNTIME_DIR: 'run/user/1001' }],
    ['relative socket root', { APP_SERVICE_SOCKET_DIR: 'sockets' }],
    ['CPU below minimum', { APP_SERVICE_CPU_LIMIT: 0.09 }],
    ['PIDs above maximum', { APP_SERVICE_PIDS_LIMIT: 513 }],
    ['tmpfs below minimum', { APP_SERVICE_TMPFS_MB: 7 }],
    ['root container UID', { APP_SERVICE_CONTAINER_UID: 0 }],
  ])('rejects invalid Podman setting: %s', (_label, overrides) => {
    const result = validateServiceEnv({ ...validPodmanEnv(), ...overrides });
    expect(result.error).toBeDefined();
  });
});

function validateServiceEnv(overrides: Record<string, unknown>) {
  return envValidationSchema.validate(
    {
      DB_HOST: '127.0.0.1',
      DB_USERNAME: 'root',
      DB_NAME: 'agentstudio_test',
      JWT_SECRET: 'test_secret_that_is_at_least_32_chars_long',
      REDIS_HOST: '127.0.0.1',
      ...overrides,
    },
    { abortEarly: false },
  );
}

function validPodmanEnv() {
  return {
    NODE_ENV: 'production',
    APP_SERVICE_RUNTIME_ENABLED: true,
    APP_SERVICE_RUNTIME_DRIVER: 'podman',
    APP_SERVICE_RUNTIME_DIR: '/srv/agentstudio/releases',
    APP_SERVICE_RUNTIME_USER: 'agentstudio_app',
    APP_SERVICE_PODMAN_COMMAND: '/usr/bin/podman',
    APP_SERVICE_PODMAN_IMAGE: `registry.example/runtime@sha256:${'a'.repeat(64)}`,
    APP_SERVICE_PODMAN_HOME: '/home/agentstudio_app',
    APP_SERVICE_PODMAN_XDG_RUNTIME_DIR: '/run/user/1001',
    APP_SERVICE_SOCKET_DIR: '/home/agentstudio_app/sockets',
  };
}
