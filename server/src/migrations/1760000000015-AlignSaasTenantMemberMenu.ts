import { MigrationInterface, QueryRunner } from 'typeorm';

type MenuSeed = {
  name: string;
  code: string;
  type: number;
  path: string;
  component: string;
  icon: string;
  sort: number;
  remark: string;
};

type PermissionSeed = {
  parentCode: string;
  name: string;
  slug: string;
  method: string;
  sort: number;
  remark: string;
};

const TENANT_MEMBER_MENU: MenuSeed = {
  name: '成员管理',
  code: 'TenantMember',
  type: 2,
  path: 'members',
  component: '/saas/tenant/member',
  icon: 'ri:team-line',
  sort: 40,
  remark: 'Seeded tenant member menu',
};

const TENANT_MEMBER_PERMISSIONS: PermissionSeed[] = [
  {
    parentCode: 'TenantMember',
    name: 'View',
    slug: 'tenant:member:index',
    method: 'GET',
    sort: 10,
    remark: 'Seeded tenant member list permission',
  },
  {
    parentCode: 'TenantMember',
    name: 'Create',
    slug: 'tenant:member:create',
    method: 'POST',
    sort: 20,
    remark: 'Seeded tenant member create permission',
  },
];

export class AlignSaasTenantMemberMenu1760000000015 implements MigrationInterface {
  name = 'AlignSaasTenantMemberMenu1760000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insertChildMenu(queryRunner, 'TenantSaas', TENANT_MEMBER_MENU);
    for (const permission of TENANT_MEMBER_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }
    await this.grantExistingTenantRoles(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE \`role_menu\`
      FROM \`sa_system_role_menu\` \`role_menu\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON \`menu\`.\`id\` = \`role_menu\`.\`menu_id\`
      WHERE \`menu\`.\`code\` = 'TenantMember'
         OR \`menu\`.\`slug\` IN ('tenant:member:index', 'tenant:member:create')
    `);
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`slug\` IN ('tenant:member:index', 'tenant:member:create')
        AND \`delete_time\` IS NULL
    `);
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`code\` = 'TenantMember'
        AND \`delete_time\` IS NULL
    `);
  }

  private async insertChildMenu(queryRunner: QueryRunner, parentCode: string, menu: MenuSeed): Promise<void> {
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
          \`icon\`,
          \`sort\`,
          \`status\`,
          \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, ?, NULL, ?, ?, ?, ?, ?, 1, ?
        FROM \`sa_system_menu\` \`parent\`
        WHERE \`parent\`.\`code\` = ?
          AND \`parent\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM \`sa_system_menu\`
            WHERE \`code\` = ?
              AND \`delete_time\` IS NULL
          )
        ORDER BY \`parent\`.\`id\` ASC
        LIMIT 1
      `,
      [menu.name, menu.code, menu.type, menu.path, menu.component, menu.icon, menu.sort, menu.remark, parentCode, menu.code],
    );
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

  private async grantExistingTenantRoles(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
      SELECT \`role\`.\`id\`, \`menu\`.\`id\`
      FROM \`sa_system_role\` \`role\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON (
          \`menu\`.\`code\` = 'TenantMember'
          OR \`menu\`.\`slug\` IN ('tenant:member:index', 'tenant:member:create')
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
    await queryRunner.query(`
      INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
      SELECT \`role\`.\`id\`, \`menu\`.\`id\`
      FROM \`sa_system_role\` \`role\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON (
          \`menu\`.\`code\` = 'TenantMember'
          OR \`menu\`.\`slug\` = 'tenant:member:index'
        )
        AND \`menu\`.\`delete_time\` IS NULL
      WHERE \`role\`.\`code\` REGEXP '^tenant:[0-9]+:member$'
        AND \`role\`.\`delete_time\` IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM \`sa_system_role_menu\` \`existing\`
          WHERE \`existing\`.\`role_id\` = \`role\`.\`id\`
            AND \`existing\`.\`menu_id\` = \`menu\`.\`id\`
        )
    `);
  }
}
