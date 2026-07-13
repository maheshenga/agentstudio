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
  explicit_enabled?: boolean
  plan_enabled?: boolean
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

export interface SystemModuleSaasBridgeRecord {
  id?: number | string
  saas_module_code: string
  system_module_code: string
  enabled: boolean
  source?: string
  remark?: string
  create_time?: string | Date
  update_time?: string | Date
}

export interface SystemModuleAccessDiagnosis {
  module_code: string
  module_name?: string
  allowed: boolean
  status: string
  reason: string
  required_saas_module_codes: string[]
  missing_saas_module_codes: string[]
  tenant_saas_module_codes: string[]
  tenant_enabled: boolean
  tenant_entitlement_source?: string | null
  suggestions: string[]
  dependency_code?: string
  permission?: string
  system_module_status?: string
}

export interface SystemModuleSaasBridgeListParams {
  saas_module_code?: string
  system_module_code?: string
  enabled?: number | string
}

export interface SaveSystemModuleSaasBridgeParams {
  saas_module_code: string
  system_module_code: string
  enabled?: number
  remark?: string
}

export interface SystemTenantModuleGrantRecord {
  id?: number | string
  tenant_id: number
  module_code: string
  enabled: boolean
  source: string
  start_time?: string | Date | null
  end_time?: string | Date | null
  create_time?: string | Date | null
  update_time?: string | Date | null
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

export function fetchSystemModuleSaasBridges(params?: SystemModuleSaasBridgeListParams) {
  return request.get<SystemModuleSaasBridgeRecord[]>({
    url: '/api/system/modules/saas-bridges',
    params
  })
}

export function saveSystemModuleSaasBridge(params: SaveSystemModuleSaasBridgeParams) {
  return request.post<SystemModuleSaasBridgeRecord>({
    url: '/api/system/modules/saas-bridges',
    data: params
  })
}

export function updateSystemModuleSaasBridgeStatus(id: number | string, enabled: number) {
  return request.put<SystemModuleSaasBridgeRecord>({
    url: `/api/system/modules/saas-bridges/${id}/status`,
    data: { enabled }
  })
}

export function fetchPlatformTenantModuleGrants(tenantId: number) {
  return request.get<SystemModuleRecord[]>({
    url: `/api/system/modules/tenant-grants/${tenantId}`
  })
}

export function grantPlatformTenantModule(tenantId: number, code: string, reason?: string) {
  return request.post<SystemTenantModuleGrantRecord>({
    url: `/api/system/modules/tenant-grants/${tenantId}/${code}/grant`,
    data: { reason }
  })
}

export function revokePlatformTenantModule(tenantId: number, code: string, reason?: string) {
  return request.post<SystemTenantModuleGrantRecord>({
    url: `/api/system/modules/tenant-grants/${tenantId}/${code}/revoke`,
    data: { reason }
  })
}

export function fetchTenantSystemModules() {
  return request.get<SystemModuleRecord[]>({ url: '/api/tenant/modules' })
}

export function fetchTenantSystemModuleAccessDiagnosis(code: string) {
  return request.get<SystemModuleAccessDiagnosis>({
    url: `/api/tenant/modules/${code}/access-diagnosis`
  })
}
