import { AlignTenantResourcePackRoleGrantsAndLabels1760000000025 } from '../migrations/1760000000025-AlignTenantResourcePackRoleGrantsAndLabels';

describe('AlignTenantResourcePackRoleGrantsAndLabels1760000000025', () => {
  it('localizes tenant resource pack and module menus and grants owner/admin resource-pack access', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AlignTenantResourcePackRoleGrantsAndLabels1760000000025().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values || []);

    expect(sql).toContain('UPDATE `sa_system_menu`');
    expect(params).toContain('TenantResourcePack');
    expect(params).toContain('TenantSystemModules');
    expect(params).toContain('资源包');
    expect(params).toContain('资源包管理');
    expect(params).toContain('资源包订单');
    expect(params).toContain('租户模块');
    expect(sql).toContain('INSERT INTO `sa_system_role_menu`');
    expect(sql).toContain("`menu`.`code` = 'TenantResourcePack'");
    expect(sql).toContain("`menu`.`slug` IN (");
    expect(sql).toContain("'tenant:resource-pack:view'");
    expect(sql).toContain("'tenant:resource-pack-order:create'");
    expect(sql).toContain("'tenant:resource-pack-order:view'");
    expect(sql).toContain("'tenant:resource-pack-order:pay'");
    expect(sql).toContain("`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin)$'");
    expect(sql).toContain('NOT EXISTS');
  });

  it('removes only owner/admin resource-pack grants and restores previous labels on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AlignTenantResourcePackRoleGrantsAndLabels1760000000025().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values || []);

    expect(sql).toContain('DELETE `role_menu`');
    expect(sql).toContain("`menu`.`code` = 'TenantResourcePack'");
    expect(sql).toContain("'tenant:resource-pack:view'");
    expect(sql).toContain("`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin)$'");
    expect(sql).toContain('UPDATE `sa_system_menu`');
    expect(params).toContain('Resource Packs');
    expect(params).toContain('Resource Pack Orders');
    expect(params).toContain('Tenant Modules');
  });
});
