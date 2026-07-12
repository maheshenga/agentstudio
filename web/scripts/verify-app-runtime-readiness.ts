import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  APP_RUNTIME_CHANNEL,
  APP_RUNTIME_PROTOCOL_VERSION,
  createAppRuntimeOperationSuccessResponse,
  parseAppRuntimeRequest,
  resolveAppRuntimeRequest,
  type AppRuntimeBootstrap
} from '../src/utils/app-runtime'

const bootstrap: AppRuntimeBootstrap = {
  protocol_version: 1,
  scopes: ['runtime:context:read'],
  context: {
    tenant: { id: '23', name: 'Acme' },
    user: { id: '91', display_name: 'Owner' },
    app: { code: 'job_board', name: 'Job Board', version: '1.2.0' }
  }
}

assert.deepEqual(
  parseAppRuntimeRequest({
    channel: APP_RUNTIME_CHANNEL,
    version: 1,
    type: 'kv.set.request',
    request_id: 'request-kv',
    data: { namespace: 'settings', key: 'theme', value: { dark: true } }
  }),
  {
    request: {
      request_id: 'request-kv',
      operation: 'kv.set',
      data: { namespace: 'settings', key: 'theme', value: { dark: true } },
      legacy: false
    }
  }
)

assert.deepEqual(
  parseAppRuntimeRequest({
    channel: APP_RUNTIME_CHANNEL,
    version: 2,
    type: 'kv.get.request',
    request_id: 'request-versioned-kv',
    data: { namespace: 'settings', key: 'theme' }
  }),
  {
    response: {
      channel: APP_RUNTIME_CHANNEL,
      version: 1,
      type: 'kv.get.error',
      request_id: 'request-versioned-kv',
      ok: false,
      error: { code: 'unsupported_protocol', message: 'Runtime protocol is not supported' }
    }
  }
)

assert.deepEqual(
  parseAppRuntimeRequest({
    channel: APP_RUNTIME_CHANNEL,
    version: 1,
    type: 'files.read.request',
    request_id: 'request-file',
    data: { id: 42 }
  }),
  {
    response: {
      channel: APP_RUNTIME_CHANNEL,
      version: 1,
      type: 'files.read.error',
      request_id: 'request-file',
      ok: false,
      error: { code: 'request_failed', message: 'Runtime request failed' }
    }
  }
)

assert.deepEqual(
  createAppRuntimeOperationSuccessResponse('request-ready', 'launch.exchange', { ready: true }),
  {
    channel: APP_RUNTIME_CHANNEL,
    version: 1,
    type: 'launch.exchange.result',
    request_id: 'request-ready',
    ok: true,
    data: { ready: true }
  }
)

assert.deepEqual(
  resolveAppRuntimeRequest(
    {
      channel: APP_RUNTIME_CHANNEL,
      version: APP_RUNTIME_PROTOCOL_VERSION,
      type: 'context.get',
      request_id: 'request-1'
    },
    bootstrap
  ),
  {
    channel: APP_RUNTIME_CHANNEL,
    version: 1,
    type: 'context.result',
    request_id: 'request-1',
    ok: true,
    data: bootstrap.context
  }
)

assert.equal(
  resolveAppRuntimeRequest(
    {
      channel: 'other-channel',
      version: 1,
      type: 'context.get',
      request_id: 'request-2'
    },
    bootstrap
  ),
  null
)

class RuntimeRequest {
  channel = APP_RUNTIME_CHANNEL
  version = APP_RUNTIME_PROTOCOL_VERSION
  type = 'context.get'
  request_id = 'request-non-plain'
}

const nonPlainRequests = [
  Object.assign([], new RuntimeRequest()),
  Object.assign(new Date(), new RuntimeRequest()),
  new RuntimeRequest()
]

for (const request of nonPlainRequests) {
  assert.equal(resolveAppRuntimeRequest(request, bootstrap), null)
}

for (const requestId of ['', '   ', 'x'.repeat(101), `request-${' '.repeat(100)}`]) {
  assert.equal(
    resolveAppRuntimeRequest(
      {
        channel: APP_RUNTIME_CHANNEL,
        version: 1,
        type: 'context.get',
        request_id: requestId
      },
      bootstrap
    ),
    null
  )
}

