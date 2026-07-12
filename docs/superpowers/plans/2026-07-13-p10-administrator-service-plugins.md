# P10 Administrator Service Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Manifest V2 and a fail-closed, administrator-only host-process runtime for reviewed single-entry JavaScript service plugins, including candidate health checks, PM2 supervision, platform probes, logs, publish, and rollback.

**Architecture:** Extend the existing application catalog and version records instead of creating a second plugin catalog. Uploaded service code is parsed and scanned, installed into immutable version directories, and executed only by a code-owned host bootstrap in a separate low-privilege PM2 process bound to loopback. NestJS stores desired/release state and talks to the active process through bounded loopback HTTP; PM2 only supervises processes and never decides publication.

**Tech Stack:** NestJS 11, TypeORM, MySQL 8, Node.js/Bun, PM2 CLI, JSZip, Acorn, Undici, Vue 3, Element Plus, TypeScript, Jest, Playwright.

## Global Constraints

- Authoritative specification: `docs/superpowers/specs/2026-07-12-hybrid-app-platform-completion-design.md`.
- Work inline without subagents, as explicitly requested by the user.
- Preserve existing static, iframe, internal/native, marketplace, review, install, analytics, protocol-v1, and P9-C runtime behavior.
- `APP_SERVICE_RUNTIME_ENABLED` defaults to `false`; no service process starts when disabled.
- Service packages are available only to platform administrators in P10. Certified developer submission is P11 scope.
- Tenant-facing `service.invoke`, SDK service methods, app pricing, licensing, orders, Alipay, revenue, and settlement are not part of P10.
- Never load uploaded code into NestJS, run package lifecycle scripts, run dependency installers, or execute a shell command supplied by a request or manifest.
- Production process execution requires Linux, a configured non-root low-privilege user, an isolated PM2 home, and a runtime root outside the main project.
- Service processes bind only to `127.0.0.1` and receive a minimal allowlisted environment without database, Redis, JWT, payment, storage, `.env`, or platform credentials.
- The platform must keep the current active version unchanged when upload, scan, install, start, health, or candidate publication fails.
- Every service release and capability change remains auditable; a service version cannot be approved by the operator who submitted it.
- Release directories are versioned and read-only. Writable plugin data remains available only through future gateway capabilities, not direct filesystem access.
- Default limits are 256 MB memory, 15-second request timeout, 2 MB request and response bodies, three consecutive candidate health successes, and 200 retained log lines/64 KB per response.
- TDD is mandatory. Every task runs its focused RED/GREEN cycle, review, and independent commit before the next task.
- Live process E2E runs only with explicit `APP_SERVICE_E2E_*` variables targeting a disposable runtime root, isolated PM2 home, and dedicated non-root test user.

---

### Task 1: Manifest V2 And Service Runtime Schema

**Files:**

- Modify: `server/src/module/app/entities/app-package.entity.ts`
- Modify: `server/src/module/app/entities/app-package-version.entity.ts`
- Create: `server/src/module/app/entities/app-service-instance.entity.ts`
- Modify: `server/src/module/app/entities/app-runtime-entities.spec.ts`
- Modify: `server/src/module/app/dto/app-platform.dto.ts`
- Create: `server/src/migrations/1760000000040-CreateAppServiceRuntime.ts`
- Create: `server/src/migration-specs/create-app-service-runtime.spec.ts`
- Modify: `server/src/config/configuration.ts`
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/src/config/saas-env-contract.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**

- `AppPackageType` adds `service`; `AppPackageEntryMode` adds `service`.
- `AppRuntimeType = 'static' | 'iframe' | 'service' | 'native'`.
- `AppTrustLevel = 'platform_trusted' | 'developer_restricted' | 'external_managed' | 'static_sandboxed'`.
- `AppServiceInstanceRole = 'candidate' | 'active' | 'standby' | 'retired'`.
- `AppServiceProcessStatus = 'starting' | 'online' | 'stopped' | 'failed'`.
- `AppServiceHealthStatus = 'unknown' | 'checking' | 'healthy' | 'unhealthy'`.
- Existing package/version response fields remain present; normalized fields are additive.

