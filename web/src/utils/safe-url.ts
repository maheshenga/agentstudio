export interface FrontendSafeUrlOptions {
  label?: string
  stripTrailingSlash?: boolean
  allowQuery?: boolean
}

export function normalizeExternalHttpUrlInput(raw: string, options: FrontendSafeUrlOptions = {}) {
  const label = options.label || 'URL'
  const value = String(raw || '').trim()
  if (!value) throw new Error(`${label} 不能为空`)

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`请输入有效的 ${label}`)
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${label} 必须使用 http 或 https`)
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} 不能包含用户名或密码`)
  }
  if (options.allowQuery === false && parsed.search) {
    throw new Error(`${label} 不能包含查询参数`)
  }

  assertAllowedHost(parsed.hostname, label)
  parsed.hash = ''

  if (options.stripTrailingSlash) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/'
  }

  let normalized = parsed.toString()
  if (options.stripTrailingSlash && parsed.pathname === '/' && !parsed.search) {
    normalized = normalized.replace(/\/$/, '')
  }
  return normalized
}

export function getExternalHttpUrlError(raw: string, options: FrontendSafeUrlOptions = {}) {
  try {
    normalizeExternalHttpUrlInput(raw, options)
    return null
  } catch (error: any) {
    return error?.message || '请输入有效 URL'
  }
}

function assertAllowedHost(hostname: string, label: string) {
  const host = normalizeHostname(hostname)
  if (!host) throw new Error(`${label} 缺少主机名`)
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error(`${label} 不能指向本机或内网地址`)
  }
  if (isPrivateIpv4(host) || isLocalIpv6(host)) {
    throw new Error(`${label} 不能指向本机或内网地址`)
  }
}

function normalizeHostname(hostname: string) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)]$/, '$1')
}

function isPrivateIpv4(host: string) {
  const parts = host.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

function isLocalIpv6(host: string) {
  if (!host.includes(':')) return false
  if (host === '::' || host === '::1') return true
  const first = parseInt(host.split(':')[0] || '0', 16)
  if (!Number.isFinite(first)) return true
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00
}
