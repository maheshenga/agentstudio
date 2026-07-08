import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { SaasPaymentController } from './saas-payment.controller';
import { SaasPlatformController } from './saas-platform.controller';
import { SaasPublicController } from './saas-public.controller';
import { SaasTenantController } from './saas-tenant.controller';
import { SystemModulePlatformController } from '../system-module/system-module-platform.controller';
import { SystemModuleTenantController } from '../system-module/system-module-tenant.controller';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RouteExpectation = { method: HttpMethod; path: string };
type RoutePermissionExpectation = RouteExpectation & { permissions: string[] };
type SeededMenuComponent = { code: string; routePath: string; component: string };
type MenuSeedLiteral = { code: string; path: string; component: string };

const REPO_ROOT = join(__dirname, '../../../..');

const CONTROLLERS = [
  SaasPublicController,
  SaasPlatformController,
  SaasTenantController,
  SaasPaymentController,
  SystemModulePlatformController,
  SystemModuleTenantController,
];

const SAAS_MODULE_ROUTE_EXPECTATIONS = [
  {
    code: 'member_management',
    routePath: '/tenant-saas/members',
    component: '/saas/tenant/member',
    apiRoutes: [
      { method: 'GET', path: '/api/saas/tenant/members' },
      { method: 'POST', path: '/api/saas/tenant/members' },
    ],
  },
  {
    code: 'resource_pack',
    routePath: '/tenant-saas/resource-packs',
    component: '/saas/tenant/resource-pack',
    apiRoutes: [
      { method: 'GET', path: '/api/saas/tenant/resource-packs' },
      { method: 'GET', path: '/api/saas/tenant/resource-pack-orders' },
      { method: 'POST', path: '/api/saas/tenant/resource-pack-orders' },
    ],
  },
  {
    code: 'advanced_report',
    routePath: '/saas-platform/revenue',
    component: '/saas/platform/revenue',
    apiRoutes: [{ method: 'GET', path: '/api/saas/platform/revenue/overview' }],
  },
] satisfies Array<{
  code: string;
  routePath: string;
  component: string;
  apiRoutes: RouteExpectation[];
}>;

