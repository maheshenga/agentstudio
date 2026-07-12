import { CreateAppServiceRuntime1760000000040 } from '../migrations/1760000000040-CreateAppServiceRuntime';

describe('CreateAppServiceRuntime1760000000040', () => {
  it('adds normalized package/version metadata and service instance state', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateAppServiceRuntime1760000000040().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('ADD COLUMN `runtime_type`');
    expect(sql).toContain('ADD COLUMN `trust_level`');
    expect(sql).toContain('ADD COLUMN `manifest_version`');
    expect(sql).toContain('ADD COLUMN `scan_result`');
    expect(sql).toContain("WHEN `type` = 'internal' THEN 'native'");
    expect(sql).toContain("WHEN `type` = 'iframe' THEN 'external_managed'");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_service_instance`');
    expect(sql).toContain('UNIQUE KEY `uk_app_service_instance_process` (`process_name`)');
    expect(sql).toContain('KEY `idx_app_service_instance_app_role` (`app_id`, `role`)');
    expect(sql).not.toMatch(/password|jwt|redis|database_url|payment|secret/i);
  });

  it('drops service state before removing additive columns', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateAppServiceRuntime1760000000040().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql.indexOf('DROP TABLE IF EXISTS `app_service_instance`')).toBeLessThan(
      sql.indexOf('DROP COLUMN `runtime_type`'),
    );
    expect(sql).toContain('DROP COLUMN `rollback_from_version_id`');
    expect(sql).toContain('DROP COLUMN `runtime_config`');
  });
});
