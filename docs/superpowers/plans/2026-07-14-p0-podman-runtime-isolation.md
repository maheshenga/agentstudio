# P0 Podman Service Runtime Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the production-blocked shared PM2 service boundary with a pluggable runtime layer whose production driver runs every reviewed service version in a restricted Rootless Podman container over a Unix socket.

**Architecture:** Keep `AppServiceRuntimeService` as the lifecycle and desired-state owner. Make the existing `AppServiceProcessManager` implement a stable runtime-driver contract for PM2, add a Podman driver and registry, persist the driver per service instance, and make the host transport accept either pinned loopback TCP or a validated Unix socket.

**Tech Stack:** NestJS 11, TypeScript, TypeORM, MySQL 8, Jest, Undici, Node.js, PM2, Rootless Podman, Vue 3, Element Plus, PowerShell/Linux shell deployment checks.

## Global Constraints

- Authoritative specification: `docs/superpowers/specs/2026-07-14-p0-podman-runtime-isolation-design.md`.
- Do not load uploaded code into the NestJS process.
- Do not use a shell, user-controlled command, user-controlled image, user-controlled mount, parent environment, or platform credential in runtime commands.
- `pm2` remains available only for development and historical-instance cleanup; production requires `podman`.
- Podman containers use a digest-pinned platform image, `--network=none`, read-only release/root filesystem, no capabilities, no privilege escalation, bounded CPU/memory/PIDs/tmpfs, and a non-root container UID.
- Podman communication uses a per-process Unix socket under an absolute configured socket root.
- Existing PM2 rows remain manageable through `runtime_driver=pm2`; changing configuration does not silently migrate running instances.
- No API may expose release paths, socket paths, container IDs, image details, commands, environment, raw inspect output, credentials, or source.
- Use TDD for every behavior change and keep unrelated worktree state untouched.
- Do not push until implementation, review, and verification are complete.

## File Map

**Create:**

- `server/src/migrations/1760000000052-AddAppServiceRuntimeDriver.ts`
- `server/src/migration-specs/add-app-service-runtime-driver.spec.ts`
- `server/src/module/app/services/app-service-runtime-driver.ts`
- `server/src/module/app/services/app-service-runtime-driver-registry.ts`
- `server/src/module/app/services/app-service-runtime-driver-registry.spec.ts`
- `server/src/module/app/services/app-service-podman-runtime.driver.ts`
- `server/src/module/app/services/app-service-podman-runtime.driver.spec.ts`

**Modify:**

- `server/src/module/app/entities/app-service-instance.entity.ts`
- `server/src/module/app/services/app-service-process-manager.ts`
- `server/src/module/app/services/app-service-process-manager.spec.ts`
- `server/src/module/app/runtime/app-service-host.ts`
- `server/src/module/app/services/app-service-loopback.transport.ts`
- `server/src/module/app/services/app-service-loopback.transport.spec.ts`
- `server/src/module/app/services/app-service-runtime.service.ts`
- `server/src/module/app/services/app-service-runtime.service.spec.ts`
- `server/src/module/app/app.module.ts`
- `server/src/config/configuration.ts`
- `server/src/config/env.validation.ts`
- `server/src/config/configuration.spec.ts`
- `server/package.json`
- `server/scripts/verify-app-service-runtime-live-e2e-contract.ts`
- `server/scripts/verify-app-service-runtime-live-e2e.ts`
- `web/src/api/app-service-runtime.ts`
- `web/src/views/app-platform/runtime/index.vue`
- `web/src/views/app-platform/runtime/runtime-display.ts`
- `web/scripts/verify-app-service-runtime-readiness.ts`
- `docs/deployment/app-service-runtime-baota.md`
- `docs/saas-launch-readiness-checklist.md`

---

### Task 1: Persisted Runtime Driver And Stable Contract

**Files:**
- Create: `server/src/migrations/1760000000052-AddAppServiceRuntimeDriver.ts`
- Create: `server/src/migration-specs/add-app-service-runtime-driver.spec.ts`
- Create: `server/src/module/app/services/app-service-runtime-driver.ts`
- Modify: `server/src/module/app/entities/app-service-instance.entity.ts`
- Test: `server/src/migration-specs/add-app-service-runtime-driver.spec.ts`

