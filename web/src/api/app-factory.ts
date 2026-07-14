import request from '@/utils/http'

export type AppFactoryModuleKind = 'static_page'
export type AppFactoryModuleStatus = 'draft' | 'published' | 'disabled' | 'archived'
export type AppFactoryModuleVisibility = 'platform' | 'tenant' | 'marketplace' | 'private'
export type AppFactoryRuntimeTarget = 'static' | 'service'

export interface AppFactoryManifestDefaults {
  tenant_scoped?: boolean
  permissions?: string[]
  healthPath?: string
  capabilities?: string[]
}

export interface AppFactoryManifestRecord {
  code: string
  version: string
  [key: string]: unknown
}

export interface AppFactoryModuleRecord {
  id: number
  code: string
  name: string
  kind: AppFactoryModuleKind
  template_code?: string
  template_version?: string
  template_schema_version?: number
  runtime_target: AppFactoryRuntimeTarget
  manifest_defaults?: AppFactoryManifestDefaults
  category?: string
  icon?: string
  summary?: string
  description?: string
  html_content?: string
  css_content?: string
  app_code?: string
  status: AppFactoryModuleStatus
  visibility: AppFactoryModuleVisibility
  saas_module_code?: string
  system_module_code?: string
  latest_version?: string
  last_publish_time?: string | Date | null
  created_by?: number | null
  sort?: number
  remark?: string
  create_time?: string | Date | null
  update_time?: string | Date | null
  entry_url?: string
}

export interface AppFactoryTemplateRecord {
  id: number
  code: string
  schema_version: number
  template_version: string
  runtime_target: AppFactoryRuntimeTarget
  manifest_defaults?: AppFactoryManifestDefaults
  name: string
  category?: string
  icon?: string
  summary?: string
  description?: string
  html_content?: string
  css_content?: string
  default_visibility?: AppFactoryModuleVisibility
  default_saas_module_code?: string
  default_system_module_code?: string
  status: number
  sort?: number
  remark?: string
  create_time?: string | Date | null
  update_time?: string | Date | null
}

export interface AppFactoryListParams {
  keyword?: string
  status?: AppFactoryModuleStatus | ''
}

export interface AppFactoryTemplateListParams {
  keyword?: string
  category?: string
  status?: number | string
}

export interface SaveAppFactoryModuleParams {
  code?: string
  name: string
  kind?: AppFactoryModuleKind
  template_code?: string
  template_version?: string
  template_schema_version?: number
  runtime_target?: AppFactoryRuntimeTarget
  manifest_defaults?: AppFactoryManifestDefaults
  category?: string
  icon?: string
  summary?: string
  description?: string
  html_content?: string
  css_content?: string
  visibility?: AppFactoryModuleVisibility
  saas_module_code?: string
  system_module_code?: string
  sort?: number
  remark?: string
}

export interface PublishAppFactoryModuleParams {
  version: string
  message?: string
}

export function fetchAppFactoryModules(params: AppFactoryListParams = {}) {
  return request.get<AppFactoryModuleRecord[]>({ url: '/api/app-platform/factory/modules', params })
}

export function fetchAppFactoryTemplates(params: AppFactoryTemplateListParams = {}) {
  return request.get<AppFactoryTemplateRecord[]>({
    url: '/api/app-platform/factory/templates',
    params
  })
}

export function fetchAppFactoryTemplate(code: string, templateVersion?: string) {
  return request.get<AppFactoryTemplateRecord>({
    url: `/api/app-platform/factory/templates/${code}`,
    params: templateVersion ? { template_version: templateVersion } : undefined
  })
}

export function fetchAppFactoryModule(code: string) {
  return request.get<AppFactoryModuleRecord>({ url: `/api/app-platform/factory/modules/${code}` })
}

export function previewAppFactoryManifest(code: string, version: string) {
  return request.get<AppFactoryManifestRecord>({
    url: `/api/app-platform/factory/modules/${code}/manifest-preview`,
    params: { version }
  })
}

export function createAppFactoryModule(params: SaveAppFactoryModuleParams) {
  return request.post<AppFactoryModuleRecord>({
    url: '/api/app-platform/factory/modules',
    data: params
  })
}

export function updateAppFactoryModule(code: string, params: SaveAppFactoryModuleParams) {
  return request.put<AppFactoryModuleRecord>({
    url: `/api/app-platform/factory/modules/${code}`,
    data: params
  })
}

export function publishAppFactoryModule(code: string, version: string, message?: string) {
  return request.post<AppFactoryModuleRecord>({
    url: `/api/app-platform/factory/modules/${code}/publish`,
    data: { version, message } satisfies PublishAppFactoryModuleParams
  })
}
