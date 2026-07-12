export const APP_RUNTIME_CHANNEL = 'agentstudio:app-runtime' as const
export const APP_RUNTIME_PROTOCOL_VERSION = 1 as const
export const APP_RUNTIME_CONTEXT_SCOPE = 'runtime:context:read' as const

export interface AppRuntimeContext {
  tenant: { id: string; name: string }
  user: { id: string; display_name: string }
  app: { code: string; name: string; version: string }
}

export type AppRuntimeJsonValue =
  | null
  | boolean
  | number
  | string
  | AppRuntimeJsonValue[]
  | { [key: string]: AppRuntimeJsonValue }

export interface AppRuntimeKvRecord {
  namespace: string
  key: string
  value: AppRuntimeJsonValue
  version: number
  expires_at: string | null
}

export interface AppRuntimeDeleteResult {
  deleted: boolean
}

export interface AppRuntimeFileMetadata {
  id: string
  name: string
  mime_type: string
  size: number
  checksum: string
  expires_at: string | null
}

export interface AppRuntimeHttpResponse {
  status: number
  headers: Record<string, string>
  body: string
  truncated: boolean
}

export interface AppRuntimeBootstrap {
  protocol_version: typeof APP_RUNTIME_PROTOCOL_VERSION
  scopes: Array<typeof APP_RUNTIME_CONTEXT_SCOPE>
  context: AppRuntimeContext | null
  session?: {
    token: string
    expires_at: string
  }
}

export interface ParsedAppRuntimeRequest {
  request_id: string
  operation: AppRuntimeOperation
  data: Record<string, unknown>
  legacy: boolean
}

export type AppRuntimeRequestParseResult =
  | { request: ParsedAppRuntimeRequest; response?: never }
  | {
      request?: never
      response: AppRuntimeErrorResponse | AppRuntimeOperationErrorResponse
    }

export interface AppRuntimeSuccessResponse {
  channel: typeof APP_RUNTIME_CHANNEL
  version: typeof APP_RUNTIME_PROTOCOL_VERSION
  type: 'context.result'
  request_id: string
  ok: true
  data: AppRuntimeContext
}

export type AppRuntimeOperation =
  | 'launch.exchange'
  | 'context.get'
  | 'kv.get'
  | 'kv.set'
  | 'kv.delete'
  | 'files.upload'
  | 'files.read'
  | 'files.delete'
  | 'http.request'
  | 'webhooks.emit'

export interface AppRuntimeOperationSuccessResponse {
  channel: typeof APP_RUNTIME_CHANNEL
  version: typeof APP_RUNTIME_PROTOCOL_VERSION
  type: `${AppRuntimeOperation}.result`
  request_id: string
  ok: true
  data: unknown
}

export type AppRuntimeErrorCode =
  | 'unsupported_protocol'
  | 'unsupported_request'
  | 'scope_denied'
  | 'context_unavailable'
  | 'capability_denied'
  | 'request_failed'

export interface AppRuntimeErrorResponse {
  channel: typeof APP_RUNTIME_CHANNEL
  version: typeof APP_RUNTIME_PROTOCOL_VERSION
  type: 'context.error'
  request_id: string
  ok: false
  error: {
    code: AppRuntimeErrorCode
    message: string
  }
}

export interface AppRuntimeOperationErrorResponse {
  channel: typeof APP_RUNTIME_CHANNEL
  version: typeof APP_RUNTIME_PROTOCOL_VERSION
  type: `${AppRuntimeOperation}.error`
  request_id: string
  ok: false
  error: {
    code: AppRuntimeErrorCode
    message: string
  }
}

export type AppRuntimeResponse =
  | AppRuntimeSuccessResponse
  | AppRuntimeErrorResponse
  | AppRuntimeOperationSuccessResponse
  | AppRuntimeOperationErrorResponse

