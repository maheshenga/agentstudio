import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('DisableUnenforcedSaasQuotas1760000000051', () => {
  it('disables storage and RAG quotas across plans, resources, and resource packs', () => {
    const migrationPath = join(__dirname, '../migrations/1760000000051-DisableUnenforcedSaasQuotas.ts');

    expect(existsSync(migrationPath)).toBe(true);
    const source = readFileSync(migrationPath, 'utf8');
    expect(source).toContain('UPDATE `saas_plan_quota`');
    expect(source).toContain('UPDATE `saas_tenant_resource`');
    expect(source).toContain('UPDATE `saas_resource_pack`');
    expect(source).toContain("IN ('storage_mb', 'rag_documents')");
  });
});
