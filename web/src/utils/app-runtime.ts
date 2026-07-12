export const APP_RUNTIME_CHANNEL = 'agentstudio:app-runtime' as const
export const APP_RUNTIME_PROTOCOL_VERSION = 1 as const
export const APP_RUNTIME_CONTEXT_SCOPE = 'runtime:context:read' as const

export interface AppRuntimeContext {
  tenant: { id: string; name: string }
  user: { id: string; display_name: string }
  app: { code: string; name: string; version: string }
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
}

export type AppRuntimeRequestParseResult =
  | { request: ParsedAppRuntimeRequest; response?: never }
  | { request?: never; response: AppRuntimeErrorResponse }

export interface AppRuntimeSuccessResponse {
  channel: typeof APP_RUNTIME_CHANNEL
  version: typeof APP_RUNTIME_PROTOCOL_VERSION
  type: 'context.result'
  request_id: string
  ok: true
  data: AppRuntimeContext
}

export type AppRuntimeErrorCode =
  | 'unsupported_protocol'
  | 'unsupported_request'
  | 'scope_denied'
  | 'context_unavailable'

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

export type AppRuntimeResponse = AppRuntimeSuccessResponse | AppRuntimeErrorResponse

const ERROR_MESSAGES: Record<AppRuntimeErrorCode, string> = {
  unsupported_protocol: 'Runtime protocol is not supported',
  unsupported_request: 'Runtime request is not supported',
  scope_denied: 'Runtime scope is not available',
  context_unavailable: 'Runtime context is unavailable'
}

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

export function parseAppRuntimeRequest(message: unknown): AppRuntimeRequestParseResult | null {
  if (!isPlainRecord(message)) return null
  if (message.channel !== APP_RUNTIME_CHANNEL) return null
  const rawRequestId = typeof message.request_id === 'string' ? message.request_id : ''
  const requestId = rawRequestId.trim()
  if (!requestId || rawRequestId.length > 100) return null
  if (message.version !== APP_RUNTIME_PROTOCOL_VERSION) {
    return { response: createAppRuntimeErrorResponse(requestId, 'unsupported_protocol') }
  }
  if (message.type !== 'context.get') {
    return { response: createAppRuntimeErrorResponse(requestId, 'unsupported_request') }
  }
  return { request: { request_id: requestId } }
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
  if (!bootstrap || bootstrap.protocol_version !== APP_RUNTIME_PROTOCOL_VERSION) {
    return createAppRuntimeErrorResponse(requestId, 'context_unavailable')
  }
  if (!Array.isArray(bootstrap.scopes) || !bootstrap.scopes.includes(APP_RUNTIME_CONTEXT_SCOPE)) {
    return createAppRuntimeErrorResponse(requestId, 'scope_denied')
  }
  return createAppRuntimeContextResponse(requestId, bootstrap.context)
}
