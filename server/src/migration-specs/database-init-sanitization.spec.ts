import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const initSql = readFileSync(join(__dirname, '../../../database/init.sql'), 'utf8');

describe('database init data sanitization', () => {
  it('does not seed runtime history or uploaded artifact rows', () => {
    const runtimeTables = [
      'sa_ai_chat_message',
      'sa_ai_chat_session',
      'sa_job_log',
      'sa_system_attachment',
      't_history_record',
      't_memory_detail',
      't_system_document',
      't_system_setting',
    ];

    for (const table of runtimeTables) {
      expect(initSql).not.toMatch(new RegExp(`^INSERT INTO \`${table}\``, 'm'));
    }
  });

  it('does not seed legacy model API keys', () => {
    expect(initSql).not.toMatch(/^INSERT INTO `t_system_model`/m);
    expect(initSql).not.toMatch(/'sk-[^']*'/);
    expect(initSql).not.toMatch(/'[^']*(apiKey|api_key)[^']*'\s*:/i);
  });
});
