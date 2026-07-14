import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaasQuotaReservations1760000000050 implements MigrationInterface {
  name = 'CreateSaasQuotaReservations1760000000050';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`saas_quota_reservation\` (
        \`id\` varchar(36) NOT NULL,
        \`tenant_id\` bigint NOT NULL,
        \`source_type\` varchar(50) NOT NULL,
        \`source_id\` varchar(64) NOT NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`reserved_calls\` bigint NOT NULL DEFAULT 0,
        \`reserved_tokens\` bigint NOT NULL DEFAULT 0,
        \`actual_tokens\` bigint NOT NULL DEFAULT 0,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_saas_quota_reservation_source\` (\`tenant_id\`, \`source_type\`, \`source_id\`),
        KEY \`idx_saas_quota_reservation_status_time\` (\`status\`, \`create_time\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `saas_quota_reservation`');
  }
}
