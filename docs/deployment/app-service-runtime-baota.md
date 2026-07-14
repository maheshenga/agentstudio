# Rootless Podman Service Runtime On Baota

This guide deploys the reviewed service-application runtime beside the NestJS project managed by Baota. Production execution uses one rootless Podman container per application version and communicates with NestJS only through a Unix socket.

## Security Boundary

- Keep `APP_SERVICE_RUNTIME_ENABLED=false` until backup, migration, image preload, canary, rollback, and observation gates pass.
- The dedicated non-login user is never `root` and does not own the NestJS source tree.
- The platform chooses the digest-pinned image, command, UID, environment, mounts, and container name.
- Every container uses `--network=none`, a read-only root filesystem, no Linux capabilities, no privilege escalation, bounded CPU/memory/PIDs, and a bounded `/tmp`.
- Release files are mounted read-only. Only a per-container Unix socket directory and `/tmp` are writable.
- The Podman or Docker daemon socket is never mounted.
- PM2 remains available only for development and cleanup of historical instances. New production candidates require Podman.

## Backup First

Before changing the Baota project:

1. Keep the feature flag disabled and enter the normal maintenance window.
2. Create a MySQL backup through Baota or an interactive/protected `mysqldump` client configuration. Do not put credentials on the command line.
3. Back up the current backend release, frontend release, Baota Node project settings, Nginx configuration, and environment-name inventory.
4. Record the current application commit, database migration state, and active service versions.
5. Verify that database and application rollback procedures are usable before continuing.

Never copy `.env`, SSH keys, payment keys, database credentials, Redis credentials, Baota session files, or deployment credentials into a release, image build context, or support ticket.

## Podman And User Setup

Install the distribution-supported Podman package from the Baota terminal. Create a dedicated non-login user and allocate subordinate IDs. The numeric ranges must be unused on the host.

```bash
useradd --system --shell /usr/sbin/nologin --home-dir /www/server/agentstudio-app agentstudio_app
usermod --add-subuids 200000-265535 agentstudio_app
usermod --add-subgids 200000-265535 agentstudio_app
loginctl enable-linger agentstudio_app
```

Confirm that `/etc/subuid` and `/etc/subgid` each contain the expected `agentstudio_app` allocation. Obtain the runtime UID with `id -u agentstudio_app`; do not guess it. Ensure the user manager and `/run/user/<uid>` exist after boot.

Create the roots with the actual Baota Node process owner in place of `www` when necessary:

```bash
install -d -o www -g www -m 0755 /www/wwwroot/agentstudio-plugins
install -d -o agentstudio_app -g agentstudio_app -m 0700 /www/server/agentstudio-app
install -d -o agentstudio_app -g agentstudio_app -m 0700 /www/server/agentstudio-app/sockets
install -d -o agentstudio_app -g agentstudio_app -m 0700 /run/user/<uid>
```

The NestJS owner writes immutable releases below `/www/wwwroot/agentstudio-plugins`. Every release directory and required file must share that owner and must not be group/world writable. The runtime user receives read and execute access, never write access, to releases.

Verify rootless Podman without displaying environment contents:

```bash
runuser -u agentstudio_app -- env HOME=/www/server/agentstudio-app XDG_RUNTIME_DIR=/run/user/<uid> /usr/bin/podman info --format json
runuser -u agentstudio_app -- env HOME=/www/server/agentstudio-app XDG_RUNTIME_DIR=/run/user/<uid> /usr/bin/podman --version
```

The info output must report rootless operation. Stop if it reports rootful mode, missing subordinate IDs, an unavailable XDG runtime, or a storage permission error.

## Runtime Image

Build the platform-owned Node runtime image from a reviewed build context. Developer packages never choose or extend this image. Preload it as `agentstudio_app`, then record the immutable repository digest:

```bash
runuser -u agentstudio_app -- env HOME=/www/server/agentstudio-app XDG_RUNTIME_DIR=/run/user/<uid> /usr/bin/podman pull <approved-image-by-digest>
runuser -u agentstudio_app -- env HOME=/www/server/agentstudio-app XDG_RUNTIME_DIR=/run/user/<uid> /usr/bin/podman image inspect <approved-image-by-digest>
```

Use a reference ending in `@sha256:` followed by 64 lowercase hexadecimal characters. Tags alone, credentials in image references, and runtime pulls are forbidden. The platform starts containers with `--pull=never`.

## Baota Environment

Set these names in Baota's protected Node project environment editor. Do not paste values into shell history or source-controlled files.

