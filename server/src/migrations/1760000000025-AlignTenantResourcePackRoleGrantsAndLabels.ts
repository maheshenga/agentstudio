import { MigrationInterface, QueryRunner } from 'typeorm';

const TENANT_RESOURCE_PACK_PERMISSION_SLUGS = [
  'tenant:resource-pack:view',
  'tenant:resource-pack-order:create',
  'tenant:resource-pack-order:view',
  'tenant:resource-pack-order:pay',
] as const;

export class AlignTenantResourcePackRoleGrantsAndLabels1760000000025 implements MigrationInterface {
  name = 'AlignTenantResourcePackRoleGrantsAndLabels1760000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.updateMenuName(queryRunner, 'SaasResourcePack', '资源包管理');
    await this.updateMenuName(queryRunner, 'SaasResourcePackOrder', '资源包订单');
    await this.updateMenuName(queryRunner, 'TenantResourcePack', '资源包');
    await this.updateMenuName(queryRunner, 'TenantSystemModules', '租户模块');

    await queryRunner.query(`
      INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
      SELECT \`role\`.\`id\`, \`menu\`.\`id\`
      FROM \`sa_system_role\` \`role\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON (
          \`menu\`.\`code\` = 'TenantResourcePack'
          OR \`menu\`.\`slug\` IN (
            'tenant:resource-pack:view',
            'tenant:resource-pack-order:create',
            'tenant:resource-pack-order:view',
            'tenant:resource-pack-order:pay'
          )
        )
        AND \`menu\`.\`delete_time\` IS NULL
      WHERE \`role\`.\`code\` REGEXP '^tenant:[0-9]+:(owner|admin)$'
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
        AND \`role\`.\`code\` REGEXP '^tenant:[0-9]+:(owner|admin)$'
        AND \`role\`.\`delete_time\` IS NULL
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON \`menu\`.\`id\` = \`role_menu\`.\`menu_id\`
      WHERE (
          \`menu\`.\`code\` = 'TenantResourcePack'
          OR \`menu\`.\`slug\` IN (
            'tenant:resource-pack:view',
            'tenant:resource-pack-order:create',
            'tenant:resource-pack-order:view',
            'tenant:resource-pack-order:pay'
          )
        )
    `);

    await this.updateMenuName(queryRunner, 'SaasResourcePack', 'Resource Packs');
    await this.updateMenuName(queryRunner, 'SaasResourcePackOrder', 'Resource Pack Orders');
    await this.updateMenuName(queryRunner, 'TenantResourcePack', 'Resource Packs');
    await this.updateMenuName(queryRunner, 'TenantSystemModules', 'Tenant Modules');
  }

  private async updateMenuName(queryRunner: QueryRunner, code: string, name: string): Promise<void> {
    await queryRunner.query(
      `
        UPDATE \`sa_system_menu\`
        SET \`name\` = ?,
            \`update_time\` = NOW()
        WHERE \`code\` = ?
          AND \`delete_time\` IS NULL
      `,
      [name, code],
    );
  }
}
