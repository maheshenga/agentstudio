import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignTenantSystemModuleRoleGrants1760000000024 implements MigrationInterface {
  name = 'AlignTenantSystemModuleRoleGrants1760000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
      SELECT \`role\`.\`id\`, \`menu\`.\`id\`
      FROM \`sa_system_role\` \`role\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON (
          \`menu\`.\`code\` = 'TenantSystemModules'
          OR \`menu\`.\`slug\` = 'tenant:module:list'
        )
        AND \`menu\`.\`delete_time\` IS NULL
      WHERE \`role\`.\`code\` REGEXP '^tenant:[0-9]+:(owner|admin|member)$'
        AND \`role\`.\`delete_time\` IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM \`sa_system_role_menu\` \`existing\`
          WHERE \`existing\`.\`role_id\` = \`role\`.\`id\`
            AND \`existing\`.\`menu_id\` = \`menu\`.\`id\`
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE \`role_menu\`
      FROM \`sa_system_role_menu\` \`role_menu\`
      INNER JOIN \`sa_system_role\` \`role\`
        ON \`role\`.\`id\` = \`role_menu\`.\`role_id\`
        AND \`role\`.\`code\` REGEXP '^tenant:[0-9]+:(owner|admin|member)$'
        AND \`role\`.\`delete_time\` IS NULL
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON \`menu\`.\`id\` = \`role_menu\`.\`menu_id\`
      WHERE (
          \`menu\`.\`code\` = 'TenantSystemModules'
          OR \`menu\`.\`slug\` = 'tenant:module:list'
        )
    `);
  }
}
