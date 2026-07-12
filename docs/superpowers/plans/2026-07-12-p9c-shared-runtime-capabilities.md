# P9-C Shared Runtime Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user explicitly requested inline execution without subagents.

**Goal:** Add tenant-isolated KV and file storage, SSRF-safe HTTP/webhook operations, one-time signed external iframe launch, typed SDK methods, and a disposable full-lifecycle proof on top of P9-B runtime sessions.

**Architecture:** Every capability endpoint authenticates only with `X-App-Runtime-Token`, calls `AppRuntimeSessionService.authorize()`, and derives tenant, user, app, version, and installation IDs from the authorized session. Capability handlers are separate services with strict DTOs; storage never exposes filesystem paths, outbound requests pin a public DNS result at connection time and revalidate every redirect, and external iframe launch uses a one-time Redis nonce carried in the URL fragment so neither platform JWTs nor runtime bearer tokens reach the external server.

**Tech Stack:** NestJS 11, TypeORM, MySQL 8, Redis/ioredis, undici, Vue 3, Vite, TypeScript, Jest, Playwright, the existing protocol-v1 app runtime SDK.

## Global Constraints

- Authoritative specification: `docs/superpowers/specs/2026-07-12-hybrid-app-platform-completion-design.md`.
- Preserve P9-A static apps and P9-B `context.read` behavior; `APP_RUNTIME_PROTOCOL_VERSION` remains `1`.
- `APP_RUNTIME_CAPABILITIES_ENABLED` and every new capability flag default to disabled.
- Never accept tenant, user, app, version, or installation IDs in a public runtime capability DTO.
- Never expose runtime tokens, platform JWTs, cookies, secrets, storage paths, DNS answers, or raw upstream errors.
- Every query and storage path includes tenant and app identity derived from `AuthorizedAppRuntimeSession`.
- Default per-tenant-app quotas are `1000` KV keys / `5 MB` KV JSON and `100 MB` file bytes; configuration is clamped and quota checks are transaction-safe.
- Uploaded bytes are inert data. Do not execute, import, unpack, or serve them from an executable application directory.
- Outbound requests allow HTTPS only, exact approved origins only, public IPs only, no ambient proxy, at most three redirects, a 15-second timeout, a 2 MB request body, and a 5 MB response body.
- External iframe launch allows normalized HTTPS origins only and never grants `allow-same-origin` to uploaded static apps.
- Do not add service processes, Manifest V2, licensing, pricing, payments, AI invocation, notifications, or commercial settlement in P9-C.
- Use TDD: each production behavior requires an observed failing test before implementation.
- Each task ends with focused tests, `git diff --check`, review, and an independent conventional commit.

---

### Task 1: Capability Contract And Isolated Persistence

**Files:**
- Modify: `server/src/module/app/app-runtime.constants.ts`
- Modify: `server/src/module/app/app-runtime.constants.spec.ts`
- Create: `server/src/module/app/entities/app-runtime-kv.entity.ts`
- Create: `server/src/module/app/entities/app-storage-object.entity.ts`
- Modify: `server/src/module/app/entities/app-runtime-entities.spec.ts`
- Create: `server/src/migrations/1760000000039-CreateAppRuntimeKvAndStorage.ts`
- Create: `server/src/migration-specs/create-app-runtime-kv-and-storage.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**
- Produce `AppRuntimeCapability`: `context.read | kv.read | kv.write | kv.delete | files.read | files.write | http.request | webhook.emit`.
- Produce `AppRuntimeKvEntity`, unique on `(tenantId, appId, namespace, key)` with JSON value, byte size, optimistic version, optional expiry, and audit timestamps.
- Produce `AppStorageObjectEntity` with opaque 32-byte URL-safe object ID, tenant/app/owner binding, storage key, original name, MIME, byte size, SHA-256 checksum, status, optional expiry, and timestamps.

- [ ] **Step 1: Write failing constant, entity metadata, and migration contract tests**

Assert exact capability ordering, rejection of unknown values, entity table/column/index metadata, forward creation of both tables, rollback removal in dependency-safe order, and idempotent migration source without `synchronize`.

- [ ] **Step 2: Run RED**

```powershell
cd server
pnpm.cmd exec jest src/module/app/app-runtime.constants.spec.ts src/module/app/entities/app-runtime-entities.spec.ts src/migration-specs/create-app-runtime-kv-and-storage.spec.ts --runInBand
```

Expected: FAIL because the new capabilities, entities, and migration do not exist.

- [ ] **Step 3: Implement the minimal schema and normalized capability allowlist**

Use bounded columns: namespace `64`, key `191`, JSON size counter `int unsigned`, optimistic version `int unsigned`, storage key `255`, original name `255`, MIME `120`, checksum `char(64)`, and object status `active | deleted | expired`. Add `(tenant_id, app_id, expires_time)` and `(tenant_id, app_id, status)` indexes.

- [ ] **Step 4: Run GREEN and backend build**

```powershell
pnpm.cmd exec jest src/module/app/app-runtime.constants.spec.ts src/module/app/entities/app-runtime-entities.spec.ts src/migration-specs/create-app-runtime-kv-and-storage.spec.ts --runInBand
pnpm.cmd run build
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app server/src/migrations/1760000000039-CreateAppRuntimeKvAndStorage.ts server/src/migration-specs/create-app-runtime-kv-and-storage.spec.ts
git commit -m "feat(app): add shared capability storage schema"
```

### Task 2: Tenant-Isolated Runtime KV

**Files:**
- Create: `server/src/module/app/dto/app-runtime-kv.dto.ts`
- Create: `server/src/module/app/services/app-runtime-kv.service.ts`
- Create: `server/src/module/app/services/app-runtime-kv.service.spec.ts`
- Modify: `server/src/module/app/app-runtime.controller.ts`
- Modify: `server/src/module/app/app-runtime.controller.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**
- `GET /api/app-runtime/kv/:namespace/:key` requires `kv.read`.
- `PUT /api/app-runtime/kv/:namespace/:key` requires `kv.write`; body `{ value: JsonValue; expected_version?: number; ttl_seconds?: number }`.
- `DELETE /api/app-runtime/kv/:namespace/:key` requires `kv.delete`.
- Success shape: `{ key, namespace, value, version, expires_at }`; delete is idempotent and returns `{ deleted: boolean }`.

