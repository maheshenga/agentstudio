# P0 Release Integration And Deployment Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not dispatch subagents; the user previously requested direct inline execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the verified SaaS and app-platform history into local `main`, preserve local secrets exactly, pass release gates on the integrated commit, and deploy a reversible Baota release that restores public health and login.

**Architecture:** Treat release integration and production deployment as two separately approved transactions. First create a byte-verified secret backup, fast-forward `main`, restore `.env` as ignored local state, and run one aggregate repository gate plus focused app gates. Only after review and explicit approval, push the verified commit to `maheshenga/main`, build a versioned server release, health-check it on a temporary loopback port, then atomically switch the Baota/Nginx and PM2 release pointers.

**Tech Stack:** Git worktrees, PowerShell 7, Node.js 20+, pnpm, Bun, NestJS, Vue/Vite, Jest, Playwright, MySQL 8, Redis, SSH, Baota, Nginx, PM2.

## Global Constraints

- Authoritative feature worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.
- Main checkout: `E:\code\agentstudio\FssAdmin_NestJs`.
- User repository remote: `maheshenga` at `https://github.com/maheshenga/agentstudio.git`.
- Production origin: `https://studio.qingyouai.com`.
- Production host: `47.103.96.48`; authenticate through the existing SSH credential flow and confirmed host key. Never place a password in a command, file, plan, or log.
- Never print, diff, stage, commit, stash, or transmit `server/.env` contents.
- Back up `server/.env` outside every Git worktree before temporarily restoring tracked files.
- Preserve all user changes byte-for-byte. No reset, checkout, clean, recursive delete, migration revert, or forced push is allowed.
- Integrate with `git merge --ff-only`; stop if `main` is not an ancestor of the feature branch.
- Push and production cutover require explicit user approval after local verification.
- Production migrations are forward-only and require a verified Baota database backup first.
- Invoice work, P9-B/P9-C features, Alipay settlement changes, SDK publication, external iframe support, service plugins, and revenue sharing are outside P0.
- A pure fast-forward to the previously verified P9-A code does not repeat the disposable live runtime E2E unless release-fix code changes runtime, auth, tenant isolation, migrations, or the E2E harness.

---

### Task 1: Capture Preconditions And Create A Secret-Safe Backup

**Files and state:**
- Read: `E:\code\agentstudio\FssAdmin_NestJs\server\.env` without displaying contents.
- Read: both worktrees' Git status and refs.
- Create outside Git: timestamped subdirectory under `%LOCALAPPDATA%\AgentStudio\release-backups` containing `server.env`.
- Create outside Git: the same timestamped backup directory containing `pnpm-lock.yaml`.
- Create outside Git: the same timestamped backup directory containing `release-state.json` with paths, commit IDs, lengths, and hashes only.

**Interfaces:**
- Produces: latest backup directory with `server.env`, `pnpm-lock.yaml`, and `release-state.json`.
- Produces: `releaseCommit`, `mainBefore`, `envLength`, `envHash`, `lockLength`, and `lockHash` in the state file.
- Consumes: no secret value beyond opaque file copy and hash operations.

- [ ] **Step 1: Verify branch ancestry and exact dirty paths**

Run in PowerShell:

```powershell
$main = 'E:\code\agentstudio\FssAdmin_NestJs'
$feature = 'E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops'

git -C $feature status --short --branch
if ($LASTEXITCODE -ne 0) { throw 'Feature status failed' }
if (git -C $feature status --porcelain) { throw 'Feature worktree is not clean' }

$mainStatus = @(git -C $main status --porcelain)
$allowed = @(' M server/.env', ' M server/pnpm-lock.yaml')
$unexpected = @($mainStatus | Where-Object { $_ -notin $allowed })
if ($unexpected.Count -gt 0) { throw "Unexpected main changes: $($unexpected -join ', ')" }

$ahead = [int](git -C $feature rev-list --count main..saas-order-risk-ops)
$reverse = [int](git -C $feature rev-list --count saas-order-risk-ops..main)
if ($ahead -lt 1 -or $reverse -ne 0) { throw "Fast-forward precondition failed: ahead=$ahead reverse=$reverse" }
Write-Output "fast_forward_ready=$true commits=$ahead"
```

Expected: feature is clean, main has only the two classified paths, `ahead` is positive, `reverse` is zero.

- [ ] **Step 2: Verify tracked-file assumptions without reading secrets**

```powershell
$mainTracksEnv = @(git -C $main ls-files -- server/.env).Count -eq 1
$featureTracksEnv = @(git -C $feature ls-files -- server/.env).Count -eq 1
$featureTracksExample = @(git -C $feature ls-files -- server/.env.example).Count -eq 1
if (-not $mainTracksEnv -or $featureTracksEnv -or -not $featureTracksExample) {
  throw 'Tracked environment-file assumptions changed'
}

git diff --quiet --no-index `
  (Join-Path $main 'server\pnpm-lock.yaml') `
  (Join-Path $feature 'server\pnpm-lock.yaml')
if ($LASTEXITCODE -ne 0) { throw 'Main lockfile no longer matches the feature branch' }
Write-Output 'tracked_env_contract=verified lock_matches_feature=true'
```

