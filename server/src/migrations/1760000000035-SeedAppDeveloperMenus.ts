import { MigrationInterface, QueryRunner } from 'typeorm';

type PermissionSeed = {
  name: string;
  slug: string;
  method: string;
  sort: number;
  remark: string;
};

const DEVELOPER_MENU = {
  parentCode: 'AppCenter',
  name: 'Developer Apps',
  code: 'AppDeveloperApps',
  path: 'developer',
  component: '/app-center/developer',
  icon: 'ri:code-box-line',
  sort: 40,
  remark: 'Seeded developer app submission workspace',
};

const DEVELOPER_PERMISSIONS: PermissionSeed[] = [
  { name: 'List', slug: 'app:developer:list', method: 'GET', sort: 10, remark: 'Developer app list permission' },
  { name: 'Read', slug: 'app:developer:read', method: 'GET', sort: 20, remark: 'Developer app read permission' },
  { name: 'Create', slug: 'app:developer:create', method: 'POST', sort: 30, remark: 'Developer app create permission' },
  { name: 'Update', slug: 'app:developer:update', method: 'PUT', sort: 40, remark: 'Developer app update permission' },
  { name: 'Upload', slug: 'app:developer:upload', method: 'POST', sort: 50, remark: 'Developer app upload permission' },
  { name: 'Submit', slug: 'app:developer:submit', method: 'POST', sort: 60, remark: 'Developer app submit permission' },
];

const DEVELOPER_PERMISSION_SLUGS = DEVELOPER_PERMISSIONS.map((permission) => permission.slug);

export class SeedAppDeveloperMenus1760000000035 implements MigrationInterface {
  name = 'SeedAppDeveloperMenus1760000000035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insertMenu(queryRunner);
    for (const permission of DEVELOPER_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }
    await this.grantPlatformAdminRoles(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DELETE \`role_menu\`
        FROM \`sa_system_role_menu\` \`role_menu\`
        INNER JOIN \`sa_system_menu\` \`menu\`
          ON \`menu\`.\`id\` = \`role_menu\`.\`menu_id\`
        WHERE \`menu\`.\`code\` = 'AppDeveloperApps'
           OR \`menu\`.\`slug\` IN (${DEVELOPER_PERMISSION_SLUGS.map(() => '?').join(', ')})
      `,
      DEVELOPER_PERMISSION_SLUGS,
    );
    await queryRunner.query(
      `
        DELETE FROM \`sa_system_menu\`
        WHERE \`slug\` IN (${DEVELOPER_PERMISSION_SLUGS.map(() => '?').join(', ')})
          AND \`delete_time\` IS NULL
      `,
      DEVELOPER_PERMISSION_SLUGS,
    );
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`code\` = 'AppDeveloperApps'
        AND \`delete_time\` IS NULL
    `);
  }

  private async insertMenu(queryRunner: QueryRunner): Promise<void> {
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
          \`is_hidden\`,
          \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, ?, NULL, 2, ?, ?, ?, ?, 1, 0, ?
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
      [
        DEVELOPER_MENU.name,
        DEVELOPER_MENU.code,
        DEVELOPER_MENU.path,
        DEVELOPER_MENU.component,
        DEVELOPER_MENU.icon,
        DEVELOPER_MENU.sort,
        DEVELOPER_MENU.remark,
        DEVELOPER_MENU.parentCode,
        DEVELOPER_MENU.code,
      ],
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
        WHERE \`parent\`.\`code\` = 'AppDeveloperApps'
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
      [permission.name, permission.slug, permission.method, permission.sort, permission.remark, permission.slug],
    );
  }

  private async grantPlatformAdminRoles(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
        SELECT \`role\`.\`id\`, \`menu\`.\`id\`
        FROM \`sa_system_role\` \`role\`
        INNER JOIN \`sa_system_menu\` \`menu\`
          ON (
            \`menu\`.\`code\` IN ('AppCenter', 'AppDeveloperApps')
            OR \`menu\`.\`slug\` IN (${DEVELOPER_PERMISSION_SLUGS.map(() => '?').join(', ')})
          )
         AND \`menu\`.\`delete_time\` IS NULL
        WHERE \`role\`.\`code\` IN ('admin', 'super_admin')
          AND \`role\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM \`sa_system_role_menu\` \`existing\`
            WHERE \`existing\`.\`role_id\` = \`role\`.\`id\`
              AND \`existing\`.\`menu_id\` = \`menu\`.\`id\`
          )
      `,
      DEVELOPER_PERMISSION_SLUGS,
    );
  }
}
