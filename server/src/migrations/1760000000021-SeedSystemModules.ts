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

const PLATFORM_MENU: MenuSeed = {
  parentCode: 'SystemManage',
  name: 'System Modules',
  code: 'SystemModules',
  path: 'modules',
  component: '/system/modules/index',
  icon: 'ri:apps-2-line',
  sort: 90,
  remark: 'Seeded system module menu',
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
    await this.insertMenu(queryRunner, TENANT_MENU);

    for (const permission of [...PLATFORM_PERMISSIONS, ...TENANT_PERMISSIONS]) {
      await this.insertPermission(queryRunner, permission);
    }

    await this.grantAdminRole(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE \`role_menu\`
      FROM \`sa_system_role_menu\` \`role_menu\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON \`menu\`.\`id\` = \`role_menu\`.\`menu_id\`
      WHERE \`menu\`.\`remark\` IN (
        'Seeded system module menu',
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
          \`sort\`,
          \`status\`,
          \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, ?, NULL, 2, ?, ?, ?, ?, 1, ?
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
      [menu.name, menu.code, menu.path, menu.component, menu.icon, menu.sort, menu.remark, menu.parentCode, menu.code],
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
          \`menu\`.\`code\` IN ('SystemModules', 'TenantSystemModules')
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
      WHERE \`role\`.\`code\` = 'admin'
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
