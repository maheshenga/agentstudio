import { EnforceSingleActiveSaasSubscription1760000000022 } from '../migrations/1760000000022-EnforceSingleActiveSaasSubscription';

describe('EnforceSingleActiveSaasSubscription1760000000022', () => {
  it('expires duplicate active subscriptions before adding a unique active tenant index', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new EnforceSingleActiveSaasSubscription1760000000022().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('UPDATE `saas_subscription` `subscription`');
    expect(sql).toContain("`subscription`.`status` = 'active'");
    expect(sql).toContain('LEFT(CONCAT(');
    expect(sql).toContain('ADD COLUMN `active_tenant_id` bigint GENERATED ALWAYS AS');
    expect(sql).toContain("`status` = 'active'");
    expect(sql).toContain('CREATE UNIQUE INDEX `uk_saas_subscription_active_tenant`');
  });

  it('drops the unique active tenant index and generated column on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new EnforceSingleActiveSaasSubscription1760000000022().down(queryRunner as any);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'DROP INDEX `uk_saas_subscription_active_tenant` ON `saas_subscription`',
    );
    expect(queryRunner.query).toHaveBeenCalledWith('ALTER TABLE `saas_subscription` DROP COLUMN `active_tenant_id`');
  });
});
