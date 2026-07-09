# P6 SaaS Resource Pack Live E2E Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The project owner asked to continue inline and not use subagents for interrupted continuation work.

**Goal:** Extend optional live SaaS E2E gates so tenant resource-pack listing, order creation, and optional development payment confirmation are covered alongside plan upgrade flows.

**Architecture:** Keep the default repository readiness deterministic. Add contract assertions to the existing backend and frontend readiness guards, then extend the existing optional live E2E scripts. Read-only resource-pack API checks run by default after seeded login. Resource-pack order creation and payment confirmation remain opt-in through explicit environment variables because they mutate seeded data.

**Tech Stack:** TypeScript, tsx, Jest contract guard, Playwright Chromium, Vue SPA hash routes, existing SaaS tenant resource-pack APIs.

## Global Constraints

- Do not print passwords, access tokens, refresh tokens, private keys, or raw Alipay secrets.
- Do not add live seeded E2E commands to the default root readiness gate.
- Do not mutate resource-pack data unless `SAAS_LIVE_E2E_RUN_RESOURCE_PACK=1` is explicitly set.
- Do not confirm resource-pack payment unless `SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT=1` is explicitly set.
- Keep invoice functionality out of scope.
- Use PowerShell command examples with `pnpm.cmd`.
- Preserve the existing plan live E2E behavior and environment names.

---

### Task 1: Backend Resource-Pack Live E2E Contract

**Files:**
- Modify: `server/src/config/saas-readiness-command.spec.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: existing `server/scripts/verify-saas-live-e2e.ts`.
- Produces: assertions that the live backend E2E covers resource-pack read, order creation, optional dev confirmation, and checklist env docs.

- [ ] **Step 1: Write failing backend contract assertions**

Add these assertions near the existing `verify:saas-live-e2e` checks:

```typescript
const liveE2eSource = readFileSync(liveE2eScript, 'utf8');
expect(liveE2eSource).toContain('/api/saas/tenant/resource-packs');
expect(liveE2eSource).toContain('/api/saas/tenant/resource-pack-orders');
expect(liveE2eSource).toContain('SAAS_LIVE_E2E_RUN_RESOURCE_PACK');
expect(liveE2eSource).toContain('SAAS_LIVE_E2E_RESOURCE_PACK_CODE');
expect(liveE2eSource).toContain("order_type: 'resource_pack'");

expect(checklist).toContain('SAAS_LIVE_E2E_RUN_RESOURCE_PACK');
expect(checklist).toContain('SAAS_LIVE_E2E_RESOURCE_PACK_CODE');
expect(checklist).toContain('SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT');
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- saas-readiness-command.spec.ts
```

Expected: FAIL because the live E2E script and checklist do not yet include resource-pack live mutation coverage.

---

### Task 2: Backend Live Resource-Pack E2E Implementation

**Files:**
- Modify: `server/scripts/verify-saas-live-e2e.ts`

**Interfaces:**
- Consumes environment:
  - existing `SAAS_LIVE_E2E_BASE_URL`
  - existing `SAAS_LIVE_E2E_USERNAME`
  - existing `SAAS_LIVE_E2E_PASSWORD`
  - existing optional `SAAS_LIVE_E2E_TENANT_ID`
  - existing optional `SAAS_LIVE_E2E_RUN_PAYMENT`
  - new optional `SAAS_LIVE_E2E_RUN_RESOURCE_PACK`
  - new optional `SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT`
  - new optional `SAAS_LIVE_E2E_RESOURCE_PACK_CODE`
- Produces: backend live E2E output with `resource_pack_checked` and `resource_pack_payment_checked`.

- [ ] **Step 1: Add types and env constants**

Add:

```typescript
type ResourcePackItem = {
  code?: string;
  name?: string;
  status?: number | string;
  price_cents?: number;
};

type ResourcePackOrderData = {
  order_no?: string;
  status?: string;
  resource_pack_code?: string;
};

