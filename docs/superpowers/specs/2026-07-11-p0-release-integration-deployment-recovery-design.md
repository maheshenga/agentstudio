# P0 Release Integration And Deployment Recovery Design

**Status:** Approved direction, written specification pending user review

**Goal:** Safely promote the verified `saas-order-risk-ops` work into the local `main` release line, preserve operator-owned environment values, re-run the release gates from the integrated commit, and recover the production login path without exposing secrets or making an unverified deployment irreversible.

## Context

The current authoritative implementation is the clean worktree at:

```text
E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops
```

Its branch is `saas-order-risk-ops` at commit `71e3f74`. It contains the completed SaaS foundation and app-platform P0 through P9-A work. The branch is eight commits ahead of `maheshenga/saas-order-risk-ops` and 227 commits ahead of the local `main`. The local `main` has no commits absent from `saas-order-risk-ops`, so the code history supports a fast-forward integration.

The main checkout is not clean:

- `server/.env` has operator-owned local changes and is still tracked on `main`.
- `server/pnpm-lock.yaml` is modified on `main`, but its working-copy content already matches the feature branch.
- The feature branch no longer tracks `server/.env`; `server/.env.example` remains the committed configuration contract.

The public deployment uses `https://studio.qingyouai.com`. The production frontend is built with `VITE_API_URL=/nest-api`. The backend exposes controllers under `/api`, including public health at `GET /api/health` and login at `POST /api/core/login`. The active Baota/Nginx route therefore must consistently map the browser's `/nest-api/...` requests to the backend without dropping or duplicating the expected path.

## Scope

### Included

- Preserve the exact local `server/.env` bytes outside the repository before changing branches or indexes.
- Verify branch ancestry and dirty-file assumptions immediately before integration.
- Fast-forward local `main` to the reviewed feature commit without a merge commit.
- Restore `server/.env` as an ignored, untracked local file after integration.
- Confirm the lockfile working copy is represented by the integrated commit.
- Run repository-local release gates from integrated `main`.
- Review the integrated history, status, tracked secret paths, and generated artifacts.
- Prepare and execute a reversible Baota deployment only after repository verification succeeds.
- Diagnose and recover the public health and login paths across browser, Nginx, PM2, MySQL, and Redis.
- Run read-only public smoke verification after deployment.
- Keep push and production cutover behind explicit user approval.

### Excluded

- P9-B runtime sessions, capability gateway, KV storage, and permission-consent features.
- New SaaS or app-platform business behavior.
- Invoice functionality.
- Production Alipay settlement changes.
- Database data cleanup or destructive rollback.
- Rewriting or squashing the existing commit history.
- Publishing the runtime SDK to npm or a CDN.

## Safety Invariants

1. No command may print, stage, commit, diff, or transmit the contents of `server/.env`.
2. The environment backup must live outside every Git worktree and have a restricted, operator-controlled path.
3. The environment backup must be verified by file size and SHA-256 hash without printing its contents.
4. Integration must use fast-forward-only semantics. An unexpected non-fast-forward result stops the operation.
5. Existing user changes are preserved. A dirty file is never discarded to make integration proceed.
6. `server/.env` must be absent from `git ls-files` after integration and remain covered by `.gitignore`.
7. Repository gates run on the exact commit intended for deployment.
8. Database migrations are backed up and inspected before production execution; destructive migration rollback is not part of deployment.
9. The currently serving release remains available until the new backend and frontend have passed local server health checks.
10. Remote push, DNS changes, certificate changes, and production cutover require explicit user approval.

## Integration Design

### 1. Preflight Snapshot

Record safe metadata only:

- current branch names and commit IDs;
- `git status --short --branch` for both worktrees;
- `git rev-list --count main..saas-order-risk-ops` and the reverse count;
- whether `server/.env` and `server/.env.example` are tracked on each branch;
- whether the main lockfile content matches the feature branch;
- the local environment file's byte size and SHA-256 hash.

Do not run `git diff` or `git show` against `server/.env`.

Copy `server/.env` to a timestamped directory outside `FssAdmin_NestJs`. Verify the copied file has the same size and SHA-256 hash. Move the working copy out of the main checkout only after the backup is verified, because the target commit deletes the tracked file and Git may otherwise reject the fast-forward.

### 2. Fast-Forward Main

From the main checkout:

