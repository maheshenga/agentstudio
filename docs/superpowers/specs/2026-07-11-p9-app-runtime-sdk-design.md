# P9-A App Runtime SDK And Starter Design

**Status:** Approved conversational design and self-reviewed written specification

**Goal:** Provide a zero-dependency, framework-agnostic SDK and reviewed static starter application that prove the P8 runtime context contract through a real platform-review, tenant-install, authenticated-browser workflow.

## Context

P8 established a read-only host bridge for reviewed static applications. A static app whose resolved manifest declares `runtime:context:read` can request a sanitized tenant, user, and app context through a versioned `postMessage` protocol. The host validates the current iframe `WindowProxy`, keeps the iframe sandboxed without `allow-same-origin`, and never forwards platform credentials.

P9-A turns that low-level protocol into a supported developer experience. It adds an independently buildable SDK, a pure HTML reference application, deterministic SDK gates, and a disposable full-lifecycle browser E2E. It does not expand the P8 authority boundary.

The repository already contains unrelated historical plans whose names include P9. This specification uses the explicit name **P9-A App Runtime SDK** to avoid confusing it with the older SaaS preview-smoke work.

## Product Decisions

- SDK package name: `@agentstudio/app-runtime-sdk`.
- Initial package version: `0.1.0`.
- Package location: `web/packages/app-runtime-sdk` inside the existing web pnpm workspace.
- Delivery formats: zero-dependency ESM, browser IIFE, and TypeScript declarations.
- Browser global: `window.AgentStudioRuntime`.
- Public API style: Promise-based `getContext()`.
- Official example: pure HTML Runtime Starter, not a framework application or industry workflow.
- E2E depth: disposable MySQL plus the real backend, frontend, authentication, review, publish, install, and sandboxed iframe flow.
- npm metadata may be publication-ready, but P9-A does not publish the package to npm.

## Scope

### Included

- Independent SDK package registered under the web workspace.
- ESM and IIFE bundles plus `.d.ts` declarations.
- Promise API for retrieving the P8 sanitized runtime context.
- Timeout, cancellation, concurrent requests, fixed errors, and listener cleanup.
- Response-source, protocol, request-ID, and allowlisted-context validation.
- Pure HTML/CSS/JavaScript Runtime Starter.
- Build-time assembly of the SDK IIFE into the starter package.
- Static package manifest and ZIP readiness checks.
- Full platform-to-tenant authenticated browser E2E on disposable data.
- Launch-readiness documentation and executable package scripts.

### Excluded

- Runtime access tokens, refresh tokens, signed sessions, or direct iframe-to-backend APIs.
- KV storage, database access, file, notification, navigation, billing, AI, or write capabilities.
- Dynamic scope consent or installation-time permission approval UI.
- External iframe and internal-route app integration.
- Backend-executable service plugins or containers.
- npm publication, CDN publication, or semantic-release automation.

## Package Architecture

### Workspace layout

```text
web/
  packages/
    app-runtime-sdk/
      package.json
      tsconfig.json
      vite.config.ts
      src/
        index.ts
        client.ts
        protocol.ts
        types.ts
        errors.ts
      scripts/
        verify-sdk.ts
      dist/
        index.js
        index.d.ts
        agentstudio-runtime.global.js
  examples/
    runtime-starter/
      manifest.json
      index.html
      styles.css
      app.js
      vendor/
        agentstudio-runtime.global.js
  scripts/
    build-runtime-starter.ts
    verify-app-runtime-starter.ts
    verify-app-runtime-live-e2e.ts
```

`dist` and the assembled starter `vendor` file are generated outputs. The implementation plan must decide which generated files remain ignored and which test fixture, if any, is intentionally committed. Source files and deterministic build scripts are authoritative.

### Build outputs

- ESM: `dist/index.js`.
- Browser IIFE: `dist/agentstudio-runtime.global.js`.
- Types: `dist/index.d.ts` plus any declarations referenced by it.
- IIFE global name: `AgentStudioRuntime`.
- Each minified JavaScript output must be at most `10KB`.
- Bundles must have no runtime dependencies and no source map in the starter ZIP.

### Package exports

The package exposes ESM JavaScript and TypeScript declarations through `exports`, `module`, and `types`. P9-A does not add a CommonJS build.

## Public SDK Contract

```ts
export interface AppRuntimeContext {
  tenant: {
    id: string
    name: string
  }
  user: {
    id: string
    display_name: string
  }
  app: {
    code: string
    name: string
    version: string
  }
}

export interface GetContextOptions {
  timeoutMs?: number
  signal?: AbortSignal
}

export function getContext(options?: GetContextOptions): Promise<AppRuntimeContext>
```

IIFE usage:

```html
<script src="./vendor/agentstudio-runtime.global.js"></script>
<script>
  AgentStudioRuntime.getContext()
    .then(function (context) {
      renderApprovedContext(context)
    })
    .catch(function (error) {
      renderSafeRuntimeError(error.code)
    })
</script>
```

The starter defines both rendering functions and never logs the complete context or public error object.

