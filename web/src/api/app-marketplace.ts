import request from '@/utils/http'

export type AppPackageType = 'internal' | 'static' | 'iframe'
export type AppPackageStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'disabled'
  | 'archived'
export type AppPackageVisibility = 'platform' | 'tenant' | 'marketplace' | 'private'
export type AppOpenMode = 'internal_route' | 'iframe'

export interface AppPackageRecord {
  id: number
  code: string
  name: string
  type: AppPackageType
  category?: string
  icon?: string
  summary?: string
  description?: string
  developer_id?: number | null
  developer_name?: string
  status: AppPackageStatus
  visibility: AppPackageVisibility
  entry_mode?: string
  entry_url?: string
  system_module_code?: string
  saas_module_code?: string
  sort?: number
  remark?: string
  create_time?: string | Date | null
  update_time?: string | Date | null
}

export interface AppPackageVersionRecord {
  id: number
  app_id: number
  version: string
  manifest?: Record<string, unknown> | null
  package_path?: string
  publish_path?: string
  entry_file?: string
  file_hash?: string
  file_size?: number
  review_status: 'pending' | 'approved' | 'rejected'
  publish_status: 'unpublished' | 'published' | 'failed' | 'unpublished_retired'
  review_message?: string
  reviewer_id?: number | null
  review_time?: string | Date | null
  create_time?: string | Date | null
  update_time?: string | Date | null
}

export interface AppPackageDetailRecord extends AppPackageRecord {
  versions: AppPackageVersionRecord[]
}

export interface AppPlatformListParams {
  keyword?: string
  type?: AppPackageType | ''
  status?: AppPackageStatus | ''
}

export interface SaveAppPackageParams {
  code?: string
  name: string
  type?: AppPackageType
  category?: string
  icon?: string
  summary?: string
  description?: string
  visibility?: AppPackageVisibility
  entry_url?: string
  developer_name?: string
  system_module_code?: string
  saas_module_code?: string
  sort?: number
  remark?: string
}

export interface TenantMarketplaceAppRecord extends AppPackageRecord {
  installed: boolean
}

export interface TenantAppInstallRecord {
  id: number
  tenant_id: number
  app_id: number
  version_id?: number | null
  enabled: boolean
  source: string
  installed_by?: number | null
  installed_time?: string | Date | null
  create_time?: string | Date | null
  update_time?: string | Date | null
  app?: AppPackageRecord | null
}

export interface AppOpenMetadata {
  code: string
  name: string
  type: AppPackageType
  open_mode: AppOpenMode
  entry_url: string
  sandbox: string
  version?: string
}

export function fetchPlatformApps(params: AppPlatformListParams = {}) {
  return request.get<AppPackageRecord[]>({ url: '/api/app-platform/apps', params })
}

export function fetchPlatformApp(code: string) {
  return request.get<AppPackageDetailRecord>({ url: `/api/app-platform/apps/${code}` })
}

export function createPlatformApp(params: SaveAppPackageParams) {
  return request.post<AppPackageRecord>({ url: '/api/app-platform/apps', data: params })
}

export function updatePlatformApp(code: string, params: SaveAppPackageParams) {
  return request.put<AppPackageRecord>({ url: `/api/app-platform/apps/${code}`, data: params })
}

export function updatePlatformAppStatus(code: string, status: AppPackageStatus) {
  return request.put<AppPackageRecord>({ url: `/api/app-platform/apps/${code}/status`, data: { status } })
}

export function uploadPlatformStaticAppVersion(code: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return request.post<AppPackageVersionRecord>({
    url: `/api/app-platform/apps/${code}/versions/upload`,
    data: form,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function approvePlatformAppVersion(code: string, version: string, message?: string) {
  return request.post<AppPackageVersionRecord>({
    url: `/api/app-platform/apps/${code}/versions/${version}/approve`,
    data: { message }
  })
}

export function rejectPlatformAppVersion(code: string, version: string, message?: string) {
  return request.post<AppPackageVersionRecord>({
    url: `/api/app-platform/apps/${code}/versions/${version}/reject`,
    data: { message }
  })
}

export function publishPlatformAppVersion(code: string, version: string) {
  return request.post<AppPackageVersionRecord>({ url: `/api/app-platform/apps/${code}/versions/${version}/publish` })
}

export function fetchTenantAppMarketplace() {
  return request.get<TenantMarketplaceAppRecord[]>({ url: '/api/app-tenant/marketplace' })
}

export function fetchTenantInstalledApps() {
  return request.get<TenantAppInstallRecord[]>({ url: '/api/app-tenant/installed' })
}

export function installTenantApp(code: string) {
  return request.post<TenantAppInstallRecord>({ url: `/api/app-tenant/apps/${code}/install` })
}

export function uninstallTenantApp(code: string) {
  return request.post<{ code: string; installed: boolean }>({ url: `/api/app-tenant/apps/${code}/uninstall` })
}

export function fetchTenantAppOpenMetadata(code: string) {
  return request.get<AppOpenMetadata>({ url: `/api/app-tenant/apps/${code}/open` })
}
