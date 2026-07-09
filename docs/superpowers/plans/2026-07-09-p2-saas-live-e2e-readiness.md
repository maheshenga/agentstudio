# P2 SaaS Live E2E Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in live SaaS E2E readiness command that validates a running backend with seeded credentials through login, tenant context, core SaaS read APIs, and explicit dev-payment confirmation.

**Architecture:** Keep the default repository readiness deterministic and database-free. Add a separate backend script `verify:saas-live-e2e` that runs only when an operator provides a base URL and seeded credentials. Guard the script's existence and checklist documentation from the existing backend readiness command spec so the live gate cannot silently drift.

**Tech Stack:** Node 20+, TypeScript, `tsx`, built-in `fetch`, existing NestJS API envelope `{ code, message, data }`, existing Jest readiness command spec.

## Global Constraints

- Do not add invoice functionality.
- Do not run live E2E from `node scripts/run-saas-readiness.cjs`; it depends on an external running backend and seeded data.
- Do not log passwords, access tokens, refresh tokens, private keys, or raw Alipay secrets.
- Payment mutation must be opt-in with `SAAS_LIVE_E2E_RUN_PAYMENT=1`.
- Read-only checks must run without creating orders.
- The live script must fail clearly when required env variables are missing instead of silently passing.
- Do not push to remote.

---

### Task 1: Add The Live E2E Contract Guard

**Files:**
- Modify: `server/src/config/saas-readiness-command.spec.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`
- Create: `docs/superpowers/plans/2026-07-09-p2-saas-live-e2e-readiness.md`

**Interfaces:**
- Consumes: `server/package.json` scripts, repository `docs/saas-launch-readiness-checklist.md`.
- Produces: default backend readiness guard that proves the optional live E2E command remains discoverable.

- [ ] **Step 1: Write the failing command-contract assertions**

Update `server/src/config/saas-readiness-command.spec.ts` imports:

```typescript
import { existsSync, readFileSync } from 'fs';
```

Inside `it('runs all high-value SaaS regression specs', () => { ... })`, after the existing Jest option assertions, add:

```typescript
const liveE2eScript = join(REPO_ROOT, 'server/scripts/verify-saas-live-e2e.ts');
expect(existsSync(liveE2eScript)).toBe(true);
expect(packageJson.scripts?.['verify:saas-live-e2e']).toBe('tsx scripts/verify-saas-live-e2e.ts');

const checklist = readFileSync(join(REPO_ROOT, 'docs/saas-launch-readiness-checklist.md'), 'utf8');
expect(checklist).toContain('pnpm.cmd run verify:saas-live-e2e');
expect(checklist).toContain('SAAS_LIVE_E2E_BASE_URL');
expect(checklist).toContain('SAAS_LIVE_E2E_USERNAME');
expect(checklist).toContain('SAAS_LIVE_E2E_PASSWORD');
expect(checklist).toContain('SAAS_LIVE_E2E_RUN_PAYMENT=1');
```

- [ ] **Step 2: Verify the contract fails before implementation**

Run from `server`:

```powershell
pnpm.cmd exec jest --runInBand -- saas-readiness-command.spec.ts
```

Expected: FAIL because `server/scripts/verify-saas-live-e2e.ts`, `verify:saas-live-e2e`, and checklist live E2E documentation do not exist yet.

---

### Task 2: Implement The Live E2E Script

**Files:**
- Create: `server/scripts/verify-saas-live-e2e.ts`
- Modify: `server/package.json`

**Interfaces:**
- Consumes env:
  - `SAAS_LIVE_E2E_BASE_URL`, required, for example `http://127.0.0.1:3000`
  - `SAAS_LIVE_E2E_USERNAME`, required
  - `SAAS_LIVE_E2E_PASSWORD`, required
  - `SAAS_LIVE_E2E_TENANT_ID`, optional; if omitted, the first credential-matched tenant is used
  - `SAAS_LIVE_E2E_PLAN_CODE`, optional, default `pro`
  - `SAAS_LIVE_E2E_BILLING_CYCLE`, optional, default `monthly`
  - `SAAS_LIVE_E2E_RUN_PAYMENT`, optional; only `1` enables order creation and dev confirmation