describe('SaaS route consistency', () => {
  it('keeps frontend SaaS and module API client routes backed by controller methods', () => {
    const backendRoutes = collectBackendRoutes();
    const frontendRoutes = [
      ...extractFrontendRequests(readProjectFile('web/src/api/saas.ts'), (path) => path.startsWith('/api/saas/')),
      ...extractFrontendRequests(readProjectFile('web/src/api/system-module.ts'), (path) =>
        path.startsWith('/api/system/modules') || path.startsWith('/api/tenant/modules'),
      ),
    ];
    const missingRoutes = frontendRoutes.filter((route) => !backendRoutes.has(routeKey(route)));

    expect(frontendRoutes).toContainEqual({ method: 'GET', path: '/api/tenant/modules' });
    expect(missingRoutes).toEqual([]);
  });

  it('keeps SaaS controller permissions backed by seeded menu permissions', () => {
    const routePermissions = collectBackendRoutePermissions();
    const seededPermissions = collectSeededPermissionSlugs();
    const missingPermissions = routePermissions.flatMap((route) =>
      route.permissions
        .filter((permission) => /^(saas|tenant):/.test(permission) && !seededPermissions.has(permission))
        .map((permission) => `${route.method} ${route.path} -> ${permission}`),
    );

    expect(findRoutePermissions(routePermissions, 'GET', '/api/saas/tenant/modules')).toEqual(['tenant:module:list']);
    expect(findRoutePermissions(routePermissions, 'GET', '/api/saas/platform/runtime-health')).toEqual(['saas:usage:index']);
    expect(missingPermissions).toEqual([]);
  });

  it('keeps seeded SaaS module route paths aligned with tenant/platform route surfaces', () => {
    const seedSource = readProjectFile('server/src/migrations/1760000000017-SeedSaasModules.ts');
    const alignSource = readProjectFile('server/src/migrations/1760000000018-AlignSaasModuleRoutes.ts');
    const backendRoutes = collectBackendRoutes();

    for (const expectation of SAAS_MODULE_ROUTE_EXPECTATIONS) {
      expect(seedSource).toContain(`'${expectation.code}'`);
      expect(seedSource).toContain(`'${expectation.routePath}'`);
      expect(componentExists(expectation.component)).toBe(true);

      for (const apiRoute of expectation.apiRoutes) {
        expect(backendRoutes.has(routeKey(apiRoute))).toBe(true);
      }
    }

    expect(alignSource).toContain("['/tenant-saas/resource-packs', 'resource_pack']");
  });

  it('keeps tenant billing route singular to match seeded menus', () => {
    const foundationSource = readProjectFile('server/src/migrations/1760000000001-SeedSaasFoundationData.ts');
    const tenantBillingSeed = extractMenuSeedBlock(foundationSource, 'TenantBilling');

    expect(tenantBillingSeed).toContain("path: 'plan'");
    expect(tenantBillingSeed).toContain("component: '/saas/tenant/plan'");
    expect(tenantBillingSeed).not.toContain("path: 'plans'");
  });

  it('keeps seeded SaaS menu components loadable by the frontend component loader', () => {
    const seededMenuComponents = extractSeededSaasMenuComponents();
    const missingComponents = seededMenuComponents.filter(({ component }) => component !== '' && !componentExists(component));

    expect(seededMenuComponents).toEqual(
      expect.arrayContaining([
        { code: 'SaasUsage', routePath: '/saas-platform/usage', component: '/saas/platform/usage' },
        { code: 'SaasModule', routePath: '/saas-platform/module', component: '/saas/platform/module' },
        { code: 'TenantQuota', routePath: '/tenant-saas/usage', component: '/saas/tenant/usage' },
        { code: 'TenantSystemModules', routePath: '/tenant-saas/modules', component: '/saas/tenant/modules/index' },
      ]),
    );
    expect(missingComponents).toEqual([]);
  });
});

function collectBackendRoutes(): Set<string> {
  const routes = new Set<string>();

  for (const controller of CONTROLLERS) {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, controller);
    const prototype = controller.prototype;

    for (const propertyName of Object.getOwnPropertyNames(prototype)) {
      if (propertyName === 'constructor') continue;

      const handler = prototype[propertyName];
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      const handlerPath = Reflect.getMetadata(PATH_METADATA, handler);
      if (method === undefined || handlerPath === undefined) continue;

      const httpMethod = RequestMethod[method] as HttpMethod;
      for (const path of expandPaths(controllerPath, handlerPath)) {
        routes.add(routeKey({ method: httpMethod, path }));
      }
    }
  }

  return routes;
}

function collectBackendRoutePermissions(): RoutePermissionExpectation[] {
  const routes: RoutePermissionExpectation[] = [];

  for (const controller of CONTROLLERS) {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, controller);
    const prototype = controller.prototype;

    for (const propertyName of Object.getOwnPropertyNames(prototype)) {
      if (propertyName === 'constructor') continue;

      const handler = prototype[propertyName];
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      const handlerPath = Reflect.getMetadata(PATH_METADATA, handler);
      const permissions = Reflect.getMetadata('requirePermission', handler) as string[] | undefined;
      if (method === undefined || handlerPath === undefined || !permissions?.length) continue;

      const httpMethod = RequestMethod[method] as HttpMethod;
      for (const path of expandPaths(controllerPath, handlerPath)) {
        routes.push({ method: httpMethod, path, permissions });
      }
    }
  }

  return routes;
}

function findRoutePermissions(
  routes: RoutePermissionExpectation[],
  method: HttpMethod,
  path: string,
): string[] {
  return routes.find((route) => routeKey(route) === routeKey({ method, path }))?.permissions ?? [];
}

