import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  APP_RUNTIME_CHANNEL,
  APP_RUNTIME_PROTOCOL_VERSION,
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

for (const [source, token, label] of [
  [runnerSource, 'ref="appFrame"', 'app runner iframe binding'],
  [runnerSource, 'event.source !== frameWindow', 'runtime source validation'],
  [runnerSource, "metadata.value?.type !== 'static'", 'static-only runtime bridge'],
  [runnerSource, "frameWindow.postMessage(response, '*')", 'opaque-origin response'],
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
  [runnerSource, "item !== 'allow-same-origin'", 'same-origin sandbox rejection'],
  [apiSource, 'runtime: AppRuntimeBootstrap | null', 'open metadata runtime contract']
] as const) {
  assert.ok(source.includes(token), `${label} must include ${token}`)
}

console.log('App runtime readiness verified.')
