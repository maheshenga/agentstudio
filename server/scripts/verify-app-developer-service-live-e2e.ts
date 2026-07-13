import assert from 'node:assert/strict';
import {
  spawn,
  spawnSync,
  type ChildProcess,
  type SpawnOptions,
  type SpawnSyncOptions,
} from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

import JSZip from 'jszip';

type ApiEnvelope<T = unknown> = {
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  token?: string;
  body?: Record<string, unknown>;
};

type LoginData = {
  access_token?: string;
  refresh_token?: string;
  tenant_id?: number | string;
  user?: { id?: number | string; is_admin?: boolean };
};

type AuthSession = {
  tenantId: number;
  userId: number;
  accessToken: string;
  refreshToken: string;
  profile: Record<string, unknown>;
};

type SignupData = {
  userId?: number | string;
  tenantId?: number | string;
};

type RuntimeResponse<T = unknown> = {
  status: number;
  envelope?: ApiEnvelope<T>;
};

type RuntimeInstance = {
  id: string;
  app_code: string;
  version: string;
  process_name: string;
  loopback_port: number;
  role: 'candidate' | 'active' | 'standby' | 'retired';
  process_status: 'starting' | 'online' | 'stopped' | 'failed';
  health_status: 'unknown' | 'checking' | 'healthy' | 'unhealthy';
  diagnostic_code: string;
  diagnostic_message: string;
};

type RuntimeDetail = {
  app_code: string;
  app_name: string;
  app_status: string;
  active_version: string;
  candidate_version: string;
  standby_version: string;
  instances: RuntimeInstance[];
};

type RuntimeProbe = {
  statusCode: number;
  body: Record<string, unknown>;
};

type RuntimeLogs = {
  app_code: string;
  process_name: string;
  role: string;
  stdout: string;
  stderr: string;
};

type DeveloperRuntimeLogs = Omit<RuntimeLogs, 'process_name'> & {
  version: string;
};

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
  runtimeRoot: string;
  pm2Home: string;
  runtimeUser: string;
  pm2Command: string;
  servicePortMin: number;
  servicePortMax: number;
};

const serverRoot = process.cwd();
const repoRoot = resolve(serverRoot, '..');
const serverEntry = resolve(serverRoot, 'dist/main.js');
const verifyDbInit = resolve(serverRoot, 'scripts/verify-db-init.cjs');
const terminationController = new AbortController();
const processLogs = new Map<ChildProcess, { label: string; output: string }>();
const sensitiveValues = new Set<string>();
const safeSteps: Array<{ label: string; at: string }> = [];
const ownedProcessNames = new Set<string>();
const redisOwnerKey = 'agentstudio:app-developer-service-e2e:owner';
const claimRedisScript = `
  if redis.call('DBSIZE') ~= 0 then return 0 end
  if redis.call('SET', KEYS[1], ARGV[1], 'NX') then return 1 end
  return 0
`;
const releaseRedisScript = `
  if redis.call('GET', KEYS[1]) ~= ARGV[1] then return -1 end
  redis.call('FLUSHDB')
  return redis.call('DBSIZE')
`;

let config: Config;
let backend: ChildProcess | undefined;
let databaseName = '';
let artifactRoot = '';
let appCode = '';
let ownedAppId = 0;
let reviewerUserId = 0;
const ownedAppCodes = new Set<string>();
const ownedAppIds = new Set<number>();
const ownedDeveloperIds = new Set<number>();
let redisLeaseOwner = '';
let redisLeaseAcquired = false;
let cleanupPromise: Promise<void> | undefined;
let terminationStarted = false;
let receivedSignal: 'SIGINT' | 'SIGTERM' | undefined;

function requiredEnv(name: string) {
  return String(process.env[name] || '').trim();
}

function addStep(label: string) {
  safeSteps.push({ label, at: new Date().toISOString() });
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function redact(value: string) {
  let result = String(value || '');
  for (const secret of [...sensitiveValues].sort((a, b) => b.length - a.length)) {
    if (secret.length < 4) continue;
    result = result.split(secret).join('[REDACTED]');
  }
  return result
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(
      /\b(password|token|secret|cookie|authorization)\s*[:=]\s*[^\s,;}]+/gi,
      '$1=[REDACTED]',
    );
}

function registerSensitiveEnvironmentValues(input: Config) {
  for (const value of Object.values(input)) {
    const text = String(value ?? '').trim();
    if (text) sensitiveValues.add(text);
  }
}

function tail(value: string, lines = 40, maxChars = 12_000) {
  const bounded = String(value || '')
    .split(/\r?\n/)
    .slice(-lines)
    .join('\n');
  return redact(bounded.slice(-maxChars));
}

