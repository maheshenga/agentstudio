import { SeedAppFactoryMenus1760000000031 } from '../migrations/1760000000031-SeedAppFactoryMenus';

describe('SeedAppFactoryMenus1760000000031', () => {
  it('seeds app factory menu and permissions', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedAppFactoryMenus1760000000031().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(params).toContain('AppFactory');
    expect(params).toContain('/app-platform/factory');
    expect(params).toContain('app:factory:list');
    expect(params).toContain('app:factory:create');
    expect(params).toContain('app:factory:update');
    expect(params).toContain('app:factory:publish');
    expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
  });
});
