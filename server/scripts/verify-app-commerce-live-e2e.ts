import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import {
  spawn,
  spawnSync,
  type ChildProcess,
  type SpawnOptions,
  type SpawnSyncOptions,
} from 'node:child_process';
import JSZip from 'jszip';

type ApiEnvelope<T = unknown> = {
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT';
  token?: string;
  body?: Record<string, unknown>;
};

type LoginData = {
  access_token?: string;
  refresh_token?: string;
  user?: { id?: number | string };
};

type AuthSession = {
  tenantId: number;
  userId: number;
  accessToken: string;
  refreshToken: string;
  profile: Record<string, unknown>;
};

type ProvisioningData = { userId?: number | string; tenantId?: number | string };

type CommerceAccess = {
  commerce_enabled?: boolean;
  access_status?: string;
  can_install?: boolean;
  can_open?: boolean;
  action?: string;
};

type AppRecord = { id?: number | string; code?: string; developer_id?: number | string };

type AppOrderRecord = {
  id?: number | string;
  order_no?: string;
  amount_cents?: number;
  status?: string;
};

type AppLicenseRecord = { id?: number | string; status?: string; source?: string };

type AppSettlementRecord = { id?: number | string; status?: string };

type Config = {
  dbHost: string;
  dbPort: string;
  dbUsername: string;
  dbPassword: string;
  platformUsername: string;
  platformPassword: string;
  redisHost: string;
  redisPort: string;
  redisPassword: string;
  redisDb: string;
};

const serverRoot = process.cwd();
const serverEntry = resolve(serverRoot, 'dist/main.js');
const verifyDbInit = resolve(serverRoot, 'scripts/verify-db-init.cjs');
const terminationController = new AbortController();
const sensitiveValues = new Set<string>();
const safeSteps: string[] = [];
const ownedAppCodes = new Set<string>();
const ownedAppIds = new Set<number>();
const ownedTenantIds = new Set<number>();
const ownedUserIds = new Set<number>();
const ownedUsernames = new Set<string>();
const ownedDeveloperIds = new Set<number>();
const redisOwnerKey = 'agentstudio:app-commerce-e2e:owner';
const claimRedisScript = `
local owner = ARGV[1]
if redis.call('DBSIZE') ~= 0 then return redis.error_reply('database must be empty') end
if not redis.call('SET', KEYS[1], owner, 'NX') then return redis.error_reply('database claim failed') end
if redis.call('DBSIZE') ~= 1 then
  redis.call('DEL', KEYS[1])
  return redis.error_reply('database changed during claim')
end
return 'claimed'
`;
const releaseRedisScript = `
local owner = ARGV[1]
if redis.call('GET', KEYS[1]) ~= owner then return redis.error_reply('database ownership changed') end
redis.call('FLUSHDB')
return redis.call('DBSIZE')
`;

let config: Config | undefined;
let databaseName = '';
let artifactRoot = '';
let backend: ChildProcess | undefined;
let redisOwner = '';
let redisClaimed = false;
let databaseReady = false;
let cleanupPromise: Promise<void> | undefined;
let terminationStarted = false;
let receivedSignal: 'SIGINT' | 'SIGTERM' | undefined;

function requiredEnv(name: string) {
  return String(process.env[name] || '').trim();
}

function addStep(label: string) {
  safeSteps.push(label);
}

