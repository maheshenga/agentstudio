import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppOpenOutcomeAnalytics1760000000036 implements MigrationInterface {
  name = 'AddAppOpenOutcomeAnalytics1760000000036';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`app_open_log\`
        ADD COLUMN \`app_code\` varchar(100) NULL AFTER \`user_id\`,
        ADD COLUMN \`outcome\` varchar(20) NOT NULL DEFAULT 'success' AFTER \`open_mode\`,
        ADD COLUMN \`reason_code\` varchar(50) NOT NULL DEFAULT 'none' AFTER \`outcome\`,
        ADD COLUMN \`failure_message\` varchar(255) NOT NULL DEFAULT '' AFTER \`reason_code\`
    `);

    await queryRunner.query(`
      UPDATE \`app_open_log\` \`log\`
      LEFT JOIN \`app_package\` \`app\`
        ON \`app\`.\`id\` = \`log\`.\`app_id\`
      SET \`log\`.\`app_code\` = COALESCE(\`app\`.\`code\`, CONCAT('legacy-app-', \`log\`.\`app_id\`))
      WHERE \`log\`.\`app_code\` IS NULL
         OR \`log\`.\`app_code\` = ''
    `);

    await queryRunner.query(`
      ALTER TABLE \`app_open_log\`
        MODIFY COLUMN \`app_code\` varchar(100) NOT NULL,
        MODIFY COLUMN \`app_id\` bigint NULL,
        ADD KEY \`idx_app_open_log_outcome\` (\`outcome\`, \`create_time\`),
        ADD KEY \`idx_app_open_log_reason\` (\`reason_code\`, \`create_time\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`app_open_log\`
        DROP INDEX \`idx_app_open_log_reason\`,
        DROP INDEX \`idx_app_open_log_outcome\`,
        DROP COLUMN \`failure_message\`,
        DROP COLUMN \`reason_code\`,
        DROP COLUMN \`outcome\`,
        DROP COLUMN \`app_code\`
    `);
    await queryRunner.query('DELETE FROM `app_open_log` WHERE `app_id` IS NULL');
    await queryRunner.query('ALTER TABLE `app_open_log` MODIFY COLUMN `app_id` bigint NOT NULL');
  }
}