- [ ] **Step 1: Write failing service and controller tests**

Cover create/read/update/delete, expired-as-not-found, `expected_version` conflict, 64 KB serialized value limit, namespace/key grammar `^[A-Za-z0-9][A-Za-z0-9._-]*$`, TTL clamp `60..2592000`, capability mismatch, and cross-tenant/cross-app repository predicates.

- [ ] **Step 2: Run RED**

```powershell
pnpm.cmd exec jest src/module/app/services/app-runtime-kv.service.spec.ts src/module/app/app-runtime.controller.spec.ts --runInBand
```

Expected: FAIL because KV DTOs/routes/service do not exist.

- [ ] **Step 3: Implement KV with optimistic updates**

Serialize before persistence, reject non-JSON values, use a transaction for compare-and-swap updates, enforce default per-tenant-app quotas of `1000` keys and `5 MB` serialized JSON, and include `tenantId` plus `appId` in every `findOne`, aggregate, `update`, and `delete` predicate. The controller obtains request metadata once and calls `authorize(token, requiredCapability, metadata)` before the handler.

- [ ] **Step 4: Run GREEN, app regression, and build**

```powershell
pnpm.cmd exec jest src/module/app/services/app-runtime-kv.service.spec.ts src/module/app/app-runtime.controller.spec.ts src/module/app/services/app-runtime-session.service.spec.ts --runInBand
pnpm.cmd run build
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app
git commit -m "feat(app): add isolated runtime kv capability"
```

### Task 3: Opaque Runtime File Objects