Expected: main tracks `.env`, feature does not, feature tracks `.env.example`, and lockfiles match.

- [ ] **Step 3: Create a restricted backup and safe state file**

```powershell
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $env:LOCALAPPDATA "AgentStudio\release-backups\$timestamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$principal = "$env:USERDOMAIN\$env:USERNAME"
& icacls.exe $backupRoot /inheritance:r /grant:r "${principal}:(OI)(CI)F" /T | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Failed to restrict backup ACL' }

$envSource = Join-Path $main 'server\.env'
$lockSource = Join-Path $main 'server\pnpm-lock.yaml'
$envBackup = Join-Path $backupRoot 'server.env'
$lockBackup = Join-Path $backupRoot 'pnpm-lock.yaml'
Copy-Item -LiteralPath $envSource -Destination $envBackup
Copy-Item -LiteralPath $lockSource -Destination $lockBackup

$envLength = (Get-Item -LiteralPath $envSource).Length
$envHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $envSource).Hash
$lockLength = (Get-Item -LiteralPath $lockSource).Length
$lockHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $lockSource).Hash

if ((Get-Item -LiteralPath $envBackup).Length -ne $envLength) { throw 'Environment backup length mismatch' }
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $envBackup).Hash -ne $envHash) { throw 'Environment backup hash mismatch' }
if ((Get-Item -LiteralPath $lockBackup).Length -ne $lockLength) { throw 'Lockfile backup length mismatch' }
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $lockBackup).Hash -ne $lockHash) { throw 'Lockfile backup hash mismatch' }

$state = [ordered]@{
  main = $main
  feature = $feature
  backupRoot = $backupRoot
  releaseCommit = (git -C $feature rev-parse HEAD).Trim()
  mainBefore = (git -C $main rev-parse HEAD).Trim()
  envLength = $envLength
  envHash = $envHash
  lockLength = $lockLength
  lockHash = $lockHash
}
$state | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupRoot 'release-state.json') -Encoding utf8NoBOM
Write-Output "backup_verified=true state_file_created=true"
```

Expected: only boolean confirmation is printed; no hash or environment content appears.

- [ ] **Step 4: Review checkpoint**

Run:

```powershell
Get-ChildItem -LiteralPath $backupRoot | Select-Object Name,Length
git -C $feature status --short --branch
git -C $main status --short --branch
```

Expected: three backup files exist, feature remains clean, and main remains unchanged.

No Git commit is created by this task.

---

### Task 2: Fast-Forward Main And Restore Local Environment State

**Files and state:**
- Temporarily restore from Git: `E:\code\agentstudio\FssAdmin_NestJs\server\.env` and `server\pnpm-lock.yaml` only after Task 1 backup is verified.
- Update: local `main` ref and working tree through fast-forward only.
- Restore from backup: ignored `server/.env` with exact original bytes.

**Interfaces:**
- Consumes: latest `release-state.json` and its sibling backups.
- Produces: local `main` at `releaseCommit`, clean tracked state, ignored byte-identical `server/.env`.

- [ ] **Step 1: Load and verify the latest backup state**

```powershell
$statePath = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'AgentStudio\release-backups') -Directory |
  Sort-Object Name -Descending |
  ForEach-Object { Join-Path $_.FullName 'release-state.json' } |
  Where-Object { Test-Path -LiteralPath $_ } |
  Select-Object -First 1
if (-not $statePath) { throw 'No release state file found' }
$state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
$envBackup = Join-Path $state.backupRoot 'server.env'
$lockBackup = Join-Path $state.backupRoot 'pnpm-lock.yaml'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $envBackup).Hash -ne $state.envHash) { throw 'Environment backup changed' }
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $lockBackup).Hash -ne $state.lockHash) { throw 'Lockfile backup changed' }
Write-Output 'backup_state_verified=true'
```

- [ ] **Step 2: Temporarily clean the two backed-up tracked paths**

```powershell
git -C $state.main restore --worktree -- server/.env server/pnpm-lock.yaml
if ($LASTEXITCODE -ne 0) { throw 'Temporary worktree restore failed' }
if (git -C $state.main status --porcelain) { throw 'Main is not clean after backed-up path restore' }
```

Expected: main is clean. The user's original files remain preserved in the verified external backup.

- [ ] **Step 3: Perform the fast-forward-only integration**

```powershell
git -C $state.main merge --ff-only $state.releaseCommit
if ($LASTEXITCODE -ne 0) { throw 'Fast-forward failed; stop without fallback merge' }
$head = (git -C $state.main rev-parse HEAD).Trim()
if ($head -ne $state.releaseCommit) { throw 'Main did not reach the reviewed release commit' }
Write-Output "fast_forward_complete=true"
```

Expected: fast-forward succeeds without a merge commit.

- [ ] **Step 4: Restore the local environment and verify ignored state**