**Interfaces:**
- Produces: `AppServiceRuntimeDriverName`, `AppServiceRuntimeEndpoint`, `AppServiceRuntimeSpec`, and abstract `AppServiceRuntimeDriver`.
- Produces: `AppServiceInstanceEntity.runtimeDriver` persisted as `runtime_driver`.

- [ ] **Step 1: Write the failing migration and entity tests**

Add assertions equivalent to:

```ts
const sql = queryRunner.query.mock.calls.map(([statement]) => String(statement)).join('\n');
expect(sql).toContain("ADD COLUMN `runtime_driver` varchar(20) NOT NULL DEFAULT 'pm2'");
expect(sql).toContain('idx_app_service_instance_driver_status');
expect(sql).not.toMatch(/password|token|secret|image|socket/i);
```

Add an entity metadata test that expects `runtimeDriver` to use column name `runtime_driver`, type `varchar`, length `20`, and default `pm2`.

- [ ] **Step 2: Run RED verification**

Run:

```powershell
pnpm.cmd test -- add-app-service-runtime-driver.spec.ts app-developer-service-entities.spec.ts --runInBand
```

Expected: FAIL because migration `1760000000052` and `runtimeDriver` do not exist.

- [ ] **Step 3: Add the runtime contract and migration**

Create the contract with these exact public shapes:

```ts
export type AppServiceRuntimeDriverName = 'pm2' | 'podman';

export type AppServiceRuntimeEndpoint =
  | { kind: 'tcp'; port: number }
  | { kind: 'unix'; socketPath: string };

export interface AppServiceRuntimeSpec {
  appCode: string;
  version: string;
  processName: string;
  releaseDir: string;
  entryFile: 'dist/index.js';
  healthPath: string;
  loopbackPort: number;
  memoryMb: number;
}

export abstract class AppServiceRuntimeDriver {
  abstract readonly name: AppServiceRuntimeDriverName;
  abstract start(spec: AppServiceRuntimeSpec): Promise<AppServiceProcessSnapshot>;
  abstract stop(processName: string): Promise<void>;
  abstract delete(processName: string): Promise<void>;
  abstract describe(processName: string): Promise<AppServiceProcessSnapshot | null>;
  abstract logs(processName: string, lines: number): Promise<AppServiceCommandResult>;
  abstract endpoint(input: { processName: string; loopbackPort: number }): AppServiceRuntimeEndpoint;
}
```

Migration `up()` adds `runtime_driver` with default `pm2` and index `idx_app_service_instance_driver_status (runtime_driver, process_status)`. `down()` drops the index before the column.

- [ ] **Step 4: Run GREEN verification**

Run the Step 2 command. Expected: both suites PASS.

- [ ] **Step 5: Commit the task**

```powershell
git add server/src/migrations/1760000000052-AddAppServiceRuntimeDriver.ts server/src/migration-specs/add-app-service-runtime-driver.spec.ts server/src/module/app/services/app-service-runtime-driver.ts server/src/module/app/entities/app-service-instance.entity.ts
git commit -m "feat(app): persist service runtime drivers"
```

### Task 2: PM2 Compatibility Driver And Registry

**Files:**
- Create: `server/src/module/app/services/app-service-runtime-driver-registry.ts`
- Create: `server/src/module/app/services/app-service-runtime-driver-registry.spec.ts`
- Modify: `server/src/module/app/services/app-service-process-manager.ts`
- Modify: `server/src/module/app/services/app-service-process-manager.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**
- Consumes: Task 1 runtime-driver contract.
- Produces: `AppServiceRuntimeDriverRegistry.configuredName()`, `forNewInstance()`, and `forInstance(name)`.
- `AppServiceProcessManager` implements `AppServiceRuntimeDriver` with `name = 'pm2'`.

- [ ] **Step 1: Write failing registry and PM2 tests**

Cover:

```ts
expect(registry.configuredName()).toBe('pm2');
expect(registry.forInstance('pm2')).toBe(pm2Driver);
expect(() => registry.forInstance('unknown' as any)).toThrow('Unsupported service runtime driver');
expect(() => registry.forNewInstance()).toThrow('Production service runtime requires Podman isolation');
expect(pm2Driver.endpoint({ processName: 'agentstudio-app-demo-1-0-0', loopbackPort: 21000 }))
  .toEqual({ kind: 'tcp', port: 21000 });
