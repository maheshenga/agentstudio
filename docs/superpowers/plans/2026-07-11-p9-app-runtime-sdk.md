# P9-A App Runtime SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan must be executed inline; do not dispatch multi-agents.

**Goal:** Ship a zero-runtime-dependency SDK and pure HTML Runtime Starter that prove the existing P8 read-only runtime context through a disposable, authenticated, full-lifecycle browser E2E.

**Architecture:** Add an independently buildable pnpm workspace package whose internal protocol parser and browser client wrap the existing `postMessage` bridge without changing host authority. Assemble its IIFE output into a deterministic static starter ZIP, then upload that ZIP through the real platform review flow and prove tenant installation and sandboxed rendering with Playwright.

**Tech Stack:** TypeScript 5.6, Vite 8 library mode, Node.js 20+, `tsx`, `jszip` 3.10, Playwright 1.61, Vue 3 host runner, NestJS 11, MySQL CLI, pnpm workspaces.

## Global Constraints

- Package name is `@agentstudio/app-runtime-sdk`, initial version is `0.1.0`, and package path is `web/packages/app-runtime-sdk`.
- Runtime dependencies must remain empty. `jszip` is a web-root development dependency used only for starter assembly and inspection.
- Outputs are ESM `dist/index.js`, browser IIFE `dist/agentstudio-runtime.global.js`, and TypeScript declarations rooted at `dist/index.d.ts`.
- The IIFE global is exactly `window.AgentStudioRuntime`.
- Public API is Promise-based `getContext(options?: GetContextOptions): Promise<AppRuntimeContext>`.
- Default timeout is `3000ms`; finite values are floored and clamped to `100-30000ms`; missing or non-finite values use `3000ms`.
- Support pre-aborted and in-flight `AbortSignal`, concurrent calls, unique request IDs, exactly-once cleanup, and no retries.
- Accepted source is exactly `event.source === window.parent`; opaque-origin messaging continues to use `targetOrigin: "*"`.
- Runtime context contains only tenant `{ id, name }`, user `{ id, display_name }`, and app `{ code, name, version }`, all strings.
- Public error codes are `unsupported_protocol`, `unsupported_request`, `scope_denied`, `context_unavailable`, `timeout`, `aborted`, `host_unavailable`, and `invalid_response`.
- Host error text, raw payloads, events, headers, tokens, cookies, and backend exceptions must never enter public errors or logs.
- Each minified JavaScript output is at most `10KB`; starter ZIP contains no source map.
- Runtime Starter manifest code/version are exactly `runtime_starter` and `1.0.0`, with only `runtime:context:read` permission.
- P9-A adds no token, storage API, write API, capability gateway, backend plugin, external iframe support, or npm/CDN publication.
- Existing publication, entitlement, install, open-audit, runtime bootstrap, and sandbox behavior remain authoritative.
- Use `pnpm.cmd` for direct PowerShell commands.
- Do not push. Every task ends in a local reviewable commit.

## File Structure

Create SDK package files:

- `web/packages/app-runtime-sdk/package.json`: publication-ready metadata and package scripts with no runtime dependencies.
- `web/packages/app-runtime-sdk/tsconfig.json`: strict source and declaration compiler settings.
- `web/packages/app-runtime-sdk/vite.config.ts`: ESM/IIFE library build, minification, and no source maps.
- `web/packages/app-runtime-sdk/src/types.ts`: public context, options, and error-code types.
- `web/packages/app-runtime-sdk/src/errors.ts`: fixed local messages and `AppRuntimeError`.
- `web/packages/app-runtime-sdk/src/protocol.ts`: request/response contracts and allowlist parser.
- `web/packages/app-runtime-sdk/src/client.ts`: per-request browser lifecycle and cleanup.
- `web/packages/app-runtime-sdk/src/index.ts`: the complete public export surface.
- `web/packages/app-runtime-sdk/scripts/verify-sdk.ts`: source behavior, built-output, size, metadata, and forbidden-reference gate.

Create Runtime Starter files:

- `web/examples/runtime-starter/manifest.json`: exact production static manifest.
- `web/examples/runtime-starter/index.html`: accessible loading, success, error, and retry structure.
- `web/examples/runtime-starter/styles.css`: restrained responsive diagnostic UI.
- `web/examples/runtime-starter/app.js`: IIFE SDK integration and safe rendering.
- `web/scripts/build-runtime-starter.ts`: deterministic temporary assembly and ZIP writer.
- `web/scripts/verify-app-runtime-starter.ts`: source, archive, allowlist, secret, and bundle-currentness gate.

Create full-lifecycle E2E files:

- `web/scripts/verify-app-runtime-live-e2e.ts`: disposable DB, process lifecycle, real APIs, Playwright proof, evidence redaction, and cleanup.

Modify workspace and release files:

- `web/pnpm-workspace.yaml`: register `packages/*` while preserving current build settings.
- `web/package.json`: add `jszip` dev dependency and the three P9-A executable gates.
- `web/pnpm-lock.yaml`: lock the workspace package and `jszip` development dependency.
- `docs/saas-launch-readiness-checklist.md`: add P9-A automated gates, manual checks, and acceptance evidence.

Generated and ignored:

