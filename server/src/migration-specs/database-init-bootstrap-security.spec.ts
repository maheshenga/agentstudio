import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type SqlValue = string | null;

const initSql = readFileSync(join(__dirname, '../../../database/init.sql'), 'utf8');

function parseSqlValues(valueList: string): SqlValue[] {
  const values: SqlValue[] = [];
  let token = '';
  let inString = false;

  for (let i = 0; i < valueList.length; i += 1) {
    const char = valueList[i];
    const next = valueList[i + 1];

    if (inString) {
      if (char === '\\' && next !== undefined) {
        token += next;
        i += 1;
        continue;
      }
      if (char === "'" && next === "'") {
        token += "'";
        i += 1;
        continue;
      }
      if (char === "'") {
        inString = false;
        continue;
      }
      token += char;
      continue;
    }

    if (char === "'") {
      inString = true;
      continue;
    }

    if (char === ',') {
      values.push(normalizeSqlToken(token));
      token = '';
      continue;
    }

    token += char;
  }

  values.push(normalizeSqlToken(token));
  return values;
}

function normalizeSqlToken(token: string): SqlValue {
  const value = token.trim();
  return value.toLowerCase() === 'null' ? null : value;
}

function insertRows(table: string): SqlValue[][] {
  const pattern = new RegExp(`^INSERT INTO \`${table}\` VALUES \\((.*)\\);$`, 'gm');
  return Array.from(initSql.matchAll(pattern), (match) => parseSqlValues(match[1]));
}

describe('database init bootstrap security', () => {
  it('seeds only the intentional bootstrap administrator account', () => {
    const users = insertRows('sa_system_user');

    expect(users.map((row) => row[1])).toEqual(['admin']);
    expect(users[0][11]).toBe('1');
    expect(users[0][12]).toBe('1');
    expect(users[0][20]).toBeNull();
  });

  it('seeds only the bootstrap tenant and super administrator role', () => {
    const tenants = insertRows('sa_system_tenant');
    const roles = insertRows('sa_system_role');

    expect(tenants.map((row) => row[0])).toEqual(['1']);
    expect(tenants[0][8]).toBe('1');
    expect(roles.map((row) => row[3])).toEqual(['super_admin']);
    expect(roles[0][8]).toBe('1');
    expect(roles[0][9]).toBe('1');
  });

  it('does not seed demo authorization policies or role grants', () => {
    expect(insertRows('casbin_rule')).toHaveLength(0);
    expect(insertRows('sa_system_user_menu')).toHaveLength(0);
    expect(insertRows('sa_system_role_dept')).toHaveLength(0);

    const roleMenuRows = insertRows('sa_system_role_menu');
    const nonBootstrapRoleGrants = roleMenuRows.filter((row) => row[1] !== '1');
    expect(nonBootstrapRoleGrants).toHaveLength(0);
  });

  it('keeps account relations scoped to the bootstrap admin and tenant', () => {
    const userRoles = insertRows('sa_system_user_role').map((row) => [row[1], row[2], row[3], row[4]]);
    const userTenants = insertRows('sa_system_user_tenant').map((row) => [row[1], row[2], row[3], row[4], row[10]]);
    const userPosts = insertRows('sa_system_user_post');

    expect(userRoles).toEqual([['1', '1', '1', '1']]);
    expect(userTenants).toEqual([['1', '1', '1', '0', '1']]);
    expect(userPosts.every((row) => row[1] === '1')).toBe(true);
  });
});
