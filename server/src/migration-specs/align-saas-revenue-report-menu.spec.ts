import { AlignSaasRevenueReportMenu1760000000012 } from '../migrations/1760000000012-AlignSaasRevenueReportMenu';

describe('AlignSaasRevenueReportMenu1760000000012', () => {
  it('inserts platform revenue report menu and permission', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new AlignSaasRevenueReportMenu1760000000012().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement);
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(sql.some((statement) => statement.includes('INSERT INTO `sa_system_menu`'))).toBe(true);
    expect(params).toContain('SaasRevenueReport');
    expect(params).toContain('revenue');
    expect(params).toContain('/saas/platform/revenue');
    expect(params).toContain('saas:revenue:index');
  });
});