const runResourcePack = process.env.SAAS_LIVE_E2E_RUN_RESOURCE_PACK === '1';
const runResourcePackPayment = process.env.SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT === '1';
const resourcePackCode = process.env.SAAS_LIVE_E2E_RESOURCE_PACK_CODE?.trim();
```

- [ ] **Step 2: Add default read-only resource-pack API checks**

After the Alipay config-status read check, add:

```typescript
const resourcePacks = (await verifyReadEndpoint(
  'tenant resource packs',
  '/api/saas/tenant/resource-packs',
  token,
)) as ResourcePackItem[] | undefined;
await verifyReadEndpoint('tenant resource-pack orders', '/api/saas/tenant/resource-pack-orders', token);
```

- [ ] **Step 3: Add opt-in resource-pack order flow**

Add:

```typescript
if (runResourcePack || runResourcePackPayment) {
  await verifyResourcePackFlow(token, resourcePacks);
} else {
  console.log(
    'Skipping resource-pack mutation; set SAAS_LIVE_E2E_RUN_RESOURCE_PACK=1 to verify resource-pack order creation.',
  );
}
```

Implement:

```typescript
async function verifyResourcePackFlow(token: string, resourcePacks: ResourcePackItem[] | undefined) {
  assert(Array.isArray(resourcePacks), 'tenant resource packs must return an array before resource-pack order can be checked');
  const selectedPack = resourcePackCode
    ? resourcePacks?.find((pack) => pack.code === resourcePackCode)
    : resourcePacks?.[0];
  assert(
    selectedPack?.code,
    resourcePackCode
      ? `SAAS_LIVE_E2E_RESOURCE_PACK_CODE ${resourcePackCode} was not found in tenant resource packs`
      : 'tenant resource packs must include at least one purchasable resource pack',
  );
  if (!selectedPack?.code) return;

  const order = assertOk<ResourcePackOrderData>(
    'create resource-pack order',
    await requestJson('/api/saas/tenant/resource-pack-orders', {
      method: 'POST',
      token,
      body: { resource_pack_code: selectedPack.code, payment_method: 'alipay' },
    }),
  );
  assert(order?.order_no, 'create resource-pack order must return data.order_no');
  if (!order?.order_no || !runResourcePackPayment) return;

  const paidOrder = assertOk<ResourcePackOrderData>(
    'resource-pack dev payment confirmation',
    await requestJson('/api/saas/payment/dev-confirm', {
      method: 'POST',
      token,
      body: { order_no: order.order_no, order_type: 'resource_pack' },
    }),
  );
  assert(paidOrder?.status === 'paid', `resource-pack dev payment confirmation must return paid status, got ${paidOrder?.status}`);
}
```

- [ ] **Step 4: Update summary output**

Add `resource_pack_checked`, `resource_pack_payment_checked`, and `resource_pack_code` to the final JSON summary without printing secrets.

- [ ] **Step 5: Run backend focused check**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- saas-readiness-command.spec.ts
```

Expected: PASS.

---

### Task 3: Frontend Resource-Pack Live Browser Contract

**Files:**
- Modify: `web/scripts/verify-saas-readiness-command.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: existing `web/scripts/verify-saas-live-browser-e2e.ts`.
- Produces: assertions that the live browser E2E covers the tenant resource-pack page and resource-pack order/payment env docs.

- [ ] **Step 1: Write failing frontend contract assertions**

Add these assertions near the existing live browser E2E checks:

```typescript
const liveBrowserE2ESource = existsSync(liveBrowserE2EPath)
  ? readFile('scripts/verify-saas-live-browser-e2e.ts')
  : ''
