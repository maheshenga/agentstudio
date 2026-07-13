import request from '@/utils/http'
import type { AppRuntimeBootstrap } from '@/utils/app-runtime'
import type { AppCommerceAction, TenantAppCommerceAccess } from '@/api/app-commerce'

export type AppPackageType = 'internal' | 'static' | 'iframe' | 'service'
export type AppRuntimeType = 'static' | 'iframe' | 'service' | 'native'
export type AppTrustLevel =
  | 'platform_trusted'
  | 'developer_restricted'
  | 'external_managed'
  | 'static_sandboxed'
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
export type AppAvailabilityStatus =
  | 'available'
  | 'missing_plan_module'
  | 'missing_system_module'
  | 'system_module_unavailable'

export interface FrozenAppReviewSnapshot {
  schema_version: 1
  app: {
    id: string
    code: string
    name: string
    type: 'service'
    runtime_type: 'service'
    trust_level: 'developer_restricted'
    category: string
    summary: string
    description: string
    developer_id: string
    developer_name: string
  }
  version: {
    id: string
    version: string
    manifest: Record<string, unknown>
    package_sha256: string
    entry_sha256: string
    file_size: number
    requested_capabilities: string[]
    service_targets: string[]
    scan: {
      passed: boolean
      scanned_files: number
      findings: Array<{
        code: string
        severity: 'warning' | 'error'
        line?: number
        column?: number
      }>
    }
  }
  developer: {
    profile_id: string
    certification_status: 'certified'
    approved_runtime_types: Array<'static' | 'iframe' | 'service'>
    risk_level: 'low' | 'medium' | 'high'
    certification_expiry: string
  }
  submitted_at: string
}

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
  runtime_type?: AppRuntimeType
  trust_level?: AppTrustLevel
  service_health_path?: string
  system_module_code?: string
  saas_module_code?: string
  available?: boolean
  availability_status?: AppAvailabilityStatus
  availability_reason?: string
  required_saas_module_code?: string
  required_system_module_code?: string
  sort?: number
  remark?: string
  create_time?: string | Date | null
  update_time?: string | Date | null
  commerce?: TenantAppCommerceAccess
  can_install?: boolean
  can_open?: boolean
  commerce_action?: AppCommerceAction
  service_status?: 'ready' | 'update_required' | 'unavailable'
  service_version?: string
  service_callable?: boolean
}