function isInside(candidateValue: string, rootValue: string) {
  const rel = relative(resolve(rootValue), resolve(candidateValue));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function assertRuntimeRootOutsideRepository(runtimeRoot: string) {
  assert.equal(
    isInside(runtimeRoot, repoRoot),
    false,
    'runtime root must be outside the repository',
  );
  assert.match(
    runtimeRoot.toLowerCase(),
    /(e2e|test)/,
    'runtime root must identify a disposable E2E path',
  );
  assert.equal(existsSync(runtimeRoot), true, 'runtime root must exist');
  assert.equal(statSync(runtimeRoot).isDirectory(), true, 'runtime root must be a directory');
  assert.equal(readdirSync(runtimeRoot).length, 0, 'runtime root must be empty before the gate');
  assert.equal(
    statSync(runtimeRoot).mode & 0o022,
    0,
    'runtime root must not be group or world writable',
  );
  for (const productionRoot of [
    '/www/wwwroot/agentstudio-plugins',
    '/www/server/agentstudio-app',
  ]) {
    assert.equal(
      isInside(runtimeRoot, productionRoot),
      false,
      'runtime root must stay outside production roots',
    );
  }
}

export function assertDedicatedPm2Home(pm2Home: string, runtimeRoot: string) {
  assert.equal(
    isInside(pm2Home, repoRoot),
    false,
    'isolated PM2 home must be outside the repository',
  );
  assert.match(pm2Home.toLowerCase(), /(e2e|test)/, 'PM2 home must identify an isolated E2E path');
  assert.notEqual(
    resolve(pm2Home),
    resolve(runtimeRoot),
    'PM2 home must be isolated from runtime root',
  );
  assert.equal(existsSync(pm2Home), true, 'PM2 home must exist');
  assert.equal(statSync(pm2Home).isDirectory(), true, 'PM2 home must be a directory');
  assert.equal(readdirSync(pm2Home).length, 0, 'PM2 home must be empty before the gate');
}

export function assertNonRootRuntimeUser(runtimeUser: string) {
  assert.match(runtimeUser, /^[a-z_][a-z0-9_-]{0,31}$/);
  assert.notEqual(runtimeUser, 'root', 'root runtime user is forbidden');
  const result = spawnSync('id', ['-u', runtimeUser], {
    encoding: 'utf8',
    shell: false,
    stdio: 'pipe',
  });
  assert.equal(result.status, 0, 'configured runtime user must exist');
  assert.notEqual(String(result.stdout || '').trim(), '0', 'runtime user must not resolve to root');
}

export function assertDistinctReviewers(reviewerOne: AuthSession, reviewerTwo: AuthSession) {
  assert.notEqual(
    reviewerOne.userId,
    reviewerTwo.userId,
    'two separate platform reviewers required',
  );
}

export function assertDistinctDeveloper(
  developer: AuthSession,
  reviewerOne: AuthSession,
  reviewerTwo: AuthSession,
) {
  assert.notEqual(developer.userId, reviewerOne.userId, 'developer must differ from reviewer one');
  assert.notEqual(developer.userId, reviewerTwo.userId, 'developer must differ from reviewer two');
}

function resolvePm2Command() {
  const configured = requiredEnv('APP_DEVELOPER_SERVICE_E2E_PM2_COMMAND');
  if (configured) {
    assert.equal(isAbsolute(configured), true, 'configured PM2 command must be absolute');
    return configured;
  }
  const result = spawnSync('which', ['pm2'], { encoding: 'utf8', shell: false, stdio: 'pipe' });
  assert.equal(
    result.status,
    0,
    'PM2 must be available or APP_DEVELOPER_SERVICE_E2E_PM2_COMMAND must be set',
  );
  const command = String(result.stdout || '').trim();
  assert.equal(isAbsolute(command), true, 'resolved PM2 command must be absolute');
  return command;
}

function assertRunuserBoundary(input: Config) {
  const env = pm2Environment(input);
  for (const args of [
    ['-u', input.runtimeUser, '--', '/usr/bin/test', '-r', input.runtimeRoot],
    ['-u', input.runtimeUser, '--', '/usr/bin/test', '-x', input.runtimeRoot],
    ['-u', input.runtimeUser, '--', '/usr/bin/test', '-w', input.pm2Home],
    ['-u', input.runtimeUser, '--', input.pm2Command, '--version'],
  ]) {
    const result = spawnSync('runuser', args, {
      env,
      encoding: 'utf8',
      shell: false,
      stdio: 'pipe',
    });
    assert.equal(
      result.status,
      0,
      'runuser boundary must allow the configured low-privilege runtime',
    );
  }
}

function loadConfig(): Config {
  const required = [
    'APP_DEVELOPER_SERVICE_E2E_DB_HOST',
    'APP_DEVELOPER_SERVICE_E2E_DB_PORT',
    'APP_DEVELOPER_SERVICE_E2E_DB_USERNAME',
    'APP_DEVELOPER_SERVICE_E2E_DB_PASSWORD',
    'APP_DEVELOPER_SERVICE_E2E_PLATFORM_USERNAME',
    'APP_DEVELOPER_SERVICE_E2E_PLATFORM_PASSWORD',
    'APP_DEVELOPER_SERVICE_E2E_REDIS_DB',
    'APP_DEVELOPER_SERVICE_E2E_REDIS_ISOLATED',
    'APP_DEVELOPER_SERVICE_E2E_RUNTIME_ROOT',
    'APP_DEVELOPER_SERVICE_E2E_PM2_HOME',
    'APP_DEVELOPER_SERVICE_E2E_RUNTIME_USER',
  ];
  const missing = required.filter((name) => !requiredEnv(name));
  if (missing.length) {
    throw new Error(`Missing required service runtime E2E variables: ${missing.join(', ')}`);
  }
  for (const name of [
    ...required,
    'APP_DEVELOPER_SERVICE_E2E_REDIS_HOST',
    'APP_DEVELOPER_SERVICE_E2E_REDIS_PORT',
    'APP_DEVELOPER_SERVICE_E2E_REDIS_PASSWORD',
    'APP_DEVELOPER_SERVICE_E2E_PM2_COMMAND',
    'APP_DEVELOPER_SERVICE_E2E_PORT_MIN',
    'APP_DEVELOPER_SERVICE_E2E_PORT_MAX',
  ]) {
    const value = requiredEnv(name);
    if (value) sensitiveValues.add(value);
  }
  if (process.platform !== 'linux') {
    throw new Error('Service runtime live E2E requires Linux');
  }
  if (requiredEnv('APP_DEVELOPER_SERVICE_E2E_REDIS_ISOLATED') !== '1') {
    throw new Error('APP_DEVELOPER_SERVICE_E2E_REDIS_ISOLATED must equal 1');
  }
  const redisDb = requiredEnv('APP_DEVELOPER_SERVICE_E2E_REDIS_DB');
  if (redisDb === '0' || !/^(?:[1-9]|1[0-5])$/.test(redisDb)) {
    throw new Error('Redis DB 0 is forbidden; use an isolated logical database from 1 to 15');
  }

  const runtimeRoot = resolve(requiredEnv('APP_DEVELOPER_SERVICE_E2E_RUNTIME_ROOT'));
  const pm2Home = resolve(requiredEnv('APP_DEVELOPER_SERVICE_E2E_PM2_HOME'));
  if (
    !isAbsolute(requiredEnv('APP_DEVELOPER_SERVICE_E2E_RUNTIME_ROOT')) ||
    !isAbsolute(requiredEnv('APP_DEVELOPER_SERVICE_E2E_PM2_HOME'))
  ) {
    throw new Error('Runtime root and isolated PM2 home must be absolute');
  }
  assertRuntimeRootOutsideRepository(runtimeRoot);
  assertDedicatedPm2Home(pm2Home, runtimeRoot);
  const runtimeUser = requiredEnv('APP_DEVELOPER_SERVICE_E2E_RUNTIME_USER');
  assertNonRootRuntimeUser(runtimeUser);

  const servicePortMin = Number(requiredEnv('APP_DEVELOPER_SERVICE_E2E_PORT_MIN') || 32000);
  const servicePortMax = Number(requiredEnv('APP_DEVELOPER_SERVICE_E2E_PORT_MAX') || 32199);
  assert.ok(
    Number.isInteger(servicePortMin) &&
      Number.isInteger(servicePortMax) &&
      servicePortMin >= 1024 &&
      servicePortMax <= 65535 &&
      servicePortMax - servicePortMin >= 99,
    'service E2E port range must contain at least 100 loopback ports',
  );

  const result: Config = {
    dbHost: requiredEnv('APP_DEVELOPER_SERVICE_E2E_DB_HOST'),
    dbPort: requiredEnv('APP_DEVELOPER_SERVICE_E2E_DB_PORT'),
    dbUsername: requiredEnv('APP_DEVELOPER_SERVICE_E2E_DB_USERNAME'),
    dbPassword: requiredEnv('APP_DEVELOPER_SERVICE_E2E_DB_PASSWORD'),
    platformUsername: requiredEnv('APP_DEVELOPER_SERVICE_E2E_PLATFORM_USERNAME'),
    platformPassword: requiredEnv('APP_DEVELOPER_SERVICE_E2E_PLATFORM_PASSWORD'),
    redisHost: requiredEnv('APP_DEVELOPER_SERVICE_E2E_REDIS_HOST') || '127.0.0.1',
    redisPort: requiredEnv('APP_DEVELOPER_SERVICE_E2E_REDIS_PORT') || '6379',
    redisPassword: requiredEnv('APP_DEVELOPER_SERVICE_E2E_REDIS_PASSWORD'),
    redisDb,
    runtimeRoot,
    pm2Home,
    runtimeUser,
    pm2Command: resolvePm2Command(),
    servicePortMin,
    servicePortMax,
  };
  registerSensitiveEnvironmentValues(result);
  return result;
}

function baseChildEnvironment() {
  const keys = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TZ', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot'];
  return Object.fromEntries(
    keys
      .map((key) => [key, process.env[key]])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function databaseEnvironment(dbName = databaseName) {
  return {
    ...baseChildEnvironment(),
    DB_HOST: config.dbHost,
    DB_PORT: config.dbPort,
    DB_USERNAME: config.dbUsername,
    DB_PASSWORD: config.dbPassword,
    DB_NAME: dbName,
    MYSQL_PWD: config.dbPassword,
  };
}

function mysqlArgs(extra: string[]) {
  return [
    '--default-character-set=utf8mb4',
    '-h',
    config.dbHost,
    '-P',
    config.dbPort,
    '-u',
    config.dbUsername,
    ...extra,
  ];
}

function runChecked(label: string, file: string, args: string[], options: SpawnSyncOptions = {}) {
  const result = spawnSync(file, args, {
    cwd: serverRoot,
    env: baseChildEnvironment(),
    encoding: 'utf8',
    stdio: 'pipe',
    shell: false,
    ...options,
  });
  if (result.error) throw new Error(`${label} failed to start: ${redact(result.error.message)}`);
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status}: ${tail(String(result.stderr || ''))}`,
    );
  }
  return String(result.stdout || '').trim();
}

function mysqlAdminQuery(sql: string) {
  return runChecked(
    'MySQL admin query',
    'mysql',
    mysqlArgs(['--batch', '--skip-column-names', '--execute', sql]),
    {
      env: databaseEnvironment(''),
    },
  );
}

function mysqlQuery(sql: string) {
  return runChecked(
    'MySQL query',
    'mysql',
    mysqlArgs(['--batch', '--skip-column-names', databaseName, '--execute', sql]),
    { env: databaseEnvironment() },
  );
}

function assertDisposableDatabaseName(value: string) {
  assert.match(value, /^agentstudio_developer_service_e2e_[a-z0-9]+$/);
  assert.doesNotMatch(value, /prod|production|live/i, 'production-like database name is forbidden');
}

function assertDatabaseRemoved() {
  if (!databaseName) return;
  const remaining = Number(
    mysqlAdminQuery(
      `SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${databaseName}';`,
    ),
  );
  assert.equal(remaining, 0, 'disposable database cleanup must remove the generated database');
}

