import { SeedAppDeveloperMenus1760000000035 } from '../migrations/1760000000035-SeedAppDeveloperMenus';

describe('SeedAppDeveloperMenus1760000000035', () => {
  it('seeds developer workspace permissions without granting every tenant member', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedAppDeveloperMenus1760000000035().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(params).toContain('AppDeveloperApps');
    expect(params).toContain('/app-center/developer');
    expect(params).toEqual(
      expect.arrayContaining([
        'app:developer:list',
        'app:developer:read',
        'app:developer:create',
        'app:developer:update',
        'app:developer:upload',
        'app:developer:submit',
      ]),
    );
    expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
    expect(sql).not.toContain("REGEXP '^tenant:[0-9]+:member$'");
  });
});
