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

const PAYMENT_CONFIG_MENU: MenuSeed = {
  name: 'Alipay Config',
  code: 'SaasPaymentConfig',
  type: 2,
  path: 'payment-config',
  component: '/saas/platform/payment-config',
  icon: 'ri:secure-payment-line',
  sort: 70,
  remark: 'Seeded SaaS Alipay config menu',
};

const PAYMENT_CONFIG_PERMISSIONS: PermissionSeed[] = [
  {
    parentCode: 'SaasPaymentConfig',
    name: 'View',
    slug: 'saas:payment-config:view',
    method: 'GET',
    sort: 10,
    remark: 'Seeded SaaS payment config view permission',
  },
  {
    parentCode: 'SaasPaymentConfig',
    name: 'Update',
    slug: 'saas:payment-config:update',
    method: 'PUT',
    sort: 20,
    remark: 'Seeded SaaS payment config update permission',
  },
];

export class AlignSaasPaymentConfigMenu1760000000010 implements MigrationInterface {
  name = 'AlignSaasPaymentConfigMenu1760000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insertChildMenu(queryRunner, 'SaasManage', PAYMENT_CONFIG_MENU);
    for (const permission of PAYMENT_CONFIG_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`slug\` IN ('saas:payment-config:view', 'saas:payment-config:update')
        AND \`delete_time\` IS NULL
    `);

    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`code\` = 'SaasPaymentConfig'
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
}
