import { CreateSaasOrdersAndPlanPrices1760000000003 } from '../migrations/1760000000003-CreateSaasOrdersAndPlanPrices';

describe('CreateSaasOrdersAndPlanPrices1760000000003', () => {
  it('adds plan prices, seeds defaults, and creates SaaS order table', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new CreateSaasOrdersAndPlanPrices1760000000003().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement);

    expect(sql[0]).toContain('ALTER TABLE `saas_plan` ADD `price_monthly` int NOT NULL DEFAULT 0');
    expect(sql[1]).toContain('ALTER TABLE `saas_plan` ADD `price_yearly` int NOT NULL DEFAULT 0');
    expect(sql).toContain("UPDATE `saas_plan` SET `price_monthly` = 9900, `price_yearly` = 99000 WHERE `code` = 'pro'");
    expect(sql.some((statement) => statement.includes('CREATE TABLE `saas_order`'))).toBe(true);
  });
});