**Files:**
- Create: `server/src/module/app/dto/app-runtime-file.dto.ts`
- Create: `server/src/module/app/services/app-runtime-file.service.ts`
- Create: `server/src/module/app/services/app-runtime-file.service.spec.ts`
- Modify: `server/src/module/app/app-runtime.controller.ts`
- Modify: `server/src/module/app/app-runtime.controller.spec.ts`
- Modify: `server/src/module/app/app.module.ts`
- Modify: `server/src/config/configuration.ts`
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/src/config/saas-env-contract.spec.ts`

**Interfaces:**
- `POST /api/app-runtime/files` requires `files.write`, accepts one multipart field `file`.
- `GET /api/app-runtime/files/:objectId` requires `files.read` and streams an owned active object.
- `DELETE /api/app-runtime/files/:objectId` requires `files.write` and soft-deletes metadata plus best-effort byte removal.
- Response metadata contains only `{ id, name, mime_type, size, checksum, expires_at }`.

- [ ] **Step 1: Write failing storage, route, and env tests**

Cover opaque IDs, tenant/app isolation, traversal-resistant path construction, 10 MB default/clamped `1..50` MB, MIME allowlist, checksum, zero-byte rejection, duplicate names, missing bytes, soft delete, inactive/expired denial, response header sanitization, and absence of storage paths.

- [ ] **Step 2: Run RED**

```powershell
pnpm.cmd exec jest src/module/app/services/app-runtime-file.service.spec.ts src/module/app/app-runtime.controller.spec.ts src/config/saas-env-contract.spec.ts --runInBand
```

- [ ] **Step 3: Implement inert byte storage**

Use `APP_RUNTIME_STORAGE_DIR` defaulting to `../upload/app-runtime-data`, resolve bytes under `<tenantId>/<appId>/<objectId>`, verify the resolved path stays inside the configured root, write through a random temporary file followed by atomic rename, and never return the path. Enforce a default `100 MB` active-byte quota per tenant/app inside the metadata transaction and clamp `APP_RUNTIME_STORAGE_QUOTA_MB` to `1..10240`. Do not reuse public attachment rows or public static package directories.

- [ ] **Step 4: Run GREEN and regression**

```powershell
pnpm.cmd exec jest src/module/app/services/app-runtime-file.service.spec.ts src/module/app/app-runtime.controller.spec.ts src/config/saas-env-contract.spec.ts --runInBand
pnpm.cmd run build
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app server/src/config
git commit -m "feat(app): add opaque runtime file storage"
```

### Task 4: SSRF-Safe HTTP And Webhook Gateway

**Files:**
- Create: `server/src/module/app/dto/app-runtime-http.dto.ts`
- Create: `server/src/module/app/services/app-runtime-http.service.ts`
- Create: `server/src/module/app/services/app-runtime-http.service.spec.ts`
- Modify: `server/src/common/utils/safe-url.util.ts`
- Modify: `server/src/common/utils/safe-url.util.spec.ts`
- Modify: `server/src/module/app/app-runtime.controller.ts`
- Modify: `server/src/module/app/app-runtime.controller.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**
- `POST /api/app-runtime/http` requires `http.request`; body `{ url, method, headers?, body? }`.
- `POST /api/app-runtime/webhooks` requires `webhook.emit`; body `{ url, event, payload }` and always performs POST JSON.
- Version manifest `allowedOrigins` is the sole outbound origin allowlist.
- Response exposes `{ status, headers, body, truncated }` with a response-header allowlist only.

- [ ] **Step 1: Write failing SSRF and gateway tests**

Cover HTTPS-only URLs, exact normalized origin matching, URL credential rejection, localhost/private/link-local/metadata IPv4 and IPv6 denial, mixed public/private DNS denial, DNS rebinding resistance by connection-IP pinning, disabled ambient proxy, redirect revalidation, redirect cap `3`, timeout `15s`, request `2MB`, response `5MB`, forbidden request headers (`host`, `cookie`, `authorization`, forwarding headers), fixed upstream errors, and webhook event grammar/size.

- [ ] **Step 2: Run RED**

```powershell
pnpm.cmd exec jest src/common/utils/safe-url.util.spec.ts src/module/app/services/app-runtime-http.service.spec.ts src/module/app/app-runtime.controller.spec.ts --runInBand
```

- [ ] **Step 3: Implement pinned-address requests**

Extend the safe URL utility to return normalized URL plus validated public addresses. Use an undici dispatcher with a custom lookup that returns only the already validated address for that hostname; re-run normalization, origin allowlist, DNS resolution, and pinning for every redirect. Strip hop-by-hop and sensitive response headers and redact all upstream exception details.

- [ ] **Step 4: Run GREEN and build**

```powershell
pnpm.cmd exec jest src/common/utils/safe-url.util.spec.ts src/module/app/services/app-runtime-http.service.spec.ts src/module/app/app-runtime.controller.spec.ts --runInBand
pnpm.cmd run build
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add server/src/common/utils/safe-url.util* server/src/module/app
git commit -m "feat(app): proxy approved runtime requests"
```

### Task 5: One-Time Signed External Iframe Launch

