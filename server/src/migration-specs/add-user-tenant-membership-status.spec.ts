import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('AddUserTenantMembershipStatus1760000000049', () => {
  it('guards the membership status migration for databases that already have the column', () => {
    const migrationPath = join(__dirname, '../migrations/1760000000049-AddUserTenantMembershipStatus.ts');

    expect(existsSync(migrationPath)).toBe(true);
    const source = readFileSync(migrationPath, 'utf8');
    expect(source).toContain("hasColumn('sa_system_user_tenant', 'status')");
    expect(source).toContain('ADD COLUMN `status` tinyint NOT NULL DEFAULT 1');
    expect(source).not.toContain('DROP COLUMN `status`');
  });
});
