# Certified Developer Service Runtime On Baota

This guide rolls out the P11 certified developer service path on top of the existing P10 administrator runtime. Keep all P11 feature flags disabled until the database, reviewer, runtime, network, and rollback checks are complete.

## Security Boundary

- Uploaded developer code is never imported by NestJS and runs only through the external low-privilege host process.
- Continue using the dedicated non-login plugin user, isolated PM2 home, immutable release directories, and fixed `runuser` command boundary from P10.
- Service processes use a loopback-only listener; do not publish the service port range through Nginx, Baota security rules, or the cloud security group.
- The plugin user must not reach cloud metadata, MySQL, Redis, Baota, the administrator API, or public networks.
- Manual package approval and candidate review require two reviewers. Neither reviewer may be the submitting developer.
- Developer observability exposes only owned health labels, payload-free metrics, and bounded redacted logs.

## Runtime User And Directories

Use the existing P10 dedicated non-login plugin user unless the production architecture assigns a separate P11 account. Configure the account, release root, and isolated process-manager home only through `APP_SERVICE_RUNTIME_USER`, `APP_SERVICE_RUNTIME_DIR`, and `APP_SERVICE_PM2_HOME`.

Verify that the configured user can read approved releases, write only to the isolated process-manager home, and execute the configured process manager. Record pass/fail evidence only; do not print resolved paths, commands, identities, or environment contents.

Never copy `.env`, SSH keys, payment keys, database credentials, Redis credentials, Baota session data, source archives, or deployment credentials into the runtime root.

## Baota Environment

Configure values only in the protected Baota Node project environment editor. Keep `APP_SERVICE_RUNTIME_ENABLED`, `APP_DEVELOPER_SERVICE_ENABLED`, `APP_RUNTIME_CAPABILITIES_ENABLED`, and `APP_RUNTIME_IFRAME_LAUNCH_ENABLED` disabled during migration and initial restart.

Review these bounded settings before enablement:

```text
APP_SERVICE_RUNTIME_DIR
APP_SERVICE_RUNTIME_USER
APP_SERVICE_PM2_HOME
APP_SERVICE_PM2_COMMAND
APP_SERVICE_RUNTIME_INTERPRETER
APP_SERVICE_MEMORY_MB
APP_SERVICE_PORT_MIN
APP_SERVICE_PORT_MAX
APP_SERVICE_HEALTH_SUCCESS_COUNT
APP_DEVELOPER_SERVICE_CONCURRENCY
APP_DEVELOPER_SERVICE_RATE_PER_MINUTE
APP_DEVELOPER_SERVICE_CIRCUIT_FAILURES
APP_DEVELOPER_SERVICE_CIRCUIT_OPEN_SECONDS
APP_DEVELOPER_SERVICE_LOG_RETENTION_DAYS
```

The production default is seven-day retention for payload-free invocation rows. Confirm the scheduled cleanup and database index health before increasing traffic.

## Host Firewall

- Allow health and invocation traffic only through the loopback-only boundary.
- Deny IPv4 and IPv6 metadata destinations.
- Deny MySQL, Redis, Baota panel ports, administrator HTTP ports, private control-plane networks, and all public egress for the plugin user UID.
- Do not expose the configured service port range through Nginx or any external firewall rule.

## Backup And Migration

1. Keep all P11 feature flags disabled.
2. Enter the normal maintenance window and pause application package review changes.
3. Create a MySQL backup through Baota or a protected interactive client configuration. Do not place a password in command history.
4. Back up the current NestJS/frontend release and Baota process configuration.
5. Run `pnpm.cmd run migration:show`, then `pnpm.cmd run migration:run` from `server`.
6. Confirm migrations `1760000000042-CreateCertifiedDeveloperServiceRuntime` and `1760000000043-SeedCertifiedDeveloperServiceMenus` are applied.
7. Run the deterministic P11 gates and confirm the two platform reviewer accounts have the required certification, review, runtime, and publish permissions.
8. Restart the Baota Node project with all P11 flags still disabled.

