import { AlignTenantSystemModuleRoleGrants1760000000024 } from '../migrations/1760000000024-AlignTenantSystemModuleRoleGrants';

describe('AlignTenantSystemModuleRoleGrants1760000000024', () => {
  it('grants tenant module list menu and permission to existing tenant roles idempotently', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AlignTenantSystemModuleRoleGrants1760000000024().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');

    expect(sql).toContain('INSERT INTO `sa_system_role_menu`');
    expect(sql).toContain("`menu`.`code` = 'TenantSystemModules'");
    expect(sql).toContain("`menu`.`slug` = 'tenant:module:list'");
    expect(sql).toContain("`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin|member)$'");
    expect(sql).toContain('NOT EXISTS');
  });

  it('removes only tenant module role grants on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AlignTenantSystemModuleRoleGrants1760000000024().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');

    expect(sql).toContain('DELETE `role_menu`');
    expect(sql).toContain("`menu`.`code` = 'TenantSystemModules'");
    expect(sql).toContain("`menu`.`slug` = 'tenant:module:list'");
    expect(sql).toContain("`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin|member)$'");
  });
});