function collectSeededPermissionSlugs(): Set<string> {
  const migrationsDir = join(REPO_ROOT, 'server/src/migrations');
  const slugs = new Set<string>();

  for (const filename of readdirSync(migrationsDir)) {
    if (!filename.endsWith('.ts')) continue;
    const source = readFileSync(join(migrationsDir, filename), 'utf8');
    for (const match of source.matchAll(/['"`]((?:saas|tenant):[a-z0-9:-]+)['"`]/g)) {
      slugs.add(match[1]);
    }
  }

  return slugs;
}

function extractFrontendRequests(source: string, shouldIncludePath: (path: string) => boolean): RouteExpectation[] {
  const routes: RouteExpectation[] = [];
  const shorthandRequestPattern = /request\.(get|post|put|patch|del|delete)[\s\S]*?\(\s*\{[\s\S]*?url:\s*([`'"])(.*?)\2/g;
  const genericRequestPattern =
    /request\.request\s*\(\s*\{[\s\S]*?url:\s*([`'"])(.*?)\1[\s\S]*?method:\s*([`'"])(GET|POST|PUT|PATCH|DELETE)\3/g;

  for (const match of source.matchAll(shorthandRequestPattern)) {
    const method = normalizeFrontendMethod(match[1]);
    const path = match[3];
    if (shouldIncludePath(path)) {
      routes.push({ method, path });
    }
  }

  for (const match of source.matchAll(genericRequestPattern)) {
    const path = match[2];
    if (shouldIncludePath(path)) {
      routes.push({ method: match[4] as HttpMethod, path });
    }
  }

  return routes;
}

function normalizeFrontendMethod(method: string): HttpMethod {
  return (method === 'del' ? 'DELETE' : method.toUpperCase()) as HttpMethod;
}

function expandPaths(controllerPath: string | string[], handlerPath: string | string[]): string[] {
  const controllerPaths = Array.isArray(controllerPath) ? controllerPath : [controllerPath];
  const handlerPaths = Array.isArray(handlerPath) ? handlerPath : [handlerPath];

  return controllerPaths.flatMap((basePath) => handlerPaths.map((path) => normalizePath(basePath, path)));
}

function normalizePath(...parts: string[]): string {
  const segments = parts
    .flatMap((part) => String(part || '').split('/'))
    .map((part) => part.trim())
    .filter(Boolean);

  return `/${segments.join('/')}`;
}

function routeKey(route: RouteExpectation): string {
  return `${route.method} ${normalizeDynamicSegments(route.path)}`;
}

function normalizeDynamicSegments(path: string): string {
  return path
    .replace(/\$\{[^}]+}/g, ':param')
    .replace(/:[^/]+/g, ':param');
}

function componentExists(component: string): boolean {
  const componentPath = component.replace(/^\/+/, '');
  return (
    existsSync(join(REPO_ROOT, 'web/src/views', `${componentPath}.vue`)) ||
    existsSync(join(REPO_ROOT, 'web/src/views', componentPath, 'index.vue'))
  );
}

function extractSeededSaasMenuComponents(): SeededMenuComponent[] {
  const foundationSource = readProjectFile('server/src/migrations/1760000000001-SeedSaasFoundationData.ts');
  const moduleSource = readProjectFile('server/src/migrations/1760000000017-SeedSaasModules.ts');
  const systemModuleSource = readProjectFile('server/src/migrations/1760000000021-SeedSystemModules.ts');
  const platformRoot = parseMenuSeedObject(extractConstBlock(foundationSource, 'PLATFORM_ROOT_MENU', '{'));
  const tenantRoot = parseMenuSeedObject(extractConstBlock(foundationSource, 'TENANT_ROOT_MENU', '{'));

  return [
    ...parseMenuSeedArray(extractConstBlock(foundationSource, 'PLATFORM_MENUS', '['), platformRoot.path),
    ...parseMenuSeedArray(extractConstBlock(foundationSource, 'TENANT_MENUS', '['), tenantRoot.path),
    extractSaasModuleMenu(moduleSource, platformRoot.path),
    menuLiteralToComponent(parseMenuSeedObject(extractConstBlock(systemModuleSource, 'TENANT_MENU', '{')), tenantRoot.path),
  ];
}

function parseMenuSeedArray(arrayBlock: string, rootPath: string): SeededMenuComponent[] {
  return extractBalancedBlocks(arrayBlock, '{').map((block) => menuLiteralToComponent(parseMenuSeedObject(block), rootPath));
}

function parseMenuSeedObject(objectBlock: string): MenuSeedLiteral {
  return {
    code: extractLiteralProperty(objectBlock, 'code'),
    path: extractLiteralProperty(objectBlock, 'path'),
    component: extractLiteralProperty(objectBlock, 'component'),
  };
}

function extractSaasModuleMenu(source: string, rootPath: string): SeededMenuComponent {
  const methodStart = source.indexOf('private async insertModuleMenu');
  if (methodStart === -1) {
    throw new Error('Could not find insertModuleMenu in SaaS module seed migration');
  }

  const methodBlock = extractBalancedBlockAt(source, source.indexOf('{', methodStart));
  if (!/\\?`parent\\?`\.\\?`code\\?`\s*=\s*'SaasManage'/.test(methodBlock)) {
    throw new Error('SaaS module menu seed is no longer inserted under SaasManage');
  }

  const valuesStart = methodBlock.indexOf('[', methodBlock.indexOf('queryRunner.query'));
  const values = extractSingleQuotedStrings(extractBalancedBlockAt(methodBlock, valuesStart));
  if (values.length < 4) {
    throw new Error('Could not extract SaaS module menu insert values');
  }

  return menuLiteralToComponent({ code: values[1], path: values[2], component: values[3] }, rootPath);
}

function menuLiteralToComponent(menu: MenuSeedLiteral, rootPath: string): SeededMenuComponent {
  return {
    code: menu.code,
    routePath: menu.path.startsWith('/') ? normalizePath(menu.path) : normalizePath(rootPath, menu.path),
    component: menu.component,
  };
}

function extractMenuSeedBlock(source: string, code: string): string {
  const codeIndex = source.indexOf(`code: '${code}'`);
  const blockStart = source.lastIndexOf('{', codeIndex);
  const blockEnd = source.indexOf('},', codeIndex);
  if (codeIndex === -1 || blockStart === -1 || blockEnd === -1) {
    return '';
  }

  return source.slice(blockStart, blockEnd + 1);
}

function extractConstBlock(source: string, constName: string, opener: '{' | '['): string {
  const constIndex = source.indexOf(`const ${constName}`);
  if (constIndex === -1) {
    throw new Error(`Could not find ${constName}`);
  }

  const assignmentIndex = source.indexOf('=', constIndex);
  return extractBalancedBlockAt(source, source.indexOf(opener, assignmentIndex));
}

function extractBalancedBlocks(source: string, opener: '{' | '['): string[] {
  const blocks: string[] = [];
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let blockStart = -1;

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === opener) {
      if (depth === 0) {
        blockStart = index;
      }
      depth += 1;
    } else if (source[index] === closer) {
      depth -= 1;
      if (depth === 0 && blockStart !== -1) {
        blocks.push(source.slice(blockStart, index + 1));
        blockStart = -1;
      }
    }
  }

  return blocks;
}

function extractBalancedBlockAt(source: string, start: number): string {
  if (start === -1) {
    throw new Error('Could not find balanced block start');
  }

  const opener = source[start];
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === opener) {
      depth += 1;
    } else if (source[index] === closer) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error('Could not find balanced block end');
}

function extractLiteralProperty(source: string, propertyName: string): string {
  const match = new RegExp(`\\b${propertyName}:\\s*'([^']*)'`).exec(source);
  if (!match) {
    throw new Error(`Could not extract literal property ${propertyName}`);
  }

  return match[1];
}

function extractSingleQuotedStrings(source: string): string[] {
  return [...source.matchAll(/'([^']*)'/g)].map((match) => match[1]);
}

function readProjectFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}
