import { CreateCertifiedDeveloperServiceRuntime1760000000042 } from '../migrations/1760000000042-CreateCertifiedDeveloperServiceRuntime';

describe('CreateCertifiedDeveloperServiceRuntime1760000000042', () => {
  it('creates certification, immutable submission, invocation, and circuit state', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateCertifiedDeveloperServiceRuntime1760000000042().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_developer_profile`');
    expect(sql).toContain('UNIQUE KEY `uk_app_developer_profile_user` (`user_id`)');
    expect(sql).toContain('KEY `idx_app_developer_profile_status` (`certification_status`, `disabled`)');
    expect(sql).toContain('`requested_runtime_types` json NOT NULL');
    expect(sql).toContain('ADD COLUMN `review_snapshot`');
    expect(sql).toContain('ADD COLUMN `review_snapshot_hash`');
    expect(sql).toContain('ADD COLUMN `service_targets`');
    expect(sql).toContain('ADD COLUMN `candidate_reviewed_by`');
    expect(sql).toContain('ADD COLUMN `consecutive_failures`');
    expect(sql).toContain('ADD COLUMN `circuit_state`');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_service_invocation`');
    expect(sql).toContain(
      'KEY `idx_app_service_invocation_tenant_app_time` (`tenant_id`, `target_app_id`, `create_time`)',
    );
    expect(sql).toContain(
      'KEY `idx_app_service_invocation_developer_time` (`developer_id`, `create_time`)',
    );
    expect(sql).not.toMatch(/request_body|response_body|headers|cookie|runtime_token|password|secret/i);
  });

  it('removes only P11 state in reverse dependency order', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateCertifiedDeveloperServiceRuntime1760000000042().down(queryRunner as any);

    const statements = queryRunner.query.mock.calls.map(([statement]) => String(statement));
    const sql = statements.join('\n');
    expect(statements[0]).toBe('DROP TABLE IF EXISTS `app_service_invocation`');
    expect(sql).toContain('DROP COLUMN `last_success_time`');
    expect(sql).toContain('DROP COLUMN `candidate_reviewed_time`');
    expect(statements.at(-1)).toBe('DROP TABLE IF EXISTS `app_developer_profile`');
    expect(sql.indexOf('DROP TABLE IF EXISTS `app_service_invocation`')).toBeLessThan(
      sql.indexOf('DROP COLUMN `last_success_time`'),
    );
    expect(sql.indexOf('DROP COLUMN `candidate_reviewed_time`')).toBeLessThan(
      sql.indexOf('DROP TABLE IF EXISTS `app_developer_profile`'),
    );
    expect(sql).not.toContain('DROP TABLE IF EXISTS `app_service_instance`');
    expect(sql).not.toContain('DROP TABLE IF EXISTS `app_package_version`');
  });
});
