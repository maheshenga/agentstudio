import { AppRuntimeError } from './errors'
import {
  APP_RUNTIME_CHANNEL,
  APP_RUNTIME_PROTOCOL_VERSION,
  normalizeTimeout,
  parseRuntimeResponse,
  type RuntimeRequest
} from './protocol'
import type { AppRuntimeContext, GetContextOptions } from './types'

export interface RuntimeMessageEvent {
  source: unknown
  data: unknown
}

export interface RuntimeMessageTarget {
  postMessage(message: unknown, targetOrigin: string): void
}

interface RuntimeCrypto {
  randomUUID?: () => string
  getRandomValues?: (array: Uint32Array) => Uint32Array
}

export interface RuntimeWindow extends RuntimeMessageTarget {
  parent: RuntimeMessageTarget | RuntimeWindow
  crypto?: RuntimeCrypto
  addEventListener(type: 'message', listener: (event: RuntimeMessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: RuntimeMessageEvent) => void): void
  setTimeout(handler: () => void, timeout: number): unknown
  clearTimeout(timer: unknown): void
}

let requestCounter = 0

function createRequestId(runtimeWindow: RuntimeWindow): string {
  try {
    const uuid = runtimeWindow.crypto?.randomUUID?.()
    if (uuid) return uuid
  } catch {
    // Fall through to the correlation-only identifier.
  }

  const words = new Uint32Array(4)
  try {
    runtimeWindow.crypto?.getRandomValues?.(words)
  } catch {
    words.fill(0)
  }
  requestCounter += 1
  return [
    'runtime',
    Date.now().toString(36),
    requestCounter.toString(36),
    ...Array.from(words, (word) => word.toString(36))
  ].join('-')
}

function startRuntimeRequest(
  runtimeWindow: RuntimeWindow,
  options: GetContextOptions,
  resolve: (context: AppRuntimeContext) => void,
  reject: (error: AppRuntimeError) => void
): void {
  const requestId = createRequestId(runtimeWindow)
  let settled = false
  const resources: { timer?: unknown } = {}
  let abortAttached = false

  const cleanup = () => {
    if (resources.timer !== undefined) runtimeWindow.clearTimeout(resources.timer)
    runtimeWindow.removeEventListener('message', onMessage)
    if (abortAttached) options.signal?.removeEventListener('abort', onAbort)
  }

  const rejectOnce = (error: AppRuntimeError) => {
    if (settled) return
    settled = true
    cleanup()
    reject(error)
  }

  const resolveOnce = (context: AppRuntimeContext) => {
    if (settled) return
    settled = true
    cleanup()
    resolve(context)
  }

  const onMessage = (event: RuntimeMessageEvent) => {
    if (event.source !== runtimeWindow.parent) return
    const parsed = parseRuntimeResponse(event.data, requestId)
    if (parsed.kind === 'success') resolveOnce(parsed.context)
    if (parsed.kind === 'error') rejectOnce(parsed.error)
  }

  const onAbort = () => rejectOnce(new AppRuntimeError('aborted', requestId))

  runtimeWindow.addEventListener('message', onMessage)
  if (options.signal) {
    options.signal.addEventListener('abort', onAbort, { once: true })
    abortAttached = true
    if (options.signal.aborted) {
      onAbort()
      return
    }
  }
  resources.timer = runtimeWindow.setTimeout(
    () => rejectOnce(new AppRuntimeError('timeout', requestId)),
    normalizeTimeout(options.timeoutMs)
  )

  const request: RuntimeRequest = {
    channel: APP_RUNTIME_CHANNEL,
    version: APP_RUNTIME_PROTOCOL_VERSION,
    type: 'context.get',
    request_id: requestId
  }
  try {
    runtimeWindow.parent.postMessage(request, '*')
  } catch {
    rejectOnce(new AppRuntimeError('host_unavailable', requestId))
  }
}

export function createGetContext(resolveWindow: () => RuntimeWindow | undefined) {
  return function getContext(options: GetContextOptions = {}): Promise<AppRuntimeContext> {
    const runtimeWindow = resolveWindow()
    if (!runtimeWindow || runtimeWindow.parent === runtimeWindow) {
      return Promise.reject(new AppRuntimeError('host_unavailable'))
    }
    if (options.signal?.aborted) {
      return Promise.reject(new AppRuntimeError('aborted'))
    }
    return new Promise<AppRuntimeContext>((resolve, reject) => {
      startRuntimeRequest(runtimeWindow, options, resolve, reject)
    })
  }
}
