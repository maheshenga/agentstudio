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

const MENUS: MenuSeed[] = [
  {
    parentCode: 'AppPlatform',
    name: 'Commercial Operations',
    code: 'AppPlatformCommercial',
    path: '/app-platform/commercial',
    component: '/app-platform/commercial',
    icon: 'ri:money-cny-circle-line',
    sort: 70,
    remark: 'Seeded application commerce operations workspace',
  },
  {
    parentCode: 'AppCenter',
    name: 'App Orders',
    code: 'AppTenantOrders',
    path: '/app-center/orders',
    component: '/app-center/orders',
    icon: 'ri:file-list-3-line',
    sort: 70,
    remark: 'Seeded tenant application order history',
  },
  {
    parentCode: 'AppCenter',
    name: 'Developer Revenue',
    code: 'AppDeveloperRevenue',
    path: '/app-center/developer-revenue',
    component: '/app-center/developer-revenue',
    icon: 'ri:funds-line',
    sort: 80,
    remark: 'Seeded owned developer application revenue workspace',
  },
];

const PERMISSIONS: PermissionSeed[] = [
  {
    parentCode: 'AppPlatformCommercial',
    name: 'View Commerce',
    slug: 'app:commerce:view',
    method: 'GET',
    sort: 10,
    remark: 'View application prices, orders, licenses, and revenue',
  },
  {
    parentCode: 'AppPlatformCommercial',
    name: 'Manage Commerce',
    slug: 'app:commerce:manage',
    method: 'POST',
    sort: 20,
    remark: 'Manage application prices, refunds, and license revocation',
  },
  {
    parentCode: 'AppPlatformCommercial',
    name: 'Manage Settlements',
    slug: 'app:settlement:manage',
    method: 'POST',
    sort: 30,
    remark: 'Create, review, cancel, and mark developer settlements paid',
  },
  {
    parentCode: 'AppTenantOrders',
    name: 'Purchase Apps',
    slug: 'app:tenant:purchase',
    method: 'POST',
    sort: 10,
    remark: 'Create application trials, orders, and payments',
  },
  {
    parentCode: 'AppTenantOrders',
    name: 'View App Orders',
    slug: 'app:tenant:orders',
    method: 'GET',
    sort: 20,
    remark: 'View tenant application order history',
  },
  {
    parentCode: 'AppDeveloperRevenue',
    name: 'View Owned Revenue',
    slug: 'app:developer:revenue',
    method: 'GET',
    sort: 10,
    remark: 'View owned application revenue and settlement history',
  },
];

const MENU_CODES = MENUS.map((menu) => menu.code);
const PERMISSION_SLUGS = PERMISSIONS.map((permission) => permission.slug);

