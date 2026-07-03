import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaasOrderPaymentRequestedAt1760000000014 implements MigrationInterface {
  name = 'AddSaasOrderPaymentRequestedAt1760000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `saas_order` ADD COLUMN `payment_requested_at` datetime NULL');
    await queryRunner.query('ALTER TABLE `saas_resource_pack_order` ADD COLUMN `payment_requested_at` datetime NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `saas_resource_pack_order` DROP COLUMN `payment_requested_at`');
    await queryRunner.query('ALTER TABLE `saas_order` DROP COLUMN `payment_requested_at`');
  }
}