```powershell
$envTarget = Join-Path $state.main 'server\.env'
Copy-Item -LiteralPath $envBackup -Destination $envTarget -Force
if ((Get-Item -LiteralPath $envTarget).Length -ne $state.envLength) { throw 'Restored environment length mismatch' }
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $envTarget).Hash -ne $state.envHash) { throw 'Restored environment hash mismatch' }

git -C $state.main ls-files --error-unmatch -- server/.env 2>$null
if ($LASTEXITCODE -eq 0) { throw 'server/.env is still tracked' }
git -C $state.main check-ignore -q -- server/.env
if ($LASTEXITCODE -ne 0) { throw 'server/.env is not ignored' }

$lockTarget = Join-Path $state.main 'server\pnpm-lock.yaml'
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $lockTarget).Hash -ne $state.lockHash) { throw 'Integrated lockfile differs from preserved working copy' }
if (git -C $state.main status --porcelain) { throw 'Integrated main has tracked changes' }
git -C $state.main diff --check
if ($LASTEXITCODE -ne 0) { throw 'Integrated diff check failed' }
Write-Output 'environment_restored=true tracked_state_clean=true'
```

- [ ] **Step 5: Record integration evidence**

```powershell
git -C $state.main status --short --branch
git -C $state.main log -12 --oneline --decorate
git -C $state.main ls-files -- server/.env server/.env.example
```

Expected: status has no tracked changes, `.env.example` is listed, `.env` is not listed, and `HEAD` is the release commit.

No integration commit is created because fast-forward preserves the reviewed commits.

---

### Task 3: Run The Aggregate Repository Release Gate

**Files and state:**
- Read/build: integrated main checkout.
- Generated ignored outputs: frontend/backend builds and test artifacts.
- No tracked source modification is expected.

**Interfaces:**
- Consumes: clean integrated `main` from Task 2.
- Produces: one aggregate release-gate result for the exact deployment commit.

- [ ] **Step 1: Confirm toolchain versions and commit identity**

```powershell
$main = 'E:\code\agentstudio\FssAdmin_NestJs'
git -C $main rev-parse HEAD
node --version
pnpm.cmd --version
bun --version
```

Expected: Node meets `>=20.19.0`, pnpm meets repository requirements, Bun meets `>=1.1.0`.

- [ ] **Step 2: Run the aggregate gate**

```powershell
node "$main\scripts\run-saas-readiness.cjs"
```

Expected final output: `SaaS repository readiness verified.` and exit code `0`.

- [ ] **Step 3: Verify no tracked output was created**

```powershell
git -C $main status --short
git -C $main diff --check
```

Expected: no tracked changes and `git diff --check` exits `0`.

If the gate fails, stop deployment. Create a separate release-fix branch from integrated `main`, add a focused failing test, implement the minimum fix, review, commit, and repeat Tasks 3 and 4.

---

### Task 4: Run App-Platform Regression Gates And Decide Live E2E Reuse

**Files and state:**
- Read/build: `E:\code\agentstudio\FssAdmin_NestJs\web` and app-related backend code.
- Read: P9-A evidence at commit `71e3f74`.

**Interfaces:**
- Consumes: aggregate-green integrated commit.
- Produces: focused app marketplace, factory, developer, analytics, runtime, SDK, starter, and live-E2E contract evidence.
- Produces: deterministic decision whether the disposable full runtime E2E must repeat.

- [ ] **Step 1: Run all deterministic app gates once**

```powershell
$web = 'E:\code\agentstudio\FssAdmin_NestJs\web'
Push-Location $web
try {
  pnpm.cmd run verify:app-marketplace-readiness
  if ($LASTEXITCODE -ne 0) { throw 'Marketplace readiness failed' }
  pnpm.cmd run verify:app-factory-readiness
  if ($LASTEXITCODE -ne 0) { throw 'Factory readiness failed' }
  pnpm.cmd run verify:app-developer-readiness
  if ($LASTEXITCODE -ne 0) { throw 'Developer readiness failed' }
  pnpm.cmd run verify:app-analytics-readiness
  if ($LASTEXITCODE -ne 0) { throw 'Analytics readiness failed' }
  pnpm.cmd run verify:app-runtime-readiness
  if ($LASTEXITCODE -ne 0) { throw 'Runtime readiness failed' }
  pnpm.cmd run verify:app-runtime-sdk
  if ($LASTEXITCODE -ne 0) { throw 'Runtime SDK readiness failed' }
  pnpm.cmd run verify:app-runtime-starter
  if ($LASTEXITCODE -ne 0) { throw 'Runtime Starter readiness failed' }
  pnpm.cmd run verify:app-runtime-live-e2e-contract
  if ($LASTEXITCODE -ne 0) { throw 'Runtime live E2E contract failed' }
} finally {
  Pop-Location
}
```

Expected: every command exits `0`.

- [ ] **Step 2: Determine whether full disposable E2E must repeat**

```powershell
$main = 'E:\code\agentstudio\FssAdmin_NestJs'
$sensitiveChanges = @(git -C $main diff --name-only 71e3f74..HEAD -- `
  server/src/module/app `
  server/src/module/main `
  server/src/module/system/user `
  server/src/migrations `
  web/src/views/app-center/open `
  web/src/utils/app-runtime.ts `
  web/packages/app-runtime-sdk `
  web/examples/runtime-starter `
  web/scripts/verify-app-runtime-live-e2e.ts)

