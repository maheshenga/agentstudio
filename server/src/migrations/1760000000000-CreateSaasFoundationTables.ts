import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaasFoundationTables1760000000000 implements MigrationInterface {
  name = 'CreateSaasFoundationTables1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`saas_plan\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`code\` varchar(50) NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`billing_cycle\` varchar(20) NOT NULL DEFAULT 'monthly',
        \`status\` tinyint NOT NULL DEFAULT 1,
        \`sort\` int NOT NULL DEFAULT 100,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_saas_plan_code\` (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE \`saas_plan_feature\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`plan_id\` bigint NOT NULL,
        \`feature_key\` varchar(50) NOT NULL,
        \`enabled\` tinyint NOT NULL DEFAULT 1,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_saas_plan_feature_plan_key\` (\`plan_id\`, \`feature_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE \`saas_plan_quota\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`plan_id\` bigint NOT NULL,
        \`quota_type\` varchar(50) NOT NULL,
        \`total_quota\` bigint NOT NULL DEFAULT 0,
        \`status\` tinyint NOT NULL DEFAULT 1,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_saas_plan_quota_plan_type\` (\`plan_id\`, \`quota_type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE \`saas_subscription\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint NOT NULL,
        \`plan_id\` bigint NOT NULL,
        \`billing_cycle\` varchar(20) NOT NULL DEFAULT 'monthly',
        \`status\` varchar(20) NOT NULL,
        \`start_time\` datetime NOT NULL,
        \`end_time\` datetime NULL,
        \`cancel_at_period_end\` tinyint NOT NULL DEFAULT 0,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_saas_subscription_tenant_status\` (\`tenant_id\`, \`status\`),
        KEY \`idx_saas_subscription_plan_id\` (\`plan_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE \`saas_trial\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint NOT NULL,
        \`subscription_id\` bigint NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'trialing',
        \`start_time\` datetime NOT NULL,
        \`end_time\` datetime NOT NULL,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_saas_trial_tenant_id\` (\`tenant_id\`),
        KEY \`idx_saas_trial_subscription_id\` (\`subscription_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE \`saas_tenant_resource\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint NOT NULL,
        \`resource_type\` varchar(50) NOT NULL,
        \`total_quota\` bigint NOT NULL DEFAULT 0,
        \`used_quota\` bigint NOT NULL DEFAULT 0,
        \`status\` tinyint NOT NULL DEFAULT 1,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_saas_tenant_resource_tenant_type\` (\`tenant_id\`, \`resource_type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `saas_tenant_resource`');
    await queryRunner.query('DROP TABLE IF EXISTS `saas_trial`');
    await queryRunner.query('DROP TABLE IF EXISTS `saas_subscription`');
    await queryRunner.query('DROP TABLE IF EXISTS `saas_plan_quota`');
    await queryRunner.query('DROP TABLE IF EXISTS `saas_plan_feature`');
    await queryRunner.query('DROP TABLE IF EXISTS `saas_plan`');
  }
}