The SDK exports its protocol version, supported host error codes, context types, `GetContextOptions`, `AppRuntimeError`, and `getContext`. It does not export an HTTP client, token accessor, storage facade, raw message listener, or arbitrary `postMessage` helper.

## Timeout And Cancellation

- Default timeout: `3000ms`.
- Effective timeout range: `100ms` to `30000ms`.
- A finite supplied timeout is floored to an integer and clamped into that range.
- A missing or non-finite timeout uses `3000ms`.
- A signal already aborted before invocation rejects immediately without posting a request.
- An abort after posting rejects the request and removes all request-owned resources.
- The SDK does not automatically retry.

## Request Lifecycle

For each `getContext()` call:

1. Verify a browser environment exists and `window.parent !== window`; otherwise reject with `host_unavailable`.
2. Normalize timeout options.
3. Generate a unique request ID using `crypto.randomUUID()` when available. A fallback may combine `crypto.getRandomValues()` with monotonic/time data; request IDs are correlation values, not credentials.
4. Register one request-owned `message` listener and optional abort listener.
5. Post the exact P8 request to `window.parent` using `targetOrigin: "*"` because the static iframe has an opaque sandbox origin.
6. Ignore messages that do not match the parent window, channel, request ID, or expected response type.
7. Validate response protocol version, success/error shape, fixed error code, and context allowlist.
8. Resolve with a newly constructed context object or reject with `AppRuntimeError`.
9. On every terminal path, clear the timer and remove message and abort listeners exactly once.

Concurrent calls are supported. Each call owns its request ID, timer, and listeners and must not settle another call.

## Response Validation

The SDK accepts responses only when all applicable conditions hold:

- `event.source === window.parent`;
- message is a plain object;
- `channel === "agentstudio:app-runtime"`;
- `request_id` exactly matches the current request;
- protocol version is numeric `1`;
- type is `context.result` or `context.error`;
- success payload contains all approved string fields;
- error payload contains a supported fixed code.

On success, the SDK reconstructs this exact object:

```ts
{
  tenant: { id, name },
  user: { id, display_name },
  app: { code, name, version }
}
```

Extra properties are discarded. The SDK never returns the received object by reference.

A message from the correct parent with the matching request ID but an invalid terminal response rejects with `invalid_response`. Unrelated or foreign messages are ignored until timeout or a valid terminal response.

## Error Contract

```ts
export type AppRuntimeErrorCode =
  | 'unsupported_protocol'
  | 'unsupported_request'
  | 'scope_denied'
  | 'context_unavailable'
  | 'timeout'
  | 'aborted'
  | 'host_unavailable'
  | 'invalid_response'

export class AppRuntimeError extends Error {
  readonly code: AppRuntimeErrorCode
  readonly requestId?: string
}
```

Rules:

- Host error codes are preserved, but SDK messages come from a fixed local mapping rather than arbitrary host text.
- `requestId` may be included for correlation after a request has been created.
- Raw message payloads, browser events, backend exceptions, tokens, and request headers are never attached to the public error.
- Unknown host error codes map to `invalid_response`.
- Matching responses with an unsupported protocol map to `unsupported_protocol`.

## Runtime Starter

### Manifest

```json
{
  "code": "runtime_starter",
  "name": "Runtime Starter",
  "version": "1.0.0",
  "type": "static",
  "entry": "index.html",
  "tenant_scoped": true,
  "permissions": ["runtime:context:read"]
}
```

The manifest must pass the existing `AppManifestService.validateStaticManifest()` contract and the app code/version checks used by platform upload.

### User experience

The starter is a quiet diagnostic application, not a marketing page. It contains:

- a stable loading state while `getContext()` is pending;
- a success view for tenant, user, and app fields;
- fixed safe error views for denied, unavailable, timeout, and unsupported-host cases;
- a Retry action that creates a new SDK request;
- accessible status text and keyboard-operable controls;
- responsive layout without nested cards or decorative effects.

The page does not display protocol internals, platform instructions, credentials, raw errors, or hidden context fields. Developer-facing usage belongs in repository documentation.

## Starter Assembly And ZIP

The starter build performs these deterministic steps:

1. Build the SDK.
2. Copy the IIFE bundle to `runtime-starter/vendor/agentstudio-runtime.global.js` in a temporary assembly directory.
3. Copy the starter manifest, HTML, CSS, and JavaScript.
4. Reject symlinks, hidden environment files, source maps, unexpected executables, and files outside the allowlisted starter set.
5. Create a ZIP with `manifest.json` at the archive root.
6. Validate the ZIP using the same manifest and package-storage boundaries exercised by production upload.

The package contains no Node.js runtime, package manager files, server code, credentials, or environment configuration.

## Full-Lifecycle E2E

### Environment

- Use a uniquely named disposable MySQL database.
- Use the configured local Redis instance without storing credentials in output.
- Choose non-conflicting backend and frontend ports.
- Generate disposable identity credentials in memory or receive them through explicit environment variables.
- Never print passwords, bearer tokens, refresh tokens, cookies, database passwords, or complete authentication responses.

