import { CreateSaasQuotaLedger1760000000019 } from '../migrations/1760000000019-CreateSaasQuotaLedger';

describe('CreateSaasQuotaLedger1760000000019', () => {
  it('creates the SaaS quota ledger table with lookup indexes', async () => {
    const queryRunner = { query: jest.fn() };

    await new CreateSaasQuotaLedger1760000000019().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `saas_quota_ledger`');
    expect(sql).toContain('`quota_delta` bigint NOT NULL DEFAULT 0');
    expect(sql).toContain('`used_delta` bigint NOT NULL DEFAULT 0');
    expect(sql).toContain('KEY `idx_saas_quota_ledger_tenant_resource` (`tenant_id`, `resource_type`)');
    expect(sql).toContain('KEY `idx_saas_quota_ledger_source` (`source_type`, `source_id`)');
  });
});
