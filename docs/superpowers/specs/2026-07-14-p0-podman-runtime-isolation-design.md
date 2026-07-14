# P0 Podman Service Runtime Isolation Design

## Status

Approved on 2026-07-14.

This design amends the approved hybrid application-platform design for production service execution. The marketplace, review, tenant installation, capability, analytics, and commerce models remain unchanged. Only the service process and host-transport boundary becomes pluggable.

## Goal

Provide a maintainable production runtime for reviewed service applications in which every version runs in its own rootless container with an immutable release, no direct network, bounded resources, and a Unix-domain-socket control plane.

## Problem

The current service runtime uses one configured Linux user and one PM2 home for all application processes. It is appropriate for local development and controlled non-production verification, but it is not a sufficient production boundary for third-party or semi-trusted code. The current implementation therefore fails closed whenever `app.env` is `production`.

The replacement must preserve the existing candidate, health-check, publish, standby, rollback, reconciliation, log, and audit behavior. It must also allow future runtime implementations without coupling application lifecycle code to Podman commands.

## Scope

### Included

- a stable `AppServiceRuntimeDriver` interface;
- the existing PM2 implementation as a development-compatible driver;
- a Rootless Podman production driver;
- a Unix-domain-socket service-host transport;
- immutable image and release validation;
- CPU, memory, process, filesystem, and network restrictions;
- persisted runtime-driver identity for every service instance;
- candidate start, health check, publish, rollback, stop, delete, inspect, logs, and reconciliation through the selected driver;
- disabled-by-default configuration and production fail-closed checks;
- migration, unit, contract, readiness, deployment, and disposable Linux live-E2E coverage.

### Excluded

- building application dependencies on the production host;
- Docker daemon access;
- Kubernetes orchestration;
- arbitrary container images supplied by developers;
- direct application access to the host network, platform database, Redis, `.env`, payment credentials, or host filesystem;
- Python, PHP, Java, native binaries, package lifecycle scripts, and application-controlled shell commands;
- automatic migration of plugin-owned business data;
- changing tenant installation, licensing, capability-consent, or payment semantics.

## Architecture

```text
AppServiceRuntimeService
        |
        v
AppServiceRuntimeDriverRegistry
        |
        +-- Pm2AppServiceRuntimeDriver      development and legacy cleanup
        |
        +-- PodmanAppServiceRuntimeDriver   production
                         |
                         v
              rootless container per version
                         |
                         v
              Unix socket under socket root
                         |
                         v
              AppServiceSocketTransport
```

`AppServiceRuntimeService` remains the owner of desired state, database transitions, candidate health thresholds, publication, rollback, and reconciliation. Runtime drivers only manage one process/container and return a normalized snapshot.

## Runtime Driver Contract

The runtime layer introduces these types:

```ts
export type AppServiceRuntimeDriverName = 'pm2' | 'podman';

export interface AppServiceRuntimeEndpoint {
  kind: 'tcp' | 'unix';
  port?: number;
  socketPath?: string;
}

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
  abstract endpoint(spec: Pick<AppServiceRuntimeSpec, 'processName' | 'loopbackPort'>): AppServiceRuntimeEndpoint;
}
```

The registry resolves a driver by the instance's persisted `runtime_driver`. New instances use the configured driver. Existing rows default to `pm2`, so rollback and cleanup continue to target their original runtime after deployment.

## Configuration

The following configuration is added:

```text
APP_SERVICE_RUNTIME_DRIVER=pm2|podman
APP_SERVICE_PODMAN_COMMAND=/usr/bin/podman
APP_SERVICE_PODMAN_IMAGE=registry.example/agentstudio-service-runtime@sha256:<64 hex>
APP_SERVICE_PODMAN_HOME=/www/server/agentstudio-app
APP_SERVICE_PODMAN_XDG_RUNTIME_DIR=/run/user/<runtime uid>
APP_SERVICE_SOCKET_DIR=/www/server/agentstudio-app/sockets
APP_SERVICE_CPU_LIMIT=1
APP_SERVICE_PIDS_LIMIT=64
APP_SERVICE_TMPFS_MB=16
APP_SERVICE_CONTAINER_UID=65532
```

All feature flags remain disabled by default. `APP_SERVICE_RUNTIME_ENABLED=true` in production is accepted only when the configured driver is `podman` and every Podman-specific value passes validation. `pm2` remains rejected in production.

