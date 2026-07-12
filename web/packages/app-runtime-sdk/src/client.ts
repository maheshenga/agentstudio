import { AppRuntimeError } from './errors'
import {
  APP_RUNTIME_CHANNEL,
  APP_RUNTIME_PROTOCOL_VERSION,
  normalizeTimeout,
  parseRuntimeOperationResponse,
  parseRuntimeResponse,
  type RuntimeOperation,
  type RuntimeOperationPayloads,
  type RuntimeOperationRequest,
  type RuntimeOperationResults,
  type RuntimeRequest
} from './protocol'
import type {
  AppRuntimeContext,
  AppRuntimeFileUploadOptions,
  AppRuntimeHttpRequest,
  AppRuntimeJsonValue,
  AppRuntimeKvSetOptions,
  AppRuntimeRequestOptions,
  AppRuntimeWebhookRequest,
  GetContextOptions
} from './types'

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
  location?: { hash?: string }
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

function sendRuntimeOperation<K extends RuntimeOperation>(
  runtimeWindow: RuntimeWindow,
  operation: K,
  data: RuntimeOperationPayloads[K],
  options: AppRuntimeRequestOptions = {}
): Promise<RuntimeOperationResults[K]> {
  if (options.signal?.aborted) {
    return Promise.reject(new AppRuntimeError('aborted'))
  }
  const requestId = createRequestId(runtimeWindow)
  return new Promise<RuntimeOperationResults[K]>((resolve, reject) => {
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
    const resolveOnce = (value: RuntimeOperationResults[K]) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(value)
    }
    const onMessage = (event: RuntimeMessageEvent) => {
      if (event.source !== runtimeWindow.parent) return
      const parsed = parseRuntimeOperationResponse(event.data, requestId, operation)
      if (parsed.kind === 'success') resolveOnce(parsed.data)
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
    const request: RuntimeOperationRequest<K> = {
      channel: APP_RUNTIME_CHANNEL,
      version: APP_RUNTIME_PROTOCOL_VERSION,
      type: `${operation}.request`,
      request_id: requestId,
      data
    }
    try {
      runtimeWindow.parent.postMessage(request, '*')
    } catch {
      rejectOnce(new AppRuntimeError('host_unavailable', requestId))
    }
  })
}

function readLaunchToken(runtimeWindow: RuntimeWindow): string {
  const hash = String(runtimeWindow.location?.hash || '')
  const prefix = '#agentstudio_launch='
  if (!hash.startsWith(prefix)) return ''
  const token = hash.slice(prefix.length)
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) ? token : ''
}

export function createRuntimeClient(resolveWindow: () => RuntimeWindow | undefined) {
  let launchWindow: RuntimeWindow | undefined
  let launchPromise: Promise<void> | null = null

  const resolveRuntimeWindow = () => {
    const runtimeWindow = resolveWindow()
    if (!runtimeWindow || runtimeWindow.parent === runtimeWindow) {
      throw new AppRuntimeError('host_unavailable')
    }
    if (launchWindow !== runtimeWindow) {
      launchWindow = runtimeWindow
      launchPromise = null
    }
    return runtimeWindow
  }

  const ensureLaunch = (runtimeWindow: RuntimeWindow, options: AppRuntimeRequestOptions) => {
    const launchToken = readLaunchToken(runtimeWindow)
    if (!launchToken) return Promise.resolve()
    if (!launchPromise) {
      launchPromise = sendRuntimeOperation(
        runtimeWindow,
        'launch.exchange',
        { launch_token: launchToken },
        { timeoutMs: options.timeoutMs }
      ).then(() => undefined)
      launchPromise.catch(() => {
        launchPromise = null
      })
    }
    return launchPromise
  }

  const request = async <K extends Exclude<RuntimeOperation, 'launch.exchange'>>(
    operation: K,
    data: RuntimeOperationPayloads[K],
    options: AppRuntimeRequestOptions = {}
  ): Promise<RuntimeOperationResults[K]> => {
    const runtimeWindow = resolveRuntimeWindow()
    await ensureLaunch(runtimeWindow, options)
    return sendRuntimeOperation(runtimeWindow, operation, data, options)
  }

  return {
    context: {
      get: (options: AppRuntimeRequestOptions = {}) => request('context.get', {}, options)
    },
    kv: {
      get: (namespace: string, key: string, options: AppRuntimeRequestOptions = {}) =>
        request('kv.get', { namespace, key }, options),
      set: (
        namespace: string,
        key: string,
        value: AppRuntimeJsonValue,
        options: AppRuntimeKvSetOptions = {}
      ) =>
        request(
          'kv.set',
          {
            namespace,
            key,
            value,
            ...(options.expectedVersion === undefined
              ? {}
              : { expected_version: options.expectedVersion }),
            ...(options.ttlSeconds === undefined ? {} : { ttl_seconds: options.ttlSeconds })
          },
          options
        ),
      delete: (namespace: string, key: string, options: AppRuntimeRequestOptions = {}) =>
        request('kv.delete', { namespace, key }, options)
    },
    files: {
      upload: (file: Blob, options: AppRuntimeFileUploadOptions = {}) =>
        request('files.upload', { file, ...(options.name ? { name: options.name } : {}) }, options),
      read: (id: string, options: AppRuntimeRequestOptions = {}) =>
        request('files.read', { id }, options),
      delete: (id: string, options: AppRuntimeRequestOptions = {}) =>
        request('files.delete', { id }, options)
    },
    http: {
      request: (input: AppRuntimeHttpRequest, options: AppRuntimeRequestOptions = {}) =>
        request('http.request', input, options)
    },
    webhooks: {
      emit: (input: AppRuntimeWebhookRequest, options: AppRuntimeRequestOptions = {}) =>
        request('webhooks.emit', input, options)
    }
  }
}
