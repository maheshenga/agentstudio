import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('AddAppServiceRuntimeDriver1760000000052', () => {
  const migrationPath = resolve(
    __dirname,
    '../migrations/1760000000052-AddAppServiceRuntimeDriver.ts',
  );

  it('adds a persisted runtime driver with a safe PM2 compatibility default', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const source = readFileSync(migrationPath, 'utf8');
    expect(source).toContain("ADD COLUMN `runtime_driver` varchar(20) NOT NULL DEFAULT 'pm2'");
    expect(source).toContain('idx_app_service_instance_driver_status');
    expect(source).toContain('(`runtime_driver`, `process_status`)');
    expect(source).not.toMatch(/password|token|secret|socket|container_image/i);
  });

  it('drops the driver index before removing the additive column', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;

    const source = readFileSync(migrationPath, 'utf8');
    expect(source.indexOf('DROP INDEX `idx_app_service_instance_driver_status`')).toBeLessThan(
      source.indexOf('DROP COLUMN `runtime_driver`'),
    );
  });
});
