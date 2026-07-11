# P9-B Runtime Sessions And Capability Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute inline; the current release workflow previously prohibited subagent deployment work.

**Goal:** Add short-lived, tenant-bound runtime sessions and explicit platform/tenant capability grants, then route `context.get` through an audited gateway without breaking existing static applications.

**Architecture:** Extend the existing app marketplace module with runtime session, capability grant, and audit entities. Open metadata issues a one-time high-entropy token only after current publication, installation, entitlement, membership, and version checks pass; the parent app runner keeps that token in memory and calls a public runtime endpoint protected by a dedicated token guard. Existing protocol-v1 requests remain valid, and the old inline bootstrap is used when the feature flag is disabled.

**Tech Stack:** NestJS, TypeORM, MySQL 8, Node `crypto`, Vue 3, TypeScript, Jest, P9-A runtime SDK, Playwright readiness scripts.

## Global Constraints

- Specification: `docs/superpowers/specs/2026-07-12-hybrid-app-platform-completion-design.md`.
- Feature flag: `APP_RUNTIME_CAPABILITIES_ENABLED`; missing, empty, `0`, or `false` means disabled.
- Runtime token lifetime defaults to 300 seconds and is clamped to 60-900 seconds.
- Store only SHA-256 token digests; return the raw 32-byte base64url token exactly once in open metadata.
- Runtime endpoints use `X-App-Runtime-Token`; never accept the token in a query string or cookie.
- Keep `APP_RUNTIME_PROTOCOL_VERSION = 1` in P9-B; the change is additive.
- Canonical capability name is `context.read`; map legacy manifest permission `runtime:context:read` to it.
- Platform approval and tenant consent are both required while the feature flag is enabled.
- Existing behavior remains unchanged while the flag is disabled.
- P9-B does not implement KV, files, outbound HTTP, iframe signed launch, service processes, app licensing, or revenue.

---

### Task 1: Persist Runtime Sessions, Capability Grants, And Audit Events

**Files:**
- Create: `server/src/migrations/1760000000038-CreateAppRuntimeSessionsAndCapabilities.ts`
- Create: `server/src/module/app/entities/app-capability-grant.entity.ts`
- Create: `server/src/module/app/entities/app-runtime-session.entity.ts`
- Create: `server/src/module/app/entities/app-runtime-audit-log.entity.ts`
- Modify: `server/src/module/app/entities/app-package-version.entity.ts`
- Modify: `server/src/module/app/app.module.ts`
- Test: `server/src/module/app/entities/app-runtime-entities.spec.ts`

**Interfaces:**
- Produces `AppCapabilityGrantEntity` with `subjectType: 'platform' | 'tenant'`, `subjectId`, `capability`, `status`, and `policy`.
- Produces `AppRuntimeSessionEntity` with token digest, authority bindings, capability snapshot, expiry, revocation, and last-use state.
- Produces `AppRuntimeAuditLogEntity` for bounded runtime decisions without request/response bodies.
- Adds `approvedCapabilities?: string[] | null` to `AppPackageVersionEntity`.

- [ ] **Step 1: Write entity metadata tests before the entities exist**

Create `app-runtime-entities.spec.ts` that imports the three entities and inspects decorator metadata without opening a database connection:

```ts
const metadata = getMetadataArgsStorage()
const indexNames = (target: Function) =>
  metadata.indices.filter((item) => item.target === target).map((item) => item.name)
const columnNames = (target: Function) =>
  metadata.columns.filter((item) => item.target === target).map((item) => item.options.name)

expect(indexNames(AppRuntimeSessionEntity)).toEqual(
  expect.arrayContaining(['uk_app_runtime_session_token', 'idx_app_runtime_session_expiry'])
)
expect(indexNames(AppCapabilityGrantEntity)).toContain('uk_app_capability_subject')
expect(columnNames(AppRuntimeAuditLogEntity)).not.toContain('token')
```

- [ ] **Step 2: Run the focused test and verify the imports fail**

Run:

```bash
cd server
pnpm exec jest src/module/app/entities/app-runtime-entities.spec.ts --runInBand
```

Expected: FAIL because the entity files do not exist.

- [ ] **Step 3: Add the entities and version snapshot field**

Use these exported contracts:

