import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaasPaymentNotifyLogs1760000000027 implements MigrationInterface {
  name = 'CreateSaasPaymentNotifyLogs1760000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`saas_payment_notify_log\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`provider\` varchar(20) NOT NULL,
        \`order_type\` varchar(30) NULL,
        \`order_no\` varchar(64) NULL,
        \`trade_no\` varchar(64) NULL,
        \`trade_status\` varchar(50) NULL,
        \`notify_id\` varchar(128) NULL,
        \`result\` varchar(30) NOT NULL,
        \`reason\` varchar(120) NULL,
        \`raw_payload\` json NULL,
        \`processed_at\` datetime NULL,
        \`create_time\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`update_time\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`idx_saas_payment_notify_order\` (\`provider\`, \`order_no\`),
        KEY \`idx_saas_payment_notify_trade\` (\`provider\`, \`trade_no\`),
        KEY \`idx_saas_payment_notify_result\` (\`provider\`, \`result\`),
        KEY \`idx_saas_payment_notify_notify_id\` (\`provider\`, \`notify_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SaaS payment provider callback audit logs'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `saas_payment_notify_log`');
  }
}
