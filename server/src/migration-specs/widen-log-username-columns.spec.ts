import { WidenLogUsernameColumns1760000000002 } from '../migrations/1760000000002-WidenLogUsernameColumns';

describe('WidenLogUsernameColumns1760000000002', () => {
  it('normalizes null usernames before enforcing non-null wider columns', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new WidenLogUsernameColumns1760000000002().up(queryRunner as any);

    expect(queryRunner.query.mock.calls.map(([sql]) => sql)).toEqual([
      "UPDATE `sa_system_oper_log` SET `username` = '' WHERE `username` IS NULL",
      "UPDATE `sa_system_login_log` SET `username` = '' WHERE `username` IS NULL",
      "ALTER TABLE `sa_system_oper_log` MODIFY `username` varchar(64) NOT NULL DEFAULT '' COMMENT '操作人员'",
      "ALTER TABLE `sa_system_login_log` MODIFY `username` varchar(64) NOT NULL DEFAULT '' COMMENT '用户账号'",
    ]);
  });
});