function describeError(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function registerSensitive(value: unknown) {
  const normalized = String(value || '').trim();
  if (normalized.length >= 4) sensitiveValues.add(normalized);
}

function redact(value: string) {
  let redacted = String(value || '');
  for (const sensitive of [...sensitiveValues].sort((left, right) => right.length - left.length)) {
    redacted = redacted.split(sensitive).join('[redacted]');
  }
  return redacted;
}

function registerSensitiveEnvironmentValues(input: Config) {
  for (const value of Object.values(input)) registerSensitive(value);
}

function loadConfig(): Config {
  if (process.platform !== 'linux') {
    throw new Error('Application commerce live E2E requires Linux');
  }

  const requiredNames = [
    'APP_COMMERCE_E2E_DB_HOST',
    'APP_COMMERCE_E2E_DB_PORT',
    'APP_COMMERCE_E2E_DB_USERNAME',
    'APP_COMMERCE_E2E_DB_PASSWORD',
    'APP_COMMERCE_E2E_PLATFORM_USERNAME',
    'APP_COMMERCE_E2E_PLATFORM_PASSWORD',
    'APP_COMMERCE_E2E_REDIS_DB',
    'APP_COMMERCE_E2E_REDIS_ISOLATED',
  ];
  const missing = requiredNames.filter((name) => !requiredEnv(name));
  if (missing.length) {
    throw new Error(`Missing required isolation variables: ${missing.join(', ')}`);
  }
  if (requiredEnv('APP_COMMERCE_E2E_REDIS_ISOLATED') !== '1') {
    throw new Error('APP_COMMERCE_E2E_REDIS_ISOLATED must equal 1');
  }

  const redisDb = requiredEnv('APP_COMMERCE_E2E_REDIS_DB');
  if (redisDb === '0') throw new Error('APP_COMMERCE_E2E_REDIS_DB must not use Redis DB 0');
  if (!/^\d+$/.test(redisDb) || Number(redisDb) < 1 || Number(redisDb) > 15) {
    throw new Error('APP_COMMERCE_E2E_REDIS_DB must be an isolated Redis DB from 1 to 15');
  }

  const result: Config = {
    dbHost: requiredEnv('APP_COMMERCE_E2E_DB_HOST'),
    dbPort: requiredEnv('APP_COMMERCE_E2E_DB_PORT'),
    dbUsername: requiredEnv('APP_COMMERCE_E2E_DB_USERNAME'),
    dbPassword: requiredEnv('APP_COMMERCE_E2E_DB_PASSWORD'),
    platformUsername: requiredEnv('APP_COMMERCE_E2E_PLATFORM_USERNAME'),
    platformPassword: requiredEnv('APP_COMMERCE_E2E_PLATFORM_PASSWORD'),
    redisHost: requiredEnv('APP_COMMERCE_E2E_REDIS_HOST') || '127.0.0.1',
    redisPort: requiredEnv('APP_COMMERCE_E2E_REDIS_PORT') || '6379',
    redisPassword: requiredEnv('APP_COMMERCE_E2E_REDIS_PASSWORD'),
    redisDb,
  };
  registerSensitiveEnvironmentValues(result);
  return result;
}

function baseChildEnvironment() {
  return {
    ...process.env,
    CI: 'true',
    FORCE_COLOR: '0',
    NO_COLOR: '1',
  };
}

function databaseEnvironment(dbName = databaseName) {
  assert.ok(config);
  return {
    ...baseChildEnvironment(),
    DB_HOST: config.dbHost,
    DB_PORT: config.dbPort,
    DB_USERNAME: config.dbUsername,
    DB_PASSWORD: config.dbPassword,
    DB_NAME: dbName,
  };
}

function mysqlArgs(extra: string[], includeDatabase = false) {
  assert.ok(config);
  return [
    '--protocol=TCP',
    '--host',
    config.dbHost,
    '--port',
    config.dbPort,
    '--user',
    config.dbUsername,
    '--batch',
    '--skip-column-names',
    '--raw',
    ...(includeDatabase ? ['--database', databaseName] : []),
    ...extra,
  ];
}

function runChecked(label: string, file: string, args: string[], options: SpawnSyncOptions = {}) {
  const result = spawnSync(file, args, {
    cwd: serverRoot,
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  if (result.error || result.status !== 0) throw new Error(`${label} failed`);
  return String(result.stdout || '').trim();
}

function mysqlAdminQuery(sql: string) {
  assert.ok(config);
  return runChecked('MySQL administrative query', 'mysql', mysqlArgs(['--execute', sql]), {
    env: { ...baseChildEnvironment(), MYSQL_PWD: config.dbPassword },
  });
}

function mysqlQuery(sql: string) {
  assert.ok(config);
  assert.ok(databaseName);
  return runChecked('MySQL disposable query', 'mysql', mysqlArgs(['--execute', sql], true), {
    env: { ...baseChildEnvironment(), MYSQL_PWD: config.dbPassword },
  });
}

function sqlText(value: string) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function sqlIds(values: Set<number>) {
  const ids = [...values].filter((value) => Number.isSafeInteger(value) && value > 0);
  return ids.length ? ids.join(',') : '0';
}

function sqlTexts(values: Set<string>) {
  const texts = [...values].filter(Boolean).map(sqlText);
  return texts.length ? texts.join(',') : "''";
}

function assertDisposableDatabaseName(value: string) {
  assert.match(value, /^agentstudio_app_commerce_e2e_[a-z0-9]+$/);
  assert.doesNotMatch(
    value,
    /prod|production|master|live/i,
    'disposable database name must not be production-like',
  );
}

function assertDatabaseRemoved() {
  const remaining = Number(
    mysqlAdminQuery(
      `SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name=${sqlText(databaseName)};`,
    ),
  );
  assert.equal(remaining, 0, 'disposable database cleanup must remove the generated database');
}

function redisEnvironment() {
  assert.ok(config);
  return {
    ...baseChildEnvironment(),
    ...(config.redisPassword ? { REDISCLI_AUTH: config.redisPassword } : {}),
  };
}

function redisCommand(args: string[]) {
  assert.ok(config);
  return runChecked(
    'Redis isolated command',
    'redis-cli',
    [
      '--no-auth-warning',
      '-h',
      config.redisHost,
      '-p',
      config.redisPort,
      '-n',
      config.redisDb,
      ...args,
    ],
    { env: redisEnvironment() },
  );
}

function claimRedisDatabase() {
  redisOwner = randomBytes(24).toString('hex');
  registerSensitive(redisOwner);
  const result = redisCommand(['EVAL', claimRedisScript, '1', redisOwnerKey, redisOwner]);
  assert.equal(result, 'claimed', 'isolated Redis database claim must succeed');
  redisClaimed = true;
}

function releaseRedisDatabase() {
  if (!redisClaimed) return;
  const result = redisCommand(['EVAL', releaseRedisScript, '1', redisOwnerKey, redisOwner]);
  assert.equal(result, '0', 'verify Redis cleanup must leave the isolated database empty');
  redisClaimed = false;
}

function startProcess(label: string, file: string, args: string[], options: SpawnOptions) {
  const child = spawn(file, args, {
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  child.stdout?.on('data', () => undefined);
  child.stderr?.on('data', () => undefined);
  child.once('error', () => undefined);
  registerSensitive(label);
  return child;
}

async function waitForForcedExit(child: ChildProcess, timeoutMs = 10_000) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolvePromise, reject) => {
    const timeout = setTimeout(() => reject(new Error('process termination timed out')), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolvePromise();
    });
  });
}

async function stopProcess(child?: ChildProcess) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  try {
    await waitForForcedExit(child);
  } catch {
    child.kill('SIGKILL');
    await waitForForcedExit(child);
  }
}

async function findFreePort() {
  return new Promise<number>((resolvePromise, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolvePromise(port)));
    });
  });
}

async function waitForHttp(url: string, child: ChildProcess, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('backend exited before readiness');
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.status < 500) return;
    } catch {
      // Retry until the bounded readiness deadline.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error('backend readiness timed out');
}

async function requestEnvelope<T>(baseUrl: string, path: string, options: RequestOptions = {}) {
  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method: options.method || 'GET',
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: terminationController.signal,
  });
  const raw = await response.text();
  let envelope: ApiEnvelope<T> | undefined;
  try {
    envelope = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : {};
  } catch {
    envelope = undefined;
  }
  return { response, envelope };
}

async function requestJson<T>(baseUrl: string, path: string, options: RequestOptions = {}) {
  const { response, envelope } = await requestEnvelope<T>(baseUrl, path, options);
  if (!response.ok || Number(envelope?.code) !== 200) {
    throw new Error(
      `${options.method || 'GET'} ${path} failed with HTTP ${response.status}, code ${envelope?.code ?? 'unknown'}: ${redact(envelope?.message || envelope?.msg || 'request failed')}`,
    );
  }
  return envelope?.data as T;
}

async function requestDenied(baseUrl: string, path: string, options: RequestOptions = {}) {
  const { response, envelope } = await requestEnvelope(baseUrl, path, options);
  assert.notEqual(Number(envelope?.code), 200, `${path} must fail closed`);
  assert.ok(
    response.status >= 400 || Number(envelope?.code) >= 400,
    `${path} must return a denial`,
  );
}

