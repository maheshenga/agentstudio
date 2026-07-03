import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaasModules1760000000016 implements MigrationInterface {
  name = 'CreateSaasModules1760000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      /* CREATE TABLE \`saas_module\` */
      CREATE TABLE IF NOT EXISTS \`saas_module\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`code\` varchar(50) NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`description\` varchar(255) NOT NULL DEFAULT '',
        \`category\` varchar(50) NOT NULL DEFAULT '',
        \`icon\` varchar(100) NOT NULL DEFAULT '',
        \`route_path\` varchar(255) NOT NULL DEFAULT '',
        \`status\` tinyint NOT NULL DEFAULT 1,
        \`sort\` int NOT NULL DEFAULT 100,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_saas_module_code\` (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `saas_module`');
  }
}
