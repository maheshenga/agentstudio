import { SeedAppReviewCenterMenus1760000000034 } from '../migrations/1760000000034-SeedAppReviewCenterMenus';

describe('SeedAppReviewCenterMenus1760000000034', () => {
  it('seeds app review center menu for platform admins', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedAppReviewCenterMenus1760000000034().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(params).toContain('AppReviewCenter');
    expect(params).toContain('/app-platform/reviews');
    expect(params).toContain('/app-platform/reviews');
    expect(params).toContain('app:platform:review');
    expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
  });
});
