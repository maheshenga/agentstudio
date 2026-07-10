import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'

import { createGetContext, type RuntimeMessageEvent, type RuntimeWindow } from '../src/client'
import { APP_RUNTIME_ERROR_CODES, AppRuntimeError } from '../src/errors'
import {
  APP_RUNTIME_CHANNEL,
  APP_RUNTIME_PROTOCOL_VERSION,
  normalizeTimeout,
  parseRuntimeResponse
} from '../src/protocol'
import type { AppRuntimeContext, AppRuntimeErrorCode } from '../src/types'

const approvedContext: AppRuntimeContext = {
  tenant: { id: '23', name: 'Acme' },
  user: { id: '91', display_name: 'Owner' },
  app: { code: 'runtime_starter', name: 'Runtime Starter', version: '1.0.0' }
}

function assertError(result: ReturnType<typeof parseRuntimeResponse>, code: AppRuntimeErrorCode) {
  assert.equal(result.kind, 'error')
  if (result.kind === 'error') assert.equal(result.error.code, code)
}

async function expectRuntimeError(promise: Promise<unknown>, code: AppRuntimeErrorCode) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof AppRuntimeError)
    assert.equal(error.code, code)
    return true
  })
}

class FakeRuntimeWindow implements RuntimeWindow {
  parent: RuntimeWindow['parent']
  readonly posts: Array<{ message: unknown; targetOrigin: string }> = []
  readonly messageListeners = new Set<(event: RuntimeMessageEvent) => void>()
  readonly timers = new Map<number, () => void>()
  readonly timeoutValues: number[] = []
  removedMessageListeners = 0
  clearedTimers = 0
  postError: Error | null = null
  private nextTimer = 1
  private nextRequest = 1

  crypto = {
    randomUUID: () => `request-${this.nextRequest++}`,
    getRandomValues: <T extends ArrayBufferView>(array: T) => array
  }

  constructor() {
    this.parent = {
      postMessage: (message, targetOrigin) => {
        if (this.postError) throw this.postError
        this.posts.push({ message, targetOrigin })
      }
    }
  }

  postMessage(message: unknown, targetOrigin: string) {
    this.posts.push({ message, targetOrigin })
  }

  addEventListener(_type: 'message', listener: (event: RuntimeMessageEvent) => void) {
    this.messageListeners.add(listener)
  }

  removeEventListener(_type: 'message', listener: (event: RuntimeMessageEvent) => void) {
    if (this.messageListeners.delete(listener)) this.removedMessageListeners += 1
  }

  setTimeout(handler: () => void, timeout: number) {
    this.timeoutValues.push(timeout)
    const id = this.nextTimer++
    this.timers.set(id, handler)
    return id
  }

  clearTimeout(timer: unknown) {
    if (this.timers.delete(Number(timer))) this.clearedTimers += 1
  }

  emit(data: unknown, source: unknown = this.parent) {
    for (const listener of [...this.messageListeners]) listener({ source, data })
  }

  expireTimers() {
    for (const [id, handler] of [...this.timers]) {
      this.timers.delete(id)
      handler()
    }
  }

  request(index = 0) {
    return this.posts[index]?.message as { request_id: string }
  }
}

function successResponse(requestId: string, context: unknown = approvedContext) {
  return {
    channel: APP_RUNTIME_CHANNEL,
    version: APP_RUNTIME_PROTOCOL_VERSION,
    type: 'context.result',
    request_id: requestId,
    ok: true,
    data: context
  }
}

function errorResponse(requestId: string, code: string, message = 'host-controlled text') {
  return {
    channel: APP_RUNTIME_CHANNEL,
    version: APP_RUNTIME_PROTOCOL_VERSION,
    type: 'context.error',
    request_id: requestId,
    ok: false,
    error: { code, message }
  }
}