```ts
export type AppCapabilitySubjectType = 'platform' | 'tenant'
export type AppCapabilityGrantStatus = 'approved' | 'denied' | 'revoked'

export class AppCapabilityGrantEntity {
  id: number
  appId: number
  versionId: number
  subjectType: AppCapabilitySubjectType
  subjectId: number
  capability: string
  status: AppCapabilityGrantStatus
  policy?: Record<string, unknown> | null
  operatorId?: number | null
  grantedTime?: Date | null
  revokedTime?: Date | null
}

export class AppRuntimeSessionEntity {
  id: number
  tokenHash: string
  tenantId: number
  userId: number
  appId: number
  versionId: number
  installId: number
  capabilities: string[]
  expiresTime: Date
  revokedTime?: Date | null
  lastUsedTime?: Date | null
}

export class AppRuntimeAuditLogEntity {
  id: number
  sessionId?: number | null
  tenantId: number
  userId: number
  appId: number
  versionId: number
  capability: string
  action: string
  outcome: 'allowed' | 'denied'
  reasonCode: string
  requestId: string
  ip: string
  userAgent: string
}
```

Use `subjectId=0` for platform grants and the tenant id for tenant grants. Add a unique index on `(version_id, capability, subject_type, subject_id)`.

- [ ] **Step 4: Add the forward migration**

The migration must:

```sql
ALTER TABLE `app_package_version`
  ADD COLUMN `approved_capabilities` json NULL AFTER `manifest`;
```

Create all three tables with InnoDB, timestamps matching existing entities, and these required indexes:

```text
uk_app_capability_subject(version_id, capability, subject_type, subject_id)
idx_app_capability_app(app_id, status)
uk_app_runtime_session_token(token_hash)
idx_app_runtime_session_expiry(expires_time, revoked_time)
idx_app_runtime_session_install(tenant_id, install_id, revoked_time)
idx_app_runtime_audit_tenant(tenant_id, create_time)
idx_app_runtime_audit_app(app_id, capability, create_time)
```

The `down` method drops the three tables and then `approved_capabilities`. It is for disposable tests only and is never run automatically in production.

- [ ] **Step 5: Register the entities and run focused verification**

Add all three entities to `TypeOrmModule.forFeature` in `app.module.ts`.

Run:

```bash
cd server
pnpm exec jest src/module/app/entities/app-runtime-entities.spec.ts --runInBand
pnpm run build
```

Expected: PASS and backend build exit code `0`.

- [ ] **Step 6: Commit the database foundation**

```bash
git add server/src/migrations/1760000000038-CreateAppRuntimeSessionsAndCapabilities.ts \
  server/src/module/app/entities/app-capability-grant.entity.ts \
  server/src/module/app/entities/app-runtime-session.entity.ts \
  server/src/module/app/entities/app-runtime-audit-log.entity.ts \
  server/src/module/app/entities/app-package-version.entity.ts \
  server/src/module/app/entities/app-runtime-entities.spec.ts \
  server/src/module/app/app.module.ts
git commit -m "feat(app): add runtime authority tables"
```

---

### Task 2: Normalize Capabilities And Persist Platform Approval And Tenant Consent

