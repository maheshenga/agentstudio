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

export interface TenantUsageSummary {
  tenantId?: number
  usedSeats?: number
  maxSeats?: number
  [key: string]: any
}

export function signupTenant(params: SaasSignupParams) {
  return request.post<SaasSignupResult>({
    url: '/api/saas/signup',
    data: params
  })
}

export function fetchTenantUsage() {
  return request.get<TenantUsageSummary>({
    url: '/api/saas/tenant/usage'
  })
}
