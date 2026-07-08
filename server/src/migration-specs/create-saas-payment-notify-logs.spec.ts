import { CreateSaasPaymentNotifyLogs1760000000027 } from '../migrations/1760000000027-CreateSaasPaymentNotifyLogs';

describe('CreateSaasPaymentNotifyLogs1760000000027', () => {
  it('creates SaaS payment notify log table for callback audit', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateSaasPaymentNotifyLogs1760000000027().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE `saas_payment_notify_log`');
    expect(sql).toContain('`provider` varchar(20) NOT NULL');
    expect(sql).toContain('`order_no` varchar(64) NULL');
    expect(sql).toContain('`result` varchar(30) NOT NULL');
    expect(sql).toContain('`raw_payload` json NULL');
    expect(sql).toContain('KEY `idx_saas_payment_notify_order` (`provider`, `order_no`)');
  });
});
