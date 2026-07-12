import request from '@/utils/http'

export type AppServiceInstanceRole = 'candidate' | 'active' | 'standby' | 'retired'
export type AppServiceProcessStatus = 'starting' | 'online' | 'stopped' | 'failed'
export type AppServiceHealthStatus = 'unknown' | 'checking' | 'healthy' | 'unhealthy'

export interface AppServiceInstanceRecord {
  id: string
  app_code: string
  version: string
  process_name: string
  loopback_port: number
  role: AppServiceInstanceRole
  process_status: AppServiceProcessStatus
  health_status: AppServiceHealthStatus
  restart_count: number
  last_health_at: string | null
  diagnostic_code: string
  diagnostic_message: string
}

export interface AppServiceRuntimeDetail {
  app_code: string
  app_name: string
  app_status: string
  active_version: string
  candidate_version: string
  standby_version: string
  instances: AppServiceInstanceRecord[]
}

export interface AppServiceRuntimeListParams {
  app_code?: string
  role?: AppServiceInstanceRole | ''
  process_status?: AppServiceProcessStatus | ''
  health_status?: AppServiceHealthStatus | ''
}

export interface AppServiceProbeResponse {
  statusCode: number
  headers?: Record<string, string>
  body: unknown
}

export interface AppServiceLogsResponse {
  app_code: string
  process_name: string
  role: AppServiceInstanceRole
  stdout: string
  stderr: string
}

export interface AppServiceReconcileResponse {
  inspected?: number
  restarted?: number
  stopped?: number
  failed?: number
}

export function fetchAppServiceInstances(params: AppServiceRuntimeListParams = {}) {
  return request.get<AppServiceInstanceRecord[]>({
    url: '/api/app-platform/runtime/instances',
    params
  })
}

export function fetchAppServiceRuntimeDetail(code: string) {
  return request.get<AppServiceRuntimeDetail>({
    url: `/api/app-platform/runtime/apps/${code}`
  })
}

export function startAppServiceCandidate(code: string, version: string) {
  return request.post<AppServiceRuntimeDetail>({
    url: `/api/app-platform/runtime/apps/${code}/versions/${version}/candidate`
  })
}

export function stopAppServiceCandidate(code: string, version: string, reason: string) {
  return request.post<AppServiceRuntimeDetail>({
    url: `/api/app-platform/runtime/apps/${code}/versions/${version}/candidate/stop`,
    data: { reason }
  })
}

export function publishAppServiceCandidate(code: string, version: string) {
  return request.post<AppServiceRuntimeDetail>({
    url: `/api/app-platform/runtime/apps/${code}/versions/${version}/publish`
  })
}

export function rollbackAppServiceVersion(code: string, version: string, reason: string) {
  return request.post<AppServiceRuntimeDetail>({
    url: `/api/app-platform/runtime/apps/${code}/versions/${version}/rollback`,
    data: { reason }
  })
}

export function probeAppService(code: string, payload: Record<string, unknown>) {
  return request.post<AppServiceProbeResponse>({
    url: `/api/app-platform/runtime/apps/${code}/probe`,
    data: { payload }
  })
}

export function fetchAppServiceLogs(code: string, lines = 100) {
  return request.get<AppServiceLogsResponse>({
    url: `/api/app-platform/runtime/apps/${code}/logs`,
    params: { lines }
  })
}

export function reconcileAppServiceRuntime() {
  return request.post<AppServiceReconcileResponse>({
    url: '/api/app-platform/runtime/reconcile'
  })
}