async function requestRuntime<T>(baseUrl: string, token: string) {
  const response = await fetch(new URL('/api/app-runtime/context', `${baseUrl}/`), {
    headers: {
      accept: 'application/json',
      'x-app-runtime-token': token,
    },
    signal: terminationController.signal,
  });
  const raw = await response.text();
  const envelope = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : {};
  return { response, envelope };
}

async function assertRuntimeDenied(baseUrl: string, token: string) {
  const result = await requestRuntime(baseUrl, token);
  assert.notEqual(Number(result.envelope.code), 200, 'runtime context must fail closed');
  assert.ok(result.response.status >= 400, 'runtime denial must use an HTTP error status');
}

async function uploadZip<T>(baseUrl: string, path: string, token: string, buffer: Buffer) {
  const form = new FormData();
  const bytes = new Uint8Array(buffer.length);
  bytes.set(buffer);
  form.append('file', new Blob([bytes], { type: 'application/zip' }), 'application.zip');
  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
    signal: terminationController.signal,
  });
  const raw = await response.text();
  const envelope = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : {};
  if (!response.ok || Number(envelope.code) !== 200) throw new Error(`POST ${path} failed`);
  return envelope.data as T;
}

async function authenticate(
  backendUrl: string,
  username: string,
  password: string,
  requestedTenantId?: number,
): Promise<AuthSession> {
  const tenants = await requestJson<Array<{ id?: number | string }>>(
    backendUrl,
    '/api/core/tenants-by-credentials',
    { method: 'POST', body: { username, password } },
  );
  const tenant = requestedTenantId
    ? tenants.find((item) => Number(item.id) === requestedTenantId)
    : tenants[0];
  assert.ok(tenant?.id, 'credentials must resolve an allowed tenant');
  const login = await requestJson<LoginData>(backendUrl, '/api/core/login', {
    method: 'POST',
    body: { username, password, tenant_id: Number(tenant.id) },
  });
  assert.ok(login.access_token && login.refresh_token, 'login must return both tokens');
  registerSensitive(login.access_token);
  registerSensitive(login.refresh_token);
  const profile = await requestJson<Record<string, unknown>>(backendUrl, '/api/core/system/user', {
    token: login.access_token,
  });
  const userId = Number((profile as { id?: unknown }).id || login.user?.id);
  assert.ok(Number.isSafeInteger(userId) && userId > 0, 'authenticated user id must be available');
  return {
    tenantId: Number(tenant.id),
    userId,
    accessToken: login.access_token,
    refreshToken: login.refresh_token,
    profile,
  };
}

function assertPlatformAdministrator(session: AuthSession) {
  assert.equal(
    (session.profile as { is_platform_admin?: unknown }).is_platform_admin === true ||
      (session.profile as { is_admin?: unknown }).is_admin === true ||
      (session.profile as { account_scope?: unknown }).account_scope === 'platform' ||
      (session.profile as { is_super?: unknown }).is_super === 1,
    true,
    'seeded account must be a platform administrator',
  );
}

function backendEnvironment(input: { port: number; jwtSecret: string; commerceEnabled: boolean }) {
  assert.ok(config);
  return {
    ...databaseEnvironment(),
    NODE_ENV: 'test',
    NO_CLUSTER: '1',
    DEBUG: 'false',
    APP_PORT: String(input.port),
    APP_API_PREFIX: '',
    REDIS_HOST: config.redisHost,
    REDIS_PORT: config.redisPort,
    REDIS_PASSWORD: config.redisPassword,
    REDIS_DB: config.redisDb,
    JWT_SECRET: input.jwtSecret,
    LOGIN_CAPTCHA_ENABLED: 'false',
    LOG_CONSOLE_ENABLED: 'false',
    LOG_FILE_ENABLED: 'false',
    SAAS_DEV_PAYMENT_CONFIRM_ENABLED: 'true',
    APP_COMMERCE_ENABLED: input.commerceEnabled ? 'true' : 'false',
    APP_RUNTIME_CAPABILITIES_ENABLED: 'true',
    APP_RUNTIME_IFRAME_LAUNCH_ENABLED: 'false',
    APP_SERVICE_RUNTIME_ENABLED: 'false',
    APP_DEVELOPER_SERVICE_ENABLED: 'false',
    FILE_UPLOAD_DIR: resolve(artifactRoot, 'uploads'),
    APP_PACKAGE_DIR: resolve(artifactRoot, 'packages'),
    APP_PUBLIC_DIR: resolve(artifactRoot, 'public'),
  };
}

async function startBackend(commerceEnabled: boolean, jwtSecret: string) {
  const port = await findFreePort();
  registerSensitive(port);
  const child = startProcess('application commerce backend', process.execPath, [serverEntry], {
    cwd: serverRoot,
    env: backendEnvironment({ port, jwtSecret, commerceEnabled }),
  });
  const backendUrl = `http://127.0.0.1:${port}`;
  registerSensitive(backendUrl);
  await waitForHttp(`${backendUrl}/api/core/login-captcha`, child);
  return { child, backendUrl };
}

async function createStaticPackage(code: string) {
  const zip = new JSZip();
  zip.file(
    'manifest.json',
    JSON.stringify({
      code,
      name: 'Commerce Runtime Fixture',
      version: '1.0.0',
      type: 'static',
      entry: 'dist/index.html',
      category: 'operations',
      summary: 'Disposable application commerce runtime fixture',
      description: 'Verifies paid application authority and runtime invalidation.',
      tenant_scoped: true,
      permissions: ['runtime:context:read'],
    }),
  );
  zip.file('dist/index.html', '<!doctype html><meta charset="utf-8"><title>Commerce</title>');
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'UNIX',
  });
}

async function createIframeApp(backendUrl: string, token: string, code: string, name: string) {
  const app = await requestJson<AppRecord>(backendUrl, '/api/app-platform/apps', {
    method: 'POST',
    token,
    body: {
      code,
      name,
      type: 'iframe',
      category: 'operations',
      summary: 'Disposable application commerce fixture',
      visibility: 'marketplace',
      entry_url: `https://commerce-e2e.invalid/${code}`,
      version: '1.0.0',
      allowed_origins: ['https://commerce-e2e.invalid'],
      requested_capabilities: ['context.read'],
      developer_name: 'Application Commerce E2E',
    },
  });
  const appId = Number(app.id);
  assert.ok(Number.isSafeInteger(appId) && appId > 0, 'created iframe app id must be available');
  ownedAppCodes.add(code);
  ownedAppIds.add(appId);
  registerSensitive(code);
  return { ...app, id: appId };
}

