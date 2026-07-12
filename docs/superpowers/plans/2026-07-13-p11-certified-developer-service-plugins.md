# P11 Certified Developer Service Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Execution selection:** The user requested direct execution without subagents, so implement this plan inline with `superpowers:executing-plans` and review each task before continuing.

**Goal:** Allow certified developers to submit restricted Bun/Node service plugins, route approved tenant calls through bounded `service.invoke`, and inspect only owned runtime health, metrics, and redacted logs.

**Architecture:** Extend the existing app marketplace, review, runtime-session, and P10 host-process services instead of creating a second plugin catalog. Certification and immutable submission snapshots govern who may submit; the existing P10 scanner and PM2 runtime remain the execution boundary; a new invocation gateway adds same-tenant target policy, Redis quotas, circuit breaking, and payload-free metrics. All P11 behavior is disabled by default and preserves current static, iframe, native, administrator-service, marketplace, analytics, and P9 runtime behavior.

**Tech Stack:** NestJS 11, TypeORM/MySQL, Redis/Lua, Jest, Vue 3, Element Plus, TypeScript runtime SDK, existing PM2 host runtime, existing readiness scripts.

## Global Constraints

- Uploaded developer code never enters the NestJS process and is never imported, evaluated, or required by platform code.
- Continue to reject dependency installers, package lifecycle scripts, request-provided commands, symbolic links, native binaries, dynamic imports, forbidden globals/modules, traversal paths, and `shell: true`.
- Service processes remain loopback-only under the configured non-root runtime user with an allowlisted environment and versioned release directories outside the repository.
- `APP_DEVELOPER_SERVICE_ENABLED` defaults to `false`; existing static/iframe/native/P10 behavior remains available when it is disabled.
- A developer service submission requires an enabled, unexpired certified profile whose approved runtime types include `service`.
- Submitted review content is immutable. Rejected developer-service content cannot be resubmitted in place; the developer uploads a new semantic version.
- Manual package approval and candidate review are performed by different platform operators, and neither may be the submitting developer.
- Uncertified authenticated tenant users may continue to submit sandboxed static applications; only certified developers may create or upload service applications.
- `service.invoke` can target only an exact app code declared in the caller version's immutable normalized manifest and persisted service-target snapshot, installed for the same tenant, currently entitled, published, and backed by one healthy active service instance.
- Invocation authority derives only from the short-lived runtime session; request bodies cannot provide tenant, user, installation, version, process, port, path, command, or environment authority.
- Redis quota/circuit failures fail closed. Metrics/log persistence is best effort only after authorization and never contains payloads, tokens, headers, cookies, secrets, source, filesystem paths, ports, commands, or environment values.
- Default restricted limits are 20 concurrent calls per tenant/service, 60 calls per minute per tenant/service, a 15-second timeout, 2 MB request/response bodies, circuit open after five consecutive failures for 60 seconds, and seven-day invocation-log retention.
- P12 commercialization is excluded: no pricing, licenses, orders, Alipay, revenue ledger, settlement, invoices, or payouts.
- Use TDD for every backend behavior change and preserve focused, repository, build, readiness, security, and disposable live-E2E gates.
- Do not push the branch unless the user explicitly requests it.

---

## File Structure

### Backend schema and policy

- Create `server/src/module/app/entities/app-developer-profile.entity.ts`: developer certification application, approval, expiry, risk, runtime-type, and disabled state.
- Create `server/src/module/app/entities/app-service-invocation.entity.ts`: payload-free invocation outcome rows used for developer-owned observability and seven-day retention.
- Modify `server/src/module/app/entities/app-package-version.entity.ts`: add immutable review snapshot/hash/time, declared service targets, and candidate-review operator/time.
- Modify `server/src/module/app/entities/app-service-instance.entity.ts`: add consecutive invocation failures, circuit state, open-until, active invocation count, and last invocation timestamps for deterministic runtime responses.
- Create `server/src/migrations/1760000000042-CreateCertifiedDeveloperServiceRuntime.ts`: create P11 tables/columns and indexes without mutating existing rows into developer-restricted trust.
- Create `server/src/migrations/1760000000043-SeedCertifiedDeveloperServiceMenus.ts`: seed certification/admin and developer-observability menus, grant the existing developer workspace to authenticated tenant roles, and keep service authority in certification checks rather than roles.
- Modify `server/src/config/configuration.ts`, `server/src/config/env.validation.ts`, `server/src/config/saas-env-contract.spec.ts`, and `server/.env.example`: add disabled-by-default P11 flag and clamped quota/circuit/retention settings.

### Backend certification and submission

- Create `server/src/module/app/dto/app-developer-certification.dto.ts`: self-application, platform decision, list filters, and status-change DTOs.
- Create `server/src/module/app/services/app-developer-certification.service.ts`: profile lifecycle, effective certification policy, user validation, and ownership-safe responses without role mutation.
- Create `server/src/module/app/app-developer-profile.controller.ts`: authenticated self-service profile/application endpoints outside tenant context.
- Create `server/src/module/app/app-developer-certification.controller.ts`: platform certification list/detail/decision/disable endpoints.
- Create `server/src/module/app/services/app-review-snapshot.service.ts`: canonical immutable snapshot construction, SHA-256 digest, and verification.
- Modify `server/src/module/app/services/app-manifest.service.ts`: normalize zero to 20 `serviceTargets` for static and service manifests and reject malformed/duplicate/self targets.
- Modify `server/src/module/app/dto/app-developer.dto.ts`, `server/src/module/app/app-developer.controller.ts`, and `server/src/module/app/services/app-developer.service.ts`: create service drafts, dispatch service uploads, freeze submissions, and enforce owner/certification rules.
- Modify `server/src/module/app/services/app-platform.service.ts`: accept explicit trust level for developer uploads, persist frozen snapshots, expose sanitized findings, and keep rejected developer-service versions terminal.
- Modify `server/src/module/app/services/app-service-package.service.ts`: verify the installed entry checksum before candidate start without importing uploaded code.

### Backend runtime and invocation

