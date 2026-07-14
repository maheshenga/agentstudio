import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppMarketplaceDetail1760000000054 implements MigrationInterface {
  name = 'AddAppMarketplaceDetail1760000000054';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('app_package');
    if (!table?.findColumnByName('screenshots')) {
      await queryRunner.query(
        'ALTER TABLE `app_package` ADD COLUMN `screenshots` json NULL AFTER `runtime_config`',
      );
    }
    if (!table?.findColumnByName('documentation_url')) {
      await queryRunner.query(
        "ALTER TABLE `app_package` ADD COLUMN `documentation_url` varchar(500) NOT NULL DEFAULT '' AFTER `screenshots`",
      );
    }
    if (!table?.findColumnByName('support_url')) {
      await queryRunner.query(
        "ALTER TABLE `app_package` ADD COLUMN `support_url` varchar(500) NOT NULL DEFAULT '' AFTER `documentation_url`",
      );
    }
    if (!table?.findColumnByName('changelog')) {
      await queryRunner.query(
        'ALTER TABLE `app_package` ADD COLUMN `changelog` text NULL AFTER `support_url`',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('app_package');
    if (table?.findColumnByName('changelog')) {
      await queryRunner.query('ALTER TABLE `app_package` DROP COLUMN `changelog`');
    }
    if (table?.findColumnByName('support_url')) {
      await queryRunner.query('ALTER TABLE `app_package` DROP COLUMN `support_url`');
    }
    if (table?.findColumnByName('documentation_url')) {
      await queryRunner.query('ALTER TABLE `app_package` DROP COLUMN `documentation_url`');
    }
    if (table?.findColumnByName('screenshots')) {
      await queryRunner.query('ALTER TABLE `app_package` DROP COLUMN `screenshots`');
    }
  }
}
