import type {
  AppBillingPeriod,
  AppOrderStatus,
  AppPricingModel,
  AppSettlementRecord,
  TenantAppLicenseRecord
} from '@/api/app-commerce'

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
})

export function formatMoney(amountCents?: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(
    (Number(amountCents) || 0) / 100
  )
}
export function formatBasisPoints(value?: number) {
  return `${((Number(value) || 0) / 100).toFixed(2).replace(/\.00$/, '')}%`
}
export function formatDateTime(value: unknown) {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
}
export function pricingModelText(model: AppPricingModel) {
  return (
    { free: '免费', included: '套餐包含', subscription: '订阅', one_time: '一次性购买' } as Record<
      AppPricingModel,
      string
    >
  )[model]
}
export function billingPeriodText(period: AppBillingPeriod) {
  return ({ none: '无', monthly: '按月', yearly: '按年' } as Record<AppBillingPeriod, string>)[
    period
  ]
}
export function saleScopeText(scope?: 'all' | 'selected_tenants') {
  return scope === 'selected_tenants' ? '指定租户' : '全部租户'
}
export function orderStatusText(status: AppOrderStatus) {
  return (
    { pending: '待支付', paid: '已支付', refunded: '已退款', closed: '已关闭' } as Record<
      AppOrderStatus,
      string
    >
  )[status]
}
export function orderStatusTagType(status: AppOrderStatus) {
  return (
    { pending: 'warning', paid: 'success', refunded: 'danger', closed: 'info' } as Record<
      AppOrderStatus,
      any
    >
  )[status]
}
export function sourceText(source: TenantAppLicenseRecord['source']) {
  return (
    { trial: '试用', order: '订单', platform: '平台' } as Record<
      TenantAppLicenseRecord['source'],
      string
    >
  )[source]
}
export function licenseStatusText(status: TenantAppLicenseRecord['status']) {
  return (
    {
      active: '生效中',
      trialing: '试用中',
      expired: '已到期',
      revoked: '已撤销',
      refunded: '已退款'
    } as Record<TenantAppLicenseRecord['status'], string>
  )[status]
}
export function licenseStatusTagType(status: TenantAppLicenseRecord['status']) {
  if (status === 'active' || status === 'trialing') return 'success'
  if (status === 'expired') return 'warning'
  return 'danger'
}
export function settlementStatusText(status: AppSettlementRecord['status']) {
  return (
    { draft: '草稿', approved: '已审核', paid: '已打款', cancelled: '已取消' } as Record<
      AppSettlementRecord['status'],
      string
    >
  )[status]
}
export function settlementStatusTagType(status: AppSettlementRecord['status']) {
  return (
    { draft: 'info', approved: 'warning', paid: 'success', cancelled: 'danger' } as Record<
      AppSettlementRecord['status'],
      any
    >
  )[status]
}
