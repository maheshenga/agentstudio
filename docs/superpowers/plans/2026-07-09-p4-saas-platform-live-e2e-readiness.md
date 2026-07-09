# P4 SaaS Platform Live E2E Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The project owner asked to continue inline and not use subagents for interrupted continuation work.

**Goal:** Add an opt-in read-only live E2E verifier for platform administrator SaaS APIs, including runtime health, platform tenants, plans, modules, usage, subscriptions, orders, revenue, resource packs, payment reconciliation, notify logs, and Alipay configuration.

**Architecture:** Keep this outside the default repository readiness gate because it depends on a running backend and seeded platform administrator credentials. Reuse the authentication and API envelope patterns from `server/scripts/verify-saas-live-e2e.ts`, but make the new script read-only and platform-admin scoped. Guard the script through the existing backend readiness command spec and document it in the launch checklist.

**Tech Stack:** TypeScript, tsx, NestJS HTTP APIs, Jest contract guard.

## Global Constraints

- Do not print passwords, access tokens, refresh tokens, or unmasked secret values.
- Do not mutate SaaS data in this script.
- Do not add this command to the default root readiness gate.
- Keep invoice functionality out of scope.
- Use PowerShell command examples with `pnpm.cmd`.
- The script must fail fast with clear missing environment variable messages.

---

### Task 1: Backend Contract Guard

**Files:**
- Modify: `server/src/config/saas-readiness-command.spec.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: existing backend readiness command spec.
- Produces: assertions that `server/scripts/verify-saas-platform-live-e2e.ts`, package script `verify:saas-platform-live-e2e`, and checklist documentation exist.

- [ ] **Step 1: Write the failing contract assertions**

Add these assertions near the existing live E2E checks in `server/src/config/saas-readiness-command.spec.ts`:

```typescript
const platformLiveE2eScript = join(REPO_ROOT, 'server/scripts/verify-saas-platform-live-e2e.ts');
expect(existsSync(platformLiveE2eScript)).toBe(true);
expect(packageJson.scripts?.['verify:saas-platform-live-e2e']).toBe('tsx scripts/verify-saas-platform-live-e2e.ts');
expect(checklist).toContain('pnpm.cmd run verify:saas-platform-live-e2e');
expect(checklist).toContain('SAAS_PLATFORM_LIVE_E2E_BASE_URL');
expect(checklist).toContain('SAAS_PLATFORM_LIVE_E2E_USERNAME');
expect(checklist).toContain('SAAS_PLATFORM_LIVE_E2E_PASSWORD');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- saas-readiness-command.spec.ts
```

Expected: FAIL because the platform live E2E script, package script, and checklist docs do not exist yet.

---

### Task 2: Read-Only Platform Live E2E Script

**Files:**
- Create: `server/scripts/verify-saas-platform-live-e2e.ts`
- Modify: `server/package.json`

**Interfaces:**
- Consumes environment:
  - `SAAS_PLATFORM_LIVE_E2E_BASE_URL`
  - `SAAS_PLATFORM_LIVE_E2E_USERNAME`
  - `SAAS_PLATFORM_LIVE_E2E_PASSWORD`
  - optional `SAAS_PLATFORM_LIVE_E2E_TENANT_ID`
- Produces command:
  - `pnpm.cmd run verify:saas-platform-live-e2e`

- [ ] **Step 1: Implement missing-env behavior**

The script must use this shape:

```typescript
const failures: string[] = [];
const baseUrl = requiredEnv('SAAS_PLATFORM_LIVE_E2E_BASE_URL');
const username = requiredEnv('SAAS_PLATFORM_LIVE_E2E_USERNAME');
const password = requiredEnv('SAAS_PLATFORM_LIVE_E2E_PASSWORD');

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    failures.push(`${name} is required for platform live SaaS E2E`);
    return '';
  }
  return value;
}
```

- [ ] **Step 2: Authenticate through existing tenant-scoped login**

Use the same credential-gated tenant lookup and login endpoint as `verify-saas-live-e2e.ts`:

```typescript
POST /api/core/tenants-by-credentials
POST /api/core/login
GET /api/core/system/user
```

Select `SAAS_PLATFORM_LIVE_E2E_TENANT_ID` when set, otherwise the first credential-matched tenant. Assert the profile has `is_platform_admin === true` or `account_scope === 'platform'`.

- [ ] **Step 3: Verify read-only platform endpoints**

Call these endpoints with the bearer token and assert JSON success envelopes:

```typescript
GET /api/core/system/menu
GET /api/saas/platform/runtime-health
GET /api/saas/platform/tenants?page=1&limit=1
GET /api/saas/platform/plans?page=1&limit=1
GET /api/saas/platform/modules
GET /api/saas/platform/usage/overview
GET /api/saas/platform/revenue/overview
GET /api/saas/platform/orders?page=1&limit=1
GET /api/saas/platform/orders/risk/overview
GET /api/saas/platform/payment/reconciliation/overview
GET /api/saas/platform/payment/notify-logs?page=1&limit=1
GET /api/saas/platform/subscriptions?page=1&limit=1
GET /api/saas/platform/subscriptions/lifecycle/overview
GET /api/saas/platform/quota-ledgers?page=1&limit=1
GET /api/saas/platform/resource-packs?page=1&limit=1
GET /api/saas/platform/resource-pack-orders?page=1&limit=1
GET /api/saas/platform/payment/alipay/config
```

- [ ] **Step 4: Check runtime-health redaction**

For the runtime-health payload, serialize it and assert it does not contain the supplied password or obvious secret markers:

```typescript
assert(!runtimeHealthText.includes(password), 'runtime health must not expose the supplied password');
assert(!/private_key|BEGIN RSA PRIVATE KEY|BEGIN PRIVATE KEY/i.test(runtimeHealthText), 'runtime health must not expose private key material');
```

- [ ] **Step 5: Add package script**

Modify `server/package.json`:

```json
"verify:saas-platform-live-e2e": "tsx scripts/verify-saas-platform-live-e2e.ts"
```

- [ ] **Step 6: Run negative check**

Run:

```powershell
cd server
pnpm.cmd run verify:saas-platform-live-e2e
```

Expected without env: FAIL with clear missing env messages and no secret output.

---

### Task 3: Checklist Documentation

**Files:**
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: command and env contract from Task 2.
- Produces: operator instructions for the optional platform live E2E gate.

- [ ] **Step 1: Add optional platform live E2E section**

Add after the optional live backend E2E section:

```markdown
### Optional Platform Admin Live E2E Gate

