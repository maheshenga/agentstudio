import { CreateAppFactoryTemplateTables1760000000032 } from '../migrations/1760000000032-CreateAppFactoryTemplateTables';

describe('CreateAppFactoryTemplateTables1760000000032', () => {
  it('creates app factory template table and core indexes', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new CreateAppFactoryTemplateTables1760000000032().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `app_factory_template`');
    expect(sql).toContain('UNIQUE KEY `uk_app_factory_template_code` (`code`)');
    expect(sql).toContain('KEY `idx_app_factory_template_category` (`category`)');
    expect(sql).toContain('KEY `idx_app_factory_template_status` (`status`)');
  });

  it('drops app factory template table', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
    };

    await new CreateAppFactoryTemplateTables1760000000032().down(queryRunner as any);

    expect(queryRunner.query.mock.calls.map(([statement]) => statement)).toEqual([
      'DROP TABLE IF EXISTS `app_factory_template`',
    ]);
  });
});
