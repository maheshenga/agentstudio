import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaasResourcePacks1760000000005 implements MigrationInterface {
  name = 'CreateSaasResourcePacks1760000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`saas_resource_pack\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`code\` varchar(50) NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`resource_type\` varchar(50) NOT NULL,
        \`quota_amount\` bigint NOT NULL DEFAULT 0,
        \`price_cents\` bigint NOT NULL DEFAULT 0,
        \`currency\` varchar(10) NOT NULL DEFAULT 'CNY',
        \`status\` tinyint NOT NULL DEFAULT 1,
        \`sort\` int NOT NULL DEFAULT 100,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`update_time\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_saas_resource_pack_code\` (\`code\`),
        KEY \`idx_saas_resource_pack_resource_status\` (\`resource_type\`, \`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `saas_resource_pack`');
  }
}
