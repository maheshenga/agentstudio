import { SeedAppCommercializationMenus1760000000045 } from '../migrations/1760000000045-SeedAppCommercializationMenus';

describe('SeedAppCommercializationMenus1760000000045', () => {
  it('seeds platform, tenant order, and owned developer commerce access', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedAppCommercializationMenus1760000000045().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);
    expect(params).toEqual(
      expect.arrayContaining([
        'AppPlatformCommercial',
        '/app-platform/commercial',
        'app:commerce:view',
        'app:commerce:manage',
        'app:settlement:manage',
        'AppTenantOrders',
        '/app-center/orders',
        'app:tenant:purchase',
        'app:tenant:orders',
        'AppDeveloperRevenue',
        '/app-center/developer-revenue',
        'app:developer:revenue',
      ]),
    );
    expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
    expect(sql).toContain("`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin)$'");
    expect(sql).toContain("`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin|member)$'");
    expect(sql).toContain("`developer_menu`.`code` = 'AppDeveloperApps'");
    expect(sql).not.toContain('INSERT INTO `sa_system_role`');
  });

  it('removes only P12 grants, permissions, and menus', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedAppCommercializationMenus1760000000045().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);
    expect(sql).toContain('sa_system_role_menu');
    expect(params).toEqual(
      expect.arrayContaining([
        'AppPlatformCommercial',
        'AppTenantOrders',
        'AppDeveloperRevenue',
        'app:commerce:view',
        'app:tenant:orders',
        'app:developer:revenue',
      ]),
    );
    expect(sql).not.toContain('DELETE FROM `sa_system_role`');
    expect(sql).not.toContain("DELETE FROM `sa_system_menu` WHERE `code` = 'AppCenter'");
    expect(sql).not.toContain("DELETE FROM `sa_system_menu` WHERE `code` = 'AppDeveloperApps'");
  });
});
