import { AlignSaasPlanOperationsMenu1760000000011 } from '../migrations/1760000000011-AlignSaasPlanOperationsMenu';

describe('AlignSaasPlanOperationsMenu1760000000011', () => {
  it('inserts platform plan operation permissions', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AlignSaasPlanOperationsMenu1760000000011().up(queryRunner as any);

    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);
    expect(params).toContain('saas:plan:create');
    expect(params).toContain('saas:plan:update');
    expect(params).toContain('saas:plan:status');
    expect(params).toContain('saas:plan:quota:update');
    expect(params).toContain('SaasPlan');
    expect(params).toContain('/saas/platform/plan');
  });
});