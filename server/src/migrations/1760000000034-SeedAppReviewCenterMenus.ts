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

const REVIEW_CENTER_MENU: MenuSeed = {
  parentCode: 'AppPlatform',
  name: 'Review Center',
  code: 'AppReviewCenter',
  path: '/app-platform/reviews',
  component: '/app-platform/reviews',
  icon: 'ri:shield-check-line',
  sort: 20,
  remark: 'Seeded app review operations center menu',
};

export class SeedAppReviewCenterMenus1760000000034 implements MigrationInterface {
  name = 'SeedAppReviewCenterMenus1760000000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insertMenu(queryRunner, REVIEW_CENTER_MENU);
    await this.insertReviewPermissionWhenMissing(queryRunner);
    await this.grantExistingPlatformRoles(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE \`role_menu\`
      FROM \`sa_system_role_menu\` \`role_menu\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON \`menu\`.\`id\` = \`role_menu\`.\`menu_id\`
      WHERE \`menu\`.\`code\` = 'AppReviewCenter'
    `);
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`code\` = 'AppReviewCenter'
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
        SELECT \`parent\`.\`id\`, ?, ?, NULL, 2, ?, ?, ?, ?, 1, 0, ?
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
        menu.remark,
        menu.parentCode,
        menu.code,
      ],
    );
  }

  private async insertReviewPermissionWhenMissing(queryRunner: QueryRunner): Promise<void> {
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
        SELECT \`parent\`.\`id\`, ?, NULL, ?, 3, '', '', 'POST', 10, 1, ?
        FROM \`sa_system_menu\` \`parent\`
        WHERE \`parent\`.\`code\` = 'AppReviewCenter'
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
      ['Review', 'app:platform:review', 'App platform review permission', 'app:platform:review'],
    );
  }

  private async grantExistingPlatformRoles(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
      SELECT \`role\`.\`id\`, \`menu\`.\`id\`
      FROM \`sa_system_role\` \`role\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON (
          \`menu\`.\`code\` = 'AppReviewCenter'
          OR \`menu\`.\`slug\` = 'app:platform:review'
        )
       AND \`menu\`.\`delete_time\` IS NULL
      WHERE \`role\`.\`code\` IN ('admin', 'super_admin')
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
