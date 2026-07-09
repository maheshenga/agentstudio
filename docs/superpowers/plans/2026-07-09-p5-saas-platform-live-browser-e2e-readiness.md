# P5 SaaS Platform Live Browser E2E Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The project owner asked to continue inline and not use subagents for interrupted continuation work.

**Goal:** Add an opt-in read-only browser E2E verifier for the platform administrator SaaS backend UI.

**Architecture:** Reuse the existing tenant live browser E2E shape: authenticate against the live backend, inject the authenticated user state into the built frontend, proxy browser API calls to the live backend, then visit platform SaaS routes and assert they render without login redirects or exception pages. Keep it outside the default readiness gate because it depends on seeded platform administrator credentials and a running backend.

**Tech Stack:** TypeScript, Playwright Chromium, Vite preview, Vue SPA hash routes, existing SaaS live backend APIs.

## Global Constraints

- Do not print passwords, access tokens, refresh tokens, or unmasked secret values.
- Do not mutate tenants, plans, modules, orders, subscriptions, resource packs, or payment config.
- Do not add this command to the default root readiness gate.
- Keep invoice functionality out of scope.
- Use PowerShell command examples with `pnpm.cmd`.
- The script must fail fast with clear missing environment variable messages.

---

### Task 1: Frontend Contract Guard

**Files:**
- Modify: `web/scripts/verify-saas-readiness-command.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: existing frontend readiness command contract.
- Produces: assertions that `web/scripts/verify-saas-platform-live-browser-e2e.ts`, package script `verify:saas-platform-live-browser-e2e`, and checklist documentation exist.

- [ ] **Step 1: Write failing contract assertions**

Add assertions near the existing live browser E2E checks:

```typescript
const platformLiveBrowserE2EPath = resolve(
  process.cwd(),
  'scripts/verify-saas-platform-live-browser-e2e.ts'
)
assert(
  existsSync(platformLiveBrowserE2EPath),
  'scripts/verify-saas-platform-live-browser-e2e.ts must exist'
)
assert(
  packageJson.scripts?.['verify:saas-platform-live-browser-e2e'] ===
    'tsx scripts/verify-saas-platform-live-browser-e2e.ts',
  'package.json must define verify:saas-platform-live-browser-e2e'
)
assertIncludes(
  checklist,
  'pnpm.cmd run verify:saas-platform-live-browser-e2e',
  'launch readiness checklist'
)
assertIncludes(
  checklist,
  'SAAS_PLATFORM_LIVE_E2E_WEB_URL',
  'launch readiness checklist'
)
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: FAIL because the platform live browser script, package script, and checklist docs do not exist yet.

---

### Task 2: Read-Only Platform Browser Script

**Files:**
- Create: `web/scripts/verify-saas-platform-live-browser-e2e.ts`
- Modify: `web/package.json`

**Interfaces:**
- Consumes environment:
  - `SAAS_PLATFORM_LIVE_E2E_BASE_URL`
  - `SAAS_PLATFORM_LIVE_E2E_USERNAME`
  - `SAAS_PLATFORM_LIVE_E2E_PASSWORD`
  - optional `SAAS_PLATFORM_LIVE_E2E_TENANT_ID`
  - optional `SAAS_PLATFORM_LIVE_E2E_WEB_URL`
  - optional `SAAS_PLATFORM_LIVE_E2E_WEB_PORT`
  - optional `SAAS_PLATFORM_LIVE_E2E_APP_VERSION`
- Produces command:
  - `pnpm.cmd run verify:saas-platform-live-browser-e2e`

- [ ] **Step 1: Implement missing-env behavior**

The script must use this required env shape:

```typescript
const failures: string[] = []
const baseUrl = requiredEnv('SAAS_PLATFORM_LIVE_E2E_BASE_URL')
const username = requiredEnv('SAAS_PLATFORM_LIVE_E2E_USERNAME')
const password = requiredEnv('SAAS_PLATFORM_LIVE_E2E_PASSWORD')

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    failures.push(`${name} is required for platform live SaaS browser E2E`)
    return ''
  }
  return value
}
```

- [ ] **Step 2: Authenticate as platform administrator**

Use the same platform admin bootstrap as `server/scripts/verify-saas-platform-live-e2e.ts`:

```text
POST /api/core/tenants-by-credentials
POST /api/core/login
GET /api/core/system/user
```

Assert the profile has one of:

```typescript
profile?.is_platform_admin === true ||
profile?.is_admin === true ||
profile?.account_scope === 'platform'
```

