import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppServiceRuntime1760000000040 implements MigrationInterface {
  name = 'CreateAppServiceRuntime1760000000040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      [
        'ALTER TABLE `app_package`',
        "  ADD COLUMN `runtime_type` varchar(20) NOT NULL DEFAULT 'static' AFTER `entry_url`,",
        "  ADD COLUMN `trust_level` varchar(30) NOT NULL DEFAULT 'static_sandboxed' AFTER `runtime_type`,",
        "  ADD COLUMN `service_health_path` varchar(255) NOT NULL DEFAULT '' AFTER `trust_level`,",
        '  ADD COLUMN `runtime_config` json NULL AFTER `service_health_path`',
      ].join('\n'),
    );
    await queryRunner.query(
      [
        'UPDATE `app_package`',
        'SET',
        '  `runtime_type` = CASE',
        "    WHEN `type` = 'internal' THEN 'native'",
        "    WHEN `type` = 'iframe' THEN 'iframe'",
        "    WHEN `type` = 'service' THEN 'service'",
        "    ELSE 'static'",
        '  END,',
        '  `trust_level` = CASE',
        "    WHEN `type` = 'internal' THEN 'platform_trusted'",
        "    WHEN `type` = 'service' THEN 'platform_trusted'",
        "    WHEN `type` = 'iframe' THEN 'external_managed'",
        "    ELSE 'static_sandboxed'",
        '  END,',
        "  `service_health_path` = CASE WHEN `type` = 'service' THEN '/health' ELSE '' END",
      ].join('\n'),
    );
    await queryRunner.query(
      [
        'ALTER TABLE `app_package_version`',
        '  ADD COLUMN `manifest_version` int unsigned NOT NULL DEFAULT 1 AFTER `approved_capabilities`,',
        "  ADD COLUMN `package_format` varchar(30) NOT NULL DEFAULT 'static_zip' AFTER `manifest_version`,",
        '  ADD COLUMN `scan_result` json NULL AFTER `package_format`,',
        "  ADD COLUMN `candidate_health_status` varchar(20) NOT NULL DEFAULT 'unknown' AFTER `scan_result`,",
        '  ADD COLUMN `submitted_by` bigint NULL AFTER `candidate_health_status`,',
        '  ADD COLUMN `released_by` bigint NULL AFTER `submitted_by`,',
        '  ADD COLUMN `released_time` datetime NULL AFTER `released_by`,',
        '  ADD COLUMN `rollback_from_version_id` bigint NULL AFTER `released_time`',
      ].join('\n'),
    );
    await queryRunner.query(
      [
        'UPDATE `app_package_version` AS `version`',
        'INNER JOIN `app_package` AS `app` ON `app`.`id` = `version`.`app_id`',
        'SET `version`.`package_format` = CASE',
        "  WHEN `app`.`type` = 'internal' THEN 'native'",
        "  WHEN `app`.`type` = 'iframe' THEN 'iframe_config'",
        "  WHEN `app`.`type` = 'service' THEN 'service_zip'",
        "  ELSE 'static_zip'",
        'END',
      ].join('\n'),
    );
    await queryRunner.query(
      [
        'CREATE TABLE IF NOT EXISTS `app_service_instance` (',
        '  `id` bigint NOT NULL AUTO_INCREMENT,',
        '  `app_id` bigint NOT NULL,',
        '  `version_id` bigint NOT NULL,',
        '  `release_dir` varchar(500) NOT NULL,',
        '  `process_name` varchar(100) NOT NULL,',
        '  `loopback_port` int unsigned NOT NULL,',
        "  `role` varchar(20) NOT NULL DEFAULT 'candidate',",
        "  `process_status` varchar(20) NOT NULL DEFAULT 'stopped',",
        "  `health_status` varchar(20) NOT NULL DEFAULT 'unknown',",
        '  `restart_count` int unsigned NOT NULL DEFAULT 0,',
        '  `last_health_time` datetime NULL,',
        "  `last_error_code` varchar(80) NOT NULL DEFAULT '',",
        "  `last_error_message` varchar(500) NOT NULL DEFAULT '',",
        '  `started_time` datetime NULL,',
        '  `stopped_time` datetime NULL,',
        '  `create_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),',
        '  `update_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),',
        '  PRIMARY KEY (`id`),',
        '  UNIQUE KEY `uk_app_service_instance_process` (`process_name`),',
        '  KEY `idx_app_service_instance_app_role` (`app_id`, `role`),',
        '  KEY `idx_app_service_instance_health` (`health_status`, `process_status`),',
        '  KEY `idx_app_service_instance_version` (`version_id`)',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
      ].join('\n'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `app_service_instance`');
    await queryRunner.query(
      [
        'ALTER TABLE `app_package_version`',
        '  DROP COLUMN `rollback_from_version_id`,',
        '  DROP COLUMN `released_time`,',
        '  DROP COLUMN `released_by`,',
        '  DROP COLUMN `submitted_by`,',
        '  DROP COLUMN `candidate_health_status`,',
        '  DROP COLUMN `scan_result`,',
        '  DROP COLUMN `package_format`,',
        '  DROP COLUMN `manifest_version`',
      ].join('\n'),
    );
    await queryRunner.query(
      [
        'ALTER TABLE `app_package`',
        '  DROP COLUMN `runtime_config`,',
        '  DROP COLUMN `service_health_path`,',
        '  DROP COLUMN `trust_level`,',
        '  DROP COLUMN `runtime_type`',
      ].join('\n'),
    );
  }
}
