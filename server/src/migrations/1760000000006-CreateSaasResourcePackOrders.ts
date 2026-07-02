import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaasResourcePackOrders1760000000006 implements MigrationInterface {
  name = 'CreateSaasResourcePackOrders1760000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`saas_resource_pack_order\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`order_no\` varchar(32) NOT NULL,
        \`tenant_id\` bigint NOT NULL,
        \`resource_pack_id\` bigint NOT NULL,
        \`resource_pack_code\` varchar(50) NOT NULL,
        \`resource_pack_name\` varchar(100) NOT NULL,
        \`resource_type\` varchar(50) NOT NULL,
        \`quota_amount\` bigint NOT NULL DEFAULT 0,
        \`amount_cents\` bigint NOT NULL DEFAULT 0,
        \`currency\` varchar(10) NOT NULL DEFAULT 'CNY',
        \`payment_method\` varchar(20) NOT NULL DEFAULT 'alipay',
        \`status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`alipay_trade_no\` varchar(64) NULL,
        \`paid_at\` datetime NULL,
        \`delivered_at\` datetime NULL,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`update_time\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_saas_resource_pack_order_order_no\` (\`order_no\`),
        KEY \`idx_saas_resource_pack_order_tenant_status\` (\`tenant_id\`, \`status\`),
        KEY \`idx_saas_resource_pack_order_pack_status\` (\`resource_pack_code\`, \`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `saas_resource_pack_order`');
  }
}