- [ ] **Step 1: Add failing entity and migration assertions**

Add tests that require:

```ts
expect(APP_PACKAGE_TYPES).toContain("service");
expect(metadataColumns(AppPackageEntity)).toEqual(
  expect.arrayContaining([
    "runtime_type",
    "trust_level",
    "service_health_path",
    "runtime_config",
  ]),
);
expect(metadataColumns(AppPackageVersionEntity)).toEqual(
  expect.arrayContaining([
    "manifest_version",
    "package_format",
    "scan_result",
    "candidate_health_status",
    "submitted_by",
    "released_by",
    "released_time",
    "rollback_from_version_id",
  ]),
);
expect(metadataIndexes(AppServiceInstanceEntity)).toEqual(
  expect.arrayContaining([
    "uk_app_service_instance_process",
    "idx_app_service_instance_app_role",
    "idx_app_service_instance_health",
  ]),
);
```

Migration tests must assert forward creation/backfill and reverse removal without touching existing app rows:

```ts
expect(upSql).toContain("WHEN `type` = 'internal' THEN 'native'");
expect(upSql).toContain("WHEN `type` = 'iframe' THEN 'external_managed'");
expect(upSql).toContain("CREATE TABLE `app_service_instance`");
expect(downSql).toContain("DROP TABLE `app_service_instance`");
```

- [ ] **Step 2: Run RED**

```powershell
cd server
pnpm.cmd exec jest src/module/app/entities/app-runtime-entities.spec.ts src/migration-specs/create-app-service-runtime.spec.ts src/config/saas-env-contract.spec.ts --runInBand
```

Expected: FAIL because the normalized fields, instance entity, migration, and env contract do not exist.

- [ ] **Step 3: Implement additive schema and configuration**

Use these entity defaults and configuration names:

```ts
runtimeType: AppRuntimeType; // static/iframe/service/native, backfilled from type
trustLevel: AppTrustLevel; // service defaults platform_trusted in P10
serviceHealthPath: string; // default '/health' only for service apps
runtimeConfig?: Record<string, unknown> | null;

manifestVersion: number; // default 1 for legacy versions
packageFormat: 'static_zip' | 'iframe_config' | 'service_zip' | 'native';
scanResult?: Record<string, unknown> | null;
candidateHealthStatus: AppServiceHealthStatus;
submittedBy?: number | null;
releasedBy?: number | null;
releasedTime?: Date | null;
rollbackFromVersionId?: number | null;
```

`AppServiceInstanceEntity` stores `appId`, `versionId`, `releaseDir`, `processName`, `loopbackPort`, `role`, `processStatus`, `healthStatus`, `restartCount`, `lastHealthTime`, `lastErrorCode`, `lastErrorMessage`, `startedTime`, `stoppedTime`, and audit timestamps. Do not store environment values, raw command lines, request bodies, or secrets.

Add these env keys with fail-closed defaults:

```text
APP_SERVICE_RUNTIME_ENABLED=false
APP_SERVICE_RUNTIME_DIR=../upload/app-service-runtime
APP_SERVICE_RUNTIME_USER=
APP_SERVICE_PM2_HOME=
APP_SERVICE_PM2_COMMAND=pm2
APP_SERVICE_RUNTIME_INTERPRETER=node
APP_SERVICE_MEMORY_MB=256
APP_SERVICE_REQUEST_TIMEOUT_MS=15000
APP_SERVICE_MAX_BODY_MB=2
APP_SERVICE_HEALTH_SUCCESS_COUNT=3
APP_SERVICE_PORT_MIN=20000
APP_SERVICE_PORT_MAX=39999
```

Validate the user with `^[a-z_][a-z0-9_-]{0,31}$`, reject `root`, clamp memory to `128..2048`, timeout to `1000..30000`, body to `1..10`, health successes to `1..10`, and require a port range of at least 100 ports.

- [ ] **Step 4: Run GREEN and build**

```powershell
pnpm.cmd exec jest src/module/app/entities/app-runtime-entities.spec.ts src/migration-specs/create-app-service-runtime.spec.ts src/config/saas-env-contract.spec.ts --runInBand
pnpm.cmd run build
git diff --check
```