assert.deepEqual(
  resolveAppRuntimeRequest(
    {
      channel: APP_RUNTIME_CHANNEL,
      version: 2,
      type: 'context.get',
      request_id: 'request-version'
    },
    bootstrap
  ),
  {
    channel: APP_RUNTIME_CHANNEL,
    version: 1,
    type: 'context.error',
    request_id: 'request-version',
    ok: false,
    error: {
      code: 'unsupported_protocol',
      message: 'Runtime protocol is not supported'
    }
  }
)

assert.deepEqual(
  resolveAppRuntimeRequest(
    {
      channel: APP_RUNTIME_CHANNEL,
      version: 1,
      type: 'context.get',
      request_id: 'request-bootstrap-version'
    },
    { ...bootstrap, protocol_version: 2 } as unknown as AppRuntimeBootstrap
  ),
  {
    channel: APP_RUNTIME_CHANNEL,
    version: 1,
    type: 'context.error',
    request_id: 'request-bootstrap-version',
    ok: false,
    error: {
      code: 'context_unavailable',
      message: 'Runtime context is unavailable'
    }
  }
)

assert.deepEqual(
  resolveAppRuntimeRequest(
    {
      channel: APP_RUNTIME_CHANNEL,
      version: 1,
      type: 'storage.get',
      request_id: 'request-type'
    },
    bootstrap
  ),
  {
    channel: APP_RUNTIME_CHANNEL,
    version: 1,
    type: 'context.error',
    request_id: 'request-type',
    ok: false,
    error: {
      code: 'unsupported_request',
      message: 'Runtime request is not supported'
    }
  }
)

assert.deepEqual(
  resolveAppRuntimeRequest(
    {
      channel: APP_RUNTIME_CHANNEL,
      version: 1,
      type: 'context.get',
      request_id: 'request-bootstrap'
    },
    null
  ),
  {
    channel: APP_RUNTIME_CHANNEL,
    version: 1,
    type: 'context.error',
    request_id: 'request-bootstrap',
    ok: false,
    error: {
      code: 'context_unavailable',
      message: 'Runtime context is unavailable'
    }
  }
)

assert.deepEqual(
  resolveAppRuntimeRequest(
    {
      channel: APP_RUNTIME_CHANNEL,
      version: 1,
      type: 'context.get',
      request_id: 'request-scope'
    },
    { protocol_version: 1, scopes: [], context: null }
  ),
  {
    channel: APP_RUNTIME_CHANNEL,
    version: 1,
    type: 'context.error',
    request_id: 'request-scope',
    ok: false,
    error: {
      code: 'scope_denied',
      message: 'Runtime scope is not available'
    }
  }
)

assert.deepEqual(
  resolveAppRuntimeRequest(
    {
      channel: APP_RUNTIME_CHANNEL,
      version: 1,
      type: 'context.get',
      request_id: 'request-context'
    },
    { protocol_version: 1, scopes: ['runtime:context:read'], context: null }
  ),
  {
    channel: APP_RUNTIME_CHANNEL,
    version: 1,
    type: 'context.error',
    request_id: 'request-context',
    ok: false,
    error: {
      code: 'context_unavailable',
      message: 'Runtime context is unavailable'
    }
  }
)

const taintedBootstrap = {
  ...bootstrap,
  access_token: 'platform-secret',
  context: {
    tenant: { ...bootstrap.context!.tenant, tenant_code: 'acme-secret' },
    user: {
      ...bootstrap.context!.user,
      username: 'owner-login',
      email: 'owner@example.com'
    },
    app: bootstrap.context!.app
  }
} as unknown as AppRuntimeBootstrap

const sanitizedResponse = resolveAppRuntimeRequest(
  {
    channel: APP_RUNTIME_CHANNEL,
    version: 1,
    type: 'context.get',
    request_id: 'request-sanitized'
  },
  taintedBootstrap
)

