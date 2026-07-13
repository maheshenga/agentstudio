import request from '@/utils/http'

export type AppPricingModel = 'free' | 'included' | 'subscription' | 'one_time'
export type AppBillingPeriod = 'none' | 'monthly' | 'yearly'
export type AppCommerceAccessStatus =
  | 'legacy_free'
  | 'free'
  | 'included'
  | 'trialing'
  | 'licensed'
  | 'purchase_required'
  | 'expired'
  | 'revoked'
export type AppCommerceAction =
  | 'install'
  | 'open'
  | 'start_trial'
  | 'purchase'
  | 'renew'
  | 'contact_admin'

export interface AppPricePlanRecord {
  id: number
  app_id: number
  code: string
  name: string
  pricing_model: AppPricingModel
  billing_period: AppBillingPeriod
  amount_cents: number
  currency: 'CNY'
  trial_days: number
  developer_share_bps?: number
  included_plan_codes?: string[]
  sale_scope?: 'all' | 'selected_tenants'
  tenant_ids?: number[]
  status?: number
  sort: number
  create_time?: string | Date | null
  update_time?: string | Date | null
}

export interface TenantAppCommerceAccess {
  commerce_enabled: boolean
  access_status: AppCommerceAccessStatus
  can_install: boolean
  can_open: boolean
  action: AppCommerceAction
  license_expires_at: string | null
  plans: AppPricePlanRecord[]
}

export type AppOrderStatus = 'pending' | 'paid' | 'refunded' | 'closed'

export interface AppOrderRecord {
  id: number
  order_no: string
  tenant_id?: number
  app_id: number
  app_code: string
  app_name: string
  price_plan_id: number
  price_plan_code: string
  pricing_model: 'subscription' | 'one_time'
  billing_period: AppBillingPeriod
  amount_cents: number
  currency: 'CNY'
  payment_method: 'alipay'
  status: AppOrderStatus
  alipay_trade_no?: string | null
  paid_at?: string | Date | null
  refunded_at?: string | Date | null
  payment_requested_at?: string | Date | null
  closed_at?: string | Date | null
  close_reason?: string
  create_time?: string | Date | null
}

export interface TenantAppLicenseRecord {
  id: number
  tenant_id?: number
  app_id: number
  price_plan_id: number | null
  order_id: number | null
  source: 'trial' | 'order' | 'platform'
  status: 'active' | 'trialing' | 'expired' | 'revoked' | 'refunded'
  effective_at: string | Date
  expires_at: string | Date | null
  revoked_at: string | Date | null
  create_time?: string | Date | null
}

export interface AppCommercePageResult<T> {
  list: T[]
  total: number
  page: number
  limit: number
}

export interface AppRevenueAmounts {
  gross_amount_cents: number
  refund_amount_cents: number
  developer_amount_cents: number
  unsettled_developer_amount_cents: number
  order_count: number
  platform_amount_cents?: number
}

export interface AppRevenueOverview {
  period: { start_date: string | null; end_date: string | null }
  currency: 'CNY'
  totals: AppRevenueAmounts
  apps: Array<
    AppRevenueAmounts & {
      app_id: number
      app_code: string
      app_name: string
      developer_id?: number | null
    }
  >
}

export interface AppSettlementRecord {
  id: number
  batch_no: string
  developer_id?: number
  period_start: string
  period_end: string
  gross_amount_cents: number
  refund_amount_cents: number
  developer_amount_cents: number
  order_count: number
  ledger_count?: number
  currency: 'CNY'
  status: 'draft' | 'approved' | 'paid' | 'cancelled'
  reviewed_by?: number | null
  reviewed_at?: string | Date | null
  paid_by?: number | null
  paid_at?: string | Date | null
  payment_reference?: string
  note?: string
  create_time?: string | Date | null
  update_time?: string | Date | null
}

export interface AppOrderListParams {
  page?: number
  limit?: number
  order_no?: string
  app_code?: string
  status?: AppOrderStatus | ''
  tenant_id?: number
  developer_id?: number
}

export interface AppLicenseListParams {
  page?: number
  limit?: number
  tenant_id?: number
  app_id?: number
  status?: TenantAppLicenseRecord['status'] | ''
}

export interface AppRevenueQuery {
  start_date?: string
  end_date?: string
  app_code?: string
}

export interface AppSettlementListParams {
  page?: number
  limit?: number
  developer_id?: number
  period?: string
  status?: AppSettlementRecord['status'] | ''
}

export interface SaveAppPricePlanParams {
  code: string
  name: string
  pricing_model: AppPricingModel
  billing_period: AppBillingPeriod
  amount_cents: number
  trial_days?: number
  developer_share_bps?: number
  included_plan_codes?: string[]
  sale_scope?: 'all' | 'selected_tenants'
  tenant_ids?: number[]
  status?: number
  sort?: number
}

export interface AppAlipayPaymentResult {
  configured: boolean
  provider: 'alipay'
  order_no: string
  pay_url: string | null
  message: string
}

export function fetchTenantAppCommerce(code: string) {
  return request.get<TenantAppCommerceAccess>({ url: `/api/app-tenant/commerce/apps/${code}` })
}

