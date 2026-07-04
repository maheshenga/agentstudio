import { MigrationInterface, QueryRunner } from 'typeorm';

type ModuleSeed = readonly [
  code: string,
  name: string,
  category: string,
  icon: string,
  routePath: string,
  sort: number,
];
type PermissionSeed = readonly [name: string, slug: string, method: string, sort: number];

const MODULES: ModuleSeed[] = [
  ['ai_chat', 'AI Chat', 'AI', 'ri:chat-ai-line', '/dashboard/taixu', 10],
  ['rag', 'Knowledge Base', 'AI', 'ri:database-2-line', '/dashboard/taixu', 20],
  ['member_management', 'Member Management', 'Tenant', 'ri:team-line', '/tenant-saas/members', 30],
  ['resource_pack', 'Resource Pack', 'Billing', 'ri:box-3-line', '/tenant-saas/resource-packs', 40],
  [
    'advanced_report',
    'Advanced Report',
    'Report',
    'ri:bar-chart-line',
    '/saas-platform/revenue',
    50,
  ],
];

const PERMISSIONS: PermissionSeed[] = [
  ['List', 'saas:module:list', 'GET', 10],
  ['Save', 'saas:module:save', 'POST', 20],
  ['Update', 'saas:module:update', 'PUT', 30],
  ['Status', 'saas:module:status', 'PUT', 40],
  ['Plan module update', 'saas:plan:module:update', 'PUT', 50],
];

export class SeedSaasModules1760000000017 implements MigrationInterface {
  name = 'SeedSaasModules1760000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const module of MODULES) {
      await this.insertModule(queryRunner, module);
    }

    await this.insertModuleMenu(queryRunner);
    for (const permission of PERMISSIONS) {
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
      WHERE (
          \`menu\`.\`code\` = 'SaasModule'
          AND \`menu\`.\`remark\` = 'Seeded SaaS module menu'
        )
        OR (
          \`menu\`.\`slug\` IN (
            'saas:module:list',
            'saas:module:save',
            'saas:module:update',
            'saas:module:status',
            'saas:plan:module:update'
          )
          AND \`menu\`.\`remark\` = 'Seeded SaaS module permission'
        )
    `);
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`slug\` IN (
        'saas:module:list',
        'saas:module:save',
        'saas:module:update',
        'saas:module:status',
        'saas:plan:module:update'
      )
      AND \`remark\` = 'Seeded SaaS module permission'
    `);
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`code\` = 'SaasModule'
        AND \`remark\` = 'Seeded SaaS module menu'
    `);
    await queryRunner.query(`
      DELETE FROM \`saas_module\`
      WHERE \`code\` IN ('ai_chat', 'rag', 'member_management', 'resource_pack', 'advanced_report')
        AND \`remark\` = 'Seeded SaaS module'
    `);
  }

  private async insertModule(queryRunner: QueryRunner, module: ModuleSeed): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`saas_module\` (
          \`code\`,
          \`name\`,
          \`description\`,
          \`category\`,
          \`icon\`,
          \`route_path\`,
          \`status\`,
          \`sort\`,
          \`remark\`
        )
        VALUES (?, ?, '', ?, ?, ?, 1, ?, 'Seeded SaaS module')
        ON DUPLICATE KEY UPDATE \`delete_time\` = NULL
      `,
      [module[0], module[1], module[2], module[3], module[4], module[5]],
    );
  }

  private async insertModuleMenu(queryRunner: QueryRunner): Promise<void> {
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
        SELECT \`parent\`.\`id\`, ?, ?, NULL, 2, ?, ?, ?, 80, 1, ?
        FROM \`sa_system_menu\` \`parent\`
        WHERE \`parent\`.\`code\` = 'SaasManage'
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
        'Modules',
        'SaasModule',
        'module',
        '/saas/platform/module',
        'ri:apps-2-line',
        'Seeded SaaS module menu',
        'SaasModule',
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
        SELECT \`parent\`.\`id\`, ?, NULL, ?, 3, '', '', ?, ?, 1, 'Seeded SaaS module permission'
        FROM \`sa_system_menu\` \`parent\`
        WHERE \`parent\`.\`code\` = 'SaasModule'
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
      [permission[0], permission[1], permission[2], permission[3], permission[1]],
    );
  }

  private async grantExistingPlatformRoles(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
      SELECT \`role\`.\`id\`, \`menu\`.\`id\`
      FROM \`sa_system_role\` \`role\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON (
          \`menu\`.\`code\` = 'SaasModule'
          OR \`menu\`.\`slug\` IN (
            'saas:module:list',
            'saas:module:save',
            'saas:module:update',
            'saas:module:status',
            'saas:plan:module:update'
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