**Files:**
- Create: `server/src/module/app/app-runtime.constants.ts`
- Create: `server/src/module/app/services/app-capability-policy.service.ts`
- Create: `server/src/module/app/services/app-capability-policy.service.spec.ts`
- Modify: `server/src/module/app/services/app-platform.service.ts`
- Modify: `server/src/module/app/services/app-platform.service.spec.ts`
- Modify: `server/src/module/app/dto/app-platform.dto.ts`
- Modify: `server/src/module/app/app-platform.controller.ts`
- Modify: `server/src/module/app/dto/app-tenant.dto.ts`
- Modify: `server/src/module/app/app-tenant.controller.ts`
- Modify: `server/src/module/app/services/app-tenant.service.ts`
- Modify: `server/src/module/app/services/app-tenant.service.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**
- `normalizeAppCapabilities(manifest): AppRuntimeCapability[]` maps the legacy context permission to `context.read`, deduplicates, sorts, and rejects unknown names.
- `approvePlatformCapabilities(appId, versionId, requested, approved, operatorId)` replaces the platform grant snapshot transactionally.
- `setTenantCapabilities(tenantId, appId, versionId, requested, operatorId)` replaces tenant consent only for platform-approved capabilities.
- `resolveGrantedCapabilities(tenantId, versionId): Promise<AppRuntimeCapability[]>` returns the sorted intersection.

- [ ] **Step 1: Write policy tests**

Cover these cases:

```ts
expect(normalizeAppCapabilities({ permissions: ['runtime:context:read'] })).toEqual(['context.read'])
expect(normalizeAppCapabilities({ capabilities: ['context.read', 'context.read'] })).toEqual([
  'context.read'
])
expect(() => normalizeAppCapabilities({ capabilities: ['database.raw'] })).toThrow(
  'Unsupported app capability: database.raw'
)
```

Service tests must prove a tenant cannot consent to a capability absent from the platform approval and that one tenant's rows are not returned for another tenant.

- [ ] **Step 2: Run tests and verify the service is missing**

```bash
cd server
pnpm exec jest src/module/app/services/app-capability-policy.service.spec.ts --runInBand
```

Expected: FAIL on missing module.

- [ ] **Step 3: Implement constants and policy service**

Define:

```ts
export const APP_RUNTIME_CAPABILITIES = ['context.read'] as const
export type AppRuntimeCapability = (typeof APP_RUNTIME_CAPABILITIES)[number]
export const LEGACY_APP_RUNTIME_CAPABILITY_ALIASES = {
  'runtime:context:read': 'context.read'
} as const
```

Use repository queries scoped by `versionId`, `subjectType`, and `subjectId`. Replace snapshots inside a TypeORM transaction so partial approval/consent rows are never visible.

- [ ] **Step 4: Extend version approval**

Add to `ReviewAppPackageVersionDto`:

```ts
@IsOptional()
@IsArray()
@ArrayUnique()
@IsString({ each: true })
approved_capabilities?: string[]
```

When approving a version, normalize requested capabilities, validate that the submitted approved list is a subset, persist `approvedCapabilities`, and write platform grants before marking the version approved. Existing callers that omit the field approve all requested capabilities.

- [ ] **Step 5: Add tenant capability endpoints**

Add:

```text
GET /api/app-tenant/apps/:code/capabilities
PUT /api/app-tenant/apps/:code/capabilities
```

The PUT DTO is:

```ts
export class UpdateTenantAppCapabilitiesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  capabilities: string[]
}
```

Require `app:tenant:install`, current tenant context, active installation, published version, and the authenticated operator id. Return requested, platform-approved, tenant-approved, and effective arrays.

Extend installation with an optional body so first consent and installation are one service transaction:

```ts
export class InstallTenantAppDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  capabilities?: string[]
}
```

`installApp(tenantId, code, userId, capabilities = [])` writes the installation and requested tenant grants atomically. Existing callers that send no body still install no-capability apps and legacy flag-disabled apps unchanged. The standalone PUT endpoint manages consent after installation.

- [ ] **Step 6: Run policy, platform, tenant, and build tests**

```bash
cd server
pnpm exec jest \
  src/module/app/services/app-capability-policy.service.spec.ts \
  src/module/app/services/app-platform.service.spec.ts \
  src/module/app/services/app-tenant.service.spec.ts \
  --runInBand
pnpm run build
```

Expected: all suites PASS and build exits `0`.

- [ ] **Step 7: Commit capability governance**

```bash
git add server/src/module/app/app-runtime.constants.ts \
  server/src/module/app/services/app-capability-policy.service.ts \
  server/src/module/app/services/app-capability-policy.service.spec.ts \
  server/src/module/app/services/app-platform.service.ts \
  server/src/module/app/services/app-platform.service.spec.ts \
  server/src/module/app/dto/app-platform.dto.ts \
  server/src/module/app/app-platform.controller.ts \
  server/src/module/app/dto/app-tenant.dto.ts \
  server/src/module/app/app-tenant.controller.ts \
  server/src/module/app/services/app-tenant.service.ts \
  server/src/module/app/services/app-tenant.service.spec.ts \
  server/src/module/app/app.module.ts
git commit -m "feat(app): govern runtime capabilities"
```

---

### Task 3: Issue, Authorize, Revoke, And Audit Runtime Sessions

**Files:**
- Create: `server/src/module/app/services/app-runtime-session.service.ts`
- Create: `server/src/module/app/services/app-runtime-session.service.spec.ts`
- Create: `server/src/module/app/app-runtime.controller.ts`
- Create: `server/src/module/app/app-runtime.controller.spec.ts`
- Modify: `server/src/module/app/services/app-runtime-context.service.ts`
- Modify: `server/src/module/app/services/app-runtime-context.service.spec.ts`
- Modify: `server/src/module/app/services/app-tenant.service.ts`
- Modify: `server/src/module/app/services/app-tenant.service.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**
- `issue(input): Promise<{ token: string; expires_at: string; capabilities: AppRuntimeCapability[] }>`.
- `authorize(token, capability, request): Promise<AuthorizedAppRuntimeSession>`.
- `revokeInstall(tenantId, installId, reason): Promise<number>`.
- `revokeVersion(versionId, reason): Promise<number>`.
- Public endpoint `GET /api/app-runtime/context` requires `X-App-Runtime-Token` and returns sanitized context only.

