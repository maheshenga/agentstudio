import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystemModules1760000000020 implements MigrationInterface {
  name = 'CreateSystemModules1760000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`code\` varchar(80) NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`source\` varchar(20) NOT NULL,
        \`version\` varchar(40) NOT NULL DEFAULT '1.0.0',
        \`description\` varchar(500) NOT NULL DEFAULT '',
        \`category\` varchar(50) NOT NULL DEFAULT '',
        \`icon\` varchar(100) NOT NULL DEFAULT '',
        \`status\` varchar(20) NOT NULL DEFAULT 'installed',
        \`entry_route\` varchar(255) NOT NULL DEFAULT '',
        \`manifest\` json NULL,
        \`config_schema\` json NULL,
        \`health_status\` varchar(20) NOT NULL DEFAULT 'unknown',
        \`sort\` int NOT NULL DEFAULT 100,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_system_module_code\` (\`code\`),
        KEY \`idx_system_module_status\` (\`status\`),
        KEY \`idx_system_module_source\` (\`source\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module_dependency\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`module_code\` varchar(80) NOT NULL,
        \`depends_on_code\` varchar(80) NOT NULL,
        \`version_range\` varchar(80) NOT NULL DEFAULT '',
        \`required\` tinyint NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        KEY \`idx_system_module_dependency_module\` (\`module_code\`),
        UNIQUE KEY \`uk_system_module_dependency_pair\` (\`module_code\`, \`depends_on_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module_menu\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`module_code\` varchar(80) NOT NULL,
        \`menu_id\` bigint NOT NULL,
        \`binding_type\` varchar(20) NOT NULL DEFAULT 'owned',
        PRIMARY KEY (\`id\`),
        KEY \`idx_system_module_menu_module\` (\`module_code\`),
        UNIQUE KEY \`uk_system_module_menu_pair\` (\`module_code\`, \`menu_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module_permission\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`module_code\` varchar(80) NOT NULL,
        \`permission_slug\` varchar(120) NOT NULL,
        \`binding_type\` varchar(20) NOT NULL DEFAULT 'owned',
        PRIMARY KEY (\`id\`),
        KEY \`idx_system_module_permission_module\` (\`module_code\`),
        UNIQUE KEY \`uk_system_module_permission_pair\` (\`module_code\`, \`permission_slug\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module_api\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`module_code\` varchar(80) NOT NULL,
        \`method\` varchar(10) NOT NULL,
        \`path\` varchar(255) NOT NULL,
        \`permission_slug\` varchar(120) NOT NULL DEFAULT '',
        \`tenant_scoped\` tinyint NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_system_module_api_module\` (\`module_code\`),
        KEY \`idx_system_module_api_route\` (\`method\`, \`path\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_tenant_module\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint NOT NULL,
        \`module_code\` varchar(80) NOT NULL,
        \`enabled\` tinyint NOT NULL DEFAULT 1,
        \`source\` varchar(20) NOT NULL DEFAULT 'platform',
        \`config\` json NULL,
        \`start_time\` datetime NULL,
        \`end_time\` datetime NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_system_tenant_module_pair\` (\`tenant_id\`, \`module_code\`),
        KEY \`idx_system_tenant_module_module\` (\`module_code\`),
        KEY \`idx_system_tenant_module_enabled\` (\`tenant_id\`, \`enabled\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module_event\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`module_code\` varchar(80) NOT NULL,
        \`event_type\` varchar(30) NOT NULL,
        \`status\` varchar(20) NOT NULL,
        \`message\` varchar(500) NOT NULL DEFAULT '',
        \`metadata\` json NULL,
        \`operator_id\` bigint NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_system_module_event_module\` (\`module_code\`),
        KEY \`idx_system_module_event_type\` (\`event_type\`),
        KEY \`idx_system_module_event_operator\` (\`operator_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `system_module_event`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_tenant_module`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_module_api`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_module_permission`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_module_menu`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_module_dependency`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_module`');
  }
}
