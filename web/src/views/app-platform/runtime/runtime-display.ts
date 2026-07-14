import type {
  AppServiceHealthStatus,
  AppServiceInstanceRole,
  AppServiceProcessStatus
} from '@/api/app-service-runtime'

const labels: Record<string, string> = {
  candidate: '候选',
  active: '当前',
  standby: '备用',
  retired: '已退役',
  starting: '启动中',
  online: '在线',
  stopped: '已停止',
  failed: '失败',
  unknown: '未知',
  checking: '检查中',
  healthy: '健康',
  unhealthy: '不健康',
  draft: '草稿',
  pending_review: '待审核',
  approved: '已通过',
  published: '已发布',
  rejected: '已驳回',
  disabled: '已禁用',
  archived: '已归档'
}
const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
})
export function labelize(value?: string) {
  return value ? labels[value] || value : '-'
}
export function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}
export function roleTagType(role: AppServiceInstanceRole) {
  if (role === 'active') return 'success'
  if (role === 'candidate') return 'warning'
  if (role === 'retired') return 'info'
  return 'primary'
}
export function processTagType(status: AppServiceProcessStatus) {
  if (status === 'online') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'starting') return 'warning'
  return 'info'
}
export function healthTagType(status: AppServiceHealthStatus) {
  if (status === 'healthy') return 'success'
  if (status === 'unhealthy') return 'danger'
  if (status === 'checking') return 'warning'
  return 'info'
}
