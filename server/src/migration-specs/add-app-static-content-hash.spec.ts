import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('AddAppStaticContentHash1760000000053', () => {
  const migrationPath = resolve(
    __dirname,
    '../migrations/1760000000053-AddAppStaticContentHash.ts',
  );

  it('adds a bounded content digest without changing existing ZIP audit hashes', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const source = readFileSync(migrationPath, 'utf8');
    expect(source).toContain("ADD COLUMN `content_hash` char(64) NOT NULL DEFAULT ''");
    expect(source).not.toContain('DROP COLUMN `file_hash`');
    expect(source).not.toMatch(/password|token|secret/i);
  });

  it('removes only the additive digest column on rollback', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const source = readFileSync(migrationPath, 'utf8');
    expect(source).toContain('DROP COLUMN `content_hash`');
  });
});
