# P3 SaaS Live Browser E2E Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This project owner asked to continue inline and not use subagents for this interrupted task.

**Goal:** Add an opt-in browser E2E verifier that proves a seeded tenant owner can open the built SaaS UI, load subscription/plan data through a real backend, create an upgrade order, and optionally confirm development payment.

**Architecture:** Keep this outside the default readiness gate because it depends on a live backend and seeded credentials. Reuse the existing Playwright dependency and Vite preview pattern from `web/scripts/verify-saas-browser-smoke.ts`, but authenticate through live backend APIs and proxy browser `/api` or `/nest-api` calls to `SAAS_LIVE_E2E_BASE_URL`. Guard the new script through the existing frontend readiness contract so future changes cannot delete it silently.

**Tech Stack:** TypeScript, tsx, Playwright Chromium, Vite preview, Pinia persisted localStorage, NestJS SaaS APIs.

## Global Constraints

- Do not print passwords, access tokens, or refresh tokens.
- Do not add this command to the default root readiness gate.
- Keep invoice functionality out of scope.
- Use PowerShell command examples with `pnpm.cmd`.
- The script must fail fast with clear missing environment variable messages.
- `SAAS_LIVE_E2E_RUN_PAYMENT=1` must remain opt-in because it mutates seeded order/subscription data.

---

### Task 1: Contract Guard

**Files:**
- Modify: `web/scripts/verify-saas-readiness-command.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: existing frontend readiness contract verifier.
- Produces: assertions that `web/scripts/verify-saas-live-browser-e2e.ts`, `package.json` script `verify:saas-live-browser-e2e`, and checklist documentation exist.

- [ ] **Step 1: Write the failing contract assertions**

Add these assertions near the existing browser smoke checks in `web/scripts/verify-saas-readiness-command.ts`:

```typescript
const liveBrowserE2EPath = resolve(process.cwd(), 'scripts/verify-saas-live-browser-e2e.ts')
assert(existsSync(liveBrowserE2EPath), 'scripts/verify-saas-live-browser-e2e.ts must exist')
assert(
  packageJson.scripts?.['verify:saas-live-browser-e2e'] ===
    'tsx scripts/verify-saas-live-browser-e2e.ts',
  'package.json must define verify:saas-live-browser-e2e'
)
assertIncludes(
  checklist,
  'pnpm.cmd run verify:saas-live-browser-e2e',
  'launch readiness checklist'
)
assertIncludes(
  checklist,
  'SAAS_LIVE_E2E_WEB_URL',
  'launch readiness checklist'
)
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: FAIL with messages that `verify-saas-live-browser-e2e.ts`, package script, and checklist docs are missing.

- [ ] **Step 3: Do not implement in this task**

Leave the guard red until Task 2 creates the script and package entry.

---

### Task 2: Live Browser E2E Script

**Files:**
- Create: `web/scripts/verify-saas-live-browser-e2e.ts`
- Modify: `web/package.json`

**Interfaces:**
- Consumes environment:
  - `SAAS_LIVE_E2E_BASE_URL`
  - `SAAS_LIVE_E2E_USERNAME`
  - `SAAS_LIVE_E2E_PASSWORD`
  - optional `SAAS_LIVE_E2E_TENANT_ID`
  - optional `SAAS_LIVE_E2E_WEB_URL`
  - optional `SAAS_LIVE_E2E_WEB_PORT`
  - optional `SAAS_LIVE_E2E_PLAN_CODE`
  - optional `SAAS_LIVE_E2E_BILLING_CYCLE`
  - optional `SAAS_LIVE_E2E_RUN_PAYMENT=1`
- Produces command:
  - `pnpm.cmd run verify:saas-live-browser-e2e`

- [ ] **Step 1: Create missing-env behavior**

The script must use this environment validation shape:

```typescript
const failures: string[] = []
const baseUrl = requiredEnv('SAAS_LIVE_E2E_BASE_URL')
const username = requiredEnv('SAAS_LIVE_E2E_USERNAME')
const password = requiredEnv('SAAS_LIVE_E2E_PASSWORD')

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    failures.push(`${name} is required for live SaaS browser E2E`)
    return ''
  }
  return value
}
```

- [ ] **Step 2: Add login API helpers**

Implement `requestJson`, `assertOk`, tenant lookup, tenant selection, and login using the same endpoint contract as `server/scripts/verify-saas-live-e2e.ts`:

```typescript
await requestJson('/api/core/tenants-by-credentials', {
  method: 'POST',
  body: { username, password }
})
await requestJson('/api/core/login', {
  method: 'POST',
  body: { username, password, tenant_id: selectedTenantId }
})
await requestJson('/api/core/system/user', { token: accessToken })
```

- [ ] **Step 3: Add preview startup**

If `SAAS_LIVE_E2E_WEB_URL` is not set, assert `dist/index.html` and `node_modules/vite/bin/vite.js`, then run:

```typescript
spawn(process.execPath, [viteCli, 'preview', '--host', host, '--port', String(webPort), '--strictPort'])
```

If `SAAS_LIVE_E2E_WEB_URL` is set, do not start preview.

