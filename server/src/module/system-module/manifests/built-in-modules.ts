import type { SystemModuleSource, SystemModuleStatus } from '../constants';

export interface SystemModuleManifestDependency {
  code: string;
  versionRange?: string;
  required?: boolean;
}

export interface SystemModuleManifestPermission {
  slug: string;
  bindingType?: 'owned' | 'required' | 'optional';
}

export interface SystemModuleManifestApi {
  method: string;
  path: string;
  permissionSlug?: string;
  tenantScoped?: boolean;
}

export interface SystemModuleManifest {
  code: string;
  name: string;
  source: SystemModuleSource;
  version: string;
  description: string;
  category: string;
  icon: string;
  status: SystemModuleStatus;
  entryRoute: string;
  sort: number;
  routes?: string[];
  dependencies: SystemModuleManifestDependency[];
  permissions: SystemModuleManifestPermission[];
  apis: SystemModuleManifestApi[];
  configSchema: Record<string, unknown>;
}

export const BUILT_IN_SYSTEM_MODULES: SystemModuleManifest[] = [
  {
    code: 'core_system',
    name: 'Core System',
    source: 'built_in',
    version: '1.0.0',
    description: 'Core administration capabilities, menus, roles, users, and tenant foundations.',
    category: 'system',
    icon: 'Settings',
    status: 'enabled',
    entryRoute: '/system/menu',
    sort: 10,
    dependencies: [],
    permissions: [
      { slug: 'core:menu:index' },
      { slug: 'core:user:index' },
      { slug: 'core:role:index' },
    ],
    apis: [
      { method: 'GET', path: '/api/system/menu/list', permissionSlug: 'core:menu:index' },
      { method: 'GET', path: '/api/system/user/list', permissionSlug: 'core:user:index' },
      { method: 'GET', path: '/api/system/role/list', permissionSlug: 'core:role:index' },
    ],
    configSchema: {},
  },
  {
    code: 'saas_platform',
    name: 'SaaS Platform',
    source: 'built_in',
    version: '1.0.0',
    description: 'Platform SaaS plans, subscriptions, payments, revenue, and operating overview.',
    category: 'saas',
    icon: 'Landmark',
    status: 'enabled',
    entryRoute: '/saas-platform/usage',
    sort: 20,
    routes: ['/api/saas/platform'],
    dependencies: [{ code: 'core_system', versionRange: '^1.0.0' }],
    permissions: [
      { slug: 'saas:usage:index' },
      { slug: 'saas:plan:index' },
      { slug: 'saas:order:list' },
    ],
    apis: [
      { method: 'GET', path: '/api/saas/platform/usage/overview', permissionSlug: 'saas:usage:index' },
      { method: 'GET', path: '/api/saas/platform/plans', permissionSlug: 'saas:plan:index' },
      { method: 'GET', path: '/api/saas/platform/orders', permissionSlug: 'saas:order:list' },
    ],
    configSchema: {},
  },
  {
    code: 'tenant_saas',
    name: 'Tenant SaaS',
    source: 'built_in',
    version: '1.0.0',
    description: 'Tenant-facing subscription, quota, resource pack, and payment workflows.',
    category: 'saas',
    icon: 'Building2',
    status: 'enabled',
    entryRoute: '/tenant-saas/usage',
    sort: 30,
    routes: ['/api/saas/tenant'],
    dependencies: [
      { code: 'core_system', versionRange: '^1.0.0' },
      { code: 'saas_platform', versionRange: '^1.0.0' },
    ],
    permissions: [
      { slug: 'tenant:quota:view' },
      { slug: 'tenant:billing:view' },
      { slug: 'tenant:billing:upgrade' },
      { slug: 'tenant:resource-pack:view' },
      { slug: 'tenant:resource-pack-order:create' },
    ],
    apis: [
      { method: 'GET', path: '/api/saas/tenant/usage', permissionSlug: 'tenant:quota:view', tenantScoped: true },
      { method: 'POST', path: '/api/saas/tenant/orders', permissionSlug: 'tenant:billing:upgrade', tenantScoped: true },
      {
        method: 'GET',
        path: '/api/saas/tenant/resource-packs',
        permissionSlug: 'tenant:resource-pack:view',
        tenantScoped: true,
      },
    ],
    configSchema: {},
  },
  {
    code: 'ai_console',
    name: 'AI Console',
    source: 'built_in',
    version: '1.0.0',
    description: 'AI chat, providers, model operations, and assistant configuration.',
    category: 'ai',
    icon: 'Bot',
    status: 'enabled',
    entryRoute: '/ai/chat',
    sort: 40,
    routes: ['/api/ai'],
    dependencies: [],
    permissions: [{ slug: 'ai:chat:use' }, { slug: 'ai:provider:list' }, { slug: 'ai:model:list' }],
    apis: [
      { method: 'POST', path: '/api/ai/sessions', permissionSlug: 'ai:chat:use', tenantScoped: true },
      { method: 'GET', path: '/api/ai/admin/providers/list', permissionSlug: 'ai:provider:list', tenantScoped: true },
      { method: 'GET', path: '/api/ai/admin/models/list', permissionSlug: 'ai:model:list', tenantScoped: true },
    ],
    configSchema: {},
  },
  {
    code: 'taixu_workspace',
    name: 'Taixu Workspace',
    source: 'built_in',
    version: '1.0.0',
    description: 'Taixu dashboard workspace and large language model operations.',
    category: 'workspace',
    icon: 'Sparkles',
    status: 'enabled',
    entryRoute: '/dashboard/taixu',
    sort: 50,
    routes: ['/api/taixu', '/llm/chat', '/image/generate'],
    dependencies: [],
    permissions: [{ slug: 'taixu:workspace:use' }],
    apis: [
      { method: 'POST', path: '/api/taixu/agent/invoke', permissionSlug: 'taixu:workspace:use', tenantScoped: true },
      { method: 'POST', path: '/api/taixu/retrieval/rag', permissionSlug: 'taixu:workspace:use', tenantScoped: true },
      { method: 'GET', path: '/api/taixu/model/page', permissionSlug: 'taixu:workspace:use', tenantScoped: true },
    ],
    configSchema: {},
  },
  {
    code: 'content_article',
    name: 'Content Article',
    source: 'built_in',
    version: '1.0.0',
    description: 'Article creation, publishing, and content management.',
    category: 'content',
    icon: 'Newspaper',
    status: 'enabled',
    entryRoute: '/article',
    sort: 60,
    dependencies: [],
    permissions: [{ slug: 'article:list' }, { slug: 'article:create' }, { slug: 'article:update' }],
    apis: [
      { method: 'GET', path: '/api/article/list', permissionSlug: 'article:list' },
      { method: 'POST', path: '/api/article/create', permissionSlug: 'article:create' },
      { method: 'PUT', path: '/api/article/update/:id', permissionSlug: 'article:update' },
    ],
    configSchema: {},
  },
  {
    code: 'ops_monitor',
    name: 'Ops Monitor',
    source: 'built_in',
    version: '1.0.0',
    description: 'Operational monitoring, cron jobs, logs, and platform maintenance tools.',
    category: 'ops',
    icon: 'Activity',
    status: 'enabled',
    entryRoute: '/tool/crontab',
    sort: 70,
    dependencies: [],
    permissions: [{ slug: 'tool:crontab:index' }, { slug: 'core:logs:login' }, { slug: 'core:logs:Oper' }],
    apis: [
      { method: 'GET', path: '/api/tool/crontab/list', permissionSlug: 'tool:crontab:index' },
      { method: 'GET', path: '/api/core/logs/getLoginLogPageList', permissionSlug: 'core:logs:login' },
      { method: 'GET', path: '/api/core/logs/getOperLogPageList', permissionSlug: 'core:logs:Oper' },
    ],
    configSchema: {},
  },
];