- `web/packages/app-runtime-sdk/dist/**`: generated by SDK build and already covered by repository `dist` ignore rules.
- `web/examples/runtime-starter/vendor/agentstudio-runtime.global.js`: generated only in a temporary assembly directory; do not commit it.
- `web/.artifacts/runtime-starter.zip`: generated evidence and ignored by the existing `*.zip` rule.
- `web/.artifacts/app-runtime-e2e/**`: failure screenshots and bounded safe logs; add `.artifacts/` to `web/.gitignore` so none of these generated files can be committed.

---

### Task 1: Register The Workspace Package And Add Pure Contracts

**Files:**

- Modify: `web/pnpm-workspace.yaml`
- Create: `web/packages/app-runtime-sdk/package.json`
- Create: `web/packages/app-runtime-sdk/tsconfig.json`
- Create: `web/packages/app-runtime-sdk/src/types.ts`
- Create: `web/packages/app-runtime-sdk/src/errors.ts`
- Create: `web/packages/app-runtime-sdk/src/protocol.ts`
- Create: `web/packages/app-runtime-sdk/scripts/verify-sdk.ts`

**Interfaces:**

- Consumes: P8 channel `agentstudio:app-runtime`, protocol version `1`, request type `context.get`, response types `context.result` and `context.error`.
- Produces: `AppRuntimeContext`, `GetContextOptions`, `AppRuntimeErrorCode`, `AppRuntimeError`, `RuntimeRequest`, `parseRuntimeResponse()`, and `normalizeTimeout()`.

- [ ] **Step 1: Register the workspace package and create package metadata**

Add this to the top of `web/pnpm-workspace.yaml`, preserving the existing `allowBuilds` and `ignoredBuiltDependencies` blocks:

```yaml
packages:
  - 'packages/*'
```

Create `web/packages/app-runtime-sdk/package.json`:

```json
{
  "name": "@agentstudio/app-runtime-sdk",
  "version": "0.1.0",
  "description": "Read-only browser SDK for the AgentStudio app runtime bridge",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "files": ["dist"],
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "vite build && tsc -p tsconfig.json --emitDeclarationOnly",
    "verify": "vite build && tsc -p tsconfig.json --emitDeclarationOnly && tsx scripts/verify-sdk.ts"
  },
  "dependencies": {}
}
```

Create `web/packages/app-runtime-sdk/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 2: Write the failing pure-contract verification**

Create `web/packages/app-runtime-sdk/scripts/verify-sdk.ts` with a `source` phase that imports the not-yet-created contracts and asserts exact behavior:

```ts
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import vm from 'node:vm'

import { AppRuntimeError, APP_RUNTIME_ERROR_CODES } from '../src/errors'
import type { AppRuntimeErrorCode } from '../src/types'
import {
  APP_RUNTIME_CHANNEL,
  APP_RUNTIME_PROTOCOL_VERSION,
  normalizeTimeout,
  parseRuntimeResponse
} from '../src/protocol'

const requestId = 'request-1'
const context = {
  tenant: { id: '23', name: 'Acme' },
  user: { id: '91', display_name: 'Owner' },
  app: { code: 'runtime_starter', name: 'Runtime Starter', version: '1.0.0' }
}

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

assert.equal(normalizeTimeout(undefined), 3000)
assert.equal(normalizeTimeout(Number.NaN), 3000)
assert.equal(normalizeTimeout(Number.POSITIVE_INFINITY), 3000)
assert.equal(normalizeTimeout(99.9), 100)
assert.equal(normalizeTimeout(456.9), 456)
assert.equal(normalizeTimeout(30001), 30000)

const success = parseRuntimeResponse(
  {
    channel: APP_RUNTIME_CHANNEL,
    version: 1,
    type: 'context.result',
    request_id: requestId,
    ok: true,
    data: {
      ...context,
      token: 'forbidden',
      tenant: { ...context.tenant, code: 'forbidden' },
      user: { ...context.user, username: 'forbidden' }
    }
  },
  requestId
)
assert.deepEqual(success, { kind: 'success', context })
assert.doesNotMatch(JSON.stringify(success), /token|username|authorization|cookie/i)

for (const code of APP_RUNTIME_ERROR_CODES.slice(0, 4)) {
  const parsed = parseRuntimeResponse(
    {
      channel: APP_RUNTIME_CHANNEL,
      version: 1,
      type: 'context.error',
      request_id: requestId,
      ok: false,
      error: { code, message: 'host-controlled text' }
    },
    requestId
  )
  assert.equal(parsed.kind, 'error')
  if (parsed.kind === 'error') {
    assert.equal(parsed.error.code, code)
    assert.doesNotMatch(parsed.error.message, /host-controlled/)
  }
}

assert.deepEqual(parseRuntimeResponse({ channel: 'foreign' }, requestId), { kind: 'ignore' })
assert.deepEqual(
  parseRuntimeResponse({ channel: APP_RUNTIME_CHANNEL, request_id: 'foreign' }, requestId),
  { kind: 'ignore' }
)

for (const malformed of [
  null,
  [],
  new Date(),
  { channel: APP_RUNTIME_CHANNEL, request_id: requestId, version: 1, type: 'context.result', ok: true },
  {
    channel: APP_RUNTIME_CHANNEL,
    request_id: requestId,
    version: 1,
    type: 'context.error',
    ok: false,
    error: { code: 'unknown', message: 'x' }
  }
]) {
  const parsed = parseRuntimeResponse(malformed, requestId)
  const expectedKind =
    malformed === null || Array.isArray(malformed) || malformed instanceof Date
      ? 'ignore'
      : 'error'
  assert.equal(parsed.kind, expectedKind)
  if (parsed.kind === 'error') assert.equal(parsed.error.code, 'invalid_response')
}

