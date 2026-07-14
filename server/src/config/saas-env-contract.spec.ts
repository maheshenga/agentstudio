import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '../../..');

const REQUIRED_SAAS_ENV_KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'LOGIN_CAPTCHA_ENABLED',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'REDIS_DB',
  'SAAS_DEV_PAYMENT_CONFIRM_ENABLED',
  'ALIPAY_ENABLED',
  'ALIPAY_APP_ID',
  'ALIPAY_PRIVATE_KEY',
  'ALIPAY_PUBLIC_KEY',
  'ALIPAY_NOTIFY_URL',
  'ALIPAY_RETURN_URL',
  'ALIPAY_GATEWAY_URL',
] as const;

const CONFIGURATION_ENV_KEYS_REQUIRING_SCHEMA = [
  'TAIXU_QDRANT_URL',
  'TAIXU_QDRANT_COLLECTION_PREFIX',
  'TAIXU_QDRANT_VECTOR_SIZE',
  'TAIXU_QDRANT_TIMEOUT',
  'TAIXU_QDRANT_EMBED_BATCH',
  'TAIXU_TAVILY_API_KEY',
  'APP_PACKAGE_MAX_FILE_MB',
  'APP_PACKAGE_MAX_UNCOMPRESSED_MB',
  'APP_PACKAGE_MAX_COMPRESSION_RATIO',
  'APP_RUNTIME_STORAGE_DIR',
  'APP_RUNTIME_STORAGE_MAX_FILE_MB',
  'APP_RUNTIME_STORAGE_QUOTA_MB',
  'APP_RUNTIME_STORAGE_ALLOWED_MIME_TYPES',
  'APP_RUNTIME_IFRAME_LAUNCH_ENABLED',
  'APP_RUNTIME_LAUNCH_SECRET',
  'APP_SERVICE_RUNTIME_ENABLED',
  'APP_SERVICE_RUNTIME_DRIVER',
  'APP_SERVICE_RUNTIME_DIR',
  'APP_SERVICE_RUNTIME_USER',
  'APP_SERVICE_PM2_HOME',
  'APP_SERVICE_PM2_COMMAND',
  'APP_SERVICE_RUNTIME_INTERPRETER',
  'APP_SERVICE_PODMAN_COMMAND',
  'APP_SERVICE_PODMAN_IMAGE',
  'APP_SERVICE_PODMAN_HOME',
  'APP_SERVICE_PODMAN_XDG_RUNTIME_DIR',
  'APP_SERVICE_SOCKET_DIR',
  'APP_SERVICE_CPU_LIMIT',
  'APP_SERVICE_PIDS_LIMIT',
  'APP_SERVICE_TMPFS_MB',
  'APP_SERVICE_CONTAINER_UID',
  'APP_SERVICE_MEMORY_MB',
  'APP_SERVICE_REQUEST_TIMEOUT_MS',
  'APP_SERVICE_MAX_BODY_MB',
  'APP_SERVICE_HEALTH_SUCCESS_COUNT',
  'APP_SERVICE_PORT_MIN',
  'APP_SERVICE_PORT_MAX',
  'APP_DEVELOPER_SERVICE_ENABLED',
  'APP_DEVELOPER_SERVICE_CONCURRENCY',
  'APP_DEVELOPER_SERVICE_RATE_PER_MINUTE',
  'APP_DEVELOPER_SERVICE_CIRCUIT_FAILURES',
  'APP_DEVELOPER_SERVICE_CIRCUIT_OPEN_SECONDS',
  'APP_DEVELOPER_SERVICE_LOG_RETENTION_DAYS',
  'APP_COMMERCE_ENABLED',
] as const;

const UNSAFE_EXAMPLE_VALUES = new Map([
  ['DB_PASSWORD', ['root', 'password', '123456']],
  ['ADMIN_PASSWORD', ['demo_admin_pass_R4x8p2Lm', 'admin', 'password', '123456']],
  ['TAIXU_NEO4J_PASSWORD', ['chen6800', 'neo4j', 'password', '123456']],
]);

