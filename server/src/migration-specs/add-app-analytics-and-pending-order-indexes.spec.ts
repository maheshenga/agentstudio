import { AddAppAnalyticsAndPendingOrderIndexes1760000000048 } from '../migrations/1760000000048-AddAppAnalyticsAndPendingOrderIndexes';

describe('AddAppAnalyticsAndPendingOrderIndexes1760000000048', () => {
  it('adds the app-code time index and the pending-order lookup index', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AddAppAnalyticsAndPendingOrderIndexes1760000000048().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain(
      'ADD KEY `idx_app_open_log_code_time` (`app_code`, `create_time`)',
    );
    expect(sql).toContain(
      'ADD KEY `idx_app_order_pending_lookup` (`tenant_id`, `app_id`, `price_plan_id`, `payment_method`, `status`)',
    );
  });

  it('drops both indexes in reverse order', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AddAppAnalyticsAndPendingOrderIndexes1760000000048().down(queryRunner as any);

    expect(queryRunner.query.mock.calls.map(([statement]) => statement)).toEqual([
      'ALTER TABLE `app_order` DROP INDEX `idx_app_order_pending_lookup`',
      'ALTER TABLE `app_open_log` DROP INDEX `idx_app_open_log_code_time`',
    ]);
  });
});
