import { CreateSystemModules1760000000020 } from '../migrations/1760000000020-CreateSystemModules';

describe('CreateSystemModules1760000000020', () => {
  const tableNames = [
    'system_module',
    'system_module_dependency',
    'system_module_menu',
    'system_module_permission',
    'system_module_api',
    'system_tenant_module',
    'system_module_event',
  ];

  it('creates system module registry tables and unique module code index', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new CreateSystemModules1760000000020().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');

    for (const tableName of tableNames) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS \`${tableName}\``);
    }
    expect(sql).toContain('UNIQUE KEY `uk_system_module_code` (`code`)');
    expect(sql).toContain('`method` varchar(10) NOT NULL');
    expect(sql).toContain("`source` varchar(20) NOT NULL DEFAULT 'platform'");
  });

  it('drops system module registry tables in reverse dependency order', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new CreateSystemModules1760000000020().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement);

    expect(sql[0]).toContain('DROP TABLE IF EXISTS `system_module_event`');
    expect(sql[sql.length - 1]).toContain('DROP TABLE IF EXISTS `system_module`');
  });
});
