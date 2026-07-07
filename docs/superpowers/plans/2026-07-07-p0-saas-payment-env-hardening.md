# P0 SaaS Payment and Credential Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove production exposure of local SaaS payment simulation, stop tracking local secrets, and tighten signup/member credential validation.

**Architecture:** Keep the existing NestJS controller/service boundaries and Vue tenant billing pages. Add a small configuration gate for the development payment confirmation endpoint, hide matching frontend controls outside local development, and strengthen DTO validation without changing public API routes.

**Tech Stack:** NestJS, class-validator, Joi env validation, Vue 3, Element Plus, pnpm, Jest, vue-tsc.

## Global Constraints

- Worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.
- Branch: `saas-order-risk-ops`.
- Do not push unless the user explicitly asks.
- Do not delete local `server/.env`; remove it only from Git tracking.
- Preserve existing backend route paths and frontend page layout.
- Avoid broad encoding cleanup; do not introduce mojibake in visible UI text.

---

## File Structure

- Modify `server/src/config/configuration.ts`: expose `payment.devConfirmEnabled`.
- Modify `server/src/config/env.validation.ts`: validate `SAAS_DEV_PAYMENT_CONFIRM_ENABLED`.
- Modify `server/.env.example`: document the new safe default.
- Modify `server/src/module/saas/saas-payment.controller.ts`: gate `dev-confirm` and add explicit billing permissions.
- Modify `server/src/module/saas/saas-payment.controller.spec.ts`: cover production rejection and permission metadata.
- Modify `web/src/views/saas/tenant/plan/index.vue`: hide local payment confirmation outside development.
- Modify `web/src/views/saas/tenant/resource-pack/index.vue`: hide local resource-pack payment confirmation outside development.
- Modify `server/src/module/saas/dto/signup.dto.ts`: enforce stronger public signup validation.
- Modify `server/src/module/saas/dto/signup.dto.spec.ts`: cover rejected and accepted signup payloads.
- Modify `server/src/module/saas/dto/create-tenant-member.dto.ts`: enforce stronger tenant member creation validation.
- Create `server/src/module/saas/dto/create-tenant-member.dto.spec.ts`: cover rejected and accepted member payloads.
- Stage deletion from Git index for `server/.env` while preserving the local file.

## Task 1: Gate Development Payment Confirmation

