import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('verify database init script', () => {
  it('is exposed as a package script', () => {
    const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

    expect(packageJson.scripts['db:verify-init']).toBe('node scripts/verify-db-init.cjs');
  });

  it('only allows disposable database names', () => {
    const { isSafeDatabaseName } = require('../../scripts/verify-db-init.cjs');

    expect(isSafeDatabaseName('fssoa_net_verify_init')).toBe(true);
    expect(isSafeDatabaseName('agentstudio_test')).toBe(true);
    expect(isSafeDatabaseName('scratch_db')).toBe(true);

    expect(isSafeDatabaseName('fssoa-net')).toBe(false);
    expect(isSafeDatabaseName('nestjs')).toBe(false);
    expect(isSafeDatabaseName('production_db')).toBe(false);
    expect(isSafeDatabaseName('db;drop')).toBe(false);
    expect(isSafeDatabaseName('')).toBe(false);
  });
});