describe('SaaS environment contract readiness', () => {
  it('documents and validates SaaS runtime environment keys', () => {
    const schema = readProjectFile('server/src/config/env.validation.ts');
    const example = parseEnvExample(readProjectFile('server/.env.example'));
    const checklist = readProjectFile('docs/saas-launch-readiness-checklist.md');

    for (const key of REQUIRED_SAAS_ENV_KEYS) {
      expect(schema).toContain(`${key}: Joi.`);
      expect(example).toHaveProperty(key);
      expect(checklist).toContain(key);
    }

    expect(schema).toMatch(/ALIPAY_GATEWAY_URL:\s*Joi\.string\(\)\s*\.uri\(\)/);
    expect(example.ALIPAY_GATEWAY_URL).toBe('https://openapi-sandbox.dl.alipaydev.com/gateway.do');
  });

  it('keeps configuration env usage covered by Joi validation', () => {
    const configuration = readProjectFile('server/src/config/configuration.ts');
    const schema = readProjectFile('server/src/config/env.validation.ts');

    for (const key of CONFIGURATION_ENV_KEYS_REQUIRING_SCHEMA) {
      expect(configuration).toContain(`process.env.${key}`);
      expect(schema).toContain(`${key}: Joi.`);
    }
  });

  it('does not ship unsafe secret defaults in server .env.example', () => {
    const example = parseEnvExample(readProjectFile('server/.env.example'));

    for (const [key, unsafeValues] of UNSAFE_EXAMPLE_VALUES) {
      const actual = example[key] || '';
      expect(unsafeValues).not.toContain(actual);
    }

    expect(example.JWT_SECRET).toContain('change_me');
    expect(example.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(example.ADMIN_PASSWORD).toContain('change_me');
  });

  it('keeps iframe launch disabled by default and requires 32-byte signing material', () => {
    const schema = readProjectFile('server/src/config/env.validation.ts');

    expect(schema).toMatch(
      /APP_RUNTIME_IFRAME_LAUNCH_ENABLED:\s*Joi\.boolean\(\).*default\(false\)/s,
    );
    expect(schema).toMatch(
      /APP_RUNTIME_LAUNCH_SECRET:\s*Joi\.when\([\s\S]*then:\s*Joi\.string\(\)\.min\(32\)\.required\(\)/,
    );
  });

  it('bounds application archive extraction settings', () => {
    const schema = readProjectFile('server/src/config/env.validation.ts');
    const example = parseEnvExample(readProjectFile('server/.env.example'));

    expect(schema).toMatch(
      /APP_PACKAGE_MAX_FILE_MB:[\s\S]*min\(1\)[\s\S]*max\(100\)[\s\S]*default\(25\)/,
    );
    expect(schema).toMatch(
      /APP_PACKAGE_MAX_UNCOMPRESSED_MB:[\s\S]*min\(1\)[\s\S]*max\(2048\)[\s\S]*default\(200\)/,
    );
    expect(schema).toMatch(
      /APP_PACKAGE_MAX_COMPRESSION_RATIO:[\s\S]*min\(1\)[\s\S]*max\(1000\)[\s\S]*default\(100\)/,
    );
    expect(example.APP_PACKAGE_MAX_FILE_MB).toBe('25');
    expect(example.APP_PACKAGE_MAX_UNCOMPRESSED_MB).toBe('200');
    expect(example.APP_PACKAGE_MAX_COMPRESSION_RATIO).toBe('100');
  });

  it('keeps service runtime disabled and validates its low-privilege process bounds', () => {
    const schema = readProjectFile('server/src/config/env.validation.ts');

    expect(schema).toMatch(/APP_SERVICE_RUNTIME_ENABLED:\s*Joi\.boolean\(\).*default\(false\)/s);
    expect(schema).toMatch(/APP_SERVICE_RUNTIME_USER:[\s\S]*pattern\(\/\^\[a-z_\]/);
    expect(schema).toMatch(/APP_SERVICE_RUNTIME_INTERPRETER:[\s\S]*valid\('node', 'bun'\)/);
    expect(schema).toMatch(/APP_SERVICE_RUNTIME_DRIVER:[\s\S]*valid\('pm2', 'podman'\)/);
    expect(schema).toMatch(/APP_SERVICE_PODMAN_IMAGE:[\s\S]*sha256/);
    expect(schema).toMatch(/APP_SERVICE_CPU_LIMIT:[\s\S]*min\(0\.1\)[\s\S]*max\(8\)/);
    expect(schema).toMatch(/APP_SERVICE_PIDS_LIMIT:[\s\S]*min\(16\)[\s\S]*max\(512\)/);
    expect(schema).toMatch(/APP_SERVICE_TMPFS_MB:[\s\S]*min\(8\)[\s\S]*max\(256\)/);
    expect(schema).toMatch(/APP_SERVICE_MEMORY_MB:[\s\S]*min\(128\)[\s\S]*max\(2048\)/);
    expect(schema).toMatch(/APP_SERVICE_REQUEST_TIMEOUT_MS:[\s\S]*min\(1000\)[\s\S]*max\(30000\)/);
    expect(schema).toMatch(/APP_SERVICE_MAX_BODY_MB:[\s\S]*min\(1\)[\s\S]*max\(10\)/);
    expect(schema).toMatch(/APP_SERVICE_HEALTH_SUCCESS_COUNT:[\s\S]*min\(1\)[\s\S]*max\(10\)/);
  });

  it('keeps certified developer services disabled with bounded quotas and circuit policy', () => {
    const schema = readProjectFile('server/src/config/env.validation.ts');
    const example = parseEnvExample(readProjectFile('server/.env.example'));

    expect(schema).toMatch(/APP_DEVELOPER_SERVICE_ENABLED:\s*Joi\.boolean\(\).*default\(false\)/s);
    expect(schema).toMatch(
      /APP_DEVELOPER_SERVICE_CONCURRENCY:[\s\S]*min\(1\)[\s\S]*max\(100\)[\s\S]*default\(20\)/,
    );
    expect(schema).toMatch(
      /APP_DEVELOPER_SERVICE_RATE_PER_MINUTE:[\s\S]*min\(1\)[\s\S]*max\(6000\)[\s\S]*default\(60\)/,
    );
    expect(schema).toMatch(
      /APP_DEVELOPER_SERVICE_CIRCUIT_FAILURES:[\s\S]*min\(2\)[\s\S]*max\(20\)[\s\S]*default\(5\)/,
    );
    expect(schema).toMatch(
      /APP_DEVELOPER_SERVICE_CIRCUIT_OPEN_SECONDS:[\s\S]*min\(10\)[\s\S]*max\(3600\)[\s\S]*default\(60\)/,
    );
    expect(schema).toMatch(
      /APP_DEVELOPER_SERVICE_LOG_RETENTION_DAYS:[\s\S]*min\(1\)[\s\S]*max\(30\)[\s\S]*default\(7\)/,
    );
    expect(example.APP_DEVELOPER_SERVICE_ENABLED).toBe('false');
  });

  it('keeps application commerce disabled by default', () => {
    const schema = readProjectFile('server/src/config/env.validation.ts');
    const example = parseEnvExample(readProjectFile('server/.env.example'));

    expect(schema).toMatch(/APP_COMMERCE_ENABLED:\s*Joi\.boolean\(\).*default\(false\)/s);
    expect(example.APP_COMMERCE_ENABLED).toBe('false');
  });
});

function readProjectFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}

function parseEnvExample(source: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    env[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }
  return env;
}