async function createPaidStaticApp(backendUrl: string, token: string, code: string) {
  const app = await requestJson<AppRecord>(backendUrl, '/api/app-platform/apps', {
    method: 'POST',
    token,
    body: {
      code,
      name: 'Paid Runtime Application',
      type: 'static',
      category: 'operations',
      summary: 'Disposable paid application commerce fixture',
      visibility: 'marketplace',
      developer_name: 'Application Commerce E2E',
    },
  });
  const appId = Number(app.id);
  assert.ok(Number.isSafeInteger(appId) && appId > 0, 'created static app id must be available');
  ownedAppCodes.add(code);
  ownedAppIds.add(appId);
  registerSensitive(code);
  await uploadZip(
    backendUrl,
    `/api/app-platform/apps/${code}/versions/upload`,
    token,
    await createStaticPackage(code),
  );
  await requestJson(backendUrl, `/api/app-platform/apps/${code}/versions/1.0.0/approve`, {
    method: 'POST',
    token,
    body: { message: 'Disposable commerce review', approved_capabilities: ['context.read'] },
  });
  await requestJson(backendUrl, `/api/app-platform/apps/${code}/versions/1.0.0/publish`, {
    method: 'POST',
    token,
    body: {},
  });
  return { ...app, id: appId };
}

async function createPricePlan(
  backendUrl: string,
  token: string,
  appCode: string,
  body: Record<string, unknown>,
) {
  return requestJson<Record<string, unknown>>(
    backendUrl,
    `/api/app-platform/commerce/apps/${appCode}/prices`,
    { method: 'POST', token, body },
  );
}

async function getCommerce(backendUrl: string, token: string, appCode: string) {
  return requestJson<CommerceAccess>(backendUrl, `/api/app-tenant/commerce/apps/${appCode}`, {
    token,
  });
}

async function createPaidOrder(
  backendUrl: string,
  token: string,
  appCode: string,
  planCode: string,
) {
  const order = await requestJson<AppOrderRecord>(
    backendUrl,
    `/api/app-tenant/commerce/apps/${appCode}/orders`,
    {
      method: 'POST',
      token,
      body: { price_plan_code: planCode, payment_method: 'alipay' },
    },
  );
  assert.ok(order.order_no, 'application order number must be returned');
  registerSensitive(order.order_no);
  return order;
}

async function confirmDevelopmentPayment(backendUrl: string, token: string, orderNo: string) {
  return requestJson<AppOrderRecord>(backendUrl, '/api/saas/payment/dev-confirm', {
    method: 'POST',
    token,
    body: { order_no: orderNo, order_type: 'app' },
  });
}

async function installApplication(backendUrl: string, token: string, appCode: string) {
  return requestJson(backendUrl, `/api/app-tenant/apps/${appCode}/install`, {
    method: 'POST',
    token,
    body: { capabilities: ['context.read'] },
  });
}