if ($sensitiveChanges.Count -eq 0) {
  Write-Output 'live_runtime_e2e=reuse_verified_71e3f74_evidence'
} else {
  Write-Output 'live_runtime_e2e=required'
  $sensitiveChanges
}
```

Expected for a documentation-only release tail: reuse the verified `71e3f74` evidence. Any sensitive code path requires Step 3.

- [ ] **Step 3: Conditionally run the disposable full runtime E2E**

Run only when Step 2 reports `required`, after confirming isolated E2E variables are present without printing their values:

```powershell
$requiredNames = @(
  'APP_RUNTIME_E2E_DB_HOST',
  'APP_RUNTIME_E2E_DB_PORT',
  'APP_RUNTIME_E2E_DB_USERNAME',
  'APP_RUNTIME_E2E_DB_PASSWORD',
  'APP_RUNTIME_E2E_PLATFORM_USERNAME',
  'APP_RUNTIME_E2E_PLATFORM_PASSWORD',
  'APP_RUNTIME_E2E_REDIS_DB',
  'APP_RUNTIME_E2E_REDIS_ISOLATED'
)
$missing = @($requiredNames | Where-Object { -not [Environment]::GetEnvironmentVariable($_) })
if ($missing.Count -gt 0) { throw "Missing required E2E variable names: $($missing -join ', ')" }

Push-Location 'E:\code\agentstudio\FssAdmin_NestJs\web'
try {
  pnpm.cmd run verify:app-runtime-live-e2e
  if ($LASTEXITCODE -ne 0) { throw 'Disposable runtime E2E failed' }
} finally {
  Pop-Location
}
```

Expected: full lifecycle passes and cleanup reports no retained disposable MySQL database or Redis keys.

- [ ] **Step 4: Final local review gate**

```powershell
git -C $main status --short --branch
git -C $main diff --check
git -C $main fsck --no-progress --connectivity-only
```

Expected: clean tracked status, diff check passes, and Git connectivity check reports no error.

---

### Task 5: Review The Release Diff And Obtain Push/Deployment Approval

**Files and state:**
- Read: safe Git metadata from `mainBefore..releaseCommit`.
- Update only after approval: remote `maheshenga/main`.

**Interfaces:**
- Consumes: `release-state.json`, green local gates, clean integrated main.
- Produces: reviewed release summary and, after explicit approval, remote `maheshenga/main` at the verified commit.

- [ ] **Step 1: Review safe release metadata**

```powershell
$statePath = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'AgentStudio\release-backups') -Directory |
  Sort-Object Name -Descending |
  ForEach-Object { Join-Path $_.FullName 'release-state.json' } |
  Where-Object { Test-Path -LiteralPath $_ } |
  Select-Object -First 1
$state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json

git -C $state.main diff --stat $state.mainBefore..$state.releaseCommit
git -C $state.main diff --name-status $state.mainBefore..$state.releaseCommit
git -C $state.main log --oneline --decorate $state.mainBefore..$state.releaseCommit
git -C $state.main status --short --branch
```

Expected: review shows the intended SaaS/app-platform history and documentation tail. Do not run a content diff for `server/.env`.

- [ ] **Step 2: Verify remote push will be non-destructive**

```powershell
git -C $state.main fetch maheshenga --prune
$remoteMain = @(git -C $state.main ls-remote --heads maheshenga refs/heads/main)
if ($remoteMain.Count -gt 0) {
  git -C $state.main merge-base --is-ancestor maheshenga/main main
  if ($LASTEXITCODE -ne 0) { throw 'maheshenga/main is not an ancestor; push would not be fast-forward' }
}
Write-Output 'remote_push_preflight=verified'
```

- [ ] **Step 3: Stop and obtain explicit user approval**

Report:

- exact local release commit;
- local gate results;
- whether `maheshenga/main` exists;
- confirmation that `.env` is ignored and untracked;
- the next commands will push and connect to production.

Expected: user explicitly approves push and deployment. Without approval, P0 pauses here with no remote or server mutation.

- [ ] **Step 4: Push the verified main after approval**

```powershell
git -C $state.main push maheshenga main:main
if ($LASTEXITCODE -ne 0) { throw 'Push failed' }
$localHead = (git -C $state.main rev-parse HEAD).Trim()
$remoteHead = ((git -C $state.main ls-remote maheshenga refs/heads/main) -split '\s+')[0]
if ($localHead -ne $remoteHead) { throw 'Remote main does not match verified local main' }
Write-Output "push_verified=true commit=$localHead"
```

Expected: remote main equals the verified local commit. Never push to `origin` and never force push.

---

### Task 6: Perform Read-Only Production Discovery

**Files and state:**
- Read remotely: Baota Nginx vhost config, PM2 status, process working directory, safe `APP_PORT` and `APP_API_PREFIX` values, direct/public health.
- Create remotely: `/root/agentstudio-release-state.env` containing only non-secret deployment paths, ports, prefixes, and commit IDs.

**Interfaces:**
- Consumes: approved remote `maheshenga/main` commit.
- Produces: `DEPLOY_ROOT`, `VHOST`, `CURRENT_SERVER_DIR`, `CURRENT_PROJECT_ROOT`, `APP_PORT`, `APP_API_PREFIX`, `RELEASE_ID`, and `PREVIOUS_RELEASE` in a root-readable state file.

- [ ] **Step 1: Connect with strict host-key checking**

```powershell
ssh -o StrictHostKeyChecking=yes root@47.103.96.48
```

Expected: connection uses the previously confirmed fingerprint. Authentication remains interactive or credential-manager controlled.

- [ ] **Step 2: Verify Baota, Nginx, PM2, and the current process without environment dumps**

Run on the server:

```bash
set -euo pipefail
VHOST=/www/server/panel/vhost/nginx/studio.qingyouai.com.conf
test -f "$VHOST"
nginx -t
pm2 status nextjs-server
PID="$(pm2 pid nextjs-server)"
test "$PID" != "0"
CURRENT_SERVER_DIR="$(readlink -f "/proc/$PID/cwd")"
CURRENT_PROJECT_ROOT="$(dirname "$CURRENT_SERVER_DIR")"
test -f "$CURRENT_SERVER_DIR/.env"
APP_PORT="$(sed -n 's/^APP_PORT=//p' "$CURRENT_SERVER_DIR/.env" | tail -n 1 | tr -d '\r')"
APP_API_PREFIX="$(sed -n 's/^APP_API_PREFIX=//p' "$CURRENT_SERVER_DIR/.env" | tail -n 1 | tr -d '\r')"
test -n "$APP_PORT"
case "$APP_API_PREFIX" in ''|'api'|'nest-api') ;; *) echo 'Unsupported APP_API_PREFIX'; exit 1 ;; esac
printf 'current_process=online app_port=%s api_prefix=%s\n' "$APP_PORT" "${APP_API_PREFIX:-none}"
```

Expected: Nginx syntax is valid, PM2 is online, and only the safe port/prefix values are printed. Do not run `pm2 env`, `env`, or `cat .env`.

- [ ] **Step 3: Probe direct and public health and classify the gateway failure**

```bash
if [ "$APP_API_PREFIX" = 'nest-api' ]; then
  DIRECT_HEALTH="http://127.0.0.1:${APP_PORT}/nest-api/api/health"