1. Confirm `saas-order-risk-ops..main` contains zero commits.
2. Confirm the only main working-copy changes are the already classified environment and lock files.
3. Run a fast-forward-only merge of `saas-order-risk-ops` into `main`.
4. Confirm `main` now resolves to the intended reviewed feature commit.
5. Restore the backed-up environment file to `server/.env`.
6. Confirm the restored file is ignored and untracked.
7. Confirm the lockfile is clean against integrated `HEAD`.

No merge commit or integration commit is required when the fast-forward and tracked-secret cleanup are already represented in feature history.

### 3. Integrated-State Review

The integrated checkout must satisfy all of these before tests begin:

- `git status --short` reports no tracked modification.
- `git ls-files server/.env` returns no path.
- `git check-ignore server/.env` confirms the local file is ignored.
- `git diff --check` succeeds.
- `git log` shows the P9-A verification commits ending at the intended release commit.
- no generated SDK distribution, runtime starter ZIP, E2E secret, disposable database artifact, or Redis credential has become tracked.

## Repository Verification

### Required Aggregate Gate

Run from repository root:

```powershell
node scripts/run-saas-readiness.cjs
```

This is the release-blocking local gate. It runs frontend readiness, frontend production build, frontend preview smoke, frontend browser smoke, backend production build, and backend readiness.

### Required App-Platform Regression Gates

Run the existing app gates from `web`:

```powershell
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run verify:app-factory-readiness
pnpm.cmd run verify:app-developer-readiness
pnpm.cmd run verify:app-analytics-readiness
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run verify:app-runtime-sdk
pnpm.cmd run verify:app-runtime-starter
pnpm.cmd run verify:app-runtime-live-e2e-contract
```

The disposable full runtime lifecycle E2E does not need to repeat after a pure fast-forward to the exact already-verified `71e3f74` commit. It becomes mandatory if a release-fix commit changes app runtime, authentication, tenant isolation, migrations, or the lifecycle harness, or if the recorded P9-A evidence no longer corresponds to the deployment commit. When run, it must retain the existing guarantees: no secret output, all child processes stopped, disposable database dropped, owned Redis database cleaned, and no retained test artifact unless an explicit debug flag requests it.

### Gate Failure Policy

- A deterministic source, unit, build, or browser-smoke failure blocks deployment.
- An unavailable external dependency is recorded separately and does not convert a failed local test into a pass.
- Fixes exposed by the integrated gates are made on a dedicated release-fix branch from integrated `main`, reviewed, committed, and re-run through the affected focused gate plus the aggregate gate.
- The previous verified commit remains the deployment candidate until the replacement passes all required gates.

## Deployment Design

### Release Layout

Use a release-directory model compatible with Baota management:

```text
${SITE_ROOT}/releases/${RELEASE_ID}/
${SITE_ROOT}/current -> ${SITE_ROOT}/releases/${RELEASE_ID}/
${SITE_ROOT}/shared/server/.env
${SITE_ROOT}/shared/upload/
${SITE_ROOT}/shared/logs/
```

`SITE_ROOT` is read from the active Baota site configuration, and `RELEASE_ID` is the exact verified Git commit ID. The implementation plan must discover and record both safe values before deployment instead of assuming a server path.

If the existing server does not use symbolic links, use the equivalent Baota-managed release directories and an atomic site-root switch. Do not overwrite the only serving copy in place.

The deployment source is a specific verified commit, not an uncommitted local directory. Shared runtime state, uploads, logs, and environment configuration remain outside release directories.

### Build And Database Order

1. Capture the current release identifier, PM2 process status, Nginx configuration backup, database backup status, and public health result.
2. Fetch the approved commit into a new release directory.
3. Attach the shared environment and persistent directories without copying secrets into Git-controlled paths.
4. Install dependencies from lockfiles with frozen-lockfile semantics.
5. Build backend and frontend production assets.
6. Inspect pending migrations and take a database backup before applying forward migrations.
7. Start the candidate backend on its configured loopback port without switching public traffic.
8. Call the candidate's direct `GET /api/health` route and require application `status: ok`, MySQL `up`, and Redis `up`.
9. Switch the Nginx/site release only after candidate health succeeds.
10. Reload Nginx and restart or reload the named PM2 process using the repository's `ecosystem.config.cjs`.
11. Run public smoke and login-path diagnostics.
12. Observe public health, PM2 restart count, and login availability for 15 minutes. Retain the previous release for at least 24 hours after a successful cutover.

Migrations are forward-only during the release. If a migration fails, stop before traffic switch and restore according to the database backup procedure. Do not automatically invoke TypeORM migration reverts against production.

## Login Gateway Recovery

### Expected Request Path

The browser posts to:

