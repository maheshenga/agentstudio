import { AlignSaasModuleRoutes1760000000018 } from '../migrations/1760000000018-AlignSaasModuleRoutes';

describe('AlignSaasModuleRoutes1760000000018', () => {
  it('aligns seeded module route paths with frontend routes', async () => {
    const queryRunner = { query: jest.fn() };

    await new AlignSaasModuleRoutes1760000000018().up(queryRunner as any);

    const calls = queryRunner.query.mock.calls;
    const sql = calls.map(([statement]) => statement).join('\n');
    const params = calls.flatMap(([, values]) => values || []);
    expect(sql).toContain('UPDATE `saas_module`');
    expect(sql).toContain('`code` = ?');
    expect(params).toEqual(['/tenant-saas/resource-packs', 'resource_pack']);
  });
});