function redisEnvironment() {
  return {
    ...baseChildEnvironment(),
    ...(config.redisPassword ? { REDISCLI_AUTH: config.redisPassword } : {}),
  };
}

function redisCommand(args: string[]) {
  return runChecked(
    'Redis command',
    'redis-cli',
    ['-h', config.redisHost, '-p', config.redisPort, '-n', config.redisDb, '--raw', ...args],
    { env: redisEnvironment() },
  );
}

function claimRedisDatabase() {
  redisLeaseOwner = randomBytes(24).toString('hex');
  sensitiveValues.add(redisLeaseOwner);
  const claimed = Number(
    redisCommand(['EVAL', claimRedisScript, '1', redisOwnerKey, redisLeaseOwner]),
  );
  assert.equal(claimed, 1, 'isolated Redis database must be empty and claimable');
  redisLeaseAcquired = true;
}

function releaseRedisDatabase() {
  if (!redisLeaseAcquired) return;
  const remaining = Number(
    redisCommand(['EVAL', releaseRedisScript, '1', redisOwnerKey, redisLeaseOwner]),
  );
  assert.equal(remaining, 0, 'verify Redis cleanup must leave the isolated database empty');
  redisLeaseAcquired = false;
}

function pm2Environment(input = config) {
  return {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    HOME: dirname(input.pm2Home),
    PM2_HOME: input.pm2Home,
    NODE_ENV: 'production',
  };
}

function pm2Command(args: string[], allowFailure = false) {
  const result = spawnSync(
    'runuser',
    ['-u', config.runtimeUser, '--', config.pm2Command, ...args],
    {
      cwd: config.runtimeRoot,
      env: pm2Environment(),
      encoding: 'utf8',
      stdio: 'pipe',
      shell: false,
    },
  );
  if (result.error) throw new Error(`PM2 command failed to start: ${redact(result.error.message)}`);
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `PM2 command failed with exit code ${result.status}: ${tail(String(result.stderr || ''))}`,
    );
  }
  return {
    status: result.status,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  };
}

function listPm2Processes() {
  const result = pm2Command(['jlist']);
  const parsed = JSON.parse(result.stdout || '[]') as Array<{ name?: unknown }>;
  assert.equal(Array.isArray(parsed), true, 'PM2 process list must be an array');
  return parsed.map((item) => String(item.name || '')).filter(Boolean);
}

export function assertNoOwnedProcesses() {
  const active = listPm2Processes().filter((name) => ownedProcessNames.has(name));
  assert.deepEqual(active, [], 'verify PM2 cleanup must remove every owned service process');
}

function processNameFor(code: string, version: string) {
  return `agentstudio-app-${code.replace(/_/g, '-')}-${version.replace(/\./g, '-')}`;
}

function appendProcessOutput(child: ChildProcess, chunk: unknown) {
  const record = processLogs.get(child);
  if (!record) return;
  record.output = `${record.output}${String(chunk || '')}`.slice(-256 * 1024);
}

function startProcess(label: string, file: string, args: string[], options: SpawnOptions) {
  const child = spawn(file, args, {
    ...options,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processLogs.set(child, { label, output: '' });
  child.stdout?.on('data', (chunk) => appendProcessOutput(child, chunk));
  child.stderr?.on('data', (chunk) => appendProcessOutput(child, chunk));
  child.on('error', (error) => appendProcessOutput(child, error.message));
  return child;
}

export async function waitForForcedExit(child: ChildProcess, timeoutMs = 10_000) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      child.off('exit', onExit);
      reject(new Error('process did not exit before timeout'));
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timeout);
      resolvePromise();
    };
    child.once('exit', onExit);
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
      throw new Error(
        `backend exited before readiness: ${tail(processLogs.get(child)?.output || '')}`,
      );
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
  return { response, envelope, raw };
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
  return { status: response.status, envelope };
}

async function requestRuntime<T>(
  baseUrl: string,
  path: string,
  token: string,
  body: Record<string, unknown>,
): Promise<RuntimeResponse<T>> {
  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-app-runtime-token': token,
    },
    body: JSON.stringify(body),
    signal: terminationController.signal,
  });
  const raw = await response.text();
  let envelope: ApiEnvelope<T> | undefined;
  try {
    envelope = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : undefined;
  } catch {
    envelope = undefined;
  }
  return { status: response.status, envelope };
}

function assertRuntimeSuccess<T>(response: RuntimeResponse<T>, label: string) {
  assert.equal(response.status, 200, `${label} must return HTTP 200`);
  assert.equal(Number(response.envelope?.code), 200, `${label} must return business success`);
  return response.envelope?.data as T;
}

function assertRuntimeDenied(response: RuntimeResponse, label: string, expectedStatuses: number[]) {
  assert.ok(
    expectedStatuses.includes(response.status),
    `${label} must fail closed with one of: ${expectedStatuses.join(', ')}`,
  );
  assert.notEqual(
    Number(response.envelope?.code),
    200,
    `${label} must not return business success`,
  );
}

