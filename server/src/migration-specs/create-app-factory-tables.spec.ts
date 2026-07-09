import { CreateAppFactoryTables1760000000030 } from '../migrations/1760000000030-CreateAppFactoryTables';

describe('CreateAppFactoryTables1760000000030', () => {
  it('creates app factory tables and core indexes', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new CreateAppFactoryTables1760000000030().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_factory_module`');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_factory_publish_log`');
    expect(sql).toContain('UNIQUE KEY `uk_app_factory_module_code` (`code`)');
    expect(sql).toContain('KEY `idx_app_factory_module_status` (`status`)');
    expect(sql).toContain('KEY `idx_app_factory_publish_log_factory` (`factory_id`)');
  });

  it('drops app factory tables in reverse dependency order', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new CreateAppFactoryTables1760000000030().down(queryRunner as any);

    expect(queryRunner.query.mock.calls.map(([statement]) => statement)).toEqual([
      'DROP TABLE IF EXISTS `app_factory_publish_log`',
      'DROP TABLE IF EXISTS `app_factory_module`',
    ]);
  });
});
