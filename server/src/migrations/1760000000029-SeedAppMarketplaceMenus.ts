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
  isHidden?: number;
};

type PermissionSeed = {
  parentCode: string;
  name: string;
  slug: string;
  method: string;
  sort: number;
  remark: string;
};

const PLATFORM_ROOT_MENU: MenuSeed = {
  name: 'App Platform',
  code: 'AppPlatform',
  type: 1,
  path: '/app-platform',
  component: '',
  icon: 'ri:apps-line',
  sort: 92,
  remark: 'Seeded app platform root menu',
};

const PLATFORM_APP_MENU: MenuSeed = {
  name: 'Apps',
  code: 'AppPlatformApps',
  type: 2,
  path: 'apps',
  component: '/app-platform/apps',
  icon: 'ri:apps-line',
  sort: 10,
  remark: 'Seeded app platform app management menu',
};

const APP_CENTER_ROOT_MENU: MenuSeed = {
  name: 'App Center',
  code: 'AppCenter',
  type: 1,
  path: '/app-center',
  component: '',
  icon: 'ri:store-2-line',
  sort: 96,
  remark: 'Seeded app center root menu',
};

const APP_CENTER_MENUS: MenuSeed[] = [
  {
    name: 'Marketplace',
    code: 'AppMarketplace',
    type: 2,
    path: 'marketplace',
    component: '/app-center/marketplace',
    icon: 'ri:store-2-line',
    sort: 10,
    remark: 'Seeded tenant app marketplace menu',
  },
  {
    name: 'Installed Apps',
    code: 'AppInstalledApps',
    type: 2,
    path: 'installed',
    component: '/app-center/installed',
    icon: 'ri:checkbox-multiple-line',
    sort: 20,
    remark: 'Seeded tenant installed apps menu',
  },
  {
    name: 'Open App',
    code: 'AppOpenRunner',
    type: 2,
    path: 'open',
    component: '/app-center/open',
    icon: 'ri:external-link-line',
    sort: 30,
    remark: 'Seeded hidden tenant app runner menu',
    isHidden: 1,
  },
];

const PLATFORM_PERMISSIONS: PermissionSeed[] = [
  { parentCode: 'AppPlatformApps', name: 'List', slug: 'app:platform:list', method: 'GET', sort: 10, remark: 'App platform list permission' },
  { parentCode: 'AppPlatformApps', name: 'Read', slug: 'app:platform:read', method: 'GET', sort: 20, remark: 'App platform read permission' },
  { parentCode: 'AppPlatformApps', name: 'Create', slug: 'app:platform:create', method: 'POST', sort: 30, remark: 'App platform create permission' },
  { parentCode: 'AppPlatformApps', name: 'Update', slug: 'app:platform:update', method: 'PUT', sort: 40, remark: 'App platform update permission' },
  { parentCode: 'AppPlatformApps', name: 'Upload', slug: 'app:platform:upload', method: 'POST', sort: 50, remark: 'App platform upload permission' },
  { parentCode: 'AppPlatformApps', name: 'Review', slug: 'app:platform:review', method: 'POST', sort: 60, remark: 'App platform review permission' },
  { parentCode: 'AppPlatformApps', name: 'Publish', slug: 'app:platform:publish', method: 'POST', sort: 70, remark: 'App platform publish permission' },
  { parentCode: 'AppPlatformApps', name: 'Status', slug: 'app:platform:status', method: 'PUT', sort: 80, remark: 'App platform status permission' },
];

const TENANT_PERMISSIONS: PermissionSeed[] = [
  { parentCode: 'AppMarketplace', name: 'Marketplace', slug: 'app:tenant:marketplace', method: 'GET', sort: 10, remark: 'Tenant app marketplace permission' },
  { parentCode: 'AppMarketplace', name: 'Install', slug: 'app:tenant:install', method: 'POST', sort: 20, remark: 'Tenant app install permission' },
  { parentCode: 'AppOpenRunner', name: 'Open', slug: 'app:tenant:open', method: 'GET', sort: 10, remark: 'Tenant app open permission' },
];

const PLATFORM_MENU_CODES = ['AppPlatform', 'AppPlatformApps'];
const TENANT_MENU_CODES = ['AppCenter', 'AppMarketplace', 'AppInstalledApps', 'AppOpenRunner'];
const PLATFORM_PERMISSION_SLUGS = PLATFORM_PERMISSIONS.map((permission) => permission.slug);
const TENANT_PERMISSION_SLUGS = TENANT_PERMISSIONS.map((permission) => permission.slug);