- Create `server/src/module/app/dto/app-service-invoke.dto.ts`: exact target code plus bounded JSON input.
- Create `server/src/module/app/services/app-service-invocation-policy.service.ts`: target resolution, installation/entitlement checks, Redis concurrency/rate/circuit scripts, outcome recording, and retention cleanup.
- Modify `server/src/module/app/app-runtime.constants.ts`: add `service.invoke`.
- Modify `server/src/module/app/app-runtime.controller.ts`: add the public runtime-token route `POST /api/app-runtime/services/:code/invoke`.
- Modify `server/src/module/app/services/app-runtime-session.service.ts`: keep existing session/capability checks and expose no new authority fields.
- Modify `server/src/module/app/services/app-service-runtime.service.ts`: accept `developer_restricted`, require live certification and independent candidate review, expose a bounded invoke method, and update circuit/instance state.
- Modify `server/src/module/app/runtime/app-service-host.ts`: support a reserved gateway envelope that passes sanitized context as the second `invoke` argument while preserving legacy P10 direct probe input.
- Modify `server/src/module/app/services/app-service-loopback.transport.ts`: send only the reserved envelope generated by the platform and retain loopback, timeout, redirect, header, and body bounds.
- Modify `server/src/module/app/app.module.ts`: register all new entities, controllers, and services.

### Frontend and SDK

- Modify `web/src/api/app-developer.ts`: certification, service submission, owned metrics, and owned logs contracts.
- Create `web/src/api/app-developer-certification.ts`: platform certification governance contracts.
- Modify `web/src/views/app-center/developer/index.vue`: certification status, runtime-type selection, service upload findings, frozen-state guidance, and actionable disabled/expired states.
- Create `web/src/views/app-center/developer-runtime/index.vue`: owned service health, usage, circuit state, and bounded redacted logs.
- Create `web/src/views/app-platform/developers/index.vue`: certification review queue and decision UI.
- Modify `web/packages/app-runtime-sdk/src/types.ts`, `protocol.ts`, `client.ts`, `index.ts`, and `scripts/verify-sdk.ts`: typed `runtime.services.invoke(targetCode, input)` support.
- Modify `web/src/utils/app-runtime.ts`: bridge `services.invoke` messages to the runtime-token HTTP endpoint with exact target and bounded errors.

### Verification and operations

- Create `web/scripts/verify-app-developer-service-readiness.ts`: deterministic file/API/menu/UI/SDK/security assertions.
- Modify `web/scripts/verify-app-developer-readiness.ts`: replace the old admin-only developer-workspace assertion with the P11 policy that tenant users may submit static apps while service submission remains certification-gated.
- Modify `web/package.json` and `docs/saas-launch-readiness-checklist.md`: register the P11 readiness gate and manual browser checks.
- Create `server/scripts/verify-app-developer-service-live-e2e.ts`: disposable Linux-only end-to-end lifecycle with strict isolation variables and cleanup.
- Create `server/scripts/verify-app-developer-service-live-e2e-contract.ts`: static contract gate that rejects credential output, shared production resources, shell mode, and non-disposable cleanup.
- Modify `server/package.json`: register live and contract commands.
- Create `docs/deployment/app-developer-service-runtime-baota.md`: disabled-first migration, low-privilege host policy, rollout, observation, and rollback runbook.

---

### Task 1: Certification, Snapshot, Invocation, And Circuit Schema

**Files:**
- Create: `server/src/module/app/entities/app-developer-profile.entity.ts`
- Create: `server/src/module/app/entities/app-service-invocation.entity.ts`
- Modify: `server/src/module/app/entities/app-package-version.entity.ts`
- Modify: `server/src/module/app/entities/app-service-instance.entity.ts`
- Create: `server/src/migrations/1760000000042-CreateCertifiedDeveloperServiceRuntime.ts`
- Test: `server/src/module/app/entities/app-developer-service-entities.spec.ts`
- Test: `server/src/migration-specs/create-certified-developer-service-runtime.spec.ts`
- Modify: `server/src/config/configuration.ts`
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/src/config/saas-env-contract.spec.ts`
- Modify: `server/.env.example`

**Interfaces:**
- Produces: `AppDeveloperCertificationStatus = 'pending' | 'certified' | 'rejected' | 'expired'`
- Produces: `AppDeveloperRiskLevel = 'low' | 'medium' | 'high'`
- Produces: `AppDeveloperRuntimeType = 'static' | 'iframe' | 'service'`
- Produces: `AppDeveloperProfileEntity` uniquely keyed by `userId`
- Produces: `AppServiceInvocationEntity` containing identifiers, outcome, duration, status/error code, and no request/response payload
- Produces: `AppPackageVersionEntity.reviewSnapshot`, `reviewSnapshotHash`, `submittedTime`, `serviceTargets`, `candidateReviewedBy`, and `candidateReviewedTime`
- Produces: `AppServiceInstanceEntity.consecutiveFailures`, `circuitState`, `circuitOpenUntil`, `activeInvocations`, `lastInvokeTime`, and `lastSuccessTime`

- [x] **Step 1: Write failing entity and migration tests**

Create entity metadata tests asserting:

```ts
expect(profileColumns).toEqual(
  expect.arrayContaining([
    'user_id',
    'display_name',
    'website',
    'application_statement',
    'certification_status',
    'approved_runtime_types',
    'risk_level',
    'reviewer_id',
    'certification_expiry',
    'disabled',
  ]),
);
expect(versionColumns).toEqual(
  expect.arrayContaining([
    'review_snapshot',
    'review_snapshot_hash',
    'submitted_time',
    'service_targets',
    'candidate_reviewed_by',
    'candidate_reviewed_time',
  ]),
);
expect(invocationColumns).not.toEqual(
  expect.arrayContaining(['request_body', 'response_body', 'headers', 'token', 'cookie']),
);
```

The migration test must assert unique/index clauses for `user_id`, developer/app/time observability, tenant/app/time invocation queries, and circuit columns; it must also assert `down()` reverses only P11 schema.

- [x] **Step 2: Run schema tests to verify RED**

Run:

```powershell
pnpm run test -- app-developer-service-entities.spec.ts create-certified-developer-service-runtime.spec.ts --runInBand
```

Expected: FAIL because the P11 entities, columns, and migration do not exist.

- [x] **Step 3: Implement entities and migration**

Use these exact entity contracts:

```ts
export type AppDeveloperCertificationStatus = 'pending' | 'certified' | 'rejected' | 'expired';
export type AppDeveloperRiskLevel = 'low' | 'medium' | 'high';
export type AppDeveloperRuntimeType = 'static' | 'iframe' | 'service';

