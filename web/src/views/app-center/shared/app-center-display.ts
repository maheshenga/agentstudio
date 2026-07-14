import type { AppCommerceAccessStatus } from '../../../api/app-commerce'
import type { AppPackageType } from '../../../api/app-marketplace'

export function appCenterTypeText(type?: AppPackageType) {
  const labels: Record<AppPackageType, string> = {
    internal: '内置应用',
    static: '静态应用',
    iframe: '外部应用',
    service: '服务应用'
  }
  return type ? labels[type] || type : '-'
}

export function appCenterTypeTagType(type?: AppPackageType) {
  const types: Record<AppPackageType, 'success' | 'warning' | 'info'> = {
    internal: 'success',
    static: 'warning',
    iframe: 'info',
    service: 'info'
  }
  return type ? types[type] || 'info' : 'info'
}

export function appAvailabilityText(status?: string) {
  const labels: Record<string, string> = {
    available: '可用',
    missing_plan_module: '需要升级套餐',
    missing_system_module: '租户未启用所需模块',
    system_module_unavailable: '系统模块不可用'
  }
  return status ? labels[status] || status : '可用'
}

export function appCommerceLabel(status?: AppCommerceAccessStatus) {
  const labels: Record<string, string> = {
    legacy_free: '历史免费',
    free: '免费',
    included: '套餐已包含',
    trialing: '试用中',
    licensed: '已授权',
    purchase_required: '需要购买',
    expired: '已到期',
    revoked: '已撤销'
  }
  return status ? labels[status] || status : '免费'
}

export function appCommerceTagType(status?: AppCommerceAccessStatus) {
  if (status === 'expired' || status === 'purchase_required') return 'warning'
  if (status === 'revoked') return 'danger'
  if (status === 'licensed' || status === 'trialing' || status === 'included') return 'success'
  return 'info'
}

export function appCapabilityLabel(capability: string) {
  return capability === 'context.read' ? '读取租户与用户上下文' : capability
}
