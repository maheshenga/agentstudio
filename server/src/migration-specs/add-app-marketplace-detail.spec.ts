import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('AddAppMarketplaceDetail1760000000054', () => {
  const migrationPath = resolve(
    __dirname,
    '../migrations/1760000000054-AddAppMarketplaceDetail.ts',
  );

  it('adds only bounded public marketplace metadata', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;
    const source = readFileSync(migrationPath, 'utf8');
    for (const column of ['screenshots', 'documentation_url', 'support_url', 'changelog']) {
      expect(source).toContain(`ADD COLUMN \`${column}\``);
    }
    expect(source).not.toMatch(/password|token|secret/i);
  });

  it('removes only the additive marketplace columns on rollback', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;
    const source = readFileSync(migrationPath, 'utf8');
    for (const column of ['screenshots', 'documentation_url', 'support_url', 'changelog']) {
      expect(source).toContain(`DROP COLUMN \`${column}\``);
    }
  });
});