async function uploadZip<T>(baseUrl: string, path: string, token: string, buffer: Buffer) {
  const form = new FormData();
  const bytes = new Uint8Array(buffer.length);
  bytes.set(buffer);
  form.append('file', new Blob([bytes], { type: 'application/zip' }), 'service.zip');
  const response = await fetch(new URL(path, `${baseUrl}/`), {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
    signal: terminationController.signal,
  });
  const raw = await response.text();
  const envelope = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : {};
  if (!response.ok || Number(envelope.code) !== 200) {
    throw new Error(
      `POST ${path} failed with HTTP ${response.status}: ${redact(envelope.message || envelope.msg || 'upload failed')}`,
    );
  }
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
  assert.ok(
    login.access_token && login.refresh_token,
    'login must return access and refresh tokens',
  );
  sensitiveValues.add(login.access_token);
  sensitiveValues.add(login.refresh_token);
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

function backendEnvironment(input: { port: number; jwtSecret: string; enabled: boolean }) {
  return {
    ...baseChildEnvironment(),
    NODE_ENV: 'test',
    NO_CLUSTER: '1',
    DEBUG: 'false',
    APP_PORT: String(input.port),
    APP_API_PREFIX: '',
    DB_HOST: config.dbHost,
    DB_PORT: config.dbPort,
    DB_USERNAME: config.dbUsername,
    DB_PASSWORD: config.dbPassword,
    DB_NAME: databaseName,
    DB_SYNC: 'false',
    REDIS_HOST: config.redisHost,
    REDIS_PORT: config.redisPort,
    REDIS_PASSWORD: config.redisPassword,
    REDIS_DB: config.redisDb,
    JWT_SECRET: input.jwtSecret,
    LOGIN_CAPTCHA_ENABLED: 'false',
    LOG_CONSOLE_ENABLED: 'false',
    LOG_FILE_ENABLED: 'false',
    FILE_UPLOAD_DIR: resolve(artifactRoot, 'uploads'),
    APP_PACKAGE_DIR: resolve(artifactRoot, 'packages'),
    APP_PUBLIC_DIR: resolve(artifactRoot, 'public'),
    APP_SERVICE_RUNTIME_ENABLED: input.enabled ? 'true' : 'false',
    APP_SERVICE_RUNTIME_DIR: config.runtimeRoot,
    APP_SERVICE_RUNTIME_USER: config.runtimeUser,
    APP_SERVICE_PM2_HOME: config.pm2Home,
    APP_SERVICE_PM2_COMMAND: config.pm2Command,
    APP_SERVICE_RUNTIME_INTERPRETER: 'node',
    APP_SERVICE_MEMORY_MB: '256',
    APP_SERVICE_PORT_MIN: String(config.servicePortMin),
    APP_SERVICE_PORT_MAX: String(config.servicePortMax),
    APP_SERVICE_HEALTH_SUCCESS_COUNT: '3',
    APP_DEVELOPER_SERVICE_ENABLED: input.enabled ? 'true' : 'false',
    APP_DEVELOPER_SERVICE_CONCURRENCY: '1',
    APP_DEVELOPER_SERVICE_RATE_PER_MINUTE: '2',
    APP_DEVELOPER_SERVICE_CIRCUIT_FAILURES: '2',
    APP_DEVELOPER_SERVICE_CIRCUIT_OPEN_SECONDS: '10',
    APP_DEVELOPER_SERVICE_LOG_RETENTION_DAYS: '7',
    APP_RUNTIME_CAPABILITIES_ENABLED: input.enabled ? 'true' : 'false',
    APP_RUNTIME_IFRAME_LAUNCH_ENABLED: input.enabled ? 'true' : 'false',
  };
}

async function startBackend(enabled: boolean, jwtSecret: string) {
  const port = await findFreePort();
  sensitiveValues.add(String(port));
  const child = startProcess('service runtime backend', process.execPath, [serverEntry], {
    cwd: serverRoot,
    env: backendEnvironment({ port, jwtSecret, enabled }),
  });
  const backendUrl = `http://127.0.0.1:${port}`;
  sensitiveValues.add(backendUrl);
  await waitForHttp(`${backendUrl}/api/core/login-captcha`, child);
  return { child, backendUrl };
}

function createServiceSource(version: string) {
  return [
    "'use strict';",
    'let healthy = true;',
    `const serviceVersion = '${version}';`,
    "exports.health = async function health() { return healthy ? { status: 'ok', version: serviceVersion } : { status: 'down', version: serviceVersion }; };",
    "exports.invoke = async function invoke(request, context) { if (request && request.__e2e_health === 'unhealthy') healthy = false; if (request && request.__e2e_health === 'healthy') healthy = true; if (request && request.__e2e_fail === true) throw new Error('forced e2e failure'); console.log(JSON.stringify({ event: 'invoke', request: request })); return { version: serviceVersion, healthy: healthy, echo: request, context: context || {} }; };",
  ].join('\n');
}

async function createServiceZip(code: string, version: string) {
  const zip = new JSZip();
  zip.file(
    'app.manifest.json',
    JSON.stringify({
      manifestVersion: 2,
      code,
      version,
      runtime: 'service',
      entry: 'dist/index.js',
      healthPath: '/health',
      capabilities: [],
      serviceTargets: [],
      allowedOrigins: [],
      runtimeConfig: {},
    }),
  );
  zip.file('dist/index.js', createServiceSource(version));
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'UNIX',
  });
  writeFileSync(resolve(artifactRoot, `${code}-${version}.zip`), buffer);
  return buffer;
}

async function createCallerZip(code: string, targetCode: string) {
  const zip = new JSZip();
  zip.file(
    'manifest.json',
    JSON.stringify({
      code,
      name: 'Developer Service Caller',
      version: '1.0.0',
      type: 'static',
      entry: 'dist/index.html',
      category: 'operations',
      summary: 'Disposable caller for service.invoke verification',
      description: 'Calls one declared restricted service through the runtime gateway.',
      tenant_scoped: true,
      permissions: ['service.invoke'],
      serviceTargets: [targetCode],
    }),
  );
  zip.file('dist/index.html', '<!doctype html><meta charset="utf-8"><title>Caller</title>');
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'UNIX',
  });
  writeFileSync(resolve(artifactRoot, `${code}-1.0.0.zip`), buffer);
  return buffer;
}

function readRuntimeSession(metadata: Record<string, any>) {
  const session = metadata?.runtime?.session as { token?: string; expires_at?: string } | undefined;
  assert.equal(metadata?.runtime?.context, null, 'runtime session must not inline tenant context');
  const token = String(session?.token || '');
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(Number.isFinite(Date.parse(String(session?.expires_at || ''))));
  sensitiveValues.add(token);
  return token;
}

async function directCandidateInvoke(port: number, payload: Record<string, unknown>) {
  assert.ok(
    Number.isInteger(port) && port >= config.servicePortMin && port <= config.servicePortMax,
  );
  const response = await fetch(`http://127.0.0.1:${port}/invoke`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'manual',
    signal: terminationController.signal,
  });
  assert.equal(
    response.status,
    200,
    'candidate fixture control must use the loopback invoke endpoint',
  );
  return response.json() as Promise<Record<string, unknown>>;
}

function assertProbeVersion(probe: RuntimeProbe, version: string) {
  assert.equal(probe.statusCode, 200);
  assert.equal(probe.body.version, version);
}

function assertNoSensitiveValue(label: string, value: string, extras: string[] = []) {
  const text = String(value || '');
  for (const secret of [...sensitiveValues, ...extras].filter((item) => item.length >= 4)) {
    assert.equal(text.includes(secret), false, `${label} must not expose a sensitive value`);
  }
}

function makeWritable(target: string) {
  if (!existsSync(target)) return;
  const stat = lstatSync(target);
  if (stat.isSymbolicLink()) return;
  try {
    chmodSync(target, stat.isDirectory() ? 0o755 : 0o644);
  } catch {
    // Cleanup will report the eventual removal failure.
  }
  if (stat.isDirectory()) {
    for (const entry of readdirSync(target)) makeWritable(join(target, entry));
  }
}

export function assertReleaseCleanup() {
  for (const code of ownedAppCodes) {
    assert.equal(
      existsSync(resolve(config.runtimeRoot, code)),
      false,
      'verify release cleanup must remove owned releases',
    );
  }
}

