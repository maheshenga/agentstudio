import { MigrationInterface, QueryRunner } from 'typeorm';

type MenuSeed = {
  parentCode: string;
  name: string;
  code: string;
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

const ANALYTICS_MENUS: MenuSeed[] = [
  {
    parentCode: 'AppPlatform',
    name: 'App Analytics',
    code: 'AppPlatformAnalytics',
    path: '/app-platform/analytics',
    component: '/app-platform/analytics',
    icon: 'ri:line-chart-line',
    sort: 40,
    remark: 'Seeded platform app analytics dashboard',
  },
  {
    parentCode: 'AppCenter',
    name: 'App Usage',
    code: 'AppTenantUsage',
    path: '/app-center/usage',
    component: '/app-center/usage',
    icon: 'ri:bar-chart-box-line',
    sort: 50,
    remark: 'Seeded tenant app usage dashboard',
  },
];

const ANALYTICS_PERMISSIONS: PermissionSeed[] = [
  {
    parentCode: 'AppPlatformAnalytics',
    name: 'Platform Analytics',
    slug: 'app:analytics:platform',
    method: 'GET',
    sort: 10,
    remark: 'Platform app analytics permission',
  },
  {
    parentCode: 'AppTenantUsage',
    name: 'Tenant Analytics',
    slug: 'app:analytics:tenant',
    method: 'GET',
    sort: 10,
    remark: 'Tenant app analytics permission',
  },
];

const ANALYTICS_MENU_CODES = ANALYTICS_MENUS.map((menu) => menu.code);
const ANALYTICS_PERMISSION_SLUGS = ANALYTICS_PERMISSIONS.map((permission) => permission.slug);

export class SeedAppAnalyticsMenus1760000000037 implements MigrationInterface {
  name = 'SeedAppAnalyticsMenus1760000000037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const menu of ANALYTICS_MENUS) {
      await this.insertMenu(queryRunner, menu);
    }
    for (const permission of ANALYTICS_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }

    await this.grantRoleMenus(queryRunner, {
      roleWhere: "`role`.`code` IN ('admin', 'super_admin')",
      codes: ['AppPlatform', 'AppPlatformAnalytics'],
      slugs: ['app:analytics:platform'],
    });
    await this.grantRoleMenus(queryRunner, {
      roleWhere: "`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin)$'",
      codes: ['AppCenter', 'AppTenantUsage'],
      slugs: ['app:analytics:tenant'],
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DELETE \`role_menu\`
        FROM \`sa_system_role_menu\` \`role_menu\`
        INNER JOIN \`sa_system_menu\` \`menu\`
          ON \`menu\`.\`id\` = \`role_menu\`.\`menu_id\`
        WHERE \`menu\`.\`code\` IN (${ANALYTICS_MENU_CODES.map(() => '?').join(', ')})
           OR \`menu\`.\`slug\` IN (${ANALYTICS_PERMISSION_SLUGS.map(() => '?').join(', ')})
      `,
      [...ANALYTICS_MENU_CODES, ...ANALYTICS_PERMISSION_SLUGS],
    );
    await queryRunner.query(
      `
        DELETE FROM \`sa_system_menu\`
        WHERE \`slug\` IN (${ANALYTICS_PERMISSION_SLUGS.map(() => '?').join(', ')})
          AND \`delete_time\` IS NULL
      `,
      ANALYTICS_PERMISSION_SLUGS,
    );
    await queryRunner.query(
      `
        DELETE FROM \`sa_system_menu\`
        WHERE \`code\` IN (${ANALYTICS_MENU_CODES.map(() => '?').join(', ')})
          AND \`delete_time\` IS NULL
      `,
      ANALYTICS_MENU_CODES,
    );
  }

  private async insertMenu(queryRunner: QueryRunner, menu: MenuSeed): Promise<void> {
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
        menu.name,
        menu.code,
        menu.path,
        menu.component,
        menu.icon,
        menu.sort,
        menu.remark,
        menu.parentCode,
        menu.code,
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
      [
        permission.name,
        permission.slug,
        permission.method,
        permission.sort,
        permission.remark,
        permission.parentCode,
        permission.slug,
      ],
    );
  }

  private async grantRoleMenus(
    queryRunner: QueryRunner,
    input: { roleWhere: string; codes: string[]; slugs: string[] },
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
        SELECT \`role\`.\`id\`, \`menu\`.\`id\`
        FROM \`sa_system_role\` \`role\`
        INNER JOIN \`sa_system_menu\` \`menu\`
          ON (
            \`menu\`.\`code\` IN (${input.codes.map(() => '?').join(', ')})
            OR \`menu\`.\`slug\` IN (${input.slugs.map(() => '?').join(', ')})
          )
         AND \`menu\`.\`delete_time\` IS NULL
        WHERE ${input.roleWhere}
          AND \`role\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM \`sa_system_role_menu\` \`existing\`
            WHERE \`existing\`.\`role_id\` = \`role\`.\`id\`
              AND \`existing\`.\`menu_id\` = \`menu\`.\`id\`
          )
      `,
      [...input.codes, ...input.slugs],
    );
  }
}