async function openRuntimeSession(backendUrl: string, token: string, appCode: string) {
  const metadata = await requestJson<Record<string, any>>(
    backendUrl,
    `/api/app-tenant/apps/${appCode}/open`,
    { token },
  );
  const session = metadata?.runtime?.session as { token?: string; expires_at?: string } | undefined;
  assert.equal(metadata?.runtime?.context, null, 'runtime session must not inline tenant context');
  const runtimeToken = String(session?.token || '');
  assert.match(runtimeToken, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(Number.isFinite(Date.parse(String(session?.expires_at || ''))));
  registerSensitive(runtimeToken);
  return runtimeToken;
}

async function createTenant(
  backendUrl: string,
  platformToken: string,
  input: { tenantName: string; tenantCode: string; username: string; password: string },
) {
  const created = await requestJson<ProvisioningData>(backendUrl, '/api/saas/platform/tenants', {
    method: 'POST',
    token: platformToken,
    body: {
      tenant_name: input.tenantName,
      tenant_code: input.tenantCode,
      owner_username: input.username,
      owner_password: input.password,
      owner_realname: 'Commerce Tenant Owner',
      plan_code: 'free',
      with_trial: false,
    },
  });
  const tenantId = Number(created.tenantId);
  const userId = Number(created.userId);
  assert.ok(Number.isSafeInteger(tenantId) && tenantId > 0);
  assert.ok(Number.isSafeInteger(userId) && userId > 0);
  ownedTenantIds.add(tenantId);
  ownedUserIds.add(userId);
  ownedUsernames.add(input.username);
  for (const value of Object.values(input)) registerSensitive(value);
  return { tenantId, userId };
}

function previousClosedPeriod() {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return date.toISOString().slice(0, 7);
}

function currentLicenseId(tenantId: number, appId: number) {
  const id = Number(
    mysqlQuery(
      `SELECT id FROM tenant_app_license WHERE tenant_id=${tenantId} AND app_id=${appId} ORDER BY id DESC LIMIT 1;`,
    ),
  );
  assert.ok(Number.isSafeInteger(id) && id > 0, 'current application license id must exist');
  return id;
}

function deleteOwnedRows() {
  const appIds = sqlIds(ownedAppIds);
  const tenantIds = sqlIds(ownedTenantIds);
  const userIds = sqlIds(ownedUserIds);
  const developerIds = sqlIds(ownedDeveloperIds);
  mysqlQuery(`
    SET FOREIGN_KEY_CHECKS=0;
    DELETE FROM app_runtime_audit_log WHERE app_id IN (${appIds});
    DELETE FROM app_runtime_session WHERE app_id IN (${appIds});
    DELETE FROM app_open_log WHERE app_id IN (${appIds}) OR tenant_id IN (${tenantIds});
    DELETE FROM tenant_app_install WHERE app_id IN (${appIds}) OR tenant_id IN (${tenantIds});
    DELETE FROM tenant_app_license WHERE app_id IN (${appIds}) OR tenant_id IN (${tenantIds});
    DELETE FROM app_revenue_ledger WHERE app_id IN (${appIds}) OR tenant_id IN (${tenantIds});
    DELETE FROM app_settlement_batch WHERE developer_id IN (${developerIds});
    DELETE FROM app_order WHERE app_id IN (${appIds}) OR tenant_id IN (${tenantIds});
    DELETE FROM app_price_plan WHERE app_id IN (${appIds});
    DELETE FROM app_capability_grant WHERE app_id IN (${appIds});
    DELETE FROM app_review_log WHERE app_id IN (${appIds});
    DELETE FROM app_package_version WHERE app_id IN (${appIds});
    DELETE FROM app_package WHERE id IN (${appIds});
    DELETE FROM saas_trial WHERE tenant_id IN (${tenantIds});
    DELETE FROM saas_subscription WHERE tenant_id IN (${tenantIds});
    DELETE FROM saas_quota_ledger WHERE tenant_id IN (${tenantIds});
    DELETE FROM saas_tenant_resource WHERE tenant_id IN (${tenantIds});
    DELETE role_menu FROM sa_system_role_menu role_menu
      INNER JOIN sa_system_role role ON role.id=role_menu.role_id
      WHERE role.tenant_id IN (${tenantIds});
    DELETE FROM sa_system_user_role WHERE tenant_id IN (${tenantIds}) OR user_id IN (${userIds});
    DELETE FROM sa_system_user_tenant WHERE tenant_id IN (${tenantIds}) OR user_id IN (${userIds});
    DELETE FROM sa_system_role WHERE tenant_id IN (${tenantIds});
    DELETE FROM sa_system_user WHERE id IN (${userIds});
    DELETE FROM sa_system_tenant WHERE id IN (${tenantIds});
    SET FOREIGN_KEY_CHECKS=1;
  `);
}

function assertNoOwnedRows() {
  const appCodes = sqlTexts(ownedAppCodes);
  const tenantIds = sqlIds(ownedTenantIds);
  const usernames = sqlTexts(ownedUsernames);
  const developerIds = sqlIds(ownedDeveloperIds);
  const remaining = Number(
    mysqlQuery(`
      SELECT
        (SELECT COUNT(*) FROM app_package WHERE code IN (${appCodes})) +
        (SELECT COUNT(*) FROM app_order WHERE tenant_id IN (${tenantIds})) +
        (SELECT COUNT(*) FROM tenant_app_license WHERE tenant_id IN (${tenantIds})) +
        (SELECT COUNT(*) FROM app_settlement_batch WHERE developer_id IN (${developerIds})) +
        (SELECT COUNT(*) FROM sa_system_user WHERE username IN (${usernames})) +
        (SELECT COUNT(*) FROM sa_system_tenant WHERE id IN (${tenantIds}));
    `),
  );
  assert.equal(remaining, 0, 'application commerce cleanup must remove every owned row');
}

async function main() {
  config = loadConfig();
  const suffix = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`.toLowerCase();
  databaseName = `agentstudio_app_commerce_e2e_${suffix}`;
  assertDisposableDatabaseName(databaseName);
  artifactRoot = mkdtempSync(join(tmpdir(), 'agentstudio-app-commerce-e2e-'));
  registerSensitive(databaseName);
  registerSensitive(artifactRoot);

  const legacyCode = `legacy_${suffix}`.slice(0, 70);
  const freeCode = `free_${suffix}`.slice(0, 70);
  const includedCode = `included_${suffix}`.slice(0, 70);
  const paidCode = `paid_${suffix}`.slice(0, 70);
  const tenantAUsername = `commerce_a_${suffix}`.slice(0, 30);
  const tenantBUsername = `commerce_b_${suffix}`.slice(0, 30);
  const secondAdminUsername = `commerce_admin_${suffix}`.slice(0, 30);
  const tenantAPassword = `Ta${randomBytes(18).toString('hex')}9`;
  const tenantBPassword = `Tb${randomBytes(18).toString('hex')}9`;
  const secondAdminPassword = `Ad${randomBytes(18).toString('hex')}9`;
  const jwtSecret = randomBytes(48).toString('base64url');
  for (const value of [
    legacyCode,
    freeCode,
    includedCode,
    paidCode,
    tenantAUsername,
    tenantBUsername,
    secondAdminUsername,
    tenantAPassword,
    tenantBPassword,
    secondAdminPassword,
    jwtSecret,
  ]) {
    registerSensitive(value);
  }

  addStep('claim isolated Redis database');
  claimRedisDatabase();

  addStep('initialize disposable database');
  runChecked('build backend', 'pnpm', ['run', 'build'], { env: baseChildEnvironment() });
  assert.equal(
    existsSync(serverEntry),
    true,
    `backend build artifact is missing: ${basename(serverEntry)}`,
  );
  runChecked('initialize disposable database', process.execPath, [verifyDbInit], {
    env: {
      ...databaseEnvironment(databaseName),
      DB_VERIFY_NAME: databaseName,
      DB_VERIFY_KEEP: '1',
      NODE_ENV: 'test',
    },
  });
  databaseReady = true;

  let running = await startBackend(false, jwtSecret);
  backend = running.child;
  let backendUrl = running.backendUrl;
  let platform = await authenticate(backendUrl, config.platformUsername, config.platformPassword);
  assertPlatformAdministrator(platform);
  ownedDeveloperIds.add(platform.userId);

  const adminRoleId = Number(
    mysqlQuery(
      "SELECT id FROM sa_system_role WHERE code IN ('admin','super_admin') AND status=1 AND delete_time IS NULL ORDER BY (code='admin') DESC, id ASC LIMIT 1;",
    ),
  );
  assert.ok(Number.isSafeInteger(adminRoleId) && adminRoleId > 0);
  await requestJson(backendUrl, '/api/system/user/create', {
    method: 'POST',
    token: platform.accessToken,
    body: {
      username: secondAdminUsername,
      realname: 'Commerce Isolation Administrator',
      password: secondAdminPassword,
      role_ids: [adminRoleId],
      status: 1,
      remark: 'Disposable application commerce identity',
    },
  });
  const secondAdminUserId = Number(
    mysqlQuery(`SELECT id FROM sa_system_user WHERE username=${sqlText(secondAdminUsername)};`),
  );
  assert.ok(Number.isSafeInteger(secondAdminUserId) && secondAdminUserId > 0);
  ownedUserIds.add(secondAdminUserId);
  ownedUsernames.add(secondAdminUsername);

  const tenantAInput = {
    tenantName: 'Commerce Tenant A',
    tenantCode: `commerce-a-${suffix}`.slice(0, 50),
    username: tenantAUsername,
    password: tenantAPassword,
  };
  const tenantBInput = {
    tenantName: 'Commerce Tenant B',
    tenantCode: `commerce-b-${suffix}`.slice(0, 50),
    username: tenantBUsername,
    password: tenantBPassword,
  };
  const tenantACreated = await createTenant(backendUrl, platform.accessToken, tenantAInput);
  const tenantBCreated = await createTenant(backendUrl, platform.accessToken, tenantBInput);
  let tenantA = await authenticate(
    backendUrl,
    tenantAUsername,
    tenantAPassword,
    tenantACreated.tenantId,
  );
  let tenantB = await authenticate(
    backendUrl,
    tenantBUsername,
    tenantBPassword,
    tenantBCreated.tenantId,
  );
  let secondAdmin = await authenticate(
    backendUrl,
    secondAdminUsername,
    secondAdminPassword,
    platform.tenantId,
  );

  const legacyApp = await createIframeApp(
    backendUrl,
    platform.accessToken,
    legacyCode,
    'Legacy App',
  );
  const freeApp = await createIframeApp(backendUrl, platform.accessToken, freeCode, 'Free App');
  const includedApp = await createIframeApp(
    backendUrl,
    platform.accessToken,
    includedCode,
    'Included App',
  );
  const paidApp = await createPaidStaticApp(backendUrl, platform.accessToken, paidCode);

  await createPricePlan(backendUrl, platform.accessToken, freeCode, {
    code: 'free_access',
    name: 'Free Access',
    pricing_model: 'free',
    billing_period: 'none',
    amount_cents: 0,
    trial_days: 0,
    developer_share_bps: 0,
    included_plan_codes: [],
    sale_scope: 'all',
    tenant_ids: [],
    status: 1,
    sort: 10,
  });
  await createPricePlan(backendUrl, platform.accessToken, includedCode, {
    code: 'included_free',
    name: 'Included With Free SaaS',
    pricing_model: 'included',
    billing_period: 'none',
    amount_cents: 0,
    trial_days: 0,
    developer_share_bps: 0,
    included_plan_codes: ['free'],
    sale_scope: 'all',
    tenant_ids: [],
    status: 1,
    sort: 10,
  });
  const paidPlan = await createPricePlan(backendUrl, platform.accessToken, paidCode, {
    code: 'monthly_access',
    name: 'Monthly Access',
    pricing_model: 'subscription',
    billing_period: 'monthly',
    amount_cents: 1299,
    trial_days: 7,
    developer_share_bps: 4000,
    included_plan_codes: [],
    sale_scope: 'all',
    tenant_ids: [],
    status: 1,
    sort: 10,
  });

  addStep('verify feature flag initially disabled');
  const disabledAccess = await getCommerce(backendUrl, tenantA.accessToken, paidCode);
  assert.equal(disabledAccess.commerce_enabled, false);
  assert.equal(disabledAccess.access_status, 'legacy_free');

  await stopProcess(backend);
  running = await startBackend(true, jwtSecret);
  backend = running.child;
  backendUrl = running.backendUrl;
  platform = await authenticate(backendUrl, config.platformUsername, config.platformPassword);
  tenantA = await authenticate(
    backendUrl,
    tenantAUsername,
    tenantAPassword,
    tenantACreated.tenantId,
  );
  tenantB = await authenticate(
    backendUrl,
    tenantBUsername,
    tenantBPassword,
    tenantBCreated.tenantId,
  );
  secondAdmin = await authenticate(
    backendUrl,
    secondAdminUsername,
    secondAdminPassword,
    platform.tenantId,
  );

  addStep('verify legacy-free compatibility');
  assert.equal(
    (await getCommerce(backendUrl, tenantA.accessToken, legacyCode)).access_status,
    'legacy_free',
  );

  addStep('verify free application access');
  const freeAccess = await getCommerce(backendUrl, tenantA.accessToken, freeCode);
  assert.equal(freeAccess.access_status, 'free');
  assert.equal(freeAccess.can_install, true);

  addStep('verify included entitlement');
  const includedAccess = await getCommerce(backendUrl, tenantA.accessToken, includedCode);
  assert.equal(includedAccess.access_status, 'included');
  assert.equal(includedAccess.can_open, true);

  addStep('verify paid purchase required');
  const paidAccess = await getCommerce(backendUrl, tenantA.accessToken, paidCode);
  assert.equal(paidAccess.access_status, 'purchase_required');
  assert.equal(paidAccess.action, 'start_trial');

  addStep('verify single-use trial');
  const trial = await requestJson<AppLicenseRecord>(
    backendUrl,
    `/api/app-tenant/commerce/apps/${paidCode}/trial`,
    {
      method: 'POST',
      token: tenantA.accessToken,
      body: { price_plan_code: 'monthly_access' },
    },
  );
  assert.equal(trial.status, 'trialing');
  await requestDenied(backendUrl, `/api/app-tenant/commerce/apps/${paidCode}/trial`, {
    method: 'POST',
    token: tenantA.accessToken,
    body: { price_plan_code: 'monthly_access' },
  });

  const firstOrder = await createPaidOrder(
    backendUrl,
    tenantA.accessToken,
    paidCode,
    'monthly_access',
  );
  const firstOrderNo = String(firstOrder.order_no);

  addStep('verify backend-owned order snapshot');
  const snapshot = mysqlQuery(
    `SELECT tenant_id, app_id, price_plan_id, app_code, price_plan_code, amount_cents, currency, developer_id, developer_share_bps, status FROM app_order WHERE order_no=${sqlText(firstOrderNo)};`,
  ).split('\t');
  assert.deepEqual(snapshot, [
    String(tenantA.tenantId),
    String(paidApp.id),
    String(paidPlan.id),
    paidCode,
    'monthly_access',
    '1299',
    'CNY',
    String(platform.userId),
    '4000',
    'pending',
  ]);

  addStep('verify cross-tenant purchase isolation');
  await requestDenied(backendUrl, `/api/app-tenant/commerce/orders/${firstOrderNo}`, {
    token: tenantB.accessToken,
  });
  await requestDenied(backendUrl, '/api/saas/payment/dev-confirm', {
    method: 'POST',
    token: tenantB.accessToken,
    body: { order_no: firstOrderNo, order_type: 'app' },
  });
  await requestDenied(backendUrl, `/api/app-tenant/apps/${paidCode}/install`, {
    method: 'POST',
    token: tenantB.accessToken,
    body: { capabilities: ['context.read'] },
  });
  await requestDenied(backendUrl, `/api/app-tenant/apps/${paidCode}/open`, {
    token: tenantB.accessToken,
  });

  addStep('verify duplicate payment confirmation idempotency');
  assert.equal(
    (await confirmDevelopmentPayment(backendUrl, tenantA.accessToken, firstOrderNo)).status,
    'paid',
  );
  assert.equal(
    (await confirmDevelopmentPayment(backendUrl, tenantA.accessToken, firstOrderNo)).status,
    'paid',
  );
  const firstOrderId = Number(
    mysqlQuery(`SELECT id FROM app_order WHERE order_no=${sqlText(firstOrderNo)};`),
  );
  assert.equal(
    Number(mysqlQuery(`SELECT COUNT(*) FROM tenant_app_license WHERE order_id=${firstOrderId};`)),
    1,
  );
  assert.equal(
    Number(
      mysqlQuery(
        `SELECT COUNT(*) FROM app_revenue_ledger WHERE order_id=${firstOrderId} AND event_type='charge';`,
      ),
    ),
    1,
  );

  addStep('verify paid license activation');
  await installApplication(backendUrl, tenantA.accessToken, paidCode);
  let runtimeToken = await openRuntimeSession(backendUrl, tenantA.accessToken, paidCode);

  addStep('verify runtime entitlement enforcement');
  const runtime = await requestRuntime<{ tenant?: { id?: string }; app?: { code?: string } }>(
    backendUrl,
    runtimeToken,
  );
  assert.equal(runtime.response.ok, true);
  assert.equal(Number(runtime.envelope.code), 200);
  assert.equal(runtime.envelope.data?.tenant?.id, String(tenantA.tenantId));
  assert.equal(runtime.envelope.data?.app?.code, paidCode);

  addStep('verify license expiry denial');
  const firstLicenseId = currentLicenseId(tenantA.tenantId, Number(paidApp.id));
  mysqlQuery(
    `UPDATE tenant_app_license SET expires_at=DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id=${firstLicenseId};`,
  );
  await assertRuntimeDenied(backendUrl, runtimeToken);
  assert.equal(
    (await getCommerce(backendUrl, tenantA.accessToken, paidCode)).access_status,
    'expired',
  );

  const secondOrder = await createPaidOrder(
    backendUrl,
    tenantA.accessToken,
    paidCode,
    'monthly_access',
  );
  const secondOrderNo = String(secondOrder.order_no);
  await confirmDevelopmentPayment(backendUrl, tenantA.accessToken, secondOrderNo);
  runtimeToken = await openRuntimeSession(backendUrl, tenantA.accessToken, paidCode);

  addStep('verify full refund and immutable ledger');
  const refundReference = `refund-${randomBytes(10).toString('hex')}`;
  registerSensitive(refundReference);
  await requestJson(backendUrl, `/api/app-platform/commerce/orders/${secondOrderNo}/refund`, {
    method: 'POST',
    token: platform.accessToken,
    body: { reason: 'Disposable full refund verification', provider_reference: refundReference },
  });
  await assertRuntimeDenied(backendUrl, runtimeToken);
  const secondOrderId = Number(
    mysqlQuery(`SELECT id FROM app_order WHERE order_no=${sqlText(secondOrderNo)};`),
  );
  const refundLedger = mysqlQuery(
    `SELECT gross_amount_cents, platform_amount_cents, developer_amount_cents, currency FROM app_revenue_ledger WHERE order_id=${secondOrderId} AND event_type='refund';`,
  ).split('\t');
  assert.deepEqual(refundLedger, ['-1299', '-780', '-519', 'CNY']);

  const thirdOrder = await createPaidOrder(
    backendUrl,
    tenantA.accessToken,
    paidCode,
    'monthly_access',
  );
  const thirdOrderNo = String(thirdOrder.order_no);
  await confirmDevelopmentPayment(backendUrl, tenantA.accessToken, thirdOrderNo);
  runtimeToken = await openRuntimeSession(backendUrl, tenantA.accessToken, paidCode);

  addStep('verify uninstall preserves license');
  const thirdLicenseId = currentLicenseId(tenantA.tenantId, Number(paidApp.id));
  await requestJson(backendUrl, `/api/app-tenant/apps/${paidCode}/uninstall`, {
    method: 'POST',
    token: tenantA.accessToken,
    body: {},
  });
  assert.equal(
    mysqlQuery(`SELECT status FROM tenant_app_license WHERE id=${thirdLicenseId};`),
    'active',
  );
  await assertRuntimeDenied(backendUrl, runtimeToken);
  await requestDenied(backendUrl, `/api/app-tenant/apps/${paidCode}/open`, {
    token: tenantA.accessToken,
  });
  await installApplication(backendUrl, tenantA.accessToken, paidCode);
  runtimeToken = await openRuntimeSession(backendUrl, tenantA.accessToken, paidCode);

  addStep('verify license revocation denial');
  await requestJson(backendUrl, `/api/app-platform/commerce/licenses/${thirdLicenseId}/revoke`, {
    method: 'PUT',
    token: platform.accessToken,
    body: { reason: 'Disposable platform revocation verification' },
  });
  await assertRuntimeDenied(backendUrl, runtimeToken);

  addStep('verify included entitlement loss');
  mysqlQuery(
    `UPDATE saas_subscription SET status='cancelled', end_time=NOW() WHERE tenant_id=${tenantA.tenantId};`,
  );
  assert.equal(
    (await getCommerce(backendUrl, tenantA.accessToken, includedCode)).access_status,
    'purchase_required',
  );

  addStep('verify developer revenue ownership isolation');
  const ownerRevenue = await requestJson<{
    totals?: { developer_amount_cents?: number };
    apps?: Array<{ app_code?: string }>;
  }>(backendUrl, '/api/app-developer/commerce/revenue', { token: platform.accessToken });
  assert.ok(ownerRevenue.apps?.some((item) => item.app_code === paidCode));
  assert.ok(Number(ownerRevenue.totals?.developer_amount_cents || 0) > 0);
  const foreignRevenue = await requestJson<{
    totals?: { developer_amount_cents?: number };
    apps?: Array<{ app_code?: string }>;
  }>(backendUrl, '/api/app-developer/commerce/revenue', { token: secondAdmin.accessToken });
  assert.equal(
    foreignRevenue.apps?.some((item) => item.app_code === paidCode),
    false,
  );
  assert.equal(Number(foreignRevenue.totals?.developer_amount_cents || 0), 0);

  addStep('verify manual settlement lifecycle');
  const settlementPeriod = previousClosedPeriod();
  mysqlQuery(
    `UPDATE app_revenue_ledger SET create_time=${sqlText(`${settlementPeriod}-15 12:00:00`)} WHERE app_id=${Number(paidApp.id)};`,
  );
  const settlement = await requestJson<AppSettlementRecord>(
    backendUrl,
    '/api/app-platform/commerce/settlements',
    {
      method: 'POST',
      token: platform.accessToken,
      body: { developer_id: platform.userId, period: settlementPeriod },
    },
  );
  const settlementId = Number(settlement.id);
  assert.ok(Number.isSafeInteger(settlementId) && settlementId > 0);
  assert.equal(settlement.status, 'draft');
  const duplicateSettlement = await requestJson<AppSettlementRecord>(
    backendUrl,
    '/api/app-platform/commerce/settlements',
    {
      method: 'POST',
      token: platform.accessToken,
      body: { developer_id: platform.userId, period: settlementPeriod },
    },
  );
  assert.equal(Number(duplicateSettlement.id), settlementId);
  const approved = await requestJson<AppSettlementRecord>(
    backendUrl,
    `/api/app-platform/commerce/settlements/${settlementId}/approve`,
    {
      method: 'POST',
      token: platform.accessToken,
      body: { note: 'Disposable settlement review' },
    },
  );
  assert.equal(approved.status, 'approved');
  const paymentReference = `settlement-${randomBytes(10).toString('hex')}`;
  registerSensitive(paymentReference);
  const paidSettlement = await requestJson<AppSettlementRecord>(
    backendUrl,
    `/api/app-platform/commerce/settlements/${settlementId}/paid`,
    {
      method: 'POST',
      token: platform.accessToken,
      body: { payment_reference: paymentReference },
    },
  );
  assert.equal(paidSettlement.status, 'paid');

  addStep('verify no automated payout or invoice behavior');
  assert.equal(
    Number(
      mysqlQuery(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('app_invoice','app_payout','app_payout_job');",
      ),
    ),
    0,
  );
  assert.equal(
    mysqlQuery(`SELECT status FROM app_settlement_batch WHERE id=${settlementId};`),
    'paid',
  );

  assert.equal(
    Number(legacyApp.id) > 0 && Number(freeApp.id) > 0 && Number(includedApp.id) > 0,
    true,
  );
  assert.notEqual(tenantA.userId, tenantB.userId);
  assert.notEqual(platform.userId, secondAdmin.userId);
}

async function cleanupResources() {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    const errors: unknown[] = [];
    let backendStopped = !backend || backend.exitCode !== null || backend.signalCode !== null;
    try {
      await stopProcess(backend);
      backendStopped = !backend || backend.exitCode !== null || backend.signalCode !== null;
    } catch (error) {
      errors.push(error);
    }
    if (!backendStopped) {
      throw new Error('Skipped destructive cleanup because backend termination was not confirmed');
    }

    if (databaseReady) {
      try {
        deleteOwnedRows();
        addStep('verify zero owned rows');
        assertNoOwnedRows();
      } catch (error) {
        errors.push(error);
      }
    }

    try {
      releaseRedisDatabase();
      addStep('verify Redis cleanup');
    } catch (error) {
      errors.push(error);
    }

    if (databaseName) {
      try {
        mysqlAdminQuery(`DROP DATABASE IF EXISTS \`${databaseName}\`;`);
        addStep('verify disposable database cleanup');
        assertDatabaseRemoved();
        databaseReady = false;
      } catch (error) {
        errors.push(error);
      }
    }

    try {
      if (artifactRoot) rmSync(artifactRoot, { recursive: true, force: true });
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'Application commerce E2E cleanup failed');
  })();
  return cleanupPromise;
}

