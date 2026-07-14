import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const serverRoot = process.cwd();
const repoRoot = resolve(serverRoot, '..');
const livePath = resolve(serverRoot, 'scripts/verify-app-service-runtime-live-e2e.ts');
const driverPath = resolve(
  serverRoot,
  'src/module/app/services/app-service-podman-runtime.driver.ts',
);
const operationsPath = resolve(repoRoot, 'docs/deployment/app-service-runtime-baota.md');
const checklistPath = resolve(repoRoot, 'docs/saas-launch-readiness-checklist.md');

for (const [target, message] of [
  [livePath, 'service runtime live E2E script must exist'],
  [driverPath, 'Podman runtime driver must exist'],
  [operationsPath, 'service runtime Baota operations guide must exist'],
  [checklistPath, 'SaaS launch readiness checklist must exist'],
] as const) {
  assert.equal(existsSync(target), true, message);
}

const source = readFileSync(livePath, 'utf8');
const driver = readFileSync(driverPath, 'utf8');
const operations = readFileSync(operationsPath, 'utf8');
const checklist = readFileSync(checklistPath, 'utf8');
const combined = `${source}\n${driver}\n${operations}\n${checklist}`;

for (const name of [
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
]) {
  assert.match(combined, new RegExp(name), `${name} must be documented and enforced`);
}

for (const token of [
  'verify service package upload and scan',
  'verify independent service approval',
  'verify version one candidate health',
  'verify Podman isolation',
  'verify Unix socket invocation',
  'verify version one publish and probe',
  'verify unhealthy version two preserves active',
  'verify healthy version two publish and role swap',
  'verify rollback restores version one',
  'verify active container crash reconciliation',
  'verify runtime log and diagnostic redaction',
  'verify feature-disabled fail closed',
  'verify zero owned rows',
  'verify Redis cleanup',
  'verify Podman cleanup',
  'verify socket cleanup',
  'verify release cleanup',
  'verify disposable database cleanup',
]) {
  assert.match(source, new RegExp(token), `live E2E must ${token}`);
}

for (const token of [
  "process.on('SIGINT'",
  "process.on('SIGTERM'",
  'APP_SERVICE_RUNTIME_ENABLED',
  'APP_SERVICE_RUNTIME_DRIVER',
  'APP_SERVICE_PODMAN_COMMAND',
  'APP_SERVICE_PODMAN_IMAGE',
  'APP_SERVICE_PODMAN_HOME',
  'APP_SERVICE_PODMAN_XDG_RUNTIME_DIR',
  'APP_SERVICE_SOCKET_DIR',
  "redis.call('DBSIZE')",
  "redis.call('SET'",
  "redis.call('GET'",
  "redis.call('FLUSHDB')",
  'assertDatabaseRemoved',
  'assertRuntimeRootOutsideRepository',
  'assertRootlessPodman',
  'assertDigestPinnedImage',
  'assertNoOwnedContainers',
  'assertSocketCleanup',
  'assertNoOwnedRows',
  'assertReleaseCleanup',
  'waitForForcedExit',
  'shell: false',
]) {
  assert.match(source, new RegExp(escapeRegex(token)));
}

for (const token of [
  '--read-only',
  '--network=none',
  '--cap-drop=ALL',
  '--security-opt=no-new-privileges',
  '--pids-limit=',
  '--memory=',
  '--cpus=',
  '--user=',
  'APP_SERVICE_SOCKET=/run/agentstudio/service.sock',
  'io.agentstudio.managed=true',
]) {
  assert.match(driver, new RegExp(escapeRegex(token)), `Podman driver must enforce ${token}`);
}

assert.match(source, /redisDb\s*===\s*'0'/);
assert.match(source, /DBSIZE[^\n]*0|database must be empty/i);
assert.match(source, /production-like database name|disposable database name/i);
assert.match(source, /runtime user[^\n]*root|root runtime user/i);
assert.match(source, /rootless/i);
assert.match(source, /@sha256:/);
assert.doesNotMatch(source, /shell:\s*true/);
assert.doesNotMatch(source, /\bsudo\b/);
assert.doesNotMatch(
  source,
  /console\.(?:log|error)\([^\n]*(?:Password|password|accessToken|refreshToken|authorization)/,
);
assert.doesNotMatch(
  combined,
  /APP_SERVICE_E2E_(?:DB_PASSWORD|PLATFORM_PASSWORD)\s*[:=]\s*['"][^'"]+['"]/,
);
assert.doesNotMatch(operations, /(?:password|token|secret)\s*[:=]\s*\S+/i);

for (const token of [
  'rootless Podman',
  'dedicated non-login user',
  '/etc/subuid',
  '/etc/subgid',
  'loginctl enable-linger',
  'digest',
  'Unix socket',
  'read-only',
  'network=none',
  'MySQL',
  'Redis',
  'Baota',
  'backup',
  'canary',
  '15-minute',
  'rollback',
  'emergency stop',
  'image upgrade',
  '.env',
  'SSH keys',
  'payment keys',
]) {
  assert.match(operations, new RegExp(escapeRegex(token), 'i'));
}

assert.match(checklist, /P0 Rootless Podman Service Runtime Verification/);
assert.match(checklist, /pnpm\.cmd run verify:app-service-runtime-live-e2e-contract/);
assert.match(checklist, /pnpm\.cmd run verify:app-service-runtime-live-e2e/);

console.log('App service runtime live E2E contract verified.');

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
