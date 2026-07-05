import { BUILT_IN_SYSTEM_MODULES } from './built-in-modules';

describe('BUILT_IN_SYSTEM_MODULES', () => {
  const findModule = (code: string) => {
    const module = BUILT_IN_SYSTEM_MODULES.find((item) => item.code === code);
    if (!module) throw new Error(`Missing module ${code}`);
    return module;
  };

  it('uses real SaaS platform and tenant permission slugs in built-in manifests', () => {
    expect(findModule('saas_platform').permissions.map((item) => item.slug)).toEqual(
      expect.arrayContaining(['saas:usage:index', 'saas:plan:index', 'saas:order:list']),
    );
    expect(findModule('saas_platform').apis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'GET', path: '/api/saas/platform/usage/overview', permissionSlug: 'saas:usage:index' }),
        expect.objectContaining({ method: 'GET', path: '/api/saas/platform/plans', permissionSlug: 'saas:plan:index' }),
        expect.objectContaining({ method: 'GET', path: '/api/saas/platform/orders', permissionSlug: 'saas:order:list' }),
      ]),
    );

    expect(findModule('tenant_saas').permissions.map((item) => item.slug)).toEqual(
      expect.arrayContaining(['tenant:quota:view', 'tenant:billing:view', 'tenant:resource-pack:view']),
    );
    expect(findModule('tenant_saas').apis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'GET', path: '/api/saas/tenant/usage', permissionSlug: 'tenant:quota:view' }),
        expect.objectContaining({ method: 'POST', path: '/api/saas/tenant/orders', permissionSlug: 'tenant:billing:upgrade' }),
        expect.objectContaining({
          method: 'GET',
          path: '/api/saas/tenant/resource-packs',
          permissionSlug: 'tenant:resource-pack:view',
        }),
      ]),
    );
  });

  it('uses real AI and Taixu permission slugs and API routes in built-in manifests', () => {
    expect(findModule('ai_console').permissions.map((item) => item.slug)).toEqual(
      expect.arrayContaining(['ai:chat:use', 'ai:provider:list', 'ai:model:list']),
    );
    expect(findModule('ai_console').apis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'POST', path: '/api/ai/sessions', permissionSlug: 'ai:chat:use' }),
        expect.objectContaining({ method: 'GET', path: '/api/ai/admin/providers', permissionSlug: 'ai:provider:list' }),
      ]),
    );

    expect(findModule('taixu_workspace').apis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'POST', path: '/api/taixu/agent/invoke', tenantScoped: true }),
        expect.objectContaining({ method: 'POST', path: '/api/taixu/retrieval/rag', tenantScoped: true }),
        expect.objectContaining({ method: 'GET', path: '/api/taixu/model/page', tenantScoped: true }),
      ]),
    );
  });
});