assertIncludes(liveBrowserE2ESource, '/#/tenant-saas/resource-packs', 'live browser E2E')
assertIncludes(liveBrowserE2ESource, 'SAAS_LIVE_E2E_RUN_RESOURCE_PACK', 'live browser E2E')
assertIncludes(liveBrowserE2ESource, 'SAAS_LIVE_E2E_RESOURCE_PACK_CODE', 'live browser E2E')
assertIncludes(liveBrowserE2ESource, \"requestPayload?.order_type === 'resource_pack'\", 'live browser E2E')
assertIncludes(liveBrowserE2ESource, 'observedResourcePackDevPaymentStatus', 'live browser E2E')

assertIncludes(checklist, 'SAAS_LIVE_E2E_RUN_RESOURCE_PACK', 'launch readiness checklist')
assertIncludes(checklist, 'SAAS_LIVE_E2E_RESOURCE_PACK_CODE', 'launch readiness checklist')
assertIncludes(checklist, 'SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT', 'launch readiness checklist')
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: FAIL because the live browser E2E script and checklist do not yet include resource-pack live browser coverage.

---

### Task 4: Frontend Live Resource-Pack Browser E2E Implementation

**Files:**
- Modify: `web/scripts/verify-saas-live-browser-e2e.ts`

**Interfaces:**
- Consumes environment:
  - existing live browser E2E env vars
  - new optional `SAAS_LIVE_E2E_RUN_RESOURCE_PACK`
  - new optional `SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT`
  - new optional `SAAS_LIVE_E2E_RESOURCE_PACK_CODE`
- Produces: browser E2E output with `resource_pack_order_checked` and `resource_pack_payment_checked`.

- [ ] **Step 1: Add env constants and observed state**

Add:

```typescript
const runResourcePack = process.env.SAAS_LIVE_E2E_RUN_RESOURCE_PACK === '1'
const runResourcePackPayment = process.env.SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT === '1'
const requestedResourcePackCode = process.env.SAAS_LIVE_E2E_RESOURCE_PACK_CODE?.trim()

let observedCreatedResourcePackOrderNo = ''
let observedResourcePackDevPaymentStatus = ''
```

- [ ] **Step 2: Observe resource-pack order responses**

Extend `observeApiResponse`:

```typescript
if (method === 'POST' && targetUrl.pathname === '/api/saas/tenant/resource-pack-orders') {
  const parsed = tryParseJson<ApiEnvelope<{ order_no?: string }>>(bodyText)
  observedCreatedResourcePackOrderNo = parsed?.data?.order_no || observedCreatedResourcePackOrderNo
}

if (method === 'POST' && targetUrl.pathname === '/api/saas/payment/dev-confirm') {
  const requestPayload = tryParseJson<{ order_type?: string }>(requestBodyText)
  const parsed = tryParseJson<ApiEnvelope<{ status?: string }>>(bodyText)
  if (requestPayload?.order_type === 'resource_pack') {
    observedResourcePackDevPaymentStatus = parsed?.data?.status || observedResourcePackDevPaymentStatus
  } else {
    observedDevPaymentStatus = parsed?.data?.status || observedDevPaymentStatus
  }
}
```

Update `proxyLiveBackendApi` to pass the serialized request body string into `observeApiResponse`.

- [ ] **Step 3: Add resource-pack page health check**

Implement:

```typescript
async function assertHealthyTenantResourcePackPage(page: Page) {
  await page.goto(`${webUrl.replace(/\/$/, '')}/#/tenant-saas/resource-packs`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.tenant-resource-pack-page__pack', { timeout: 30_000 })
  await page.waitForSelector('.tenant-resource-pack-page__orders', { timeout: 30_000 })
  const currentUrl = page.url()
  assert(!currentUrl.includes('#/auth/login'), `tenant resource-pack page must not redirect to login, got ${currentUrl}`)
  assert(!currentUrl.includes('exception'), `tenant resource-pack page must not route to exception page, got ${currentUrl}`)
  const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '')
  assert(bodyText.trim().length > 0, 'tenant resource-pack page must render visible text')
  assert(!/\b(404|500)\b/.test(bodyText), 'tenant resource-pack page must not render an exception status')
}
```

- [ ] **Step 4: Add opt-in resource-pack browser order flow**

Implement `verifyResourcePackOrderFlow(page: Page)`:

```typescript
async function verifyResourcePackOrderFlow(page: Page) {
  if (!runResourcePack && !runResourcePackPayment) {
    console.log('Skipping UI resource-pack mutation; set SAAS_LIVE_E2E_RUN_RESOURCE_PACK=1 to click a resource-pack order button.')
    return
  }

  await assertHealthyTenantResourcePackPage(page)
  const orderButton = await findResourcePackOrderButton(page)
  if (!orderButton || failures.length) return
  await orderButton.click()
  await page.waitForSelector('.tenant-resource-pack-page__order', { timeout: 30_000 })
  const orderNo = await waitForObservedResourcePackOrderNo()
  assert(orderNo, 'tenant resource-pack UI order creation must return data.order_no')
  if (!runResourcePackPayment) return

  const devPaymentButton = page.locator('.tenant-resource-pack-page__order').getByRole('button', { name: /本地模拟支付成功/ })
  assert(
    (await devPaymentButton.count()) > 0,
    'resource-pack development payment button must be visible; rebuild with VITE_ENABLE_DEV_PAYMENT_CONFIRM=true before running SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT=1',
  )
  if ((await devPaymentButton.count()) === 0) return
  await devPaymentButton.first().click()
  await waitForResourcePackDevPaymentPaid()
}
```

Implement helper functions analogous to `findOrderButton` and `waitForObservedOrderNo`, but scoped to `.tenant-resource-pack-page__pack` and `observedCreatedResourcePackOrderNo`.

- [ ] **Step 5: Call resource-pack flow and update output**

After the plan order flow, call:

```typescript
await verifyResourcePackOrderFlow(page)
```

Add `resource_pack_order_checked`, `resource_pack_payment_checked`, and `resource_pack_code` to the JSON summary.

- [ ] **Step 6: Run frontend focused check**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: PASS.

---

### Task 5: Checklist Documentation

**Files:**
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: backend and frontend env contracts from Tasks 2 and 4.
- Produces: operator instructions for optional live resource-pack order/payment coverage.

- [ ] **Step 1: Document backend resource-pack live E2E**

Add after the existing live backend payment example:

```markdown
To validate resource-pack order creation and optional development payment in a non-production seeded environment:

