import { SeedSaasFoundationData1760000000001 } from '../migrations/1760000000001-SeedSaasFoundationData';

describe('SeedSaasFoundationData1760000000001', () => {
  it('seeds the SaaS platform permissions required by platform operations APIs', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new SeedSaasFoundationData1760000000001().up(queryRunner as any);

    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(params).toContain('/saas-platform');
    expect(params).toContain('saas:order:list');
    expect(params).toContain('saas:subscription:list');
    expect(params).toContain('ai_calls_1k');
    expect(params).toContain('tokens_1m');
    expect(params).toContain('saas:resource-pack:index');
    expect(params).toContain('tenant:resource-pack:view');
    expect(params).toContain('/saas/platform/resource-pack');
    expect(params).toContain('/saas/tenant/resource-pack');
  });
});
