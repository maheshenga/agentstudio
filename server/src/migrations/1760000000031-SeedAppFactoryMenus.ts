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

const FACTORY_MENU: MenuSeed = {
  parentCode: 'AppPlatform',
  name: 'Module Factory',
  code: 'AppFactory',
  path: '/app-platform/factory',
  component: '/app-platform/factory',
  icon: 'ri:tools-line',
  sort: 30,
  remark: 'Seeded app module factory menu',
};

const FACTORY_PERMISSIONS: PermissionSeed[] = [
  {
    parentCode: 'AppFactory',
    name: 'List',
    slug: 'app:factory:list',
    method: 'GET',
    sort: 10,
    remark: 'Seeded app factory list permission',
  },
  {
    parentCode: 'AppFactory',
    name: 'Create',
    slug: 'app:factory:create',
    method: 'POST',
    sort: 20,
    remark: 'Seeded app factory create permission',
  },
  {
    parentCode: 'AppFactory',
    name: 'Update',
    slug: 'app:factory:update',
    method: 'PUT',
    sort: 30,
    remark: 'Seeded app factory update permission',
  },
  {
    parentCode: 'AppFactory',
    name: 'Publish',
    slug: 'app:factory:publish',
    method: 'POST',
    sort: 40,
    remark: 'Seeded app factory publish permission',
  },
];

export class SeedAppFactoryMenus1760000000031 implements MigrationInterface {
  name = 'SeedAppFactoryMenus1760000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insertMenu(queryRunner, FACTORY_MENU);
    for (const permission of FACTORY_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }
    await this.grantExistingPlatformRoles(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE \`role_menu\`
      FROM \`sa_system_role_menu\` \`role_menu\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON \`menu\`.\`id\` = \`role_menu\`.\`menu_id\`
      WHERE \`menu\`.\`code\` = 'AppFactory'
         OR \`menu\`.\`slug\` IN (
           'app:factory:list',
           'app:factory:create',
           'app:factory:update',
           'app:factory:publish'
         )
    `);
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`slug\` IN (
        'app:factory:list',
        'app:factory:create',
        'app:factory:update',
        'app:factory:publish'
      )
        AND \`delete_time\` IS NULL
    `);
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`code\` = 'AppFactory'
        AND \`delete_time\` IS NULL
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
          \`is_hidden\`,
          \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, ?, NULL, 2, ?, ?, ?, ?, 1, ?, ?
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
        menu.isHidden ?? 0,
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

  private async grantExistingPlatformRoles(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
      SELECT \`role\`.\`id\`, \`menu\`.\`id\`
      FROM \`sa_system_role\` \`role\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON (
          \`menu\`.\`code\` = 'AppFactory'
          OR \`menu\`.\`slug\` IN (
            'app:factory:list',
            'app:factory:create',
            'app:factory:update',
            'app:factory:publish'
          )
        )
       AND \`menu\`.\`delete_time\` IS NULL
      WHERE \`role\`.\`code\` IN ('admin', 'super_admin')
        AND NOT EXISTS (
          SELECT 1
          FROM \`sa_system_role_menu\` \`existing\`
          WHERE \`existing\`.\`role_id\` = \`role\`.\`id\`
            AND \`existing\`.\`menu_id\` = \`menu\`.\`id\`
        )
    `);
  }
}
