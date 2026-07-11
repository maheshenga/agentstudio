import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppRuntimeSessionsAndCapabilities1760000000038 implements MigrationInterface {
  name = 'CreateAppRuntimeSessionsAndCapabilities1760000000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`app_package_version\`
        ADD COLUMN \`approved_capabilities\` json NULL AFTER \`manifest\`
    `);

    await queryRunner.query(`
      CREATE TABLE \`app_capability_grant\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`app_id\` bigint NOT NULL,
        \`version_id\` bigint NOT NULL,
        \`subject_type\` varchar(20) NOT NULL,
        \`subject_id\` bigint NOT NULL DEFAULT 0,
        \`capability\` varchar(80) NOT NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'approved',
        \`policy\` json NULL,
        \`operator_id\` bigint NULL,
        \`granted_time\` datetime NULL,
        \`revoked_time\` datetime NULL,
        \`create_time\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`update_time\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_app_capability_subject\` (\`version_id\`, \`capability\`, \`subject_type\`, \`subject_id\`),
        KEY \`idx_app_capability_app\` (\`app_id\`, \`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`app_runtime_session\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`token_hash\` char(64) NOT NULL,
        \`tenant_id\` bigint NOT NULL,
        \`user_id\` bigint NOT NULL,
        \`app_id\` bigint NOT NULL,
        \`version_id\` bigint NOT NULL,
        \`install_id\` bigint NOT NULL,
        \`capabilities\` json NOT NULL,
        \`nonce\` varchar(64) NOT NULL DEFAULT '',
        \`client_metadata\` json NULL,
        \`expires_time\` datetime NOT NULL,
        \`revoked_time\` datetime NULL,
        \`revoke_reason\` varchar(50) NOT NULL DEFAULT '',
        \`last_used_time\` datetime NULL,
        \`create_time\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`update_time\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_app_runtime_session_token\` (\`token_hash\`),
        KEY \`idx_app_runtime_session_expiry\` (\`expires_time\`, \`revoked_time\`),
        KEY \`idx_app_runtime_session_install\` (\`tenant_id\`, \`install_id\`, \`revoked_time\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE \`app_runtime_audit_log\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`session_id\` bigint NULL,
        \`tenant_id\` bigint NOT NULL,
        \`user_id\` bigint NOT NULL,
        \`app_id\` bigint NOT NULL,
        \`version_id\` bigint NOT NULL,
        \`capability\` varchar(80) NOT NULL,
        \`action\` varchar(80) NOT NULL,
        \`outcome\` varchar(20) NOT NULL,
        \`reason_code\` varchar(50) NOT NULL DEFAULT '',
        \`request_id\` varchar(100) NOT NULL DEFAULT '',
        \`ip\` varchar(80) NOT NULL DEFAULT '',
        \`user_agent\` varchar(500) NOT NULL DEFAULT '',
        \`create_time\` datetime(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`idx_app_runtime_audit_tenant\` (\`tenant_id\`, \`create_time\`),
        KEY \`idx_app_runtime_audit_app\` (\`app_id\`, \`capability\`, \`create_time\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `app_runtime_audit_log`');
    await queryRunner.query('DROP TABLE `app_runtime_session`');
    await queryRunner.query('DROP TABLE `app_capability_grant`');
    await queryRunner.query('ALTER TABLE `app_package_version` DROP COLUMN `approved_capabilities`');
  }
}
