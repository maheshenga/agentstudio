import { MigrationInterface, QueryRunner } from 'typeorm';

const BRIDGE_ROWS = [
  ['ai_chat', 'ai_console'],
  ['ai_chat', 'taixu_workspace'],
  ['rag', 'taixu_workspace'],
  ['member_management', 'tenant_saas'],
  ['resource_pack', 'tenant_saas'],
  ['advanced_report', 'saas_platform'],
] as const;

export class CreateSystemModuleSaasBridge1760000000023 implements MigrationInterface {
  name = 'CreateSystemModuleSaasBridge1760000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module_saas_bridge\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`saas_module_code\` varchar(50) NOT NULL,
        \`system_module_code\` varchar(80) NOT NULL,
        \`enabled\` tinyint NOT NULL DEFAULT 1,
        \`source\` varchar(20) NOT NULL DEFAULT 'seed',
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_system_module_saas_bridge_pair\` (\`saas_module_code\`, \`system_module_code\`),
        KEY \`idx_system_module_saas_bridge_saas\` (\`saas_module_code\`),
        KEY \`idx_system_module_saas_bridge_system\` (\`system_module_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    for (const [saasModuleCode, systemModuleCode] of BRIDGE_ROWS) {
      await queryRunner.query(
        `
          INSERT INTO \`system_module_saas_bridge\` (
            \`saas_module_code\`,
            \`system_module_code\`,
            \`enabled\`,
            \`source\`,
            \`remark\`
          )
          VALUES (?, ?, 1, 'seed', 'Seeded SaaS to system module bridge')
          ON DUPLICATE KEY UPDATE
            \`delete_time\` = NULL
        `,
        [saasModuleCode, systemModuleCode],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `system_module_saas_bridge`');
  }
}
