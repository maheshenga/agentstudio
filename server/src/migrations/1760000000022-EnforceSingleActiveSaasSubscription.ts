import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceSingleActiveSaasSubscription1760000000022 implements MigrationInterface {
  name = 'EnforceSingleActiveSaasSubscription1760000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`saas_subscription\` \`subscription\`
      INNER JOIN (
        SELECT \`tenant_id\`, MAX(\`id\`) AS \`keep_id\`
        FROM \`saas_subscription\`
        WHERE \`status\` = 'active'
          AND \`delete_time\` IS NULL
        GROUP BY \`tenant_id\`
        HAVING COUNT(1) > 1
      ) \`duplicate_active\`
        ON \`duplicate_active\`.\`tenant_id\` = \`subscription\`.\`tenant_id\`
      SET
        \`subscription\`.\`status\` = 'expired',
        \`subscription\`.\`end_time\` = COALESCE(\`subscription\`.\`end_time\`, NOW()),
        \`subscription\`.\`remark\` = LEFT(CONCAT(
          COALESCE(\`subscription\`.\`remark\`, ''),
          ' Expired by single active subscription migration'
        ), 255)
      WHERE \`subscription\`.\`status\` = 'active'
        AND \`subscription\`.\`delete_time\` IS NULL
        AND \`subscription\`.\`id\` <> \`duplicate_active\`.\`keep_id\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`saas_subscription\`
      ADD COLUMN \`active_tenant_id\` bigint GENERATED ALWAYS AS (
        CASE
          WHEN \`status\` = 'active' AND \`delete_time\` IS NULL THEN \`tenant_id\`
          ELSE NULL
        END
      ) STORED
    `);

    await queryRunner.query(
      'CREATE UNIQUE INDEX `uk_saas_subscription_active_tenant` ON `saas_subscription` (`active_tenant_id`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX `uk_saas_subscription_active_tenant` ON `saas_subscription`');
    await queryRunner.query('ALTER TABLE `saas_subscription` DROP COLUMN `active_tenant_id`');
  }
}
