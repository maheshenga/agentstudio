import request from '@/utils/http'

export interface SystemModuleRecord {
  id?: number | string
  code: string
  name: string
  source: string
  version: string
  description?: string
  category?: string
  icon?: string
  status: string
  entry_route?: string
  manifest?: Record<string, any> | string | null
  config_schema?: Record<string, any> | string | null
  health_status?: string
  sort?: number
  remark?: string
  tenant_enabled?: boolean | number
  entitlement_source?: string
  create_time?: string | Date
  update_time?: string | Date
  dependencies?: SystemModuleDependencyRecord[]
  permissions?: SystemModulePermissionRecord[]
  apis?: SystemModuleApiRecord[]
  events?: SystemModuleEventRecord[]
}

export interface SystemModuleDependencyRecord {
  depends_on_code: string
  version_range?: string
  required?: boolean
}

export interface SystemModulePermissionRecord {
  permission_slug: string
  binding_type?: string
}

export interface SystemModuleApiRecord {
  method: string
  path: string
  permission_slug?: string
  tenant_scoped?: boolean
}

export interface SystemModuleEventRecord {
  id: number | string
  moduleCode?: string
  module_code?: string
  eventType?: string
  event_type?: string
  status: string
  message: string
  metadata?: Record<string, any> | string | null
  createTime?: string | Date
  create_time?: string | Date
}

export interface SystemModuleListParams {
  keyword?: string
  source?: string
  status?: string
}

export function fetchSystemModules(params?: SystemModuleListParams) {
  return request.get<SystemModuleRecord[]>({ url: '/api/system/modules', params })
}

export function fetchSystemModule(code: string) {
  return request.get<SystemModuleRecord>({ url: `/api/system/modules/${code}` })
}

export function updateSystemModuleStatus(code: string, status: string) {
  return request.put<SystemModuleRecord>({
    url: `/api/system/modules/${code}/status`,
    data: { status }
  })
}

export function fetchSystemModuleEvents(code: string) {
  return request.get<SystemModuleEventRecord[]>({ url: `/api/system/modules/${code}/events` })
}

export function registerBuiltInSystemModules() {
  return request.post<SystemModuleRecord[]>({ url: '/api/system/modules/register-built-ins' })
}

export function fetchTenantSystemModules() {
  return request.get<SystemModuleRecord[]>({ url: '/api/tenant/modules' })
}
