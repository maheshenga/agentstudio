import { CreateSaasModules1760000000016 } from '../migrations/1760000000016-CreateSaasModules';

describe('CreateSaasModules1760000000016', () => {
  it('creates the SaaS module catalog table', async () => {
    const queryRunner = { query: jest.fn() };

    await new CreateSaasModules1760000000016().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE `saas_module`');
    expect(sql).toContain('UNIQUE KEY `uk_saas_module_code` (`code`)');
  });
});