Expected: all focused suites and build pass.

- [ ] **Step 5: Review and commit**

Review backward-compatible defaults, migration idempotency, rollback SQL, indexes, and absence of secrets. Commit:

```powershell
git add server/src/module/app server/src/migrations/1760000000040-CreateAppServiceRuntime.ts server/src/migration-specs/create-app-service-runtime.spec.ts server/src/config
git commit -m "feat(app): add service runtime schema"
```

### Task 2: Manifest V2 Parser, Archive Scanner, And Immutable Release Storage

**Files:**

- Modify: `server/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `server/src/module/app/services/app-manifest.service.ts`
- Modify: `server/src/module/app/services/app-manifest.service.spec.ts`
- Create: `server/src/module/app/services/app-service-package.service.ts`
- Create: `server/src/module/app/services/app-service-package.service.spec.ts`
- Create: `server/src/module/app/runtime/app-service-host.ts`
- Modify: `server/src/module/app/services/app-package-storage.service.ts`
- Modify: `server/src/module/app/services/app-package-storage.service.spec.ts`
- Modify: `server/src/module/app/services/app-platform.service.ts`
- Modify: `server/src/module/app/services/app-platform.service.spec.ts`

**Interfaces:**

- `validateServiceManifest(input): NormalizedServiceManifest` accepts only Manifest V2 service packages.
- `scanAndInstall(input): Promise<ServicePackageInstallResult>` parses, scans, hashes, stages, and atomically installs an immutable release.
- The archive allowlist is exactly `app.manifest.json` and `dist/index.js` in P10.
- The entry module exports `health(context)` and `invoke(request, context)`; the fixed host bootstrap starts loopback HTTP and never imports into NestJS.

- [ ] **Step 1: Add failing manifest and scanner tests**

Cover the valid contract:

```json
{
  "manifestVersion": 2,
  "code": "admin_echo_service",
  "version": "1.0.0",
  "runtime": "service",
  "entry": "dist/index.js",
  "healthPath": "/health",
  "capabilities": [],
  "allowedOrigins": []
}
```

Require rejection of manifest version other than `2`, non-service runtime, code/version mismatch, absolute or traversal entry, health path with query/hash/credentials, unknown capabilities, non-empty direct outbound origins in P10, extra archive entries, symlinks, native binaries, source maps, files over limits, malformed JavaScript, missing exports, `eval`, `Function`, dynamic import, non-literal `require`, package imports, `child_process`, `worker_threads`, `cluster`, `vm`, `fs`, `net`, `tls`, `dns`, `dgram`, global `fetch`, `WebSocket`, `process`, `Bun`, and `Deno` access.

Use Acorn/Acorn-walk to inspect syntax and import/call/member nodes; do not rely on raw regex as the security boundary.

- [ ] **Step 2: Run RED**

```powershell
cd server
pnpm.cmd exec jest src/module/app/services/app-manifest.service.spec.ts src/module/app/services/app-service-package.service.spec.ts src/module/app/services/app-package-storage.service.spec.ts src/module/app/services/app-platform.service.spec.ts --runInBand
```

Expected: FAIL because service Manifest V2 and scanner APIs are absent.

- [ ] **Step 3: Implement normalized service package handling**

Add direct runtime dependencies `acorn` and `acorn-walk`. Scanner output is bounded and contains only codes/locations:

```ts
export interface AppServiceScanResult {
  passed: boolean;
  findings: Array<{
    code: string;
    severity: "error" | "warning";
    line?: number;
    column?: number;
  }>;
  scannedFiles: number;
  entrySha256: string;
}
```

Never persist source snippets in findings. Install through a random staging directory under `APP_SERVICE_RUNTIME_DIR`, copy the fixed compiled `app-service-host` bootstrap, write only the two reviewed package files, set files to read-only and directories to read/execute, then atomically rename staging to `<root>/<app-code>/<version>`. Reject an existing release with a different checksum; accept an identical checksum idempotently.

`uploadServiceVersion()` remains pending review, stores the immutable normalized manifest and scan summary, records `submittedBy`, and never starts a process.

- [ ] **Step 4: Run GREEN, lint, and build**

```powershell
pnpm.cmd exec jest src/module/app/services/app-manifest.service.spec.ts src/module/app/services/app-service-package.service.spec.ts src/module/app/services/app-package-storage.service.spec.ts src/module/app/services/app-platform.service.spec.ts --runInBand
pnpm.cmd exec eslint src/module/app/services/app-manifest.service.ts src/module/app/services/app-service-package.service.ts src/module/app/runtime/app-service-host.ts
pnpm.cmd run build
git diff --check
```

- [ ] **Step 5: Review and commit**

Review archive/path handling, AST coverage, immutable writes, checksum idempotency, and that uploaded code never executes during scan. Commit:

```powershell
git add server/package.json pnpm-lock.yaml server/src/module/app/services server/src/module/app/runtime
git commit -m "feat(app): validate administrator service packages"
```

### Task 3: Low-Privilege PM2 Process Manager And Redacted Logs

**Files:**

- Create: `server/src/module/app/services/app-service-process-manager.ts`
- Create: `server/src/module/app/services/app-service-process-manager.spec.ts`
- Create: `server/src/module/app/services/app-service-log-redactor.ts`
- Create: `server/src/module/app/services/app-service-log-redactor.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**

