import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCertifiedDeveloperServiceRuntime1760000000042
  implements MigrationInterface
{
  name = 'CreateCertifiedDeveloperServiceRuntime1760000000042';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      [
        'CREATE TABLE IF NOT EXISTS `app_developer_profile` (',
        '  `id` bigint NOT NULL AUTO_INCREMENT,',
        '  `user_id` bigint NOT NULL,',
        "  `display_name` varchar(100) NOT NULL DEFAULT '',",
        "  `website` varchar(255) NOT NULL DEFAULT '',",
        '  `application_statement` text NOT NULL,',
        "  `certification_status` varchar(20) NOT NULL DEFAULT 'pending',",
        '  `requested_runtime_types` json NOT NULL,',
        '  `approved_runtime_types` json NOT NULL,',
        "  `risk_level` varchar(20) NOT NULL DEFAULT 'medium',",
        '  `reviewer_id` bigint NULL,',
        "  `review_message` varchar(500) NOT NULL DEFAULT '',",
        '  `certification_time` datetime NULL,',
        '  `certification_expiry` datetime NULL,',
        '  `disabled` tinyint NOT NULL DEFAULT 0,',
        '  `create_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),',
        '  `update_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),',
        '  PRIMARY KEY (`id`),',
        '  UNIQUE KEY `uk_app_developer_profile_user` (`user_id`),',
        '  KEY `idx_app_developer_profile_status` (`certification_status`, `disabled`),',
        '  KEY `idx_app_developer_profile_expiry` (`certification_expiry`)',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
      ].join('\n'),
    );

    await queryRunner.query(
      [
        'ALTER TABLE `app_package_version`',
        '  ADD COLUMN `review_snapshot` json NULL AFTER `scan_result`,',
        "  ADD COLUMN `review_snapshot_hash` char(64) NOT NULL DEFAULT '' AFTER `review_snapshot`,",
        '  ADD COLUMN `submitted_time` datetime NULL AFTER `review_snapshot_hash`,',
        '  ADD COLUMN `service_targets` json NULL AFTER `submitted_time`,',
        '  ADD COLUMN `candidate_reviewed_by` bigint NULL AFTER `submitted_by`,',
        '  ADD COLUMN `candidate_reviewed_time` datetime NULL AFTER `candidate_reviewed_by`',
      ].join('\n'),
    );
    await queryRunner.query(
      'UPDATE `app_package_version` SET `service_targets` = JSON_ARRAY() WHERE `service_targets` IS NULL',
    );

    await queryRunner.query(
      [
        'ALTER TABLE `app_service_instance`',
        '  ADD COLUMN `consecutive_failures` int unsigned NOT NULL DEFAULT 0 AFTER `restart_count`,',
        "  ADD COLUMN `circuit_state` varchar(20) NOT NULL DEFAULT 'closed' AFTER `consecutive_failures`,",
        '  ADD COLUMN `circuit_open_until` datetime NULL AFTER `circuit_state`,',
        '  ADD COLUMN `active_invocations` int unsigned NOT NULL DEFAULT 0 AFTER `circuit_open_until`,',
        '  ADD COLUMN `last_invoke_time` datetime NULL AFTER `active_invocations`,',
        '  ADD COLUMN `last_success_time` datetime NULL AFTER `last_invoke_time`',
      ].join('\n'),
    );

    await queryRunner.query(
      [
        'CREATE TABLE IF NOT EXISTS `app_service_invocation` (',
        '  `id` bigint NOT NULL AUTO_INCREMENT,',
        '  `tenant_id` bigint NOT NULL,',
        '  `caller_app_id` bigint NOT NULL,',
        '  `caller_version_id` bigint NOT NULL,',
        '  `target_app_id` bigint NOT NULL,',
        '  `target_version_id` bigint NOT NULL,',
        '  `developer_id` bigint NULL,',
        "  `outcome` varchar(20) NOT NULL,",
        '  `status_code` smallint unsigned NULL,',
        '  `duration_ms` int unsigned NOT NULL DEFAULT 0,',
        "  `error_code` varchar(80) NOT NULL DEFAULT '',",
        '  `create_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),',
        '  PRIMARY KEY (`id`),',
        '  KEY `idx_app_service_invocation_tenant_app_time` (`tenant_id`, `target_app_id`, `create_time`),',
        '  KEY `idx_app_service_invocation_developer_time` (`developer_id`, `create_time`),',
        '  KEY `idx_app_service_invocation_target_version` (`target_version_id`)',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
      ].join('\n'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `app_service_invocation`');
    await queryRunner.query(
      [
        'ALTER TABLE `app_service_instance`',
        '  DROP COLUMN `last_success_time`,',
        '  DROP COLUMN `last_invoke_time`,',
        '  DROP COLUMN `active_invocations`,',
        '  DROP COLUMN `circuit_open_until`,',
        '  DROP COLUMN `circuit_state`,',
        '  DROP COLUMN `consecutive_failures`',
      ].join('\n'),
    );
    await queryRunner.query(
      [
        'ALTER TABLE `app_package_version`',
        '  DROP COLUMN `candidate_reviewed_time`,',
        '  DROP COLUMN `candidate_reviewed_by`,',
        '  DROP COLUMN `service_targets`,',
        '  DROP COLUMN `submitted_time`,',
        '  DROP COLUMN `review_snapshot_hash`,',
        '  DROP COLUMN `review_snapshot`',
      ].join('\n'),
    );
    await queryRunner.query('DROP TABLE IF EXISTS `app_developer_profile`');
  }
}