else
  DIRECT_HEALTH="http://127.0.0.1:${APP_PORT}/api/health"
fi

curl --fail --silent --show-error --max-time 10 "$DIRECT_HEALTH"
printf '\n'
curl --fail --silent --show-error --max-time 10 https://studio.qingyouai.com/nest-api/api/health || true
printf '\n'
grep -nE '(^|[[:space:]])(root|location|proxy_pass|rewrite)[[:space:]]' "$VHOST"
ss -lntp | grep -E ":(${APP_PORT}|80|443)[[:space:]]"
```

Expected: direct health determines whether the backend and dependencies are healthy. Public 502 with direct success classifies the remaining fault as Nginx upstream/routing.

- [ ] **Step 4: Persist safe discovery state**

```bash
DEPLOY_ROOT=/www/wwwroot/agentstudio-releases
RELEASE_ID="$(git ls-remote https://github.com/maheshenga/agentstudio.git refs/heads/main | awk '{print $1}')"
test -n "$RELEASE_ID"
if [ -L "$DEPLOY_ROOT/current" ]; then
  PREVIOUS_RELEASE="$(readlink -f "$DEPLOY_ROOT/current")"
else
  PREVIOUS_RELEASE="$CURRENT_PROJECT_ROOT"
fi
test -d "$PREVIOUS_RELEASE/server"
umask 077
cat > /root/agentstudio-release-state.env <<EOF
VHOST='$VHOST'
DEPLOY_ROOT='$DEPLOY_ROOT'
CURRENT_SERVER_DIR='$CURRENT_SERVER_DIR'
CURRENT_PROJECT_ROOT='$CURRENT_PROJECT_ROOT'
APP_PORT='$APP_PORT'
APP_API_PREFIX='$APP_API_PREFIX'
RELEASE_ID='$RELEASE_ID'
PREVIOUS_RELEASE='$PREVIOUS_RELEASE'
EOF
chmod 600 /root/agentstudio-release-state.env
printf 'discovery_state_created=true release=%s\n' "$RELEASE_ID"
```

Expected: state contains no password, token, key, cookie, or complete environment dump.

---

### Task 7: Back Up Production And Build A Candidate Release

**Files and state:**
- Create: versioned release under `/www/wwwroot/agentstudio-releases/releases/${RELEASE_ID}`.
- Create/reuse: bare mirror at `/www/wwwroot/agentstudio-releases/repository.git`.
- Create/reuse shared state under `/www/wwwroot/agentstudio-releases/shared`.
- Back up through Baota: production MySQL database.
- Back up: active Nginx vhost configuration.

**Interfaces:**
- Consumes: Task 6 state and approved remote commit.
- Produces: built candidate release, migration list, verified database backup, direct candidate health.

- [ ] **Step 1: Create the Baota database backup and verify it**

In Baota:

1. Open **Database**.
2. Select the production AgentStudio MySQL database identified by the active environment.
3. Choose **Backup** and wait for completion.
4. Confirm the backup row has the current timestamp and non-zero size.
5. Record the backup filename in the deployment notes without recording database credentials.

Expected: verified non-zero backup exists before migration. Stop if the backup fails.

- [ ] **Step 2: Back up Nginx and prepare release directories**

```bash
set -euo pipefail
source /root/agentstudio-release-state.env
STAMP="$(date +%Y%m%d-%H%M%S)"
cp -p "$VHOST" "${VHOST}.${STAMP}.bak"
mkdir -p "$DEPLOY_ROOT/releases" "$DEPLOY_ROOT/shared/server" "$DEPLOY_ROOT/shared/upload" "$DEPLOY_ROOT/shared/logs"
chmod 700 "$DEPLOY_ROOT/shared/server"

