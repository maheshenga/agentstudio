import { SeedAppServiceRuntimeMenus1760000000041 } from '../migrations/1760000000041-SeedAppServiceRuntimeMenus';

describe('SeedAppServiceRuntimeMenus1760000000041', () => {
  it('seeds an idempotent runtime menu and exact administrator permissions', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedAppServiceRuntimeMenus1760000000041().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(params).toContain('AppServiceRuntime');
    expect(params.filter((value) => value === '/app-platform/runtime')).toHaveLength(2);
    expect(params).toEqual(
      expect.arrayContaining([
        'app:runtime:list',
        'app:runtime:manage',
        'app:runtime:probe',
        'app:runtime:logs',
      ]),
    );
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
    expect(sql).not.toContain("`role`.`code` LIKE 'tenant:%'");
  });

  it('removes role grants, permissions, and the runtime menu on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedAppServiceRuntimeMenus1760000000041().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(sql).toContain('sa_system_role_menu');
    expect(sql).toContain('sa_system_menu');
    expect(params).toEqual(
      expect.arrayContaining([
        'AppServiceRuntime',
        'app:runtime:list',
        'app:runtime:manage',
        'app:runtime:probe',
        'app:runtime:logs',
      ]),
    );
  });
});