const unsupported = parseRuntimeResponse(
  {
    channel: APP_RUNTIME_CHANNEL,
    request_id: requestId,
    version: 2,
    type: 'context.result',
    ok: true,
    data: context
  },
  requestId
)
assert.equal(unsupported.kind, 'error')
if (unsupported.kind === 'error') assert.equal(unsupported.error.code, 'unsupported_protocol')

const safeError = new AppRuntimeError('context_unavailable', requestId)
assert.equal(safeError.name, 'AppRuntimeError')
assert.equal(safeError.code, 'context_unavailable')
assert.equal(safeError.requestId, requestId)
assert.doesNotMatch(JSON.stringify(safeError), /payload|event|header|token/i)

if (process.argv.includes('--built')) {
  const packageRoot = resolve(import.meta.dirname, '..')
  const distRoot = resolve(packageRoot, 'dist')
  const esmPath = resolve(distRoot, 'index.js')
  const iifePath = resolve(distRoot, 'agentstudio-runtime.global.js')
  const declarationPath = resolve(distRoot, 'index.d.ts')
  const metadata = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'))
  assert.equal(Object.keys(metadata.dependencies || {}).length, 0)
  assert.equal(metadata.module, './dist/index.js')
  assert.equal(metadata.types, './dist/index.d.ts')
  assert.ok(statSync(esmPath).size <= 10 * 1024)
  assert.ok(statSync(iifePath).size <= 10 * 1024)
  statSync(declarationPath)
  const esm = await import(`${pathToFileURL(esmPath).href}?verify=${Date.now()}`)
  assert.equal(typeof esm.getContext, 'function')
  const sandbox: Record<string, unknown> = { window: {}, globalThis: {} }
  vm.runInNewContext(readFileSync(iifePath, 'utf8'), sandbox)
  const globalApi = (sandbox.AgentStudioRuntime || (sandbox.window as any).AgentStudioRuntime) as any
  assert.equal(typeof globalApi?.getContext, 'function')
}

console.log('App runtime SDK verified.')
```

- [ ] **Step 3: Run the source verifier to prove RED**

```powershell
cd web
pnpm.cmd exec tsx packages/app-runtime-sdk/scripts/verify-sdk.ts
```

Expected: FAIL with a module-not-found error for `../src/errors` or `../src/protocol`.

- [ ] **Step 4: Implement public types, fixed errors, and the parser**

Create `src/types.ts` with the exact public interfaces from the approved design. Create `src/errors.ts` with a frozen ordered `APP_RUNTIME_ERROR_CODES`, a fixed local message record, `isAppRuntimeErrorCode()`, and `AppRuntimeError`. The constructor accepts only `(code, requestId?)` and calls `super(FIXED_MESSAGES[code])`.

Create `src/protocol.ts` with:

```ts
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

export function normalizeTimeout(value: number | undefined): number {
  if (!Number.isFinite(value)) return 3000
  return Math.min(30000, Math.max(100, Math.floor(value as number)))
}
```

Implement `parseRuntimeResponse(value, requestId)` in this order:

1. Ignore non-plain values, foreign channel, and foreign request ID.
2. Reject matching version other than numeric `1` with `unsupported_protocol`.
3. Ignore matching messages whose type is neither terminal response type.
4. For `context.result`, require `ok === true`, a plain `data`, and all seven approved string fields; reconstruct a fresh allowlisted object.
5. For `context.error`, require `ok === false`, plain `error`, and one of the four P8 host codes; construct a local `AppRuntimeError` and ignore host message text.
6. Map every malformed matching terminal response and unknown host code to `invalid_response`.

- [ ] **Step 5: Run the source verifier to prove GREEN**

```powershell
cd web
pnpm.cmd exec tsx packages/app-runtime-sdk/scripts/verify-sdk.ts
```

Expected: `App runtime SDK verified.`

- [ ] **Step 6: Review and commit Task 1**

```powershell
git diff --check
git status --short
git add web/pnpm-workspace.yaml web/packages/app-runtime-sdk
git commit -m "feat(sdk): add runtime protocol contracts"
```

Expected: one local commit containing only workspace registration and pure SDK contracts.

---

### Task 2: Implement Browser Request Lifecycle With Deterministic Tests

**Files:**

- Create: `web/packages/app-runtime-sdk/src/client.ts`
- Create: `web/packages/app-runtime-sdk/src/index.ts`
- Modify: `web/packages/app-runtime-sdk/scripts/verify-sdk.ts`

**Interfaces:**

- Consumes: `RuntimeRequest`, `parseRuntimeResponse()`, `normalizeTimeout()`, `AppRuntimeError`, and browser `window.parent`.
- Produces: internal `createGetContext(resolveWindow)` test seam and public `getContext(options?)`.

- [ ] **Step 1: Add a deterministic fake window and failing lifecycle cases**

Extend the source phase of `verify-sdk.ts` with a `FakeRuntimeWindow` that records posted messages, message listeners, abort listeners, timers, and removals. Its parent object must expose `postMessage`, and `emit(data, source = parent)` must invoke a snapshot of current listeners.

Add sequential assertions for these exact cases:

- top-level window (`parent === window`) and absent window reject `host_unavailable` without posting;
- a pre-aborted signal rejects `aborted` without posting or listener registration;
- a successful request posts exactly `{ channel, version: 1, type: 'context.get', request_id }` to `"*"`;
- foreign source, channel, request ID, and unrelated type remain pending;
- a valid success resolves a newly constructed allowlisted object;
- two concurrent requests have distinct IDs and reverse-order responses settle only their owners;
- each fixed host error preserves its code but not host text;
- unsupported protocol, malformed matching terminal response, and unknown error code reject deterministically;
- timeout uses normalized delay and rejects `timeout` without retry;
- in-flight abort rejects `aborted`;
- parent `postMessage` throwing rejects `host_unavailable`;
- every resolve/reject path removes one message listener, optional abort listener, and timer exactly once;
- a late response after settlement has no effect.

Use a helper that fails when an expected rejection is not an `AppRuntimeError`:

```ts
async function expectRuntimeError(promise: Promise<unknown>, code: AppRuntimeErrorCode) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof AppRuntimeError)
    assert.equal(error.code, code)
    return true
  })
}
```

- [ ] **Step 2: Run the verifier to prove RED**

```powershell
cd web
pnpm.cmd exec tsx packages/app-runtime-sdk/scripts/verify-sdk.ts
```

Expected: FAIL because `createGetContext` and `getContext` do not exist.

- [ ] **Step 3: Implement the browser client**

Define focused internal interfaces in `client.ts` rather than depending on DOM implementation classes:

```ts
interface RuntimeMessageEvent {
  source: unknown
  data: unknown
}