if [ ! -f "$DEPLOY_ROOT/shared/server/.env" ]; then
  cp -p "$CURRENT_SERVER_DIR/.env" "$DEPLOY_ROOT/shared/server/.env"
  chmod 600 "$DEPLOY_ROOT/shared/server/.env"
else
  cmp -s "$CURRENT_SERVER_DIR/.env" "$DEPLOY_ROOT/shared/server/.env" || {
    echo 'Shared environment differs from active environment; reconcile without printing contents'
    exit 1
  }
fi

if [ -d "$CURRENT_PROJECT_ROOT/upload" ] && [ -z "$(find "$DEPLOY_ROOT/shared/upload" -mindepth 1 -print -quit)" ]; then
  cp -a "$CURRENT_PROJECT_ROOT/upload/." "$DEPLOY_ROOT/shared/upload/"
fi
printf 'nginx_backup=true shared_state_ready=true\n'
```

- [ ] **Step 3: Fetch the exact remote commit into a detached release worktree**

```bash
if [ ! -d "$DEPLOY_ROOT/repository.git" ]; then
  git clone --mirror https://github.com/maheshenga/agentstudio.git "$DEPLOY_ROOT/repository.git"
else
  git --git-dir="$DEPLOY_ROOT/repository.git" fetch origin --prune
fi

REMOTE_MAIN="$(git --git-dir="$DEPLOY_ROOT/repository.git" rev-parse refs/heads/main)"
test "$REMOTE_MAIN" = "$RELEASE_ID"
RELEASE_DIR="$DEPLOY_ROOT/releases/$RELEASE_ID"
if [ -d "$RELEASE_DIR" ]; then
  test "$(git -C "$RELEASE_DIR" rev-parse HEAD)" = "$RELEASE_ID"
  test -z "$(git -C "$RELEASE_DIR" status --porcelain --untracked-files=no)"
else
  git --git-dir="$DEPLOY_ROOT/repository.git" worktree add --detach "$RELEASE_DIR" "$RELEASE_ID"
fi

if [ ! -e "$RELEASE_DIR/server/.env" ]; then ln -s "$DEPLOY_ROOT/shared/server/.env" "$RELEASE_DIR/server/.env"; fi
test "$(readlink -f "$RELEASE_DIR/server/.env")" = "$DEPLOY_ROOT/shared/server/.env"
if [ ! -e "$RELEASE_DIR/upload" ]; then ln -s "$DEPLOY_ROOT/shared/upload" "$RELEASE_DIR/upload"; fi
test "$(readlink -f "$RELEASE_DIR/upload")" = "$DEPLOY_ROOT/shared/upload"
if [ ! -e "$RELEASE_DIR/server/logs" ]; then
  ln -s "$DEPLOY_ROOT/shared/logs" "$RELEASE_DIR/server/logs"
fi
test "$(readlink -f "$RELEASE_DIR/server/logs")" = "$DEPLOY_ROOT/shared/logs"
git -C "$RELEASE_DIR" status --short
```

Expected: detached release is at the exact remote main commit; only ignored shared symlinks may exist.

- [ ] **Step 4: Install from lockfiles and build production assets**

```bash
cd "$RELEASE_DIR/server"
pnpm install --frozen-lockfile
pnpm run build

cd "$RELEASE_DIR/web"
pnpm install --frozen-lockfile
pnpm run build

test -f "$RELEASE_DIR/server/dist/main.js"
test -f "$RELEASE_DIR/web/dist/index.html"
printf 'candidate_build=true\n'
```

Expected: frozen installs and both production builds pass.

- [ ] **Step 5: Inspect and apply forward migrations after backup**

```bash
cd "$RELEASE_DIR/server"
pnpm run typeorm -- migration:show
```

Review every pending migration name. Confirm no pending migration requires the old release to read a removed/renamed column during the candidate health window. Then run:

```bash
pnpm run migration:run
pnpm run typeorm -- migration:show
```

Expected: migration run exits `0` and the second listing has no unexpected pending migration. Never run `migration:revert` in production.

- [ ] **Step 6: Start the candidate on an unused loopback port and verify dependencies**

```bash
CANDIDATE_PORT="$(for port in $(seq 48138 48200); do ss -lnt "sport = :$port" | grep -q LISTEN || { echo "$port"; break; }; done)"
test -n "$CANDIDATE_PORT"
cd "$RELEASE_DIR/server"
APP_PORT="$CANDIDATE_PORT" NODE_ENV=production nohup bun dist/main.js \
  > "$DEPLOY_ROOT/shared/logs/candidate-${RELEASE_ID}.log" 2>&1 &
CANDIDATE_PID=$!
trap 'kill "$CANDIDATE_PID" 2>/dev/null || true' EXIT

if [ "$APP_API_PREFIX" = 'nest-api' ]; then
  CANDIDATE_HEALTH="http://127.0.0.1:${CANDIDATE_PORT}/nest-api/api/health"