The image must use a digest reference. Tags without a digest, whitespace, credentials, shell metacharacters, or an invalid repository path are rejected. The command and all runtime paths must be absolute. Socket, release, Podman home, and XDG paths must be outside the repository and must not overlap each other incorrectly.

## Podman Execution Model

The platform runs Podman through the existing allowlisted `execFile` command runner:

```text
runuser -u <runtime-user> -- <podman-command> <fixed platform-generated arguments>
```

No shell is used. Request data, manifest values, developer values, environment values, or application source never become command names or free-form arguments.

Every candidate container uses platform-generated arguments equivalent to:

```text
run --detach --replace
--name <platform-generated-name>
--label io.agentstudio.managed=true
--label io.agentstudio.app-code=<validated-code>
--label io.agentstudio.version=<validated-version>
--read-only
--network=none
--cap-drop=ALL
--security-opt=no-new-privileges
--pids-limit=<bounded-value>
--memory=<bounded-value>M
--cpus=<bounded-value>
--user=<bounded-container-uid>:<bounded-container-uid>
--tmpfs /tmp:rw,noexec,nosuid,nodev,size=<bounded-value>m
--volume <release-dir>:/app:ro
--volume <per-process-socket-dir>:/run/agentstudio:rw,U
--env APP_SERVICE_SOCKET=/run/agentstudio/service.sock
--env APP_SERVICE_ENTRY=/app/dist/index.js
--env APP_SERVICE_HEALTH_PATH=<validated-path>
<digest-pinned-runtime-image>
node /app/agentstudio-host.cjs
```

The production driver does not pass the parent environment. Its management environment is restricted to `PATH`, `HOME`, `XDG_RUNTIME_DIR`, and `NODE_ENV`. The application environment is restricted to the three `APP_SERVICE_*` values shown above.

The driver accepts only containers carrying the exact managed labels and expected generated name. Duplicate names, unexpected labels, malformed inspect output, multiple matches, or an image digest mismatch fail closed.

## Unix Socket Transport

The generated service host accepts exactly one endpoint mode:

- `APP_SERVICE_SOCKET` creates a Unix HTTP server and removes only its own stale socket before listening;
- `APP_SERVICE_PORT` retains the existing loopback TCP mode for PM2 development;
- setting both or neither is invalid.

The Podman driver derives the host socket path from the configured socket root and validated process name. It does not accept a path from an application manifest or request. Before use, the host validates that the socket directory is under the configured root, has no symbolic-link path segment, and is not group/world writable after Podman ownership preparation.

`AppServiceLoopbackTransport` becomes endpoint-aware. TCP keeps the existing pinned `127.0.0.1` behavior. Unix requests use an Undici dispatcher configured with the validated socket path. Request limits, response limits, timeout behavior, redirect rejection, JSON parsing, and response-header allowlisting stay identical across both transports.

## Persistence And Migration

`app_service_instance` gains:

```text
runtime_driver varchar(20) NOT NULL DEFAULT 'pm2'
```

The migration preserves every existing row as `pm2` and adds an index on `(runtime_driver, process_status)`. Rollback removes only the new index and column. No release, process, order, license, capability, or tenant data is modified.

The entity and sanitized platform response expose `runtime_driver` as `pm2` or `podman`; they never expose Podman home, XDG directory, socket path, container image, container ID, release path, environment, command line, or raw inspect output.

## Lifecycle Behavior

1. Upload, scan, independent approval, and immutable review evidence remain unchanged.
2. Candidate preparation persists an instance with the currently configured runtime driver.
3. The registry starts the candidate through that driver.
4. Health checks use the driver's endpoint.
5. Publication switches database roles only after the candidate is healthy.
6. The old active instance becomes standby and remains addressable through its persisted driver.
7. Rollback verifies the standby through its driver before switching roles.
8. Reconciliation describes, restarts, or marks failed each instance through its persisted driver.
9. Cleanup deletes only a validated, platform-managed process/container and its own socket directory.

Changing the configured driver affects only newly prepared candidates. It does not silently migrate running instances. A later explicit migration workflow may replace an old PM2 version with a reviewed Podman candidate through the normal release process.

## Failure Handling

