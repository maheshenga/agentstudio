import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppRuntimeKvAndStorage1760000000039 implements MigrationInterface {
  name = 'CreateAppRuntimeKvAndStorage1760000000039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_runtime_kv\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint NOT NULL,
        \`app_id\` bigint NOT NULL,
        \`namespace\` varchar(64) NOT NULL,
        \`key\` varchar(191) NOT NULL,
        \`value\` json NOT NULL,
        \`size_byte\` int unsigned NOT NULL,
        \`version\` int unsigned NOT NULL DEFAULT 1,
        \`expires_time\` datetime NULL,
        \`create_time\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`update_time\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_app_runtime_kv_scope\` (\`tenant_id\`, \`app_id\`, \`namespace\`, \`key\`),
        KEY \`idx_app_runtime_kv_expiry\` (\`tenant_id\`, \`app_id\`, \`expires_time\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_storage_object\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`object_id\` varchar(43) NOT NULL,
        \`tenant_id\` bigint NOT NULL,
        \`app_id\` bigint NOT NULL,
        \`owner_user_id\` bigint NOT NULL,
        \`storage_key\` varchar(255) NOT NULL,
        \`original_name\` varchar(255) NOT NULL,
        \`mime_type\` varchar(120) NOT NULL,
        \`size_byte\` bigint unsigned NOT NULL,
        \`checksum\` char(64) NOT NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'active',
        \`expires_time\` datetime NULL,
        \`create_time\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`update_time\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_app_storage_object_id\` (\`object_id\`),
        KEY \`idx_app_storage_object_scope\` (\`tenant_id\`, \`app_id\`, \`status\`),
        KEY \`idx_app_storage_object_expiry\` (\`tenant_id\`, \`app_id\`, \`expires_time\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `app_storage_object`');
    await queryRunner.query('DROP TABLE IF EXISTS `app_runtime_kv`');
  }
}