interface RuntimeMessageTarget {
  postMessage(message: unknown, targetOrigin: string): void
}

interface RuntimeWindow extends RuntimeMessageTarget {
  parent: RuntimeMessageTarget | RuntimeWindow
  crypto?: Pick<Crypto, 'randomUUID' | 'getRandomValues'>
  addEventListener(type: 'message', listener: (event: RuntimeMessageEvent) => void): void
  removeEventListener(type: 'message', listener: (event: RuntimeMessageEvent) => void): void
  setTimeout(handler: () => void, timeout: number): ReturnType<typeof setTimeout>
  clearTimeout(timer: ReturnType<typeof setTimeout>): void
}

export function createGetContext(resolveWindow: () => RuntimeWindow | undefined) {
  return function getContext(options: GetContextOptions = {}): Promise<AppRuntimeContext> {
    return new Promise<AppRuntimeContext>((resolve, reject) => {
      const runtimeWindow = resolveWindow()
      if (!runtimeWindow || runtimeWindow.parent === runtimeWindow) {
        reject(new AppRuntimeError('host_unavailable'))
        return
      }
      if (options.signal?.aborted) {
        reject(new AppRuntimeError('aborted'))
        return
      }
      startRuntimeRequest(runtimeWindow, options, resolve, reject)
    })
  }
}
```

Keep `startRuntimeRequest()` private in `client.ts`; it contains the request-owned state and cleanup shown next, creates the request ID, registers listeners, posts once, and settles through `resolveOnce` or `rejectOnce`.

Use this exact private signature so the public and test seams remain stable:

```ts
function startRuntimeRequest(
  runtimeWindow: RuntimeWindow,
  options: GetContextOptions,
  resolve: (context: AppRuntimeContext) => void,
  reject: (error: AppRuntimeError) => void
): void
```

Implement each call with request-owned state:

```ts
let settled = false
let timer: ReturnType<typeof setTimeout> | undefined
let abortAttached = false

