import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(__dirname, '../migrations/1760000000046-AlignAgentStudioSiteName.ts');

describe('AlignAgentStudioSiteName1760000000046', () => {
  it('provides the AgentStudio site-name migration', () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it('updates only exact legacy site-name values', async () => {
    if (!existsSync(migrationPath)) return;

    const { AlignAgentStudioSiteName1760000000046 } = require(migrationPath);
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AlignAgentStudioSiteName1760000000046().up(queryRunner as any);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    const [sql, params] = queryRunner.query.mock.calls[0];
    expect(String(sql)).toContain('UPDATE `sa_system_config`');
    expect(String(sql)).toContain('`key` = ?');
    expect(String(sql)).toContain('`value` IN (?, ?)');
    expect(params).toEqual(['AgentStudio', 'site_name', 'FssAdmin后台管理系统', 'FssAdmin']);
  });

  it('does not overwrite administrator changes on rollback', async () => {
    if (!existsSync(migrationPath)) return;

    const { AlignAgentStudioSiteName1760000000046 } = require(migrationPath);
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AlignAgentStudioSiteName1760000000046().down(queryRunner as any);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('uses AgentStudio in the bootstrap database', () => {
    const initSql = readFileSync(join(__dirname, '../../../database/init.sql'), 'utf8');

    expect(initSql).toContain("'site_name', 'AgentStudio', '网站名称'");
    expect(initSql).not.toContain("'site_name', 'FssAdmin后台管理系统', '网站名称'");
  });
});
