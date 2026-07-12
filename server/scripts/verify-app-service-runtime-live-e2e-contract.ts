import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const serverRoot = process.cwd();
const repoRoot = resolve(serverRoot, '..');
const livePath = resolve(serverRoot, 'scripts/verify-app-service-runtime-live-e2e.ts');
const operationsPath = resolve(repoRoot, 'docs/deployment/app-service-runtime-baota.md');
const checklistPath = resolve(repoRoot, 'docs/saas-launch-readiness-checklist.md');

assert.equal(existsSync(livePath), true, 'service runtime live E2E script must exist');
assert.equal(existsSync(operationsPath), true, 'service runtime Baota operations guide must exist');

const source = readFileSync(livePath, 'utf8');
const operations = readFileSync(operationsPath, 'utf8');
const checklist = readFileSync(checklistPath, 'utf8');
const combined = `${source}\n${operations}\n${checklist}`;

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
  'APP_SERVICE_E2E_PM2_HOME',
  'APP_SERVICE_E2E_RUNTIME_USER',
]) {
  assert.match(combined, new RegExp(name), `${name} must be documented and enforced`);
}

for (const token of [
  'verify service package upload and scan',
  'verify independent service approval',
  'verify version one candidate health',
  'verify version one publish and probe',
  'verify unhealthy version two preserves active',
  'verify healthy version two publish and role swap',
  'verify rollback restores version one',
  'verify active process crash reconciliation',
  'verify runtime log and diagnostic redaction',
  'verify feature-disabled fail closed',
  'verify zero owned rows',
  'verify Redis cleanup',
  'verify PM2 cleanup',
  'verify release cleanup',
  'verify disposable database cleanup',
]) {
  assert.match(source, new RegExp(token), `live E2E must ${token}`);
}

for (const token of [
  "process.on('SIGINT'",
  "process.on('SIGTERM'",
  'APP_SERVICE_RUNTIME_ENABLED',
  'APP_SERVICE_RUNTIME_USER',
  'APP_SERVICE_RUNTIME_DIR',
  'APP_SERVICE_PM2_HOME',
  "redis.call('DBSIZE')",
  "redis.call('SET'",
  "redis.call('GET'",
  "redis.call('FLUSHDB')",
  'assertDatabaseRemoved',
  'assertRuntimeRootOutsideRepository',
  'assertDedicatedPm2Home',
  'assertNonRootRuntimeUser',
  'assertNoOwnedProcesses',
  'assertNoOwnedRows',
  'assertReleaseCleanup',
  'waitForForcedExit',
  'shell: false',
]) {
  assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.match(source, /redisDb\s*===\s*'0'/);
assert.match(source, /DBSIZE[^\n]*0|database must be empty/i);
assert.match(source, /production-like database name|disposable database name/i);
assert.match(source, /runtime user[^\n]*root|root runtime user/i);
assert.match(source, /runtime root[^\n]*repository|repository[^\n]*runtime root/i);
assert.match(source, /PM2 home[^\n]*isolated|isolated[^\n]*PM2 home/i);
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
  'dedicated non-login plugin user',
  '/www/wwwroot/agentstudio-plugins',
  'runuser',
  '127.0.0.1',
  'metadata',
  'MySQL',
  'Redis',
  'Baota',
  'feature flag',
  'rollback',
  'emergency stop',
  '.env',
  'SSH keys',
  'payment keys',
]) {
  assert.match(operations, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
}

assert.match(checklist, /P10 Administrator Service Runtime Verification/);
assert.match(checklist, /pnpm\.cmd run verify:app-service-runtime-live-e2e-contract/);
assert.match(checklist, /pnpm\.cmd run verify:app-service-runtime-live-e2e/);

console.log('App service runtime live E2E contract verified.');
