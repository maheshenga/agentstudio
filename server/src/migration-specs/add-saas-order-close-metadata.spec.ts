import { AddSaasOrderCloseMetadata1760000000013 } from '../migrations/1760000000013-AddSaasOrderCloseMetadata';

describe('AddSaasOrderCloseMetadata1760000000013', () => {
  it('adds close metadata columns and indexes to both SaaS order tables', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new AddSaasOrderCloseMetadata1760000000013().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');

    expect(sql).toContain('ALTER TABLE `saas_order` ADD COLUMN `closed_at`');
    expect(sql).toContain('ALTER TABLE `saas_order` ADD COLUMN `close_reason`');
    expect(sql).toContain('ALTER TABLE `saas_resource_pack_order` ADD COLUMN `closed_at`');
    expect(sql).toContain('ALTER TABLE `saas_resource_pack_order` ADD COLUMN `close_reason`');
    expect(sql).toContain('idx_saas_order_status_create_time');
    expect(sql).toContain('idx_saas_order_status_close_reason');
    expect(sql).toContain('idx_saas_resource_pack_order_status_create_time');
    expect(sql).toContain('idx_saas_resource_pack_order_status_close_reason');
  });
});