function writeFailureEvidence(error: unknown) {
  process.stderr.write(
    `${redact(describeError(error))}\nCompleted safe steps:\n${safeSteps.map((step) => `- ${step}`).join('\n')}\n`,
  );
}

function handleTermination(signal: 'SIGINT' | 'SIGTERM') {
  if (terminationStarted) return;
  terminationStarted = true;
  receivedSignal = signal;
  process.exitCode = signal === 'SIGINT' ? 130 : 143;
  process.stderr.write(`Received ${signal}; cleaning up application commerce E2E resources.\n`);
  terminationController.abort(new Error(`Received ${signal}`));
}

const handleSigint = () => handleTermination('SIGINT');
const handleSigterm = () => handleTermination('SIGTERM');
process.on('SIGINT', handleSigint);
process.on('SIGTERM', handleSigterm);

async function run() {
  let mainFailure: unknown;
  let cleanupFailure: unknown;
  try {
    await main();
  } catch (error) {
    mainFailure = error;
    if (!terminationStarted && safeSteps.length > 0) writeFailureEvidence(error);
  }
  try {
    await cleanupResources();
  } catch (error) {
    cleanupFailure = error;
  }
  process.off('SIGINT', handleSigint);
  process.off('SIGTERM', handleSigterm);

  if (cleanupFailure) throw new Error(redact(describeError(cleanupFailure)));
  if (receivedSignal) {
    process.exitCode = receivedSignal === 'SIGINT' ? 130 : 143;
  } else if (mainFailure) {
    throw new Error(redact(describeError(mainFailure)));
  } else {
    addStep('complete');
    console.log('Application commerce live E2E verified.');
  }
}

void run().catch((error) => {
  process.stderr.write(`${redact(describeError(error))}\n`);
  process.exitCode = 1;
});
