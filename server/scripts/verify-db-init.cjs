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

function runMysql(extraArgs, options = {}) {
  run('mysql', mysqlArgs(extraArgs), { ...options, env: mysqlEnv() });
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
