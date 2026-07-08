import { AlignSaasResourcePackCrudPermissions1760000000026 } from '../migrations/1760000000026-AlignSaasResourcePackCrudPermissions';

describe('AlignSaasResourcePackCrudPermissions1760000000026', () => {
  it('seeds platform resource pack CRUD permissions and grants existing platform resource-pack roles', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AlignSaasResourcePackCrudPermissions1760000000026().up(queryRunner as any);

    const calls = queryRunner.query.mock.calls;
    const sql = calls.map(([statement]) => String(statement)).join('\n');
    const params = calls.flatMap(([, values]) => values || []);

    expect(params).toContain('saas:resource-pack:save');
    expect(params).toContain('saas:resource-pack:update');
    expect(params).toContain('saas:resource-pack:status');
    expect(sql).toContain('INSERT INTO `sa_system_menu`');
    expect(sql).toContain('INSERT INTO `sa_system_role_menu`');
    expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
    expect(sql).toContain("`source_menu`.`code` = 'SaasResourcePack'");
    expect(sql).toContain("`source_menu`.`slug` = 'saas:resource-pack:index'");
    expect(sql).toContain("`permission`.`slug` IN (");
    expect(sql).toContain('NOT EXISTS');
  });

  it('rolls back resource-pack CRUD role grants and seeded permission rows', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AlignSaasResourcePackCrudPermissions1760000000026().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');

    expect(sql).toContain('DELETE `role_menu`');
    expect(sql).toContain('DELETE FROM `sa_system_menu`');
    expect(sql).toContain('saas:resource-pack:save');
    expect(sql).toContain('saas:resource-pack:update');
    expect(sql).toContain('saas:resource-pack:status');
  });
});