- Produces CLI:
  - `pnpm.cmd run verify:saas-live-e2e`

- [ ] **Step 1: Add the package script**

In `server/package.json`, add this script next to `verify:saas-readiness`:

```json
"verify:saas-live-e2e": "tsx scripts/verify-saas-live-e2e.ts"
```

- [ ] **Step 2: Create the live E2E script**

Create `server/scripts/verify-saas-live-e2e.ts` with these implementation units:

```typescript
type ApiEnvelope<T = unknown> = {
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
};

type RequestOptions = {
  method?: 'GET' | 'POST';
  token?: string;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
};
```

Required behavior:

```typescript
function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    failures.push(`${name} is required for live SaaS E2E`);
    return '';
  }
  return value;
}

function isSuccessEnvelope(value: ApiEnvelope): boolean {
  return Number(value.code) === 200;
}
```

HTTP helper requirements:

```typescript
async function requestJson<T>(path: string, options: RequestOptions = {}) {
  const url = new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const raw = await response.text();
  const json = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : {};
  return { response, json, raw };
}
```

Validation flow:

1. `GET /api/core/login-captcha`
   - Expect HTTP 2xx and `code === 200`.
2. `POST /api/core/tenants-by-credentials`
   - Body `{ username, password }`.
   - Expect `data` array with at least one tenant.
   - Select `SAAS_LIVE_E2E_TENANT_ID` when provided, otherwise first tenant.
3. `POST /api/core/login`
   - Body `{ username, password, tenant_id }`.
   - Expect `data.access_token`, `data.refresh_token`, `data.tenant_id`.
4. Authenticated read checks:
   - `GET /api/core/system/user`
   - `GET /api/core/system/menu`
   - `GET /api/saas/tenant/usage`
   - `GET /api/saas/tenant/plans`
   - `GET /api/saas/tenant/subscription`
   - `GET /api/saas/tenant/modules`
   - `GET /api/saas/payment/alipay/config-status`
5. If `SAAS_LIVE_E2E_RUN_PAYMENT=1`:
   - Select `SAAS_LIVE_E2E_PLAN_CODE` from `GET /api/saas/tenant/plans`.
   - `POST /api/saas/tenant/orders` with `{ plan_code, billing_cycle, payment_method: 'alipay' }`.
   - Expect `data.order_no`.
   - `POST /api/saas/payment/dev-confirm` with `{ order_no, order_type: 'plan' }`.
   - Expect `data.status === 'paid'`.
6. If payment is not enabled:
   - Print a clear skip line: `Skipping payment mutation; set SAAS_LIVE_E2E_RUN_PAYMENT=1 to verify dev payment confirmation.`

Output requirements:

```typescript
console.log(
  JSON.stringify(
    {
      base_url: baseUrl,
      username,
      tenant_id: selectedTenantId,
      read_checks: completedReadChecks,
      payment_checked: runPayment,
      plan_code: runPayment ? planCode : undefined
    },
    null,
    2
  )
);
console.log('SaaS live E2E verified.');
```

Do not print password, access token, refresh token, raw Alipay keys, or private config values.

- [ ] **Step 3: Verify the missing-env path is strict**

Run from `server` without live env:

```powershell
pnpm.cmd run verify:saas-live-e2e
```

Expected: FAIL with missing `SAAS_LIVE_E2E_BASE_URL`, `SAAS_LIVE_E2E_USERNAME`, and `SAAS_LIVE_E2E_PASSWORD`. This proves the command is not a silent no-op.

---

### Task 3: Document Operator Usage

**Files:**
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: `server` package script `verify:saas-live-e2e`.
- Produces: explicit pre-release operator instructions for live backend validation.

- [ ] **Step 1: Add an optional live E2E block**

In `docs/saas-launch-readiness-checklist.md`, after the backend automated gate block, add:

