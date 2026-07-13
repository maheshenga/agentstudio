import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const serverRoot = process.cwd();
const repoRoot = resolve(serverRoot, '..');
const livePath = resolve(serverRoot, 'scripts/verify-app-developer-service-live-e2e.ts');
const operationsPath = resolve(repoRoot, 'docs/deployment/app-developer-service-runtime-baota.md');
const checklistPath = resolve(repoRoot, 'docs/saas-launch-readiness-checklist.md');

assert.equal(existsSync(livePath), true, 'developer service live E2E script must exist');
assert.equal(
  existsSync(operationsPath),
  true,
  'developer service Baota operations guide must exist',
);

const source = readFileSync(livePath, 'utf8');
const operations = readFileSync(operationsPath, 'utf8');
const checklist = readFileSync(checklistPath, 'utf8');
const combined = `${source}\n${operations}\n${checklist}`;

for (const name of [
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
]) {
  assert.match(combined, new RegExp(name), `${name} must be documented and enforced`);
}

for (const token of [
  'verify feature flags initially disabled',
  'verify two separate platform reviewers',
  'verify certified developer identity is distinct',
  'verify developer service submission snapshot',
  'verify same reviewer separation',
  'verify service candidate and publication',
  'verify same-tenant service invocation',
  'verify undeclared target rejection',
  'verify foreign tenant rejection',
  'verify foreign developer log denial',
  'verify disabled certification rejection',
  'verify expired certification rejection',
  'verify quota rejection',
  'verify circuit open rejection',
  'verify P10 administrator service compatibility',
  'verify payload-free developer metrics and redacted logs',
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
  'APP_DEVELOPER_SERVICE_ENABLED',
  'APP_SERVICE_RUNTIME_ENABLED',
  'APP_RUNTIME_CAPABILITIES_ENABLED',
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
  'assertDistinctReviewers',
  'assertDistinctDeveloper',
  'assertNoOwnedProcesses',
  'assertNoOwnedRows',
  'assertReleaseCleanup',
  'registerSensitiveEnvironmentValues',
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
assert.match(source, /production roots|production runtime root/i);
assert.match(source, /PM2 home[^\n]*isolated|isolated[^\n]*PM2 home/i);
assert.match(source, /APP_DEVELOPER_SERVICE_ENABLED[^\n]*false/);
assert.match(source, /APP_SERVICE_RUNTIME_ENABLED[^\n]*false/);
assert.match(source, /APP_RUNTIME_CAPABILITIES_ENABLED[^\n]*false/);
assert.match(source, /configured PM2 command must be absolute/);
assert.match(source, /registerSensitiveEnvironmentValues\(result\)/);
assert.match(source, /Object\.values\(input\)/);
assert.doesNotMatch(source, /shell:\s*true/);
assert.doesNotMatch(source, /\bsudo\b/);
assert.doesNotMatch(source, /(?:npm|pnpm|bun|yarn)\s+(?:install|add|i)\b/);
assert.doesNotMatch(source, /(?:preinstall|postinstall|prepare|lifecycle script)/i);
assert.doesNotMatch(
  source,
  /console\.(?:log|error)\([^\n]*(?:Password|password|accessToken|refreshToken|authorization|cookie|payload|source|command)/,
);
assert.doesNotMatch(
  combined,
  /APP_DEVELOPER_SERVICE_E2E_(?:DB_PASSWORD|PLATFORM_PASSWORD)\s*[:=]\s*['"][^'"]+['"]/,
);
assert.doesNotMatch(operations, /(?:password|token|secret)\s*[:=]\s*\S+/i);

for (const token of [
  'dedicated non-login plugin user',
  'APP_SERVICE_RUNTIME_DIR',
  'APP_SERVICE_RUNTIME_USER',
  'APP_SERVICE_PM2_HOME',
  'loopback-only',
  'metadata',
  'MySQL',
  'Redis',
  'Baota',
  'feature flag',
  'two reviewers',
  'seven-day retention',
  'circuit',
  'rollback',
  'emergency stop',
  '.env',
  'SSH keys',
  'payment keys',
]) {
  assert.match(operations, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
}
assert.doesNotMatch(operations, /\/www\/(?:wwwroot|server)\//);
assert.doesNotMatch(operations, /127\.0\.0\.1/);
assert.doesNotMatch(operations, /APP_[A-Z0-9_]+\s*=/);

assert.match(checklist, /P11 Certified Developer Service Verification/);
assert.match(checklist, /pnpm\.cmd run verify:app-developer-service-live-e2e-contract/);
assert.match(checklist, /pnpm\.cmd run verify:app-developer-service-live-e2e/);

console.log('App developer service live E2E contract verified.');
