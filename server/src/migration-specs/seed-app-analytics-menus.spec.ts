import { SeedAppAnalyticsMenus1760000000037 } from '../migrations/1760000000037-SeedAppAnalyticsMenus';

describe('SeedAppAnalyticsMenus1760000000037', () => {
  it('seeds platform and tenant analytics access without granting tenant members', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedAppAnalyticsMenus1760000000037().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(params).toEqual(
      expect.arrayContaining([
        'AppPlatform',
        'AppPlatformAnalytics',
        '/app-platform/analytics',
        'app:analytics:platform',
        'AppCenter',
        'AppTenantUsage',
        '/app-center/usage',
        'app:analytics:tenant',
      ]),
    );
    expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
    expect(sql).toContain("`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin)$'");
    expect(sql).not.toContain("REGEXP '^tenant:[0-9]+:member$'");
    expect((sql.match(/NOT EXISTS/g) || []).length).toBeGreaterThanOrEqual(6);
  });
});