export class SeedAppCommercializationMenus1760000000045 implements MigrationInterface {
  name = 'SeedAppCommercializationMenus1760000000045';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const menu of MENUS) await this.insertMenu(queryRunner, menu);
    for (const permission of PERMISSIONS) await this.insertPermission(queryRunner, permission);

    await this.grantRoleMenus(queryRunner, {
      roleWhere: "`role`.`code` IN ('admin', 'super_admin')",
      codes: ['AppPlatform', 'AppPlatformCommercial'],
      slugs: ['app:commerce:view', 'app:commerce:manage', 'app:settlement:manage'],
    });
    await this.grantRoleMenus(queryRunner, {
      roleWhere: "`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin|member)$'",
      codes: ['AppCenter', 'AppTenantOrders'],
      slugs: ['app:tenant:orders'],
    });
    await this.grantRoleMenus(queryRunner, {
      roleWhere: "`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin)$'",
      codes: ['AppCenter', 'AppMarketplace', 'AppTenantOrders'],
      slugs: ['app:tenant:purchase'],
    });
    await this.grantDeveloperWorkspaceRoles(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      [
        'DELETE `role_menu`',
        'FROM `sa_system_role_menu` `role_menu`',
        'INNER JOIN `sa_system_menu` `menu` ON `menu`.`id` = `role_menu`.`menu_id`',
        'WHERE (`menu`.`code` IN (' + MENU_CODES.map(() => '?').join(', ') + ')',
        '   OR `menu`.`slug` IN (' + PERMISSION_SLUGS.map(() => '?').join(', ') + '))',
      ].join('\n'),
      [...MENU_CODES, ...PERMISSION_SLUGS],
    );
    await queryRunner.query(
      'DELETE FROM `sa_system_menu` WHERE `slug` IN (' +
        PERMISSION_SLUGS.map(() => '?').join(', ') +
        ') AND `delete_time` IS NULL',
      PERMISSION_SLUGS,
    );
    await queryRunner.query(
      'DELETE FROM `sa_system_menu` WHERE `code` IN (' +
        MENU_CODES.map(() => '?').join(', ') +
        ') AND `delete_time` IS NULL',
      MENU_CODES,
    );
  }

  private async insertMenu(queryRunner: QueryRunner, menu: MenuSeed) {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_menu\` (
          \`parent_id\`, \`name\`, \`code\`, \`slug\`, \`type\`, \`path\`, \`component\`,
          \`icon\`, \`sort\`, \`status\`, \`is_hidden\`, \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, ?, NULL, 2, ?, ?, ?, ?, 1, 0, ?
        FROM \`sa_system_menu\` \`parent\`
        WHERE \`parent\`.\`code\` = ?
          AND \`parent\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM \`sa_system_menu\`
            WHERE \`code\` = ? AND \`delete_time\` IS NULL
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

  private async insertPermission(queryRunner: QueryRunner, permission: PermissionSeed) {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_menu\` (
          \`parent_id\`, \`name\`, \`code\`, \`slug\`, \`type\`, \`path\`, \`component\`,
          \`method\`, \`sort\`, \`status\`, \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, NULL, ?, 3, '', '', ?, ?, 1, ?
        FROM \`sa_system_menu\` \`parent\`
        WHERE \`parent\`.\`code\` = ?
          AND \`parent\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM \`sa_system_menu\`
            WHERE \`slug\` = ? AND \`delete_time\` IS NULL
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
  ) {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
        SELECT \`role\`.\`id\`, \`menu\`.\`id\`
        FROM \`sa_system_role\` \`role\`
        INNER JOIN \`sa_system_menu\` \`menu\`
          ON (\`menu\`.\`code\` IN (${input.codes.map(() => '?').join(', ')})
              OR \`menu\`.\`slug\` IN (${input.slugs.map(() => '?').join(', ')}))
         AND \`menu\`.\`delete_time\` IS NULL
        WHERE ${input.roleWhere}
          AND \`role\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM \`sa_system_role_menu\` \`existing\`
            WHERE \`existing\`.\`role_id\` = \`role\`.\`id\`
              AND \`existing\`.\`menu_id\` = \`menu\`.\`id\`
          )
      `,
      [...input.codes, ...input.slugs],
    );
  }

  private async grantDeveloperWorkspaceRoles(queryRunner: QueryRunner) {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
        SELECT \`role\`.\`id\`, \`menu\`.\`id\`
        FROM \`sa_system_role\` \`role\`
        INNER JOIN \`sa_system_role_menu\` \`developer_grant\`
          ON \`developer_grant\`.\`role_id\` = \`role\`.\`id\`
        INNER JOIN \`sa_system_menu\` \`developer_menu\`
          ON \`developer_menu\`.\`id\` = \`developer_grant\`.\`menu_id\`
         AND \`developer_menu\`.\`code\` = 'AppDeveloperApps'
         AND \`developer_menu\`.\`delete_time\` IS NULL
        INNER JOIN \`sa_system_menu\` \`menu\`
          ON (\`menu\`.\`code\` IN ('AppCenter', 'AppDeveloperRevenue')
              OR \`menu\`.\`slug\` = 'app:developer:revenue')
         AND \`menu\`.\`delete_time\` IS NULL
        WHERE \`role\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM \`sa_system_role_menu\` \`existing\`
            WHERE \`existing\`.\`role_id\` = \`role\`.\`id\`
              AND \`existing\`.\`menu_id\` = \`menu\`.\`id\`
          )
      `,
    );
  }
}