else
  CANDIDATE_HEALTH="http://127.0.0.1:${CANDIDATE_PORT}/api/health"
fi

for attempt in $(seq 1 30); do
  if HEALTH="$(curl --fail --silent --show-error --max-time 5 "$CANDIDATE_HEALTH" 2>/dev/null)"; then break; fi
  sleep 2
done
test -n "${HEALTH:-}"
node -e "const h=JSON.parse(process.argv[1]); if(h.status!=='ok'||h.dependencies?.mysql!=='up'||h.dependencies?.redis!=='up') process.exit(1)" "$HEALTH"
kill "$CANDIDATE_PID"
wait "$CANDIDATE_PID" || true
trap - EXIT
printf 'candidate_health=true mysql=up redis=up\n'
```

Expected: candidate starts, health JSON is valid, MySQL and Redis are `up`, and candidate process stops cleanly.

---

### Task 8: Configure Baota Routing And Atomically Cut Over

**Files and state:**
- Update through Baota: site root and `/nest-api/` reverse proxy if current values do not match the selected prefix mode.
- Update: `/www/wwwroot/agentstudio-releases/current` symlink.
- Reload: PM2 `nextjs-server` and Nginx only after validation.

**Interfaces:**
- Consumes: healthy candidate and backed-up vhost/database.
- Produces: public traffic served by the candidate release with one consistent API prefix mode.

- [ ] **Step 1: Select the one valid Nginx prefix mode**

Source state:

```bash
source /root/agentstudio-release-state.env
```

Generate exactly one complete Baota reverse-proxy snippet from the discovered port and prefix:

```bash
LOCATION_SNIPPET=/root/agentstudio-nest-api-location.conf
if [ -z "$APP_API_PREFIX" ] || [ "$APP_API_PREFIX" = 'api' ]; then
  cat > "$LOCATION_SNIPPET" <<EOF
