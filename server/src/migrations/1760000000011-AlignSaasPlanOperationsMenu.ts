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
};

type PermissionSeed = {
  parentCode: string;
  name: string;
  slug: string;
  method: string;
  sort: number;
  remark: string;
};

const PLAN_MENU: MenuSeed = {
  name: 'Plan Management',
  code: 'SaasPlan',
  type: 2,
  path: 'plans',
  component: '/saas/platform/plan',
  icon: 'ri:price-tag-3-line',
  sort: 20,
  remark: 'Aligned SaaS plan management menu',
};

const PLAN_PERMISSIONS: PermissionSeed[] = [
  { parentCode: 'SaasPlan', name: 'Create', slug: 'saas:plan:create', method: 'POST', sort: 20, remark: 'SaaS plan create permission' },
  { parentCode: 'SaasPlan', name: 'Update', slug: 'saas:plan:update', method: 'PUT', sort: 30, remark: 'SaaS plan update permission' },
  { parentCode: 'SaasPlan', name: 'Status', slug: 'saas:plan:status', method: 'PUT', sort: 40, remark: 'SaaS plan status permission' },
  { parentCode: 'SaasPlan', name: 'Quota update', slug: 'saas:plan:quota:update', method: 'PUT', sort: 50, remark: 'SaaS plan quota update permission' },
];

export class AlignSaasPlanOperationsMenu1760000000011 implements MigrationInterface {
  name = 'AlignSaasPlanOperationsMenu1760000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.alignChildMenu(queryRunner, 'SaasManage', PLAN_MENU);
    for (const permission of PLAN_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`slug\` IN ('saas:plan:create', 'saas:plan:status', 'saas:plan:quota:update')
        AND \`delete_time\` IS NULL
    `);
  }

  private async alignChildMenu(queryRunner: QueryRunner, parentCode: string, menu: MenuSeed): Promise<void> {
    await queryRunner.query(
      `
        UPDATE \`sa_system_menu\`
        SET \`path\` = ?,
            \`component\` = ?,
            \`icon\` = ?,
            \`sort\` = ?,
            \`remark\` = ?,
            \`delete_time\` = NULL
        WHERE \`code\` = ?
      `,
      [menu.path, menu.component, menu.icon, menu.sort, menu.remark, menu.code],
    );

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
        SELECT \`parent\`.\`id\`, ?, ?, NULL, ?, ?, ?, ?, ?, 1, ?
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
      [menu.name, menu.code, menu.type, menu.path, menu.component, menu.icon, menu.sort, menu.remark, parentCode, menu.code],
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
}