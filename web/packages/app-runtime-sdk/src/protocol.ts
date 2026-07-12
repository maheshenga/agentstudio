import { AppRuntimeError, isHostRuntimeErrorCode } from './errors'
import type {
  AppRuntimeContext,
  AppRuntimeDeleteResult,
  AppRuntimeFileMetadata,
  AppRuntimeFileReadResult,
  AppRuntimeHttpRequest,
  AppRuntimeHttpResponse,
  AppRuntimeJsonValue,
  AppRuntimeKvRecord,
  AppRuntimeServiceInvokeResult,
  AppRuntimeWebhookRequest
} from './types'

export const APP_RUNTIME_CHANNEL = 'agentstudio:app-runtime' as const
export const APP_RUNTIME_PROTOCOL_VERSION = 1 as const

export interface RuntimeRequest {
  channel: typeof APP_RUNTIME_CHANNEL
  version: typeof APP_RUNTIME_PROTOCOL_VERSION
  type: 'context.get'
  request_id: string
}

export type ParsedRuntimeResponse =
  | { kind: 'ignore' }
  | { kind: 'success'; context: AppRuntimeContext }
  | { kind: 'error'; error: AppRuntimeError }

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function sanitizeContext(value: unknown): AppRuntimeContext | null {
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

export interface RuntimeOperationPayloads {
  'launch.exchange': { launch_token: string }
  'context.get': Record<string, never>
  'kv.get': { namespace: string; key: string }
  'kv.set': {
    namespace: string
    key: string
    value: AppRuntimeJsonValue
    expected_version?: number
    ttl_seconds?: number
  }
  'kv.delete': { namespace: string; key: string }
  'files.upload': { file: Blob; name?: string }
  'files.read': { id: string }
  'files.delete': { id: string }
  'http.request': AppRuntimeHttpRequest
  'webhooks.emit': AppRuntimeWebhookRequest
  'services.invoke': { target_code: string; input: AppRuntimeJsonValue }
}

export interface RuntimeOperationResults {
  'launch.exchange': { ready: true }
  'context.get': AppRuntimeContext
  'kv.get': AppRuntimeKvRecord
  'kv.set': AppRuntimeKvRecord
  'kv.delete': AppRuntimeDeleteResult
  'files.upload': AppRuntimeFileMetadata
  'files.read': AppRuntimeFileReadResult
  'files.delete': AppRuntimeDeleteResult
  'http.request': AppRuntimeHttpResponse
  'webhooks.emit': AppRuntimeHttpResponse
  'services.invoke': AppRuntimeServiceInvokeResult
}

export type RuntimeOperation = keyof RuntimeOperationPayloads

export interface RuntimeOperationRequest<K extends RuntimeOperation = RuntimeOperation> {
  channel: typeof APP_RUNTIME_CHANNEL
  version: typeof APP_RUNTIME_PROTOCOL_VERSION
  type: `${K}.request`
  request_id: string
  data: RuntimeOperationPayloads[K]
}

export type ParsedRuntimeOperationResponse<K extends RuntimeOperation> =
  | { kind: 'ignore' }
  | { kind: 'success'; data: RuntimeOperationResults[K] }
  | { kind: 'error'; error: AppRuntimeError }

type RuntimeResultValidator<K extends RuntimeOperation> = (
  value: unknown
) => RuntimeOperationResults[K] | null

function isJsonValue(value: unknown, depth = 0): value is AppRuntimeJsonValue {
  if (depth > 20) return false
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1))
  if (!isPlainRecord(value)) return false
  return Object.values(value).every((item) => isJsonValue(item, depth + 1))
}

export function isBoundedRuntimeJson(value: unknown): value is AppRuntimeJsonValue {
  if (!isJsonValue(value)) return false
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= 2 * 1024 * 1024
  } catch {
    return false
  }
}

export function isRuntimeServiceTargetCode(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9_]{2,79}$/.test(value)
}

function sanitizeKvRecord(value: unknown): AppRuntimeKvRecord | null {
  if (!isPlainRecord(value)) return null
  if (
    typeof value.namespace !== 'string' ||
    typeof value.key !== 'string' ||
    !isJsonValue(value.value) ||
    !Number.isInteger(value.version) ||
    Number(value.version) < 0 ||
    (value.expires_at !== null && typeof value.expires_at !== 'string')
  ) {
    return null
  }
  return {
    namespace: value.namespace,
    key: value.key,
    value: value.value,
    version: Number(value.version),
    expires_at: value.expires_at as string | null
  }
}

function sanitizeDeleteResult(value: unknown): AppRuntimeDeleteResult | null {
  return isPlainRecord(value) && typeof value.deleted === 'boolean'
    ? { deleted: value.deleted }
    : null
}

function sanitizeFileMetadata(value: unknown): AppRuntimeFileMetadata | null {
  if (!isPlainRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.mime_type !== 'string' ||
    !Number.isInteger(value.size) ||
    Number(value.size) < 0 ||
    typeof value.checksum !== 'string' ||
    (value.expires_at !== null && typeof value.expires_at !== 'string')
  ) {
    return null
  }
  return {
    id: value.id,
    name: value.name,
    mime_type: value.mime_type,
    size: Number(value.size),
    checksum: value.checksum,
    expires_at: value.expires_at as string | null
  }
}