## Staged Enablement

1. Enable `APP_SERVICE_RUNTIME_ENABLED` and verify the existing P10 administrator service probe remains healthy.
2. Enable `APP_RUNTIME_CAPABILITIES_ENABLED` and `APP_RUNTIME_IFRAME_LAUNCH_ENABLED`; verify existing P9 runtime context and capability smoke flows.
3. Enable `APP_DEVELOPER_SERVICE_ENABLED` for the platform process.
4. Certify one internal developer for `service`, require reviewer one to approve the immutable package snapshot, and require reviewer two to start the candidate.
5. Observe candidate health, PM2 restarts, memory, scan findings, snapshot hash, circuit state, and bounded logs before publishing.
6. Install the target service and one declared caller for a single internal tenant. Confirm undeclared and foreign-tenant calls fail closed.
7. Observe success rate, rejected counts, p95 latency, rate limits, circuit behavior, and seven-day retention for at least 15 minutes.
8. Expand tenant access only after the first observation window is clean.

## Inspection

Use the platform certification/runtime pages and developer-owned observability page first. Host-level read-only inspection must use the configured low-privilege runtime identity and isolated process-manager home, and must be limited to process inventory plus bounded logs for platform-generated process identities.

Do not paste unredacted PM2 output, request payloads, tenant context, or environment data into tickets.

## Rollback

1. Disable `APP_DEVELOPER_SERVICE_ENABLED` and restart NestJS to deny new developer service transitions and calls.
2. If runtime capability traffic must also stop, disable `APP_RUNTIME_CAPABILITIES_ENABLED` and restart NestJS.
3. Keep `APP_SERVICE_RUNTIME_ENABLED` enabled when P10 administrator services must remain available; otherwise use the P10 emergency stop procedure.
4. Stop affected developer-owned processes by platform-generated name, preserving logs and immutable releases for review.
5. Restore the previous application release. Revert database migrations only after restoring the matching database backup.
6. Confirm no tenant can invoke the affected service, P10 probes still match the intended rollback scope, and Redis quota/circuit keys expire or are removed through the approved operation.
7. Repeat the 15-minute observation window before re-enabling any P11 feature flag.

## Emergency Stop

Disable `APP_DEVELOPER_SERVICE_ENABLED`, restart NestJS, and stop only the affected generated process names through the dedicated PM2 home. Do not delete the shared project, unrelated PM2 processes, database, Redis data, or Baota configuration during an emergency stop.

## Disposable Linux Gate

Run the live gate only with a disposable database, an empty isolated Redis logical database, empty runtime/PM2 directories outside production roots, and a non-root runtime user:

```text
APP_DEVELOPER_SERVICE_E2E_DB_HOST
APP_DEVELOPER_SERVICE_E2E_DB_PORT
APP_DEVELOPER_SERVICE_E2E_DB_USERNAME
APP_DEVELOPER_SERVICE_E2E_DB_PASSWORD
APP_DEVELOPER_SERVICE_E2E_PLATFORM_USERNAME
APP_DEVELOPER_SERVICE_E2E_PLATFORM_PASSWORD
APP_DEVELOPER_SERVICE_E2E_REDIS_DB
APP_DEVELOPER_SERVICE_E2E_REDIS_ISOLATED
APP_DEVELOPER_SERVICE_E2E_RUNTIME_ROOT
APP_DEVELOPER_SERVICE_E2E_PM2_HOME
APP_DEVELOPER_SERVICE_E2E_RUNTIME_USER
```

Optional names are `APP_DEVELOPER_SERVICE_E2E_REDIS_HOST`, `APP_DEVELOPER_SERVICE_E2E_REDIS_PORT`, `APP_DEVELOPER_SERVICE_E2E_REDIS_PASSWORD`, `APP_DEVELOPER_SERVICE_E2E_PM2_COMMAND`, `APP_DEVELOPER_SERVICE_E2E_PORT_MIN`, and `APP_DEVELOPER_SERVICE_E2E_PORT_MAX`.
