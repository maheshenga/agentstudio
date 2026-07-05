import { SeedSystemModules1760000000021 } from '../migrations/1760000000021-SeedSystemModules';

describe('SeedSystemModules1760000000021', () => {
  it('seeds system module menus, permissions, and admin grants idempotently', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedSystemModules1760000000021().up(queryRunner as any);

    const calls = queryRunner.query.mock.calls;
    const sql = calls.map(([statement]) => String(statement)).join('\n');
    const params = calls.flatMap(([, values]) => values || []);

    expect(sql).toContain('SystemModules');
    expect(params).toContain('SystemModuleDetail');
    expect(params).toContain('modules/detail');
    expect(params).toContain('/system/modules/detail');
    expect(sql).toContain("`parent`.`code` = ?");
    expect(sql).toContain('`is_hidden`');
    expect(sql).toContain("`parent`.`path` = '/system'");
    expect(sql).toContain('`parent`.`type` = 1');
    expect(sql).toContain('system:module:list');
    expect(sql).toContain('system:module:read');
    expect(sql).toContain('TenantSystemModules');
    expect(sql).toContain('tenant:module:list');
    expect(sql).toContain('sa_system_role_menu');
    expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
    expect(sql).toContain("`source_menu`.`code` = 'SystemModules'");
    expect(sql).toContain("`detail_menu`.`code` = 'SystemModuleDetail'");
    expect(sql).toContain("`detail_menu`.`remark` = 'Seeded system module detail menu'");
    expect(sql).toContain("`read_permission`.`slug` = 'system:module:read'");
    expect(sql).toContain("`read_permission`.`remark` = 'Seeded system module permission'");
    expect(sql).toContain('`menu`.`remark` IN (');
    expect(sql).toContain('`source_role_menu`.`role_id`');
    expect(sql).toContain('NOT EXISTS');
    expect(params).toContain('System');
    expect(params).not.toContain('detail');
    expect(params).not.toContain('SystemManage');
  });

  it('rolls back role links and only rows created by this seed', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedSystemModules1760000000021().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');

    expect(sql).toContain('DELETE `role_menu`');
    expect(sql).toContain('Seeded system module menu');
    expect(sql).toContain('Seeded system module detail menu');
    expect(sql).toContain('Seeded system module permission');
    expect(sql).toContain('Seeded tenant system module menu');
    expect(sql).toContain('Seeded tenant system module permission');
  });
});
