import { SeedCertifiedDeveloperServiceMenus1760000000043 } from '../migrations/1760000000043-SeedCertifiedDeveloperServiceMenus';

describe('SeedCertifiedDeveloperServiceMenus1760000000043', () => {
  it('seeds platform certification and tenant developer workspace grants', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedCertifiedDeveloperServiceMenus1760000000043().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(params).toEqual(
      expect.arrayContaining([
        'AppDeveloperCertification',
        '/app-platform/developers',
        'app:developer-certification:list',
        'app:developer-certification:manage',
        'AppDeveloperServiceObservability',
        '/app-center/developer-runtime',
        'app:developer:observability',
        'AppDeveloperApps',
        'app:developer:list',
        'app:developer:read',
        'app:developer:create',
        'app:developer:update',
        'app:developer:upload',
        'app:developer:submit',
      ]),
    );
    expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
    expect(sql).toContain("`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin|member)$'");
    expect(sql).not.toContain('INSERT INTO `sa_system_role`');
  });

  it('removes P11 grants and menus without deleting tenant roles or existing developer menus', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedCertifiedDeveloperServiceMenus1760000000043().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);
    expect(sql).toContain('sa_system_role_menu');
    expect(sql).toContain("`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin|member)$'");
    expect(params).toEqual(
      expect.arrayContaining([
        'AppDeveloperApps',
        'app:developer:list',
        'AppDeveloperCertification',
        'AppDeveloperServiceObservability',
        'app:developer-certification:list',
        'app:developer:observability',
      ]),
    );
    expect(sql).not.toContain('DELETE FROM `sa_system_role`');
    expect(sql).not.toContain("DELETE FROM `sa_system_menu` WHERE `code` = 'AppDeveloperApps'");
  });
});