- Missing Podman, invalid rootless state, invalid image, invalid paths, malformed CLI output, or permission failures return a sanitized service-unavailable error.
- Candidate failure preserves the active instance and records a bounded failure code.
- Socket timeout or malformed service response participates in existing health and circuit behavior.
- Database failure after a container starts triggers best-effort container and socket cleanup.
- Container cleanup failure is recorded for reconciliation and never causes an unrelated process to be removed.
- Logs are bounded and passed through the existing application-service redactor before persistence or API output.

## Security Invariants

- production service execution uses only the Podman driver;
- the Podman daemon socket is never mounted;
- the container has no network namespace connectivity;
- the release and root filesystem are read-only;
- no Linux capability is retained and privilege escalation is disabled;
- only the per-container socket directory and bounded `/tmp` are writable;
- the runtime image is platform-owned and digest-pinned;
- application code cannot choose an image, command, mount, user, network, environment variable, socket, or host path;
- no platform credential enters the container;
- all platform actions continue through capability-authorized NestJS gateways;
- driver inspect and log output is treated as untrusted input and sanitized.

## Observability

Normalized runtime snapshots retain process status, PID when available, restart count, memory, and CPU. Podman-specific diagnostics use bounded codes such as `container_missing`, `container_unhealthy`, `image_mismatch`, `socket_unavailable`, and `runtime_command_failed`.

The runtime console may display the driver name and normalized status. It must not display container IDs, host paths, image registry credentials, raw labels, raw command output, or environment values.

## Testing

### Unit And Contract

- registry selection and persisted-driver routing;
- production rejection of PM2 and acceptance of valid Podman configuration;
- exact Podman command construction with no shell and allowlisted environment;
- image digest, path, name, label, resource, and user validation;
- malformed or ambiguous Podman inspect output rejection;
- Unix host mode and mutually exclusive endpoint configuration;
- Unix transport request/response bounds, timeouts, redirects, and JSON failures;
- lifecycle start, health, publish, rollback, reconciliation, and cleanup through mixed PM2/Podman instances;
- migration up/down and existing-row compatibility;
- secret, path, environment, and raw-command response prohibitions.

### Disposable Linux Live E2E

The live gate runs only on Linux with an explicitly isolated MySQL database, non-zero empty Redis database, dedicated non-root runtime user, empty Podman home, empty XDG runtime directory, empty socket root, empty release root, and a preloaded digest-pinned runtime image. It refuses production-like database names and non-empty resources.

The gate proves candidate start, Unix health, invocation, no network, read-only filesystem, non-root identity, bounded resources, failed candidate preservation, publish, standby, rollback, crash reconciliation, bounded redacted logs, signal cleanup, and zero owned container/socket/database/Redis/release residue.

### Repository Gates

The implementation must keep these gates green:

- focused runtime Jest suites and migration specs;
- backend build;
- frontend service-runtime readiness;
- marketplace and capability-runtime regressions;
- Podman live-E2E contract on Windows;
- disposable Podman live E2E on an eligible Linux host before production enablement;
- repository aggregate SaaS readiness.

## Deployment And Upgrade

Baota deployment provisions one dedicated non-login rootless Podman user, subordinate UID/GID ranges, Podman storage, XDG runtime directory, release root, socket root, and the digest-pinned runtime image. Production starts with all runtime flags disabled, applies the migration, verifies Podman rootless health, enables runtime for one platform-owned canary, observes it for at least 15 minutes, verifies rollback, and only then enables certified-developer service submissions.

Runtime-image upgrades use a new digest. Existing containers continue with the old digest until a reviewed application version is released or explicitly recycled. This keeps platform upgrades reversible and avoids changing running application code implicitly.

## Acceptance Criteria

The P0 phase is complete when:

1. production configuration cannot select PM2;
2. every new production service instance persists `runtime_driver=podman`;
3. every candidate runs in an individually named rootless container with the stated restrictions;
4. NestJS communicates only through a validated per-container Unix socket;
5. candidate failure, publication, standby, rollback, and reconciliation retain existing semantics;
6. mixed historical PM2 and new Podman instances are managed by their persisted drivers;
7. no API or log leaks runtime paths, image details, commands, environment, credentials, or source;
8. unit, contract, build, readiness, and eligible Linux live-E2E gates pass;
9. Baota backup, rollout, canary, observation, rollback, and emergency-stop procedures are documented.
