import { CreateAppCommercialization1760000000044 } from '../migrations/1760000000044-CreateAppCommercialization';

describe('CreateAppCommercialization1760000000044', () => {
  it('creates application pricing, orders, licenses, revenue, and settlement safeguards', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateAppCommercialization1760000000044().up(queryRunner as any);

    const statements = queryRunner.query.mock.calls.map(([statement]) => String(statement));
    const sql = statements.join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_price_plan`');
    expect(sql).toContain('UNIQUE KEY `uk_app_price_plan_app_code` (`app_id`, `code`)');
    expect(sql).toContain('`developer_share_bps` smallint unsigned NOT NULL');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_order`');
    expect(sql).toContain('UNIQUE KEY `uk_app_order_order_no` (`order_no`)');
    expect(sql).toContain('UNIQUE KEY `uk_app_order_trade_no` (`alipay_trade_no`)');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `tenant_app_license`');
    expect(sql).toContain('`current_license_key` varchar(100) GENERATED ALWAYS AS');
    expect(sql).toContain('UNIQUE KEY `uk_tenant_app_license_current` (`current_license_key`)');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_revenue_ledger`');
    expect(sql).toContain('UNIQUE KEY `uk_app_revenue_ledger_event` (`event_key`)');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_settlement_batch`');
    expect(sql).toContain(
      'UNIQUE KEY `uk_app_settlement_developer_period` (`developer_id`, `period_start`, `period_end`)',
    );
    expect(sql).not.toMatch(/provider_payload|notify_payload|private_key|public_key|password|token|cookie/i);
    expect(sql.indexOf('CREATE TABLE IF NOT EXISTS `app_price_plan`')).toBeLessThan(
      sql.indexOf('CREATE TABLE IF NOT EXISTS `app_order`'),
    );
    expect(sql.indexOf('CREATE TABLE IF NOT EXISTS `app_order`')).toBeLessThan(
      sql.indexOf('CREATE TABLE IF NOT EXISTS `tenant_app_license`'),
    );
  });

  it('drops only P12 tables in reverse dependency order', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateAppCommercialization1760000000044().down(queryRunner as any);

    const statements = queryRunner.query.mock.calls.map(([statement]) => String(statement));
    expect(statements).toEqual([
      'DROP TABLE IF EXISTS `app_revenue_ledger`',
      'DROP TABLE IF EXISTS `app_settlement_batch`',
      'DROP TABLE IF EXISTS `tenant_app_license`',
      'DROP TABLE IF EXISTS `app_order`',
      'DROP TABLE IF EXISTS `app_price_plan`',
    ]);
  });
});
