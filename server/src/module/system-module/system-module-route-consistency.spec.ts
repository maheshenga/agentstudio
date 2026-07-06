import { SAAS_TO_SYSTEM_MODULE_BRIDGE } from './constants';
import { BUILT_IN_SYSTEM_MODULES } from './manifests/built-in-modules';
import { SYSTEM_MODULE_ROUTE_BINDINGS } from './system-module.guard';

const normalizeRoute = (route: string) => (route.startsWith('/') ? route : `/${route}`).replace(/\/+$/, '');

const matchesRoutePrefix = (path: string, prefix: string) => {
  const normalizedPath = normalizeRoute(path);
  const normalizedPrefix = normalizeRoute(prefix);
  return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
};

const matchBinding = (path: string) =>
  SYSTEM_MODULE_ROUTE_BINDINGS.filter((binding) => matchesRoutePrefix(path, binding.prefix)).sort(
    (left, right) => right.prefix.length - left.prefix.length,
  )[0];

describe('system module route manifests', () => {
  const routeManagedModules = BUILT_IN_SYSTEM_MODULES.filter((module) => module.routes?.length);

  it('declares a manifest route namespace for every guarded route binding', () => {
    const missing = SYSTEM_MODULE_ROUTE_BINDINGS.filter(
      (binding) =>
        !BUILT_IN_SYSTEM_MODULES.some(
          (module) =>
            module.code === binding.moduleCode &&
            module.routes?.some((route) => matchesRoutePrefix(binding.prefix, route)),
        ),
    ).map((binding) => `${binding.moduleCode}:${binding.prefix}`);

    expect(missing).toEqual([]);
  });

  it('keeps route-managed manifest APIs aligned with the guard binding module and tenant scope', () => {
    const mismatches = routeManagedModules.flatMap((module) =>
      module.apis.flatMap((api) => {
        const binding = matchBinding(api.path);
        if (!binding) return [`${module.code}:${api.path} has no guard binding`];

        const issues: string[] = [];
        if (binding.moduleCode !== module.code) {
          issues.push(`${module.code}:${api.path} matched ${binding.moduleCode}`);
        }
        if (Boolean(api.tenantScoped) !== binding.tenantScoped) {
          issues.push(
            `${module.code}:${api.path} tenantScoped manifest=${Boolean(api.tenantScoped)} guard=${binding.tenantScoped}`,
          );
        }
        return issues;
      }),
    );

    expect(mismatches).toEqual([]);
  });

  it('maps every guarded SaaS feature requirement back to the guarded system module', () => {
    const missing = SYSTEM_MODULE_ROUTE_BINDINGS.flatMap((binding) => {
      const requiredCodes = [binding.requiredSaasModuleCode, ...(binding.requiredAnySaasModuleCodes || [])].filter(
        (code): code is string => Boolean(code),
      );

      return requiredCodes
        .filter((saasCode) => !(SAAS_TO_SYSTEM_MODULE_BRIDGE[saasCode] || []).includes(binding.moduleCode))
        .map((saasCode) => `${binding.moduleCode}:${binding.prefix}:${saasCode}`);
    });

    expect(missing).toEqual([]);
  });
});
