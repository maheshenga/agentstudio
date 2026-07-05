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

const RESOURCE_PACK_ORDER_MENU: MenuSeed = {
  name: '资源包订单',
  code: 'SaasResourcePackOrder',
  type: 2,
  path: 'resource-pack-orders',
  component: '/saas/platform/resource-pack-order',
  icon: 'ri:file-list-3-line',
  sort: 60,
  remark: 'Seeded SaaS resource pack order menu',
};

const RESOURCE_PACK_ORDER_PERMISSION: PermissionSeed = {
  parentCode: 'SaasResourcePackOrder',
  name: 'List',
  slug: 'saas:resource-pack-order:list',
  method: 'GET',
  sort: 10,
  remark: 'Seeded SaaS resource pack order list permission',
};

export class AlignSaasResourcePackOrderMenu1760000000007 implements MigrationInterface {
  name = 'AlignSaasResourcePackOrderMenu1760000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insertChildMenu(queryRunner, 'SaasManage', RESOURCE_PACK_ORDER_MENU);
    await this.insertPermission(queryRunner, RESOURCE_PACK_ORDER_PERMISSION);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`slug\` = 'saas:resource-pack-order:list'
        AND \`delete_time\` IS NULL
    `);

    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`code\` = 'SaasResourcePackOrder'
        AND \`delete_time\` IS NULL
    `);
  }

  private async insertChildMenu(
    queryRunner: QueryRunner,
    parentCode: string,
    menu: MenuSeed,
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
      [
        menu.name,
        menu.code,
        menu.type,
        menu.path,
        menu.component,
        menu.icon,
        menu.sort,
        menu.remark,
        parentCode,
        menu.code,
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
}