- [ ] **Step 1: Write failing session tests**

Tests must assert:

```ts
expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
expect(saved.tokenHash).toMatch(/^[a-f0-9]{64}$/)
expect(JSON.stringify(saved)).not.toContain(rawToken)
```

Also cover expiry, revocation, unknown token, missing capability, inactive installation, unpublished version, tenant membership loss, feature-flag disabled, last-use update, and denial audit without raw token or request body.

- [ ] **Step 2: Run the tests and verify failure**

```bash
cd server
pnpm exec jest src/module/app/services/app-runtime-session.service.spec.ts --runInBand
```

Expected: FAIL because the service is missing.

- [ ] **Step 3: Implement token and feature-flag behavior**

Use:

```ts
const token = randomBytes(32).toString('base64url')
const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex')
```

Parse `APP_RUNTIME_SESSION_TTL_SECONDS` as an integer and clamp to 60-900. Session issuance is disabled unless `APP_RUNTIME_CAPABILITIES_ENABLED` is true. Authorization performs a constant-shape hash lookup, validates all authority bindings, updates last use, and writes one bounded audit record.

- [ ] **Step 4: Integrate issuance into open metadata**

After current app, install, availability, version, and runtime context checks succeed:

- flag disabled: preserve the exact current `runtime` payload;
- flag enabled with effective capabilities: add `session` containing the one-time token and expiry;
- flag enabled without effective capabilities: keep context unavailable and omit a token.

Do not log or retain the returned token in `AppTenantService`.

Uninstall calls `revokeInstall` before returning. Version unpublish/rollback calls `revokeVersion` for the retired version.

- [ ] **Step 5: Add the dedicated runtime controller**

Use `@Public()` because the global JWT guard does not understand runtime tokens. The controller itself rejects missing, duplicated, or oversized `X-App-Runtime-Token` headers. It does not accept bearer JWT fallback.

```ts
@Get('context')
@Public()
context(@Headers('x-app-runtime-token') token: string, @Req() request: Request)
```

Return `ResultData.ok(context)` only after `authorize(token, 'context.read', request)` and `AppRuntimeContextService` sanitized lookup.

- [ ] **Step 6: Run session, controller, tenant, context, and build tests**

```bash
cd server
pnpm exec jest \
  src/module/app/services/app-runtime-session.service.spec.ts \
  src/module/app/app-runtime.controller.spec.ts \
  src/module/app/services/app-runtime-context.service.spec.ts \
  src/module/app/services/app-tenant.service.spec.ts \
  --runInBand
pnpm run build
```

Expected: all tests PASS and build exits `0`.

- [ ] **Step 7: Commit runtime sessions**

```bash
git add server/src/module/app/services/app-runtime-session.service.ts \
  server/src/module/app/services/app-runtime-session.service.spec.ts \
  server/src/module/app/app-runtime.controller.ts \
  server/src/module/app/app-runtime.controller.spec.ts \
  server/src/module/app/services/app-runtime-context.service.ts \
  server/src/module/app/services/app-runtime-context.service.spec.ts \
  server/src/module/app/services/app-tenant.service.ts \
  server/src/module/app/services/app-tenant.service.spec.ts \
  server/src/module/app/app.module.ts
git commit -m "feat(app): authorize short lived runtime sessions"
```

---

### Task 4: Route Browser Context Requests Through The Runtime Session

**Files:**
- Modify: `web/src/api/app-marketplace.ts`
- Create: `web/src/api/app-runtime.ts`
- Modify: `web/src/utils/app-runtime.ts`
- Modify: `web/src/views/app-center/open/index.vue`
- Test: `web/scripts/verify-app-runtime-readiness.ts`

**Interfaces:**
- `AppRuntimeBootstrap.session?: { token: string; expires_at: string }` exists only in the parent window's open metadata.
- `fetchAppRuntimeContext(token: string, signal?: AbortSignal)` sends the token only in `X-App-Runtime-Token`.
- `parseAppRuntimeRequest(message)` validates and returns a correlation-safe request or a local error response.
- `createAppRuntimeContextResponse(requestId, context)` creates the protocol-v1 success response.