- [ ] **Step 3: Start or reuse frontend**

If `SAAS_PLATFORM_LIVE_E2E_WEB_URL` is unset, assert `dist/index.html` and `node_modules/vite/bin/vite.js` exist, then start:

```text
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port <port> --strictPort
```

Default port: `4183`.

- [ ] **Step 4: Proxy browser API calls**

Route `**/api/**` and `**/nest-api/**` to the live backend while preserving method, query string, request body, authorization header, and content type.

- [ ] **Step 5: Visit read-only platform pages**

Visit these hash routes and assert each page:
- does not redirect to `#/auth/login`
- does not route to an exception page
- renders non-empty body text
- does not render status-only `404` or `500`
- produces no page errors

```text
/#/saas-platform/tenants
/#/saas-platform/plans
/#/saas-platform/module
/#/saas-platform/subscription
/#/saas-platform/usage
/#/saas-platform/revenue
/#/saas-platform/resource-packs
/#/saas-platform/resource-pack-orders
/#/saas-platform/payment-config
```

- [ ] **Step 6: Add package script**

Modify `web/package.json`:

```json
"verify:saas-platform-live-browser-e2e": "tsx scripts/verify-saas-platform-live-browser-e2e.ts"
```

- [ ] **Step 7: Run negative check**

Run:

```powershell
cd web
pnpm.cmd run verify:saas-platform-live-browser-e2e
```

Expected without env: FAIL with clear missing env messages and no secret output.

---

### Task 3: Checklist Documentation

**Files:**
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: command and env contract from Task 2.
- Produces: operator instructions for the optional platform browser live E2E gate.

- [ ] **Step 1: Add optional platform browser live E2E section**

Add after the optional platform admin live E2E section:

```markdown
### Optional Platform Admin Live Browser E2E Gate

Run this after `cd web` and `pnpm.cmd build` when a live backend with seeded platform administrator credentials is available:

```powershell
cd web
$env:SAAS_PLATFORM_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_PLATFORM_LIVE_E2E_USERNAME = '<seeded-platform-admin-username>'
$env:SAAS_PLATFORM_LIVE_E2E_PASSWORD = '<seeded-platform-admin-password>'
# Optional: force the tenant used only for the existing tenant-scoped login bootstrap
$env:SAAS_PLATFORM_LIVE_E2E_TENANT_ID = '<tenant-id>'
# Optional: use an already running frontend instead of Vite preview
$env:SAAS_PLATFORM_LIVE_E2E_WEB_URL = 'http://127.0.0.1:5731'
pnpm.cmd run verify:saas-platform-live-browser-e2e
```

This command is read-only. It verifies the platform administrator can open tenant, plan, module, subscription, usage, revenue, resource-pack, resource-pack order, and payment configuration pages against a live backend.
```

---

### Task 4: Verification and Commit

**Files:**
- No new implementation files.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: reviewed commit.

- [ ] **Step 1: Run focused checks**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
pnpm.cmd run verify:saas-platform-live-browser-e2e
```

Expected:
- readiness command script PASS.
- platform live browser E2E missing-env command FAILS intentionally with only missing env messages.

- [ ] **Step 2: Run type check for the new script**

Run:

```powershell
cd web
pnpm.cmd exec tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --lib ES2022,DOM,DOM.Iterable scripts/verify-saas-platform-live-browser-e2e.ts
```

Expected: exit 0.

- [ ] **Step 3: Run frontend and root readiness**

Run:

```powershell
cd web
pnpm.cmd run verify:saas-readiness
cd ..
node scripts\run-saas-readiness.cjs
```

Expected: both exit 0.

- [ ] **Step 4: Review diff**

Run:

```powershell
git diff --check
git diff --stat
git status --short --branch
```

Expected: no whitespace errors; only intended files changed.

- [ ] **Step 5: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-09-p5-saas-platform-live-browser-e2e-readiness.md docs/saas-launch-readiness-checklist.md web/package.json web/scripts/verify-saas-platform-live-browser-e2e.ts web/scripts/verify-saas-readiness-command.ts
git commit -m "test: add saas platform live browser e2e readiness"
```

Expected: commit succeeds. Do not push unless the user explicitly asks.

## Self-Review

- Spec coverage: The plan covers a P5 plan, read-only platform browser live E2E script, frontend readiness guard, docs, verification, review, and commit steps.
- Placeholder scan: No TBD/TODO or incomplete implementation language remains.
- Type consistency: Environment names, script names, package script names, and file paths match across tasks.
