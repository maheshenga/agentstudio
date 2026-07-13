import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppCommercialization1760000000044 implements MigrationInterface {
  name = 'CreateAppCommercialization1760000000044';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      [
        'CREATE TABLE IF NOT EXISTS `app_price_plan` (',
        '  `id` bigint NOT NULL AUTO_INCREMENT,',
        '  `app_id` bigint NOT NULL,',
        '  `code` varchar(50) NOT NULL,',
        '  `name` varchar(100) NOT NULL,',
        '  `pricing_model` varchar(20) NOT NULL,',
        "  `billing_period` varchar(20) NOT NULL DEFAULT 'none',",
        '  `amount_cents` int unsigned NOT NULL DEFAULT 0,',
        "  `currency` varchar(10) NOT NULL DEFAULT 'CNY',",
        '  `trial_days` smallint unsigned NOT NULL DEFAULT 0,',
        '  `developer_share_bps` smallint unsigned NOT NULL,',
        '  `included_plan_codes` json NOT NULL,',
        "  `sale_scope` varchar(20) NOT NULL DEFAULT 'all',",
        '  `tenant_ids` json NOT NULL,',
        '  `status` tinyint NOT NULL DEFAULT 1,',
        '  `sort` int NOT NULL DEFAULT 100,',
        '  `create_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),',
        '  `update_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),',
        '  `delete_time` datetime(6) NULL,',
        '  PRIMARY KEY (`id`),',
        '  UNIQUE KEY `uk_app_price_plan_app_code` (`app_id`, `code`),',
        '  KEY `idx_app_price_plan_app_status` (`app_id`, `status`)',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
      ].join('\n'),
    );

    await queryRunner.query(
      [
        'CREATE TABLE IF NOT EXISTS `app_order` (',
        '  `id` bigint NOT NULL AUTO_INCREMENT,',
        '  `order_no` varchar(32) NOT NULL,',
        '  `tenant_id` bigint NOT NULL,',
        '  `app_id` bigint NOT NULL,',
        '  `price_plan_id` bigint NOT NULL,',
        '  `app_code` varchar(80) NOT NULL,',
        '  `app_name` varchar(120) NOT NULL,',
        '  `price_plan_code` varchar(50) NOT NULL,',
        '  `pricing_model` varchar(20) NOT NULL,',
        "  `billing_period` varchar(20) NOT NULL DEFAULT 'none',",
        '  `amount_cents` int unsigned NOT NULL,',
        "  `currency` varchar(10) NOT NULL DEFAULT 'CNY',",
        '  `developer_id` bigint NULL,',
        '  `developer_share_bps` smallint unsigned NOT NULL,',
        "  `payment_method` varchar(20) NOT NULL DEFAULT 'alipay',",
        "  `status` varchar(20) NOT NULL DEFAULT 'pending',",
        '  `alipay_trade_no` varchar(64) NULL,',
        '  `paid_at` datetime NULL,',
        '  `refunded_at` datetime NULL,',
        '  `refunded_by` bigint NULL,',
        "  `refund_reason` varchar(255) NOT NULL DEFAULT '',",
        "  `refund_reference` varchar(100) NOT NULL DEFAULT '',",
        '  `payment_requested_at` datetime NULL,',
        '  `closed_at` datetime NULL,',
        "  `close_reason` varchar(50) NOT NULL DEFAULT '',",
        '  `created_by` bigint NULL,',
        "  `remark` varchar(255) NOT NULL DEFAULT '',",
        '  `create_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),',
        '  `update_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),',
        '  `delete_time` datetime(6) NULL,',
        '  PRIMARY KEY (`id`),',
        '  UNIQUE KEY `uk_app_order_order_no` (`order_no`),',
        '  UNIQUE KEY `uk_app_order_trade_no` (`alipay_trade_no`),',
        '  KEY `idx_app_order_tenant_status` (`tenant_id`, `status`),',
        '  KEY `idx_app_order_app_status` (`app_id`, `status`)',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
      ].join('\n'),
    );

    await queryRunner.query(
      [
        'CREATE TABLE IF NOT EXISTS `tenant_app_license` (',
        '  `id` bigint NOT NULL AUTO_INCREMENT,',
        '  `tenant_id` bigint NOT NULL,',
        '  `app_id` bigint NOT NULL,',
        '  `price_plan_id` bigint NULL,',
        '  `order_id` bigint NULL,',
        '  `source` varchar(20) NOT NULL,',
        '  `status` varchar(20) NOT NULL,',
        '  `effective_at` datetime NOT NULL,',
        '  `expires_at` datetime NULL,',
        '  `revoked_at` datetime NULL,',
        "  `revoke_reason` varchar(255) NOT NULL DEFAULT '',",
        '  `created_by` bigint NULL,',
        "  `current_license_key` varchar(100) GENERATED ALWAYS AS (CASE WHEN `status` IN ('active', 'trialing') AND `delete_time` IS NULL THEN CONCAT(`tenant_id`, ':', `app_id`) ELSE NULL END) STORED,",
        '  `create_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),',
        '  `update_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),',
        '  `delete_time` datetime(6) NULL,',
        '  PRIMARY KEY (`id`),',
        '  UNIQUE KEY `uk_tenant_app_license_order` (`order_id`),',
        '  UNIQUE KEY `uk_tenant_app_license_current` (`current_license_key`),',
        '  KEY `idx_tenant_app_license_tenant_app_status` (`tenant_id`, `app_id`, `status`),',
        '  KEY `idx_tenant_app_license_expiry` (`expires_at`)',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
      ].join('\n'),
    );

    await queryRunner.query(
      [
        'CREATE TABLE IF NOT EXISTS `app_settlement_batch` (',
        '  `id` bigint NOT NULL AUTO_INCREMENT,',
        '  `batch_no` varchar(40) NOT NULL,',
        '  `developer_id` bigint NOT NULL,',
        '  `period_start` date NOT NULL,',
        '  `period_end` date NOT NULL,',
        '  `gross_amount_cents` int unsigned NOT NULL DEFAULT 0,',
        '  `refund_amount_cents` int unsigned NOT NULL DEFAULT 0,',
        '  `developer_amount_cents` int NOT NULL DEFAULT 0,',
        '  `ledger_count` int unsigned NOT NULL DEFAULT 0,',
        "  `status` varchar(20) NOT NULL DEFAULT 'draft',",
        '  `reviewed_by` bigint NULL,',
        '  `reviewed_at` datetime NULL,',
        '  `paid_by` bigint NULL,',
        '  `paid_at` datetime NULL,',
        "  `payment_reference` varchar(100) NOT NULL DEFAULT '',",
        "  `note` varchar(255) NOT NULL DEFAULT '',",
        '  `create_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),',
        '  `update_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),',
        '  PRIMARY KEY (`id`),',
        '  UNIQUE KEY `uk_app_settlement_batch_no` (`batch_no`),',
        '  UNIQUE KEY `uk_app_settlement_developer_period` (`developer_id`, `period_start`, `period_end`),',
        '  KEY `idx_app_settlement_status_period` (`status`, `period_start`, `period_end`)',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
      ].join('\n'),
    );

    await queryRunner.query(
      [
        'CREATE TABLE IF NOT EXISTS `app_revenue_ledger` (',
        '  `id` bigint NOT NULL AUTO_INCREMENT,',
        '  `event_key` varchar(100) NOT NULL,',
        '  `event_type` varchar(20) NOT NULL,',
        '  `order_id` bigint NULL,',
        '  `license_id` bigint NULL,',
        '  `tenant_id` bigint NOT NULL,',
        '  `app_id` bigint NOT NULL,',
        '  `developer_id` bigint NULL,',
        '  `gross_amount_cents` int NOT NULL,',
        '  `platform_amount_cents` int NOT NULL,',
        '  `developer_amount_cents` int NOT NULL,',
        "  `currency` varchar(10) NOT NULL DEFAULT 'CNY',",
        '  `settlement_batch_id` bigint NULL,',
        '  `created_by` bigint NULL,',
        "  `note` varchar(255) NOT NULL DEFAULT '',",
        '  `create_time` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),',
        '  PRIMARY KEY (`id`),',
        '  UNIQUE KEY `uk_app_revenue_ledger_event` (`event_key`),',
        '  KEY `idx_app_revenue_ledger_developer_time` (`developer_id`, `create_time`),',
        '  KEY `idx_app_revenue_ledger_settlement` (`settlement_batch_id`)',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
      ].join('\n'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `app_revenue_ledger`');
    await queryRunner.query('DROP TABLE IF EXISTS `app_settlement_batch`');
    await queryRunner.query('DROP TABLE IF EXISTS `tenant_app_license`');
    await queryRunner.query('DROP TABLE IF EXISTS `app_order`');
    await queryRunner.query('DROP TABLE IF EXISTS `app_price_plan`');
  }
}
