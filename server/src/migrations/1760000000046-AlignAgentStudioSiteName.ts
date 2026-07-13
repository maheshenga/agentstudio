import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignAgentStudioSiteName1760000000046 implements MigrationInterface {
  name = 'AlignAgentStudioSiteName1760000000046';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE \`sa_system_config\`
        SET \`value\` = ?, \`update_time\` = CURRENT_TIMESTAMP
        WHERE \`key\` = ?
          AND \`value\` IN (?, ?)
      `,
      ['AgentStudio', 'site_name', 'FssAdmin后台管理系统', 'FssAdmin'],
    );
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Do not overwrite a site name that an administrator may have changed after this migration.
  }
}
