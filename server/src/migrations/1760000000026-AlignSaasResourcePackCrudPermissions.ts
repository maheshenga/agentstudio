import { MigrationInterface, QueryRunner } from 'typeorm';

type PermissionSeed = {
  parentCode: string;
  name: string;
  slug: string;
  method: string;
  sort: number;
  remark: string;
};

const RESOURCE_PACK_CRUD_PERMISSIONS: PermissionSeed[] = [
  {
    parentCode: 'SaasResourcePack',
    name: 'Create',
    slug: 'saas:resource-pack:save',
    method: 'POST',
    sort: 20,
    remark: 'Seeded SaaS resource pack create permission',
  },
  {
    parentCode: 'SaasResourcePack',
    name: 'Update',
    slug: 'saas:resource-pack:update',
    method: 'PUT',
    sort: 30,
    remark: 'Seeded SaaS resource pack update permission',
  },
  {
    parentCode: 'SaasResourcePack',
    name: 'Status',
    slug: 'saas:resource-pack:status',
    method: 'PUT',
    sort: 40,
    remark: 'Seeded SaaS resource pack status permission',
  },
];

export class AlignSaasResourcePackCrudPermissions1760000000026 implements MigrationInterface {
  name = 'AlignSaasResourcePackCrudPermissions1760000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const permission of RESOURCE_PACK_CRUD_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }

    await this.grantAdminRoles(queryRunner);
    await this.grantExistingResourcePackRoles(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE \`role_menu\`
      FROM \`sa_system_role_menu\` \`role_menu\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON \`menu\`.\`id\` = \`role_menu\`.\`menu_id\`
        AND \`menu\`.\`slug\` IN ('saas:resource-pack:save', 'saas:resource-pack:update', 'saas:resource-pack:status')
        AND \`menu\`.\`delete_time\` IS NULL
    `);

    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`slug\` IN ('saas:resource-pack:save', 'saas:resource-pack:update', 'saas:resource-pack:status')
        AND \`delete_time\` IS NULL
    `);
  }

  private async insertPermission(queryRunner: QueryRunner, permission: PermissionSeed): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_menu\` (
          \`parent_id\`,
          \`name\`,
          \`code\`,
          \`slug\`,
          \`type\`,
          \`path\`,
          \`component\`,
          \`method\`,
          \`sort\`,
          \`status\`,
          \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, NULL, ?, 3, '', '', ?, ?, 1, ?
        FROM \`sa_system_menu\` \`parent\`
        WHERE \`parent\`.\`code\` = ?
          AND \`parent\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM \`sa_system_menu\`
            WHERE \`slug\` = ?
              AND \`delete_time\` IS NULL
          )
        ORDER BY \`parent\`.\`id\` ASC
        LIMIT 1
      `,
      [permission.name, permission.slug, permission.method, permission.sort, permission.remark, permission.parentCode, permission.slug],
    );
  }

  private async grantAdminRoles(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
      SELECT \`role\`.\`id\`, \`permission\`.\`id\`
      FROM \`sa_system_role\` \`role\`
      INNER JOIN \`sa_system_menu\` \`permission\`
        ON \`permission\`.\`slug\` IN ('saas:resource-pack:save', 'saas:resource-pack:update', 'saas:resource-pack:status')
        AND \`permission\`.\`delete_time\` IS NULL
      WHERE \`role\`.\`code\` IN ('admin', 'super_admin')
        AND \`role\`.\`delete_time\` IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM \`sa_system_role_menu\` \`existing\`
          WHERE \`existing\`.\`role_id\` = \`role\`.\`id\`
            AND \`existing\`.\`menu_id\` = \`permission\`.\`id\`
        )
    `);
  }

  private async grantExistingResourcePackRoles(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
      SELECT DISTINCT \`source_role_menu\`.\`role_id\`, \`permission\`.\`id\`
      FROM \`sa_system_role_menu\` \`source_role_menu\`
      INNER JOIN \`sa_system_menu\` \`source_menu\`
        ON \`source_menu\`.\`id\` = \`source_role_menu\`.\`menu_id\`
        AND (
          \`source_menu\`.\`code\` = 'SaasResourcePack'
          OR \`source_menu\`.\`slug\` = 'saas:resource-pack:index'
        )
        AND \`source_menu\`.\`delete_time\` IS NULL
      INNER JOIN \`sa_system_menu\` \`permission\`
        ON \`permission\`.\`slug\` IN ('saas:resource-pack:save', 'saas:resource-pack:update', 'saas:resource-pack:status')
        AND \`permission\`.\`delete_time\` IS NULL
      WHERE NOT EXISTS (
        SELECT 1
        FROM \`sa_system_role_menu\` \`existing\`
        WHERE \`existing\`.\`role_id\` = \`source_role_menu\`.\`role_id\`
          AND \`existing\`.\`menu_id\` = \`permission\`.\`id\`
      )
    `);
  }
}
