import { AlignSaasTenantMemberMenu1760000000015 } from '../migrations/1760000000015-AlignSaasTenantMemberMenu';

describe('AlignSaasTenantMemberMenu1760000000015', () => {
  it('inserts tenant member menu and permissions', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new AlignSaasTenantMemberMenu1760000000015().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement);
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(sql.some((statement) => statement.includes('INSERT INTO `sa_system_menu`'))).toBe(true);
    expect(params).toContain('TenantMember');
    expect(params).toContain('members');
    expect(params).toContain('/saas/tenant/member');
    expect(params).toContain('tenant:member:index');
    expect(params).toContain('tenant:member:create');
  });
});