function sanitizeFileRead(value: unknown): AppRuntimeFileReadResult | null {
  if (!isPlainRecord(value) || typeof value.mime_type !== 'string') return null
  if (!(value.data instanceof ArrayBuffer)) return null
  return { data: value.data, mime_type: value.mime_type }
}

function sanitizeHttpResponse(value: unknown): AppRuntimeHttpResponse | null {
  if (
    !isPlainRecord(value) ||
    !Number.isInteger(value.status) ||
    !isPlainRecord(value.headers) ||
    Object.values(value.headers).some((item) => typeof item !== 'string') ||
    typeof value.body !== 'string' ||
    typeof value.truncated !== 'boolean'
  ) {
    return null
  }
  return {
    status: Number(value.status),
    headers: value.headers as Record<string, string>,
    body: value.body,
    truncated: value.truncated
  }
}

function sanitizeServiceInvokeResult(value: unknown): AppRuntimeServiceInvokeResult | null {
  const allowedHeaders = new Set(['content-type', 'retry-after', 'x-request-id'])
  if (
    !isPlainRecord(value) ||
    !Number.isInteger(value.status) ||
    Number(value.status) < 100 ||
    Number(value.status) > 599 ||
    !isPlainRecord(value.headers) ||
    Object.keys(value.headers).length > 100 ||
    Object.entries(value.headers).some(
      ([name, headerValue]) =>
        !allowedHeaders.has(name.toLowerCase()) ||
        typeof headerValue !== 'string' ||
        headerValue.length > 8192
    ) ||
    !isBoundedRuntimeJson(value.data)
  ) {
    return null
  }
  return {
    status: Number(value.status),
    headers: value.headers as Record<string, string>,
    data: value.data
  }
}

export const runtimeResultValidators: {
  [K in RuntimeOperation]: RuntimeResultValidator<K>
} = {
  'launch.exchange': (value) =>
    isPlainRecord(value) && value.ready === true ? { ready: true } : null,
  'context.get': sanitizeContext,
  'kv.get': sanitizeKvRecord,
  'kv.set': sanitizeKvRecord,
  'kv.delete': sanitizeDeleteResult,
  'files.upload': sanitizeFileMetadata,
  'files.read': sanitizeFileRead,
  'files.delete': sanitizeDeleteResult,
  'http.request': sanitizeHttpResponse,
  'webhooks.emit': sanitizeHttpResponse,
  'services.invoke': sanitizeServiceInvokeResult
}

export function parseRuntimeOperationResponse<K extends RuntimeOperation>(
  value: unknown,
  requestId: string,
  operation: K
): ParsedRuntimeOperationResponse<K> {
  if (!isPlainRecord(value)) return { kind: 'ignore' }
  if (value.channel !== APP_RUNTIME_CHANNEL || value.request_id !== requestId) {
    return { kind: 'ignore' }
  }
  if (value.version !== APP_RUNTIME_PROTOCOL_VERSION) {
    return { kind: 'error', error: new AppRuntimeError('unsupported_protocol', requestId) }
  }
  if (value.type === `${operation}.result`) {
    const data = value.ok === true ? runtimeResultValidators[operation](value.data) : null
    return data
      ? { kind: 'success', data }
      : { kind: 'error', error: new AppRuntimeError('invalid_response', requestId) }
  }
  if (value.type === `${operation}.error`) {
    const error = isPlainRecord(value.error) ? value.error : null
    if (value.ok !== false || !error || !isHostRuntimeErrorCode(error.code)) {
      return { kind: 'error', error: new AppRuntimeError('invalid_response', requestId) }
    }
    return { kind: 'error', error: new AppRuntimeError(error.code, requestId) }
  }
  return { kind: 'ignore' }
}

export function normalizeTimeout(value?: number): number {
  if (!Number.isFinite(value)) return 3000
  return Math.min(30000, Math.max(100, Math.floor(value as number)))
}

export function parseRuntimeResponse(value: unknown, requestId: string): ParsedRuntimeResponse {
  if (!isPlainRecord(value)) return { kind: 'ignore' }
  if (value.channel !== APP_RUNTIME_CHANNEL || value.request_id !== requestId) {
    return { kind: 'ignore' }
  }
  if (value.type !== 'context.result' && value.type !== 'context.error') {
    if (typeof value.version === 'number' && value.version !== APP_RUNTIME_PROTOCOL_VERSION) {
      return { kind: 'error', error: new AppRuntimeError('unsupported_protocol', requestId) }
    }
    return { kind: 'ignore' }
  }
  if (value.version !== APP_RUNTIME_PROTOCOL_VERSION) {
    return { kind: 'error', error: new AppRuntimeError('unsupported_protocol', requestId) }
  }

  if (value.type === 'context.result') {
    const context = value.ok === true ? sanitizeContext(value.data) : null
    return context
      ? { kind: 'success', context }
      : { kind: 'error', error: new AppRuntimeError('invalid_response', requestId) }
  }

  const error = isPlainRecord(value.error) ? value.error : null
  if (value.ok !== false || !error || !isHostRuntimeErrorCode(error.code)) {
    return { kind: 'error', error: new AppRuntimeError('invalid_response', requestId) }
  }
  return { kind: 'error', error: new AppRuntimeError(error.code, requestId) }
}