```

The production assertion uses `app.env=production` and configured driver `pm2`.

- [ ] **Step 2: Run RED verification**

```powershell
pnpm.cmd test -- app-service-runtime-driver-registry.spec.ts app-service-process-manager.spec.ts --runInBand
```

Expected: FAIL because the registry and driver methods do not exist.

- [ ] **Step 3: Implement the registry and adapt PM2**

The registry constructor receives `ConfigService`, `AppServiceProcessManager`, and `PodmanAppServiceRuntimeDriver`. Driver-name parsing accepts only `pm2|podman`. `forNewInstance()` rejects production unless the name is `podman`; `forInstance()` routes strictly by the persisted name.

Move the current production rejection out of PM2's general configuration parser and retain it in `AppServiceProcessManager.start()` so historical PM2 instances can still be described, logged, stopped, and deleted during a production migration. New production starts remain blocked by the registry and PM2 driver.

- [ ] **Step 4: Run GREEN verification**

Run the Step 2 command. Expected: both suites PASS and existing fixed-argument PM2 assertions remain unchanged.

- [ ] **Step 5: Commit the task**

```powershell
git add server/src/module/app/services/app-service-runtime-driver-registry.ts server/src/module/app/services/app-service-runtime-driver-registry.spec.ts server/src/module/app/services/app-service-process-manager.ts server/src/module/app/services/app-service-process-manager.spec.ts server/src/module/app/app.module.ts
git commit -m "refactor(app): add pluggable runtime driver registry"
```

### Task 3: Rootless Podman Driver

**Files:**
- Create: `server/src/module/app/services/app-service-podman-runtime.driver.ts`
- Create: `server/src/module/app/services/app-service-podman-runtime.driver.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**
- Consumes: Task 1 contract and existing `AppServiceCommandRunner`, `AppServiceHostEnvironment`, and `AppServiceLogRedactor`.
- Produces: `PodmanAppServiceRuntimeDriver` with `name = 'podman'`.

- [ ] **Step 1: Write failing validation and command tests**

Test valid start arguments include:

```ts
expect(commandRunner.run).toHaveBeenCalledWith(
  'runuser',
  expect.arrayContaining([
    '-u', 'agentstudio_app', '--', '/usr/bin/podman', 'run', '--detach', '--replace',
    '--read-only', '--network=none', '--cap-drop=ALL',
    '--security-opt=no-new-privileges', '--pids-limit=64', '--memory=256M',
    '--cpus=1', '--user=65532:65532'
  ]),
  expect.objectContaining({ shell: false })
);
```

Add independent failures for Windows, root user, non-absolute paths, overlapping roots, non-digest images, image credentials, invalid command, invalid container UID, CPU outside `0.1..8`, PIDs outside `16..512`, tmpfs outside `8..256`, release escape, symlinked release, unexpected labels, image mismatch, duplicate inspect records, malformed JSON, and unmanaged names.

Test endpoint output exactly equals:

```ts
{
  kind: 'unix',
  socketPath: '/srv/agentstudio/sockets/agentstudio-app-demo-1-0-0/service.sock'
}
```

- [ ] **Step 2: Run RED verification**

```powershell
pnpm.cmd test -- app-service-podman-runtime.driver.spec.ts --runInBand
```

Expected: FAIL because the Podman driver does not exist.

- [ ] **Step 3: Implement strict Podman configuration**

Parse only these fields from `appMarketplace.serviceRuntime`: `user`, `rootDir`, `podmanCommand`, `podmanImage`, `podmanHome`, `podmanXdgRuntimeDir`, `socketDir`, `memoryMb`, `cpuLimit`, `pidsLimit`, `tmpfsMb`, and `containerUid`.

