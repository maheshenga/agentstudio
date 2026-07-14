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
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { Agent, request as undiciRequest } from 'undici';

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

type RuntimeInstance = {
  id: string;
  app_code: string;
  version: string;
  process_name: string;
  loopback_port: number;
  runtime_driver: 'pm2' | 'podman';
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
  podmanHome: string;
  podmanXdgRuntimeDir: string;
  socketRoot: string;
  runtimeUser: string;
  podmanCommand: string;
  podmanImage: string;
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
const ownedContainerNames = new Set<string>();
const redisOwnerKey = 'agentstudio:app-service-e2e:owner';
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
}

export function assertEmptyOwnedDirectory(target: string, label: string) {
  assert.equal(isInside(target, repoRoot), false, `${label} must be outside the repository`);
  assert.match(target.toLowerCase(), /(e2e|test)/, `${label} must identify a disposable path`);
  assert.equal(existsSync(target), true, `${label} must exist`);
  assert.equal(statSync(target).isDirectory(), true, `${label} must be a directory`);
  assert.equal(readdirSync(target).length, 0, `${label} must be empty before the gate`);
  assert.equal(statSync(target).mode & 0o022, 0, `${label} must not be group or world writable`);
}

export function assertDedicatedPodmanHome(podmanHome: string, socketRoot: string) {
  assert.equal(isInside(podmanHome, repoRoot), false, 'Podman home must be outside repository');
  assert.match(podmanHome.toLowerCase(), /(e2e|test)/, 'Podman home must be disposable');
  assert.equal(existsSync(podmanHome), true, 'Podman home must exist');
  assert.equal(statSync(podmanHome).isDirectory(), true, 'Podman home must be a directory');
  assert.equal(statSync(podmanHome).mode & 0o022, 0, 'Podman home must be private');
  assert.deepEqual(
    readdirSync(podmanHome),
    [basename(socketRoot)],
    'Podman home must contain only the empty socket root before the gate',
  );
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

export function assertDigestPinnedImage(image: string) {
  assert.match(
    image,
    /^(?:[a-z0-9]+(?:[._-][a-z0-9]+)*(?::\d+)?\/)*(?:[a-z0-9]+(?:[._-][a-z0-9]+)*)@sha256:[a-f0-9]{64}$/,
    'Podman image must be credential-free and digest pinned',
  );
}

function resolvePodmanCommand() {
  const configured = requiredEnv('APP_SERVICE_E2E_PODMAN_COMMAND');
  let command = configured;
  if (!command) {
    const result = spawnSync('which', ['podman'], {
      encoding: 'utf8',
      shell: false,
      stdio: 'pipe',
    });
    assert.equal(
      result.status,
      0,
      'Podman must be available or APP_SERVICE_E2E_PODMAN_COMMAND must be set',
    );
    command = String(result.stdout || '').trim();
  }
  assert.equal(isAbsolute(command), true, 'resolved Podman command must be absolute');
  assert.match(command, /^\/[A-Za-z0-9_./-]+$/, 'resolved Podman command must be fixed');
  return command;
}

function assertRunuserBoundary(input: Config) {
  const env = podmanEnvironment(input);
  for (const args of [
    ['-u', input.runtimeUser, '--', '/usr/bin/test', '-r', input.runtimeRoot],
    ['-u', input.runtimeUser, '--', '/usr/bin/test', '-x', input.runtimeRoot],
    ['-u', input.runtimeUser, '--', '/usr/bin/test', '-w', input.podmanHome],
    ['-u', input.runtimeUser, '--', '/usr/bin/test', '-w', input.podmanXdgRuntimeDir],
    ['-u', input.runtimeUser, '--', '/usr/bin/test', '-w', input.socketRoot],
    ['-u', input.runtimeUser, '--', input.podmanCommand, '--version'],
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
  assertRootlessPodman(input);
}

export function assertRootlessPodman(input: Config) {
  const info = podmanCommand(['info', '--format', 'json'], false, input);
  assert.match(info.stdout, /"rootless"\s*:\s*true/i, 'Podman must run rootless');
  const image = podmanCommand(['image', 'exists', input.podmanImage], true, input);
  assert.equal(image.status, 0, 'digest-pinned runtime image must be preloaded');
}

function loadConfig(): Config {
  const required = [
    'APP_SERVICE_E2E_DB_HOST',
    'APP_SERVICE_E2E_DB_PORT',
    'APP_SERVICE_E2E_DB_USERNAME',
    'APP_SERVICE_E2E_DB_PASSWORD',
    'APP_SERVICE_E2E_PLATFORM_USERNAME',
    'APP_SERVICE_E2E_PLATFORM_PASSWORD',
    'APP_SERVICE_E2E_REDIS_DB',
    'APP_SERVICE_E2E_REDIS_ISOLATED',
    'APP_SERVICE_E2E_RUNTIME_ROOT',
    'APP_SERVICE_E2E_PODMAN_HOME',
    'APP_SERVICE_E2E_PODMAN_XDG_RUNTIME_DIR',
    'APP_SERVICE_E2E_SOCKET_ROOT',
    'APP_SERVICE_E2E_PODMAN_IMAGE',
    'APP_SERVICE_E2E_RUNTIME_USER',
  ];
  const missing = required.filter((name) => !requiredEnv(name));
  if (missing.length) {
    throw new Error(`Missing required service runtime E2E variables: ${missing.join(', ')}`);
  }
  if (process.platform !== 'linux') {
    throw new Error('Service runtime live E2E requires Linux');
  }
  if (requiredEnv('APP_SERVICE_E2E_REDIS_ISOLATED') !== '1') {
    throw new Error('APP_SERVICE_E2E_REDIS_ISOLATED must equal 1');
  }
  const redisDb = requiredEnv('APP_SERVICE_E2E_REDIS_DB');
  if (redisDb === '0' || !/^(?:[1-9]|1[0-5])$/.test(redisDb)) {
    throw new Error('Redis DB 0 is forbidden; use an isolated logical database from 1 to 15');
  }

  const runtimeRoot = resolve(requiredEnv('APP_SERVICE_E2E_RUNTIME_ROOT'));
  const podmanHome = resolve(requiredEnv('APP_SERVICE_E2E_PODMAN_HOME'));
  const podmanXdgRuntimeDir = resolve(requiredEnv('APP_SERVICE_E2E_PODMAN_XDG_RUNTIME_DIR'));
  const socketRoot = resolve(requiredEnv('APP_SERVICE_E2E_SOCKET_ROOT'));
  if (
    !isAbsolute(requiredEnv('APP_SERVICE_E2E_RUNTIME_ROOT')) ||
    !isAbsolute(requiredEnv('APP_SERVICE_E2E_PODMAN_HOME')) ||
    !isAbsolute(requiredEnv('APP_SERVICE_E2E_PODMAN_XDG_RUNTIME_DIR')) ||
    !isAbsolute(requiredEnv('APP_SERVICE_E2E_SOCKET_ROOT'))
  ) {
    throw new Error('Runtime, Podman, XDG, and socket roots must be absolute');
  }
  assertRuntimeRootOutsideRepository(runtimeRoot);
  assertEmptyOwnedDirectory(podmanXdgRuntimeDir, 'Podman XDG runtime directory');
  assertEmptyOwnedDirectory(socketRoot, 'service socket root');
  assertDedicatedPodmanHome(podmanHome, socketRoot);
  assert.equal(isInside(socketRoot, podmanHome), true, 'socket root must be inside Podman home');
  assert.notEqual(
    resolve(socketRoot),
    resolve(podmanHome),
    'socket root must not equal Podman home',
  );
  assert.equal(
    isInside(runtimeRoot, podmanHome) || isInside(podmanHome, runtimeRoot),
    false,
    'runtime root and Podman home must not overlap',
  );
  assert.equal(
    isInside(runtimeRoot, podmanXdgRuntimeDir) ||
      isInside(podmanXdgRuntimeDir, runtimeRoot) ||
      isInside(podmanHome, podmanXdgRuntimeDir) ||
      isInside(podmanXdgRuntimeDir, podmanHome),
    false,
    'release, Podman, and XDG roots must remain isolated',
  );
  const runtimeUser = requiredEnv('APP_SERVICE_E2E_RUNTIME_USER');
  assertNonRootRuntimeUser(runtimeUser);
  const podmanImage = requiredEnv('APP_SERVICE_E2E_PODMAN_IMAGE');
  assertDigestPinnedImage(podmanImage);

  const servicePortMin = Number(requiredEnv('APP_SERVICE_E2E_PORT_MIN') || 32000);
  const servicePortMax = Number(requiredEnv('APP_SERVICE_E2E_PORT_MAX') || 32199);
  assert.ok(
    Number.isInteger(servicePortMin) &&
      Number.isInteger(servicePortMax) &&
      servicePortMin >= 1024 &&
      servicePortMax <= 65535 &&
      servicePortMax - servicePortMin >= 99,
    'service E2E port range must contain at least 100 loopback ports',
  );

  const result: Config = {
    dbHost: requiredEnv('APP_SERVICE_E2E_DB_HOST'),
    dbPort: requiredEnv('APP_SERVICE_E2E_DB_PORT'),
    dbUsername: requiredEnv('APP_SERVICE_E2E_DB_USERNAME'),
    dbPassword: requiredEnv('APP_SERVICE_E2E_DB_PASSWORD'),
    platformUsername: requiredEnv('APP_SERVICE_E2E_PLATFORM_USERNAME'),
    platformPassword: requiredEnv('APP_SERVICE_E2E_PLATFORM_PASSWORD'),
    redisHost: requiredEnv('APP_SERVICE_E2E_REDIS_HOST') || '127.0.0.1',
    redisPort: requiredEnv('APP_SERVICE_E2E_REDIS_PORT') || '6379',
    redisPassword: requiredEnv('APP_SERVICE_E2E_REDIS_PASSWORD'),
    redisDb,
    runtimeRoot,
    podmanHome,
    podmanXdgRuntimeDir,
    socketRoot,
    runtimeUser,
    podmanCommand: resolvePodmanCommand(),
    podmanImage,
    servicePortMin,
    servicePortMax,
  };
  for (const value of [result.dbPassword, result.platformPassword, result.redisPassword]) {
    if (value) sensitiveValues.add(value);
  }
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
  assert.match(value, /^agentstudio_service_e2e_[a-z0-9]+$/);
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

function podmanEnvironment(input = config) {
  return {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    HOME: input.podmanHome,
    XDG_RUNTIME_DIR: input.podmanXdgRuntimeDir,
    NODE_ENV: 'production',
  };
}

function podmanCommand(args: string[], allowFailure = false, input = config) {
  const result = spawnSync(
    'runuser',
    ['-u', input.runtimeUser, '--', input.podmanCommand, ...args],
    {
      cwd: input.runtimeRoot,
      env: podmanEnvironment(input),
      encoding: 'utf8',
      stdio: 'pipe',
      shell: false,
    },
  );
  if (result.error) {
    throw new Error(`Podman command failed to start: ${redact(result.error.message)}`);
  }
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `Podman command failed with exit code ${result.status}: ${tail(String(result.stderr || ''))}`,
    );
  }
  return {
    status: result.status,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  };
}

function listOwnedContainers() {
  if (!appCode) return [];
  const result = podmanCommand([
    'ps',
    '--all',
    '--filter',
    `label=io.agentstudio.app-code=${appCode}`,
    '--format',
    'json',
  ]);
  const parsed = JSON.parse(result.stdout || '[]') as Array<{
    Name?: unknown;
    Names?: unknown;
  }>;
  assert.equal(Array.isArray(parsed), true, 'Podman container list must be an array');
  return parsed
    .map((item) => {
      if (typeof item.Name === 'string') return item.Name;
      if (typeof item.Names === 'string') return item.Names;
      if (Array.isArray(item.Names) && typeof item.Names[0] === 'string') return item.Names[0];
      return '';
    })
    .filter(Boolean);
}

function inspectOwnedContainer(processName: string) {
  assert.equal(
    ownedContainerNames.has(processName),
    true,
    'container name must belong to this run',
  );
  const result = podmanCommand(['inspect', '--format', 'json', processName]);
  const records = JSON.parse(result.stdout || '[]') as Array<Record<string, any>>;
  assert.equal(records.length, 1, 'owned container inspect must return exactly one record');
  const labels = records[0]?.Config?.Labels || {};
  assert.equal(labels['io.agentstudio.managed'], 'true', 'container must be platform managed');
  assert.equal(labels['io.agentstudio.app-code'], appCode, 'container must carry this run label');
  return records[0];
}

function removeOwnedContainer(processName: string) {
  inspectOwnedContainer(processName);
  podmanCommand(['rm', '--force', processName]);
}

export function assertNoOwnedContainers() {
  const active = listOwnedContainers().filter((name) => ownedContainerNames.has(name));
  assert.deepEqual(active, [], 'verify Podman cleanup must remove every owned service container');
}

function processNameFor(code: string, version: string) {
  return `agentstudio-app-${code.replace(/_/g, '-')}-${version.replace(/\./g, '-')}`;
}

function assertPodmanIsolation(instance: RuntimeInstance) {
  assert.equal(instance.runtime_driver, 'podman', 'live runtime must persist the Podman driver');
  const record = inspectOwnedContainer(instance.process_name);
  const hostConfig = (record.HostConfig || {}) as Record<string, any>;
  assert.equal(String(hostConfig.NetworkMode || '').toLowerCase(), 'none');
  assert.equal(hostConfig.ReadonlyRootfs, true, 'container root filesystem must be read-only');
  assert.ok(Number(hostConfig.PidsLimit) >= 16 && Number(hostConfig.PidsLimit) <= 512);
  assert.ok(Number(hostConfig.Memory) >= 128 * 1024 * 1024);
  assert.ok(Number(hostConfig.NanoCpus) > 0);
  const securityOptions = JSON.stringify(hostConfig.SecurityOpt || []).toLowerCase();
  assert.match(securityOptions, /no-new-privileges/);
  const effectiveCaps = Array.isArray(record.EffectiveCaps) ? record.EffectiveCaps : [];
  const droppedCaps = JSON.stringify(hostConfig.CapDrop || []).toUpperCase();
  assert.ok(
    effectiveCaps.length === 0 || droppedCaps.includes('ALL'),
    'container must retain no Linux capabilities',
  );
  assert.match(String(record.Config?.User || ''), /^65532(?::65532)?$/);
  assert.doesNotMatch(JSON.stringify(record.Mounts || []), /podman\.sock|docker\.sock/i);
}

export function assertSocketCleanup() {
  if (!config?.socketRoot || !appCode) return;
  const residue = readdirSync(config.socketRoot).filter((entry) =>
    entry.startsWith(`agentstudio-app-${appCode.replace(/_/g, '-')}-`),
  );
  assert.deepEqual(residue, [], 'verify socket cleanup must leave no owned socket directories');
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
    APP_SERVICE_RUNTIME_DRIVER: 'podman',
    APP_SERVICE_RUNTIME_DIR: config.runtimeRoot,
    APP_SERVICE_RUNTIME_USER: config.runtimeUser,
    APP_SERVICE_PODMAN_COMMAND: config.podmanCommand,
    APP_SERVICE_PODMAN_IMAGE: config.podmanImage,
    APP_SERVICE_PODMAN_HOME: config.podmanHome,
    APP_SERVICE_PODMAN_XDG_RUNTIME_DIR: config.podmanXdgRuntimeDir,
    APP_SERVICE_SOCKET_DIR: config.socketRoot,
    APP_SERVICE_MEMORY_MB: '256',
    APP_SERVICE_CPU_LIMIT: '1',
    APP_SERVICE_PIDS_LIMIT: '64',
    APP_SERVICE_TMPFS_MB: '16',
    APP_SERVICE_CONTAINER_UID: '65532',
    APP_SERVICE_PORT_MIN: String(config.servicePortMin),
    APP_SERVICE_PORT_MAX: String(config.servicePortMax),
    APP_SERVICE_HEALTH_SUCCESS_COUNT: '3',
  };
}

async function startBackend(enabled: boolean, jwtSecret: string) {
  const port = await findFreePort();
  const child = startProcess('service runtime backend', process.execPath, [serverEntry], {
    cwd: serverRoot,
    env: backendEnvironment({ port, jwtSecret, enabled }),
  });
  const backendUrl = `http://127.0.0.1:${port}`;
  await waitForHttp(`${backendUrl}/api/core/login-captcha`, child);
  return { child, backendUrl };
}

function createServiceSource(version: string) {
  return [
    "'use strict';",
    'let healthy = true;',
    `const serviceVersion = '${version}';`,
    "exports.health = async function health() { return healthy ? { status: 'ok', version: serviceVersion } : { status: 'down', version: serviceVersion }; };",
    "exports.invoke = async function invoke(request) { if (request && request.__e2e_health === 'unhealthy') healthy = false; if (request && request.__e2e_health === 'healthy') healthy = true; console.log(JSON.stringify({ event: 'invoke', request: request })); return { version: serviceVersion, healthy: healthy, echo: request }; };",
  ].join('\n');
}

async function createServiceZip(version: string) {
  const zip = new JSZip();
  zip.file(
    'app.manifest.json',
    JSON.stringify({
      manifestVersion: 2,
      code: appCode,
      version,
      runtime: 'service',
      entry: 'dist/index.js',
      healthPath: '/health',
      capabilities: [],
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
  writeFileSync(resolve(artifactRoot, `service-${version}.zip`), buffer);
  return buffer;
}

async function directCandidateInvoke(instance: RuntimeInstance, payload: Record<string, unknown>) {
  assert.equal(instance.runtime_driver, 'podman');
  const socketPath = resolve(config.socketRoot, instance.process_name, 'service.sock');
  assert.equal(isInside(socketPath, config.socketRoot), true);
  assert.equal(lstatSync(socketPath).isSocket(), true, 'candidate must expose a Unix socket');
  const dispatcher = new Agent({ connect: { socketPath }, connections: 1, pipelining: 0 });
  try {
    const response = await undiciRequest('http://localhost/invoke', {
      dispatcher,
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      maxRedirections: 0,
      signal: terminationController.signal,
    });
    assert.equal(
      response.statusCode,
      200,
      'candidate fixture control must use the Unix socket invoke endpoint',
    );
    return JSON.parse(await response.body.text()) as Record<string, unknown>;
  } finally {
    await dispatcher.close();
  }
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
  assert.equal(
    existsSync(resolve(config.runtimeRoot, appCode)),
    false,
    'verify release cleanup must remove owned releases',
  );
}

function deleteOwnedRows() {
  if (ownedAppId) {
    for (const sql of [
      `DELETE FROM app_review_log WHERE app_id=${ownedAppId};`,
      `DELETE FROM app_capability_grant WHERE app_id=${ownedAppId};`,
      `DELETE FROM app_service_instance WHERE app_id=${ownedAppId};`,
      `DELETE FROM app_package_version WHERE app_id=${ownedAppId};`,
      `DELETE FROM app_package WHERE id=${ownedAppId};`,
    ]) {
      mysqlQuery(sql);
    }
  }
  if (reviewerUserId) {
    mysqlQuery(`DELETE FROM sa_system_user_role WHERE user_id=${reviewerUserId};`);
    mysqlQuery(`DELETE FROM sa_system_user_tenant WHERE user_id=${reviewerUserId};`);
    mysqlQuery(`DELETE FROM sa_system_user WHERE id=${reviewerUserId};`);
  }
}

export function assertNoOwnedRows() {
  if (ownedAppId) {
    const counts = mysqlQuery(
      [
        `SELECT COUNT(*) FROM app_package WHERE id=${ownedAppId}`,
        `UNION ALL SELECT COUNT(*) FROM app_package_version WHERE app_id=${ownedAppId}`,
        `UNION ALL SELECT COUNT(*) FROM app_service_instance WHERE app_id=${ownedAppId}`,
        `UNION ALL SELECT COUNT(*) FROM app_review_log WHERE app_id=${ownedAppId}`,
        `UNION ALL SELECT COUNT(*) FROM app_capability_grant WHERE app_id=${ownedAppId}`,
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

async function main() {
  config = loadConfig();
  assertRunuserBoundary(config);
  const suffix = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
  databaseName = `agentstudio_service_e2e_${suffix}`.toLowerCase();
  assertDisposableDatabaseName(databaseName);
  artifactRoot = mkdtempSync(join(tmpdir(), 'agentstudio-service-e2e-'));
  appCode = `service_e2e_${suffix}`.slice(0, 70);
  ownedContainerNames.add(processNameFor(appCode, '1.0.0'));
  ownedContainerNames.add(processNameFor(appCode, '2.0.0'));
  const reviewerUsername = `service_reviewer_${suffix}`.slice(0, 30);
  const reviewerPassword = `Rv${randomBytes(18).toString('hex')}9`;
  const jwtSecret = randomBytes(48).toString('base64url');
  const logSecrets = {
    password: `db-${randomBytes(12).toString('hex')}`,
    token: `token-${randomBytes(12).toString('hex')}`,
    secret: `runtime-${randomBytes(12).toString('hex')}`,
    cookie: `session=${randomBytes(12).toString('hex')}`,
  };
  for (const value of [
    reviewerUsername,
    reviewerPassword,
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

  let running = await startBackend(true, jwtSecret);
  backend = running.child;
  const backendUrl = running.backendUrl;

  addStep('authenticate platform uploader');
  const uploader = await authenticate(backendUrl, config.platformUsername, config.platformPassword);
  assert.equal(
    (uploader.profile as { is_platform_admin?: unknown }).is_platform_admin === true ||
      (uploader.profile as { is_admin?: unknown }).is_admin === true ||
      (uploader.profile as { account_scope?: unknown }).account_scope === 'platform' ||
      (uploader.profile as { is_super?: unknown }).is_super === 1,
    true,
    'seeded account must be a platform administrator',
  );

  addStep('create independent platform reviewer');
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
    token: uploader.accessToken,
    body: {
      username: reviewerUsername,
      realname: 'Service E2E Reviewer',
      password: reviewerPassword,
      role_ids: [adminRoleId],
      status: 1,
      remark: 'Disposable service runtime reviewer',
    },
  });
  reviewerUserId = Number(
    mysqlQuery(`SELECT id FROM sa_system_user WHERE username='${reviewerUsername}';`),
  );
  assert.ok(Number.isSafeInteger(reviewerUserId) && reviewerUserId > 0);
  const reviewer = await authenticate(
    backendUrl,
    reviewerUsername,
    reviewerPassword,
    uploader.tenantId,
  );
  assert.notEqual(reviewer.userId, uploader.userId, 'reviewer must be independent from submitter');

  addStep('create administrator service app');
  await requestJson(backendUrl, '/api/app-platform/apps', {
    method: 'POST',
    token: uploader.accessToken,
    body: {
      code: appCode,
      name: 'Service Runtime E2E',
      type: 'service',
      category: 'operations',
      summary: 'Disposable administrator service lifecycle fixture',
      visibility: 'platform',
      developer_name: 'AgentStudio E2E',
    },
  });
  ownedAppId = Number(mysqlQuery(`SELECT id FROM app_package WHERE code='${appCode}';`));
  assert.ok(Number.isSafeInteger(ownedAppId) && ownedAppId > 0);

  addStep('verify service package upload and scan');
  const versionOne = await uploadZip<any>(
    backendUrl,
    `/api/app-platform/apps/${appCode}/versions/service-upload`,
    uploader.accessToken,
    await createServiceZip('1.0.0'),
  );
  assert.equal(versionOne.scan_result?.passed, true);
  assert.equal(versionOne.scan_result?.scannedFiles, 1);

  addStep('verify independent service approval');
  await requestJson(backendUrl, `/api/app-platform/apps/${appCode}/versions/1.0.0/approve`, {
    method: 'POST',
    token: reviewer.accessToken,
    body: { message: 'Independent P0 service review', approved_capabilities: [] },
  });
  assert.equal(
    Number(
      mysqlQuery(
        `SELECT COUNT(*) FROM app_package_version WHERE app_id=${ownedAppId} AND version='1.0.0' AND submitted_by=${uploader.userId} AND reviewer_id=${reviewer.userId} AND review_status='approved';`,
      ),
    ),
    1,
    'service approval must persist different submitter and reviewer identities',
  );

  addStep('verify version one candidate health');
  let detail = await requestJson<RuntimeDetail>(
    backendUrl,
    `/api/app-platform/runtime/apps/${appCode}/versions/1.0.0/candidate`,
    { method: 'POST', token: reviewer.accessToken, body: {} },
  );
  assert.equal(detail.candidate_version, '1.0.0');
  const candidateOne = detail.instances.find((item) => item.version === '1.0.0');
  assert.equal(candidateOne?.health_status, 'healthy');
  assert.ok(candidateOne);

  addStep('verify Podman isolation');
  assertPodmanIsolation(candidateOne);

  addStep('verify Unix socket invocation');
  const directOne = await directCandidateInvoke(candidateOne, { unix_socket: true });
  assert.equal(directOne.version, '1.0.0');

  addStep('verify version one publish and probe');
  detail = await requestJson<RuntimeDetail>(
    backendUrl,
    `/api/app-platform/runtime/apps/${appCode}/versions/1.0.0/publish`,
    { method: 'POST', token: reviewer.accessToken, body: {} },
  );
  assert.equal(detail.active_version, '1.0.0');
  let probe = await requestJson<RuntimeProbe>(
    backendUrl,
    `/api/app-platform/runtime/apps/${appCode}/probe`,
    { method: 'POST', token: reviewer.accessToken, body: { payload: { ping: true } } },
  );
  assertProbeVersion(probe, '1.0.0');

  const versionTwo = await uploadZip<any>(
    backendUrl,
    `/api/app-platform/apps/${appCode}/versions/service-upload`,
    uploader.accessToken,
    await createServiceZip('2.0.0'),
  );
  assert.equal(versionTwo.scan_result?.passed, true);
  await requestJson(backendUrl, `/api/app-platform/apps/${appCode}/versions/2.0.0/approve`, {
    method: 'POST',
    token: reviewer.accessToken,
    body: { message: 'Independent P0 version two review', approved_capabilities: [] },
  });
  detail = await requestJson<RuntimeDetail>(
    backendUrl,
    `/api/app-platform/runtime/apps/${appCode}/versions/2.0.0/candidate`,
    { method: 'POST', token: reviewer.accessToken, body: {} },
  );
  const candidateTwo = detail.instances.find(
    (item) => item.version === '2.0.0' && item.role === 'candidate',
  );
  assert.ok(candidateTwo && candidateTwo.health_status === 'healthy');

  addStep('verify unhealthy version two preserves active');
  await directCandidateInvoke(candidateTwo, { __e2e_health: 'unhealthy' });
  await requestDenied(
    backendUrl,
    `/api/app-platform/runtime/apps/${appCode}/versions/2.0.0/publish`,
    { method: 'POST', token: reviewer.accessToken, body: {} },
  );
  detail = await requestJson<RuntimeDetail>(
    backendUrl,
    `/api/app-platform/runtime/apps/${appCode}`,
    {
      token: reviewer.accessToken,
    },
  );
  assert.equal(detail.active_version, '1.0.0', 'unhealthy candidate must not replace active');
  probe = await requestJson<RuntimeProbe>(
    backendUrl,
    `/api/app-platform/runtime/apps/${appCode}/probe`,
    {
      method: 'POST',
      token: reviewer.accessToken,
      body: { payload: { after_failed_publish: true } },
    },
  );
  assertProbeVersion(probe, '1.0.0');

  addStep('verify healthy version two publish and role swap');
  await directCandidateInvoke(candidateTwo, { __e2e_health: 'healthy' });
  detail = await requestJson<RuntimeDetail>(
    backendUrl,
    `/api/app-platform/runtime/apps/${appCode}/versions/2.0.0/publish`,
    { method: 'POST', token: reviewer.accessToken, body: {} },
  );
  assert.equal(detail.active_version, '2.0.0');
  assert.equal(detail.standby_version, '1.0.0');
  assert.equal(detail.instances.filter((item) => item.role === 'active').length, 1);
  assert.equal(detail.instances.filter((item) => item.role === 'standby').length, 1);

  addStep('verify rollback restores version one');
  detail = await requestJson<RuntimeDetail>(
    backendUrl,
    `/api/app-platform/runtime/apps/${appCode}/versions/1.0.0/rollback`,
    {
      method: 'POST',
      token: reviewer.accessToken,
      body: { reason: 'Restore verified version one during P0 E2E' },
    },
  );
  assert.equal(detail.active_version, '1.0.0');
  assert.equal(detail.standby_version, '2.0.0');

  addStep('verify active container crash reconciliation');
  const activeOne = detail.instances.find((item) => item.role === 'active');
  assert.ok(activeOne);
  removeOwnedContainer(activeOne.process_name);
  const reconcile = await requestJson<{ restarted?: number; failed?: number }>(
    backendUrl,
    '/api/app-platform/runtime/reconcile',
    { method: 'POST', token: reviewer.accessToken, body: {} },
  );
  assert.ok(
    Number(reconcile.restarted || 0) >= 1,
    'reconciliation must restart the expected active process',
  );
  probe = await retry('probe after reconciliation', () =>
    requestJson<RuntimeProbe>(backendUrl, `/api/app-platform/runtime/apps/${appCode}/probe`, {
      method: 'POST',
      token: reviewer.accessToken,
      body: { payload: { after_reconcile: true } },
    }),
  );
  assertProbeVersion(probe, '1.0.0');
  assert.equal(backend.exitCode, null, 'service process crash must not stop NestJS');

  addStep('verify runtime log and diagnostic redaction');
  probe = await requestJson<RuntimeProbe>(
    backendUrl,
    `/api/app-platform/runtime/apps/${appCode}/probe`,
    {
      method: 'POST',
      token: reviewer.accessToken,
      body: {
        payload: {
          password: logSecrets.password,
          token: logSecrets.token,
          secret: logSecrets.secret,
          cookie: logSecrets.cookie,
          authorization: `Bearer ${logSecrets.token}`,
        },
      },
    },
  );
  assertProbeVersion(probe, '1.0.0');
  const logs = await requestJson<RuntimeLogs>(
    backendUrl,
    `/api/app-platform/runtime/apps/${appCode}/logs?lines=200`,
    { token: reviewer.accessToken },
  );
  const logText = `${logs.stdout}\n${logs.stderr}`;
  assertNoSensitiveValue('redacted runtime logs', logText, Object.values(logSecrets));
  assert.match(logText, /\[REDACTED\]/);
  assert.doesNotMatch(
    logText,
    new RegExp(config.runtimeRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  );
  const diagnostics = mysqlQuery(
    `SELECT CONCAT_WS(' ', last_error_code, last_error_message) FROM app_service_instance WHERE app_id=${ownedAppId};`,
  );
  assertNoSensitiveValue('persisted diagnostics', diagnostics, Object.values(logSecrets));
  assert.doesNotMatch(diagnostics, /APP_SERVICE_|DB_PASSWORD|REDIS_PASSWORD|source body/i);

  await stopProcess(backend);
  backend = undefined;
  const containersBeforeDisabled = listOwnedContainers().filter((name) =>
    ownedContainerNames.has(name),
  );
  running = await startBackend(false, jwtSecret);
  backend = running.child;

  addStep('verify feature-disabled fail closed');
  await requestDenied(running.backendUrl, '/api/app-platform/runtime/reconcile', {
    method: 'POST',
    token: reviewer.accessToken,
    body: {},
  });
  const containersAfterDisabled = listOwnedContainers().filter((name) =>
    ownedContainerNames.has(name),
  );
  assert.deepEqual(
    containersAfterDisabled,
    containersBeforeDisabled,
    'disabled runtime must not start Podman containers',
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
        for (const processName of listOwnedContainers()) {
          if (!ownedContainerNames.has(processName)) continue;
          removeOwnedContainer(processName);
        }
        addStep('verify Podman cleanup');
        assertNoOwnedContainers();
      }
    } catch (error) {
      errors.push(error);
    }

    try {
      if (config?.socketRoot && existsSync(config.socketRoot)) {
        for (const entry of readdirSync(config.socketRoot)) {
          if (!entry.startsWith(`agentstudio-app-${appCode.replace(/_/g, '-')}-`)) continue;
          rmSync(resolve(config.socketRoot, entry), { recursive: true, force: true });
        }
        addStep('verify socket cleanup');
        assertSocketCleanup();
      }
    } catch (error) {
      errors.push(error);
    }

    try {
      for (const target of [config?.podmanHome, config?.podmanXdgRuntimeDir].filter(
        (value): value is string => Boolean(value),
      )) {
        if (!existsSync(target)) continue;
        makeWritable(target);
        for (const entry of readdirSync(target)) {
          rmSync(resolve(target, entry), { recursive: true, force: true });
        }
        chmodSync(target, 0o700);
      }
    } catch (error) {
      errors.push(error);
    }

    try {
      if (config?.runtimeRoot && appCode) {
        const releaseRoot = resolve(config.runtimeRoot, appCode);
        makeWritable(releaseRoot);
        rmSync(releaseRoot, { recursive: true, force: true });
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
