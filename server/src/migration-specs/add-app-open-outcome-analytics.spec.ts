import { AddAppOpenOutcomeAnalytics1760000000036 } from '../migrations/1760000000036-AddAppOpenOutcomeAnalytics';

describe('AddAppOpenOutcomeAnalytics1760000000036', () => {
  it('adds sanitized outcome fields, backfills legacy rows, and adds analytics indexes', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new AddAppOpenOutcomeAnalytics1760000000036().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');

    expect(sql).toContain('ADD COLUMN `app_code` varchar(100) NULL');
    expect(sql).toContain("ADD COLUMN `outcome` varchar(20) NOT NULL DEFAULT 'success'");
    expect(sql).toContain("ADD COLUMN `reason_code` varchar(50) NOT NULL DEFAULT 'none'");
    expect(sql).toContain("ADD COLUMN `failure_message` varchar(255) NOT NULL DEFAULT ''");
    expect(sql).toContain('LEFT JOIN `app_package` `app`');
    expect(sql).toContain('SET `log`.`app_code` = COALESCE');
    expect(sql).toContain('MODIFY COLUMN `app_code` varchar(100) NOT NULL');
    expect(sql).toContain('MODIFY COLUMN `app_id` bigint NULL');
    expect(sql).toContain('ADD KEY `idx_app_open_log_outcome` (`outcome`, `create_time`)');
    expect(sql).toContain('ADD KEY `idx_app_open_log_reason` (`reason_code`, `create_time`)');
  });

  it('removes analytics fields and restores the required app relation', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new AddAppOpenOutcomeAnalytics1760000000036().down(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');

    expect(sql).toContain('DROP INDEX `idx_app_open_log_reason`');
    expect(sql).toContain('DROP INDEX `idx_app_open_log_outcome`');
    expect(sql).toContain('DROP COLUMN `failure_message`');
    expect(sql).toContain('DROP COLUMN `reason_code`');
    expect(sql).toContain('DROP COLUMN `outcome`');
    expect(sql).toContain('DROP COLUMN `app_code`');
    expect(sql).toContain('DELETE FROM `app_open_log` WHERE `app_id` IS NULL');
    expect(sql).toContain('MODIFY COLUMN `app_id` bigint NOT NULL');
  });
});
