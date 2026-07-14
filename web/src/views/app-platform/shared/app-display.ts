const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
})

export function cleanOptionalText(value?: string) {
  return String(value || '').trim() || undefined
}

export function appTypeText(type?: string) {
  return (
    (
      {
        internal: '内置页面',
        static: '静态应用',
        iframe: '外部应用',
        service: '服务应用'
      } as Record<string, string>
    )[type || ''] ||
    type ||
    '-'
  )
}

export function appTypeTagType(type?: string, serviceDanger = false) {
  return (
    (
      {
        internal: 'success',
        static: 'warning',
        iframe: 'info',
        service: serviceDanger ? 'danger' : 'success'
      } as Record<string, any>
    )[type || ''] || 'info'
  )
}

export function appReviewTypeTagType(type?: string) {
  return appTypeTagType(type, true)
}

export function appStatusText(status?: string) {
  return (
    (
      {
        draft: '草稿',
        pending_review: '待审核',
        approved: '已通过',
        published: '已发布',
        rejected: '已驳回',
        disabled: '已禁用',
        archived: '已归档'
      } as Record<string, string>
    )[status || ''] ||
    status ||
    '-'
  )
}

export function appStatusTagType(status?: string) {
  return (
    (
      {
        draft: 'info',
        pending_review: 'warning',
        approved: 'primary',
        published: 'success',
        rejected: 'danger',
        disabled: 'warning',
        archived: 'info'
      } as Record<string, any>
    )[status || ''] || 'info'
  )
}

export function appVisibilityText(value?: string) {
  return (
    (
      {
        marketplace: '应用市场',
        tenant: '租户可见',
        platform: '平台可见',
        private: '私有'
      } as Record<string, string>
    )[value || ''] ||
    value ||
    '-'
  )
}

export function scanStatusText(scanResult?: { passed?: boolean } | null) {
  if (!scanResult) return '未扫描'
  return scanResult.passed ? '已通过' : '已阻止'
}

export function scanStatusTagType(scanResult?: { passed?: boolean } | null) {
  if (!scanResult) return 'info'
  return scanResult.passed ? 'success' : 'danger'
}

export function reviewStatusText(status?: string) {
  return (
    ({ pending: '待审核', approved: '已通过', rejected: '已驳回' } as Record<string, string>)[
      status || ''
    ] ||
    status ||
    '-'
  )
}

export function reviewStatusTagType(status?: string) {
  return (
    ({ pending: 'warning', approved: 'success', rejected: 'danger' } as Record<string, any>)[
      status || ''
    ] || 'info'
  )
}

export function publishStatusText(status?: string) {
  return (
    (
      {
        unpublished: '未发布',
        published: '已发布',
        failed: '发布失败',
        unpublished_retired: '已下线'
      } as Record<string, string>
    )[status || ''] ||
    status ||
    '-'
  )
}

export function publishStatusTagType(status?: string) {
  return (
    (
      {
        unpublished: 'info',
        published: 'success',
        failed: 'danger',
        unpublished_retired: 'warning'
      } as Record<string, any>
    )[status || ''] || 'info'
  )
}

export function formatAppDateTime(value: unknown) {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
}

export function formatAppBytes(value?: number) {
  const bytes = Number(value || 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function developerReviewSummary(row: {
  latest_version?: string
  latest_review_status?: string
  latest_publish_status?: string
}) {
  if (!row.latest_version) return '请上传首个版本'
  if (row.latest_review_status === 'pending') return '等待平台审核'
  if (row.latest_review_status === 'approved' && row.latest_publish_status !== 'published')
    return '审核已通过，等待发布'
  if (row.latest_publish_status === 'published') return '已发布'
  return '-'
}

export function capabilityLabel(capability: string) {
  return capability === 'context.read' ? '读取租户和用户上下文' : capability
}

type ReviewOperators = {
  submitted_by?: number | null
  reviewer_id?: number | null
  candidate_reviewed_by?: number | null
  candidate_reviewed_time?: unknown
}

function sameOperator(left?: number | null, right?: number | null) {
  return left != null && right != null && String(left) === String(right)
}

export function reviewerSeparationStatus(row: ReviewOperators | null) {
  if (!row?.reviewer_id) return '待处理'
  return sameOperator(row.reviewer_id, row.submitted_by) ? '冲突' : '独立'
}

export function candidateSeparationStatus(row: ReviewOperators | null) {
  if (!row?.candidate_reviewed_by || !row.candidate_reviewed_time) return '待处理'
  return sameOperator(row.candidate_reviewed_by, row.submitted_by) ||
    sameOperator(row.candidate_reviewed_by, row.reviewer_id)
    ? '冲突'
    : '独立'
}

export function separationTagType(status: string) {
  if (status === '独立') return 'success' as const
  if (status === '冲突') return 'danger' as const
  return 'info' as const
}

export function reviewTrustLevelText(value?: string) {
  return (
    (
      {
        platform_trusted: '平台可信',
        certified: '已认证',
        untrusted: '未可信'
      } as Record<string, string>
    )[value || ''] ||
    value ||
    '-'
  )
}

export function reviewRiskLevelText(value?: string) {
  return (
    (
      {
        low: '低风险',
        medium: '中风险',
        high: '高风险',
        critical: '严重风险'
      } as Record<string, string>
    )[value || ''] ||
    value ||
    '-'
  )
}

export function reviewFindingSeverityText(value?: string) {
  return (
    (
      {
        info: '提示',
        warning: '警告',
        error: '错误',
        critical: '严重'
      } as Record<string, string>
    )[value || ''] ||
    value ||
    '-'
  )
}