```ts
export interface AppServiceProcessSpec {
  processName: string;
  releaseDir: string;
  entryFile: string;
  healthPath: string;
  loopbackPort: number;
  memoryMb: number;
}

export interface AppServiceProcessManager {
  start(spec: AppServiceProcessSpec): Promise<AppServiceProcessSnapshot>;
  stop(processName: string): Promise<void>;
  delete(processName: string): Promise<void>;
  describe(processName: string): Promise<AppServiceProcessSnapshot | null>;
  logs(
    processName: string,
    lines: number,
  ): Promise<{ stdout: string; stderr: string }>;
}
```

- [ ] **Step 1: Add failing process boundary tests**

Assert stable process names, no shell execution, fixed PM2 argument construction, Linux/non-root/user/PM2-home checks, release path ownership checks, loopback-only env, interpreter allowlist `node|bun`, 256 MB default, and a minimal child env containing only `PATH`, `HOME`, `PM2_HOME`, `NODE_ENV`, `APP_SERVICE_HOST`, `APP_SERVICE_PORT`, `APP_SERVICE_ENTRY`, and `APP_SERVICE_HEALTH_PATH`.

Log tests must redact bearer/JWT-like values, password/token/secret/cookie JSON fields, URL credentials, `set-cookie`, and registered runtime secrets while limiting each stream to 200 lines and 64 KB.

- [ ] **Step 2: Run RED**

```powershell
cd server
pnpm.cmd exec jest src/module/app/services/app-service-process-manager.spec.ts src/module/app/services/app-service-log-redactor.spec.ts --runInBand
```

- [ ] **Step 3: Implement the PM2 adapter**

Use `execFile`/`spawn` with `shell: false` and fixed arguments. On Linux invoke PM2 through:

```text
runuser -u <APP_SERVICE_RUNTIME_USER> -- <APP_SERVICE_PM2_COMMAND> <fixed args>
```

Reject Windows/macOS production execution, blank/root users, non-absolute PM2 home, release directories outside the configured runtime root, process names outside `^agentstudio-app-[a-z0-9-]{3,90}$`, and ports outside the configured range. PM2 JSON parsing must fail closed on malformed or multiple-name results. Never forward the parent `process.env` wholesale.

- [ ] **Step 4: Run GREEN and build**

```powershell
pnpm.cmd exec jest src/module/app/services/app-service-process-manager.spec.ts src/module/app/services/app-service-log-redactor.spec.ts --runInBand
pnpm.cmd run build
git diff --check
```

- [ ] **Step 5: Review and commit**

Review command injection, env leakage, path escape, process-name collision, output bounds, and redaction. Commit:

