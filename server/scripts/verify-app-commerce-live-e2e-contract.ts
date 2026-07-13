import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const serverRoot = process.cwd();
const repoRoot = resolve(serverRoot, '..');
const livePath = resolve(serverRoot, 'scripts/verify-app-commerce-live-e2e.ts');
const operationsPath = resolve(repoRoot, 'docs/deployment/app-commerce-baota.md');
const checklistPath = resolve(repoRoot, 'docs/saas-launch-readiness-checklist.md');

assert.equal(existsSync(livePath), true, 'application commerce live E2E script must exist');
assert.equal(existsSync(operationsPath), true, 'application commerce Baota guide must exist');

const source = readFileSync(livePath, 'utf8');
const operations = readFileSync(operationsPath, 'utf8');
const checklist = readFileSync(checklistPath, 'utf8');
const combined = `${source}\n${operations}\n${checklist}`;

for (const name of [
  'APP_COMMERCE_E2E_DB_HOST',
  'APP_COMMERCE_E2E_DB_PORT',
  'APP_COMMERCE_E2E_DB_USERNAME',
  'APP_COMMERCE_E2E_DB_PASSWORD',
  'APP_COMMERCE_E2E_PLATFORM_USERNAME',
  'APP_COMMERCE_E2E_PLATFORM_PASSWORD',
  'APP_COMMERCE_E2E_REDIS_HOST',
  'APP_COMMERCE_E2E_REDIS_PORT',
  'APP_COMMERCE_E2E_REDIS_PASSWORD',
  'APP_COMMERCE_E2E_REDIS_DB',
  'APP_COMMERCE_E2E_REDIS_ISOLATED',
]) {
  assert.match(combined, new RegExp(name), `${name} must be documented and enforced`);
}

for (const token of [
  'verify feature flag initially disabled',
  'verify legacy-free compatibility',
  'verify free application access',
  'verify included entitlement',
  'verify paid purchase required',
  'verify single-use trial',
  'verify backend-owned order snapshot',
  'verify cross-tenant purchase isolation',
  'verify duplicate payment confirmation idempotency',
  'verify paid license activation',
  'verify runtime entitlement enforcement',
  'verify license expiry denial',
  'verify full refund and immutable ledger',
  'verify license revocation denial',
  'verify uninstall preserves license',
  'verify included entitlement loss',
  'verify developer revenue ownership isolation',
  'verify manual settlement lifecycle',
  'verify no automated payout or invoice behavior',
  'verify zero owned rows',
  'verify Redis cleanup',
  'verify disposable database cleanup',
]) {
  assert.match(source, new RegExp(token), `live E2E must ${token}`);
}

for (const token of [
  "process.on('SIGINT'",
  "process.on('SIGTERM'",
  'APP_COMMERCE_ENABLED',
  'NODE_ENV',
  '/api/saas/payment/dev-confirm',
  'scripts/verify-db-init.cjs',
  "redis.call('DBSIZE')",
  "redis.call('SET'",
  "redis.call('GET'",
  "redis.call('FLUSHDB')",
  "'EVAL'",
  'assertDatabaseRemoved',
  'assertNoOwnedRows',
  'ownedDeveloperIds',
  'registerSensitiveEnvironmentValues',
  'waitForForcedExit',
  'shell: false',
]) {
  assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.match(source, /process\.platform\s*!==\s*'linux'/);
assert.match(source, /redisDb\s*===\s*'0'/);
assert.match(source, /DBSIZE[^\n]*0|database must be empty/i);
assert.match(source, /production-like database name|disposable database name/i);
assert.match(source, /APP_COMMERCE_ENABLED[^\n]*false/);
assert.match(source, /NODE_ENV[^\n]*test/);
assert.match(source, /registerSensitiveEnvironmentValues\(result\)/);
assert.match(source, /Object\.values\(input\)/);
assert.doesNotMatch(source, /shell:\s*true/);
assert.doesNotMatch(source, /\bsudo\b/);
assert.doesNotMatch(source, /open\.alipay\.com|alipay\.com\/gateway/i);
assert.doesNotMatch(
  source,
  /console\.(?:log|error)\([^\n]*(?:Password|password|accessToken|refreshToken|authorization|cookie|payload|orderNo|providerReference|databaseName|DB_NAME)/,
);
assert.doesNotMatch(
  combined,
  /APP_COMMERCE_E2E_(?:DB_PASSWORD|PLATFORM_PASSWORD|REDIS_PASSWORD)\s*[:=]\s*['"][^'"]+['"]/,
);
assert.doesNotMatch(operations, /(?:password|token|secret|cookie)\s*[:=]\s*\S+/i);
assert.doesNotMatch(operations, /APP_[A-Z0-9_]+\s*=/);
assert.doesNotMatch(operations, /\/www\/(?:wwwroot|server)\//);

for (const token of [
  'disabled by default',
  'backup',
  'migration',
  'MySQL',
  'Redis',
  'Baota',
  'Alipay callback',
  'free application',
  'paid application',
  'developer share',
  'full refund',
  'manual settlement',
  '15-minute observation',
  'rollback',
  'cleanup',
  '.env',
  'payment keys',
]) {
  assert.match(operations, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
}

assert.match(checklist, /P12 Application Commerce Verification/);
assert.match(checklist, /pnpm\.cmd run verify:app-commerce-live-e2e-contract/);
assert.match(checklist, /pnpm\.cmd run verify:app-commerce-live-e2e/);

console.log('Application commerce live E2E contract verified.');
