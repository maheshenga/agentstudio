import { AlignSaasResourcePackOrderMenu1760000000007 } from '../migrations/1760000000007-AlignSaasResourcePackOrderMenu';

describe('AlignSaasResourcePackOrderMenu1760000000007', () => {
  it('inserts the platform resource pack order menu and list permission', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new AlignSaasResourcePackOrderMenu1760000000007().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement);
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(sql.some((statement) => statement.includes('INSERT INTO `sa_system_menu`'))).toBe(true);
    expect(params).toContain('Resource Pack Orders');
    expect(params).toContain('SaasResourcePackOrder');
    expect(params).toContain('resource-pack-orders');
    expect(params).toContain('/saas/platform/resource-pack-order');
    expect(params).toContain('saas:resource-pack-order:list');
  });
});