```powershell
git add server/src/module/app/services/app-service-process-manager* server/src/module/app/services/app-service-log-redactor* server/src/module/app/app.module.ts
git commit -m "feat(app): supervise isolated service processes"
```

### Task 4: Candidate Health, Desired-State Reconciliation, Publish, And Rollback

**Files:**

- Create: `server/src/module/app/services/app-service-runtime.service.ts`
- Create: `server/src/module/app/services/app-service-runtime.service.spec.ts`
- Create: `server/src/module/app/services/app-service-loopback.transport.ts`
- Create: `server/src/module/app/services/app-service-loopback.transport.spec.ts`
- Modify: `server/src/module/app/services/app-platform.service.ts`
- Modify: `server/src/module/app/services/app-platform.service.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**

- `startCandidate(appCode, version, operatorId)` installs/starts one candidate and requires consecutive healthy probes.
- `publishCandidate(appCode, version, operatorId)` atomically promotes only a healthy candidate.
- `rollback(appCode, targetVersion, reason, operatorId)` atomically swaps a healthy standby back to active.
- `stopCandidate(appCode, version, reason, operatorId)` stops only the matching candidate.
- `reconcile()` repairs process-state drift but never changes review or publication state.
- `probeActive(appCode, input)` is platform-admin-only P10 smoke invocation with bounded JSON.

- [ ] **Step 1: Add failing lifecycle tests**

Cover:

```ts
it("leaves the active instance unchanged when candidate start fails");
it(
  "requires three consecutive health successes before marking a candidate healthy",
);
it("does not publish an unhealthy or non-approved candidate");
it("atomically moves active to standby and candidate to active");
it("keeps at most one standby and retires older instances");
it("rolls back only to a healthy standby");
it("never publishes during reconciliation");
it("restarts an expected active process without changing its version role");
it("marks repeated restart drift failed without crashing NestJS");
it("rejects loopback redirects and responses over two megabytes");
it("redacts candidate errors before persistence");
```

- [ ] **Step 2: Run RED**

```powershell
cd server
pnpm.cmd exec jest src/module/app/services/app-service-runtime.service.spec.ts src/module/app/services/app-service-loopback.transport.spec.ts src/module/app/services/app-platform.service.spec.ts --runInBand
```

- [ ] **Step 3: Implement lifecycle transactions and loopback transport**

Allocate a free port only inside the configured range and verify it is free on `127.0.0.1`. Loopback transport must use an Undici dispatcher pinned to `127.0.0.1`, `redirect: 'manual'`, a shared 15-second deadline, 2 MB request/response bounds, response header allowlist, and no proxy environment.

Candidate flow:

1. lock app/version rows;
2. require feature flag, service type, platform-trusted level, approved review, passing immutable scan, and reviewer different from submitter;
3. create/update candidate instance with desired state;
4. start PM2 outside the database transaction;
5. probe the exact manifest health path until the configured consecutive-success threshold;
6. mark healthy or stop/delete the failed candidate with a fixed diagnostic code.

Publish/rollback must lock all instances for the app and update roles plus version/app publication fields in one transaction. Process failure after a database switch must be surfaced and reconciled, but no unreviewed version can become active.

- [ ] **Step 4: Run GREEN and build**

```powershell
pnpm.cmd exec jest src/module/app/services/app-service-runtime.service.spec.ts src/module/app/services/app-service-loopback.transport.spec.ts src/module/app/services/app-platform.service.spec.ts --runInBand
pnpm.cmd run build
git diff --check
```

- [ ] **Step 5: Review and commit**

Review transaction locks, active preservation, health deadline, loopback pinning, restart bounds, and no publication in reconcile. Commit:

```powershell
git add server/src/module/app/services/app-service-runtime.service* server/src/module/app/services/app-service-loopback.transport* server/src/module/app/services/app-platform.service* server/src/module/app/app.module.ts
git commit -m "feat(app): manage service candidate releases"
```

### Task 5: Administrator Service Runtime APIs And Governance

**Files:**

- Create: `server/src/module/app/app-service-platform.controller.ts`
- Create: `server/src/module/app/app-service-platform.controller.spec.ts`
- Create: `server/src/module/app/dto/app-service-runtime.dto.ts`
- Modify: `server/src/module/app/app-platform.controller.ts`
- Modify: `server/src/module/app/app-platform.controller.spec.ts`
- Modify: `server/src/module/app/services/app-platform.service.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**