function deleteOwnedRows() {
  const appIds = [...ownedAppIds];
  if (appIds.length) {
    const ids = appIds.join(',');
    for (const sql of [
      `DELETE FROM app_service_invocation WHERE caller_app_id IN (${ids}) OR target_app_id IN (${ids});`,
      `DELETE FROM app_runtime_audit_log WHERE app_id IN (${ids});`,
      `DELETE FROM app_runtime_session WHERE app_id IN (${ids});`,
      `DELETE FROM tenant_app_install WHERE app_id IN (${ids});`,
      `DELETE FROM app_review_log WHERE app_id IN (${ids});`,
      `DELETE FROM app_capability_grant WHERE app_id IN (${ids});`,
      `DELETE FROM app_service_instance WHERE app_id IN (${ids});`,
      `DELETE FROM app_package_version WHERE app_id IN (${ids});`,
      `DELETE FROM app_package WHERE id IN (${ids});`,
    ]) {
      mysqlQuery(sql);
    }
  }
  if (ownedDeveloperIds.size) {
    mysqlQuery(
      `DELETE FROM app_developer_profile WHERE user_id IN (${[...ownedDeveloperIds].join(',')});`,
    );
  }
  if (reviewerUserId) {
    mysqlQuery(`DELETE FROM sa_system_user_role WHERE user_id=${reviewerUserId};`);
    mysqlQuery(`DELETE FROM sa_system_user_tenant WHERE user_id=${reviewerUserId};`);
    mysqlQuery(`DELETE FROM sa_system_user WHERE id=${reviewerUserId};`);
  }
}

export function assertNoOwnedRows() {
  const appIds = [...ownedAppIds];
  if (appIds.length) {
    const ids = appIds.join(',');
    const counts = mysqlQuery(
      [
        `SELECT COUNT(*) FROM app_package WHERE id IN (${ids})`,
        `UNION ALL SELECT COUNT(*) FROM app_package_version WHERE app_id IN (${ids})`,
        `UNION ALL SELECT COUNT(*) FROM app_service_instance WHERE app_id IN (${ids})`,
        `UNION ALL SELECT COUNT(*) FROM app_service_invocation WHERE caller_app_id IN (${ids}) OR target_app_id IN (${ids})`,
        `UNION ALL SELECT COUNT(*) FROM app_runtime_session WHERE app_id IN (${ids})`,
        `UNION ALL SELECT COUNT(*) FROM tenant_app_install WHERE app_id IN (${ids})`,
        `UNION ALL SELECT COUNT(*) FROM app_review_log WHERE app_id IN (${ids})`,
        `UNION ALL SELECT COUNT(*) FROM app_capability_grant WHERE app_id IN (${ids})`,
      ].join(' '),
    )
      .split(/\r?\n/)
      .filter(Boolean)
      .map(Number);
    assert.equal(
      counts.every((count) => count === 0),
      true,
      'verify zero owned rows',
    );
  }
  if (ownedDeveloperIds.size) {
    assert.equal(
      Number(
        mysqlQuery(
          `SELECT COUNT(*) FROM app_developer_profile WHERE user_id IN (${[...ownedDeveloperIds].join(',')});`,
        ),
      ),
      0,
      'developer profile fixtures must be removed',
    );
  }
  if (reviewerUserId) {
    assert.equal(
      Number(mysqlQuery(`SELECT COUNT(*) FROM sa_system_user WHERE id=${reviewerUserId};`)),
      0,
      'reviewer fixture row must be removed',
    );
  }
}

async function retry<T>(label: string, callback: () => Promise<T>, attempts = 20) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await callback();
    } catch (error) {
      lastError = error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
    }
  }
  throw new Error(`${label} failed after retries: ${redact(describeError(lastError))}`);
}

function recordOwnedApp(code: string) {
  const id = Number(mysqlQuery(`SELECT id FROM app_package WHERE code='${code}';`));
  assert.ok(Number.isSafeInteger(id) && id > 0, `owned app ${code} must exist`);
  ownedAppCodes.add(code);
  ownedAppIds.add(id);
  return id;
}

async function signupTenantOwner(
  backendUrl: string,
  input: {
    username: string;
    password: string;
    realname: string;
    tenantName: string;
    phone: string;
    email: string;
  },
) {
  const signup = await requestJson<SignupData>(backendUrl, '/api/saas/signup', {
    method: 'POST',
    body: {
      username: input.username,
      password: input.password,
      realname: input.realname,
      tenant_name: input.tenantName,
      phone: input.phone,
      email: input.email,
      industry: 'software',
      team_size: '1-10',
    },
  });
  const userId = Number(signup.userId);
  const tenantId = Number(signup.tenantId);
  assert.ok(Number.isSafeInteger(userId) && userId > 0, 'signup user id must be available');
  assert.ok(Number.isSafeInteger(tenantId) && tenantId > 0, 'signup tenant id must be available');
  ownedDeveloperIds.add(userId);
  return authenticate(backendUrl, input.username, input.password, tenantId);
}

function clearInvocationState(tenantId: number, targetAppId: number) {
  const prefix = `app_service:invoke:tenant:${tenantId}:target:${targetAppId}`;
  redisCommand([
    'DEL',
    `${prefix}:concurrency`,
    `${prefix}:rate`,
    `${prefix}:circuit:failures`,
    `${prefix}:circuit:open`,
  ]);
  mysqlQuery(
    `UPDATE app_service_instance SET active_invocations=0, consecutive_failures=0, circuit_state='closed', circuit_open_until=NULL WHERE app_id=${targetAppId};`,
  );
}

