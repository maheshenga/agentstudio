# Administrator Service Runtime On Baota

This guide deploys the P10 administrator service runtime beside the existing NestJS application. It does not enable developer submissions or tenant service invocation.

## Security Boundary

- Uploaded code is never imported by NestJS.
- Service releases contain only `app.manifest.json`, `dist/index.js`, the code-owned host bootstrap, and the immutable release marker.
- The runtime uses a dedicated non-login plugin user and an isolated PM2 home.
- Service processes bind only to `127.0.0.1` and receive the fixed allowlisted environment created by the platform.
- Keep `APP_SERVICE_RUNTIME_ENABLED` disabled until backup, migration, ownership, firewall, and smoke checks pass.

## Dedicated User And Directories

Create the low-privilege account once from the Baota terminal. The account must not be `root`, must not have an interactive shell, and must not own the NestJS project.

```bash
useradd --system --shell /usr/sbin/nologin --home-dir /www/server/agentstudio-app agentstudio_app
install -d -o www -g www -m 0755 /www/wwwroot/agentstudio-plugins
install -d -o agentstudio_app -g agentstudio_app -m 0700 /www/server/agentstudio-app
install -d -o agentstudio_app -g agentstudio_app -m 0700 /www/server/agentstudio-app/.pm2
```

Replace `www` with the actual Baota Node project process owner when it differs. The NestJS process owner must own `/www/wwwroot/agentstudio-plugins` and writes immutable release directories below it. The plugin user receives read and execute access only. Do not make the runtime root, app directories, release directories, or release files group/world writable.

Verify the boundary without exposing configuration values:

```bash
id agentstudio_app
runuser -u agentstudio_app -- /usr/bin/test -r /www/wwwroot/agentstudio-plugins
runuser -u agentstudio_app -- /usr/bin/test -w /www/server/agentstudio-app/.pm2
runuser -u agentstudio_app -- /usr/local/bin/pm2 --version
```

## Baota Environment

Configure these names in the Baota Node project environment. Keep values in Baota's protected environment editor, not in a release directory or command history.

```text
APP_SERVICE_RUNTIME_ENABLED
APP_SERVICE_RUNTIME_DIR
APP_SERVICE_RUNTIME_USER
APP_SERVICE_PM2_HOME
APP_SERVICE_PM2_COMMAND
APP_SERVICE_RUNTIME_INTERPRETER
APP_SERVICE_MEMORY_MB
APP_SERVICE_PORT_MIN
APP_SERVICE_PORT_MAX
APP_SERVICE_HEALTH_SUCCESS_COUNT
```

Use `/www/wwwroot/agentstudio-plugins` for the runtime directory, `agentstudio_app` for the runtime user, the dedicated `.pm2` directory above, and an absolute PM2 executable path. The interpreter is `node` or `bun`; confirm it is reachable through `/usr/local/bin:/usr/bin:/bin` for the plugin user.

Never copy `.env`, SSH keys, payment keys, database credentials, Redis credentials, Baota session data, or deployment keys into `/www/wwwroot/agentstudio-plugins`.

## Host Firewall

Service packages have no direct network capability, but the host boundary must still deny the plugin user's public egress. Apply equivalent nftables/iptables policy approved for the server:

- allow loopback traffic required for `127.0.0.1` health and invoke calls;
- deny cloud metadata destinations such as `169.254.169.254` and provider metadata IPv6 addresses;
- deny MySQL and Redis ports;
- deny Baota management ports, including the configured panel port;
- deny the main administrator HTTP ports and private control-plane networks;
- deny all remaining public egress for the plugin user's UID.

Do not expose `APP_SERVICE_PORT_MIN` through `APP_SERVICE_PORT_MAX` in Baota security rules, the cloud security group, Nginx, or the host firewall. These ports are loopback-only.

## Backup And Migration

1. Keep the feature flag disabled.
2. Stop writes or enter the normal maintenance window.
3. Create a MySQL backup through Baota or `mysqldump` using a protected client configuration or an interactive prompt. Do not place credentials in the command line.
4. Back up the current NestJS release and Baota process configuration.
5. Run `pnpm.cmd run migration:show` and then `pnpm.cmd run migration:run` from `server`.
6. Confirm migration `1760000000040-CreateAppServiceRuntime` and menu migration `1760000000041-SeedAppServiceRuntimeMenus` are applied.
7. Build the backend and frontend, then restart the Baota Node project while the feature flag remains disabled.

## Enable And Candidate Smoke

1. Verify the dedicated user, runtime root, isolated PM2 home, PM2 executable, interpreter, port range, and firewall policy.
2. Set the feature flag to enabled and restart only the NestJS project.
3. Upload a reviewed service package from App Platform. Confirm the parser scan passes and a different platform operator approves it.
4. Open Service Runtime, start the candidate, and require three consecutive healthy checks.
5. Run a bounded probe and inspect redacted logs.
6. Publish only after the candidate remains healthy. Confirm exactly one active version and at most one healthy standby.
7. Observe NestJS health, PM2 state, memory, restart count, and diagnostics for at least 15 minutes.

If candidate start or health fails, the current active version must remain unchanged. Stop the candidate with an audit reason and inspect only bounded redacted logs.

## Inspection

Prefer the Service Runtime console. Host-level inspection is read-only and uses fixed commands:

```bash
runuser -u agentstudio_app -- /usr/local/bin/pm2 jlist
runuser -u agentstudio_app -- /usr/local/bin/pm2 logs <platform-generated-process-name> --nostream --raw --lines 100
```

Do not paste unredacted process output into tickets. Never inspect or export another PM2 home.

## Rollback

Use the Service Runtime rollback action only for a healthy standby. Enter a concrete audit reason and confirm the former active version becomes standby. If the console is unavailable but NestJS is healthy, restore the previous application release and database backup through the normal Baota rollback process.

After rollback, verify the active version through a bounded probe, confirm one active process, and repeat the 15-minute observation window.

## Emergency Stop

1. Set the feature flag to disabled and restart NestJS. This makes runtime management and probe endpoints fail closed.
2. Stop owned service processes with their platform-generated names:

```bash
runuser -u agentstudio_app -- /usr/local/bin/pm2 delete <platform-generated-process-name> --silent
```

3. Confirm `jlist` contains no owned process.
4. Keep release files for forensic review unless incident response authorizes removal.
5. Do not delete the shared project, database, Redis data, Baota configuration, or unrelated PM2 processes during emergency stop.

Re-enable only after the cause is understood, the package is reviewed again if necessary, and candidate health plus rollback readiness are reverified.