```text
https://studio.qingyouai.com/nest-api/api/core/login
```

The public health probe is:

```text
https://studio.qingyouai.com/nest-api/api/health
```

Nginx must use exactly one consistent routing mode:

- strip `/nest-api` and proxy `/api/...` to a backend with no custom deployment prefix; or
- preserve `/nest-api` and run the backend with the matching custom deployment prefix.

Mixing these modes causes duplicated prefixes or missing routes. The active configuration must be derived from the actual `APP_PORT` and `APP_API_PREFIX` values without printing unrelated environment values.

### Diagnostic Order

1. Confirm the PM2 process is online and not restarting repeatedly.
2. Inspect bounded PM2 error logs with secrets and authorization values redacted.
3. Probe `127.0.0.1:${APP_PORT}/api/health`, or the correctly prefixed equivalent. `APP_PORT` is read from the active server environment without printing any other environment value.
4. Confirm MySQL and Redis report `up` in the health response.
5. Validate Nginx syntax before reload.
6. Probe the public `/nest-api/api/health` route.
7. Probe the public login-captcha configuration route.
8. Submit one controlled login request without printing credentials or the full response body.
9. Confirm the frontend no longer reports a network or gateway error.

Interpretation:

- direct backend failure means PM2, environment, build, migration, MySQL, or Redis must be repaired before Nginx changes;
- direct backend success plus public 502 means the Nginx upstream host/port or process binding is wrong;
- public 404 means prefix preservation or rewrite behavior is wrong;
- public health success plus login 5xx means inspect the bounded application login error and dependency state rather than changing the proxy;
- browser-only failure with successful HTTP probes means inspect frontend API origin, TLS, mixed-content, CORS, or stale assets.

## Rollback

Rollback is permitted only when it does not require reversing an incompatible database migration.

1. Switch the site and PM2 process back to the previously recorded release.
2. Reload Nginx only if its configuration changed.
3. Verify direct and public health.
4. Verify the login page and one controlled login request.
5. Keep the failed release and bounded logs for diagnosis; do not delete evidence during the incident.

If the new migration is not backward compatible with the previous release, traffic is not switched until a tested forward-fix or compatible deployment pair exists.

## Post-Deployment Verification

Run the existing read-only public smoke:

```powershell
cd web
$env:SAAS_PUBLIC_LIVE_BASE_URL = 'https://studio.qingyouai.com'
pnpm.cmd run verify:saas-public-live-smoke
```

Then verify:

- public TLS and frontend shell;
- direct SPA fallback and static assets;
- `/nest-api/api/health` with MySQL and Redis healthy;
- login-captcha configuration;
- controlled platform-admin login;
- controlled tenant-owner login;
- tenant marketplace and one installed-app open flow;
- no browser console network failures on the login and application-center paths;
- PM2 restart count and memory remain stable during the 15-minute observation window.

No test output may include passwords, access tokens, refresh tokens, cookies, authorization headers, payment keys, database passwords, or complete authentication responses.

## Review And Commit Cadence

P0 execution uses these review boundaries:

1. **Integration checkpoint:** environment backup verified, `main` fast-forwarded, local environment restored and ignored.
2. **Repository checkpoint:** aggregate and app-platform gates pass on integrated `main`.
3. **Deployment checkpoint:** candidate release builds and direct backend health passes before traffic switch.
4. **Public checkpoint:** public health, login, and smoke checks pass after cutover.

Any code or configuration correction discovered during a checkpoint receives a focused test, a focused commit, and a review before advancing. Push and production cutover remain explicit user decisions.

## Acceptance Criteria

- Local `main` contains the approved `saas-order-risk-ops` history through the selected release commit.
- The integration is fast-forward-only and does not discard any user working-copy change.
- The local `server/.env` content is preserved exactly, is ignored, and is not tracked.
- `server/.env.example` remains the committed environment contract.
- The integrated lockfile is clean and frozen-lockfile installation succeeds.
- Full repository readiness and required app-platform gates pass on integrated `main`.
- The production candidate is built from the exact verified commit.
- Direct backend health reports the application, MySQL, and Redis healthy before public cutover.
- The public `/nest-api/api/health` route succeeds through Nginx.
- Login no longer produces a network or gateway error for controlled platform and tenant identities.
- Public smoke passes against `https://studio.qingyouai.com`.
- The previous release remains available for rollback for at least 24 hours after cutover.
- No repository, command output, log excerpt, artifact, commit, or remote push exposes a secret.
- No remote push or production cutover occurs without explicit user approval.