const ERROR_MESSAGES: Record<AppRuntimeErrorCode, string> = {
  unsupported_protocol: 'Runtime protocol is not supported',
  unsupported_request: 'Runtime request is not supported',
  scope_denied: 'Runtime scope is not available',
  context_unavailable: 'Runtime context is unavailable',
  capability_denied: 'Runtime capability is not available',
  request_failed: 'Runtime request failed'
}

const RUNTIME_OPERATIONS = new Set<AppRuntimeOperation>([
  'launch.exchange',
  'context.get',
  'kv.get',
  'kv.set',
  'kv.delete',
  'files.upload',
  'files.read',
  'files.delete',
  'http.request',
  'webhooks.emit'
])

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function sanitizeRuntimeContext(value: unknown): AppRuntimeContext | null {
  if (!isPlainRecord(value)) return null
  const { tenant, user, app } = value
  if (!isPlainRecord(tenant) || !isPlainRecord(user) || !isPlainRecord(app)) return null

  const fields = [
    tenant.id,
    tenant.name,
    user.id,
    user.display_name,
    app.code,
    app.name,
    app.version
  ]
  if (fields.some((field) => typeof field !== 'string')) return null

  return {
    tenant: { id: tenant.id as string, name: tenant.name as string },
    user: { id: user.id as string, display_name: user.display_name as string },
    app: {
      code: app.code as string,
      name: app.name as string,
      version: app.version as string
    }
  }
}

export function createAppRuntimeErrorResponse(
  requestId: string,
  code: AppRuntimeErrorCode
): AppRuntimeErrorResponse {
  return {
    channel: APP_RUNTIME_CHANNEL,
    version: APP_RUNTIME_PROTOCOL_VERSION,
    type: 'context.error',
    request_id: requestId,
    ok: false,
    error: { code, message: ERROR_MESSAGES[code] }
  }
}

export function createAppRuntimeOperationErrorResponse(
  requestId: string,
  operation: AppRuntimeOperation,
  code: AppRuntimeErrorCode
): AppRuntimeOperationErrorResponse {
  return {
    channel: APP_RUNTIME_CHANNEL,
    version: APP_RUNTIME_PROTOCOL_VERSION,
    type: `${operation}.error`,
    request_id: requestId,
    ok: false,
    error: { code, message: ERROR_MESSAGES[code] }
  }
}

export function createAppRuntimeOperationSuccessResponse(
  requestId: string,
  operation: AppRuntimeOperation,
  data: unknown
): AppRuntimeOperationSuccessResponse {
  return {
    channel: APP_RUNTIME_CHANNEL,
    version: APP_RUNTIME_PROTOCOL_VERSION,
    type: `${operation}.result`,
    request_id: requestId,
    ok: true,
    data
  }
}

function isJsonValue(value: unknown, depth = 0): value is AppRuntimeJsonValue {
  if (depth > 20) return false
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1))
  if (!isPlainRecord(value)) return false
  return Object.values(value).every((item) => isJsonValue(item, depth + 1))
}

function normalizeOperationData(
  operation: AppRuntimeOperation,
  value: unknown
): Record<string, unknown> | null {
  const data = isPlainRecord(value) ? value : null
  if (operation === 'context.get') return data || {}
  if (!data) return null
  if (operation === 'launch.exchange') {
    return typeof data.launch_token === 'string' &&
      /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.launch_token)
      ? { launch_token: data.launch_token }
      : null
  }
  if (operation === 'kv.get' || operation === 'kv.delete') {
    return typeof data.namespace === 'string' && typeof data.key === 'string'
      ? { namespace: data.namespace, key: data.key }
      : null
  }
  if (operation === 'kv.set') {
    if (
      typeof data.namespace !== 'string' ||
      typeof data.key !== 'string' ||
      !isJsonValue(data.value)
    ) {
      return null
    }
    return data
  }
  if (operation === 'files.upload') {
    const fileIsBlob = typeof Blob !== 'undefined' && data.file instanceof Blob
    return fileIsBlob && (data.name === undefined || typeof data.name === 'string') ? data : null
  }
  if (operation === 'files.read' || operation === 'files.delete') {
    return typeof data.id === 'string' ? { id: data.id } : null
  }
  if (operation === 'http.request') {
    return typeof data.url === 'string' && typeof data.method === 'string' ? data : null
  }
  if (operation === 'webhooks.emit') {
    return typeof data.url === 'string' &&
      typeof data.event === 'string' &&
      isJsonValue(data.payload)
      ? data
      : null
  }
  return null
}

