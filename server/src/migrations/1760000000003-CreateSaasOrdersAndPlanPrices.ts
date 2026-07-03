import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaasOrdersAndPlanPrices1760000000003 implements MigrationInterface {
  name = 'CreateSaasOrdersAndPlanPrices1760000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `saas_plan` ADD `price_monthly` int NOT NULL DEFAULT 0');
    await queryRunner.query('ALTER TABLE `saas_plan` ADD `price_yearly` int NOT NULL DEFAULT 0');
    await queryRunner.query("UPDATE `saas_plan` SET `price_monthly` = 0, `price_yearly` = 0 WHERE `code` = 'free'");
    await queryRunner.query("UPDATE `saas_plan` SET `price_monthly` = 9900, `price_yearly` = 99000 WHERE `code` = 'pro'");
    await queryRunner.query("UPDATE `saas_plan` SET `price_monthly` = 49900, `price_yearly` = 499000 WHERE `code` = 'enterprise'");
    await queryRunner.query(`
      CREATE TABLE \`saas_order\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`order_no\` varchar(32) NOT NULL,
        \`tenant_id\` bigint NOT NULL,
        \`plan_id\` bigint NOT NULL,
        \`plan_code\` varchar(50) NOT NULL,
        \`billing_cycle\` varchar(20) NOT NULL DEFAULT 'monthly',
        \`amount_cents\` int NOT NULL DEFAULT 0,
        \`currency\` varchar(10) NOT NULL DEFAULT 'CNY',
        \`payment_method\` varchar(20) NOT NULL DEFAULT 'alipay',
        \`status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`alipay_trade_no\` varchar(64) NULL,
        \`paid_at\` datetime NULL,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_saas_order_order_no\` (\`order_no\`),
        KEY \`idx_saas_order_tenant_status\` (\`tenant_id\`, \`status\`),
        KEY \`idx_saas_order_plan_id\` (\`plan_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `saas_order`');
    await queryRunner.query('ALTER TABLE `saas_plan` DROP COLUMN `price_yearly`');
    await queryRunner.query('ALTER TABLE `saas_plan` DROP COLUMN `price_monthly`');
  }
}