Run this against a running backend with seeded platform administrator credentials before staging or production release:

```powershell
cd server
$env:SAAS_PLATFORM_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_PLATFORM_LIVE_E2E_USERNAME = '<seeded-platform-admin-username>'
$env:SAAS_PLATFORM_LIVE_E2E_PASSWORD = '<seeded-platform-admin-password>'
# Optional: force the tenant used only for the existing tenant-scoped login bootstrap
$env:SAAS_PLATFORM_LIVE_E2E_TENANT_ID = '<tenant-id>'
pnpm.cmd run verify:saas-platform-live-e2e
```
```

- [ ] **Step 2: Document read-only scope**

Add:

```markdown
This command is read-only. It verifies platform administrator access to runtime health, tenant, plan, module, usage, revenue, order risk, reconciliation, subscription, quota ledger, resource-pack, notify-log, and Alipay configuration APIs.
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
cd server
pnpm.cmd exec jest --runInBand -- saas-readiness-command.spec.ts
pnpm.cmd run verify:saas-platform-live-e2e
```

Expected:
- readiness command spec PASS.
- platform live E2E missing-env command FAILS intentionally with only missing env messages.

- [ ] **Step 2: Run backend and root readiness**

Run:

```powershell
cd server
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
git add docs/superpowers/plans/2026-07-09-p4-saas-platform-live-e2e-readiness.md docs/saas-launch-readiness-checklist.md server/package.json server/scripts/verify-saas-platform-live-e2e.ts server/src/config/saas-readiness-command.spec.ts
git commit -m "test: add saas platform live e2e readiness"
```

Expected: commit succeeds. Do not push unless the user explicitly asks.

## Self-Review

- Spec coverage: The plan covers a detailed P4 plan, read-only platform live E2E script, readiness guard, docs, verification, review, and commit steps.
- Placeholder scan: No TBD/TODO or incomplete implementation language remains.
- Type consistency: Environment names, script names, package script names, and file paths match across tasks.