Image validation must require a value matching a credential-free repository reference ending in `@sha256:` plus exactly 64 lowercase hexadecimal characters.

- [ ] **Step 4: Implement fixed Podman lifecycle commands**

Use `runuser -u <user> -- <podman> ...` through `AppServiceCommandRunner`. Implement:

- `start`: remove only the platform-owned socket directory, create it, run the fixed restricted container, then `describe`;
- `describe`: parse one `podman inspect --format json <name>` record and optional bounded `podman stats --no-stream --format json <name>` metrics;
- `stop`: `podman stop --time 10 <name>`;
- `delete`: `podman rm --force <name>` and remove only the validated socket directory;
- `logs`: `podman logs --tail <1..200> <name>` and pass stdout/stderr through `AppServiceLogRedactor`.

The management environment is exactly:

```ts
{
  PATH: '/usr/local/bin:/usr/bin:/bin',
  HOME: podmanHome,
  XDG_RUNTIME_DIR: podmanXdgRuntimeDir,
  NODE_ENV: 'production'
}
```

- [ ] **Step 5: Run GREEN verification**

Run the Step 2 command. Expected: all Podman driver tests PASS.

- [ ] **Step 6: Commit the task**

```powershell
git add server/src/module/app/services/app-service-podman-runtime.driver.ts server/src/module/app/services/app-service-podman-runtime.driver.spec.ts server/src/module/app/app.module.ts
git commit -m "feat(app): add rootless podman runtime driver"
```

### Task 4: Unix Socket Service Host And Transport

**Files:**
- Modify: `server/src/module/app/runtime/app-service-host.ts`
- Modify: `server/src/module/app/services/app-service-loopback.transport.ts`
- Modify: `server/src/module/app/services/app-service-loopback.transport.spec.ts`

**Interfaces:**
- Consumes: `AppServiceRuntimeEndpoint` from Task 1.
- Produces: host support for exactly one of `APP_SERVICE_SOCKET` or `APP_SERVICE_PORT`.
- Produces: `health(endpoint, path)` and `invoke(endpoint, body)`.

- [ ] **Step 1: Write failing host-source and transport tests**

Assert generated host source contains `APP_SERVICE_SOCKET`, rejects both/neither endpoint variables, calls `server.listen(socketPath)` for Unix mode, and removes only its own socket during startup/shutdown.

Transport tests must prove:

```ts
await transport.invoke({ kind: 'unix', socketPath: validSocket }, { ping: true });
await transport.health({ kind: 'tcp', port: 21000 }, '/health');
```

Reject relative socket paths, socket paths outside `APP_SERVICE_SOCKET_DIR`, symbolic-link parents, non-socket targets, redirects, oversized bodies, malformed JSON, and timeout. Preserve pinned `127.0.0.1` behavior for TCP.

- [ ] **Step 2: Run RED verification**

```powershell
pnpm.cmd test -- app-service-loopback.transport.spec.ts --runInBand
```

Expected: FAIL because the host and transport support only ports.

- [ ] **Step 3: Implement dual endpoint host mode**

In generated host source:

```js
const socketPath = String(process.env.APP_SERVICE_SOCKET || '');
const port = Number(process.env.APP_SERVICE_PORT || 0);
if (Boolean(socketPath) === Boolean(port)) throw new Error('invalid_service_host_configuration');
```

Unix mode validates an absolute `/run/agentstudio/*.sock` path, removes an existing socket file only, listens on the socket, handles `SIGTERM`/`SIGINT`, closes the server, and removes its socket. TCP mode retains `127.0.0.1`.

- [ ] **Step 4: Implement endpoint-aware transport**

Use the persistent pinned TCP dispatcher for TCP. For Unix mode, validate the configured host path and use a short-lived Undici `Agent({ connect: { socketPath } })`, closing it in `finally`. Keep all existing timeout, size, redirect, header, and JSON rules.

- [ ] **Step 5: Run GREEN verification**

Run the Step 2 command. Expected: both suites PASS.

- [ ] **Step 6: Commit the task**