async function main() {
  config = loadConfig();
  assertRunuserBoundary(config);
  const suffix = (Date.now().toString(36) + randomBytes(3).toString('hex')).toLowerCase();
  databaseName = ('agentstudio_developer_service_e2e_' + suffix).toLowerCase();
  assertDisposableDatabaseName(databaseName);
  artifactRoot = mkdtempSync(join(tmpdir(), 'agentstudio-developer-service-e2e-'));

  const targetCode = ('developer_service_' + suffix).slice(0, 70);
  const callerCode = ('developer_caller_' + suffix).slice(0, 70);
  const adminCode = ('admin_service_' + suffix).slice(0, 70);
  appCode = targetCode;
  for (const code of [targetCode, callerCode, adminCode]) ownedAppCodes.add(code);
  for (const code of [targetCode, adminCode]) {
    ownedProcessNames.add(processNameFor(code, '1.0.0'));
  }
  for (const value of [
    databaseName,
    artifactRoot,
    targetCode,
    callerCode,
    adminCode,
    ...ownedProcessNames,
  ]) {
    sensitiveValues.add(value);
  }

  const reviewerTwoUsername = ('developer_reviewer_' + suffix).slice(0, 30);
  const reviewerTwoPassword = 'Rv' + randomBytes(18).toString('hex') + '9';
  const developerUsername = ('developer_owner_' + suffix).slice(0, 60);
  const developerPassword = 'Dv' + randomBytes(18).toString('hex') + '8';
  const developerPhone = '136' + String(Date.now()).slice(-8);
  const developerEmail = developerUsername + '@example.test';
  const foreignUsername = ('foreign_developer_' + suffix).slice(0, 60);
  const foreignPassword = 'Fr' + randomBytes(18).toString('hex') + '7';
  const foreignPhone = '137' + String(Date.now() + 1).slice(-8);
  const foreignEmail = foreignUsername + '@example.test';
  const jwtSecret = randomBytes(48).toString('base64url');
  const logSecrets = {
    password: 'db-' + randomBytes(12).toString('hex'),
    token: 'token-' + randomBytes(12).toString('hex'),
    secret: 'runtime-' + randomBytes(12).toString('hex'),
    cookie: 'session=' + randomBytes(12).toString('hex'),
  };
  for (const value of [
    reviewerTwoUsername,
    reviewerTwoPassword,
    developerUsername,
    developerPassword,
    developerPhone,
    developerEmail,
    foreignUsername,
    foreignPassword,
    foreignPhone,
    foreignEmail,
    jwtSecret,
    ...Object.values(logSecrets),
  ]) {
    sensitiveValues.add(value);
  }

  addStep('claim isolated Redis database');
  claimRedisDatabase();

  addStep('initialize disposable database');
  runChecked('build backend', 'pnpm', ['run', 'build'], { env: baseChildEnvironment() });
  assert.equal(
    existsSync(serverEntry),
    true,
    'backend build artifact is missing: ' + basename(serverEntry),
  );
  runChecked('initialize disposable database', process.execPath, [verifyDbInit], {
    env: {
      ...databaseEnvironment(databaseName),
      DB_VERIFY_NAME: databaseName,
      DB_VERIFY_KEEP: '1',
      NODE_ENV: 'test',
    },
  });

  let running = await startBackend(false, jwtSecret);
  backend = running.child;
  let backendUrl = running.backendUrl;
  let reviewerOne = await authenticate(
    backendUrl,
    config.platformUsername,
    config.platformPassword,
  );
  assert.equal(
    (reviewerOne.profile as { is_platform_admin?: unknown }).is_platform_admin === true ||
      (reviewerOne.profile as { is_admin?: unknown }).is_admin === true ||
      (reviewerOne.profile as { account_scope?: unknown }).account_scope === 'platform' ||
      (reviewerOne.profile as { is_super?: unknown }).is_super === 1,
    true,
    'seeded account must be a platform administrator',
  );

  addStep('verify feature flags initially disabled');
  await requestDenied(backendUrl, '/api/app-platform/runtime/reconcile', {
    method: 'POST',
    token: reviewerOne.accessToken,
    body: {},
  });
  assertNoOwnedProcesses();

  await stopProcess(backend);
  backend = undefined;
  running = await startBackend(true, jwtSecret);
  backend = running.child;
  backendUrl = running.backendUrl;
  reviewerOne = await authenticate(backendUrl, config.platformUsername, config.platformPassword);

  const adminRoleId = Number(
    mysqlQuery(
      "SELECT id FROM sa_system_role WHERE code IN ('admin','super_admin') AND status=1 AND delete_time IS NULL ORDER BY (code='admin') DESC, id ASC LIMIT 1;",
    ),
  );
  assert.ok(
    Number.isSafeInteger(adminRoleId) && adminRoleId > 0,
    'platform administrator role must exist',
  );
  await requestJson(backendUrl, '/api/system/user/create', {
    method: 'POST',
    token: reviewerOne.accessToken,
    body: {
      username: reviewerTwoUsername,
      realname: 'Developer Service E2E Reviewer',
      password: reviewerTwoPassword,
      role_ids: [adminRoleId],
      status: 1,
      remark: 'Disposable certified developer service reviewer',
    },
  });
  reviewerUserId = Number(
    mysqlQuery("SELECT id FROM sa_system_user WHERE username='" + reviewerTwoUsername + "';"),
  );
  assert.ok(Number.isSafeInteger(reviewerUserId) && reviewerUserId > 0);
  const reviewerTwo = await authenticate(
    backendUrl,
    reviewerTwoUsername,
    reviewerTwoPassword,
    reviewerOne.tenantId,
  );
  addStep('verify two separate platform reviewers');
  assertDistinctReviewers(reviewerOne, reviewerTwo);

  const developer = await signupTenantOwner(backendUrl, {
    username: developerUsername,
    password: developerPassword,
    realname: 'Certified Developer ' + suffix,
    tenantName: 'Developer Tenant ' + suffix,
    phone: developerPhone,
    email: developerEmail,
  });
  const foreignDeveloper = await signupTenantOwner(backendUrl, {
    username: foreignUsername,
    password: foreignPassword,
    realname: 'Foreign Developer ' + suffix,
    tenantName: 'Foreign Tenant ' + suffix,
    phone: foreignPhone,
    email: foreignEmail,
  });
  addStep('verify certified developer identity is distinct');
  assertDistinctDeveloper(developer, reviewerOne, reviewerTwo);
  assert.notEqual(
    developer.tenantId,
    foreignDeveloper.tenantId,
    'tenant fixtures must be distinct',
  );

  const certification = await requestJson<any>(backendUrl, '/api/app-developer/profile/apply', {
    method: 'POST',
    token: developer.accessToken,
    body: {
      display_name: 'Certified Developer ' + suffix,
      statement: 'Disposable certified developer service verification application.',
      requested_runtime_types: ['static', 'service'],
    },
  });
  const profileId = Number(certification.id);
  assert.ok(Number.isSafeInteger(profileId) && profileId > 0);
  await requestJson(backendUrl, '/api/app-platform/developers/' + profileId + '/decision', {
    method: 'POST',
    token: reviewerOne.accessToken,
    body: {
      decision: 'certified',
      approved_runtime_types: ['static', 'service'],
      risk_level: 'low',
      certification_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      message: 'Approved for disposable P11 verification',
    },
  });
  assert.equal(
    Number(
      mysqlQuery(
        'SELECT COUNT(*) FROM app_developer_profile WHERE id=' +
          profileId +
          ' AND user_id=' +
          developer.userId +
          " AND certification_status='certified' AND disabled=0;",
      ),
    ),
    1,
    'developer certification must be active',
  );

  await requestJson(backendUrl, '/api/app-developer/apps', {
    method: 'POST',
    token: developer.accessToken,
    body: {
      runtime_type: 'service',
      code: targetCode,
      name: 'Restricted Developer Service',
      category: 'operations',
      summary: 'Disposable restricted service target',
      description: 'Runs only behind the same-tenant service.invoke gateway.',
    },
  });
  ownedAppId = recordOwnedApp(targetCode);

  const targetVersion = await uploadZip<any>(
    backendUrl,
    '/api/app-developer/apps/' + targetCode + '/versions/upload',
    developer.accessToken,
    await createServiceZip(targetCode, '1.0.0'),
  );
  addStep('verify developer service submission snapshot');
  assert.equal(targetVersion.scan_result?.passed, true);
  assert.match(String(targetVersion.review_snapshot_hash || ''), /^[a-f0-9]{64}$/);
  assert.ok(targetVersion.review_snapshot);
  assert.deepEqual(targetVersion.service_targets, []);
  assert.equal(
    Number(
      mysqlQuery(
        'SELECT COUNT(*) FROM app_package WHERE id=' +
          ownedAppId +
          ' AND developer_id=' +
          developer.userId +
          " AND trust_level='developer_restricted';",
      ),
    ),
    1,
  );
  const targetVersionId = Number(
    mysqlQuery(
      'SELECT id FROM app_package_version WHERE app_id=' + ownedAppId + " AND version='1.0.0';",
    ),
  );

  await requestJson(
    backendUrl,
    '/api/app-platform/apps/' + targetCode + '/versions/1.0.0/approve',
    {
      method: 'POST',
      token: reviewerOne.accessToken,
      body: { message: 'Independent restricted service review', approved_capabilities: [] },
    },
  );
  addStep('verify same reviewer separation');
  await requestDenied(
    backendUrl,
    '/api/app-platform/runtime/apps/' + targetCode + '/versions/1.0.0/candidate',
    { method: 'POST', token: reviewerOne.accessToken, body: {} },
  );
  let targetDetail = await requestJson<RuntimeDetail>(
    backendUrl,
    '/api/app-platform/runtime/apps/' + targetCode + '/versions/1.0.0/candidate',
    { method: 'POST', token: reviewerTwo.accessToken, body: {} },
  );
  assert.equal(targetDetail.candidate_version, '1.0.0');
  assert.equal(
    targetDetail.instances.find((item) => item.version === '1.0.0')?.health_status,
    'healthy',
  );
  targetDetail = await requestJson<RuntimeDetail>(
    backendUrl,
    '/api/app-platform/runtime/apps/' + targetCode + '/versions/1.0.0/publish',
    { method: 'POST', token: reviewerTwo.accessToken, body: {} },
  );
  addStep('verify service candidate and publication');
  assert.equal(targetDetail.active_version, '1.0.0');

  await requestJson(backendUrl, '/api/app-developer/apps', {
    method: 'POST',
    token: developer.accessToken,
    body: {
      runtime_type: 'static',
      code: callerCode,
      name: 'Developer Service Caller',
      category: 'operations',
      summary: 'Disposable service.invoke caller',
      description: 'Declares one immutable restricted service target.',
    },
  });
  const callerAppId = recordOwnedApp(callerCode);
  await uploadZip<any>(
    backendUrl,
    '/api/app-developer/apps/' + callerCode + '/versions/upload',
    developer.accessToken,
    await createCallerZip(callerCode, targetCode),
  );
  await requestJson(
    backendUrl,
    '/api/app-platform/apps/' + callerCode + '/versions/1.0.0/approve',
    {
      method: 'POST',
      token: reviewerOne.accessToken,
      body: {
        message: 'Approve the immutable service.invoke target declaration',
        approved_capabilities: ['service.invoke'],
      },
    },
  );
  await requestJson(
    backendUrl,
    '/api/app-platform/apps/' + callerCode + '/versions/1.0.0/publish',
    { method: 'POST', token: reviewerOne.accessToken, body: {} },
  );
  const callerVersionId = Number(
    mysqlQuery(
      'SELECT id FROM app_package_version WHERE app_id=' + callerAppId + " AND version='1.0.0';",
    ),
  );

  await requestJson(backendUrl, '/api/app-tenant/apps/' + targetCode + '/install', {
    method: 'POST',
    token: developer.accessToken,
    body: { capabilities: [] },
  });
  await requestJson(backendUrl, '/api/app-tenant/apps/' + callerCode + '/install', {
    method: 'POST',
    token: developer.accessToken,
    body: { capabilities: ['service.invoke'] },
  });
  const openMetadata = await requestJson<Record<string, any>>(
    backendUrl,
    '/api/app-tenant/apps/' + callerCode + '/open',
    { token: developer.accessToken },
  );
  const runtimeToken = readRuntimeSession(openMetadata);

  mysqlQuery(
    'INSERT INTO app_service_invocation ' +
      '(tenant_id, caller_app_id, caller_version_id, target_app_id, target_version_id, developer_id, outcome, status_code, duration_ms, error_code, create_time) VALUES (' +
      [
        developer.tenantId,
        callerAppId,
        callerVersionId,
        ownedAppId,
        targetVersionId,
        developer.userId,
        "'success'",
        200,
        1,
        "''",
        'DATE_SUB(NOW(), INTERVAL 8 DAY)',
      ].join(',') +
      ');',
  );

  const invokePath = '/api/app-runtime/services/' + targetCode + '/invoke';
  const invocation = assertRuntimeSuccess<any>(
    await requestRuntime(backendUrl, invokePath, runtimeToken, {
      input: {
        password: logSecrets.password,
        token: logSecrets.token,
        secret: logSecrets.secret,
        cookie: logSecrets.cookie,
      },
    }),
    'same-tenant developer service invocation',
  );
  addStep('verify same-tenant service invocation');
  assert.equal(invocation.status, 200);
  assert.equal(invocation.data?.version, '1.0.0');
  assert.equal(invocation.data?.context?.tenant?.id, String(developer.tenantId));
  assert.equal(invocation.data?.context?.user?.id, String(developer.userId));
  assert.equal(invocation.data?.context?.caller?.app_id, String(callerAppId));
  await retry('seven-day invocation retention cleanup', async () => {
    assert.equal(
      Number(
        mysqlQuery(
          'SELECT COUNT(*) FROM app_service_invocation WHERE target_app_id=' +
            ownedAppId +
            ' AND create_time < DATE_SUB(NOW(), INTERVAL 7 DAY);',
        ),
      ),
      0,
    );
    return true;
  });

  addStep('verify undeclared target rejection');
  assertRuntimeDenied(
    await requestRuntime(
      backendUrl,
      '/api/app-runtime/services/undeclared_service/invoke',
      runtimeToken,
      { input: {} },
    ),
    'undeclared service target',
    [403],
  );

  await requestJson(backendUrl, '/api/app-tenant/apps/' + callerCode + '/install', {
    method: 'POST',
    token: foreignDeveloper.accessToken,
    body: { capabilities: ['service.invoke'] },
  });
  const foreignOpen = await requestJson<Record<string, any>>(
    backendUrl,
    '/api/app-tenant/apps/' + callerCode + '/open',
    { token: foreignDeveloper.accessToken },
  );
  addStep('verify foreign tenant rejection');
  assertRuntimeDenied(
    await requestRuntime(backendUrl, invokePath, readRuntimeSession(foreignOpen), { input: {} }),
    'foreign tenant without target installation',
    [403],
  );

  addStep('verify foreign developer log denial');
  await requestDenied(
    backendUrl,
    '/api/app-developer/apps/' + targetCode + '/runtime/logs?lines=100',
    { token: foreignDeveloper.accessToken },
  );

  clearInvocationState(developer.tenantId, ownedAppId);
  mysqlQuery('UPDATE app_developer_profile SET disabled=1 WHERE id=' + profileId + ';');
  addStep('verify disabled certification rejection');
  assertRuntimeDenied(
    await requestRuntime(backendUrl, invokePath, runtimeToken, { input: {} }),
    'disabled developer certification',
    [400, 403],
  );
  mysqlQuery('UPDATE app_developer_profile SET disabled=0 WHERE id=' + profileId + ';');

  clearInvocationState(developer.tenantId, ownedAppId);
  mysqlQuery(
    "UPDATE app_developer_profile SET certification_status='certified', certification_expiry=DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE id=" +
      profileId +
      ';',
  );
  addStep('verify expired certification rejection');
  assertRuntimeDenied(
    await requestRuntime(backendUrl, invokePath, runtimeToken, { input: {} }),
    'expired developer certification',
    [400, 403],
  );
  mysqlQuery(
    "UPDATE app_developer_profile SET certification_status='certified', certification_expiry=DATE_ADD(NOW(), INTERVAL 365 DAY) WHERE id=" +
      profileId +
      ';',
  );

  clearInvocationState(developer.tenantId, ownedAppId);
  assertRuntimeSuccess(
    await requestRuntime(backendUrl, invokePath, runtimeToken, { input: { quota: 1 } }),
    'quota invocation one',
  );
  assertRuntimeSuccess(
    await requestRuntime(backendUrl, invokePath, runtimeToken, { input: { quota: 2 } }),
    'quota invocation two',
  );
  addStep('verify quota rejection');
  assertRuntimeDenied(
    await requestRuntime(backendUrl, invokePath, runtimeToken, { input: { quota: 3 } }),
    'per-minute developer service quota',
    [429],
  );

  clearInvocationState(developer.tenantId, ownedAppId);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    assertRuntimeDenied(
      await requestRuntime(backendUrl, invokePath, runtimeToken, {
        input: { __e2e_fail: true, attempt },
      }),
      'forced service failure ' + attempt,
      [500, 502],
    );
  }
  addStep('verify circuit open rejection');
  assertRuntimeDenied(
    await requestRuntime(backendUrl, invokePath, runtimeToken, { input: {} }),
    'open service circuit',
    [503],
  );

  await requestJson(backendUrl, '/api/app-platform/apps', {
    method: 'POST',
    token: reviewerOne.accessToken,
    body: {
      code: adminCode,
      name: 'Administrator Service Compatibility',
      type: 'service',
      category: 'operations',
      summary: 'P10 compatibility fixture',
      visibility: 'platform',
      developer_name: 'AgentStudio E2E',
    },
  });
  const adminAppId = recordOwnedApp(adminCode);
  await uploadZip<any>(
    backendUrl,
    '/api/app-platform/apps/' + adminCode + '/versions/service-upload',
    reviewerOne.accessToken,
    await createServiceZip(adminCode, '1.0.0'),
  );
  await requestJson(backendUrl, '/api/app-platform/apps/' + adminCode + '/versions/1.0.0/approve', {
    method: 'POST',
    token: reviewerTwo.accessToken,
    body: { message: 'P10 compatibility review', approved_capabilities: [] },
  });
  await requestJson<RuntimeDetail>(
    backendUrl,
    '/api/app-platform/runtime/apps/' + adminCode + '/versions/1.0.0/candidate',
    { method: 'POST', token: reviewerTwo.accessToken, body: {} },
  );
  await requestJson<RuntimeDetail>(
    backendUrl,
    '/api/app-platform/runtime/apps/' + adminCode + '/versions/1.0.0/publish',
    { method: 'POST', token: reviewerTwo.accessToken, body: {} },
  );
  const adminProbe = await requestJson<RuntimeProbe>(
    backendUrl,
    '/api/app-platform/runtime/apps/' + adminCode + '/probe',
    { method: 'POST', token: reviewerOne.accessToken, body: { payload: { ping: true } } },
  );
  addStep('verify P10 administrator service compatibility');
  assertProbeVersion(adminProbe, '1.0.0');
  assert.ok(adminAppId > 0);

  const overview = await requestJson<any>(
    backendUrl,
    '/api/app-developer/apps/service-overview?days=7',
    { token: developer.accessToken },
  );
  const developerLogs = await requestJson<DeveloperRuntimeLogs>(
    backendUrl,
    '/api/app-developer/apps/' + targetCode + '/runtime/logs?lines=200',
    { token: developer.accessToken },
  );
  addStep('verify payload-free developer metrics and redacted logs');
  assert.ok(overview.total_invocations >= 1);
  assert.ok(overview.services.some((item: any) => item.app_code === targetCode));
  assert.doesNotMatch(
    JSON.stringify(overview),
    /payload|tenant_id|process_name|loopback_port|release_dir|package_path|environment|command_line|raw_source|cookie/i,
  );
  assert.deepEqual(
    Object.keys(developerLogs).sort(),
    ['app_code', 'role', 'stderr', 'stdout', 'version'].sort(),
  );
  const developerLogText = developerLogs.stdout + '\n' + developerLogs.stderr;
  assertNoSensitiveValue('developer redacted logs', developerLogText, Object.values(logSecrets));
  assert.match(developerLogText, /\[REDACTED\]/);
  assert.equal(developerLogText.includes(config.runtimeRoot), false);
  const invocationColumns = mysqlQuery(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='" +
      databaseName +
      "' AND table_name='app_service_invocation' ORDER BY ordinal_position;",
  );
  assert.doesNotMatch(
    invocationColumns,
    /payload|request_body|response_body|header|cookie|token|source|command|environment/i,
  );
  assert.ok(
    Number(
      mysqlQuery(
        'SELECT COUNT(*) FROM app_service_invocation WHERE target_app_id=' +
          ownedAppId +
          ' AND developer_id=' +
          developer.userId +
          ';',
      ),
    ) >= 1,
  );
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
      errors.push(
        new Error('Skipped destructive cleanup because backend termination was not confirmed'),
      );
      throw new AggregateError(errors, 'Service runtime E2E cleanup failed');
    }

    try {
      if (config) {
        for (const processName of ownedProcessNames) {
          pm2Command(['delete', processName, '--silent'], true);
        }
        addStep('verify PM2 cleanup');
        assertNoOwnedProcesses();
        pm2Command(['kill'], true);
      }
    } catch (error) {
      errors.push(error);
    }

    try {
      if (config?.pm2Home && existsSync(config.pm2Home)) {
        makeWritable(config.pm2Home);
        for (const entry of readdirSync(config.pm2Home)) {
          rmSync(resolve(config.pm2Home, entry), { recursive: true, force: true });
        }
        chmodSync(config.pm2Home, 0o700);
      }
    } catch (error) {
      errors.push(error);
    }

    try {
      if (config?.runtimeRoot && ownedAppCodes.size) {
        for (const code of ownedAppCodes) {
          const releaseRoot = resolve(config.runtimeRoot, code);
          makeWritable(releaseRoot);
          rmSync(releaseRoot, { recursive: true, force: true });
        }
        addStep('verify release cleanup');
        assertReleaseCleanup();
      }
    } catch (error) {
      errors.push(error);
    }

    if (databaseName) {
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
      } catch (error) {
        errors.push(error);
      }
    }

    try {
      if (artifactRoot) rmSync(artifactRoot, { recursive: true, force: true });
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'Service runtime E2E cleanup failed');
  })();
  return cleanupPromise;
}

