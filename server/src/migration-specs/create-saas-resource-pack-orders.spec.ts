import { CreateSaasResourcePackOrders1760000000006 } from '../migrations/1760000000006-CreateSaasResourcePackOrders';

describe('CreateSaasResourcePackOrders1760000000006', () => {
  it('creates resource pack order table with unique order number', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateSaasResourcePackOrders1760000000006().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE `saas_resource_pack_order`');
    expect(sql).toContain('`order_no` varchar(32) NOT NULL');
    expect(sql).toContain('UNIQUE KEY `uk_saas_resource_pack_order_order_no` (`order_no`)');
    expect(sql).toContain('`delivered_at` datetime NULL');
  });
});
