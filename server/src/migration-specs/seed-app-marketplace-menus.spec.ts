import { SeedAppMarketplaceMenus1760000000029 } from '../migrations/1760000000029-SeedAppMarketplaceMenus';

describe('SeedAppMarketplaceMenus1760000000029', () => {
  it('seeds app platform and app center menus with permissions', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedAppMarketplaceMenus1760000000029().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(params).toContain('AppPlatform');
    expect(params).toContain('/app-platform');
    expect(params).toContain('AppPlatformApps');
    expect(params).toContain('/app-platform/apps');
    expect(params).toContain('AppCenter');
    expect(params).toContain('/app-center');
    expect(params).toContain('AppMarketplace');
    expect(params).toContain('/app-center/marketplace');
    expect(params).toContain('AppInstalledApps');
    expect(params).toContain('/app-center/installed');
    expect(params).toContain('AppOpenRunner');
    expect(params).toContain('/app-center/open');
    expect(params).toContain(1);
    expect(params).toContain('app:platform:list');
    expect(params).toContain('app:platform:create');
    expect(params).toContain('app:platform:upload');
    expect(params).toContain('app:platform:review');
    expect(params).toContain('app:platform:publish');
    expect(params).toContain('app:tenant:marketplace');
    expect(params).toContain('app:tenant:install');
    expect(params).toContain('app:tenant:open');
    expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
    expect(sql).toContain("`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin)$'");
  });
});