```markdown
### Optional Live Backend E2E Gate

Run this against a running backend with seeded SaaS data before staging or production release:

```powershell
cd server
$env:SAAS_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_LIVE_E2E_USERNAME = '<seeded-tenant-owner-username>'
$env:SAAS_LIVE_E2E_PASSWORD = '<seeded-tenant-owner-password>'
# Optional: force a known tenant instead of using the first credential-matched tenant
$env:SAAS_LIVE_E2E_TENANT_ID = '<tenant-id>'
pnpm.cmd run verify:saas-live-e2e
```

The command validates credential-gated tenant lookup, tenant-scoped login, user profile, menu, usage, plan, subscription, module, and Alipay config-status APIs.

To validate dev payment confirmation in a non-production seeded environment:

```powershell
cd server
$env:SAAS_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_LIVE_E2E_USERNAME = '<seeded-tenant-owner-username>'
$env:SAAS_LIVE_E2E_PASSWORD = '<seeded-tenant-owner-password>'
$env:SAAS_LIVE_E2E_PLAN_CODE = 'pro'
$env:SAAS_LIVE_E2E_BILLING_CYCLE = 'monthly'
$env:SAAS_LIVE_E2E_RUN_PAYMENT = '1'
pnpm.cmd run verify:saas-live-e2e
```

Only enable `SAAS_LIVE_E2E_RUN_PAYMENT=1` against disposable or resettable data because it creates and confirms a real SaaS order through the development confirmation endpoint.
```

- [ ] **Step 2: Update the out-of-scope wording**

Replace the browser E2E known-out-of-scope bullet with:

```markdown
- The automated browser smoke verifies public signup rendering and protected-route login redirects. The optional live backend E2E verifies seeded login and dev payment APIs, but a full seeded browser UI payment E2E remains outside the default repository gate.
```

---

### Task 4: Verify, Review, And Commit P2

**Files:**
- Verify: `server/scripts/verify-saas-live-e2e.ts`
- Verify: `server/src/config/saas-readiness-command.spec.ts`
- Verify: `server/package.json`
- Verify: `docs/saas-launch-readiness-checklist.md`
- Verify: `docs/superpowers/plans/2026-07-09-p2-saas-live-e2e-readiness.md`

**Interfaces:**
- Consumes: package scripts and docs.
- Produces: one committed P2 live E2E readiness slice.

- [ ] **Step 1: Run focused contract verification**

Run from `server`:

```powershell
pnpm.cmd exec jest --runInBand -- saas-readiness-command.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run the command's missing-env verification**

Run from `server`:

```powershell
pnpm.cmd run verify:saas-live-e2e
```

Expected: FAIL with clear missing-env messages. This is an intentional negative verification for the opt-in live command.

- [ ] **Step 3: Run backend readiness**

Run from `server`:

```powershell
pnpm.cmd run verify:saas-readiness
```

Expected: PASS. This proves the new command contract is covered without requiring a running seeded backend.

- [ ] **Step 4: Run root readiness**

Run from repository root:

```powershell
node scripts\run-saas-readiness.cjs
```

Expected: PASS.

- [ ] **Step 5: Review diff**

Run:

```powershell
git diff --check
git diff --stat
git diff -- docs/superpowers/plans/2026-07-09-p2-saas-live-e2e-readiness.md server/scripts/verify-saas-live-e2e.ts server/src/config/saas-readiness-command.spec.ts server/package.json docs/saas-launch-readiness-checklist.md
git status --short --branch
```

Expected: only the P2 live E2E readiness files are modified.

- [ ] **Step 6: Commit P2**

Stage only intentional P2 files:

```powershell
git add docs/superpowers/plans/2026-07-09-p2-saas-live-e2e-readiness.md server/scripts/verify-saas-live-e2e.ts server/src/config/saas-readiness-command.spec.ts server/package.json docs/saas-launch-readiness-checklist.md
git commit -m "test: add saas live e2e readiness"
```

Expected: one local commit on `saas-order-risk-ops`.

## Self-Review

- Spec coverage: The plan closes the current readiness gap by adding an opt-in live backend E2E for seeded login and dev payment APIs, while keeping the default repository gate deterministic.
- Placeholder scan: No TBD, TODO, fill-in-later, or deferred implementation placeholders remain.
- Type consistency: Env names use the `SAAS_LIVE_E2E_` prefix consistently; package script is `verify:saas-live-e2e`; script path is `scripts/verify-saas-live-e2e.ts`.
- Scope control: Invoice support, production Alipay settlement, and full seeded browser UI payment E2E remain outside this P2 default gate.
