import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppServiceRuntimeDriver1760000000052 implements MigrationInterface {
  name = 'AddAppServiceRuntimeDriver1760000000052';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('app_service_instance');
    if (!table?.findColumnByName('runtime_driver')) {
      await queryRunner.query(
        "ALTER TABLE `app_service_instance` ADD COLUMN `runtime_driver` varchar(20) NOT NULL DEFAULT 'pm2' AFTER `loopback_port`",
      );
    }
    const updatedTable = await queryRunner.getTable('app_service_instance');
    if (!updatedTable?.indices.some((index) => index.name === 'idx_app_service_instance_driver_status')) {
      await queryRunner.query(
        'ALTER TABLE `app_service_instance` ADD INDEX `idx_app_service_instance_driver_status` (`runtime_driver`, `process_status`)',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('app_service_instance');
    if (table?.indices.some((index) => index.name === 'idx_app_service_instance_driver_status')) {
      await queryRunner.query(
        'ALTER TABLE `app_service_instance` DROP INDEX `idx_app_service_instance_driver_status`',
      );
    }
    const updatedTable = await queryRunner.getTable('app_service_instance');
    if (updatedTable?.findColumnByName('runtime_driver')) {
      await queryRunner.query('ALTER TABLE `app_service_instance` DROP COLUMN `runtime_driver`');
    }
  }
}
