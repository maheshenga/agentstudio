import { CreateSystemModuleConfiguration1760000000047 } from '../migrations/1760000000047-CreateSystemModuleConfiguration';

describe('CreateSystemModuleConfiguration1760000000047', () => {
  it('creates platform and tenant module configuration tables with unique scopes', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateSystemModuleConfiguration1760000000047().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `system_module_config`');
    expect(sql).toContain('UNIQUE KEY `uk_system_module_config_module` (`module_code`)');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `system_tenant_module_config`');
    expect(sql).toContain(
      'UNIQUE KEY `uk_system_tenant_module_config_pair` (`tenant_id`, `module_code`)',
    );
    expect(sql).toContain('KEY `idx_system_tenant_module_config_module` (`module_code`)');
  });

  it('drops tenant configuration before platform configuration', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateSystemModuleConfiguration1760000000047().down(queryRunner as any);

    expect(queryRunner.query.mock.calls.map(([statement]) => statement)).toEqual([
      'DROP TABLE IF EXISTS `system_tenant_module_config`',
      'DROP TABLE IF EXISTS `system_module_config`',
    ]);
  });
});
