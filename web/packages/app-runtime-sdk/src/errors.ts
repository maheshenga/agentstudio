import type { AppRuntimeErrorCode } from './types'

export const APP_RUNTIME_ERROR_CODES = [
  'unsupported_protocol',
  'unsupported_request',
  'scope_denied',
  'context_unavailable',
  'timeout',
  'aborted',
  'host_unavailable',
  'invalid_response'
] as const satisfies readonly AppRuntimeErrorCode[]

const HOST_RUNTIME_ERROR_CODES = new Set<AppRuntimeErrorCode>([
  'unsupported_protocol',
  'unsupported_request',
  'scope_denied',
  'context_unavailable'
])

const ERROR_MESSAGES: Record<AppRuntimeErrorCode, string> = {
  unsupported_protocol: 'Runtime protocol is not supported',
  unsupported_request: 'Runtime request is not supported',
  scope_denied: 'Runtime scope is not available',
  context_unavailable: 'Runtime context is unavailable',
  timeout: 'Runtime request timed out',
  aborted: 'Runtime request was aborted',
  host_unavailable: 'Runtime host is unavailable',
  invalid_response: 'Runtime host returned an invalid response'
}

export function isHostRuntimeErrorCode(value: unknown): value is AppRuntimeErrorCode {
  return typeof value === 'string' && HOST_RUNTIME_ERROR_CODES.has(value as AppRuntimeErrorCode)
}

export class AppRuntimeError extends Error {
  readonly code: AppRuntimeErrorCode
  readonly requestId?: string

  constructor(code: AppRuntimeErrorCode, requestId?: string) {
    super(ERROR_MESSAGES[code])
    this.name = 'AppRuntimeError'
    this.code = code
    this.requestId = requestId
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