```powershell
cd server
$env:SAAS_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_LIVE_E2E_USERNAME = '<seeded-tenant-owner-username>'
$env:SAAS_LIVE_E2E_PASSWORD = '<seeded-tenant-owner-password>'
$env:SAAS_LIVE_E2E_RESOURCE_PACK_CODE = '<resource-pack-code>'
$env:SAAS_LIVE_E2E_RUN_RESOURCE_PACK = '1'
# Optional: also confirm the resource-pack order through the development payment endpoint
$env:SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT = '1'
pnpm.cmd run verify:saas-live-e2e
```
```

- [ ] **Step 2: Document browser resource-pack live E2E**

Add after the existing live browser E2E payment example:

```markdown
To also create a resource-pack order through the UI:

```powershell
cd web
$env:SAAS_LIVE_E2E_BASE_URL = 'http://127.0.0.1:3000'
$env:SAAS_LIVE_E2E_USERNAME = '<seeded-tenant-owner-username>'
$env:SAAS_LIVE_E2E_PASSWORD = '<seeded-tenant-owner-password>'
$env:SAAS_LIVE_E2E_RESOURCE_PACK_CODE = '<resource-pack-code>'
$env:SAAS_LIVE_E2E_RUN_RESOURCE_PACK = '1'
# Optional: also click the local development payment confirmation control
$env:SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT = '1'
pnpm.cmd run verify:saas-live-browser-e2e
```
```

- [ ] **Step 3: Document mutation scope**

Add: `SAAS_LIVE_E2E_RUN_RESOURCE_PACK=1` creates a resource-pack order, and `SAAS_LIVE_E2E_RUN_RESOURCE_PACK_PAYMENT=1` additionally confirms it through the development payment endpoint. Only run these against disposable or resettable seeded data.

---

### Task 6: Verification and Commit

**Files:**
- No new implementation files.

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: reviewed commit.

- [ ] **Step 1: Run focused contract checks**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- saas-readiness-command.spec.ts
cd ..\web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: both PASS.

- [ ] **Step 2: Run missing-env negative checks**

Run:

```powershell
cd server
pnpm.cmd run verify:saas-live-e2e
cd ..\web
pnpm.cmd run verify:saas-live-browser-e2e
```

Expected: both fail intentionally with only missing env messages.

- [ ] **Step 3: Run script type checks**

Run:

```powershell
cd server
pnpm.cmd exec tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --ignoreConfig scripts/verify-saas-live-e2e.ts
cd ..\web
pnpm.cmd exec tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --lib ES2022,DOM,DOM.Iterable scripts/verify-saas-live-browser-e2e.ts
```

Expected: both exit 0. If the server TypeScript does not support `--ignoreConfig`, use the same explicit `--lib ES2022,DOM,DOM.Iterable` pattern as the web check.

- [ ] **Step 4: Run repository readiness**

Run:

```powershell
node scripts\run-saas-readiness.cjs
```

Expected: exit 0.

- [ ] **Step 5: Review and commit**

Run:

```powershell
git diff --check
git diff --stat
git status --short --branch
git add docs/superpowers/plans/2026-07-09-p6-saas-resource-pack-live-e2e-readiness.md docs/saas-launch-readiness-checklist.md server/scripts/verify-saas-live-e2e.ts server/src/config/saas-readiness-command.spec.ts web/scripts/verify-saas-live-browser-e2e.ts web/scripts/verify-saas-readiness-command.ts
git commit -m "test: add saas resource pack live e2e readiness"
```

Expected: commit succeeds. Do not push unless the user explicitly asks.

## Self-Review

- Spec coverage: The plan covers backend live API resource-pack read/order/payment checks, frontend live browser resource-pack page/order/payment checks, docs, focused gates, negative checks, type checks, repository readiness, review, and commit.
- Placeholder scan: No TBD/TODO or incomplete implementation language remains.
- Type consistency: Environment names, script names, route paths, and JSON summary fields match across tasks.
