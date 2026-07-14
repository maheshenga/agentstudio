import { MigrationInterface, QueryRunner } from 'typeorm';

export class VersionAppFactoryTemplates1760000000055 implements MigrationInterface {
  name = 'VersionAppFactoryTemplates1760000000055';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`app_factory_template\`
        ADD COLUMN \`schema_version\` int unsigned NOT NULL DEFAULT 1 AFTER \`code\`,
        ADD COLUMN \`template_version\` varchar(40) NOT NULL DEFAULT '1.0.0' AFTER \`schema_version\`,
        ADD COLUMN \`runtime_target\` varchar(20) NOT NULL DEFAULT 'static' AFTER \`template_version\`,
        ADD COLUMN \`manifest_defaults\` json NULL AFTER \`runtime_target\`,
        DROP INDEX \`uk_app_factory_template_code\`,
        ADD UNIQUE KEY \`uk_app_factory_template_code_version\` (\`code\`, \`template_version\`)
    `);
    await queryRunner.query(`
      UPDATE \`app_factory_template\`
      SET \`manifest_defaults\` = JSON_OBJECT(
        'tenant_scoped', TRUE,
        'permissions', JSON_ARRAY()
      )
      WHERE \`manifest_defaults\` IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE \`app_factory_module\`
        ADD COLUMN \`template_code\` varchar(80) NOT NULL DEFAULT '' AFTER \`kind\`,
        ADD COLUMN \`template_version\` varchar(40) NOT NULL DEFAULT '' AFTER \`template_code\`,
        ADD COLUMN \`template_schema_version\` int unsigned NOT NULL DEFAULT 1 AFTER \`template_version\`,
        ADD COLUMN \`runtime_target\` varchar(20) NOT NULL DEFAULT 'static' AFTER \`template_schema_version\`,
        ADD COLUMN \`manifest_defaults\` json NULL AFTER \`runtime_target\`
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO \`app_factory_template\` (
        \`code\`, \`schema_version\`, \`template_version\`, \`runtime_target\`,
        \`manifest_defaults\`, \`name\`, \`category\`, \`icon\`, \`summary\`,
        \`description\`, \`html_content\`, \`css_content\`, \`default_visibility\`,
        \`default_saas_module_code\`, \`default_system_module_code\`, \`status\`,
        \`sort\`, \`remark\`
      )
      SELECT
        \`code\`, 2, '2.0.0', 'static',
        JSON_OBJECT('tenant_scoped', TRUE, 'permissions', JSON_ARRAY('context.read')),
        \`name\`, \`category\`, \`icon\`, \`summary\`, \`description\`,
        \`html_content\`, \`css_content\`, \`default_visibility\`,
        \`default_saas_module_code\`, \`default_system_module_code\`, 1,
        \`sort\`, 'Versioned recruitment factory scaffold'
      FROM \`app_factory_template\`
      WHERE \`code\` = 'job_board' AND \`template_version\` = '1.0.0'
      LIMIT 1
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO \`app_factory_template\` (
        \`code\`, \`schema_version\`, \`template_version\`, \`runtime_target\`,
        \`manifest_defaults\`, \`name\`, \`category\`, \`icon\`, \`summary\`,
        \`description\`, \`html_content\`, \`css_content\`, \`default_visibility\`,
        \`default_saas_module_code\`, \`default_system_module_code\`, \`status\`,
        \`sort\`, \`remark\`
      )
      SELECT
        \`code\`, 2, '2.0.0', 'service',
        JSON_OBJECT('healthPath', '/health', 'capabilities', JSON_ARRAY('context.read')),
        CONCAT(\`name\`, ' Service'), \`category\`, \`icon\`,
        'A manifest-only service scaffold for reviewed classifieds capabilities.',
        'Generates a constrained service Manifest V2. Executable code must be submitted through App Platform review.',
        NULL, NULL, \`default_visibility\`, \`default_saas_module_code\`,
        \`default_system_module_code\`, 1, \`sort\`,
        'Versioned classifieds service scaffold'
      FROM \`app_factory_template\`
      WHERE \`code\` = 'classifieds' AND \`template_version\` = '1.0.0'
      LIMIT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM \`app_factory_template\`
      WHERE \`template_version\` = '2.0.0'
        AND \`code\` IN ('job_board', 'classifieds')
    `);
    await queryRunner.query(`
      ALTER TABLE \`app_factory_module\`
        DROP COLUMN \`manifest_defaults\`,
        DROP COLUMN \`runtime_target\`,
        DROP COLUMN \`template_schema_version\`,
        DROP COLUMN \`template_version\`,
        DROP COLUMN \`template_code\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`app_factory_template\`
        DROP INDEX \`uk_app_factory_template_code_version\`,
        ADD UNIQUE KEY \`uk_app_factory_template_code\` (\`code\`),
        DROP COLUMN \`manifest_defaults\`,
        DROP COLUMN \`runtime_target\`,
        DROP COLUMN \`template_version\`,
        DROP COLUMN \`schema_version\`
    `);
  }
}