**Files:**
- Create: `server/src/module/app/services/app-iframe-launch.service.ts`
- Create: `server/src/module/app/services/app-iframe-launch.service.spec.ts`
- Modify: `server/src/module/app/dto/app-platform.dto.ts`
- Modify: `server/src/module/app/services/app-platform.service.ts`
- Modify: `server/src/module/app/services/app-platform.service.spec.ts`
- Modify: `server/src/module/app/services/app-tenant.service.ts`
- Modify: `server/src/module/app/services/app-tenant.service.spec.ts`
- Modify: `server/src/module/app/app-tenant.controller.ts`
- Modify: `server/src/module/app/app-tenant.controller.spec.ts`
- Modify: `server/src/module/app/app.module.ts`
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/src/config/saas-env-contract.spec.ts`

**Interfaces:**
- Open metadata for an approved iframe app returns `launch: { fragment, expires_at, origin }`; it never embeds a runtime bearer token.
- `POST /api/app-tenant/runtime/iframe/exchange` consumes `{ launch_token }` once and returns a normal short-lived runtime session only to the logged-in host bridge. It is not `@Public`; tenant/user identity comes from the platform JWT context and must equal the signed claims.
- Launch claims bind tenant/user/app/version/install, exact origin, expiry at most 60 seconds, and a random nonce stored in Redis with `SET NX EX`.
- Iframe application create/update normalizes `allowed_origins` into the immutable version manifest; each value must be an exact HTTPS origin with no path, query, fragment, or credentials, and the entry URL origin must be present.

- [ ] **Step 1: Write failing launch tests**

Cover allowed-origin normalization and persistence, HTTPS-only exact origin, signed claim tampering, expiry, wrong origin, JWT tenant/user mismatch, cross-tenant binding, Redis nonce absence, atomic single use, replay denial, no token in query string/server-visible URL, feature flag disabled behavior, and fixed errors without claim contents.

- [ ] **Step 2: Run RED**

```powershell
pnpm.cmd exec jest src/module/app/services/app-iframe-launch.service.spec.ts src/module/app/services/app-platform.service.spec.ts src/module/app/services/app-tenant.service.spec.ts src/module/app/app-tenant.controller.spec.ts src/config/saas-env-contract.spec.ts --runInBand
```

- [ ] **Step 3: Implement signed fragment launch**

Derive HMAC-SHA256 signing material from `APP_RUNTIME_LAUNCH_SECRET` (minimum 32 characters). Put the compact launch token after `#agentstudio_launch=` so it is unavailable to the iframe server request. The iframe posts the fragment token to the exact-origin host bridge; the logged-in host sends it to the protected tenant exchange endpoint with its normal platform JWT. Compare JWT tenant/user identity to signed claims, consume the Redis nonce atomically through Lua, then issue the P9-B session only to the host; any Redis failure fails closed.

- [ ] **Step 4: Run GREEN and regression**

```powershell
pnpm.cmd exec jest src/module/app/services/app-iframe-launch.service.spec.ts src/module/app/services/app-platform.service.spec.ts src/module/app/services/app-tenant.service.spec.ts src/module/app/app-tenant.controller.spec.ts --runInBand
pnpm.cmd run build
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app server/src/config
git commit -m "feat(app): sign one-time iframe launches"
```

### Task 6: Protocol-V1 SDK And Host Capability Bridge

**Files:**
- Modify: `web/packages/app-runtime-sdk/src/types.ts`
- Modify: `web/packages/app-runtime-sdk/src/protocol.ts`
- Modify: `web/packages/app-runtime-sdk/src/client.ts`
- Modify: `web/packages/app-runtime-sdk/src/index.ts`
- Modify: `web/packages/app-runtime-sdk/scripts/verify-sdk.ts`
- Modify: `web/src/utils/app-runtime.ts`
- Modify: `web/src/api/app-runtime.ts`
- Modify: `web/src/views/app-center/open/index.vue`
- Modify: `web/scripts/verify-app-runtime-readiness.ts`
- Modify: `web/scripts/build-runtime-starter.ts`
- Modify: `web/scripts/verify-app-runtime-starter.ts`

**Interfaces:**
- Preserve `getContext(options)` and add `runtime.context.get`, `runtime.kv.get/set/delete`, `runtime.files.upload/read/delete`, `runtime.http.request`, and `runtime.webhooks.emit`.
- Protocol stays channel `agentstudio:app-runtime`, version `1`, with typed `<capability>.request`, `<capability>.result`, and `<capability>.error` messages.
- Child SDK never receives or stores the runtime bearer token; the host performs all backend calls.

- [ ] **Step 1: Add failing SDK, bridge, and starter assertions**

Cover exact exports and declaration files, request IDs, concurrency, timeout/abort cleanup, payload/result validation, unknown operations, capability errors, static opaque-origin `*` target, external iframe exact target origin, source-window checks, one-time launch exchange, stale reload cancellation, and credential/browser-storage denylist.

- [ ] **Step 2: Run RED**

```powershell
cd web
pnpm.cmd run verify:app-runtime-sdk
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run verify:app-runtime-starter
```

- [ ] **Step 3: Implement additive SDK and host dispatch**

