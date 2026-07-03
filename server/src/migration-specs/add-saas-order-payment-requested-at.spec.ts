import { AddSaasOrderPaymentRequestedAt1760000000014 } from '../migrations/1760000000014-AddSaasOrderPaymentRequestedAt';

describe('AddSaasOrderPaymentRequestedAt1760000000014', () => {
  it('adds payment requested metadata to both SaaS order tables', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new AddSaasOrderPaymentRequestedAt1760000000014().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');

    expect(sql).toContain('ALTER TABLE `saas_order` ADD COLUMN `payment_requested_at` datetime NULL');
    expect(sql).toContain('ALTER TABLE `saas_resource_pack_order` ADD COLUMN `payment_requested_at` datetime NULL');
  });

  it('drops payment requested metadata from both SaaS order tables', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new AddSaasOrderPaymentRequestedAt1760000000014().down(queryRunner as any);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'ALTER TABLE `saas_resource_pack_order` DROP COLUMN `payment_requested_at`',
    );
    expect(queryRunner.query).toHaveBeenCalledWith('ALTER TABLE `saas_order` DROP COLUMN `payment_requested_at`');
  });
});
