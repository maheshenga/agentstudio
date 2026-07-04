import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaasPaymentConfigs1760000000009 implements MigrationInterface {
  name = 'CreateSaasPaymentConfigs1760000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`saas_payment_config\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`provider\` varchar(20) NOT NULL,
        \`scope\` varchar(20) NOT NULL DEFAULT 'platform',
        \`enabled\` tinyint NOT NULL DEFAULT 0,
        \`app_id\` varchar(64) NULL,
        \`private_key\` text NULL,
        \`public_key\` text NULL,
        \`gateway_url\` varchar(255) NULL,
        \`notify_url\` varchar(255) NULL,
        \`return_url\` varchar(255) NULL,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`update_time\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_saas_payment_config_provider_scope\` (\`provider\`, \`scope\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `saas_payment_config`');
  }
}