location /nest-api/ {
    proxy_pass http://127.0.0.1:${APP_PORT}/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}
EOF
else
  cat > "$LOCATION_SNIPPET" <<EOF
location /nest-api/ {
    proxy_pass http://127.0.0.1:${APP_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
}
EOF
fi
chmod 600 "$LOCATION_SNIPPET"
sed -n '1,20p' "$LOCATION_SNIPPET"
```

Expected: empty/`api` mode generates a trailing-slash upstream that strips `/nest-api`; `nest-api` mode generates a no-trailing-slash upstream that preserves it.

After Task 8 Step 2 creates `current`, use Baota to apply the generated location snippet and set the site directory to:

```text
/www/wwwroot/agentstudio-releases/current/web/dist
```

Do not apply the snippet if another `/nest-api` rewrite or proxy layer would duplicate stripping/preservation.

- [ ] **Step 2: Atomically switch the release pointer**

```bash
set -euo pipefail
source /root/agentstudio-release-state.env
RELEASE_DIR="$DEPLOY_ROOT/releases/$RELEASE_ID"
test -f "$RELEASE_DIR/server/dist/main.js"
test -f "$RELEASE_DIR/web/dist/index.html"
ln -sfn "$RELEASE_DIR" "$DEPLOY_ROOT/current.next"
mv -Tf "$DEPLOY_ROOT/current.next" "$DEPLOY_ROOT/current"
test "$(readlink -f "$DEPLOY_ROOT/current")" = "$RELEASE_DIR"
```

- [ ] **Step 3: Validate Nginx and reload PM2 from the new release**

In Baota, set the site directory to `/www/wwwroot/agentstudio-releases/current/web/dist`, replace the existing `/nest-api/` location with the complete contents of `/root/agentstudio-nest-api-location.conf`, and save without changing TLS or unrelated locations. Then run:

```bash
nginx -t
cd "$DEPLOY_ROOT/current/server"
NODE_ENV=production pm2 startOrReload ecosystem.config.cjs --interpreter bun --update-env
pm2 save
pm2 status nextjs-server

if [ "$APP_API_PREFIX" = 'nest-api' ]; then
  DIRECT_HEALTH="http://127.0.0.1:${APP_PORT}/nest-api/api/health"
else
  DIRECT_HEALTH="http://127.0.0.1:${APP_PORT}/api/health"
fi
curl --fail --silent --show-error --max-time 10 "$DIRECT_HEALTH"
printf '\n'
nginx -s reload
curl --fail --silent --show-error --max-time 10 https://studio.qingyouai.com/nest-api/api/health
printf '\n'
```

Expected: PM2 is online, direct health succeeds before Nginx reload, and public health succeeds after reload.

- [ ] **Step 4: Use the rollback procedure immediately if cutover health fails**

Only when `PREVIOUS_RELEASE` is non-empty and public/direct health fails:

```bash
test -n "$PREVIOUS_RELEASE"
test -d "$PREVIOUS_RELEASE"
ln -sfn "$PREVIOUS_RELEASE" "$DEPLOY_ROOT/current.rollback"
mv -Tf "$DEPLOY_ROOT/current.rollback" "$DEPLOY_ROOT/current"
cd "$DEPLOY_ROOT/current/server"
NODE_ENV=production pm2 startOrReload ecosystem.config.cjs --interpreter bun --update-env
nginx -t
nginx -s reload
pm2 status nextjs-server
```

Expected: previous application release is restored. Do not revert database migrations automatically; use a forward fix if schema compatibility prevents application rollback.

---

### Task 9: Verify Public Login, Run Smoke, Observe, And Close P0

**Files and state:**
- Read-only public probes against `https://studio.qingyouai.com`.
- Read bounded PM2 logs without environment dumps.
- Update: release evidence in the final task report; no credential artifact.

**Interfaces:**
- Consumes: publicly healthy release.
- Produces: public smoke, controlled login, app-open, and 15-minute stability evidence.

- [ ] **Step 1: Run the existing public live smoke locally**

```powershell
Push-Location 'E:\code\agentstudio\FssAdmin_NestJs\web'
try {
  $env:SAAS_PUBLIC_LIVE_BASE_URL = 'https://studio.qingyouai.com'
  pnpm.cmd run verify:saas-public-live-smoke
  if ($LASTEXITCODE -ne 0) { throw 'Public live smoke failed' }
} finally {
  Remove-Item Env:SAAS_PUBLIC_LIVE_BASE_URL -ErrorAction SilentlyContinue
  Pop-Location
}
```

Expected: shell, SPA fallback, robots, sitemap, SEO origin, and static assets pass.

- [ ] **Step 2: Verify public health and login configuration without credentials**

```powershell
$health = Invoke-RestMethod -Method Get -Uri 'https://studio.qingyouai.com/nest-api/api/health' -TimeoutSec 10
if ($health.status -ne 'ok' -or $health.dependencies.mysql -ne 'up' -or $health.dependencies.redis -ne 'up') {
  throw 'Public dependency health failed'
}
$captcha = Invoke-RestMethod -Method Get -Uri 'https://studio.qingyouai.com/nest-api/api/core/login-captcha' -TimeoutSec 10
Write-Output "public_health=ok mysql=up redis=up login_config_reachable=true"
```

Expected: no gateway error and no credential output.

- [ ] **Step 3: Verify controlled platform and tenant login in the browser**

Using the in-app browser and existing approved credentials:

1. Open `https://studio.qingyouai.com` in a fresh login state.
2. Log in as the platform administrator.
3. Confirm dashboard/menu requests complete without 502, network error, or repeated redirect.
4. Log out without printing browser storage.
5. Log in as a tenant owner.
6. Open the marketplace and one installed app.
7. Confirm no failed `/nest-api` request appears in the browser network/console view.

Expected: both roles authenticate and the tenant app opens. Do not capture tokens, cookies, passwords, or full login responses in screenshots/logs.

- [ ] **Step 4: Observe production health for exactly 15 minutes**

Run on the server:

```bash
set -euo pipefail
source /root/agentstudio-release-state.env
START_RESTARTS="$(pm2 jlist | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s).find(x=>x.name==='nextjs-server');process.stdout.write(String(a?.pm2_env?.restart_time ?? -1))})")"

for attempt in $(seq 1 30); do
  curl --fail --silent --show-error --max-time 10 https://studio.qingyouai.com/nest-api/api/health >/dev/null
  sleep 30
done

END_RESTARTS="$(pm2 jlist | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s).find(x=>x.name==='nextjs-server');process.stdout.write(String(a?.pm2_env?.restart_time ?? -1))})")"
test "$START_RESTARTS" = "$END_RESTARTS"
pm2 status nextjs-server
printf 'observation_15m=passed restart_count_stable=true\n'
```

Expected: 30 probes pass and PM2 restart count does not change. Do not use `pm2 jlist` without piping directly into the bounded parser because its raw JSON may include environment data. Inspect bounded logs only after a failed probe, and redact credential fields before returning any excerpt.

- [ ] **Step 5: Final review and release report**

Report only:

- deployed commit ID;
- local aggregate and app gate results;
- whether full runtime E2E was reused or re-run;
- Baota database and Nginx backup completion, without secret paths that expose credentials;
- direct/public health results;
- platform and tenant login results;
- public smoke result;
- PM2 stability result;
- previous release retained for at least 24 hours;
- remaining P1 scope: P9-B runtime sessions and capability gateway.

Expected: P0 is complete only when every required checkpoint passes. No additional source commit is required unless a reviewed release fix was necessary.

---

## Plan Self-Review

- Spec coverage: Tasks 1-2 preserve local changes and fast-forward main; Tasks 3-4 run repository and app gates; Task 5 reviews and gates remote push; Tasks 6-8 discover, back up, build, health-check, route, cut over, and roll back; Task 9 verifies public smoke, login, app open, and stability.
- Secret boundary: the plan never embeds a server, database, application, payment, or user password. Environment content is copied and hashed opaquely and is never diffed, staged, stashed, or printed.
- Type/variable consistency: local state uses `main`, `feature`, `backupRoot`, `releaseCommit`, and `mainBefore`; server state uses `VHOST`, `DEPLOY_ROOT`, `CURRENT_SERVER_DIR`, `CURRENT_PROJECT_ROOT`, `APP_PORT`, `APP_API_PREFIX`, `RELEASE_ID`, and `PREVIOUS_RELEASE` consistently.
- Scope: P0 contains release integration and deployment recovery only. Product/runtime feature development starts in a separate P1 specification and plan.