function writeFailureEvidence(error: unknown) {
  const processEvidence = [...processLogs.values()]
    .map((record) => `${record.label}:\n${tail(record.output)}`)
    .join('\n\n');
  process.stderr.write(
    `${redact(describeError(error))}\nCompleted safe steps:\n${safeSteps.map((step) => `${step.at} ${step.label}`).join('\n')}\n${processEvidence}\n`,
  );
}

function handleTermination(signal: 'SIGINT' | 'SIGTERM') {
  if (terminationStarted) return;
  terminationStarted = true;
  receivedSignal = signal;
  process.exitCode = signal === 'SIGINT' ? 130 : 143;
  process.stderr.write(`Received ${signal}; cleaning up service runtime E2E resources.\n`);
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
    if (!terminationStarted && (safeSteps.length > 0 || processLogs.size > 0)) {
      writeFailureEvidence(error);
    }
  }
  try {
    await cleanupResources();
  } catch (error) {
    cleanupFailure = error;
  }
  process.off('SIGINT', handleSigint);
  process.off('SIGTERM', handleSigterm);

  if (cleanupFailure) {
    throw new Error(redact(describeError(cleanupFailure)));
  }
  if (receivedSignal) {
    process.exitCode = receivedSignal === 'SIGINT' ? 130 : 143;
  } else if (mainFailure) {
    throw new Error(redact(describeError(mainFailure)));
  } else {
    addStep('complete');
    console.log('App service runtime live E2E verified.');
  }
}

void run().catch((error) => {
  process.stderr.write(`${redact(describeError(error))}\n`);
  process.exitCode = 1;
});