### Setup flow

1. Initialize the disposable database and run the full migration/bootstrap gate.
2. Build backend and frontend production assets.
3. Build the SDK and Runtime Starter ZIP.
4. Start the backend and wait for health checks.
5. Authenticate a disposable platform administrator.
6. Create the `runtime_starter` static app.
7. Upload version `1.0.0`, approve it, and publish it.
8. Register a disposable tenant owner through the public signup flow.
9. Authenticate the tenant owner and install `runtime_starter`.
10. Start or reuse the built frontend preview.

### Browser proof

Playwright must:

1. Establish the real tenant login state using the existing browser-E2E authentication pattern.
2. Open `/#/app-center/open?code=runtime_starter`.
3. Locate the current iframe and prove its sandbox omits `allow-same-origin`.
4. Wait for the Runtime Starter success state.
5. Assert displayed tenant name/ID, user display name/ID, app code/name/version, and string ID behavior match the disposable identities.
6. Assert forbidden labels and known disposable credential values do not appear in the iframe body, host page, open metadata snapshot, or captured runtime payload.
7. Reload the runner and prove a fresh SDK request succeeds without duplicate responses or retained listeners.

### Teardown and evidence

- Stop every process started by the E2E script.
- Drop the disposable database by default.
- An explicit debug flag may retain data and artifacts, but must print only safe paths and identifiers.
- On failure, save a screenshot, bounded browser console output, and safe step labels.
- Evidence must redact authorization values, cookies, passwords, tokens, database connection secrets, and full request/response bodies.

## Executable Gates

P9-A adds these web package commands:

```text
verify:app-runtime-sdk
verify:app-runtime-starter
verify:app-runtime-live-e2e
```

### SDK gate

Use a deterministic fake window/message bus to cover:

- ESM and IIFE public contracts;
- successful context resolution;
- concurrent requests and request-ID isolation;
- fixed host errors;
- timeout normalization and expiry;
- pre-aborted and in-flight cancellation;
- top-level `host_unavailable`;
- foreign window, channel, request ID, and unrelated messages;
- unsupported response protocol;
- malformed matching response and unknown error code;
- allowlist reconstruction and extra-field removal;
- exactly-once cleanup on every terminal path.

### Build gate

- ESM, IIFE, and declaration outputs exist.
- IIFE exposes `AgentStudioRuntime.getContext`.
- JavaScript outputs meet the `10KB` limit.
- Output contains no access-token, refresh-token, cookie, authorization, local-storage, session-storage, backend API client, or management API reference.
- Package metadata points only to existing output files.

### Starter gate

- Manifest fields and scope are exact.
- Entry file and allowlisted files exist.
- SDK IIFE is assembled from the current SDK build.
- ZIP root and entry are valid.
- No source maps, environment files, executable backend extensions, symlinks, secrets, or unexpected files are present.

### Regression gates

- Existing P8 runtime readiness passes.
- Existing app marketplace readiness passes.
- Focused ESLint passes.
- Frontend production build passes.
- Relevant backend app manifest, package storage, platform upload/review/publish, tenant install/open, and runtime context suites pass.
- Backend production build passes.
- `git diff --check` passes.

## Security Properties

- The SDK has no access to the host SPA API client or authentication store.
- No platform credential crosses the iframe bridge.
- The SDK cannot choose tenant ID, user ID, app code, or runtime scope.
- Runtime authority remains the reviewed resolved manifest plus authenticated host state.
- The SDK validates the exact parent `WindowProxy`, protocol, request ID, and allowlisted payload.
- Timeout and abort paths remove listeners and timers.
- The starter remains static content and cannot execute backend code.
- Real E2E secrets exist only in process memory/environment and disposable stores and are never committed.

## Acceptance Criteria

- A TypeScript consumer can import `getContext`, context types, and `AppRuntimeError` from `@agentstudio/app-runtime-sdk`.
- A pure HTML consumer can call `AgentStudioRuntime.getContext()` from the IIFE bundle.
- Both formats resolve the same allowlisted P8 context and expose the same fixed errors.
- Concurrent, timeout, abort, invalid-response, and cleanup behavior is deterministic and covered by executable tests.
- Runtime Starter builds into a production-valid static ZIP with the exact P8 scope.
- A disposable full-lifecycle E2E proves create, upload, review, publish, signup, install, login, iframe open, and SDK context rendering.
- The iframe sandbox still excludes `allow-same-origin`.
- No token, cookie, authorization value, login username, contact field, role/permission list, network identity, or raw exception appears in SDK outputs, starter output, runtime payload, screenshots, or logs.
- Existing P8 and app marketplace behavior remains green.
- All changes are reviewed and committed locally. Pushing remains a separate explicit action.

## Deferred Work

- P9-B short-lived scoped runtime sessions and capability gateway.
- P9-C KV storage and additional runtime capabilities.
- Installation-time permission consent and revocation UI.
- External iframe support.
- Backend service-module isolation.
- npm/CDN release automation and public version support policy.