```text
POST /api/app-platform/apps/:code/versions/service-upload
GET  /api/app-platform/runtime/instances
GET  /api/app-platform/runtime/apps/:code
POST /api/app-platform/runtime/apps/:code/versions/:version/candidate
POST /api/app-platform/runtime/apps/:code/versions/:version/candidate/stop
POST /api/app-platform/runtime/apps/:code/versions/:version/publish
POST /api/app-platform/runtime/apps/:code/versions/:version/rollback
POST /api/app-platform/runtime/apps/:code/probe
GET  /api/app-platform/runtime/apps/:code/logs?lines=100
POST /api/app-platform/runtime/reconcile
```

Permissions are `app:runtime:list`, `app:runtime:manage`, `app:runtime:probe`, and `app:runtime:logs`. Every endpoint runs outside tenant filtering and derives operator identity only from the authenticated platform user.

- [ ] **Step 1: Add failing controller and authorization tests**

Require exact permissions, tenant filtering disabled only inside the controller boundary, multipart size limits, service-only upload, fixed DTO fields, bounded probe input, bounded log lines, audit reason requirements for stop/rollback, and no release path/process command/environment in responses.

- [ ] **Step 2: Run RED**

```powershell
cd server
pnpm.cmd exec jest src/module/app/app-service-platform.controller.spec.ts src/module/app/app-platform.controller.spec.ts --runInBand
```

- [ ] **Step 3: Implement platform-only APIs**

Return stable response shapes:

```ts
type AppServiceInstanceResponse = {
  id: string;
  app_code: string;
  version: string;
  process_name: string;
  loopback_port: number;
  role: "candidate" | "active" | "standby" | "retired";
  process_status: "starting" | "online" | "stopped" | "failed";
  health_status: "unknown" | "checking" | "healthy" | "unhealthy";
  restart_count: number;
  last_health_at: string | null;
  diagnostic_code: string;
  diagnostic_message: string;
};
```

Do not return `releaseDir`, log file paths, PM2 home, interpreter path, env, command line, raw source, raw scan snippets, or upstream exception objects.

- [ ] **Step 4: Run GREEN, app suites, and build**

```powershell
pnpm.cmd exec jest src/module/app/app-service-platform.controller.spec.ts src/module/app/app-platform.controller.spec.ts src/module/app/services/app-service-runtime.service.spec.ts --runInBand
pnpm.cmd exec jest src/module/app --runInBand
pnpm.cmd run build
git diff --check
```

- [ ] **Step 5: Review and commit**

Review permission boundaries, tenant bypass scope, response redaction, upload size, DTO bounds, and audit reasons. Commit:

```powershell
git add server/src/module/app/app-service-platform.controller* server/src/module/app/app-platform.controller* server/src/module/app/dto/app-service-runtime.dto.ts server/src/module/app/services/app-platform.service.ts server/src/module/app/app.module.ts
git commit -m "feat(app): expose service runtime operations"
```

### Task 6: Runtime Instance Console And Menu Permissions

**Files:**

- Modify: `web/src/api/app-marketplace.ts`
- Create: `web/src/api/app-service-runtime.ts`
- Modify: `web/src/views/app-platform/apps/index.vue`
- Create: `web/src/views/app-platform/runtime/index.vue`
- Create: `server/src/migrations/1760000000041-SeedAppServiceRuntimeMenus.ts`
- Create: `server/src/migration-specs/seed-app-service-runtime-menus.spec.ts`
- Create: `web/scripts/verify-app-service-runtime-readiness.ts`
- Modify: `web/package.json`
- Modify: `web/scripts/verify-app-marketplace-readiness.ts`

**Interfaces:**

