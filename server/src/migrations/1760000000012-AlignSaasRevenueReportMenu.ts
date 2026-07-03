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

const REVENUE_REPORT_MENU: MenuSeed = {
  name: 'Revenue Report',
  code: 'SaasRevenueReport',
  type: 2,
  path: 'revenue',
  component: '/saas/platform/revenue',
  icon: 'ri:line-chart-line',
  sort: 75,
  remark: 'Seeded SaaS revenue report menu',
};

const REVENUE_REPORT_PERMISSIONS: PermissionSeed[] = [
  {
    parentCode: 'SaasRevenueReport',
    name: 'View',
    slug: 'saas:revenue:index',
    method: 'GET',
    sort: 10,
    remark: 'Seeded SaaS revenue report view permission',
  },
];

export class AlignSaasRevenueReportMenu1760000000012 implements MigrationInterface {
  name = 'AlignSaasRevenueReportMenu1760000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insertChildMenu(queryRunner, 'SaasManage', REVENUE_REPORT_MENU);
    for (const permission of REVENUE_REPORT_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`slug\` IN ('saas:revenue:index')
        AND \`delete_time\` IS NULL
    `);

    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`code\` = 'SaasRevenueReport'
        AND \`delete_time\` IS NULL
    `);
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
