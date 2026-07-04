import { AlignSaasPlatformPermissions1760000000004 } from '../migrations/1760000000004-AlignSaasPlatformPermissions';

describe('AlignSaasPlatformPermissions1760000000004', () => {
  it('renames the existing subscription permission and inserts the order list permission', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new AlignSaasPlatformPermissions1760000000004().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement);
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(sql.some((statement) => statement.includes("WHERE `slug` = 'saas:subscription:index'"))).toBe(true);
    expect(sql.some((statement) => statement.includes('INSERT INTO `sa_system_menu`'))).toBe(true);
    expect(params).toContain('saas:subscription:list');
    expect(params).toContain('saas:order:list');
  });
});