export interface AppPackageVersionRecord {
  id: number
  app_id: number
  version: string
  manifest?: Record<string, unknown> | null
  manifest_version?: number
  package_format?: 'static_zip' | 'iframe_config' | 'service_zip' | 'native'
  scan_result?: {
    passed: boolean
    findings: Array<{
      code: string
      severity: 'warning' | 'error'
      line?: number
      column?: number
    }>
    scannedFiles: number
    entrySha256: string
  } | null
  review_snapshot?: FrozenAppReviewSnapshot | null
  review_snapshot_hash?: string
  submitted_time?: string | Date | null
  service_targets?: string[]
  candidate_health_status?: 'unknown' | 'checking' | 'healthy' | 'unhealthy'
  candidate_reviewed_by?: number | null
  candidate_reviewed_time?: string | Date | null
  requested_capabilities?: string[]
  approved_capabilities?: string[]
  package_path?: string
  publish_path?: string
  entry_file?: string
  entry_url?: string
  is_active?: boolean
  file_hash?: string
  file_size?: number
  review_status: 'pending' | 'approved' | 'rejected'
  publish_status: 'unpublished' | 'published' | 'failed' | 'unpublished_retired'
  review_message?: string
  reviewer_id?: number | null
  submitted_by?: number | null
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

export interface AppReviewQueueParams {
  keyword?: string
  type?: AppPackageType | ''
  review_status?: AppPackageVersionRecord['review_status'] | ''
  publish_status?: AppPackageVersionRecord['publish_status'] | ''
}

export interface AppReviewQueueRecord extends AppPackageVersionRecord {
  app_code: string
  app_name: string
  app_type: AppPackageType
  app_status: AppPackageStatus
  trust_level?: AppTrustLevel
  category?: string
  developer_name?: string
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
  version?: string
  allowed_origins?: string[]
  requested_capabilities?: string[]
  developer_name?: string
  system_module_code?: string
  saas_module_code?: string
  sort?: number
  remark?: string
}

export interface AppIframeLaunchMetadata {
  fragment: string
  expires_at: string
  origin: string
}

export interface AppRuntimeSessionMetadata {
  token: string
  expires_at: string
  capabilities?: string[]
}

export interface TenantMarketplaceAppRecord extends AppPackageRecord {
  installed: boolean
  requested_capabilities: string[]
  platform_approved_capabilities: string[]
  tenant_approved_capabilities: string[]
  effective_capabilities: string[]
  commerce: TenantAppCommerceAccess
  can_install: boolean
  can_open: boolean
  commerce_action: AppCommerceAction
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
  requested_capabilities: string[]
  platform_approved_capabilities: string[]
  tenant_approved_capabilities: string[]
  effective_capabilities: string[]
}

export interface AppOpenMetadata {
  code: string
  name: string
  type: AppPackageType
  open_mode: AppOpenMode
  entry_url: string
  sandbox: string
  version?: string
  runtime: AppRuntimeBootstrap | null
  launch?: AppIframeLaunchMetadata | null
}

export function fetchPlatformApps(params: AppPlatformListParams = {}) {
  return request.get<AppPackageRecord[]>({ url: '/api/app-platform/apps', params })
}

export function fetchPlatformApp(code: string) {
  return request.get<AppPackageDetailRecord>({ url: `/api/app-platform/apps/${code}` })
}

export function fetchPlatformAppReviews(params: AppReviewQueueParams = {}) {
  return request.get<AppReviewQueueRecord[]>({ url: '/api/app-platform/reviews', params })
}

export function createPlatformApp(params: SaveAppPackageParams) {
  return request.post<AppPackageRecord>({ url: '/api/app-platform/apps', data: params })
}

export function updatePlatformApp(code: string, params: SaveAppPackageParams) {
  return request.put<AppPackageRecord>({ url: `/api/app-platform/apps/${code}`, data: params })
}

export function updatePlatformAppStatus(code: string, status: AppPackageStatus) {
  return request.put<AppPackageRecord>({
    url: `/api/app-platform/apps/${code}/status`,
    data: { status }
  })
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

export function uploadPlatformServiceAppVersion(code: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return request.post<AppPackageVersionRecord>({
    url: `/api/app-platform/apps/${code}/versions/service-upload`,
    data: form,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function approvePlatformAppVersion(
  code: string,
  version: string,
  message?: string,
  approvedCapabilities?: string[]
) {
  return request.post<AppPackageVersionRecord>({
    url: `/api/app-platform/apps/${code}/versions/${version}/approve`,
    data: { message, approved_capabilities: approvedCapabilities }
  })
}

export function rejectPlatformAppVersion(code: string, version: string, message?: string) {
  return request.post<AppPackageVersionRecord>({
    url: `/api/app-platform/apps/${code}/versions/${version}/reject`,
    data: { message }
  })
}

export function publishPlatformAppVersion(code: string, version: string) {
  return request.post<AppPackageVersionRecord>({
    url: `/api/app-platform/apps/${code}/versions/${version}/publish`
  })
}

export function unpublishPlatformAppVersion(code: string, version: string, message?: string) {
  return request.post<AppPackageVersionRecord>({
    url: `/api/app-platform/apps/${code}/versions/${version}/unpublish`,
    data: { message }
  })
}

export function rollbackPlatformAppVersion(code: string, version: string, message?: string) {
  return request.post<AppPackageVersionRecord>({
    url: `/api/app-platform/apps/${code}/versions/${version}/rollback`,
    data: { message }
  })
}

export function fetchTenantAppMarketplace() {
  return request.get<TenantMarketplaceAppRecord[]>({ url: '/api/app-tenant/marketplace' })
}

export function fetchTenantInstalledApps() {
  return request.get<TenantAppInstallRecord[]>({ url: '/api/app-tenant/installed' })
}

export function installTenantApp(code: string, capabilities: string[] = []) {
  return request.post<TenantAppInstallRecord>({
    url: `/api/app-tenant/apps/${code}/install`,
    data: { capabilities }
  })
}

export function fetchTenantAppCapabilities(code: string) {
  return request.get<{
    requested: string[]
    platform_approved: string[]
    tenant_approved: string[]
    effective: string[]
  }>({ url: `/api/app-tenant/apps/${code}/capabilities` })
}

export function updateTenantAppCapabilities(code: string, capabilities: string[]) {
  return request.put<{
    requested: string[]
    platform_approved: string[]
    tenant_approved: string[]
    effective: string[]
  }>({
    url: `/api/app-tenant/apps/${code}/capabilities`,
    data: { capabilities }
  })
}

export function uninstallTenantApp(code: string) {
  return request.post<{ code: string; installed: boolean }>({
    url: `/api/app-tenant/apps/${code}/uninstall`
  })
}

export function fetchTenantAppOpenMetadata(code: string) {
  return request.get<AppOpenMetadata>({ url: `/api/app-tenant/apps/${code}/open` })
}

export function exchangeIframeLaunch(launchToken: string, signal?: AbortSignal) {
  return request.post<AppRuntimeSessionMetadata>({
    url: '/api/app-tenant/runtime/iframe/exchange',
    data: { launch_token: launchToken },
    signal,
    showErrorMessage: false
  })
}
