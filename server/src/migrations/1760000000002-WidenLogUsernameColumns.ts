import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenLogUsernameColumns1760000000002 implements MigrationInterface {
  name = 'WidenLogUsernameColumns1760000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE `sa_system_oper_log` SET `username` = '' WHERE `username` IS NULL");
    await queryRunner.query("UPDATE `sa_system_login_log` SET `username` = '' WHERE `username` IS NULL");
    await queryRunner.query("ALTER TABLE `sa_system_oper_log` MODIFY `username` varchar(64) NOT NULL DEFAULT '' COMMENT '操作人员'");
    await queryRunner.query("ALTER TABLE `sa_system_login_log` MODIFY `username` varchar(64) NOT NULL DEFAULT '' COMMENT '用户账号'");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `sa_system_login_log` MODIFY `username` varchar(20) NOT NULL DEFAULT '' COMMENT '用户账号'");
    await queryRunner.query("ALTER TABLE `sa_system_oper_log` MODIFY `username` varchar(20) NOT NULL DEFAULT '' COMMENT '操作人员'");
  }
}
