import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppFactoryTables1760000000030 implements MigrationInterface {
  name = 'CreateAppFactoryTables1760000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_factory_module\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`code\` varchar(80) NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`kind\` varchar(30) NOT NULL DEFAULT 'static_page',
        \`category\` varchar(50) NOT NULL DEFAULT '',
        \`icon\` varchar(100) NOT NULL DEFAULT '',
        \`summary\` varchar(255) NOT NULL DEFAULT '',
        \`description\` text NULL,
        \`html_content\` mediumtext NULL,
        \`css_content\` mediumtext NULL,
        \`app_code\` varchar(80) NOT NULL DEFAULT '',
        \`status\` varchar(30) NOT NULL DEFAULT 'draft',
        \`visibility\` varchar(20) NOT NULL DEFAULT 'marketplace',
        \`saas_module_code\` varchar(50) NOT NULL DEFAULT '',
        \`system_module_code\` varchar(80) NOT NULL DEFAULT '',
        \`latest_version\` varchar(40) NOT NULL DEFAULT '',
        \`last_publish_time\` datetime NULL,
        \`created_by\` bigint NULL,
        \`sort\` int NOT NULL DEFAULT 100,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_app_factory_module_code\` (\`code\`),
        KEY \`idx_app_factory_module_status\` (\`status\`),
        KEY \`idx_app_factory_module_kind\` (\`kind\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_factory_publish_log\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`factory_id\` bigint NOT NULL,
        \`app_id\` bigint NULL,
        \`version_id\` bigint NULL,
        \`version\` varchar(40) NOT NULL,
        \`action\` varchar(30) NOT NULL,
        \`message\` varchar(500) NOT NULL DEFAULT '',
        \`operator_id\` bigint NULL,
        \`metadata\` json NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_app_factory_publish_log_factory\` (\`factory_id\`),
        KEY \`idx_app_factory_publish_log_app\` (\`app_id\`, \`version_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `app_factory_publish_log`');
    await queryRunner.query('DROP TABLE IF EXISTS `app_factory_module`');
  }
}
