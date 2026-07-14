import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppAnalyticsAndPendingOrderIndexes1760000000048 implements MigrationInterface {
  name = 'AddAppAnalyticsAndPendingOrderIndexes1760000000048';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `app_open_log` ADD KEY `idx_app_open_log_code_time` (`app_code`, `create_time`)',
    );
    await queryRunner.query(
      'ALTER TABLE `app_order` ADD KEY `idx_app_order_pending_lookup` (`tenant_id`, `app_id`, `price_plan_id`, `payment_method`, `status`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `app_order` DROP INDEX `idx_app_order_pending_lookup`');
    await queryRunner.query('ALTER TABLE `app_open_log` DROP INDEX `idx_app_open_log_code_time`');
  }
}
