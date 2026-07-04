import { AlignSaasResourcePackCatalog1760000000008 } from '../migrations/1760000000008-AlignSaasResourcePackCatalog';

describe('AlignSaasResourcePackCatalog1760000000008', () => {
  it('inserts resource pack catalog rows, menus, and permissions for existing databases', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new AlignSaasResourcePackCatalog1760000000008().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement);
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(sql.some((statement) => statement.includes('INSERT INTO `saas_resource_pack`'))).toBe(true);
    expect(sql.some((statement) => statement.includes('INSERT INTO `sa_system_menu`'))).toBe(true);
    expect(params).toContain('ai_calls_1k');
    expect(params).toContain('tokens_1m');
    expect(params).toContain('SaasResourcePack');
    expect(params).toContain('TenantResourcePack');
    expect(params).toContain('saas:resource-pack:index');
    expect(params).toContain('tenant:resource-pack-order:create');
    expect(params).toContain('tenant:resource-pack-order:view');
    expect(params).toContain('tenant:resource-pack-order:pay');
  });
});
