import request from '@/utils/http'
import type {
  AppPackageDetailRecord,
  AppPackageRecord,
  AppPackageVersionRecord
} from '@/api/app-marketplace'

export interface DeveloperAppRecord extends AppPackageRecord {
  latest_version?: string
  latest_review_status?: AppPackageVersionRecord['review_status'] | ''
  latest_publish_status?: AppPackageVersionRecord['publish_status'] | ''
  latest_review_message?: string
}

export interface SaveDeveloperAppParams {
  code?: string
  name: string
  category?: string
  icon?: string
  summary?: string
  description?: string
  runtime_type?: 'static' | 'iframe' | 'service'
  entry_url?: string
  allowed_origins?: string[]
  requested_capabilities?: string[]
  screenshots?: string[]
  documentation_url?: string
  support_url?: string
  changelog?: string
}

export interface DeveloperServiceRuntimeRecord {
  app_code: string
  app_name: string
  version: string
  role: 'active' | 'candidate' | 'standby' | 'unavailable'
  process_status: 'starting' | 'online' | 'stopped' | 'failed'
  health_status: 'unknown' | 'checking' | 'healthy' | 'unhealthy'
  circuit_state: 'closed' | 'open' | 'half_open'
  restart_count: number
  success_count: number
  failure_count: number
  rejected_count: number
  total_count: number
  success_rate: number
  p50_duration_ms: number
  p95_duration_ms: number
  last_invoke_time: string | null
  last_success_time: string | null
}

export interface DeveloperServiceOverview {
  days: 1 | 7 | 30
  total_services: number
  total_invocations: number
  total_success: number
  total_failure: number
  total_rejected: number
  success_rate: number
  services: DeveloperServiceRuntimeRecord[]
}

export interface DeveloperServiceLogResponse {
  app_code: string
  version: string
  role: 'active' | 'candidate' | 'standby'
  stdout: string
  stderr: string
}

export function fetchDeveloperApps() {
  return request.get<DeveloperAppRecord[]>({ url: '/api/app-developer/apps' })
}

export function fetchDeveloperApp(code: string) {
  return request.get<AppPackageDetailRecord>({ url: `/api/app-developer/apps/${code}` })
}

export function createDeveloperApp(params: SaveDeveloperAppParams) {
  return request.post<DeveloperAppRecord>({ url: '/api/app-developer/apps', data: params })
}

export function updateDeveloperApp(code: string, params: SaveDeveloperAppParams) {
  return request.put<DeveloperAppRecord>({ url: `/api/app-developer/apps/${code}`, data: params })
}

export function uploadDeveloperAppVersion(code: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return request.post<AppPackageVersionRecord>({
    url: `/api/app-developer/apps/${code}/versions/upload`,
    data: form,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function submitDeveloperAppVersion(code: string, version: string) {
  return request.post<AppPackageVersionRecord>({
    url: `/api/app-developer/apps/${code}/versions/${version}/submit`
  })
}

export function fetchDeveloperServiceOverview(days: 1 | 7 | 30 = 7) {
  return request.get<DeveloperServiceOverview>({
    url: '/api/app-developer/apps/service-overview',
    params: { days }
  })
}

export function fetchDeveloperServiceLogs(code: string, lines = 100) {
  return request.get<DeveloperServiceLogResponse>({
    url: `/api/app-developer/apps/${encodeURIComponent(code)}/runtime/logs`,
    params: { lines }
  })
}