const cleanup = () => {
  if (timer !== undefined) runtimeWindow.clearTimeout(timer)
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
```

Generate IDs with `crypto.randomUUID()` when available. The fallback must call `getRandomValues(new Uint32Array(4))` when available and combine those words with `Date.now()` and a module counter; use no `Math.random()` and treat the value only as correlation data.

Register the message listener and optional abort listener before posting. Start the timeout before posting, call parent `postMessage(request, '*')` exactly once, and catch a synchronous post failure as `host_unavailable`. Export only this public singleton in `index.ts`:

```ts
export { APP_RUNTIME_CHANNEL, APP_RUNTIME_PROTOCOL_VERSION } from './protocol'
export { APP_RUNTIME_ERROR_CODES, AppRuntimeError } from './errors'
export type { AppRuntimeContext, AppRuntimeErrorCode, GetContextOptions } from './types'

import { createGetContext, type RuntimeWindow } from './client'

export const getContext = createGetContext(() =>
  typeof window === 'undefined' ? undefined : (window as unknown as RuntimeWindow)
)
```

Export `RuntimeWindow` from `client.ts` for source tests only, but do not re-export it from `index.ts`.

- [ ] **Step 4: Run lifecycle tests to prove GREEN and stable concurrency**

```powershell
cd web
pnpm.cmd exec tsx packages/app-runtime-sdk/scripts/verify-sdk.ts
pnpm.cmd exec tsx packages/app-runtime-sdk/scripts/verify-sdk.ts
```

Expected: both runs print `App runtime SDK verified.` with no open-handle delay.

- [ ] **Step 5: Review and commit Task 2**

```powershell
git diff --check
git add web/packages/app-runtime-sdk/src web/packages/app-runtime-sdk/scripts/verify-sdk.ts
git commit -m "feat(sdk): add runtime context client"
```

---

### Task 3: Produce And Verify ESM, IIFE, And Declarations

**Files:**

- Create: `web/packages/app-runtime-sdk/vite.config.ts`
- Modify: `web/packages/app-runtime-sdk/scripts/verify-sdk.ts`
- Modify: `web/package.json`
- Modify: `web/pnpm-lock.yaml`

**Interfaces:**

- Consumes: public `src/index.ts` API.
- Produces: publication-ready ESM/types metadata, `window.AgentStudioRuntime`, size/security gate, and root command `verify:app-runtime-sdk`.

- [ ] **Step 1: Make the built-output phase fail before a build configuration exists**

```powershell
cd web
pnpm.cmd exec tsx packages/app-runtime-sdk/scripts/verify-sdk.ts --built
```

Expected: FAIL because `dist/index.js` and `dist/agentstudio-runtime.global.js` do not exist.

- [ ] **Step 2: Add the exact Vite library build**

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    emptyOutDir: true,
    minify: 'esbuild',
    sourcemap: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'AgentStudioRuntime',
      formats: ['es', 'iife'],
      fileName: (format) =>
        format === 'es' ? 'index.js' : 'agentstudio-runtime.global.js'
    }
  }
})
```

Update `verify-sdk.ts --built` to scan both JavaScript outputs with this denylist:

```ts
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
```

Also assert there is no `.map` file, `package.json` has no `main` CommonJS entry, all exported metadata paths exist, declarations contain `getContext`, `GetContextOptions`, `AppRuntimeContext`, and `AppRuntimeError`, and IIFE evaluation exposes only the approved runtime API and constants.

- [ ] **Step 3: Add the root SDK gate and refresh the lockfile**

Add to `web/package.json` scripts:

```json
"verify:app-runtime-sdk": "pnpm --filter @agentstudio/app-runtime-sdk verify"
```

Run:

```powershell
cd web
pnpm.cmd install --lockfile-only
```

Expected: `web/pnpm-lock.yaml` registers the workspace package without adding an SDK runtime dependency.

- [ ] **Step 4: Build and verify all formats**

```powershell
cd web
pnpm.cmd --filter @agentstudio/app-runtime-sdk build
pnpm.cmd run verify:app-runtime-sdk
```

Expected: ESM, IIFE, and declarations exist; each JavaScript file is at most `10240` bytes; verifier prints `App runtime SDK verified.`

- [ ] **Step 5: Review package boundaries and commit Task 3**

```powershell
git status --short
git diff --check
git check-ignore web/packages/app-runtime-sdk/dist/index.js
git add web/package.json web/pnpm-lock.yaml web/packages/app-runtime-sdk/vite.config.ts web/packages/app-runtime-sdk/scripts/verify-sdk.ts
git commit -m "build(sdk): publish runtime browser formats"
```

Expected: generated `dist` remains untracked and ignored.

---

### Task 4: Build The Pure HTML Runtime Starter And Deterministic ZIP

**Files:**

- Create: `web/examples/runtime-starter/manifest.json`
- Create: `web/examples/runtime-starter/index.html`
- Create: `web/examples/runtime-starter/styles.css`
- Create: `web/examples/runtime-starter/app.js`
- Create: `web/scripts/build-runtime-starter.ts`
- Create: `web/scripts/verify-app-runtime-starter.ts`
- Modify: `web/package.json`
- Modify: `web/pnpm-lock.yaml`
- Modify: `web/.gitignore`

**Interfaces:**

- Consumes: current SDK IIFE output and production static manifest/package rules.
- Produces: `web/.artifacts/runtime-starter.zip`, exact allowlisted archive entries, and `verify:app-runtime-starter`.

- [ ] **Step 1: Add `jszip` as a web-root development dependency and write the failing gate**

```powershell
cd web
pnpm.cmd add -D jszip@^3.10.1
```

Add `verify-app-runtime-starter.ts` assertions for the exact file set:

```ts
const allowedFiles = new Set([
  'manifest.json',
  'index.html',
  'styles.css',
  'app.js',
  'vendor/agentstudio-runtime.global.js'
])

const expectedManifest = {
  code: 'runtime_starter',
  name: 'Runtime Starter',
  version: '1.0.0',
  type: 'static',
  entry: 'index.html',
  tenant_scoped: true,
  permissions: ['runtime:context:read']
}
```

The verifier must reject symlinks, absolute/traversal paths, hidden environment files, source maps, executable extensions from `AppManifestService`, unexpected entries, missing root manifest/entry, and any text matching `password|access_token|refresh_token|authorization|cookie|localStorage|sessionStorage`.

Run it before creating source files:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-app-runtime-starter.ts
```

Expected: FAIL because the starter manifest and ZIP do not exist.

- [ ] **Step 2: Create the exact manifest and accessible page shell**

Create `manifest.json` exactly as `expectedManifest` above. Create `index.html` with one `main`, a heading `Runtime Starter`, an element with `role="status" aria-live="polite"`, loading/error/success sections controlled with the `hidden` attribute, seven `<dd>` value targets, and a native `<button id="retry" type="button">Retry</button>`. Load scripts in this order:

```html
<script src="./vendor/agentstudio-runtime.global.js"></script>
<script src="./app.js"></script>
```

Do not include inline script, remote asset, raw protocol wording, credentials, setup instructions, or marketing copy.

- [ ] **Step 3: Implement safe starter rendering**

In `app.js`, keep the only runtime state as an incrementing attempt number. Use `textContent`, never `innerHTML`. Map errors to these fixed user messages:

```js
var ERROR_COPY = {
  scope_denied: 'This app is not allowed to read runtime context.',
  context_unavailable: 'Runtime context is not available right now.',
  timeout: 'The host did not respond in time.',
  aborted: 'The request was cancelled.',
  host_unavailable: 'Open this app from AgentStudio to continue.',
  unsupported_protocol: 'This host version is not supported.',
  unsupported_request: 'This runtime request is not supported.',
  invalid_response: 'The host returned an invalid response.'
}
```

`loadContext()` sets loading before calling `AgentStudioRuntime.getContext()`, renders all seven fields on success, and on failure reads only `error.code`. Retry increments the attempt and starts a fresh call. Do not call `console.*`.

- [ ] **Step 4: Implement deterministic assembly and ZIP creation**

Export `buildRuntimeStarter()` from `build-runtime-starter.ts`. It must:

1. Resolve all paths from `webRoot = process.cwd()` and fail unless `web/package.json` is present.
2. Run no implicit install; require the current IIFE output to exist and direct the caller to run the SDK build if missing.
3. Create a temporary directory under `web/.artifacts/runtime-starter-assembly-<pid>`.
4. `lstatSync` every source and reject symbolic links.
5. Copy only the five allowlisted files, with the SDK output copied into `vendor/`.
6. Add each file to `JSZip` in sorted order with `date: new Date('2000-01-01T00:00:00.000Z')`, `createFolders: false`, and UNIX permissions `0o100644`.
7. Generate with DEFLATE level 9, write atomically to `web/.artifacts/runtime-starter.zip`, and always remove the temporary assembly directory in `finally`.

Use this exported result:

```ts
export interface RuntimeStarterBuildResult {
  zipPath: string
  files: string[]
  sdkSha256: string
}
```

The `sdkSha256` is evidence only; do not print archive contents or secret-bearing environment values.

- [ ] **Step 5: Add commands and prove the starter gate GREEN**

Add scripts:

```json
"build:app-runtime-starter": "pnpm --filter @agentstudio/app-runtime-sdk build && tsx scripts/build-runtime-starter.ts",
"verify:app-runtime-starter": "pnpm run build:app-runtime-starter && tsx scripts/verify-app-runtime-starter.ts"
```

Add this generated-output rule to `web/.gitignore`:

```gitignore
.artifacts/
```

Run:

```powershell
cd web
pnpm.cmd run verify:app-runtime-starter
pnpm.cmd run verify:app-runtime-starter
Get-FileHash .artifacts/runtime-starter.zip -Algorithm SHA256
```

Expected: both gates pass and repeated builds produce the same SHA-256.

- [ ] **Step 6: Review the archive and commit Task 4**

```powershell
git diff --check
git status --short
git check-ignore web/.artifacts/runtime-starter.zip
git add web/examples/runtime-starter web/scripts/build-runtime-starter.ts web/scripts/verify-app-runtime-starter.ts web/package.json web/pnpm-lock.yaml web/.gitignore
git commit -m "feat(app): add runtime starter package"
```

---

### Task 5: Prove The Full Platform-To-Tenant Runtime Flow

**Files:**

- Create: `web/scripts/verify-app-runtime-live-e2e.ts`
- Modify: `web/package.json`

**Interfaces:**

- Consumes: MySQL CLI, `server/scripts/verify-db-init.cjs`, built server/frontend, explicit platform bootstrap credentials, local Redis, real app platform and tenant APIs, and Runtime Starter ZIP.
- Produces: disposable authenticated lifecycle evidence and `verify:app-runtime-live-e2e`.

- [ ] **Step 1: Write a preflight-only E2E and prove missing requirements fail safely**

Define these environment variables without defaults for secrets:

```text
APP_RUNTIME_E2E_DB_HOST
APP_RUNTIME_E2E_DB_PORT
APP_RUNTIME_E2E_DB_USERNAME
APP_RUNTIME_E2E_DB_PASSWORD
APP_RUNTIME_E2E_PLATFORM_USERNAME
APP_RUNTIME_E2E_PLATFORM_PASSWORD
APP_RUNTIME_E2E_REDIS_DB
APP_RUNTIME_E2E_REDIS_ISOLATED=1
```

Optional safe controls:

```text
APP_RUNTIME_E2E_REDIS_HOST=127.0.0.1
APP_RUNTIME_E2E_REDIS_PORT=6379
APP_RUNTIME_E2E_REDIS_PASSWORD
APP_RUNTIME_E2E_SERVER_PORT=19110
APP_RUNTIME_E2E_WEB_PORT=19111
APP_RUNTIME_E2E_KEEP=0
```

The Redis database must be an empty, dedicated logical DB from `1` to `15`. Use one Lua operation to atomically require an empty DB and claim it with an E2E ownership marker before the backend starts. After the backend has fully exited, use a second Lua operation to atomically compare the marker and execute `FLUSHDB` only on that selected DB. Any cleanup failure must fail the gate.

Generate a database name `agentstudio_runtime_e2e_<UTC timestamp>_<pid>` and reject names that fail `/^[a-z0-9_]+$/`, lack `_e2e_`, or contain `prod|production|live`. Generate tenant username, strong password, tenant name, and phone in memory. Never print any password, token, cookie, authorization header, login response, or DB connection string.

Run with no environment:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-app-runtime-live-e2e.ts
```

Expected: FAIL before process/database creation with only missing variable names, never values.

- [ ] **Step 2: Add process, API, redaction, and cleanup primitives**

Implement these exact helpers with bounded output:

```ts
function redact(value: string): string
function runChecked(command: string, args: string[], options: SpawnSyncOptions): void
function startProcess(label: string, command: string, args: string[], options: SpawnOptions): ChildProcess
async function waitForHttp(url: string, timeoutMs: number): Promise<void>
async function requestJson<T>(path: string, options: RequestOptions): Promise<T>
async function requestMultipart<T>(path: string, token: string, filePath: string): Promise<T>
async function stopProcess(child: ChildProcess | undefined): Promise<void>
async function dropDatabase(): Promise<void>
```

Build a `sensitiveValues` set from the DB password, platform password, Redis password, generated tenant password, generated JWT secret, returned access/refresh tokens, and observed cookie values. `redact()` must replace every non-empty set member plus bearer tokens, cookies, and JSON fields matching `/password|token|secret|authorization|cookie/i`. Keep at most the final 80 lines and 20,000 characters per child-process buffer. Every failure artifact passes through `redact()` before writing.

Wrap `main()` in `try/catch/finally`; `finally` closes Playwright, stops preview and backend, clears the owned isolated Redis DB, and drops the MySQL DB unless `APP_RUNTIME_E2E_KEEP=1`. Register `SIGINT` and `SIGTERM` handlers that invoke the same idempotent cleanup path. If initialization fails, preserve the MySQL DB only when the keep flag is explicit; never preserve authentication caches.

- [ ] **Step 3: Initialize disposable data and start real builds**

Use `server/scripts/verify-db-init.cjs` with this child environment:

```ts
{
  DB_HOST,
  DB_PORT,
  DB_USERNAME,
  DB_PASSWORD,
  DB_VERIFY_NAME: databaseName,
  DB_VERIFY_KEEP: '1'
}
```

Then run, in order:

```powershell
pnpm.cmd --dir ../server run build
pnpm.cmd run build
pnpm.cmd run build:app-runtime-starter
```

Resolve `artifactRoot = resolve(webRoot, '.artifacts', 'app-runtime-e2e', databaseName)`. Start `node ../server/dist/main.js` with `NODE_ENV=test`, the disposable `DB_NAME`, configured Redis values, unique `PORT`, a generated in-memory `JWT_SECRET`, `LOGIN_CAPTCHA_ENABLED=false`, `APP_PACKAGE_DIR=resolve(artifactRoot, 'packages')`, `APP_PUBLIC_DIR=resolve(artifactRoot, 'public')`, and `APP_PUBLIC_PREFIX=/apps-static/`. Start Vite preview with `--strictPort`. Wait for backend `GET /api/core/login-captcha` and frontend `GET /` before authentication.

- [ ] **Step 4: Execute the real API lifecycle**

Authenticate the seeded platform administrator through `/api/core/tenants-by-credentials` and `/api/core/login`, then verify the current profile is platform-admin capable. Execute:

```ts
await post('/api/app-platform/apps', platformToken, {
  code: 'runtime_starter',
  name: 'Runtime Starter',
  type: 'static',
  category: 'developer_tools',
  summary: 'Runtime context starter',
  visibility: 'marketplace',
  developer_name: 'AgentStudio'
})
await upload('/api/app-platform/apps/runtime_starter/versions/upload', platformToken, zipPath)
await post('/api/app-platform/apps/runtime_starter/versions/1.0.0/approve', platformToken, {
  message: 'P9-A automated review'
})
await post('/api/app-platform/apps/runtime_starter/versions/1.0.0/publish', platformToken, {})
```

Register the disposable tenant owner through `/api/saas/signup` with `{ username, password, tenant_name, phone }`, resolve its tenant ID through the credential-gated tenant lookup, log in through `/api/core/login`, verify `/api/core/system/user`, and install through `/api/app-tenant/apps/runtime_starter/install`.

Assert every response envelope has numeric `code === 200`. Error descriptions may include endpoint, HTTP status, envelope code, and redacted message only; never include raw bodies.

- [ ] **Step 5: Add authenticated Playwright proof**

Follow the existing `verify-saas-live-browser-e2e.ts` browser authentication pattern: route only `**/api/**` to the real backend, preserve safe request headers, and seed login state with the tenant access/refresh tokens without printing them.

Navigate to:

```ts
await page.goto(`${webBaseUrl}/#/app-center/open?code=runtime_starter`)
```

Assert:

```ts
const iframe = page.locator('iframe.app-runner-page__iframe')
await expect(iframe).toHaveAttribute('sandbox', /allow-scripts/)
await expect(iframe).not.toHaveAttribute('sandbox', /allow-same-origin/)
const frame = page.frameLocator('iframe.app-runner-page__iframe')
await expect(frame.getByRole('status')).toContainText('Runtime context is ready')
```

Verify all seven displayed values equal the signup/profile/open-metadata identities and every ID is rendered as a string. Capture the host open-metadata response and runtime `context.result` in memory only long enough to assert the fixed allowlist. Assert forbidden field names and all generated/explicit credential values are absent from iframe text, host text, metadata serialization, runtime payload serialization, browser console, and failure evidence.

Reload the page, wait for a second successful rendering, and assert exactly one matching `context.result` was observed for the new request ID. This proves no duplicate host response or retained SDK request listener.

- [ ] **Step 6: Add failure evidence and the root command**

On failure write only:

- `.artifacts/app-runtime-e2e/failure.png`;
- `.artifacts/app-runtime-e2e/browser-console.txt` with at most 100 redacted lines;
- `.artifacts/app-runtime-e2e/steps.json` containing safe step labels, timestamps, database name, app code, and ports.

Add:

```json
"verify:app-runtime-live-e2e": "tsx scripts/verify-app-runtime-live-e2e.ts"
```

Run with local explicit credentials:

```powershell
cd web
pnpm.cmd run verify:app-runtime-live-e2e
```

Expected: one final safe line `App runtime live E2E verified.`; all child processes are stopped and the disposable database is absent afterward.

- [ ] **Step 7: Review and commit Task 5**

```powershell
git diff --check
git status --short
git add web/scripts/verify-app-runtime-live-e2e.ts web/package.json
git commit -m "test(app): prove runtime SDK lifecycle"
```

---

### Task 6: Run Regression Gates, Security Review, And Document Readiness

**Files:**

- Modify: `docs/saas-launch-readiness-checklist.md`
- Review: all P9-A files from Tasks 1-5

**Interfaces:**

- Consumes: all deterministic and live P9-A gates plus existing P8/app marketplace suites.
- Produces: launch checklist evidence and a final locally committed P9-A slice.

- [ ] **Step 1: Add deterministic launch-readiness checks**

Document these commands exactly:

```powershell
cd web
pnpm.cmd run verify:app-runtime-sdk
pnpm.cmd run verify:app-runtime-starter
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd exec eslint packages/app-runtime-sdk/src packages/app-runtime-sdk/scripts scripts/build-runtime-starter.ts scripts/verify-app-runtime-starter.ts scripts/verify-app-runtime-live-e2e.ts
pnpm.cmd run build

cd ../server
pnpm.cmd exec jest --runInBand -- app-manifest.service.spec.ts app-package-storage.service.spec.ts app-platform.service.spec.ts app-tenant.service.spec.ts app-runtime-context.service.spec.ts
pnpm.cmd run build
```

Add a separate opt-in section for `pnpm.cmd run verify:app-runtime-live-e2e` listing required variable names but no sample secrets.

- [ ] **Step 2: Add manual acceptance checks**

Checklist items must require proof that:

- npm/ESM import and browser IIFE expose the same API and fixed errors;
- Runtime Starter loading, success, error, and Retry states are keyboard accessible and responsive;
- iframe sandbox omits `allow-same-origin`;
- no credentials or forbidden identity fields appear in UI, payload, logs, screenshots, or artifacts;
- repeated page load creates one fresh request and response;
- production upload accepts the generated ZIP;
- P9-B/P9-C capabilities remain unavailable.

- [ ] **Step 3: Run deterministic gates and fix only P9-A regressions**

Run every command from Step 1. Expected: all commands exit `0`. If a pre-existing unrelated failure appears, record the exact command and error in the execution notes; do not weaken or skip a P9-A assertion.

- [ ] **Step 4: Perform focused security and maintainability review**

Search source and generated output:

```powershell
rg -n "access[_-]?token|refresh[_-]?token|authorization|cookie|localStorage|sessionStorage|innerHTML|allow-same-origin|fetch\(|axios" packages/app-runtime-sdk examples/runtime-starter scripts/build-runtime-starter.ts scripts/verify-app-runtime-starter.ts
rg -n "TODO|TBD|implement later|console\." packages/app-runtime-sdk examples/runtime-starter scripts/verify-app-runtime-live-e2e.ts
```

Expected: only intentional denylist/test strings and the host sandbox assertion appear. No production SDK/starter code accesses credentials, storage, network APIs, `innerHTML`, or console logging.

Review `git diff` for accidental generated artifacts, secret values, broad refactors, backend authority changes, and P8 runner changes. None are allowed in P9-A.

- [ ] **Step 5: Run the live gate once and inspect teardown**

```powershell
cd web
pnpm.cmd run verify:app-runtime-live-e2e
```

Expected: full create/upload/approve/publish/signup/login/install/open/reload path passes; no backend/preview process remains; disposable database is dropped; artifacts contain no credential value.

- [ ] **Step 6: Commit documentation and final review fixes**

```powershell
git diff --check
git status --short
git add docs/saas-launch-readiness-checklist.md
git commit -m "docs: add app runtime SDK readiness"
git log --oneline -7
git status --short --branch
```

Expected: clean worktree, local P9-A commits present, and no push performed.

## Final Acceptance Matrix

| Requirement | Primary proof |
| --- | --- |
| TypeScript consumer imports API/types | SDK build plus declaration assertions |
| Pure HTML consumer uses IIFE | VM global assertion plus Runtime Starter |
| Zero runtime dependencies | package metadata and lockfile gate |
| Fixed context allowlist | parser tests and captured live payload |
| Timeout/abort/concurrency/cleanup | fake-window deterministic lifecycle tests |
| ESM/IIFE each at most 10KB | built-output size gate |
| Valid production static ZIP | starter archive gate plus real upload API |
| Review/publish/install/open lifecycle | disposable API E2E |
| Authenticated sandboxed browser flow | Playwright iframe proof |
| No credential leakage | denylist scans, runtime assertions, redacted evidence |
| P8 and marketplace preserved | existing readiness and backend focused suites |
| Local review and commits only | clean branch and no push |
