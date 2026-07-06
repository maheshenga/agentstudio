import { SeedSaasFoundationData1760000000001 } from '../migrations/1760000000001-SeedSaasFoundationData';

describe('SeedSaasFoundationData1760000000001', () => {
  it('does not write resource pack rows before the resource pack table migration runs', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new SeedSaasFoundationData1760000000001().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).not.toContain('INSERT INTO `saas_resource_pack`');
  });

  it('seeds the SaaS platform permissions required by platform operations APIs', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new SeedSaasFoundationData1760000000001().up(queryRunner as any);

    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(params).toContain('/saas-platform');
    expect(params).toContain('saas:order:list');
    expect(params).toContain('saas:subscription:list');
    expect(params).toContain('saas:resource-pack:index');
    expect(params).toContain('tenant:resource-pack:view');
    expect(params).toContain('/saas/platform/resource-pack');
    expect(params).toContain('/saas/tenant/resource-pack');
    expect(params).toContain('saas:resource-pack-order:list');
    expect(params).toContain('tenant:resource-pack-order:create');
    expect(params).toContain('tenant:resource-pack-order:view');
    expect(params).toContain('tenant:resource-pack-order:pay');
    expect(params).toContain('/saas/platform/resource-pack-order');
  });
});