**Files:**
- Modify: `server/src/config/configuration.ts`
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/.env.example`
- Modify: `server/src/module/saas/saas-payment.controller.ts`
- Test: `server/src/module/saas/saas-payment.controller.spec.ts`

**Interfaces:**
- Consumes: `ConfigService.get('payment.devConfirmEnabled')`, `ConfigService.get('app.env')`
- Produces: `SaasPaymentController.devConfirm()` throws `NotFoundException` when development confirmation is disabled.

- [ ] **Step 1: Add failing controller test for production rejection**

```ts
it('rejects development payment confirmation in production', async () => {
  configService.get.mockImplementation((key: string) => {
    if (key === 'app.env') return 'production';
    return undefined;
  });
  jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(12);

  await expect(
    controller.devConfirm({
      order_no: 'SO20260702000000001000001',
    }),
  ).rejects.toThrow(NotFoundException);

  expect(saasOrderService.confirmDevPayment).not.toHaveBeenCalled();
  expect(resourcePackOrderService.confirmDevPayment).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test and confirm failure before implementation**

Run: `cd server && pnpm test -- saas-payment.controller.spec.ts --runInBand --forceExit`

Expected before implementation: FAIL because `devConfirm` is not gated.

- [ ] **Step 3: Add env configuration**

```ts
payment: {
  devConfirmEnabled:
    process.env.SAAS_DEV_PAYMENT_CONFIRM_ENABLED === undefined
      ? process.env.NODE_ENV !== 'production'
      : process.env.SAAS_DEV_PAYMENT_CONFIRM_ENABLED === 'true',
}
```

```ts
SAAS_DEV_PAYMENT_CONFIRM_ENABLED: Joi.boolean().truthy('true').falsy('false').optional(),
```

Add to `server/.env.example`:

```dotenv
SAAS_DEV_PAYMENT_CONFIRM_ENABLED=false
```

- [ ] **Step 4: Gate the controller method**

```ts
private assertDevPaymentConfirmationAllowed(): void {
  const configured = this.configService.get<boolean | string | undefined>('payment.devConfirmEnabled');
  const enabled =
    configured === undefined
      ? String(this.configService.get<string>('app.env') || process.env.NODE_ENV || 'development').toLowerCase() !==
        'production'
      : configured === true || String(configured).toLowerCase() === 'true';

  if (!enabled) {
    throw new NotFoundException('Development payment confirmation is not available');
  }
}
```

- [ ] **Step 5: Run test and confirm pass**

Run: `cd server && pnpm test -- saas-payment.controller.spec.ts --runInBand --forceExit`

Expected after implementation: PASS.

## Task 2: Hide Frontend Local Payment Controls

**Files:**
- Modify: `web/src/views/saas/tenant/plan/index.vue`
- Modify: `web/src/views/saas/tenant/resource-pack/index.vue`

**Interfaces:**
- Consumes: `import.meta.env.DEV`, `import.meta.env.VITE_ENABLE_DEV_PAYMENT_CONFIRM`
- Produces: `showDevPaymentConfirm` boolean used by visible controls and click handlers.

- [ ] **Step 1: Add frontend guard constant**

```ts
const showDevPaymentConfirm = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_PAYMENT_CONFIRM === 'true'
```

- [ ] **Step 2: Hide plan upgrade simulation button**

```vue
<ElButton
  v-if="showDevPaymentConfirm"
  type="success"
  :disabled="!isCurrentOrderPayable"
  :loading="confirmingPayment"
  @click="confirmDevPayment"
>
  本地模拟支付成功
</ElButton>
```

- [ ] **Step 3: Hide resource pack simulation buttons**

```vue
<ElButton
  v-if="showDevPaymentConfirm"
  type="success"
  :disabled="!isCurrentOrderPayable"
  :loading="confirmingPayment"
  @click="confirmDevPayment"
>
  本地模拟支付成功
</ElButton>
```

```vue
<ElButton v-if="showDevPaymentConfirm && row.status === 'pending'" type="success" link @click="confirmHistoryOrder(row)">
  模拟确认
</ElButton>
```

- [ ] **Step 4: Guard handler execution**

```ts
async function confirmDevPayment() {
  if (!showDevPaymentConfirm) return
  const order = currentOrder.value
  if (!order || order.status !== 'pending') return
}
```

- [ ] **Step 5: Run frontend typecheck**

Run: `cd web && pnpm exec vue-tsc --noEmit --pretty false`

Expected: exit code 0.

## Task 3: Stop Tracking Local Environment Secrets

**Files:**
- Stage deletion: `server/.env`

**Interfaces:**
- Produces: `server/.env` remains on disk but is removed from Git index.

- [ ] **Step 1: Remove only Git tracking**

Run: `git rm --cached -- server/.env`

Expected: `git status --short server/.env` shows `D server/.env`; `Test-Path server/.env` returns `True`.

- [ ] **Step 2: Confirm ignore coverage**

Run: `git check-ignore -v server/.env`

Expected: the path is ignored by `.gitignore`.

## Task 4: Add Explicit Payment Permissions

**Files:**
- Modify: `server/src/module/saas/saas-payment.controller.ts`
- Test: `server/src/module/saas/saas-payment.controller.spec.ts`

**Interfaces:**
- Produces: `createAlipayPayment()` requires `tenant:billing:upgrade` or `tenant:resource-pack-order:pay`.
- Produces: `getAlipayConfigStatus()` requires `tenant:billing:view`.

- [ ] **Step 1: Add permission metadata tests**

```ts
expect(Reflect.getMetadata('requirePermission', SaasPaymentController.prototype.createAlipayPayment)).toEqual([
  'tenant:billing:upgrade',
  'tenant:resource-pack-order:pay',
]);
```

```ts
expect(Reflect.getMetadata('requirePermission', SaasPaymentController.prototype.getAlipayConfigStatus)).toEqual([
  'tenant:billing:view',
]);
```

- [ ] **Step 2: Apply decorators**

```ts
@RequirePermission('tenant:billing:upgrade', 'tenant:resource-pack-order:pay')
async createAlipayPayment(@Body() body: { order_no: string; order_type?: SaasPaymentOrderType }) {}

@RequirePermission('tenant:billing:view')
async getAlipayConfigStatus() {}
```

- [ ] **Step 3: Run controller tests**

Run: `cd server && pnpm test -- saas-payment.controller.spec.ts --runInBand --forceExit`

Expected: PASS.

## Task 5: Strengthen Signup and Member Validation

**Files:**
- Modify: `server/src/module/saas/dto/signup.dto.ts`
- Modify: `server/src/module/saas/dto/signup.dto.spec.ts`
- Modify: `server/src/module/saas/dto/create-tenant-member.dto.ts`
- Create: `server/src/module/saas/dto/create-tenant-member.dto.spec.ts`

**Interfaces:**
- Produces: username pattern `^[A-Za-z0-9_][A-Za-z0-9_.-]{1,63}$`.
- Produces: password pattern `^(?=.*[A-Za-z])(?=.*\d).{8,100}$`.
- Produces: phone pattern `^\+?[0-9][0-9\s-]{5,19}$`.

- [ ] **Step 1: Add DTO tests for rejected weak payloads**

```ts
expect(properties).toEqual(expect.arrayContaining(['username', 'password', 'tenant_name', 'phone']));
```

```ts
expect(properties).toEqual(expect.arrayContaining(['username', 'password', 'phone', 'email']));
```

- [ ] **Step 2: Add DTO tests for accepted strong payloads**

```ts
await expect(validate(dto)).resolves.toHaveLength(0);
```

- [ ] **Step 3: Apply validation rules**

```ts
const USERNAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{1,63}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{5,19}$/;
```

- [ ] **Step 4: Run DTO tests**

Run: `cd server && pnpm test -- signup.dto.spec.ts create-tenant-member.dto.spec.ts --runInBand --forceExit`

Expected: PASS.

## Task 6: Verification, Review, and Commit

**Files:**
- Modify: all files listed above.

**Interfaces:**
- Produces: a local commit on `saas-order-risk-ops`.

- [ ] **Step 1: Run backend focused tests**

Run: `cd server && pnpm test -- saas-payment.controller.spec.ts configuration.spec.ts signup.dto.spec.ts create-tenant-member.dto.spec.ts --runInBand --forceExit`

Expected: all selected suites pass.

- [ ] **Step 2: Run backend typecheck**

Run: `cd server && pnpm run typecheck`

Expected: exit code 0.

- [ ] **Step 3: Run frontend typecheck**

Run: `cd web && pnpm exec vue-tsc --noEmit --pretty false`

Expected: exit code 0.

- [ ] **Step 4: Run diff checks**

Run: `git diff --check && git diff --cached --check`

Expected: exit code 0; CRLF warnings are acceptable if no whitespace errors are reported.

- [ ] **Step 5: Review changes**

Run: `git diff --stat && git diff --cached --stat`

Expected: only planned SaaS payment, validation, frontend payment controls, env example, plan document, and `server/.env` index removal are present.

- [ ] **Step 6: Commit**

```bash
git add server/.env.example server/src/config/configuration.ts server/src/config/env.validation.ts server/src/module/saas/saas-payment.controller.ts server/src/module/saas/saas-payment.controller.spec.ts server/src/module/saas/dto/signup.dto.ts server/src/module/saas/dto/signup.dto.spec.ts server/src/module/saas/dto/create-tenant-member.dto.ts server/src/module/saas/dto/create-tenant-member.dto.spec.ts web/src/views/saas/tenant/plan/index.vue web/src/views/saas/tenant/resource-pack/index.vue docs/superpowers/plans/2026-07-07-p0-saas-payment-env-hardening.md
git add -u server/.env
git commit -m "fix: harden saas payment and signup security"
```

Expected: commit created on `saas-order-risk-ops`.

## Self-Review

- Spec coverage: payment dev-confirm exposure, frontend simulation buttons, local env tracking, explicit billing permissions, signup/member validation, verification, review, and commit are covered.
- Placeholder scan: no placeholder implementation steps remain.
- Type consistency: `payment.devConfirmEnabled`, `showDevPaymentConfirm`, `RequirePermission`, and DTO regex constants are used consistently.
