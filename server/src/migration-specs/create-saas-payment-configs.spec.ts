import { CreateSaasPaymentConfigs1760000000009 } from '../migrations/1760000000009-CreateSaasPaymentConfigs';

describe('CreateSaasPaymentConfigs1760000000009', () => {
  it('creates SaaS payment config table with secret columns and provider scope uniqueness', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateSaasPaymentConfigs1760000000009().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE `saas_payment_config`');
    expect(sql).toContain('`private_key` text NULL');
    expect(sql).toContain('`public_key` text NULL');
    expect(sql).toContain('UNIQUE KEY `uk_saas_payment_config_provider_scope` (`provider`, `scope`)');
  });
});
