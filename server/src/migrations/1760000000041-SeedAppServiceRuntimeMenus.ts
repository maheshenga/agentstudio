import { MigrationInterface, QueryRunner } from 'typeorm';

type PermissionSeed = {
  name: string;
  slug: string;
  method: string;
  sort: number;
  remark: string;
};

const RUNTIME_MENU = {
  parentCode: 'AppPlatform',
  name: 'Service Runtime',
  code: 'AppServiceRuntime',
  path: '/app-platform/runtime',
  component: '/app-platform/runtime',
  icon: 'ri:server-line',
  sort: 50,
  remark: 'Seeded administrator service runtime console',
};

const RUNTIME_PERMISSIONS: PermissionSeed[] = [
  {
    name: 'List Runtime Instances',
    slug: 'app:runtime:list',
    method: 'GET',
    sort: 10,
    remark: 'List administrator service runtime state',
  },
  {
    name: 'Manage Runtime Instances',
    slug: 'app:runtime:manage',
    method: 'POST',
    sort: 20,
    remark: 'Manage administrator service lifecycle',
  },
  {
    name: 'Probe Runtime Instances',
    slug: 'app:runtime:probe',
    method: 'POST',
    sort: 30,
    remark: 'Probe active administrator services',
  },
  {
    name: 'Read Runtime Logs',
    slug: 'app:runtime:logs',
    method: 'GET',
    sort: 40,
    remark: 'Read bounded redacted administrator service logs',
  },
];

const RUNTIME_MENU_CODES = [RUNTIME_MENU.code];
const RUNTIME_PERMISSION_SLUGS = RUNTIME_PERMISSIONS.map((permission) => permission.slug);

export class SeedAppServiceRuntimeMenus1760000000041 implements MigrationInterface {
  name = 'SeedAppServiceRuntimeMenus1760000000041';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insertMenu(queryRunner);
    for (const permission of RUNTIME_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }
    await this.grantPlatformRoles(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DELETE \`role_menu\`
        FROM \`sa_system_role_menu\` \`role_menu\`
        INNER JOIN \`sa_system_menu\` \`menu\`
          ON \`menu\`.\`id\` = \`role_menu\`.\`menu_id\`
        WHERE \`menu\`.\`code\` IN (${RUNTIME_MENU_CODES.map(() => '?').join(', ')})
           OR \`menu\`.\`slug\` IN (${RUNTIME_PERMISSION_SLUGS.map(() => '?').join(', ')})
      `,
      [...RUNTIME_MENU_CODES, ...RUNTIME_PERMISSION_SLUGS],
    );
    await queryRunner.query(
      `
        DELETE FROM \`sa_system_menu\`
        WHERE \`slug\` IN (${RUNTIME_PERMISSION_SLUGS.map(() => '?').join(', ')})
          AND \`delete_time\` IS NULL
      `,
      RUNTIME_PERMISSION_SLUGS,
    );
    await queryRunner.query(
      `
        DELETE FROM \`sa_system_menu\`
        WHERE \`code\` IN (${RUNTIME_MENU_CODES.map(() => '?').join(', ')})
          AND \`delete_time\` IS NULL
      `,
      RUNTIME_MENU_CODES,
    );
  }

  private async insertMenu(queryRunner: QueryRunner): Promise<void> {
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
        RUNTIME_MENU.name,
        RUNTIME_MENU.code,
        RUNTIME_MENU.path,
        RUNTIME_MENU.component,
        RUNTIME_MENU.icon,
        RUNTIME_MENU.sort,
        RUNTIME_MENU.remark,
        RUNTIME_MENU.parentCode,
        RUNTIME_MENU.code,
      ],
    );
  }

  private async insertPermission(
    queryRunner: QueryRunner,
    permission: PermissionSeed,
  ): Promise<void> {
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
        RUNTIME_MENU.code,
        permission.slug,
      ],
    );
  }

  private async grantPlatformRoles(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
        SELECT \`role\`.\`id\`, \`menu\`.\`id\`
        FROM \`sa_system_role\` \`role\`
        INNER JOIN \`sa_system_menu\` \`menu\`
          ON (
            \`menu\`.\`code\` IN (${RUNTIME_MENU_CODES.map(() => '?').join(', ')})
            OR \`menu\`.\`slug\` IN (${RUNTIME_PERMISSION_SLUGS.map(() => '?').join(', ')})
          )
         AND \`menu\`.\`delete_time\` IS NULL
        WHERE \`role\`.\`code\` IN ('admin', 'super_admin')
          AND \`role\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM \`sa_system_role_menu\` \`existing\`
            WHERE \`existing\`.\`role_id\` = \`role\`.\`id\`
              AND \`existing\`.\`menu_id\` = \`menu\`.\`id\`
          )
      `,
      [...RUNTIME_MENU_CODES, ...RUNTIME_PERMISSION_SLUGS],
    );
  }
}
