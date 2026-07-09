import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppMarketplaceTables1760000000028 implements MigrationInterface {
  name = 'CreateAppMarketplaceTables1760000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_package\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`code\` varchar(80) NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`type\` varchar(20) NOT NULL,
        \`category\` varchar(50) NOT NULL DEFAULT '',
        \`icon\` varchar(100) NOT NULL DEFAULT '',
        \`summary\` varchar(255) NOT NULL DEFAULT '',
        \`description\` text NULL,
        \`developer_id\` bigint NULL,
        \`developer_name\` varchar(100) NOT NULL DEFAULT '',
        \`status\` varchar(30) NOT NULL DEFAULT 'draft',
        \`visibility\` varchar(20) NOT NULL DEFAULT 'marketplace',
        \`entry_mode\` varchar(30) NOT NULL DEFAULT 'iframe',
        \`entry_url\` varchar(500) NOT NULL DEFAULT '',
        \`system_module_code\` varchar(80) NOT NULL DEFAULT '',
        \`saas_module_code\` varchar(50) NOT NULL DEFAULT '',
        \`sort\` int NOT NULL DEFAULT 100,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_app_package_code\` (\`code\`),
        KEY \`idx_app_package_status\` (\`status\`),
        KEY \`idx_app_package_type\` (\`type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_package_version\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`app_id\` bigint NOT NULL,
        \`version\` varchar(40) NOT NULL,
        \`manifest\` json NULL,
        \`package_path\` varchar(500) NOT NULL DEFAULT '',
        \`publish_path\` varchar(500) NOT NULL DEFAULT '',
        \`entry_file\` varchar(255) NOT NULL DEFAULT '',
        \`file_hash\` varchar(64) NOT NULL DEFAULT '',
        \`file_size\` bigint NOT NULL DEFAULT 0,
        \`review_status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`publish_status\` varchar(30) NOT NULL DEFAULT 'unpublished',
        \`review_message\` varchar(500) NOT NULL DEFAULT '',
        \`reviewer_id\` bigint NULL,
        \`review_time\` datetime NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_app_package_version\` (\`app_id\`, \`version\`),
        KEY \`idx_app_package_version_review\` (\`review_status\`),
        KEY \`idx_app_package_version_publish\` (\`publish_status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_review_log\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`app_id\` bigint NOT NULL,
        \`version_id\` bigint NULL,
        \`action\` varchar(30) NOT NULL,
        \`message\` varchar(500) NOT NULL DEFAULT '',
        \`operator_id\` bigint NULL,
        \`metadata\` json NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_app_review_log_app\` (\`app_id\`, \`version_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tenant_app_install\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint NOT NULL,
        \`app_id\` bigint NOT NULL,
        \`version_id\` bigint NULL,
        \`enabled\` tinyint NOT NULL DEFAULT 1,
        \`source\` varchar(20) NOT NULL DEFAULT 'marketplace',
        \`config\` json NULL,
        \`installed_by\` bigint NULL,
        \`installed_time\` datetime NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_tenant_app_install_pair\` (\`tenant_id\`, \`app_id\`),
        KEY \`idx_tenant_app_install_tenant\` (\`tenant_id\`, \`enabled\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_open_log\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint NOT NULL,
        \`user_id\` bigint NULL,
        \`app_id\` bigint NOT NULL,
        \`version_id\` bigint NULL,
        \`open_mode\` varchar(30) NOT NULL,
        \`ip\` varchar(80) NOT NULL DEFAULT '',
        \`user_agent\` varchar(500) NOT NULL DEFAULT '',
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_app_open_log_tenant\` (\`tenant_id\`, \`create_time\`),
        KEY \`idx_app_open_log_app\` (\`app_id\`, \`version_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `app_open_log`');
    await queryRunner.query('DROP TABLE IF EXISTS `tenant_app_install`');
    await queryRunner.query('DROP TABLE IF EXISTS `app_review_log`');
    await queryRunner.query('DROP TABLE IF EXISTS `app_package_version`');
    await queryRunner.query('DROP TABLE IF EXISTS `app_package`');
  }
}
