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
    name: 'Developer Certification',
    code: 'AppDeveloperCertification',
    path: '/app-platform/developers',
    component: '/app-platform/developers',
    icon: 'ri:verified-badge-line',
    sort: 60,
    remark: 'Seeded certified developer governance workspace',
  },
  {
    parentCode: 'AppCenter',
    name: 'Service Observability',
    code: 'AppDeveloperServiceObservability',
    path: '/app-center/developer-runtime',
    component: '/app-center/developer-runtime',
    icon: 'ri:pulse-line',
    sort: 60,
    remark: 'Seeded owned developer service observability workspace',
  },
];

const PERMISSIONS: PermissionSeed[] = [
  {
    parentCode: 'AppDeveloperCertification',
    name: 'List Certifications',
    slug: 'app:developer-certification:list',
    method: 'GET',
    sort: 10,
    remark: 'List developer certification profiles',
  },
  {
    parentCode: 'AppDeveloperCertification',
    name: 'Manage Certifications',
    slug: 'app:developer-certification:manage',
    method: 'POST',
    sort: 20,
    remark: 'Approve, reject, enable, or disable developer certification',
  },
  {
    parentCode: 'AppDeveloperServiceObservability',
    name: 'Read Owned Service Observability',
    slug: 'app:developer:observability',
    method: 'GET',
    sort: 10,
    remark: 'Read owned developer service health, metrics, and redacted logs',
  },
];

const MENU_CODES = MENUS.map((menu) => menu.code);
const PERMISSION_SLUGS = PERMISSIONS.map((permission) => permission.slug);
const DEVELOPER_PERMISSION_SLUGS = [
  'app:developer:list',
  'app:developer:read',
  'app:developer:create',
  'app:developer:update',
  'app:developer:upload',
  'app:developer:submit',
];

export class SeedCertifiedDeveloperServiceMenus1760000000043
  implements MigrationInterface
{
  name = 'SeedCertifiedDeveloperServiceMenus1760000000043';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const menu of MENUS) await this.insertMenu(queryRunner, menu);
    for (const permission of PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }

    await this.grantRoleMenus(queryRunner, {
      roleWhere: "`role`.`code` IN ('admin', 'super_admin')",
      codes: ['AppPlatform', 'AppDeveloperCertification'],
      slugs: ['app:developer-certification:list', 'app:developer-certification:manage'],
    });
    await this.grantRoleMenus(queryRunner, {
      roleWhere: "`role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin|member)$'",
      codes: ['AppCenter', 'AppDeveloperApps', 'AppDeveloperServiceObservability'],
      slugs: [...DEVELOPER_PERMISSION_SLUGS, 'app:developer:observability'],
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tenantCodes = ['AppDeveloperApps', 'AppDeveloperServiceObservability'];
    const tenantSlugs = [...DEVELOPER_PERMISSION_SLUGS, 'app:developer:observability'];
    await queryRunner.query(
      [
        'DELETE `role_menu`',
        'FROM `sa_system_role_menu` `role_menu`',
        'INNER JOIN `sa_system_role` `role` ON `role`.`id` = `role_menu`.`role_id`',
        'INNER JOIN `sa_system_menu` `menu` ON `menu`.`id` = `role_menu`.`menu_id`',
        "WHERE `role`.`code` REGEXP '^tenant:[0-9]+:(owner|admin|member)$'",
        '  AND (',
        '    `menu`.`code` IN (' + tenantCodes.map(() => '?').join(', ') + ')',
        '    OR `menu`.`slug` IN (' + tenantSlugs.map(() => '?').join(', ') + ')',
        '  )',
      ].join('\n'),
      [...tenantCodes, ...tenantSlugs],
    );

    await queryRunner.query(
      [
        'DELETE `role_menu`',
        'FROM `sa_system_role_menu` `role_menu`',
        'INNER JOIN `sa_system_menu` `menu` ON `menu`.`id` = `role_menu`.`menu_id`',
        'WHERE `menu`.`code` IN (' + MENU_CODES.map(() => '?').join(', ') + ')',
        '   OR `menu`.`slug` IN (' + PERMISSION_SLUGS.map(() => '?').join(', ') + ')',
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
          ON (
            \`menu\`.\`code\` IN (${input.codes.map(() => '?').join(', ')})
            OR \`menu\`.\`slug\` IN (${input.slugs.map(() => '?').join(', ')})
          )
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
}