@Index('uk_app_developer_profile_user', ['userId'], { unique: true })
@Index('idx_app_developer_profile_status', ['certificationStatus', 'disabled'])
@Entity('app_developer_profile')
export class AppDeveloperProfileEntity {
  id: number;
  userId: number;
  displayName: string;
  website: string;
  applicationStatement: string;
  certificationStatus: AppDeveloperCertificationStatus;
  requestedRuntimeTypes: AppDeveloperRuntimeType[];
  approvedRuntimeTypes: AppDeveloperRuntimeType[];
  riskLevel: AppDeveloperRiskLevel;
  reviewerId?: number | null;
  reviewMessage: string;
  certificationTime?: Date | null;
  certificationExpiry?: Date | null;
  disabled: number;
  createTime?: Date;
  updateTime?: Date;
}
```

`AppServiceInvocationEntity` stores `tenantId`, caller app/version, target app/version, developer ID, outcome (`success | failure | rejected`), bounded `statusCode`, `durationMs`, `errorCode`, and timestamps. Do not add free-form payload or error-message columns.

The migration adds JSON columns for snapshots/targets, a `char(64)` snapshot hash, candidate reviewer fields, and circuit counters. Existing versions receive `NULL` snapshots and empty target arrays; existing P10 service instances receive closed/zero circuit defaults.

- [x] **Step 4: Write and implement environment-contract tests**

Add these variables with Joi defaults and clamps:

```text
APP_DEVELOPER_SERVICE_ENABLED=false
APP_DEVELOPER_SERVICE_CONCURRENCY=20
APP_DEVELOPER_SERVICE_RATE_PER_MINUTE=60
APP_DEVELOPER_SERVICE_CIRCUIT_FAILURES=5
APP_DEVELOPER_SERVICE_CIRCUIT_OPEN_SECONDS=60
APP_DEVELOPER_SERVICE_LOG_RETENTION_DAYS=7
```

Validation ranges are concurrency `1..100`, rate `1..6000`, failures `2..20`, open seconds `10..3600`, and retention days `1..30`. Map them under `appMarketplace.developerService`.

- [x] **Step 5: Run Task 1 tests to verify GREEN**

Run:

```powershell
pnpm run test -- app-developer-service-entities.spec.ts create-certified-developer-service-runtime.spec.ts saas-env-contract.spec.ts --runInBand
```

Expected: PASS.

- [x] **Step 6: Commit Task 1**

```powershell
git add server/src/module/app/entities server/src/migrations/1760000000042-CreateCertifiedDeveloperServiceRuntime.ts server/src/config server/.env.example
git commit -m "feat(app): add certified developer runtime schema"
```

---

### Task 2: Self-Service Certification And Platform Governance

**Files:**
- Create: `server/src/module/app/dto/app-developer-certification.dto.ts`
- Create: `server/src/module/app/services/app-developer-certification.service.ts`
- Create: `server/src/module/app/services/app-developer-certification.service.spec.ts`
- Create: `server/src/module/app/app-developer-profile.controller.ts`
- Create: `server/src/module/app/app-developer-profile.controller.spec.ts`
- Create: `server/src/module/app/app-developer-certification.controller.ts`
- Create: `server/src/module/app/app-developer-certification.controller.spec.ts`
- Create: `server/src/migrations/1760000000043-SeedCertifiedDeveloperServiceMenus.ts`
- Create: `server/src/migration-specs/seed-certified-developer-service-menus.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**
- Produces: `AppDeveloperCertificationService.getOwnProfile(userId: number)`
- Produces: `AppDeveloperCertificationService.apply(userId: number, dto: ApplyDeveloperCertificationDto)`
- Produces: `AppDeveloperCertificationService.list(query: DeveloperCertificationListDto)`
- Produces: `AppDeveloperCertificationService.decide(profileId: number, operatorId: number, dto: DecideDeveloperCertificationDto)`
- Produces: `AppDeveloperCertificationService.setDisabled(profileId: number, operatorId: number, dto: SetDeveloperCertificationDisabledDto)`
- Produces: `AppDeveloperCertificationService.assertRuntimeApproved(userId: number, runtimeType: AppDeveloperRuntimeType): Promise<AppDeveloperProfileEntity>`

- [ ] **Step 1: Write failing certification lifecycle tests**

Cover:

```ts
it('creates one pending self-application and trims public fields');
it('updates a rejected or expired application back to pending without changing user ownership');
it('rejects a second application while pending or certified');
it('rejects certification by the applicant');
it('certifies with normalized unique runtime types and a future expiry');
it('returns expired as the effective status after the stored expiry');
it('rejects service submission when disabled, expired, uncertified, or service is not approved');
it('never creates, removes, or broadens user roles when certification changes');
```

Use repository mocks for profile and user; use a transaction mock for the certification decision and assert that no role or menu repository participates in profile state changes.

- [ ] **Step 2: Run certification tests to verify RED**

```powershell
pnpm run test -- app-developer-certification.service.spec.ts app-developer-profile.controller.spec.ts app-developer-certification.controller.spec.ts --runInBand
```

Expected: FAIL because P11 certification services/controllers do not exist.

- [ ] **Step 3: Implement DTOs and certification service**

Use these DTO bounds:

```ts
export class ApplyDeveloperCertificationDto {
  @IsString() @Length(2, 100) display_name: string;
  @IsOptional() @IsUrl({ require_protocol: true, protocols: ['https'] }) @MaxLength(255) website?: string;
  @IsString() @Length(20, 2000) statement: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3)
  @IsIn(['static', 'iframe', 'service'], { each: true }) requested_runtime_types: AppDeveloperRuntimeType[];
}

export class DecideDeveloperCertificationDto {
  @IsIn(['certified', 'rejected']) decision: 'certified' | 'rejected';
  @IsArray() @ArrayMaxSize(3)
  @IsIn(['static', 'iframe', 'service'], { each: true }) approved_runtime_types: AppDeveloperRuntimeType[];
  @IsIn(['low', 'medium', 'high']) risk_level: AppDeveloperRiskLevel;
  @IsOptional() @IsISO8601() certification_expiry?: string;
  @IsString() @Length(3, 500) message: string;
}
```

