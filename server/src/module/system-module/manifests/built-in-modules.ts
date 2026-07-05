import { SystemModuleSource, SystemModuleStatus } from '../constants';

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
      { slug: 'system:menu:list' },
      { slug: 'system:user:list' },
      { slug: 'system:role:list' },
    ],
    apis: [
      { method: 'GET', path: '/system/menu', permissionSlug: 'system:menu:list' },
      { method: 'GET', path: '/system/user', permissionSlug: 'system:user:list' },
      { method: 'GET', path: '/system/role', permissionSlug: 'system:role:list' },
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
    dependencies: [{ code: 'core_system' }],
    permissions: [
      { slug: 'saas:platform:usage' },
      { slug: 'saas:plan:list' },
      { slug: 'saas:order:list' },
    ],
    apis: [
      { method: 'GET', path: '/saas-platform/usage', permissionSlug: 'saas:platform:usage' },
      { method: 'GET', path: '/saas-platform/plans', permissionSlug: 'saas:plan:list' },
      { method: 'GET', path: '/saas-platform/orders', permissionSlug: 'saas:order:list' },
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
    dependencies: [{ code: 'core_system' }, { code: 'saas_platform' }],
    permissions: [
      { slug: 'tenant-saas:usage:view' },
      { slug: 'tenant-saas:order:create' },
      { slug: 'tenant-saas:resource-pack:list' },
    ],
    apis: [
      { method: 'GET', path: '/tenant-saas/usage', permissionSlug: 'tenant-saas:usage:view', tenantScoped: true },
      { method: 'POST', path: '/tenant-saas/orders', permissionSlug: 'tenant-saas:order:create', tenantScoped: true },
      {
        method: 'GET',
        path: '/tenant-saas/resource-packs',
        permissionSlug: 'tenant-saas:resource-pack:list',
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
    dependencies: [],
    permissions: [{ slug: 'ai:chat:use' }, { slug: 'ai:admin:manage' }],
    apis: [
      { method: 'POST', path: '/ai/chat', permissionSlug: 'ai:chat:use', tenantScoped: true },
      { method: 'GET', path: '/ai/admin/providers', permissionSlug: 'ai:admin:manage' },
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
    dependencies: [],
    permissions: [{ slug: 'taixu:workspace:view' }, { slug: 'taixu:llm:use' }],
    apis: [
      { method: 'GET', path: '/dashboard/taixu', permissionSlug: 'taixu:workspace:view', tenantScoped: true },
      { method: 'POST', path: '/taixu/llm/chat', permissionSlug: 'taixu:llm:use', tenantScoped: true },
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
      { method: 'GET', path: '/article', permissionSlug: 'article:list' },
      { method: 'POST', path: '/article', permissionSlug: 'article:create' },
      { method: 'PATCH', path: '/article/:id', permissionSlug: 'article:update' },
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
    permissions: [{ slug: 'tool:crontab:list' }, { slug: 'monitor:job:list' }, { slug: 'monitor:log:list' }],
    apis: [
      { method: 'GET', path: '/tool/crontab', permissionSlug: 'tool:crontab:list' },
      { method: 'GET', path: '/monitor/job', permissionSlug: 'monitor:job:list' },
      { method: 'GET', path: '/monitor/log', permissionSlug: 'monitor:log:list' },
    ],
    configSchema: {},
  },
];