export function startTenantAppTrial(code: string, pricePlanCode: string) {
  return request.post<TenantAppLicenseRecord>({
    url: `/api/app-tenant/commerce/apps/${code}/trial`,
    data: { price_plan_code: pricePlanCode }
  })
}

export function createTenantAppOrder(code: string, pricePlanCode: string) {
  return request.post<AppOrderRecord>({
    url: `/api/app-tenant/commerce/apps/${code}/orders`,
    data: { price_plan_code: pricePlanCode, payment_method: 'alipay' }
  })
}

export function fetchTenantAppOrders(params: AppOrderListParams = {}) {
  return request.get<AppCommercePageResult<AppOrderRecord>>({
    url: '/api/app-tenant/commerce/orders',
    params
  })
}

export function fetchTenantAppOrder(orderNo: string) {
  return request.get<AppOrderRecord>({ url: `/api/app-tenant/commerce/orders/${orderNo}` })
}

export function startAppAlipayPayment(orderNo: string) {
  return request.post<AppAlipayPaymentResult>({
    url: '/api/saas/payment/alipay/create',
    data: { order_no: orderNo, order_type: 'app' }
  })
}

export function devConfirmAppPayment(orderNo: string) {
  return request.post<AppOrderRecord>({
    url: '/api/saas/payment/dev-confirm',
    data: { order_no: orderNo, order_type: 'app' }
  })
}

export function fetchPlatformAppPricePlans(code: string) {
  return request.get<AppPricePlanRecord[]>({
    url: `/api/app-platform/commerce/apps/${code}/prices`
  })
}

export function createPlatformAppPricePlan(code: string, data: SaveAppPricePlanParams) {
  return request.post<AppPricePlanRecord>({
    url: `/api/app-platform/commerce/apps/${code}/prices`,
    data
  })
}

export function updatePlatformAppPricePlan(
  code: string,
  planCode: string,
  data: Partial<SaveAppPricePlanParams>
) {
  return request.put<AppPricePlanRecord>({
    url: `/api/app-platform/commerce/apps/${code}/prices/${planCode}`,
    data
  })
}

export function updatePlatformAppPricePlanStatus(code: string, planCode: string, status: number) {
  return request.put<AppPricePlanRecord>({
    url: `/api/app-platform/commerce/apps/${code}/prices/${planCode}/status`,
    data: { status }
  })
}

export function fetchPlatformAppOrders(params: AppOrderListParams = {}) {
  return request.get<AppCommercePageResult<AppOrderRecord>>({
    url: '/api/app-platform/commerce/orders',
    params
  })
}

export function refundPlatformAppOrder(orderNo: string, reason: string, providerReference: string) {
  return request.post<AppOrderRecord>({
    url: `/api/app-platform/commerce/orders/${orderNo}/refund`,
    data: { reason, provider_reference: providerReference }
  })
}

export function fetchPlatformAppLicenses(params: AppLicenseListParams = {}) {
  return request.get<AppCommercePageResult<TenantAppLicenseRecord>>({
    url: '/api/app-platform/commerce/licenses',
    params
  })
}

export function revokePlatformAppLicense(id: number, reason: string) {
  return request.put<TenantAppLicenseRecord>({
    url: `/api/app-platform/commerce/licenses/${id}/revoke`,
    data: { reason }
  })
}

export function fetchPlatformAppRevenue(params: AppRevenueQuery = {}) {
  return request.get<AppRevenueOverview>({ url: '/api/app-platform/commerce/revenue', params })
}

export function fetchPlatformAppSettlements(params: AppSettlementListParams = {}) {
  return request.get<AppCommercePageResult<AppSettlementRecord>>({
    url: '/api/app-platform/commerce/settlements',
    params
  })
}

export function createPlatformAppSettlement(developerId: number, period: string) {
  return request.post<AppSettlementRecord>({
    url: '/api/app-platform/commerce/settlements',
    data: { developer_id: developerId, period }
  })
}

export function approvePlatformAppSettlement(id: number, note: string) {
  return request.post<AppSettlementRecord>({
    url: `/api/app-platform/commerce/settlements/${id}/approve`,
    data: { note }
  })
}

export function markPlatformAppSettlementPaid(id: number, paymentReference: string) {
  return request.post<AppSettlementRecord>({
    url: `/api/app-platform/commerce/settlements/${id}/paid`,
    data: { payment_reference: paymentReference }
  })
}

export function cancelPlatformAppSettlement(id: number, note: string) {
  return request.post<AppSettlementRecord>({
    url: `/api/app-platform/commerce/settlements/${id}/cancel`,
    data: { note }
  })
}

export function fetchDeveloperAppRevenue(params: AppRevenueQuery = {}) {
  return request.get<AppRevenueOverview>({ url: '/api/app-developer/commerce/revenue', params })
}

export function fetchDeveloperAppSettlements(params: AppSettlementListParams = {}) {
  return request.get<AppCommercePageResult<AppSettlementRecord>>({
    url: '/api/app-developer/commerce/settlements',
    params
  })
}