Certification defaults to a 365-day expiry when approved. `assertRuntimeApproved` computes expiry at read time, never trusts a client-supplied status, and returns only after user ownership, status, approved runtime, disabled state, and expiry all pass.

- [ ] **Step 4: Implement authenticated controllers and permissions**

Routes:

```text
GET  /api/app-developer/profile
POST /api/app-developer/profile/apply
GET  /api/app-platform/developers
GET  /api/app-platform/developers/:id
POST /api/app-platform/developers/:id/decision
POST /api/app-platform/developers/:id/disabled
```

The self routes require authentication but no platform permission. Platform routes require `app:developer-certification:list` or `app:developer-certification:manage` and run outside tenant context. Decision operator ID always comes from `@User()`.

- [ ] **Step 5: Seed role, menus, permissions, and grants**

The migration must:

1. create `Developer Certification` under `AppPlatform` for platform admins;
2. create `Service Observability` under `AppCenter`;
3. grant `AppDeveloperApps`, its six ownership-scoped permissions, and the observability menu/read permissions to active `tenant:<id>:owner|admin|member` roles;
4. retain platform admin grants;
5. rely on `AppDeveloperCertificationService.assertRuntimeApproved` for every service create/upload/candidate/publish transition, so menu permission alone never authorizes service code;
6. remove only the P11 menu rows and grants on `down()` and leave tenant roles untouched.

- [ ] **Step 6: Run Task 2 tests to verify GREEN**

```powershell
pnpm run test -- app-developer-certification.service.spec.ts app-developer-profile.controller.spec.ts app-developer-certification.controller.spec.ts seed-certified-developer-service-menus.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```powershell
git add server/src/module/app server/src/migrations/1760000000043-SeedCertifiedDeveloperServiceMenus.ts
git commit -m "feat(app): govern certified developer profiles"
```

---

### Task 3: Restricted Developer Service Submission And Frozen Review Content

**Files:**
- Create: `server/src/module/app/services/app-review-snapshot.service.ts`
- Create: `server/src/module/app/services/app-review-snapshot.service.spec.ts`
- Modify: `server/src/module/app/dto/app-developer.dto.ts`
- Modify: `server/src/module/app/app-developer.controller.ts`
- Modify: `server/src/module/app/app-developer.controller.spec.ts`
- Modify: `server/src/module/app/services/app-developer.service.ts`
- Modify: `server/src/module/app/services/app-developer.service.spec.ts`
- Modify: `server/src/module/app/services/app-platform.service.ts`
- Modify: `server/src/module/app/services/app-platform.service.spec.ts`
- Modify: `server/src/module/app/services/app-manifest.service.ts`
- Modify: `server/src/module/app/services/app-manifest.service.spec.ts`
- Modify: `server/src/module/app/services/app-service-package.service.ts`
- Modify: `server/src/module/app/services/app-service-package.service.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**
- Produces: `AppReviewSnapshotService.create(app, version, profile): FrozenAppReviewSnapshot`
- Produces: `AppReviewSnapshotService.hash(snapshot): string`
- Produces: `AppReviewSnapshotService.verify(version): void`
- Produces: `AppServicePackageService.verifyInstalledEntry(version): Promise<void>`
- Extends: `CreateDeveloperAppDto.runtime_type?: 'static' | 'service'`
- Extends: `StaticAppManifest.serviceTargets` and `NormalizedServiceManifest.serviceTargets` as normalized immutable app-code arrays
- Extends: `AppDeveloperService.uploadVersion` to dispatch static or restricted-service upload by authoritative app type

- [ ] **Step 1: Write failing snapshot and developer submission tests**

Cover:

```ts
it('creates a developer_restricted service draft only for a certified service developer');
it('keeps existing static developer creation unchanged when the P11 flag is disabled');
it('allows an uncertified authenticated tenant user to create and upload only a static app');
it('rejects service creation and upload while the P11 flag is disabled');
it('rejects foreign app upload before scanning bytes');
it('stores scanner findings, checksum, manifest, service targets, profile snapshot, and catalog metadata in one frozen developer-service snapshot');
it('persists normalized service targets from static and service manifests without requiring a developer-service snapshot');
it('produces the same SHA-256 hash for semantically identical canonical snapshots');
it('rejects unsupported, duplicate, malformed, or self-referential service target codes');
it('rejects mutation when the stored snapshot hash no longer matches');
it('rejects in-place resubmission of a rejected developer service version');
it('preserves rejected static-app resubmission behavior');
it('re-hashes dist/index.js before candidate start and rejects a changed installed entry');
```

- [ ] **Step 2: Run Task 3 tests to verify RED**

```powershell
pnpm run test -- app-review-snapshot.service.spec.ts app-developer.service.spec.ts app-developer.controller.spec.ts app-platform.service.spec.ts app-service-package.service.spec.ts --runInBand
```

Expected: FAIL on missing service creation, snapshot, and verification behavior.

- [ ] **Step 3: Implement canonical frozen snapshots**

The snapshot contains only:

```ts
export interface FrozenAppReviewSnapshot {
  schema_version: 1;
  app: {
    id: string;
    code: string;
    name: string;
    type: 'service';
    runtime_type: 'service';
    trust_level: 'developer_restricted';
    category: string;
    summary: string;
    description: string;
    developer_id: string;
    developer_name: string;
  };
  version: {
    id: string;
    version: string;
    manifest: Record<string, unknown>;
    package_sha256: string;
    entry_sha256: string;
    file_size: number;
    requested_capabilities: string[];
    service_targets: string[];
    scan: { passed: boolean; scanned_files: number; findings: Array<{ code: string; severity: string; line?: number; column?: number }> };
  };
  developer: {
    profile_id: string;
    certification_status: 'certified';
    approved_runtime_types: AppDeveloperRuntimeType[];
    risk_level: AppDeveloperRiskLevel;
    certification_expiry: string;
  };
  submitted_at: string;
}
```

