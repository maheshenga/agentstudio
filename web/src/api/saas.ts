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

export interface SaasPlatformListParams {
  page?: number
  limit?: number
  status?: string
  tenant_id?: number | string
}

export interface SaasPlatformPageResult<T> {
  list: T[]
  total: number
  page: number
  limit: number
}

export interface SaasPlatformOrderListParams extends SaasPlatformListParams {
  order_no?: string
  plan_code?: string
}

export interface SaasPlatformSubscriptionListParams extends SaasPlatformListParams {
  plan_id?: number | string
  plan_code?: string
  lifecycle_status?: 'active' | 'expiring' | 'expired' | string
  expires_within_days?: number | string
  expired_since_days?: number | string
}

export interface SaasPlatformOrderRecord {
  id: number
  order_no: string
  tenant_id: number
  plan_id: number
  plan_code: string
  billing_cycle: string
  amount_cents: number
  currency: string
  payment_method: string
  status: string
  alipay_trade_no?: string
  paid_at?: string | Date
  create_time?: string | Date
}

export interface SaasPlatformSubscriptionRecord {
  id: number
  tenant_id: number
  plan_id: number
  billing_cycle: string
  status: string
  start_time?: string | Date
  end_time?: string | Date
  cancel_at_period_end?: number
  remark?: string
  create_time?: string | Date
  days_until_expiry?: number | null
  is_expiring_soon?: boolean
  is_expired_by_time?: boolean
}

export interface SaasSubscriptionLifecycleOverview {
  active_count: number
  expiring_7_days_count: number
  expiring_30_days_count: number
  expired_count: number
}

export interface SaasPlanQuotaRecord {
  quota_type: string
  total_quota: number
  status?: number
  remark?: string
}

export interface SaasPlanOption {
  id: number
  code: string
  name: string
  billing_cycle: string
  price_monthly: number
  price_yearly: number
  quotas?: SaasPlanQuotaRecord[]
}

export interface SaasPlatformPlanRecord extends SaasPlanOption {
  status: number
  sort: number
  remark?: string
  create_time?: string | Date
  update_time?: string | Date
  quotas: SaasPlanQuotaRecord[]
}

export interface SaasPlatformPlanListParams {
  page?: number
  limit?: number
  status?: number | string
  keyword?: string
}

export interface SaveSaasPlatformPlanParams {
  code?: string
  name: string
  billing_cycle?: 'monthly' | 'yearly'
  price_monthly?: number
  price_yearly?: number
  status?: number
  sort?: number
  remark?: string
}

export interface SaasResourcePackRecord {
  id: number
  code: string
  name: string
  resource_type: string
  quota_amount: number
  price_cents: number
  currency: string
  status: number
  sort: number
  remark?: string
}

export interface SaasResourcePackListParams {
  page?: number
  limit?: number
  status?: number | string
  resource_type?: string
}

export type SaasPaymentOrderType = 'plan' | 'resource_pack'

export interface CreateResourcePackOrderParams {
  resource_pack_code: string
  payment_method?: string
}

export interface SaasResourcePackOrderRecord {
  order_no: string
  tenant_id?: number
  resource_pack_code: string
  resource_pack_name: string
  resource_type: string
  quota_amount: number
  amount_cents: number
  currency: string
  payment_method?: string
  status: string
  alipay_trade_no?: string
  paid_at?: string | Date
  delivered_at?: string | Date
  create_time?: string | Date
}

export interface SaasResourcePackOrderListParams {
  page?: number
  limit?: number
  tenant_id?: number | string
  order_no?: string
  resource_pack_code?: string
  resource_type?: string
  status?: string
}

export interface TenantResourcePackOrderListParams {
  page?: number
  limit?: number
  resource_pack_code?: string
  status?: string
}

export interface PlatformAlipayConfigStatus {
  provider: 'alipay'
  enabled: boolean
  configured: boolean
  missing_keys: string[]
  app_id_masked: string
  gateway_url: string
  notify_url: string
  return_url: string
  notify_url_configured: boolean
  return_url_configured: boolean
  private_key_configured: boolean
  public_key_configured: boolean
  remark?: string
}

