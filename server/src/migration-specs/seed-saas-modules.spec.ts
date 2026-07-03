import { SeedSaasModules1760000000017 } from '../migrations/1760000000017-SeedSaasModules';

describe('SeedSaasModules1760000000017', () => {
  it('seeds default modules, menu, and permissions idempotently', async () => {
    const queryRunner = { query: jest.fn() };

    await new SeedSaasModules1760000000017().up(queryRunner as any);

    const calls = queryRunner.query.mock.calls;
    const sql = calls.map(([statement]) => statement).join('\n');
    const moduleInsertSql = calls.find(([statement]) => statement.includes('INSERT INTO `saas_module`'))?.[0];
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values || []);
    expect(params).toContain('ai_chat');
    expect(params).toContain('member_management');
    expect(params).toContain('SaasModule');
    expect(params).toContain('saas:module:list');
    expect(params).toContain('saas:plan:module:update');
    expect(sql).toContain('NOT EXISTS');
    expect(moduleInsertSql).toContain('ON DUPLICATE KEY UPDATE');
    expect(moduleInsertSql).toContain('`delete_time` = NULL');
  });

  it('rolls back only rows created by this seed', async () => {
    const queryRunner = { query: jest.fn() };

    await new SeedSaasModules1760000000017().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain("`menu`.`remark` = 'Seeded SaaS module menu'");
    expect(sql).toContain("`menu`.`remark` = 'Seeded SaaS module permission'");
    expect(sql).toContain("`remark` = 'Seeded SaaS module'");
    expect(sql).toContain("`remark` = 'Seeded SaaS module menu'");
    expect(sql).toContain("`remark` = 'Seeded SaaS module permission'");
  });
});
