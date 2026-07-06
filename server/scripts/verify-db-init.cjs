#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..');

require('dotenv').config({ path: path.join(serverRoot, `.env.${process.env.NODE_ENV || 'development'}`) });
require('dotenv').config({ path: path.join(serverRoot, '.env') });

const DEFAULT_VERIFY_DB = 'fssoa_net_verify_init';
const RESERVED_DATABASE_NAMES = new Set([
  'fssoa-net',
  'fssoa_net',
  'nestjs',
  'mysql',
  'information_schema',
  'performance_schema',
  'sys',
]);

function isSafeDatabaseName(name) {
  const value = String(name || '').trim();
  const lower = value.toLowerCase();

  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    return false;
  }
  if (RESERVED_DATABASE_NAMES.has(lower)) {
    return false;
  }
  if (lower.includes('prod') || lower.includes('production') || lower.includes('live')) {
    return false;
  }

  return /(verify|test|scratch|tmp|temp)/.test(lower);
}

function mysqlEnv() {
  const env = { ...process.env };
  if (process.env.DB_PASSWORD) {
    env.MYSQL_PWD = process.env.DB_PASSWORD;
  }
  return env;
}

function mysqlArgs(extraArgs = []) {
  return [
    '--default-character-set=utf8mb4',
    '-h',
    process.env.DB_HOST || '127.0.0.1',
    '-P',
    process.env.DB_PORT || '3306',
    '-u',
    process.env.DB_USERNAME || 'root',
    ...extraArgs,
  ];
}

function quoteIdentifier(name) {
  return `\`${name}\``;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    cwd: options.cwd || serverRoot,
    env: options.env || process.env,
    input: options.input,
    encoding: options.input ? 'utf8' : undefined,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || serverRoot,
    env: options.env || process.env,
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }

  return result.stdout || '';
}

function runMysql(extraArgs, options = {}) {
  run('mysql', mysqlArgs(extraArgs), { ...options, env: mysqlEnv() });
}

function runMysqlCapture(extraArgs) {
  return runCapture('mysql', mysqlArgs(extraArgs), { env: mysqlEnv() });
}

function runPnpm(args, env = {}) {
  if (process.platform === 'win32') {
    run('cmd.exe', ['/d', '/s', '/c', ['pnpm.cmd', ...args].join(' ')], {
      cwd: serverRoot,
      env: { ...process.env, ...env },
    });
    return;
  }

  run('pnpm', args, { cwd: serverRoot, env: { ...process.env, ...env } });
}

function verifyBootstrapIdentity(dbName) {
  const sql = [
    "SELECT 'bootstrap_users', COUNT(*), COALESCE(SUM(username = 'admin' AND is_super = 1 AND status = 1 AND delete_time IS NULL), 0) FROM sa_system_user;",
    "SELECT 'bootstrap_roles', COUNT(*), COALESCE(SUM(code = 'super_admin' AND tenant_id = 1 AND status = 1 AND delete_time IS NULL), 0) FROM sa_system_role;",
    "SELECT 'bootstrap_tenants', COUNT(*), COALESCE(SUM(id = 1 AND status = 1 AND delete_time IS NULL), 0) FROM sa_system_tenant;",
    "SELECT 'bootstrap_user_roles', COUNT(*), COALESCE(SUM(user_id = 1 AND role_id = 1 AND tenant_id = 1 AND status = 1 AND delete_time IS NULL), 0) FROM sa_system_user_role;",
    "SELECT 'bootstrap_user_tenants', COUNT(*), COALESCE(SUM(user_id = 1 AND tenant_id = 1 AND is_default = 1 AND status = 1 AND delete_time IS NULL), 0) FROM sa_system_user_tenant;",
    "SELECT 'casbin_rules', COUNT(*), COUNT(*) = 0 FROM casbin_rule;",
    "SELECT 'user_menu_grants', COUNT(*), COUNT(*) = 0 FROM sa_system_user_menu;",
  ];
  const expected = new Map([
    ['bootstrap_users', 1],
    ['bootstrap_roles', 1],
    ['bootstrap_tenants', 1],
    ['bootstrap_user_roles', 1],
    ['bootstrap_user_tenants', 1],
    ['casbin_rules', 0],
    ['user_menu_grants', 0],
  ]);
  const output = runMysqlCapture([
    dbName,
    '--batch',
    '--skip-column-names',
    '--execute',
    sql.join(' '),
  ]);

  process.stdout.write(output);
  const seen = new Set();
  for (const line of output.trim().split(/\r?\n/).filter(Boolean)) {
    const [label, countValue, validValue] = line.split('\t');
    const expectedCount = expected.get(label);
    if (expectedCount === undefined) {
      throw new Error(`Unexpected bootstrap verification row: ${line}`);
    }
    seen.add(label);
    if (Number(countValue) !== expectedCount || Number(validValue) !== 1) {
      throw new Error(`Bootstrap verification failed for ${label}: ${line}`);
    }
  }
  if (seen.size !== expected.size) {
    throw new Error(`Missing bootstrap verification rows: expected ${expected.size}, got ${seen.size}`);
  }
}

function main() {
  const dbName = process.env.DB_VERIFY_NAME || process.env.VERIFY_DB_NAME || DEFAULT_VERIFY_DB;
  if (!isSafeDatabaseName(dbName)) {
    throw new Error(
      `Refusing to verify against unsafe database name "${dbName}". Use DB_VERIFY_NAME with a test/verify/tmp/scratch database name.`,
    );
  }

  const initSqlPath = process.env.DB_INIT_SQL || path.join(repoRoot, 'database', 'init.sql');
  if (!existsSync(initSqlPath)) {
    throw new Error(`Cannot find init SQL: ${initSqlPath}`);
  }

  const quotedDb = quoteIdentifier(dbName);
  console.log(`Verifying database init against disposable database: ${dbName}`);

  runMysql(['--execute', `DROP DATABASE IF EXISTS ${quotedDb}; CREATE DATABASE ${quotedDb} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`]);
  try {
    runMysql([dbName], { input: readFileSync(initSqlPath, 'utf8') });
    runPnpm(['run', 'migration:run'], { DB_NAME: dbName });
    runMysql([
      dbName,
      '--batch',
      '--skip-column-names',
      '--execute',
      [
        "SELECT 'saas_plan', COUNT(*) FROM saas_plan;",
        "SELECT 'saas_resource_pack', COUNT(*) FROM saas_resource_pack;",
        "SELECT 'sa_ai_provider_null_keys', COUNT(*), SUM(api_key_cipher IS NULL) FROM sa_ai_provider;",
      ].join(' '),
    ]);
    verifyBootstrapIdentity(dbName);
  } catch (error) {
    console.error(`Database init verification failed. Preserving ${dbName} for inspection.`);
    throw error;
  }

  if (process.env.DB_VERIFY_KEEP === '1') {
    console.log(`Keeping verification database: ${dbName}`);
    return;
  }

  runMysql(['--execute', `DROP DATABASE IF EXISTS ${quotedDb};`]);
  console.log('Database init verification completed.');
}

if (require.main === module) {
  main();
}

module.exports = {
  isSafeDatabaseName,
};