assert.deepEqual(sanitizedResponse, {
  channel: APP_RUNTIME_CHANNEL,
  version: 1,
  type: 'context.result',
  request_id: 'request-sanitized',
  ok: true,
  data: bootstrap.context
})
assert.doesNotMatch(
  JSON.stringify(sanitizedResponse),
  /username|tenant_code|email|phone|password|token|authorization|cookie/i
)

const webRoot = process.cwd()
const runnerSource = readFileSync(resolve(webRoot, 'src/views/app-center/open/index.vue'), 'utf8')
const apiSource = readFileSync(resolve(webRoot, 'src/api/app-marketplace.ts'), 'utf8')
const runtimeApiSource = readFileSync(resolve(webRoot, 'src/api/app-runtime.ts'), 'utf8')

for (const [source, token, label] of [
  [runnerSource, 'ref="appFrame"', 'app runner iframe binding'],
  [runnerSource, ':src="appFrameSrc"', 'signed iframe fragment source'],
  [runnerSource, 'event.source !== frameWindow', 'runtime source validation'],
  [runnerSource, 'event.origin !== runtimeTargetOrigin.value', 'external exact-origin validation'],
  [runnerSource, 'frameWindow.postMessage(response, targetOrigin)', 'bounded response target'],
  [
    runnerSource,
    "window.addEventListener('message', handleRuntimeMessage)",
    'runtime listener setup'
  ],
  [
    runnerSource,
    "window.removeEventListener('message', handleRuntimeMessage)",
    'runtime listener cleanup'
  ],
  [runnerSource, 'loadSequence', 'stale metadata response guard'],
  [runnerSource, 'runtimeAbortController', 'runtime request cancellation'],
  [runnerSource, 'fetchAppRuntimeContext', 'session-backed runtime context'],
  [runnerSource, 'exchangeIframeLaunch', 'one-time iframe launch exchange'],
  [runnerSource, 'runtimeSession', 'host-only in-memory runtime bearer'],
  [runnerSource, 'dispatchRuntimeCapability', 'explicit capability dispatch'],
  [runnerSource, 'parseAppRuntimeRequest', 'synchronous runtime request validation'],
  [runnerSource, 'createAppRuntimeContextResponse', 'correlated runtime success response'],
  [runnerSource, 'runtimeSession = data.runtime?.session', 'optional runtime session branch'],
  [runnerSource, 'resolveAppRuntimeRequest', 'legacy inline bootstrap fallback'],
  [runnerSource, "metadata.value?.type === 'static'", 'static same-origin sandbox rejection'],
  [apiSource, 'runtime: AppRuntimeBootstrap | null', 'open metadata runtime contract'],
  [apiSource, 'launch?: AppIframeLaunchMetadata | null', 'iframe launch metadata contract'],
  [apiSource, "url: '/api/app-tenant/runtime/iframe/exchange'", 'protected launch exchange API'],
  [runtimeApiSource, "url: '/api/app-runtime/context'", 'dedicated runtime endpoint'],
  [runtimeApiSource, "url: '/api/app-runtime/http'", 'runtime HTTP endpoint'],
  [runtimeApiSource, "url: '/api/app-runtime/webhooks'", 'runtime webhook endpoint'],
  [runtimeApiSource, '/api/app-runtime/kv/', 'runtime KV endpoints'],
  [runtimeApiSource, '/api/app-runtime/files', 'runtime file endpoints'],
  [runtimeApiSource, "'X-App-Runtime-Token': token", 'dedicated runtime header'],
  [runtimeApiSource, 'signal', 'runtime abort signal']
] as const) {
  assert.ok(source.includes(token), `${label} must include ${token}`)
}

for (const forbidden of ['localStorage', 'sessionStorage', 'document.cookie', 'URLSearchParams']) {
  assert.ok(
    !runnerSource.includes(forbidden),
    `runtime runner must not persist tokens via ${forbidden}`
  )
  assert.ok(
    !runtimeApiSource.includes(forbidden),
    `runtime API must not persist tokens via ${forbidden}`
  )
}

console.log('App runtime readiness verified.')
