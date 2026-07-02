import request from '@/utils/http'

export interface SaasSignupParams {
  username: string
  password: string
  realname: string
  tenant_name: string
  phone: string
  email: string
}

export interface SaasSignupResult {
  userId: number
  tenantId: number
}

export interface SaasTenantProvisionParams {
  tenant_name: string
  tenant_code: string
  owner_username: string
  owner_password: string
  owner_realname?: string
  plan_code?: string
  with_trial?: boolean
}

export interface TenantUsageQuotaRecord {
  resource_type: string
  quota: number
  used: number
  remaining: number
  [key: string]: any
}

export interface TenantSubscriptionSummary {
  tenantId?: number
  tenant_id?: number
  currentPlan?: string
  current_plan?: string
  planName?: string
  plan_name?: string
  subscriptionStatus?: string | number
  subscription_status?: string | number
  status?: string | number
  trialEndTime?: string | number
  trial_end_time?: string | number
  [key: string]: any
}

export function signupTenant(params: SaasSignupParams) {
  return request.post<SaasSignupResult>({
    url: '/api/saas/signup',
    data: params
  })
}

export function fetchTenantUsage() {
  return request.get<TenantUsageQuotaRecord[]>({
    url: '/api/saas/tenant/usage'
  })
}

export function fetchTenantSubscription() {
  return request.get<TenantSubscriptionSummary>({
    url: '/api/saas/tenant/subscription'
  })
}

export function createSaasTenantFromPlatform(params: SaasTenantProvisionParams) {
  return request.post<SaasSignupResult>({
    url: '/api/saas/platform/tenants',
    data: params
  })
}