function verifyPureContracts() {
  assert.equal(APP_RUNTIME_CHANNEL, 'agentstudio:app-runtime')
  assert.equal(APP_RUNTIME_PROTOCOL_VERSION, 1)
  assert.deepEqual(APP_RUNTIME_ERROR_CODES, [
    'unsupported_protocol',
    'unsupported_request',
    'scope_denied',
    'context_unavailable',
    'timeout',
    'aborted',
    'host_unavailable',
    'invalid_response'
  ])
  assert.equal(Object.isFrozen(APP_RUNTIME_ERROR_CODES), true)

  assert.equal(normalizeTimeout(undefined), 3000)
  assert.equal(normalizeTimeout(Number.NaN), 3000)
  assert.equal(normalizeTimeout(Number.POSITIVE_INFINITY), 3000)
  assert.equal(normalizeTimeout(-1), 100)
  assert.equal(normalizeTimeout(456.9), 456)
  assert.equal(normalizeTimeout(30001), 30000)

  const sanitized = parseRuntimeResponse(
    successResponse('request-1', {
      ...approvedContext,
      token: 'forbidden',
      tenant: { ...approvedContext.tenant, tenant_code: 'forbidden' },
      user: { ...approvedContext.user, username: 'forbidden' }
    }),
    'request-1'
  )
  assert.deepEqual(sanitized, { kind: 'success', context: approvedContext })
  assert.doesNotMatch(JSON.stringify(sanitized), /token|username|tenant_code|authorization|cookie/i)

  assert.deepEqual(parseRuntimeResponse({ channel: 'foreign' }, 'request-1'), { kind: 'ignore' })
  assert.deepEqual(
    parseRuntimeResponse({ channel: APP_RUNTIME_CHANNEL, request_id: 'foreign' }, 'request-1'),
    { kind: 'ignore' }
  )
  assert.deepEqual(
    parseRuntimeResponse(
      { channel: APP_RUNTIME_CHANNEL, request_id: 'request-1', type: 'other' },
      'request-1'
    ),
    { kind: 'ignore' }
  )

  assertError(
    parseRuntimeResponse(successResponse('request-1', null), 'request-1'),
    'invalid_response'
  )
  assertError(
    parseRuntimeResponse(errorResponse('request-1', 'unknown'), 'request-1'),
    'invalid_response'
  )
  assertError(
    parseRuntimeResponse({ ...successResponse('request-1'), version: 2 }, 'request-1'),
    'unsupported_protocol'
  )
  assertError(
    parseRuntimeResponse(
      {
        channel: APP_RUNTIME_CHANNEL,
        request_id: 'request-1',
        version: 2,
        type: 'future.result'
      },
      'request-1'
    ),
    'unsupported_protocol'
  )

  for (const code of APP_RUNTIME_ERROR_CODES.slice(0, 4)) {
    const parsed = parseRuntimeResponse(errorResponse('request-1', code), 'request-1')
    assertError(parsed, code)
    if (parsed.kind === 'error') assert.doesNotMatch(parsed.error.message, /host-controlled/)
  }
}

async function verifyClientLifecycle() {
  const missingHost = createGetContext(() => undefined)
  await expectRuntimeError(missingHost(), 'host_unavailable')

  const topLevelWindow = new FakeRuntimeWindow()
  topLevelWindow.parent = topLevelWindow
  await expectRuntimeError(createGetContext(() => topLevelWindow)(), 'host_unavailable')
  assert.equal(topLevelWindow.posts.length, 0)

  const preAbortedWindow = new FakeRuntimeWindow()
  const preAborted = new AbortController()
  preAborted.abort()
  await expectRuntimeError(
    createGetContext(() => preAbortedWindow)({ signal: preAborted.signal }),
    'aborted'
  )
  assert.equal(preAbortedWindow.posts.length, 0)
  assert.equal(preAbortedWindow.messageListeners.size, 0)

  const successWindow = new FakeRuntimeWindow()
  const successPromise = createGetContext(() => successWindow)()
  assert.deepEqual(successWindow.posts, [
    {
      message: {
        channel: APP_RUNTIME_CHANNEL,
        version: 1,
        type: 'context.get',
        request_id: 'request-1'
      },
      targetOrigin: '*'
    }
  ])
  successWindow.emit(successResponse('request-1'), {})
  successWindow.emit(successResponse('foreign'))
  assert.equal(successWindow.messageListeners.size, 1)
  successWindow.emit(successResponse('request-1'))
  assert.deepEqual(await successPromise, approvedContext)
  assert.equal(successWindow.messageListeners.size, 0)
  assert.equal(successWindow.timers.size, 0)
  assert.equal(successWindow.removedMessageListeners, 1)
  assert.equal(successWindow.clearedTimers, 1)
  successWindow.emit(errorResponse('request-1', 'scope_denied'))
  assert.equal(successWindow.removedMessageListeners, 1)

  const concurrentWindow = new FakeRuntimeWindow()
  const getConcurrent = createGetContext(() => concurrentWindow)
  const first = getConcurrent()
  const second = getConcurrent()
  const firstId = concurrentWindow.request(0).request_id
  const secondId = concurrentWindow.request(1).request_id
  assert.notEqual(firstId, secondId)
  concurrentWindow.emit(
    successResponse(secondId, { ...approvedContext, tenant: { id: '24', name: 'Beta' } })
  )
  concurrentWindow.emit(successResponse(firstId))
  assert.equal((await first).tenant.id, '23')
  assert.equal((await second).tenant.id, '24')
  assert.equal(concurrentWindow.messageListeners.size, 0)

  for (const code of APP_RUNTIME_ERROR_CODES.slice(0, 4)) {
    const runtimeWindow = new FakeRuntimeWindow()
    const promise = createGetContext(() => runtimeWindow)()
    runtimeWindow.emit(errorResponse(runtimeWindow.request().request_id, code))
    await expectRuntimeError(promise, code)
  }

  const malformedWindow = new FakeRuntimeWindow()
  const malformedPromise = createGetContext(() => malformedWindow)()
  malformedWindow.emit({ ...successResponse(malformedWindow.request().request_id), data: null })
  await expectRuntimeError(malformedPromise, 'invalid_response')

  const protocolWindow = new FakeRuntimeWindow()
  const protocolPromise = createGetContext(() => protocolWindow)()
  protocolWindow.emit({ ...successResponse(protocolWindow.request().request_id), version: 2 })
  await expectRuntimeError(protocolPromise, 'unsupported_protocol')

  const timeoutWindow = new FakeRuntimeWindow()
  const timeoutPromise = createGetContext(() => timeoutWindow)({ timeoutMs: 1 })
  assert.deepEqual(timeoutWindow.timeoutValues, [100])
  timeoutWindow.expireTimers()
  await expectRuntimeError(timeoutPromise, 'timeout')
  assert.equal(timeoutWindow.posts.length, 1)
  assert.equal(timeoutWindow.messageListeners.size, 0)

  const abortWindow = new FakeRuntimeWindow()
  const abortListeners = new Set<() => void>()
  const trackedSignal = {
    aborted: false,
    addEventListener: (_type: string, listener: () => void) => abortListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => abortListeners.delete(listener)
  } as unknown as AbortSignal
  const abortPromise = createGetContext(() => abortWindow)({ signal: trackedSignal })
  assert.equal(abortListeners.size, 1)
  for (const listener of [...abortListeners]) listener()
  await expectRuntimeError(abortPromise, 'aborted')
  assert.equal(abortWindow.messageListeners.size, 0)
  assert.equal(abortWindow.timers.size, 0)
  assert.equal(abortListeners.size, 0)

  const throwingWindow = new FakeRuntimeWindow()
  throwingWindow.postError = new Error('post failed with token=forbidden')
  await expectRuntimeError(createGetContext(() => throwingWindow)(), 'host_unavailable')
  assert.equal(throwingWindow.messageListeners.size, 0)
  assert.equal(throwingWindow.timers.size, 0)
}