- [ ] **Step 4: Add browser API proxy**

Use Playwright route interception to rewrite frontend API calls:

```typescript
const pathname = requestUrl.pathname
if (pathname.startsWith('/nest-api/')) targetPath = `/api/${pathname.slice('/nest-api/'.length)}`
else if (pathname.startsWith('/api/')) targetPath = pathname
```

Forward method, headers except `host` and `content-length`, and body to `SAAS_LIVE_E2E_BASE_URL`. Fulfill browser requests with the live backend response body and status.

- [ ] **Step 5: Inject Pinia persisted user state**

Before opening the app route, add init script:

```typescript
window.localStorage.setItem(
  `sys-v${appVersion}-user`,
  JSON.stringify({
    isLogin: true,
    accessToken,
    refreshToken,
    info: userInfo,
    language: 'zh',
    isLock: false,
    lockPassword: '',
    searchHistory: []
  })
)
```

Default `appVersion` to `3.0.1`, with optional override `SAAS_LIVE_E2E_APP_VERSION`.

- [ ] **Step 6: Verify visible SaaS plan page**

Navigate to `/#/tenant-saas/plan` and assert:

```typescript
await page.waitForSelector('.tenant-plan-page__plan-card', { timeout: 30_000 })
await page.waitForSelector('.tenant-plan-page__orders', { timeout: 30_000 })
```

Also assert no login redirect and no exception route:

```typescript
assert(!page.url().includes('#/auth/login'), 'tenant plan page must not redirect to login')
assert(!page.url().includes('exception'), 'tenant plan page must not route to exception page')
```

- [ ] **Step 7: Verify order creation and optional dev payment**

Click the plan card matching `SAAS_LIVE_E2E_PLAN_CODE` or the first enabled purchase button. Assert `.tenant-plan-page__order` appears and contains an order number-like text. If `SAAS_LIVE_E2E_RUN_PAYMENT=1`, click the visible development payment button and assert the pending order panel disappears or no longer shows a pending order after reload.

- [ ] **Step 8: Add package script**

Modify `web/package.json`:

```json
"verify:saas-live-browser-e2e": "tsx scripts/verify-saas-live-browser-e2e.ts"
```

- [ ] **Step 9: Run negative check**

Run:

```powershell
cd web
pnpm.cmd run verify:saas-live-browser-e2e
```

Expected without env: FAIL with clear missing env messages and no secret output.

---

### Task 3: Documentation

**Files:**
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: command and env contract from Task 2.
- Produces: operator instructions for optional browser E2E.

- [ ] **Step 1: Add optional live browser E2E section**

Add a section after the optional live backend E2E gate:

```markdown
### Optional Live Browser E2E Gate

Run this after `cd web` and `pnpm.cmd build` when a live backend with seeded SaaS data is available.

```powershell
cd web
$env:SAAS_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_LIVE_E2E_USERNAME = '<seeded-tenant-owner-username>'
$env:SAAS_LIVE_E2E_PASSWORD = '<seeded-tenant-owner-password>'
$env:SAAS_LIVE_E2E_WEB_URL = 'http://127.0.0.1:4182'
pnpm.cmd run verify:saas-live-browser-e2e
```
```

- [ ] **Step 2: Document mutation switch**

Add:

```markdown
Set `SAAS_LIVE_E2E_RUN_PAYMENT=1` only in disposable seeded environments. The script will create an upgrade order and click the local development payment confirmation control.
```

- [ ] **Step 3: Update out-of-scope note**

Replace the old note that full seeded browser UI payment E2E is outside coverage with a note that it is available as an optional gate and intentionally excluded from the default repository gate.

---

### Task 4: Verification and Commit

**Files:**
- No new implementation files.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: reviewed commit.

- [ ] **Step 1: Run focused green checks**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
pnpm.cmd run verify:saas-live-browser-e2e
```

Expected:
- readiness command PASS.
- live browser E2E missing-env command FAILS intentionally with only missing env messages.

- [ ] **Step 2: Run frontend and root readiness**

Run:

```powershell
cd web
pnpm.cmd run verify:saas-readiness
cd ..
node scripts\run-saas-readiness.cjs
```

Expected: both exit 0.

- [ ] **Step 3: Review diff**

Run:

```powershell
git diff --check
git diff --stat
git status --short --branch
```

Expected: no whitespace errors; only intended files changed.

- [ ] **Step 4: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-09-p3-saas-live-browser-e2e-readiness.md docs/saas-launch-readiness-checklist.md web/package.json web/scripts/verify-saas-readiness-command.ts web/scripts/verify-saas-live-browser-e2e.ts
git commit -m "test: add saas live browser e2e readiness"
```

Expected: commit succeeds. Do not push unless the user explicitly asks.

## Self-Review

- Spec coverage: The plan adds a detailed P3 superpowers plan, opt-in browser E2E script, readiness guard, docs, verification, review, and commit steps.
- Placeholder scan: No TODO, TBD, or deferred implementation language remains.
- Type consistency: Environment names, script names, package script names, and file paths match across tasks.
