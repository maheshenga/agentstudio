import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppStaticContentHash1760000000053 implements MigrationInterface {
  name = 'AddAppStaticContentHash1760000000053';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('app_package_version');
    if (!table?.findColumnByName('content_hash')) {
      await queryRunner.query(
        "ALTER TABLE `app_package_version` ADD COLUMN `content_hash` char(64) NOT NULL DEFAULT '' AFTER `file_hash`",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('app_package_version');
    if (table?.findColumnByName('content_hash')) {
      await queryRunner.query('ALTER TABLE `app_package_version` DROP COLUMN `content_hash`');
    }
  }
}
