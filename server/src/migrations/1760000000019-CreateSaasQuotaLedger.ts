import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaasQuotaLedger1760000000019 implements MigrationInterface {
  name = 'CreateSaasQuotaLedger1760000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`saas_quota_ledger\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint NOT NULL,
        \`resource_type\` varchar(50) NOT NULL,
        \`change_type\` varchar(20) NOT NULL,
        \`quota_delta\` bigint NOT NULL DEFAULT 0,
        \`used_delta\` bigint NOT NULL DEFAULT 0,
        \`balance_total_quota\` bigint NOT NULL DEFAULT 0,
        \`balance_used_quota\` bigint NOT NULL DEFAULT 0,
        \`source_type\` varchar(50) NULL,
        \`source_id\` varchar(64) NULL,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_saas_quota_ledger_tenant_resource\` (\`tenant_id\`, \`resource_type\`),
        KEY \`idx_saas_quota_ledger_source\` (\`source_type\`, \`source_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `saas_quota_ledger`');
  }
}
