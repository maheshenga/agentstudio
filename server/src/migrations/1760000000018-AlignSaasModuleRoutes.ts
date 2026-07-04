import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignSaasModuleRoutes1760000000018 implements MigrationInterface {
  name = 'AlignSaasModuleRoutes1760000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE \`saas_module\`
        SET \`route_path\` = ?
        WHERE \`code\` = ?
          AND \`delete_time\` IS NULL
      `,
      ['/tenant-saas/resource-packs', 'resource_pack'],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE \`saas_module\`
        SET \`route_path\` = ?
        WHERE \`code\` = ?
          AND \`delete_time\` IS NULL
      `,
      ['/tenant-saas/resource-pack', 'resource_pack'],
    );
  }
}
