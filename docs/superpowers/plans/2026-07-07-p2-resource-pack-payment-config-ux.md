# P2 Resource Pack Payment Config UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the tenant resource pack payment flow show Alipay configuration readiness before and during payment, matching the tenant plan upgrade flow.

**Architecture:** Keep backend payment behavior unchanged. Reuse the existing public tenant Alipay config status API and add a small frontend-only status block to the tenant resource pack page next to the pay action.

**Tech Stack:** Vue 3, Element Plus, TypeScript, existing SaaS API wrappers, tsx verification script, Vite build.

## Global Constraints

- Do not add invoice functionality.
- Do not change backend payment, webhook, order, subscription, or quota logic.
- Do not introduce a new order status.
- Keep `devConfirmTenantPayment` visible only under the existing dev flag.
- Keep tenant resource pack page at `web/src/views/saas/tenant/resource-pack/index.vue`.
- Use normal UTF-8 Chinese copy for new labels.
- Worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.

---

## File Structure

- Create/Modify: `web/scripts/verify-saas-payment-path-copy.ts`
  - Static guard for resource pack Alipay config status UI.
- Modify: `web/src/views/saas/tenant/resource-pack/index.vue`
  - Load tenant Alipay config status, show configured/unconfigured tag and missing keys near the payment button.

---

## Task 1: Resource Pack Payment Config Verification

**Files:**
- Modify: `web/scripts/verify-saas-payment-path-copy.ts`

**Interfaces:**
- Produces: `pnpm.cmd exec tsx scripts/verify-saas-payment-path-copy.ts`
- Checks `resource-pack/index.vue` imports `fetchAlipayConfigStatus`, stores `alipayConfigStatus`, renders status copy, and shows missing key copy.

- [ ] **Step 1: Write failing verification script**

Replace `web/scripts/verify-saas-payment-path-copy.ts` with:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

const resourcePackSource = readFileSync(resolve(process.cwd(), 'src/views/saas/tenant/resource-pack/index.vue'), 'utf8')

for (const token of [
  'fetchAlipayConfigStatus',
  'type AlipayConfigStatus',
  'const alipayConfigStatus = ref<AlipayConfigStatus | null>(null)',
  'const alipayMissingKeysText = computed',
  '支付宝已配置',
  '支付宝未配置',
  '缺少：',
  'tenant-resource-pack-page__payment-status'
]) {
  assert(resourcePackSource.includes(token), `resource pack payment page must include token: ${token}`)
}
```

- [ ] **Step 2: Run RED verification**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-payment-path-copy.ts
```

Expected: FAIL because resource pack page currently does not load or render Alipay config status.

---

## Task 2: Resource Pack Page Config Status UI

**Files:**
- Modify: `web/src/views/saas/tenant/resource-pack/index.vue`

**Interfaces:**
- Consumes: `fetchAlipayConfigStatus(): Promise<AlipayConfigStatus>`
- Consumes: existing `createAlipayPayment(orderNo, 'resource_pack')`
- Produces: `alipayConfigStatus` ref and `alipayMissingKeysText` computed.

- [ ] **Step 1: Import API type and function**

Add to the existing `@/api/saas` import:

```ts
fetchAlipayConfigStatus,
type AlipayConfigStatus,
```

- [ ] **Step 2: Add state and missing-key computed**

Add near the other refs and computed values:

```ts
const alipayConfigStatus = ref<AlipayConfigStatus | null>(null)

const alipayMissingKeysText = computed(() => {
  const missingKeys = alipayConfigStatus.value?.missing_keys || []
  return missingKeys.length ? `缺少：${missingKeys.join('、')}` : ''
})
```

- [ ] **Step 3: Load config status with page data**

In `loadPage()`, after module access is confirmed and before or alongside `loadResourcePacks()`, call:

```ts
alipayConfigStatus.value = await fetchAlipayConfigStatus()
```

If module access loading fails, set:

```ts
alipayConfigStatus.value = null
```

- [ ] **Step 4: Render status next to pay actions**

Inside `.tenant-resource-pack-page__order-actions`, before the pay button, add:

```vue
<div v-if="alipayConfigStatus" class="tenant-resource-pack-page__payment-status">
  <ElTag :type="alipayConfigStatus.configured ? 'success' : 'warning'" effect="light">
    {{ alipayConfigStatus.configured ? '支付宝已配置' : '支付宝未配置' }}
  </ElTag>
  <span v-if="pollingPayment">正在同步支付结果...</span>
  <span v-if="!alipayConfigStatus.configured">{{ alipayMissingKeysText }}</span>
</div>
```

- [ ] **Step 5: Add layout style**

Add scoped CSS:

```css
.tenant-resource-pack-page__payment-status {
  display: flex;
  max-width: 360px;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  text-align: right;
}
```

Extend the existing mobile media block so `.tenant-resource-pack-page__payment-status` aligns left on mobile.

- [ ] **Step 6: Run GREEN verification**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-payment-path-copy.ts
```

Expected: PASS.

---

## Final Verification

- [ ] Run focused payment UX verification:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-payment-path-copy.ts
```

- [ ] Run existing SaaS frontend verifications:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-platform-tenant-page.ts
pnpm.cmd exec tsx scripts/verify-saas-signup-activation.ts
pnpm.cmd exec tsx scripts/verify-saas-signup-password-policy.ts
pnpm.cmd exec tsx scripts/verify-saas-signup-route.ts
```

- [ ] Run frontend build:

```powershell
pnpm.cmd build
```

- [ ] Review and commit:

```powershell
git status --short
git diff --stat
git diff --check
git add docs/superpowers/plans/2026-07-07-p2-resource-pack-payment-config-ux.md web/scripts/verify-saas-payment-path-copy.ts web/src/views/saas/tenant/resource-pack/index.vue
git commit -m "feat: show resource pack payment config status"
```