- [ ] **Step 1: Extend the readiness script with failing source assertions**

Assert that:

- open metadata types include an optional runtime session;
- the token is sent only in `X-App-Runtime-Token`;
- no `localStorage`, `sessionStorage`, cookie, URL query, or console call receives the token;
- message source is the active iframe;
- context responses preserve request id and protocol version;
- flag-disabled inline bootstrap remains supported.

- [ ] **Step 2: Run readiness and verify the new assertions fail**

```bash
cd web
pnpm run verify:app-runtime-readiness
```

Expected: FAIL on missing session-aware host behavior.

- [ ] **Step 3: Add the runtime API and pure protocol helpers**

`fetchAppRuntimeContext` uses the existing request wrapper with:

```ts
request.get<AppRuntimeContext>({
  url: '/api/app-runtime/context',
  headers: { 'X-App-Runtime-Token': token },
  signal
})
```

Do not add the token to global Axios defaults or error logging.

- [ ] **Step 4: Make the app runner session-aware**

On `context.get`:

1. verify the active iframe source;
2. parse the request synchronously;
3. when a session exists, call the runtime context endpoint and post the sanitized result;
4. otherwise use the existing inline bootstrap resolver;
5. map 401/403 to `scope_denied` or `context_unavailable` without forwarding backend text;
6. abort pending requests when metadata reloads or the component unmounts.

Keep the runtime token only in the reactive metadata object and clear metadata before reload/unmount.

- [ ] **Step 5: Run frontend gates**

```bash
cd web
pnpm run verify:app-runtime-readiness
pnpm run build
```

Expected: readiness passes and production build exits `0`.

- [ ] **Step 6: Commit the browser gateway bridge**

```bash
git add web/src/api/app-marketplace.ts web/src/api/app-runtime.ts \
  web/src/utils/app-runtime.ts web/src/views/app-center/open/index.vue \
  web/scripts/verify-app-runtime-readiness.ts
git commit -m "feat(app): bridge browser runtime sessions"
```

---

### Task 5: Expose Capability Review And Tenant Consent In Existing Workspaces

**Files:**
- Modify: `web/src/api/app-marketplace.ts`
- Modify: `web/src/views/app-platform/reviews/index.vue`
- Modify: `web/src/views/app-center/marketplace/index.vue`
- Modify: `web/src/views/app-center/installed/index.vue`
- Modify: `web/scripts/verify-app-marketplace-readiness.ts`
- Modify: `web/scripts/verify-app-runtime-readiness.ts`

**Interfaces:**
- Platform review records expose requested and approved capability arrays.
- Tenant app records expose requested, platform-approved, tenant-approved, and effective arrays.
- Approval sends `approved_capabilities` with the existing review action.
- Tenant consent uses `PUT /api/app-tenant/apps/:code/capabilities`.

- [ ] **Step 1: Add failing readiness assertions**

Require source contracts for:

- capability labels on the review page;
- an explicit checkbox selection before platform approval;
- a tenant consent dialog before installation when capabilities are requested;
- installed-app permission management and revoke action;
- empty, loading, success, denied, and request-failure states;
- no raw internal capability policy JSON in tenant UI.

- [ ] **Step 2: Run marketplace/runtime readiness and verify failure**

```bash
cd web
pnpm run verify:app-marketplace-readiness
pnpm run verify:app-runtime-readiness
```

Expected: FAIL on missing capability review and consent UI.

- [ ] **Step 3: Extend API contracts and platform review**

Display requested capabilities as stable labels. Platform reviewers may approve a subset but cannot approve an unrequested capability. Existing no-capability applications retain the current one-click approval flow.

- [ ] **Step 4: Add tenant consent and permission management**

Marketplace installation opens a consent dialog when requested capabilities are non-empty and submits the selected capabilities in the install request, so installation and first consent are atomic. Installed applications expose a permissions action that can revoke all capabilities. The UI refreshes authoritative server state after every mutation and disables duplicate submission.

- [ ] **Step 5: Run frontend verification**

```bash
cd web
pnpm run verify:app-marketplace-readiness
pnpm run verify:app-runtime-readiness
pnpm run build
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit capability UX**

```bash
git add web/src/api/app-marketplace.ts \
  web/src/views/app-platform/reviews/index.vue \
  web/src/views/app-center/marketplace/index.vue \
  web/src/views/app-center/installed/index.vue \
  web/scripts/verify-app-marketplace-readiness.ts \
  web/scripts/verify-app-runtime-readiness.ts
