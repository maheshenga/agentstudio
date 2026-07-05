import { CreateSystemModuleSaasBridge1760000000023 } from '../migrations/1760000000023-CreateSystemModuleSaasBridge';

describe('CreateSystemModuleSaasBridge1760000000023', () => {
  it('creates and seeds the system module SaaS bridge table', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateSystemModuleSaasBridge1760000000023().up(queryRunner as any);

    const calls = queryRunner.query.mock.calls;
    const sql = calls.map(([statement]) => String(statement)).join('\n');
    const params = calls.flatMap(([, values]) => values || []);

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `system_module_saas_bridge`');
    expect(sql).toContain(
      'UNIQUE KEY `uk_system_module_saas_bridge_pair` (`saas_module_code`, `system_module_code`)',
    );
    expect(sql).toContain('KEY `idx_system_module_saas_bridge_saas` (`saas_module_code`)');
    expect(sql).toContain('KEY `idx_system_module_saas_bridge_system` (`system_module_code`)');
    expect(sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(sql).toContain('`delete_time` = NULL');
    expect(sql).not.toContain('`enabled` = VALUES(`enabled`)');
    expect(sql).not.toContain('`source` = VALUES(`source`)');
    expect(sql).not.toContain('`remark` = VALUES(`remark`)');
    expect(params).toEqual(
      expect.arrayContaining([
        'ai_chat',
        'ai_console',
        'taixu_workspace',
        'member_management',
        'tenant_saas',
        'advanced_report',
        'saas_platform',
      ]),
    );
  });

  it('drops only the bridge table on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateSystemModuleSaasBridge1760000000023().down(queryRunner as any);

    expect(queryRunner.query.mock.calls.map(([statement]) => statement)).toEqual([
      'DROP TABLE IF EXISTS `system_module_saas_bridge`',
    ]);
  });
});