Canonical hashing recursively sorts object keys, preserves array order after normalization, serializes UTF-8 JSON, and hashes with SHA-256. Snapshot response sanitization must reuse the existing scan-result sanitizer and never return package paths.

- [ ] **Step 4: Implement service draft/upload dispatch**

For `runtime_type='service'`:

1. check `APP_DEVELOPER_SERVICE_ENABLED`;
2. call `assertRuntimeApproved(developerId, 'service')` before package scanning;
3. create `type='service'`, `entryMode='service'`, `runtimeType='service'`, `trustLevel='developer_restricted'`, marketplace visibility;
4. call the existing P10 `scanAndInstall` pipeline;
5. normalize manifest `serviceTargets` as zero to 20 exact app codes using the shared manifest service;
6. persist version, frozen snapshot, hash, and submit time in one transaction;
7. retain `reviewStatus='pending'` so existing review queue semantics remain stable.

Static uploads retain their package, review, sandbox, and publication behavior, while their normalized manifest and `serviceTargets` column may now include `service.invoke` plus declared target codes. Reject `serviceTargets` unless `service.invoke` is requested, and reject `service.invoke` unless at least one target is declared.

- [ ] **Step 5: Make rejected restricted content terminal**

`submitVersion` keeps current behavior for static/iframe versions. For `developer_restricted` service versions it throws `Rejected developer service content is immutable; upload a new version` before any update.

- [ ] **Step 6: Verify installed entry integrity without execution**

`verifyInstalledEntry(version)` resolves `dist/index.js` under the configured runtime root, rejects path escape/symlink/missing files, streams SHA-256, and compares against `scanResult.entrySha256`. It never imports the file and never shells out.

- [ ] **Step 7: Run Task 3 tests to verify GREEN**

