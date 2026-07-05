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

const PLATFORM_MENU: MenuSeed = {
  parentCode: 'System',
  name: 'System Modules',
  code: 'SystemModules',
  path: 'modules',
  component: '/system/modules/index',
  icon: 'ri:apps-2-line',
  sort: 90,
  remark: 'Seeded system module menu',
};

const PLATFORM_DETAIL_MENU: MenuSeed = {
  parentCode: 'SystemModules',
  name: 'System Module Detail',
  code: 'SystemModuleDetail',
  path: 'detail',
  component: '/system/modules/detail',
  icon: '',
  sort: 91,
  remark: 'Seeded system module detail menu',
  isHidden: 1,
};

const TENANT_MENU: MenuSeed = {
  parentCode: 'TenantSaas',
  name: 'Tenant Modules',
  code: 'TenantSystemModules',
  path: 'modules',
  component: '/saas/tenant/modules/index',
  icon: 'ri:apps-line',
  sort: 50,
  remark: 'Seeded tenant system module menu',
};

const PLATFORM_PERMISSIONS: PermissionSeed[] = [
  { parentCode: 'SystemModules', name: 'List', slug: 'system:module:list', method: 'GET', sort: 10, remark: 'Seeded system module permission' },
  { parentCode: 'SystemModules', name: 'Read', slug: 'system:module:read', method: 'GET', sort: 20, remark: 'Seeded system module permission' },
  { parentCode: 'SystemModules', name: 'Install', slug: 'system:module:install', method: 'POST', sort: 30, remark: 'Seeded system module permission' },
  { parentCode: 'SystemModules', name: 'Update', slug: 'system:module:update', method: 'PUT', sort: 40, remark: 'Seeded system module permission' },
  { parentCode: 'SystemModules', name: 'Status', slug: 'system:module:status', method: 'PUT', sort: 50, remark: 'Seeded system module permission' },
  { parentCode: 'SystemModules', name: 'Config', slug: 'system:module:config', method: 'PUT', sort: 60, remark: 'Seeded system module permission' },
  { parentCode: 'SystemModules', name: 'Tenant', slug: 'system:module:tenant', method: 'PUT', sort: 70, remark: 'Seeded system module permission' },
  { parentCode: 'SystemModules', name: 'Event', slug: 'system:module:event', method: 'GET', sort: 80, remark: 'Seeded system module permission' },
];

const TENANT_PERMISSIONS: PermissionSeed[] = [
  { parentCode: 'TenantSystemModules', name: 'List', slug: 'tenant:module:list', method: 'GET', sort: 10, remark: 'Seeded tenant system module permission' },
  { parentCode: 'TenantSystemModules', name: 'Config', slug: 'tenant:module:config', method: 'PUT', sort: 20, remark: 'Seeded tenant system module permission' },
  { parentCode: 'TenantSystemModules', name: 'Status', slug: 'tenant:module:status', method: 'PUT', sort: 30, remark: 'Seeded tenant system module permission' },
];

export class SeedSystemModules1760000000021 implements MigrationInterface {
  name = 'SeedSystemModules1760000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insertMenu(queryRunner, PLATFORM_MENU);
    await this.insertMenu(queryRunner, PLATFORM_DETAIL_MENU);
    await this.insertMenu(queryRunner, TENANT_MENU);

    for (const permission of [...PLATFORM_PERMISSIONS, ...TENANT_PERMISSIONS]) {
      await this.insertPermission(queryRunner, permission);
    }

    await this.grantAdminRole(queryRunner);
    await this.grantDetailRouteToSystemModuleRoles(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE \`role_menu\`
      FROM \`sa_system_role_menu\` \`role_menu\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON \`menu\`.\`id\` = \`role_menu\`.\`menu_id\`
      WHERE \`menu\`.\`remark\` IN (
        'Seeded system module menu',
        'Seeded system module detail menu',
        'Seeded system module permission',
        'Seeded tenant system module menu',
        'Seeded tenant system module permission'
      )
    `);
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`remark\` IN (
        'Seeded system module permission',
        'Seeded tenant system module permission'
      )
    `);
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`remark\` IN (
        'Seeded system module menu',
        'Seeded system module detail menu',
        'Seeded tenant system module menu'
      )
    `);
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
          \`is_hidden\`,
          \`sort\`,
          \`status\`,
          \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, ?, NULL, 2, ?, ?, ?, ?, ?, 1, ?
        FROM \`sa_system_menu\` \`parent\`
        WHERE \`parent\`.\`code\` = ?
          ${menu.parentCode === 'System' ? "AND `parent`.`path` = '/system'\n          AND `parent`.`type` = 1" : ''}
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
        menu.isHidden ?? 2,
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
      [permission.name, permission.slug, permission.method, permission.sort, permission.remark, permission.parentCode, permission.slug],
    );
  }

  private async grantAdminRole(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
      SELECT \`role\`.\`id\`, \`menu\`.\`id\`
      FROM \`sa_system_role\` \`role\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON (
          \`menu\`.\`code\` IN ('SystemModules', 'SystemModuleDetail', 'TenantSystemModules')
          OR \`menu\`.\`slug\` IN (
            'system:module:list',
            'system:module:read',
            'system:module:install',
            'system:module:update',
            'system:module:status',
            'system:module:config',
            'system:module:tenant',
            'system:module:event',
            'tenant:module:list',
            'tenant:module:config',
            'tenant:module:status'
          )
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
    `);
  }

  private async grantDetailRouteToSystemModuleRoles(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
      SELECT \`source_role_menu\`.\`role_id\`, \`detail_menu\`.\`id\`
      FROM \`sa_system_role_menu\` \`source_role_menu\`
      INNER JOIN \`sa_system_menu\` \`source_menu\`
        ON \`source_menu\`.\`id\` = \`source_role_menu\`.\`menu_id\`
        AND \`source_menu\`.\`code\` = 'SystemModules'
        AND \`source_menu\`.\`delete_time\` IS NULL
      INNER JOIN \`sa_system_menu\` \`detail_menu\`
        ON \`detail_menu\`.\`code\` = 'SystemModuleDetail'
        AND \`detail_menu\`.\`delete_time\` IS NULL
      WHERE NOT EXISTS (
        SELECT 1
        FROM \`sa_system_role_menu\` \`existing\`
        WHERE \`existing\`.\`role_id\` = \`source_role_menu\`.\`role_id\`
          AND \`existing\`.\`menu_id\` = \`detail_menu\`.\`id\`
      )
    `);
  }
}
