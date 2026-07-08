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

    expect(schema).toContain('ALIPAY_GATEWAY_URL: Joi.string().uri()');
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
