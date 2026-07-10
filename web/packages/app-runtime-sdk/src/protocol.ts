import { AppRuntimeError, isHostRuntimeErrorCode } from './errors'
import type { AppRuntimeContext } from './types'

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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function sanitizeContext(value: unknown): AppRuntimeContext | null {
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
