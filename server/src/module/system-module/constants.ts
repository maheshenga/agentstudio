export const SYSTEM_MODULE_SOURCES = ['built_in', 'plugin', 'extension'] as const;
export type SystemModuleSource = (typeof SYSTEM_MODULE_SOURCES)[number];

export const SYSTEM_MODULE_STATUSES = [
  'draft',
  'installed',
  'enabled',
  'disabled',
  'upgrading',
  'failed',
  'uninstalled',
] as const;
export type SystemModuleStatus = (typeof SYSTEM_MODULE_STATUSES)[number];

export const SYSTEM_MODULE_HEALTH_STATUSES = ['unknown', 'healthy', 'degraded', 'failed'] as const;
export type SystemModuleHealthStatus = (typeof SYSTEM_MODULE_HEALTH_STATUSES)[number];

export const SYSTEM_TENANT_MODULE_SOURCES = ['platform', 'plan', 'plugin', 'manual'] as const;
export type SystemTenantModuleSource = (typeof SYSTEM_TENANT_MODULE_SOURCES)[number];

export const SYSTEM_MODULE_EVENT_TYPES = [
  'install',
  'enable',
  'disable',
  'upgrade',
  'health_check',
  'config_update',
  'uninstall',
] as const;
export type SystemModuleEventType = (typeof SYSTEM_MODULE_EVENT_TYPES)[number];
