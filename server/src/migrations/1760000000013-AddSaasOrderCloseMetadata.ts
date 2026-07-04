import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaasOrderCloseMetadata1760000000013 implements MigrationInterface {
  name = 'AddSaasOrderCloseMetadata1760000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `saas_order` ADD COLUMN `closed_at` datetime NULL');
    await queryRunner.query('ALTER TABLE `saas_order` ADD COLUMN `close_reason` varchar(50) NULL');
    await queryRunner.query('CREATE INDEX `idx_saas_order_status_create_time` ON `saas_order` (`status`, `create_time`)');
    await queryRunner.query('CREATE INDEX `idx_saas_order_status_close_reason` ON `saas_order` (`status`, `close_reason`)');

    await queryRunner.query('ALTER TABLE `saas_resource_pack_order` ADD COLUMN `closed_at` datetime NULL');
    await queryRunner.query('ALTER TABLE `saas_resource_pack_order` ADD COLUMN `close_reason` varchar(50) NULL');
    await queryRunner.query(
      'CREATE INDEX `idx_saas_resource_pack_order_status_create_time` ON `saas_resource_pack_order` (`status`, `create_time`)',
    );
    await queryRunner.query(
      'CREATE INDEX `idx_saas_resource_pack_order_status_close_reason` ON `saas_resource_pack_order` (`status`, `close_reason`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX `idx_saas_resource_pack_order_status_close_reason` ON `saas_resource_pack_order`');
    await queryRunner.query('DROP INDEX `idx_saas_resource_pack_order_status_create_time` ON `saas_resource_pack_order`');
    await queryRunner.query('ALTER TABLE `saas_resource_pack_order` DROP COLUMN `close_reason`');
    await queryRunner.query('ALTER TABLE `saas_resource_pack_order` DROP COLUMN `closed_at`');

    await queryRunner.query('DROP INDEX `idx_saas_order_status_close_reason` ON `saas_order`');
    await queryRunner.query('DROP INDEX `idx_saas_order_status_create_time` ON `saas_order`');
    await queryRunner.query('ALTER TABLE `saas_order` DROP COLUMN `close_reason`');
    await queryRunner.query('ALTER TABLE `saas_order` DROP COLUMN `closed_at`');
  }
}
