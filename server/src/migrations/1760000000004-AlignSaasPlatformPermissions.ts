import { MigrationInterface, QueryRunner } from 'typeorm';

type PermissionSeed = {
  parentCode: string;
  name: string;
  slug: string;
  method: string;
  sort: number;
  remark: string;
};

const ORDER_LIST_PERMISSION: PermissionSeed = {
  parentCode: 'SaasSubscription',
  name: 'Order list',
  slug: 'saas:order:list',
  method: 'GET',
  sort: 20,
  remark: 'Seeded SaaS order list permission',
};

export class AlignSaasPlatformPermissions1760000000004 implements MigrationInterface {
  name = 'AlignSaasPlatformPermissions1760000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE \`sa_system_menu\`
        SET \`slug\` = ?,
            \`remark\` = 'Seeded SaaS subscription list permission',
            \`delete_time\` = NULL
        WHERE \`slug\` = 'saas:subscription:index'
          AND \`delete_time\` IS NULL
      `,
      ['saas:subscription:list'],
    );

    await this.insertPermission(queryRunner, ORDER_LIST_PERMISSION);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`slug\` = 'saas:order:list'
        AND \`delete_time\` IS NULL
    `);

    await queryRunner.query(
      `
        UPDATE \`sa_system_menu\`
        SET \`slug\` = ?
        WHERE \`slug\` = 'saas:subscription:list'
          AND \`delete_time\` IS NULL
      `,
      ['saas:subscription:index'],
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
