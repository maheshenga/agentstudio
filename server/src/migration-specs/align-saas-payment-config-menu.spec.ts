import { AlignSaasPaymentConfigMenu1760000000010 } from '../migrations/1760000000010-AlignSaasPaymentConfigMenu';

describe('AlignSaasPaymentConfigMenu1760000000010', () => {
  it('inserts platform payment config menu and permissions', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new AlignSaasPaymentConfigMenu1760000000010().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement);
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(sql.some((statement) => statement.includes('INSERT INTO `sa_system_menu`'))).toBe(true);
    expect(params).toContain('SaasPaymentConfig');
    expect(params).toContain('payment-config');
    expect(params).toContain('/saas/platform/payment-config');
    expect(params).toContain('saas:payment-config:view');
    expect(params).toContain('saas:payment-config:update');
  });
});