```powershell
pnpm run test -- app-review-snapshot.service.spec.ts app-developer.service.spec.ts app-developer.controller.spec.ts app-platform.service.spec.ts app-service-package.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```powershell
git add server/src/module/app
git commit -m "feat(app): freeze developer service submissions"
```

---

### Task 4: Independent Review, Candidate Governance, And Restricted Runtime Policy

**Files:**
- Modify: `server/src/module/app/services/app-platform.service.ts`
- Modify: `server/src/module/app/services/app-platform.service.spec.ts`
- Modify: `server/src/module/app/services/app-service-runtime.service.ts`
- Modify: `server/src/module/app/services/app-service-runtime.service.spec.ts`
- Modify: `server/src/module/app/app-service-platform.controller.ts`
- Modify: `server/src/module/app/app-service-platform.controller.spec.ts`
- Modify: `web/src/api/app-marketplace.ts`
- Modify: `web/src/views/app-platform/reviews/index.vue`

**Interfaces:**
- Extends: `AppServiceRuntimeService.startCandidate(appCode, version, operatorId)` to record independent candidate review
- Extends: `AppServiceRuntimeService.publishCandidate(appCode, version, operatorId)` to revalidate profile, snapshot, entry checksum, and candidate review
- Produces: sanitized review queue fields `trust_level`, `review_snapshot`, `review_snapshot_hash`, `candidate_reviewed_by`, and `candidate_reviewed_time`

- [ ] **Step 1: Write failing governance tests**

Cover:

```ts
it('requires the approving operator to differ from the developer submitter');
it('approves only when the stored snapshot hash and scanner findings verify');
it('allows P10 platform_trusted candidate behavior unchanged');
it('allows developer_restricted candidate start only while certification is live');
it('requires candidate reviewer to differ from submitter and manual reviewer');
it('records candidate reviewer only after consecutive healthy probes');
it('preserves the active release when candidate integrity, health, or certification fails');
it('revalidates certification, snapshot hash, and entry checksum before publish');
it('returns no package path, release path, port, environment, command, or source in review responses');
```

- [ ] **Step 2: Run governance tests to verify RED**

```powershell
pnpm run test -- app-platform.service.spec.ts app-service-runtime.service.spec.ts app-service-platform.controller.spec.ts --runInBand
```

Expected: FAIL because P10 accepts only `platform_trusted` and has no candidate-review fields.

- [ ] **Step 3: Implement trust-aware review verification**

Use one branch in `assertReviewedServiceVersion`:

```ts
if (app.trustLevel === 'platform_trusted') {
  // Preserve P10 independent submitter/reviewer and passing scan checks.
} else if (app.trustLevel === 'developer_restricted') {
  await certificationService.assertRuntimeApproved(Number(app.developerId), 'service');
  snapshotService.verify(version);
  await packageService.verifyInstalledEntry(version);
  // Require approved review, passing immutable scan, developer submitter != reviewer.
} else {
  throw new BadRequestException('Service trust level is not executable');
}
```

Do not broaden iframe/static/native execution.

- [ ] **Step 4: Record independent candidate review**

For developer-restricted candidates, reject if `operatorId` equals `submittedBy` or `reviewerId`. Set `candidateReviewedBy` and `candidateReviewedTime` only after the health-success threshold passes. Candidate failure leaves both fields null and leaves the active instance untouched.

- [ ] **Step 5: Update review UI with immutable evidence**

The review drawer shows sanitized app/profile snapshot, package and entry hashes, normalized requested capabilities/targets, automated finding codes/severity/line, reviewer separation status, and candidate-review status. It must not show filesystem paths, source snippets, process details, environment, commands, or raw payloads.

- [ ] **Step 6: Run Task 4 tests and frontend type/build checks**

```powershell
pnpm run test -- app-platform.service.spec.ts app-service-runtime.service.spec.ts app-service-platform.controller.spec.ts --runInBand
```

```powershell
pnpm run build
```

Expected: backend tests and frontend build pass.

- [ ] **Step 7: Commit Task 4**

```powershell
git add server/src/module/app web/src/api/app-marketplace.ts web/src/views/app-platform/reviews/index.vue
git commit -m "feat(app): govern restricted service candidates"
```

---

### Task 5: Tenant `service.invoke`, Quotas, Circuit Breaking, And SDK

**Files:**
- Create: `server/src/module/app/dto/app-service-invoke.dto.ts`
- Create: `server/src/module/app/services/app-service-invocation-policy.service.ts`
- Create: `server/src/module/app/services/app-service-invocation-policy.service.spec.ts`
- Modify: `server/src/module/app/app-runtime.constants.ts`
- Modify: `server/src/module/app/app-runtime.constants.spec.ts`
- Modify: `server/src/module/app/app-runtime.controller.ts`
- Modify: `server/src/module/app/app-runtime.controller.spec.ts`
- Modify: `server/src/module/app/services/app-service-runtime.service.ts`
- Modify: `server/src/module/app/services/app-service-runtime.service.spec.ts`
- Modify: `server/src/module/app/runtime/app-service-host.ts`
- Modify: `server/src/module/app/services/app-service-loopback.transport.ts`
- Modify: `server/src/module/app/services/app-service-loopback.transport.spec.ts`
- Modify: `server/src/module/app/app.module.ts`
- Modify: `web/src/utils/app-runtime.ts`
- Modify: `web/packages/app-runtime-sdk/src/types.ts`
- Modify: `web/packages/app-runtime-sdk/src/protocol.ts`
- Modify: `web/packages/app-runtime-sdk/src/client.ts`
- Modify: `web/packages/app-runtime-sdk/src/index.ts`
- Modify: `web/packages/app-runtime-sdk/scripts/verify-sdk.ts`

**Interfaces:**
- Produces: `AppServiceInvokeDto` with `input: AppRuntimeJsonValue`
- Produces: `AppServiceInvocationPolicyService.invoke(session, targetCode, input)`
- Produces: `AppServiceRuntimeService.invokeAuthorized(targetApp, targetVersion, context, input)`
- Produces: SDK `runtime.services.invoke(targetCode: string, input: AppRuntimeJsonValue, options?: AppRuntimeRequestOptions)`

- [ ] **Step 1: Write failing authorization, quota, and circuit tests**

Cover:

```ts
it('requires service.invoke in the short-lived runtime session');
it('rejects a target absent from the caller frozen service_targets snapshot');
it('rejects cross-tenant, uninstalled, disabled, unpublished, unentitled, or unhealthy targets');
it('derives tenant and user context from the authorized session only');
it('fails closed when Redis quota state is unavailable or malformed');
it('limits concurrent calls and always releases the lease in finally');
it('returns retry_after for per-minute quota and open-circuit rejection');
it('opens the circuit after five consecutive gateway/service failures');
it('resets consecutive failures after a successful invocation');
it('does not count authorization, consent, target-policy, or quota rejections as service failures');
it('records payload-free success/failure/rejected metrics');
it('preserves P10 direct probe input while gateway envelopes pass sanitized context separately');
```

- [ ] **Step 2: Run invocation tests to verify RED**

```powershell
pnpm run test -- app-runtime.constants.spec.ts app-runtime.controller.spec.ts app-service-invocation-policy.service.spec.ts app-service-runtime.service.spec.ts app-service-loopback.transport.spec.ts --runInBand
```

Expected: FAIL because `service.invoke`, policy service, and circuit behavior do not exist.

- [ ] **Step 3: Add bounded DTO and capability route**

`POST /api/app-runtime/services/:code/invoke` is `@Public()` only in the same sense as other runtime-token routes: it requires exactly one `x-app-runtime-token`, authorizes `service.invoke`, validates target code with `^[a-z][a-z0-9_]{2,79}$`, and rejects JSON over 2 MB or nesting deeper than 20.

The response contract is:

```ts
interface AppRuntimeServiceInvokeResult {
  status: number;
  headers: Record<string, string>;
  data: AppRuntimeJsonValue;
}
```

- [ ] **Step 4: Implement target policy and Redis state**

Target resolution must join authoritative rows for:

1. caller version and frozen `serviceTargets`;
2. target app with `type/runtimeType='service'`, allowed trust, published status, and no deletion;
3. active same-tenant installation bound to the published target version;
4. current SaaS/system-module entitlement;
5. one active/online/healthy target instance.

Use server-generated Redis keys containing numeric tenant and target app IDs. Lua scripts atomically acquire/release concurrency, increment minute rate with TTL, read/open/reset circuit state, and return bounded numeric results. No key contains token, username, app display name, payload, or secret.

- [ ] **Step 5: Implement outcome and circuit semantics**

Count as service failures: timeout, loopback connection failure, invalid/oversized response, and target HTTP status `500..599`. Success is a valid bounded response with status below 500. Circuit state is mirrored to the instance row for operations/UI, but Redis is the runtime authority. The circuit-open response is HTTP 503 with stable code `service_circuit_open` and `retry_after`.

- [ ] **Step 6: Preserve host compatibility with a reserved envelope**

Gateway transport sends:

```ts
{
  __agentstudio_runtime: 1,
  input,
  context: {
    tenant: { id: String(session.tenantId) },
    user: { id: String(session.userId) },
    caller: { app_id: String(session.appId), version_id: String(session.versionId) },
  },
}
```

The generated host unwraps only when `__agentstudio_runtime === 1`, then calls `service.invoke(input, context)`. P10 probes without the marker continue to call `service.invoke(body, {})`. Never include tokens, installation IDs, roles, emails, phone numbers, cookies, headers, environment values, paths, or process details.

- [ ] **Step 7: Add SDK and parent bridge support**

Add `service.invoke` to backend and SDK capability unions. Add protocol operation `services.invoke` with `{ target_code, input }` and the bounded result validator. The parent bridge maps it to `/api/app-runtime/services/${encodeURIComponent(target_code)}/invoke` using the in-memory runtime token header and maps 401/403/409/429/503 to existing stable runtime error codes without returning server messages.

- [ ] **Step 8: Run Task 5 backend and SDK gates**

```powershell
pnpm run test -- app-runtime.constants.spec.ts app-runtime.controller.spec.ts app-service-invocation-policy.service.spec.ts app-service-runtime.service.spec.ts app-service-loopback.transport.spec.ts --runInBand
```

```powershell
pnpm run verify:app-runtime-sdk
pnpm run verify:app-runtime-readiness
```

Expected: all tests/gates pass.

- [ ] **Step 9: Commit Task 5**

```powershell
git add server/src/module/app web/src/utils/app-runtime.ts web/packages/app-runtime-sdk
git commit -m "feat(app): invoke restricted tenant services"
```

---

### Task 6: Developer-Owned Observability And Certification UI

**Files:**
- Modify: `server/src/module/app/services/app-developer.service.ts`
- Modify: `server/src/module/app/services/app-developer.service.spec.ts`
- Modify: `server/src/module/app/app-developer.controller.ts`
- Modify: `server/src/module/app/app-developer.controller.spec.ts`
- Modify: `server/src/module/app/services/app-service-runtime.service.ts`
- Modify: `web/src/api/app-developer.ts`
- Create: `web/src/api/app-developer-certification.ts`
- Modify: `web/src/views/app-center/developer/index.vue`
- Create: `web/src/views/app-center/developer-runtime/index.vue`
- Create: `web/src/views/app-platform/developers/index.vue`
- Create: `web/scripts/verify-app-developer-service-readiness.ts`
- Modify: `web/scripts/verify-app-developer-readiness.ts`
- Modify: `web/package.json`

**Interfaces:**
- Produces: `AppDeveloperService.getServiceOverview(developerId: number, days: 1 | 7 | 30)`
- Produces: `AppDeveloperService.getServiceLogs(code: string, developerId: number, lines: number)`
- Produces: frontend `DeveloperServiceOverview`, `DeveloperServiceRuntimeRecord`, `DeveloperServiceLogResponse`, and certification contracts

- [ ] **Step 1: Write failing ownership and response-safety tests**

Cover:

```ts
it('aggregates invocation totals only for apps owned by the authenticated developer');
it('returns health and circuit state without process name, port, path, command, environment, or tenant payload');
it('returns bounded redacted logs for an owned service app');
it('returns not found for a foreign service app before reading PM2 logs');
it('clamps observability windows to 1, 7, or 30 days and log lines to 1..200');
it('cleans invocation rows older than configured retention without blocking successful calls');
```

- [ ] **Step 2: Run observability tests to verify RED**

```powershell
pnpm run test -- app-developer.service.spec.ts app-developer.controller.spec.ts app-service-runtime.service.spec.ts --runInBand
```

Expected: FAIL because owned runtime endpoints and aggregates do not exist.

- [ ] **Step 3: Implement owned observability APIs**

Routes:

```text
GET /api/app-developer/apps/service-overview?days=7
GET /api/app-developer/apps/:code/runtime/logs?lines=100
```

Always call `findOwnedApp(code, developerId)` before runtime/log queries. Overview returns app/version, process/health/circuit labels, restart count, success/failure/rejected counts, success rate, p50/p95 duration, last invoke, and last success. Logs return only `app_code`, `version`, `role`, `stdout`, and `stderr`, reusing the P10 redactor and 64 KB bound.

- [ ] **Step 4: Build the platform certification page**

The page includes status/risk/runtime filters, applicant identity, requested runtimes, statement, website, timestamps, reviewer result, expiry, disabled state, and approve/reject/disable actions. Actions use dialogs with explicit expiry, runtime checkboxes, risk selection, and mandatory reason. Loading, empty, error, success, and retry states are required.

- [ ] **Step 5: Extend the developer workspace**

Add a compact certification banner, application action when absent/rejected/expired, approved runtime tags, service/static runtime selector, service package upload text, automated findings, frozen submission state, and a link to owned observability. Do not expose platform approve/publish/candidate controls.

- [ ] **Step 6: Build owned service observability page**

Use unframed page sections with compact KPI rows, one service table, and a log drawer. Include 1/7/30-day segmented selection, refresh icon button, health/circuit tags, last invocation, success rate, p95 latency, bounded logs, loading skeletons, empty state, and retry alert. Do not render nested cards or sensitive runtime identifiers.

- [ ] **Step 7: Add deterministic readiness assertions**

The P11 readiness script verifies all routes, permissions, menu components, certification restrictions, feature flag, snapshot fields, target-policy tokens, SDK method, ownership checks, safe UI fields, and exclusion of `package_path`, `publish_path`, `release_dir`, `loopback_port`, `process_name`, `environment`, `command_line`, `raw_source`, `token`, and `cookie` from developer APIs/UI. Update the existing developer readiness gate to require tenant-role workspace grants, static-app access without certification, and explicit certification guards before every service path.

- [ ] **Step 8: Run Task 6 gates**

```powershell
pnpm run test -- app-developer.service.spec.ts app-developer.controller.spec.ts app-service-runtime.service.spec.ts --runInBand
```

```powershell
pnpm run verify:app-developer-readiness
pnpm run verify:app-service-runtime-readiness
pnpm run verify:app-developer-service-readiness
pnpm run build
```

Expected: backend tests, three readiness gates, and frontend build pass.

- [ ] **Step 9: Commit Task 6**

```powershell
git add server/src/module/app web/src/api web/src/views/app-center web/src/views/app-platform/developers web/scripts web/package.json
git commit -m "feat(app): add developer service operations"
```

---

### Task 7: Disposable E2E, Operations, Security Review, And Final Commit

**Files:**
- Create: `server/scripts/verify-app-developer-service-live-e2e.ts`
- Create: `server/scripts/verify-app-developer-service-live-e2e-contract.ts`
- Modify: `server/package.json`
- Create: `docs/deployment/app-developer-service-runtime-baota.md`
- Modify: `docs/saas-launch-readiness-checklist.md`
- Modify: `web/scripts/run-saas-readiness.ts`

**Interfaces:**
- Produces: `pnpm run verify:app-developer-service-live-e2e-contract`
- Produces: `pnpm run verify:app-developer-service-live-e2e`
- Produces: repository readiness inclusion for P11 deterministic gates

- [ ] **Step 1: Write the contract gate before the live script**

The contract gate reads the live script and fails unless it contains assertions for:

```text
Linux-only execution
explicit APP_DEVELOPER_SERVICE_E2E_* database and Redis isolation variables
non-production-like disposable database name
Redis DB not equal to 0 and verified empty
non-root runtime user
runtime root outside repository and production roots
dedicated PM2 home
feature flags initially disabled
two separate platform reviewer identities
certified developer identity distinct from both reviewers
foreign developer and foreign tenant negative cases
cleanup on success, failure, and process signal
no password, token, cookie, Authorization header, .env content, PM2 env, source, command, or payload output
no shell mode, installer, lifecycle script, or sudo prompt
```

- [ ] **Step 2: Run contract gate to verify RED**

```powershell
pnpm run verify:app-developer-service-live-e2e-contract
```

Expected: FAIL because the live script is absent.

- [ ] **Step 3: Implement disposable live E2E**

The script must:

1. refuse Windows and non-disposable isolation configuration before creating resources;
2. migrate a disposable database and empty Redis DB;
3. start backend with P10/P11 flags enabled only inside the disposable environment;
4. create developer, two platform reviewers, two tenants, certification application, and approval;
5. upload a valid restricted service with a caller target declaration and verify findings/snapshot hash;
6. prove same-operator review and candidate review are rejected;
7. approve, start healthy candidate, publish, install for one tenant, consent to `service.invoke`, and invoke successfully through a short-lived session;
8. prove undeclared target, foreign tenant, foreign developer logs, disabled profile, expired profile, quota, and open-circuit paths fail closed;
9. prove active P10 administrator service behavior still works;
10. verify metrics/log responses are payload-free and redacted;
11. delete processes, PM2 state, runtime directories, uploads, database rows/database, Redis keys, and temporary files in `finally` and signal handlers.

- [ ] **Step 4: Write Baota rollout and rollback runbook**

Document migration backup, dedicated runtime user/home/root, firewall/network restrictions, disabled-first deployment, two-reviewer readiness, candidate observation, staged tenant enablement, seven-day retention check, circuit dashboard checks, rollback order, and cleanup. Use variable names only; include no credentials or environment contents.

- [ ] **Step 5: Run focused P11 verification**

Backend:

```powershell
pnpm run test -- app-developer-service-entities.spec.ts create-certified-developer-service-runtime.spec.ts app-developer-certification.service.spec.ts app-developer-profile.controller.spec.ts app-developer-certification.controller.spec.ts seed-certified-developer-service-menus.spec.ts app-review-snapshot.service.spec.ts app-developer.service.spec.ts app-developer.controller.spec.ts app-platform.service.spec.ts app-service-package.service.spec.ts app-service-runtime.service.spec.ts app-service-platform.controller.spec.ts app-service-invocation-policy.service.spec.ts app-runtime.constants.spec.ts app-runtime.controller.spec.ts app-service-loopback.transport.spec.ts --runInBand
pnpm run build
```

Frontend:

```powershell
pnpm run verify:app-developer-readiness
pnpm run verify:app-service-runtime-readiness
pnpm run verify:app-developer-service-readiness
pnpm run verify:app-runtime-sdk
pnpm run verify:app-runtime-readiness
pnpm run build
```

Expected: all focused tests, readiness gates, SDK checks, and builds pass.

- [ ] **Step 6: Run repository and live-contract gates**

```powershell
pnpm run verify:saas-readiness
pnpm run verify:app-developer-service-live-e2e-contract
```

Run the live E2E only in an explicitly disposable Linux environment with all required isolation variables. On Windows or absent isolation variables, expected behavior is an early environment-blocked exit before resource creation; record that evidence instead of weakening the guard.

- [ ] **Step 7: Perform security and regression review**

Verify manually:

- uploaded code is parsed/scanned and later executed only by the external low-privilege host process;
- certification, ownership, expiry, disabled state, immutable snapshot, checksum, and reviewer separation are revalidated at each authority transition;
- target app authority is same-tenant, declared, installed, entitled, published, and healthy;
- Redis failures deny invocation and leases release in `finally`;
- circuit failures count only service execution failures;
- no developer API/UI exposes process name, port, path, source, command, environment, tenant payload, token, cookie, secret, or raw upstream error;
- static/iframe/native/P10 lifecycle, P9 sessions/capabilities, marketplace, analytics, and tenant install/open behavior remain green;
- no P12 billing or settlement behavior entered the diff.

- [ ] **Step 8: Inspect diff and commit final verification**

```powershell
git diff --check
git status --short
git diff --stat 823499b..HEAD
git log --oneline 823499b..HEAD
```

Expected: no whitespace errors, only P11/docs/gate changes, no generated build output, dependency directory, credential, environment file, runtime artifact, or unrelated change.

```powershell
git add server/scripts server/package.json web/scripts/run-saas-readiness.ts docs/deployment/app-developer-service-runtime-baota.md docs/saas-launch-readiness-checklist.md
git commit -m "test(app): verify certified developer services"
```

---

## Plan Self-Review

- **Spec coverage:** Certification profiles/status/expiry/risk/runtime approvals/disabled state are Task 1-2; certified submission, automated findings, frozen review content, and ownership are Task 3; independent approval/candidate review is Task 4; `developer_restricted`, quotas, circuit breaking, and tenant `service.invoke` are Task 4-5; developer-owned observability is Task 6; disposable E2E, operations, security, and regressions are Task 7.
- **Scope control:** Pricing, licenses, orders, Alipay, revenue, settlement, invoices, payouts, containers, Python, native executables, database access, arbitrary networking, secrets injection, and automatic data rollback are excluded.
- **Type consistency:** `service.invoke`, `serviceTargets`, `candidateReviewedBy`, certification/runtime/risk unions, and SDK `services.invoke` names are consistent across schema, backend, bridge, SDK, UI, and tests.
- **Security consistency:** Every runtime transition reuses P10 external-process boundaries; every tenant call reuses P9 session capability checks and adds declared-target, same-tenant, installation, entitlement, health, quota, and circuit checks.
- **No placeholders:** Every task defines exact files, interfaces, tests, commands, expected results, and commit boundaries.
