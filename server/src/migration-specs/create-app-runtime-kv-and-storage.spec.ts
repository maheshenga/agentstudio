import { CreateAppRuntimeKvAndStorage1760000000039 } from '../migrations/1760000000039-CreateAppRuntimeKvAndStorage';

describe('CreateAppRuntimeKvAndStorage1760000000039', () => {
  it('creates tenant-and-app isolated KV and opaque object tables', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateAppRuntimeKvAndStorage1760000000039().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_runtime_kv`');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_storage_object`');
    expect(sql).toContain(
      'UNIQUE KEY `uk_app_runtime_kv_scope` (`tenant_id`, `app_id`, `namespace`, `key`)',
    );
    expect(sql).toContain(
      'KEY `idx_app_runtime_kv_expiry` (`tenant_id`, `app_id`, `expires_time`)',
    );
    expect(sql).toContain('UNIQUE KEY `uk_app_storage_object_id` (`object_id`)');
    expect(sql).toContain('KEY `idx_app_storage_object_scope` (`tenant_id`, `app_id`, `status`)');
    expect(sql).not.toMatch(/runtime_token|platform_token|password|secret/i);
  });

  it('drops storage before KV in reverse creation order', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateAppRuntimeKvAndStorage1760000000039().down(queryRunner as any);

    expect(queryRunner.query.mock.calls.map(([statement]) => statement)).toEqual([
      'DROP TABLE IF EXISTS `app_storage_object`',
      'DROP TABLE IF EXISTS `app_runtime_kv`',
    ]);
  });
});
