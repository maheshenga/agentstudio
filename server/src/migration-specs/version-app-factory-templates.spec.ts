import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('VersionAppFactoryTemplates1760000000055', () => {
  const migrationPath = resolve(
    __dirname,
    '../migrations/1760000000055-VersionAppFactoryTemplates.ts',
  );

  it('adds versioned template and module provenance contracts', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;
    const source = readFileSync(migrationPath, 'utf8');
    for (const token of [
      'schema_version',
      'template_version',
      'runtime_target',
      'manifest_defaults',
      'uk_app_factory_template_code_version',
    ]) {
      expect(source).toContain(token);
    }
  });

  it('upgrades recruitment and classifieds without embedding executable service code', () => {
    expect(existsSync(migrationPath)).toBe(true);
    if (!existsSync(migrationPath)) return;
    const source = readFileSync(migrationPath, 'utf8');
    expect(source).toContain('job_board');
    expect(source).toContain('classifieds');
    expect(source).toContain("'2.0.0'");
    expect(source).not.toMatch(/child_process|exec\(|spawn\(|npm install|pnpm install/i);
  });
});
