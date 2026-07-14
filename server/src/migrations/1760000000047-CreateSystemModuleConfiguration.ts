import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystemModuleConfiguration1760000000047 implements MigrationInterface {
  name = 'CreateSystemModuleConfiguration1760000000047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module_config\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`module_code\` varchar(80) NOT NULL,
        \`config\` json NOT NULL,
        \`operator_id\` bigint NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_system_module_config_module\` (\`module_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_tenant_module_config\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint NOT NULL,
        \`module_code\` varchar(80) NOT NULL,
        \`config\` json NOT NULL,
        \`operator_id\` bigint NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_system_tenant_module_config_pair\` (\`tenant_id\`, \`module_code\`),
        KEY \`idx_system_tenant_module_config_module\` (\`module_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `system_tenant_module_config`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_module_config`');
  }
}