- App creation allows `service` only for platform administrators and displays trust `platform_trusted` as fixed P10 copy.
- Service upload is a ZIP picker with scan status feedback; no command, dependency, environment, or secret fields exist.
- Runtime console has list filters, health/status tags, candidate/publish/stop/rollback/reconcile icon buttons, bounded probe dialog, and redacted logs drawer.

- [ ] **Step 1: Add failing frontend and migration readiness assertions**

Require API paths, exact permission slugs, page route `/app-platform/runtime`, loading/error/empty states, disabled actions for invalid lifecycle states, confirmation reasons for stop/rollback, no nested cards, no raw release/path/env fields, and no tenant identifiers.

- [ ] **Step 2: Run RED**

```powershell
cd web
pnpm.cmd run verify:app-service-runtime-readiness
cd ../server
pnpm.cmd exec jest src/migration-specs/seed-app-service-runtime-menus.spec.ts --runInBand
```

- [ ] **Step 3: Implement the console and menu migration**

Use existing Element Plus table/drawer/dialog patterns and lucide/Element Plus icons. Keep compact operational density; cards are only for repeated instance records on mobile, not page sections. The menu migration must be insert-idempotent and grant all four permissions only to platform administrator roles.

- [ ] **Step 4: Run GREEN, lint, and builds**

```powershell
cd web
pnpm.cmd run verify:app-service-runtime-readiness
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd exec eslint src/api/app-service-runtime.ts src/api/app-marketplace.ts src/views/app-platform/apps/index.vue src/views/app-platform/runtime/index.vue scripts/verify-app-service-runtime-readiness.ts
pnpm.cmd run build

cd ../server
pnpm.cmd exec jest src/migration-specs/seed-app-service-runtime-menus.spec.ts --runInBand
pnpm.cmd run build

cd ..
git diff --check
```

- [ ] **Step 5: Review and commit**

Review action gating, error/empty/loading states, response-field allowlists, permissions, migration rollback, and responsive text fit. Commit:

```powershell
git add web/src/api web/src/views/app-platform web/scripts/verify-app-service-runtime-readiness.ts web/scripts/verify-app-marketplace-readiness.ts web/package.json server/src/migrations/1760000000041-SeedAppServiceRuntimeMenus.ts server/src/migration-specs/seed-app-service-runtime-menus.spec.ts
git commit -m "feat(app): add runtime instance console"
```

### Task 7: Disposable Lifecycle, Operations Documentation, Review, And Commit

**Files:**

- Create: `server/scripts/verify-app-service-runtime-live-e2e.ts`
- Create: `server/scripts/verify-app-service-runtime-live-e2e-contract.ts`
- Modify: `server/package.json`
- Create: `docs/deployment/app-service-runtime-baota.md`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**

- Deterministic contract proves the live script refuses missing/non-isolated settings.
- Live E2E uses a disposable MySQL database, isolated Redis DB, isolated runtime root, isolated PM2 home, dedicated non-root test user, random loopback ports, and a generated service package.
- Cleanup removes processes, PM2 state, release files, database, Redis lease, and artifacts even on signal/failure.

- [ ] **Step 1: Add failing live-contract assertions**

Require these variables without values in source/docs:

```text
APP_SERVICE_E2E_DB_HOST
APP_SERVICE_E2E_DB_PORT
APP_SERVICE_E2E_DB_USERNAME
APP_SERVICE_E2E_DB_PASSWORD
APP_SERVICE_E2E_PLATFORM_USERNAME
APP_SERVICE_E2E_PLATFORM_PASSWORD
APP_SERVICE_E2E_REDIS_DB
APP_SERVICE_E2E_REDIS_ISOLATED=1
APP_SERVICE_E2E_RUNTIME_ROOT
APP_SERVICE_E2E_PM2_HOME
APP_SERVICE_E2E_RUNTIME_USER
```

Contract assertions cover upload/scan/approve/candidate/health/publish/probe/version-two candidate/failure-preserves-active/publish/swap/rollback/crash/reconcile/log redaction/feature-disabled/cleanup. Explicitly reject root users, runtime roots inside the repository, shared PM2 homes, Redis DB `0`, non-empty Redis DBs, production-like database names, `sudo` prompts, shell mode, and credential output.

