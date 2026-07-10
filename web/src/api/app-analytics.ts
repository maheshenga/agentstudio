import request from '@/utils/http'

export const APP_ANALYTICS_WINDOWS = [7, 30, 90] as const
export type AppAnalyticsWindow = (typeof APP_ANALYTICS_WINDOWS)[number]

export interface AppAnalyticsTrendPoint {
  date: string
  successful_opens: number
  failed_opens: number
}

export interface AppAnalyticsFailure {
  app_code: string
  app_name: string
  outcome: 'failed'
  reason_code: string
  failure_message: string
  create_time?: string | Date | null
}

export interface PlatformAppAnalyticsFailure extends AppAnalyticsFailure {
  tenant_id: number
  user_id?: number | null
}

export interface PlatformAppAnalyticsSummary {
  published_apps: number
  active_installations: number
  new_installations: number
  total_opens: number
  successful_opens: number
  failed_opens: number
  entitlement_blockers: number
  unique_tenants: number
  unique_users: number
  success_rate: number
}

export interface PlatformAppAnalyticsRow {
  app_id: number
  code: string
  name: string
  type: string
  active_installations: number
  new_installations: number
  total_opens: number
  successful_opens: number
  failed_opens: number
  entitlement_blockers: number
  unique_tenants: number
  success_rate: number
}

export interface PlatformAppAnalyticsOverview {
  window_days: AppAnalyticsWindow
  summary: PlatformAppAnalyticsSummary
  trend: AppAnalyticsTrendPoint[]
  apps: PlatformAppAnalyticsRow[]
  recent_failures: PlatformAppAnalyticsFailure[]
}

export interface PlatformAppIdentity {
  app_id: number
  code: string
  name: string
  type: string
  category: string
}

export type PlatformAppDetailSummary = Omit<PlatformAppAnalyticsSummary, 'published_apps'>

export interface AppVersionInstallationAdoption {
  version_id?: number | null
  version: string
  installations: number
  percentage: number
}

export interface AppTenantAdoption {
  tenant_id: number
  version: string
  installed_time?: string | Date | null
  total_opens: number
  successful_opens: number
  failed_opens: number
  success_rate: number
  last_open_time?: string | Date | null
}

export interface PlatformAppAnalyticsDetail {
  window_days: AppAnalyticsWindow
  app: PlatformAppIdentity
  summary: PlatformAppDetailSummary
  trend: AppAnalyticsTrendPoint[]
  version_adoption: AppVersionInstallationAdoption[]
  tenant_adoption: AppTenantAdoption[]
  recent_failures: PlatformAppAnalyticsFailure[]
}

export interface TenantAppUsageSummary {
  enabled_apps: number
  total_opens: number
  successful_opens: number
  failed_opens: number
  entitlement_blockers: number
  success_rate: number
}

export interface TenantInstalledAppUsage {
  app_id: number
  code: string
  name: string
  type: string
  version_id?: number | null
  version: string
  installed_time?: string | Date | null
  total_opens: number
  successful_opens: number
  failed_opens: number
  entitlement_blockers: number
  success_rate: number
  last_open_time?: string | Date | null
}

export interface TenantAppVersionAdoption {
  app_code: string
  app_name: string
  version_id?: number | null
  version: string
  successful_opens: number
  percentage: number
}

export interface TenantAppUsageOverview {
  window_days: AppAnalyticsWindow
  summary: TenantAppUsageSummary
  trend: AppAnalyticsTrendPoint[]
  apps: TenantInstalledAppUsage[]
  version_adoption: TenantAppVersionAdoption[]
  recent_failures: AppAnalyticsFailure[]
}

export function fetchPlatformAppAnalyticsOverview(days: AppAnalyticsWindow = 30) {
  return request.get<PlatformAppAnalyticsOverview>({
    url: '/api/app-analytics/platform/overview',
    params: { days }
  })
}

export function fetchPlatformAppAnalyticsDetail(code: string, days: AppAnalyticsWindow = 30) {
  return request.get<PlatformAppAnalyticsDetail>({
    url: `/api/app-analytics/platform/apps/${encodeURIComponent(code)}`,
    params: { days }
  })
}

export function fetchTenantAppUsageOverview(days: AppAnalyticsWindow = 30) {
  return request.get<TenantAppUsageOverview>({
    url: '/api/app-analytics/tenant/overview',
    params: { days }
  })
}
