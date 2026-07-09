import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppFactoryTemplateTables1760000000032 implements MigrationInterface {
  name = 'CreateAppFactoryTemplateTables1760000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`app_factory_template\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`code\` varchar(80) NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`category\` varchar(50) NOT NULL DEFAULT '',
        \`icon\` varchar(100) NOT NULL DEFAULT '',
        \`summary\` varchar(255) NOT NULL DEFAULT '',
        \`description\` text NULL,
        \`html_content\` mediumtext NULL,
        \`css_content\` mediumtext NULL,
        \`default_visibility\` varchar(20) NOT NULL DEFAULT 'marketplace',
        \`default_saas_module_code\` varchar(50) NOT NULL DEFAULT '',
        \`default_system_module_code\` varchar(80) NOT NULL DEFAULT '',
        \`status\` tinyint NOT NULL DEFAULT 1,
        \`sort\` int NOT NULL DEFAULT 100,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_app_factory_template_code\` (\`code\`),
        KEY \`idx_app_factory_template_category\` (\`category\`),
        KEY \`idx_app_factory_template_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `app_factory_template`');
  }
}
