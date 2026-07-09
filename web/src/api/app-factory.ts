import request from '@/utils/http'

export type AppFactoryModuleKind = 'static_page'
export type AppFactoryModuleStatus = 'draft' | 'published' | 'disabled' | 'archived'
export type AppFactoryModuleVisibility = 'platform' | 'tenant' | 'marketplace' | 'private'

export interface AppFactoryModuleRecord {
  id: number
  code: string
  name: string
  kind: AppFactoryModuleKind
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

export interface AppFactoryListParams {
  keyword?: string
  status?: AppFactoryModuleStatus | ''
}

export interface SaveAppFactoryModuleParams {
  code?: string
  name: string
  kind?: AppFactoryModuleKind
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

export function fetchAppFactoryModule(code: string) {
  return request.get<AppFactoryModuleRecord>({ url: `/api/app-platform/factory/modules/${code}` })
}

export function createAppFactoryModule(params: SaveAppFactoryModuleParams) {
  return request.post<AppFactoryModuleRecord>({ url: '/api/app-platform/factory/modules', data: params })
}

export function updateAppFactoryModule(code: string, params: SaveAppFactoryModuleParams) {
  return request.put<AppFactoryModuleRecord>({ url: `/api/app-platform/factory/modules/${code}`, data: params })
}

export function publishAppFactoryModule(code: string, version: string, message?: string) {
  return request.post<AppFactoryModuleRecord>({
    url: `/api/app-platform/factory/modules/${code}/publish`,
    data: { version, message } satisfies PublishAppFactoryModuleParams
  })
}
