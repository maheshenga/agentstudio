import { SeedAppFactoryTemplates1760000000033 } from '../migrations/1760000000033-SeedAppFactoryTemplates';

describe('SeedAppFactoryTemplates1760000000033', () => {
  it('seeds curated templates and template list permission', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new SeedAppFactoryTemplates1760000000033().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);

    expect(params).toContain('landing_page');
    expect(params).toContain('job_board');
    expect(params).toContain('classifieds');
    expect(params).toContain('team_directory');
    expect(params).toContain('app:factory:template:list');
    expect(sql).toContain("`role`.`code` IN ('admin', 'super_admin')");
  });
});