```powershell
git add server/src/module/app/runtime/app-service-host.ts server/src/module/app/services/app-service-loopback.transport.ts server/src/module/app/services/app-service-loopback.transport.spec.ts
git commit -m "feat(app): connect service runtimes over unix sockets"
```

### Task 5: Mixed-Driver Lifecycle Integration

**Files:**
- Modify: `server/src/module/app/services/app-service-runtime.service.ts`
- Modify: `server/src/module/app/services/app-service-runtime.service.spec.ts`
- Modify: `server/src/module/app/services/app-tenant.service.spec.ts`

**Interfaces:**
- Consumes: driver registry and endpoint-aware transport.
- Persists: `runtimeDriver` during candidate preparation.
- Exposes: sanitized `runtime_driver` in runtime instance responses.

- [ ] **Step 1: Write failing lifecycle tests**

Cover these behaviors separately:

1. a new candidate persists the configured driver before start;
2. start, stop, delete, describe, logs, health, invoke, and reconciliation use `registry.forInstance(instance.runtimeDriver)`;
3. PM2 and Podman instances can coexist in one reconciliation pass;
4. changing configured driver does not reroute an existing instance;
5. Podman health/invoke uses the Unix endpoint while PM2 uses TCP;
6. failed Podman candidate preserves the active PM2 instance;
7. rollback to a PM2 standby remains possible after Podman becomes configured;
8. API responses include only `runtime_driver`, never `socketPath`, image, command, env, release directory, or container ID.

- [ ] **Step 2: Run RED verification**

```powershell
pnpm.cmd test -- app-service-runtime.service.spec.ts app-tenant.service.spec.ts --runInBand
```

Expected: FAIL because lifecycle code calls the shared process manager directly and instances have no driver.

- [ ] **Step 3: Route lifecycle operations through persisted drivers**

Replace direct `processManager` calls with helpers equivalent to:

```ts
private driverFor(instance: AppServiceInstanceEntity) {
  return this.driverRegistry.forInstance(instance.runtimeDriver || 'pm2');
}

private endpointFor(instance: AppServiceInstanceEntity) {
  return this.driverFor(instance).endpoint({
    processName: instance.processName,
    loopbackPort: Number(instance.loopbackPort),
  });
}
```

Candidate preparation assigns `runtimeDriver: this.driverRegistry.configuredName()`. `processSpec()` adds validated `appCode` and `version`.

- [ ] **Step 4: Preserve lifecycle cleanup semantics**

All best-effort cleanup, candidate failure, publish, standby, rollback, reconcile, probe, tenant invocation, developer invocation, and logs must use the instance's persisted driver. Do not create a bulk migration or silently restart historical PM2 instances.

- [ ] **Step 5: Run GREEN verification**

Run the Step 2 command. Expected: both suites PASS.

- [ ] **Step 6: Commit the task**

```powershell
git add server/src/module/app/services/app-service-runtime.service.ts server/src/module/app/services/app-service-runtime.service.spec.ts server/src/module/app/services/app-tenant.service.spec.ts
git commit -m "feat(app): route service lifecycle by runtime driver"
```

### Task 6: Configuration, Validation, And Runtime Console