git commit -m "feat(app): add capability review and consent"
```

---

### Task 6: Extend The SDK Contract And Prove The Full P9-B Lifecycle

**Files:**
- Modify: `web/packages/app-runtime-sdk/src/types.ts`
- Modify: `web/packages/app-runtime-sdk/src/protocol.ts`
- Modify: `web/packages/app-runtime-sdk/src/client.ts`
- Modify: `web/packages/app-runtime-sdk/src/index.ts`
- Modify: `web/packages/app-runtime-sdk/scripts/verify-sdk.ts`
- Modify: `web/scripts/verify-app-runtime-live-e2e.ts`
- Modify: `web/scripts/verify-app-runtime-live-e2e-contract.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Preserve `getContext(options): Promise<AppRuntimeContext>` and all current exports.
- Add `AppRuntimeCapability = 'context.read'` and metadata types without exposing the host token to the child SDK.
- Preserve protocol-v1 message shape and current error codes.

- [ ] **Step 1: Add failing SDK and live-contract assertions**

The SDK verifier must prove the public API remains backward compatible. The live E2E contract must require disposable coverage for:

- platform approval;
- tenant consent;
- session issue and digest-only persistence;
- successful context request;
- cross-tenant token denial;
- expiry and revoke denial;
- uninstall invalidation;
- secret-free logs and cleanup.

- [ ] **Step 2: Run deterministic gates and verify failure**

```bash
cd web
pnpm run verify:app-runtime-sdk
pnpm run verify:app-runtime-live-e2e-contract
```

Expected: FAIL on the new P9-B contract assertions.

- [ ] **Step 3: Add additive SDK capability types**

Do not change `getContext` request/response behavior. Export capability and bootstrap metadata types needed by host and starter builds, and keep ESM, IIFE, and declaration outputs deterministic.

- [ ] **Step 4: Extend the disposable live E2E**

Use the existing isolated database/Redis lifecycle. Add P9-B rows and browser steps, assert cleanup removes runtime sessions, grants, and audit logs created by the run, and never print raw tokens or environment values.

- [ ] **Step 5: Run P9-B focused and repository gates**

```bash
cd web
pnpm run verify:app-marketplace-readiness
pnpm run verify:app-runtime-readiness
pnpm run verify:app-runtime-sdk
pnpm run verify:app-runtime-starter
pnpm run verify:app-runtime-live-e2e-contract
pnpm run build

cd ../server
pnpm exec jest src/module/app --runInBand
pnpm run build

cd ..
node scripts/run-saas-readiness.cjs
```

Run `pnpm run verify:app-runtime-live-e2e` only with the existing isolated E2E variables present; its database and Redis targets must not be production resources.

Expected: all deterministic gates pass, the isolated live lifecycle passes, and the root readiness script reports `SaaS repository readiness verified.`

- [ ] **Step 6: Review P9-B security and diff**

Verify:

- no token persistence outside the digest column;
- no token in URLs, global request defaults, logs, screenshots, or error text;
- every repository query includes the required tenant/application/version binding;
- public runtime endpoints have their own strict authentication;
- unknown capabilities fail closed;
- feature-flag-disabled behavior matches P9-A;
- no P9-C/P10/P11/P12 scope entered the diff.

Run:

```bash
git diff --check
git status --short
```

- [ ] **Step 7: Commit P9-B readiness evidence**

```bash
git add web/packages/app-runtime-sdk web/scripts/verify-app-runtime-live-e2e.ts \
  web/scripts/verify-app-runtime-live-e2e-contract.ts \
  docs/saas-launch-readiness-checklist.md
git commit -m "test(app): verify runtime session lifecycle"
```

Expected: clean tracked worktree and P9-B commits ready for final review.

## P9-B Completion Criteria

- Migration, entity, service, controller, UI, SDK, and E2E contracts are implemented.
- Existing P9-A static applications work with the feature flag disabled.
- Enabled tenants require platform approval and tenant consent.
- Context requests use short-lived sessions and leave only digests at rest.
- Expiry, revocation, uninstall, entitlement loss, and cross-tenant use fail closed.
- Focused tests, frontend/backend builds, app readiness gates, isolated live E2E, and root readiness all pass.
- Security review finds no raw token, secret, or cross-tenant exposure.
- All P9-B work is committed before P9-C planning begins.
