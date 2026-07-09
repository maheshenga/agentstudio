import { CreateAppMarketplaceTables1760000000028 } from '../migrations/1760000000028-CreateAppMarketplaceTables';

describe('CreateAppMarketplaceTables1760000000028', () => {
  it('creates app marketplace tables and core indexes', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new CreateAppMarketplaceTables1760000000028().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_package`');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_package_version`');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_review_log`');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `tenant_app_install`');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_open_log`');
    expect(sql).toContain('UNIQUE KEY `uk_app_package_code` (`code`)');
    expect(sql).toContain('KEY `idx_app_package_status` (`status`)');
    expect(sql).toContain('KEY `idx_app_package_type` (`type`)');
    expect(sql).toContain('UNIQUE KEY `uk_app_package_version` (`app_id`, `version`)');
    expect(sql).toContain('KEY `idx_app_package_version_review` (`review_status`)');
    expect(sql).toContain('KEY `idx_app_package_version_publish` (`publish_status`)');
    expect(sql).toContain('KEY `idx_app_review_log_app` (`app_id`, `version_id`)');
    expect(sql).toContain('UNIQUE KEY `uk_tenant_app_install_pair` (`tenant_id`, `app_id`)');
    expect(sql).toContain('KEY `idx_tenant_app_install_tenant` (`tenant_id`, `enabled`)');
    expect(sql).toContain('KEY `idx_app_open_log_tenant` (`tenant_id`, `create_time`)');
    expect(sql).toContain('KEY `idx_app_open_log_app` (`app_id`, `version_id`)');
  });

  it('drops app marketplace tables in reverse dependency order', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new CreateAppMarketplaceTables1760000000028().down(queryRunner as any);

    expect(queryRunner.query.mock.calls.map(([statement]) => statement)).toEqual([
      'DROP TABLE IF EXISTS `app_open_log`',
      'DROP TABLE IF EXISTS `tenant_app_install`',
      'DROP TABLE IF EXISTS `app_review_log`',
      'DROP TABLE IF EXISTS `app_package_version`',
      'DROP TABLE IF EXISTS `app_package`',
    ]);
  });
});