**Files:**
- Modify: `server/src/config/configuration.ts`
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/src/config/configuration.spec.ts`
- Modify: `web/src/api/app-service-runtime.ts`
- Modify: `web/src/views/app-platform/runtime/index.vue`
- Modify: `web/src/views/app-platform/runtime/runtime-display.ts`
- Modify: `web/scripts/verify-app-service-runtime-readiness.ts`

**Interfaces:**
- Adds the exact environment keys from the approved specification.
- Adds `runtime_driver: 'pm2' | 'podman'` to the sanitized frontend record.

- [ ] **Step 1: Write failing configuration and readiness tests**

Backend tests require defaults for driver/resource bounds and reject invalid values. Production plus enabled PM2 must fail validation or runtime readiness; enabled Podman requires absolute command/home/XDG/socket paths and a digest image.

Frontend readiness must require a driver column/tag and forbid rendering `socket_path`, `container_id`, `podman_home`, `image`, `command`, `environment`, and `release_dir`.

- [ ] **Step 2: Run RED verification**

```powershell
pnpm.cmd test -- configuration.spec.ts --runInBand
pnpm.cmd run verify:app-service-runtime-readiness
```

Expected: backend and frontend checks FAIL because the new contract is absent.

- [ ] **Step 3: Add bounded configuration**

Map:

```ts
driver: process.env.APP_SERVICE_RUNTIME_DRIVER ?? 'pm2',
podmanCommand: process.env.APP_SERVICE_PODMAN_COMMAND ?? '/usr/bin/podman',
podmanImage: process.env.APP_SERVICE_PODMAN_IMAGE ?? '',
podmanHome: process.env.APP_SERVICE_PODMAN_HOME ?? '',
podmanXdgRuntimeDir: process.env.APP_SERVICE_PODMAN_XDG_RUNTIME_DIR ?? '',
socketDir: process.env.APP_SERVICE_SOCKET_DIR ?? '',
cpuLimit: Number(process.env.APP_SERVICE_CPU_LIMIT ?? 1),
pidsLimit: Number(process.env.APP_SERVICE_PIDS_LIMIT ?? 64),
tmpfsMb: Number(process.env.APP_SERVICE_TMPFS_MB ?? 16),
containerUid: Number(process.env.APP_SERVICE_CONTAINER_UID ?? 65532),
```

Joi accepts only the specified enums/ranges and never logs values.

- [ ] **Step 4: Add sanitized UI support**

Display `Podman` or `PM2` as a compact tag in desktop and mobile runtime rows. No host or container implementation detail is displayed.

- [ ] **Step 5: Run GREEN verification**

Run the Step 2 commands. Expected: both PASS.

- [ ] **Step 6: Commit the task**

```powershell
git add server/src/config/configuration.ts server/src/config/env.validation.ts server/src/config/configuration.spec.ts web/src/api/app-service-runtime.ts web/src/views/app-platform/runtime/index.vue web/src/views/app-platform/runtime/runtime-display.ts web/scripts/verify-app-service-runtime-readiness.ts
git commit -m "feat(app): configure podman service runtimes"
```

### Task 7: Podman Deployment And Live-E2E Contracts

**Files:**
- Modify: `server/package.json`
- Modify: `server/scripts/verify-app-service-runtime-live-e2e-contract.ts`
- Modify: `server/scripts/verify-app-service-runtime-live-e2e.ts`
- Modify: `docs/deployment/app-service-runtime-baota.md`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Extends the existing service-runtime live gate rather than creating a second lifecycle implementation.
- Uses protected `APP_SERVICE_E2E_PODMAN_*` inputs without printing values.

- [ ] **Step 1: Write failing contract assertions**

Require the live script to validate Linux, rootless Podman, dedicated non-root user, empty Podman home/XDG/socket/release roots, digest-pinned image, non-production generated database, isolated non-zero empty Redis, and cleanup ownership labels.

Require assertions for `--network=none`, read-only root, non-root UID, no capabilities, no privilege escalation, bounded resources, Unix socket invocation, failed-candidate preservation, publish, standby, rollback, crash reconciliation, redacted logs, and zero residue.

- [ ] **Step 2: Run RED verification**

```powershell
pnpm.cmd run verify:app-service-runtime-live-e2e-contract
```

Expected: FAIL because the contract still describes PM2-only isolation.

- [ ] **Step 3: Extend the disposable live script**

The script must parse and refuse unsafe inputs before creating resources. It may run only fixed `podman` inspection commands and the application APIs. Cleanup must remove only containers carrying the generated run label, generated socket/release directories, leased Redis keys, and generated MySQL database.

Do not run the live script on Windows. On Windows, verify only syntax and contract behavior.

- [ ] **Step 4: Rewrite Baota rollout documentation**

Document backup, Podman installation, dedicated non-login user, `/etc/subuid` and `/etc/subgid`, rootless storage, XDG runtime persistence, socket/release ownership, digest image preload, disabled-first migration, canary, 15-minute observation, rollback, emergency stop, image upgrade, and secret-safe diagnostics.

- [ ] **Step 5: Run GREEN contract verification**

```powershell
pnpm.cmd run verify:app-service-runtime-live-e2e-contract
```

Expected: PASS without creating MySQL, Redis, Podman, release, or socket resources.

- [ ] **Step 6: Commit the task**

```powershell
git add server/package.json server/scripts/verify-app-service-runtime-live-e2e-contract.ts server/scripts/verify-app-service-runtime-live-e2e.ts docs/deployment/app-service-runtime-baota.md docs/saas-launch-readiness-checklist.md
git commit -m "docs(app): operationalize podman runtime rollout"
```

### Task 8: Review, Verification, And Release Commit

**Files:**
- Review every file listed in the File Map.
- No unrelated refactors or generated artifacts.

**Interfaces:**
- Produces a reviewed, committed, and pushed P0 runtime-isolation phase.

- [ ] **Step 1: Run focused backend suites**

```powershell
pnpm.cmd test -- add-app-service-runtime-driver.spec.ts app-service-runtime-driver-registry.spec.ts app-service-process-manager.spec.ts app-service-podman-runtime.driver.spec.ts app-service-loopback.transport.spec.ts app-service-runtime.service.spec.ts app-tenant.service.spec.ts app-developer.service.spec.ts app-service-platform.controller.spec.ts --runInBand --forceExit
```

Expected: all selected suites PASS with zero failed tests.

- [ ] **Step 2: Run readiness and build gates**

```powershell
pnpm.cmd run build
pnpm.cmd run verify:app-service-runtime-live-e2e-contract
```

Run in `server`, then run in `web`:

```powershell
pnpm.cmd run verify:app-service-runtime-readiness
pnpm.cmd run verify:app-developer-service-readiness
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run build
```

Expected: every command exits `0`.

- [ ] **Step 3: Run repository aggregate readiness**

```powershell
node scripts/run-saas-readiness.cjs
```

Run from the repository root. Expected: frontend readiness/build/preview/browser smoke and backend readiness/build all PASS.

- [ ] **Step 4: Perform manual security review**

Inspect the staged diff and confirm:

- production PM2 start is impossible;
- Podman image is digest-pinned;
- no shell or parent environment is used;
- commands, names, mounts, labels, endpoints, and paths are platform-generated and validated;
- no host network or Podman socket enters a container;
- every runtime operation routes by persisted driver;
- response/log allowlists expose no sensitive implementation details;
- cleanup cannot target an unmanaged container or path.

- [ ] **Step 5: Run final hygiene checks**

```powershell
git diff --check
git status --short
git diff --stat
```

Run the repository's high-confidence credential-pattern scan against the staged diff. Expected: no sensitive files or high-confidence credentials.

- [ ] **Step 6: Create the final integration commit if review fixes changed files**

```powershell
git add server/src server/scripts server/package.json web/src web/scripts docs/deployment docs/saas-launch-readiness-checklist.md
git commit -m "fix(app): harden podman runtime isolation"
```

Skip this commit only if all implementation work is already cleanly committed and no review fix was needed.

- [ ] **Step 7: Push safely**

```powershell
git fetch maheshenga main
git merge-base --is-ancestor maheshenga/main main
git push maheshenga main:main
```

If HTTPS fails with the known local libcurl DNS-thread issue, use the configured GitHub SSH transport without changing history. Never force push. Verify `refs/heads/main` equals local `HEAD` after the push.

## Plan Self-Review

- Every acceptance criterion in the approved specification maps to Tasks 1-8.
- Existing PM2 cleanup compatibility is explicit in Tasks 2 and 5.
- Production Podman isolation, Unix transport, persistence, UI sanitization, deployment, and live-contract coverage are each independently testable.
- No task requires a user-controlled command, container image, mount, environment variable, host path, or network policy.
- The plan contains no deferred implementation placeholder.

## Execution Mode

Execute inline in the current session. The user previously requested no multi-agent execution, and the tasks share a tightly coupled runtime contract that benefits from sequential RED/GREEN checkpoints.