```text
APP_SERVICE_RUNTIME_ENABLED=false
APP_SERVICE_RUNTIME_DRIVER=podman
APP_SERVICE_RUNTIME_DIR=/www/wwwroot/agentstudio-plugins
APP_SERVICE_RUNTIME_USER=agentstudio_app
APP_SERVICE_PODMAN_COMMAND=/usr/bin/podman
APP_SERVICE_PODMAN_IMAGE=<approved-image-by-digest>
APP_SERVICE_PODMAN_HOME=/www/server/agentstudio-app
APP_SERVICE_PODMAN_XDG_RUNTIME_DIR=/run/user/<uid>
APP_SERVICE_SOCKET_DIR=/www/server/agentstudio-app/sockets
APP_SERVICE_MEMORY_MB=256
APP_SERVICE_CPU_LIMIT=1
APP_SERVICE_PIDS_LIMIT=64
APP_SERVICE_TMPFS_MB=16
APP_SERVICE_CONTAINER_UID=65532
APP_SERVICE_REQUEST_TIMEOUT_MS=15000
APP_SERVICE_MAX_BODY_MB=2
APP_SERVICE_HEALTH_SUCCESS_COUNT=3
APP_SERVICE_PORT_MIN=20000
APP_SERVICE_PORT_MAX=39999
```

The port range remains database-compatible for historical PM2 rows but is not exposed by Podman containers. Do not add it to Nginx, Baota security rules, or cloud security groups.

## Disabled-First Migration

1. Run `pnpm.cmd run migration:show` and `pnpm.cmd run migration:run` from `server` while the feature flag is disabled.
2. Confirm the runtime-driver migration `1760000000052-AddAppServiceRuntimeDriver` is applied and existing rows remain `pm2`.
3. Build the backend and frontend and restart the Baota Node project with the feature flag still disabled.
4. Run `pnpm.cmd run verify:app-service-runtime-live-e2e-contract` in the release.
5. On a disposable Linux environment, run the protected Live E2E gate described in the launch checklist.
6. Confirm NestJS, MySQL, Redis, Nginx, and existing tenant flows are healthy before enabling service candidates.

## Canary And Observation

1. Set `APP_SERVICE_RUNTIME_ENABLED=true` and restart only the NestJS project.
2. Upload one reviewed canary service package. Require scan success and approval by a different platform operator.
3. Start the canary candidate and require three consecutive healthy Unix socket checks.
4. Confirm the runtime console shows `Podman`, then run one bounded probe and inspect only redacted logs.
5. Inspect the owned container read-only and confirm `network=none`, read-only root, UID `65532`, no capabilities, no privilege escalation, and configured resource bounds.
6. Publish only while the previous healthy version remains available as standby.
7. Run rollback once, then republish the canary through the normal candidate workflow.
8. Complete a 15-minute observation window covering NestJS health, container restart count, memory, CPU, diagnostics, MySQL, Redis, and Nginx errors.

If candidate start or health fails, the active instance must remain unchanged. Stop the candidate with an audit reason and investigate without enabling shell access inside the container.

## Secret-Safe Inspection

Prefer the Service Runtime console. Host-level inspection is read-only and always runs under the runtime user:

```bash
runuser -u agentstudio_app -- env HOME=/www/server/agentstudio-app XDG_RUNTIME_DIR=/run/user/<uid> /usr/bin/podman ps --all --filter label=io.agentstudio.managed=true
runuser -u agentstudio_app -- env HOME=/www/server/agentstudio-app XDG_RUNTIME_DIR=/run/user/<uid> /usr/bin/podman inspect <platform-generated-container-name>
```

Before any stop or removal, verify the generated name plus `io.agentstudio.managed`, `io.agentstudio.app-code`, `io.agentstudio.version`, and `io.agentstudio.runtime-image` labels. Never paste raw inspect output, application logs, host paths, or environment output into tickets.

## Rollback

Use the Service Runtime rollback action only for a healthy standby. The instance's persisted driver decides whether a historical PM2 process or Podman container is contacted. Changing the configured driver never reroutes an existing instance.

After rollback, verify the active version through a bounded probe and complete another 15-minute observation window. If the application release itself must be rolled back, disable the runtime first, restore the previous Baota release and database backup, run migration checks, and restart with the feature flag disabled.

## Emergency Stop

1. Set `APP_SERVICE_RUNTIME_ENABLED=false` and restart NestJS so management and probe endpoints fail closed.
2. List containers by `io.agentstudio.managed=true` and verify every ownership label before acting.
3. Stop or remove only the exact platform-generated container names approved by incident response.
4. Confirm no owned Unix socket remains below the configured socket root.
5. Preserve immutable releases and bounded redacted evidence unless incident response authorizes removal.
6. Do not remove unrelated containers, shared Podman storage, the NestJS project, MySQL data, Redis data, Baota configuration, or Nginx configuration.

Re-enable only after the cause is understood, affected packages are reviewed again, the canary passes, and rollback readiness is restored.

## Image Upgrade

1. Build and preload the new image by digest while the current image remains available.
2. Run its disposable Live E2E gate and record the resulting digest without recording registry credentials.
3. Update only `APP_SERVICE_PODMAN_IMAGE` and restart NestJS. New candidates use the new digest.
4. Existing containers remain manageable because each carries an immutable runtime-image label that must match its actual digest.
5. Replace old versions through the normal candidate, health, publish, standby, and rollback lifecycle. Do not bulk-restart containers.
6. Remove an old image only after no active, candidate, standby, or retained rollback container references its digest and the normal rollback window has expired.