export interface UpdatePlatformAlipayConfigParams {
  enabled: boolean
  app_id?: string
  private_key?: string
  public_key?: string
  gateway_url?: string
  notify_url?: string
  return_url?: string
  remark?: string
}

export interface SaasPlatformUsageKpis {
  active_subscriptions: number
  trialing_subscriptions: number
  expired_subscriptions: number
  pending_plan_orders: number
  pending_resource_pack_orders: number
  paid_plan_order_amount_cents: number
  paid_resource_pack_order_amount_cents: number
  total_paid_amount_cents: number
}

export interface SaasPlatformQuotaSummaryRecord {
  resource_type: string
  total_quota: number
  used_quota: number
  remaining_quota: number
  usage_rate: number
}

export interface SaasPlatformPlanDistributionRecord {
  plan_id: number
  plan_code: string
  plan_name: string
  active_count: number
}

export interface SaasPlatformUsageOverview {
  kpis: SaasPlatformUsageKpis
  quota_summary: SaasPlatformQuotaSummaryRecord[]
  plan_distribution: SaasPlatformPlanDistributionRecord[]
  recent_plan_orders: SaasPlatformOrderRecord[]
  recent_resource_pack_orders: SaasResourcePackOrderRecord[]
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
  startTime?: string | number
  start_time?: string | number
  endTime?: string | number
  end_time?: string | number
  daysUntilExpiry?: number | null
  days_until_expiry?: number | null
  isExpiringSoon?: boolean
  is_expiring_soon?: boolean
  isExpiredByTime?: boolean
  is_expired_by_time?: boolean
  trialEndTime?: string | number
  trial_end_time?: string | number
  [key: string]: any
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

export interface AlipayConfigStatus {
  enabled: boolean
  configured: boolean
  missing_keys: string[]
  app_id_masked: string
  gateway_url: string
  notify_url_configured: boolean
  return_url_configured: boolean
}

export interface CreateSaasOrderParams {
  plan_code: string
  billing_cycle?: 'monthly' | 'yearly'
  payment_method?: string
}

export function signupTenant(params: SaasSignupParams) {
  return request.post<SaasSignupResult>({ url: '/api/saas/signup', data: params })
}

export function fetchTenantUsage() {
  return request.get<TenantUsageQuotaRecord[]>({ url: '/api/saas/tenant/usage' })
}

export function fetchTenantSubscription() {
  return request.get<TenantSubscriptionSummary>({ url: '/api/saas/tenant/subscription' })
}

export function fetchTenantPlans() {
  return request.get<SaasPlanOption[]>({ url: '/api/saas/tenant/plans' })
}

export function createTenantUpgradeOrder(params: CreateSaasOrderParams) {
  return request.post<SaasOrderRecord>({ url: '/api/saas/tenant/orders', data: params })
}

export function fetchTenantOrder(orderNo: string) {
  return request.get<SaasOrderRecord>({ url: `/api/saas/tenant/orders/${orderNo}` })
}

export function devConfirmTenantPayment(orderNo: string, orderType?: 'plan'): Promise<SaasOrderRecord>
export function devConfirmTenantPayment(orderNo: string, orderType: 'resource_pack'): Promise<SaasResourcePackOrderRecord>
export function devConfirmTenantPayment(orderNo: string, orderType: SaasPaymentOrderType = 'plan') {
  return request.post<SaasOrderRecord | SaasResourcePackOrderRecord>({
    url: '/api/saas/payment/dev-confirm',
    data: { order_no: orderNo, order_type: orderType }
  })
}

export function createAlipayPayment(orderNo: string, orderType: SaasPaymentOrderType = 'plan') {
  return request.post<AlipayPaymentResult>({
    url: '/api/saas/payment/alipay/create',
    data: { order_no: orderNo, order_type: orderType }
  })
}

export function fetchAlipayConfigStatus() {
  return request.get<AlipayConfigStatus>({ url: '/api/saas/payment/alipay/config-status' })
}

export function createSaasTenantFromPlatform(params: SaasTenantProvisionParams) {
  return request.post<SaasSignupResult>({ url: '/api/saas/platform/tenants', data: params })
}

export function fetchPlatformUsageOverview() {
  return request.get<SaasPlatformUsageOverview>({ url: '/api/saas/platform/usage/overview' })
}

export function fetchPlatformSubscriptionLifecycleOverview() {
  return request.get<SaasSubscriptionLifecycleOverview>({ url: '/api/saas/platform/subscriptions/lifecycle/overview' })
}

export function fetchPlatformOrders(params: SaasPlatformOrderListParams) {
  return request.get<SaasPlatformPageResult<SaasPlatformOrderRecord>>({ url: '/api/saas/platform/orders', params })
}

export function fetchPlatformOrder(orderNo: string) {
  return request.get<SaasPlatformOrderRecord | null>({ url: `/api/saas/platform/orders/${orderNo}` })
}

export function fetchPlatformSubscriptions(params: SaasPlatformSubscriptionListParams) {
  return request.get<SaasPlatformPageResult<SaasPlatformSubscriptionRecord>>({ url: '/api/saas/platform/subscriptions', params })
}

export function fetchPlatformSubscription(id: number | string) {
  return request.get<SaasPlatformSubscriptionRecord | null>({ url: `/api/saas/platform/subscriptions/${id}` })
}

export function fetchPlatformPlans(params: SaasPlatformPlanListParams) {
  return request.get<SaasPlatformPageResult<SaasPlatformPlanRecord>>({ url: '/api/saas/platform/plans', params })
}

export function fetchPlatformPlan(code: string) {
  return request.get<SaasPlatformPlanRecord>({ url: `/api/saas/platform/plans/${code}` })
}

export function createPlatformPlan(params: SaveSaasPlatformPlanParams) {
  return request.post<SaasPlatformPlanRecord>({ url: '/api/saas/platform/plans', data: params })
}

export function updatePlatformPlan(code: string, params: SaveSaasPlatformPlanParams) {
  return request.put<SaasPlatformPlanRecord>({ url: `/api/saas/platform/plans/${code}`, data: params })
}

export function updatePlatformPlanStatus(code: string, status: number) {
  return request.put<SaasPlatformPlanRecord>({ url: `/api/saas/platform/plans/${code}/status`, data: { status } })
}

export function updatePlatformPlanQuotas(code: string, quotas: SaasPlanQuotaRecord[]) {
  return request.put<SaasPlatformPlanRecord>({ url: `/api/saas/platform/plans/${code}/quotas`, data: { quotas } })
}

export function fetchPlatformResourcePacks(params: SaasResourcePackListParams) {
  return request.get<SaasPlatformPageResult<SaasResourcePackRecord>>({ url: '/api/saas/platform/resource-packs', params })
}

export function fetchTenantResourcePacks() {
  return request.get<SaasResourcePackRecord[]>({ url: '/api/saas/tenant/resource-packs' })
}

export function createTenantResourcePackOrder(params: CreateResourcePackOrderParams) {
  return request.post<SaasResourcePackOrderRecord>({ url: '/api/saas/tenant/resource-pack-orders', data: params })
}

export function fetchTenantResourcePackOrder(orderNo: string) {
  return request.get<SaasResourcePackOrderRecord>({ url: `/api/saas/tenant/resource-pack-orders/${orderNo}` })
}

export function fetchTenantResourcePackOrders(params: TenantResourcePackOrderListParams) {
  return request.get<SaasPlatformPageResult<SaasResourcePackOrderRecord>>({ url: '/api/saas/tenant/resource-pack-orders', params })
}

export function fetchPlatformResourcePackOrders(params: SaasResourcePackOrderListParams) {
  return request.get<SaasPlatformPageResult<SaasResourcePackOrderRecord>>({ url: '/api/saas/platform/resource-pack-orders', params })
}

export function fetchPlatformResourcePackOrder(orderNo: string) {
  return request.get<SaasResourcePackOrderRecord | null>({ url: `/api/saas/platform/resource-pack-orders/${orderNo}` })
}

export function fetchPlatformAlipayConfig() {
  return request.get<PlatformAlipayConfigStatus>({ url: '/api/saas/platform/payment/alipay/config' })
}

export function updatePlatformAlipayConfig(params: UpdatePlatformAlipayConfigParams) {
  return request.put<PlatformAlipayConfigStatus>({ url: '/api/saas/platform/payment/alipay/config', data: params })
}