Keep the current API as a compatibility alias. Route each parsed operation through an explicit host handler and API function; never implement a generic arbitrary URL-to-platform proxy. For external iframe messages require exact `event.origin`, exact `event.source`, request ID, and protocol version before exchange or capability dispatch.

- [ ] **Step 4: Run GREEN, lint, and frontend build**

```powershell
pnpm.cmd run verify:app-runtime-sdk
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run verify:app-runtime-starter
pnpm.cmd exec eslint packages/app-runtime-sdk/src packages/app-runtime-sdk/scripts web/src/utils/app-runtime.ts web/src/api/app-runtime.ts web/src/views/app-center/open/index.vue
pnpm.cmd run build
git diff --check
```

- [ ] **Step 5: Commit**

```powershell
git add web/packages/app-runtime-sdk web/src web/scripts
git commit -m "feat(app): expose typed shared runtime capabilities"
```

### Task 7: Disposable Lifecycle, Readiness, Review, And Commit

**Files:**
- Modify: `web/scripts/verify-app-runtime-live-e2e.ts`
- Modify: `web/scripts/verify-app-runtime-live-e2e-contract.ts`
- Modify: `web/scripts/verify-app-marketplace-readiness.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Prove the complete P9-C lifecycle using disposable MySQL, an explicitly isolated Redis DB, local inert file storage, a public-address test upstream, and a local iframe fixture reached only through an explicit test-only public-host resolver seam.
- Cleanup must remove owned KV rows, object metadata/bytes, sessions, grants, audits, launch nonces, database, Redis lease, and temporary upstream processes.

- [ ] **Step 1: Add failing live-contract assertions**

Require positive and negative KV/file/HTTP/webhook flows, cross-tenant denial, origin denial, private-address/redirect denial, iframe exact-origin handshake, replay denial, capability revocation, uninstall invalidation, raw-token redaction, and complete cleanup.

- [ ] **Step 2: Run RED**

```powershell
cd web
pnpm.cmd run verify:app-runtime-live-e2e-contract
```

- [ ] **Step 3: Extend the disposable lifecycle and readiness evidence**

Never weaken production URL validation for local fixtures. Inject the resolver/request transport only inside tests, keep production defaults strict, register every generated secret with the redactor before it can reach diagnostics, and assert no remaining owned row/key/file after cleanup.

- [ ] **Step 4: Run deterministic phase gates**

```powershell
cd web
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run verify:app-runtime-sdk
pnpm.cmd run verify:app-runtime-starter
pnpm.cmd run verify:app-runtime-live-e2e-contract
pnpm.cmd run build

cd ../server
pnpm.cmd exec jest src/module/app src/common/utils/safe-url.util.spec.ts src/migration-specs/create-app-runtime-kv-and-storage.spec.ts --runInBand
pnpm.cmd run build

cd ..
node scripts/run-saas-readiness.cjs
git diff --check
```

Run `pnpm.cmd run verify:app-runtime-live-e2e` only when all `APP_RUNTIME_E2E_*` variables point to disposable MySQL and an explicitly isolated, empty Redis DB. Never use production resources.

- [ ] **Step 5: Perform the P9-C security review**

Verify every runtime route uses the dedicated token header and strict HTTP filter; every data operation derives authority from session; object responses contain no path; outbound calls pin validated public addresses and revalidate redirects; iframe exchange is exact-origin and single-use; logs/screenshots contain no token/claim/secret; and no P10/P11/P12 behavior entered the diff.

- [ ] **Step 6: Update readiness evidence and commit**

```powershell
git add web/scripts docs/saas-launch-readiness-checklist.md
git commit -m "test(app): verify shared capability lifecycle"
git status --short
```

Expected: clean tracked worktree, all deterministic gates green, live E2E either green in a disposable environment or explicitly recorded as environment-blocked, and P9-C ready for integration before P10 planning.

## P9-C Completion Criteria

- Platform review and tenant consent independently gate every new capability.
- KV and file data are tenant-and-app isolated with bounded quotas and no filesystem disclosure.
- Outbound HTTP/webhook operations cannot reach private, loopback, link-local, metadata, unapproved, redirected-unapproved, or DNS-rebound targets.
- External iframe launch is HTTPS-only, exact-origin, short-lived, one-time, replay-resistant, and carries no platform credential to the external server.
- SDK additions are typed and additive; existing `getContext` protocol-v1 apps remain compatible.
- Expiry, revocation, consent loss, entitlement loss, uninstall, and cross-tenant use fail closed for all capabilities.
- Focused tests, builds, readiness scripts, security review, and repository gate pass before P10 begins.