export class SeedAppMarketplaceMenus1760000000029 implements MigrationInterface {
  name = 'SeedAppMarketplaceMenus1760000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insertRootMenu(queryRunner, PLATFORM_ROOT_MENU);
    await this.insertChildMenu(queryRunner, 'AppPlatform', PLATFORM_APP_MENU);
    for (const permission of PLATFORM_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }

    await this.insertRootMenu(queryRunner, APP_CENTER_ROOT_MENU);
    for (const menu of APP_CENTER_MENUS) {
      await this.insertChildMenu(queryRunner, 'AppCenter', menu);
    }
    for (const permission of TENANT_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }

    await this.grantPlatformAdminRoles(queryRunner);
    await this.grantTenantOwnerAdminRoles(queryRunner);
    await this.grantTenantMemberRoles(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const allSlugs = [...PLATFORM_PERMISSION_SLUGS, ...TENANT_PERMISSION_SLUGS];
    const allCodes = [...PLATFORM_MENU_CODES, ...TENANT_MENU_CODES];

    await queryRunner.query(`
      DELETE \`role_menu\`
      FROM \`sa_system_role_menu\` \`role_menu\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON \`menu\`.\`id\` = \`role_menu\`.\`menu_id\`
        AND (
          \`menu\`.\`code\` IN (${allCodes.map(() => '?').join(', ')})
          OR \`menu\`.\`slug\` IN (${allSlugs.map(() => '?').join(', ')})
        )
        AND \`menu\`.\`delete_time\` IS NULL
    `, [...allCodes, ...allSlugs]);

    await queryRunner.query(
      `
        DELETE FROM \`sa_system_menu\`
        WHERE \`slug\` IN (${allSlugs.map(() => '?').join(', ')})
          AND \`delete_time\` IS NULL
      `,
      allSlugs,
    );

    await queryRunner.query(
      `
        DELETE FROM \`sa_system_menu\`
        WHERE \`code\` IN (${allCodes.map(() => '?').join(', ')})
          AND \`delete_time\` IS NULL
      `,
      allCodes,
    );
  }

  private async insertRootMenu(queryRunner: QueryRunner, menu: MenuSeed): Promise<void> {
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
          \`is_hidden\`,
          \`sort\`,
          \`status\`,
          \`remark\`
        )
        SELECT 0, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 1, ?
        WHERE NOT EXISTS (
          SELECT 1
          FROM \`sa_system_menu\`
          WHERE \`code\` = ?
            AND \`delete_time\` IS NULL
        )
      `,
      [menu.name, menu.code, menu.type, menu.path, menu.component, menu.icon, menu.isHidden ?? 2, menu.sort, menu.remark, menu.code],
    );
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
          \`is_hidden\`,
          \`sort\`,
          \`status\`,
          \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 1, ?
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
        menu.type,
        menu.path,
        menu.component,
        menu.icon,
        menu.isHidden ?? 2,
        menu.sort,
        menu.remark,
        parentCode,
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
      [permission.name, permission.slug, permission.method, permission.sort, permission.remark, permission.parentCode, permission.slug],
    );
  }

  private async grantPlatformAdminRoles(queryRunner: QueryRunner): Promise<void> {
    await this.grantRoleMenus(queryRunner, {
      roleWhere: "`role`.`code` IN ('admin', 'super_admin')",
      codes: PLATFORM_MENU_CODES,
      slugs: PLATFORM_PERMISSION_SLUGS,
    });
  }

  private async grantTenantOwnerAdminRoles(queryRunner: QueryRunner): Promise<void> {
    await this.grantRoleMenus(queryRunner, {
      roleWhere: "`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin)$'",
      codes: TENANT_MENU_CODES,
      slugs: TENANT_PERMISSION_SLUGS,
    });
  }

  private async grantTenantMemberRoles(queryRunner: QueryRunner): Promise<void> {
    await this.grantRoleMenus(queryRunner, {
      roleWhere: "`role`.`code` REGEXP '^tenant:[0-9]+:member$'",
      codes: TENANT_MENU_CODES,
      slugs: ['app:tenant:marketplace', 'app:tenant:open'],
    });
  }

  private async grantRoleMenus(
    queryRunner: QueryRunner,
    input: {
      roleWhere: string;
      codes: string[];
      slugs: string[];
    },
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
