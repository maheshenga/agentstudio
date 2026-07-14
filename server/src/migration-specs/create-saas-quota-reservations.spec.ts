import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('CreateSaasQuotaReservations1760000000050', () => {
  it('creates durable quota reservations with a unique source key', () => {
    const migrationPath = join(__dirname, '../migrations/1760000000050-CreateSaasQuotaReservations.ts');

    expect(existsSync(migrationPath)).toBe(true);
    const source = readFileSync(migrationPath, 'utf8');
    expect(source).toContain('CREATE TABLE \\`saas_quota_reservation\\`');
    expect(source).toContain('UNIQUE KEY \\`uk_saas_quota_reservation_source\\`');
    expect(source).toContain('\\`status\\` varchar(20) NOT NULL DEFAULT \'pending\'');
  });
});
