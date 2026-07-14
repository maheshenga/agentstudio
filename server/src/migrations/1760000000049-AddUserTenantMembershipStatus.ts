import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTenantMembershipStatus1760000000049 implements MigrationInterface {
  name = 'AddUserTenantMembershipStatus1760000000049';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasStatus = await queryRunner.hasColumn('sa_system_user_tenant', 'status');
    if (!hasStatus) {
      await queryRunner.query(
        'ALTER TABLE `sa_system_user_tenant` ADD COLUMN `status` tinyint NOT NULL DEFAULT 1 COMMENT \'Membership status: 1 enabled, 0 disabled\'',
      );
    }
    const table = await queryRunner.getTable('sa_system_user_tenant');
    if (!table?.indices.some((index) => index.name === 'idx_user_tenant_active')) {
      await queryRunner.query(
        'ALTER TABLE `sa_system_user_tenant` ADD INDEX `idx_user_tenant_active` (`tenant_id`, `status`, `delete_time`)',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('sa_system_user_tenant');
    if (table?.indices.some((index) => index.name === 'idx_user_tenant_active')) {
      await queryRunner.query('ALTER TABLE `sa_system_user_tenant` DROP INDEX `idx_user_tenant_active`');
    }
    // The baseline schema already contains status, so rollback must preserve this data column.
  }
}