- [ ] **Step 2: Run RED**

```powershell
cd server
pnpm.cmd run verify:app-service-runtime-live-e2e-contract
```

- [ ] **Step 3: Implement disposable service lifecycle evidence**

Generate a two-version service fixture where `invoke` returns its version and `health` can be forced unhealthy through test-only fixture input. The live flow must prove:

1. version 1 scans, starts, becomes healthy, publishes, and probes;
2. an unhealthy version 2 candidate never changes active version 1;
3. healthy version 2 publishes and version 1 becomes standby;
4. rollback restores version 1 without an unreviewed switch;
5. killing the active PM2 process does not stop NestJS and reconciliation restores only desired state;
6. logs and persisted diagnostics contain no JWT, password, runtime secret, Cookie, environment, source body, or raw exception;
7. feature-disabled endpoints fail closed without starting PM2;
8. cleanup leaves zero owned rows, Redis keys, PM2 processes, release files, and generated databases.

Do not run this live gate unless every variable is explicitly configured for disposable resources.

- [ ] **Step 4: Add Baota operations documentation**

Document, without credentials:

- creation of a dedicated non-login plugin user;
- ownership/mode of `/www/wwwroot/agentstudio-plugins` and isolated PM2 home;
- fixed `runuser`/PM2 command expectations;
- host firewall rules denying plugin-user public egress, metadata, MySQL, Redis, Baota ports, and main admin ports;
- feature flag enable/disable order;
- migration backup, candidate smoke, rollback, process/log inspection, and emergency stop;
- prohibition on copying `.env`, SSH keys, payment keys, or database credentials into release directories.

- [ ] **Step 5: Run deterministic P10 gates**

```powershell
cd server
pnpm.cmd run verify:app-service-runtime-live-e2e-contract
pnpm.cmd exec jest src/module/app src/common/utils/safe-url.util.spec.ts src/migration-specs/create-app-service-runtime.spec.ts src/migration-specs/seed-app-service-runtime-menus.spec.ts --runInBand
pnpm.cmd run build

cd ../web
pnpm.cmd run verify:app-service-runtime-readiness
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run build

cd ..
node scripts/run-saas-readiness.cjs
git diff --check
```

Run `pnpm.cmd run verify:app-service-runtime-live-e2e` only when all explicit disposable environment checks pass.

- [ ] **Step 6: Perform the P10 security review**

Verify uploaded code is never imported by NestJS; scan uses a real parser; archive paths and symlinks fail closed; no dependency installer or lifecycle script runs; process commands and names are platform-generated; `shell` is false; child env is allowlisted; runtime user is non-root; release paths remain under the configured root; loopback transport is pinned/bounded; candidate failure preserves active; publication is transactional; logs/API responses expose no secret/path/env/source; and no P11/P12 behavior entered the diff.

- [ ] **Step 7: Commit readiness evidence**

```powershell
git add server/scripts server/package.json docs/deployment/app-service-runtime-baota.md docs/saas-launch-readiness-checklist.md
git commit -m "test(app): verify administrator service lifecycle"
git status --short
```

Expected: clean tracked worktree, all deterministic gates green, live E2E either green in an explicitly disposable Linux environment or recorded as environment-blocked, and P10 ready for integration before P11 planning.

## P10 Completion Criteria

- Manifest V2 service versions are immutable, parser-validated, scan-approved, and review-separated from their submitter.
- Existing package types and responses remain backward compatible.
- Uploaded code never enters the NestJS process and cannot request shell/dependency installation through package content or API input.
- Service processes run only under the configured non-root user, isolated PM2 home, immutable release root, minimal env, loopback binding, and bounded memory/request/log limits.
- A failed or unhealthy candidate never replaces the active version.
- Publish and rollback change routing atomically and keep at most one healthy standby.
- Reconciliation repairs process drift without publishing an unreviewed version or crashing NestJS.
- Platform APIs and UI expose stable operational state without paths, env, source, raw command lines, tenant data, or secrets.
- Focused tests, frontend/backend builds, repository readiness, security review, and an independent commit pass before P11 begins.