export function parseAppRuntimeRequest(message: unknown): AppRuntimeRequestParseResult | null {
  if (!isPlainRecord(message)) return null
  if (message.channel !== APP_RUNTIME_CHANNEL) return null
  const rawRequestId = typeof message.request_id === 'string' ? message.request_id : ''
  const requestId = rawRequestId.trim()
  if (!requestId || rawRequestId.length > 100) return null
  const canonicalOperation =
    typeof message.type === 'string' && message.type.endsWith('.request')
      ? (message.type.slice(0, -'.request'.length) as AppRuntimeOperation)
      : null
  if (message.version !== APP_RUNTIME_PROTOCOL_VERSION) {
    return {
      response:
        canonicalOperation && RUNTIME_OPERATIONS.has(canonicalOperation)
          ? createAppRuntimeOperationErrorResponse(
              requestId,
              canonicalOperation,
              'unsupported_protocol'
            )
          : createAppRuntimeErrorResponse(requestId, 'unsupported_protocol')
    }
  }
  if (message.type === 'context.get') {
    return {
      request: { request_id: requestId, operation: 'context.get', data: {}, legacy: true }
    }
  }
  if (typeof message.type !== 'string' || !message.type.endsWith('.request')) {
    return { response: createAppRuntimeErrorResponse(requestId, 'unsupported_request') }
  }
  const operation = canonicalOperation as AppRuntimeOperation
  if (!RUNTIME_OPERATIONS.has(operation)) {
    return { response: createAppRuntimeErrorResponse(requestId, 'unsupported_request') }
  }
  const data = normalizeOperationData(operation, message.data)
  if (!data) {
    return {
      response: createAppRuntimeOperationErrorResponse(requestId, operation, 'request_failed')
    }
  }
  return { request: { request_id: requestId, operation, data, legacy: false } }
}

export function createAppRuntimeContextResponse(
  requestId: string,
  context: unknown
): AppRuntimeResponse {
  const sanitized = sanitizeRuntimeContext(context)
  if (!sanitized) return createAppRuntimeErrorResponse(requestId, 'context_unavailable')
  return {
    channel: APP_RUNTIME_CHANNEL,
    version: APP_RUNTIME_PROTOCOL_VERSION,
    type: 'context.result',
    request_id: requestId,
    ok: true,
    data: sanitized
  }
}

export function resolveAppRuntimeRequest(
  message: unknown,
  bootstrap: AppRuntimeBootstrap | null
): AppRuntimeResponse | null {
  const parsed = parseAppRuntimeRequest(message)
  if (!parsed) return null
  if (parsed.response) return parsed.response
  const requestId = parsed.request.request_id
  if (parsed.request.operation !== 'context.get') {
    return createAppRuntimeOperationErrorResponse(
      requestId,
      parsed.request.operation,
      'unsupported_request'
    )
  }
  if (!bootstrap || bootstrap.protocol_version !== APP_RUNTIME_PROTOCOL_VERSION) {
    return createAppRuntimeErrorResponse(requestId, 'context_unavailable')
  }
  if (!Array.isArray(bootstrap.scopes) || !bootstrap.scopes.includes(APP_RUNTIME_CONTEXT_SCOPE)) {
    return createAppRuntimeErrorResponse(requestId, 'scope_denied')
  }
  if (parsed.request.legacy) return createAppRuntimeContextResponse(requestId, bootstrap.context)
  const sanitized = sanitizeRuntimeContext(bootstrap.context)
  return sanitized
    ? createAppRuntimeOperationSuccessResponse(requestId, 'context.get', sanitized)
    : createAppRuntimeOperationErrorResponse(requestId, 'context.get', 'context_unavailable')
}
