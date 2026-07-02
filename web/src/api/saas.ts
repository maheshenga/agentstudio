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

export interface SaasPlanOption {
  id: number
  code: string
  name: string
  billing_cycle: string
  price_monthly: number
  price_yearly: number
}

export interface SaasOrderRecord {
  order_no: string
  plan_code: string
  amount_cents: number
  status: string
  payment_method?: string
  alipay_trade_no?: string
  paid_at?: string | Date
}

export interface AlipayPaymentResult {
  configured: boolean
  provider: 'alipay'
  order_no: string
  pay_url: string | null
  message: string
}

export interface CreateSaasOrderParams {
  plan_code: string
  billing_cycle?: 'monthly' | 'yearly'
  payment_method?: string
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

export function fetchTenantPlans() {
  return request.get<SaasPlanOption[]>({
    url: '/api/saas/tenant/plans'
  })
}

export function createTenantUpgradeOrder(params: CreateSaasOrderParams) {
  return request.post<SaasOrderRecord>({
    url: '/api/saas/tenant/orders',
    data: params
  })
}

export function fetchTenantOrder(orderNo: string) {
  return request.get<SaasOrderRecord>({
    url: `/api/saas/tenant/orders/${orderNo}`
  })
}

export function devConfirmTenantPayment(orderNo: string) {
  return request.post<SaasOrderRecord>({
    url: '/api/saas/payment/dev-confirm',
    data: {
      order_no: orderNo
    }
  })
}

export function createAlipayPayment(orderNo: string) {
  return request.post<AlipayPaymentResult>({
    url: '/api/saas/payment/alipay/create',
    data: {
      order_no: orderNo
    }
  })
}

export function createSaasTenantFromPlatform(params: SaasTenantProvisionParams) {
  return request.post<SaasSignupResult>({
    url: '/api/saas/platform/tenants',
    data: params
  })
}