async function verifyBuiltOutputs() {
  const packageRoot = resolve(import.meta.dirname, '..')
  const distRoot = resolve(packageRoot, 'dist')
  const esmPath = resolve(distRoot, 'index.js')
  const iifePath = resolve(distRoot, 'agentstudio-runtime.global.js')
  const declarationPath = resolve(distRoot, 'index.d.ts')
  const metadata = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'))

  assert.deepEqual(metadata.dependencies, {})
  assert.equal(metadata.module, './dist/index.js')
  assert.equal(metadata.types, './dist/index.d.ts')
  assert.deepEqual(metadata.exports, {
    '.': { types: './dist/index.d.ts', import: './dist/index.js' }
  })
  assert.equal(metadata.main, undefined)
  for (const target of [metadata.module, metadata.types, metadata.exports['.'].import]) {
    assert.ok(existsSync(resolve(packageRoot, target)))
  }
  assert.ok(statSync(esmPath).size <= 10 * 1024)
  assert.ok(statSync(iifePath).size <= 10 * 1024)
  assert.ok(existsSync(declarationPath))
  assert.equal(existsSync(`${esmPath}.map`), false)
  assert.equal(existsSync(`${iifePath}.map`), false)

  const declarations = readFileSync(declarationPath, 'utf8')
  for (const symbol of [
    'getContext',
    'GetContextOptions',
    'AppRuntimeContext',
    'AppRuntimeError'
  ]) {
    assert.ok(declarations.includes(symbol), `declarations must contain ${symbol}`)
  }

  const forbidden = [
    /access[_-]?token/i,
    /refresh[_-]?token/i,
    /authorization/i,
    /cookie/i,
    /localStorage/i,
    /sessionStorage/i,
    /\/api\//i,
    /axios/i,
    /fetch\s*\(/i
  ]
  for (const outputPath of [esmPath, iifePath]) {
    const source = readFileSync(outputPath, 'utf8')
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern)
  }

  const esm = await import(`${pathToFileURL(esmPath).href}?verify=${Date.now()}`)
  const expectedRuntimeExports = [
    'APP_RUNTIME_CHANNEL',
    'APP_RUNTIME_ERROR_CODES',
    'APP_RUNTIME_PROTOCOL_VERSION',
    'AppRuntimeError',
    'getContext'
  ]
  assert.deepEqual(Object.keys(esm).sort(), expectedRuntimeExports)
  assert.equal(typeof esm.getContext, 'function')

  const sandbox: Record<string, unknown> = {}
  vm.runInNewContext(readFileSync(iifePath, 'utf8'), sandbox)
  const globalApi = sandbox.AgentStudioRuntime as Record<string, unknown>
  assert.deepEqual(Object.keys(globalApi).sort(), expectedRuntimeExports)
  assert.equal(typeof globalApi?.getContext, 'function')
  assert.equal(globalApi?.APP_RUNTIME_PROTOCOL_VERSION, 1)
}

async function main() {
  verifyPureContracts()
  await verifyClientLifecycle()
  if (process.argv.includes('--built')) await verifyBuiltOutputs()
  console.log('App runtime SDK verified.')
}

await main()
