# P12 App Commercialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Execution selection:** The user requested direct execution without subagents. Implement inline with `superpowers:executing-plans`, review every task, and commit each independently. Do not push unless explicitly requested.

**Goal:** Add application price plans, tenant licenses, application orders, existing Alipay payment activation, immutable revenue accounting, manual developer settlement, and purchase-focused tenant/platform UI without breaking existing free applications.

**Architecture:** Create an independent `AppCommerceModule` that owns application pricing, orders, licenses, revenue, and settlement. `SaasModule` imports this module only to extend the existing payment service with application orders; `AppMarketplaceModule` consumes the exported access service for marketplace, install, open, runtime-session, and service-target authorization. This avoids a `SaasModule` and `AppMarketplaceModule` circular dependency while keeping payment verification centralized.

**Tech Stack:** NestJS 11, TypeORM/MySQL 8, existing SaaS Alipay service, Vue 3, Element Plus, TypeScript, Jest, Vite, existing application marketplace/runtime modules.

## Global Constraints

- `APP_COMMERCE_ENABLED` defaults to `false`. When disabled, current marketplace, install, open, runtime, analytics, static, iframe, native, P10, and P11 behavior remains unchanged.
- Published applications with no active price plan remain `legacy_free` even when commercialization is enabled. P12 must not turn existing applications into paid applications by migration side effect.
- Supported pricing models are `free`, `included`, `subscription`, and `one_time`.
- `subscription` plans use `monthly` or `yearly`; `one_time`, `free`, and `included` use `none`.
- Payment currency is `CNY`. Amounts are positive integer cents owned by the backend price snapshot; request bodies never provide payable totals, developer shares, tenant authority, or license dates.
- Paid plans require an explicit `developer_share_bps` from `0` to `10000`. Do not invent a platform/developer revenue split.
- Included plans contain normalized SaaS plan codes. Access is derived from the tenant's current active SaaS subscription, not from client input.
- Trials are optional, bounded by `trial_days`, and may be activated only once per tenant/application across expired, revoked, or deleted license history.
- Installation and licensing stay separate. Uninstall revokes runtime sessions but does not destroy a paid license.
- Paid, trial, included, and free access is revalidated on install, open, runtime-session authorization, and restricted service target invocation.
- Application orders use a distinct `AO` prefix and a dedicated `app_order` table. Existing plan and resource-pack order tables and responses remain compatible.
- Existing Alipay signature, app-id, trade-state, order-number, and amount verification remains the only payment callback authority. Callback order type is derived from the server-generated order prefix.
- Payment confirmation, license activation, and charge-ledger insertion occur in one database transaction under a pessimistic order lock. Replayed callbacks do not duplicate licenses or ledger rows.
- P12 supports full manual refund recording after external provider confirmation. Partial refunds and automatic Alipay refund initiation are excluded.
- Refund, license expiry, platform revocation, and loss of included-plan entitlement deny new opens and all subsequent runtime authorization attempts immediately.
- Revenue ledger rows are immutable. Corrections use adjustment or refund rows; services expose no update/delete operation for ledger rows.
- Settlement is manual. Batches group unsettled developer-share ledger rows by developer and closed period; marking paid records a bounded reference only. Automated transfers and invoices are excluded.
- Usage-based charging, metered billing, taxes, coupons, foreign currency, automatic renewals, stored payment methods, automated payouts, and invoices are excluded.
- Tenant, developer, application, order, license, and settlement ownership is checked server-side on every query and mutation.
- APIs and UI never expose payment keys, notify payloads, runtime tokens, raw upstream errors, database values, process details, source paths, or environment contents.
- Use TDD for every behavior change. Every task ends with focused tests, build/readiness checks where relevant, diff review, and an independent commit.

---

## File Structure

### Commerce module and schema

- Create `server/src/module/app-commerce/app-commerce.module.ts`: isolated commerce module imported by both SaaS payment and application marketplace modules.
- Create `server/src/module/app-commerce/entities/app-price-plan.entity.ts`: backend-owned pricing model and sale scope.
- Create `server/src/module/app-commerce/entities/app-order.entity.ts`: immutable order price snapshot and payment lifecycle.
- Create `server/src/module/app-commerce/entities/tenant-app-license.entity.ts`: tenant access range, source, status, and order binding.
- Create `server/src/module/app-commerce/entities/app-revenue-ledger.entity.ts`: immutable charge/refund/adjustment accounting.
- Create `server/src/module/app-commerce/entities/app-settlement-batch.entity.ts`: monthly manual developer settlement.
- Create `server/src/migrations/1760000000044-CreateAppCommercialization.ts`: forward-only tables, indexes, and unique active-license/order/ledger constraints.
- Create `server/src/migrations/1760000000045-SeedAppCommercializationMenus.ts`: platform, tenant, and developer commerce menus and permissions.
- Modify `server/src/config/configuration.ts`, `server/src/config/env.validation.ts`, `server/src/config/saas-env-contract.spec.ts`, and `server/.env.example`: disabled-by-default commerce feature flag.

### Backend pricing, orders, payment, and licenses

- Create `server/src/module/app-commerce/dto/app-price-plan.dto.ts`: price-plan create/update/list validation.
- Create `server/src/module/app-commerce/dto/app-order.dto.ts`: tenant purchase, trial, order list, refund, and license-revocation validation.
- Create `server/src/module/app-commerce/dto/app-settlement.dto.ts`: batch period, decision, and paid-reference validation.
- Create `server/src/module/app-commerce/services/app-price-plan.service.ts`: price CRUD and tenant-visible normalized plans.
- Create `server/src/module/app-commerce/services/app-license-access.service.ts`: authoritative legacy/free/included/trial/paid access evaluation.
- Create `server/src/module/app-commerce/services/app-order.service.ts`: order creation, payment request state, transactional payment confirmation, trial activation, and full refund recording.
- Create `server/src/module/app-commerce/services/app-revenue-ledger.service.ts`: immutable charge/refund/adjustment creation and owned aggregation.
- Create `server/src/module/app-commerce/services/app-settlement.service.ts`: period close, row claiming, approval, and paid transition.
- Create `server/src/module/app-commerce/app-commerce-platform.controller.ts`: platform pricing, orders, licenses, revenue, refunds, and settlements.
- Create `server/src/module/app-commerce/app-commerce-tenant.controller.ts`: tenant commerce detail, trial, purchase, and order list.
- Create `server/src/module/app-commerce/app-commerce-developer.controller.ts`: owned developer revenue and settlement status.
- Modify `server/src/module/saas/services/saas-payment.service.ts`: add `app` order adapter while preserving plan/resource-pack behavior.
- Modify `server/src/module/saas/saas-payment.controller.ts`: add app dev-confirm/payment permission path.
- Modify `server/src/module/saas/saas.module.ts`: import and re-export `AppCommerceModule`.

### Application authority integration

- Modify `server/src/module/app/services/app-tenant.service.ts`: expose commerce state and enforce it on install/open.
- Modify `server/src/module/app/services/app-runtime-session.service.ts`: enforce current application license on issue and authorize.
- Modify `server/src/module/app/services/app-service-invocation-policy.service.ts`: enforce target-service license for the invoking tenant.
- Modify `server/src/module/app/app.module.ts`: consume commerce exports without introducing a module cycle.
- Modify `server/src/module/app/entities/app-open-log.entity.ts`: add stable commerce denial reason codes at the TypeScript union level.

### Frontend and readiness

- Create `web/src/api/app-commerce.ts`: platform, tenant, developer, payment, license, revenue, and settlement contracts.
- Modify `web/src/api/app-marketplace.ts`: add commerce access state to marketplace and installed records.
- Modify `web/src/views/app-center/marketplace/index.vue`: pricing, trial, purchase, install, and open actions.
- Modify `web/src/views/app-center/installed/index.vue`: license state, expiry, and renewal action.
- Create `web/src/views/app-center/orders/index.vue`: tenant application order history and payment continuation.
- Create `web/src/views/app-center/developer-revenue/index.vue`: owned revenue and settlement visibility.
- Create `web/src/views/app-platform/commercial/index.vue`: platform pricing, orders, licenses, revenue, refunds, and settlement workspace.
- Create `web/scripts/verify-app-commerce-readiness.ts`: deterministic API/menu/UI/security assertions.
- Modify `web/package.json`, `web/scripts/run-saas-readiness.ts`, and `docs/saas-launch-readiness-checklist.md`: register P12 gates and rollout evidence.
- Create `server/scripts/verify-app-commerce-live-e2e-contract.ts` and `server/scripts/verify-app-commerce-live-e2e.ts`: disposable purchase/license/refund lifecycle gate.
- Create `docs/deployment/app-commerce-baota.md`: disabled-first migration, Alipay callback, observation, settlement, and rollback runbook with variable names only.

---

### Task 1: Commerce Schema, Configuration, And Independent Module Boundary

**Files:**
- Create: `server/src/module/app-commerce/entities/app-price-plan.entity.ts`
- Create: `server/src/module/app-commerce/entities/app-order.entity.ts`
- Create: `server/src/module/app-commerce/entities/tenant-app-license.entity.ts`
- Create: `server/src/module/app-commerce/entities/app-revenue-ledger.entity.ts`
- Create: `server/src/module/app-commerce/entities/app-settlement-batch.entity.ts`
- Create: `server/src/module/app-commerce/entities/app-commerce-entities.spec.ts`
- Create: `server/src/module/app-commerce/app-commerce.module.ts`
- Create: `server/src/migrations/1760000000044-CreateAppCommercialization.ts`
- Create: `server/src/migration-specs/create-app-commercialization.spec.ts`
- Modify: `server/src/config/configuration.ts`
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/src/config/saas-env-contract.spec.ts`
- Modify: `server/.env.example`

**Interfaces:**
- Produces: `AppPricingModel = 'free' | 'included' | 'subscription' | 'one_time'`
- Produces: `AppBillingPeriod = 'none' | 'monthly' | 'yearly'`
- Produces: `AppOrderStatus = 'pending' | 'paid' | 'refunded' | 'closed'`
- Produces: `TenantAppLicenseStatus = 'active' | 'trialing' | 'expired' | 'revoked' | 'refunded'`
- Produces: `AppRevenueLedgerType = 'charge' | 'refund' | 'adjustment'`
- Produces: `AppSettlementStatus = 'draft' | 'approved' | 'paid' | 'cancelled'`

- [ ] **Step 1: Write failing entity and migration tests**

Cover:

```ts
it('stores backend-owned app price plans with explicit share basis points');
it('stores immutable app order price snapshots without client-controlled totals');
it('stores one current active or trial license per tenant and application');
it('stores immutable revenue entries with idempotency keys and settlement binding');
it('stores one developer settlement batch per closed period');
it('creates all P12 tables and indexes in dependency order');
it('drops only P12 tables in reverse dependency order');
it('keeps app commerce disabled by default');
```

The migration must create:

```text
app_price_plan
app_order
tenant_app_license
app_revenue_ledger
app_settlement_batch
```

Required safeguards:

```text
uk_app_price_plan_app_code
uk_app_order_order_no
uk_app_order_trade_no
uk_tenant_app_license_order
uk_tenant_app_license_current
uk_app_revenue_ledger_event
uk_app_settlement_developer_period
```

- [ ] **Step 2: Run Task 1 tests to verify RED**

```powershell
cd server
pnpm.cmd run test -- app-commerce-entities.spec.ts create-app-commercialization.spec.ts saas-env-contract.spec.ts --runInBand
```

Expected: FAIL because P12 entities, migration, module, and feature flag do not exist.

- [ ] **Step 3: Implement the five entities and migration**

Use exact core fields:

```ts
interface AppPricePlanShape {
  appId: number;
  code: string;
  name: string;
  pricingModel: AppPricingModel;
  billingPeriod: AppBillingPeriod;
  amountCents: number;
  currency: 'CNY';
  trialDays: number;
  developerShareBps: number;
  includedPlanCodes: string[];
  saleScope: 'all' | 'selected_tenants';
  tenantIds: number[];
  status: number;
}

interface AppOrderShape {
  orderNo: string;
  tenantId: number;
  appId: number;
  pricePlanId: number;
  appCode: string;
  appName: string;
  pricePlanCode: string;
  pricingModel: 'subscription' | 'one_time';
  billingPeriod: 'monthly' | 'yearly' | 'none';
  amountCents: number;
  currency: 'CNY';
  developerId: number | null;
  developerShareBps: number;
  status: AppOrderStatus;
  paymentMethod: 'alipay';
  alipayTradeNo: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  paymentRequestedAt: Date | null;
  createdBy: number | null;
}
```

The active-license unique key is a nullable generated column derived from tenant, application, and `active|trialing` status so historical rows remain possible while concurrent current licenses fail closed.

- [ ] **Step 4: Add the disabled feature flag and module skeleton**

Add:

```text
APP_COMMERCE_ENABLED=false
```

`AppCommerceModule` initially registers and exports the five repositories. It must not import `SaasModule` or `AppMarketplaceModule`.

- [ ] **Step 5: Run Task 1 tests and backend build**

```powershell
pnpm.cmd run test -- app-commerce-entities.spec.ts create-app-commercialization.spec.ts saas-env-contract.spec.ts --runInBand
pnpm.cmd run build
```

Expected: all Task 1 tests and build pass.

- [ ] **Step 6: Review and commit Task 1**

Verify no amount, revenue split, license, or settlement default grants paid access; no existing table is rewritten; no secrets or payment config enters the schema.

```powershell
git add server/src/module/app-commerce server/src/migrations/1760000000044-CreateAppCommercialization.ts server/src/migration-specs/create-app-commercialization.spec.ts server/src/config server/.env.example
git commit -m "feat(app): add commerce schema"
```

---

### Task 2: Price Plans And Tenant Commerce Access Evaluation

**Files:**
- Create: `server/src/module/app-commerce/dto/app-price-plan.dto.ts`
- Create: `server/src/module/app-commerce/services/app-price-plan.service.ts`
- Create: `server/src/module/app-commerce/services/app-price-plan.service.spec.ts`
- Create: `server/src/module/app-commerce/services/app-license-access.service.ts`
- Create: `server/src/module/app-commerce/services/app-license-access.service.spec.ts`
- Create: `server/src/module/app-commerce/app-commerce-platform.controller.ts`
- Create: `server/src/module/app-commerce/app-commerce-platform.controller.spec.ts`
- Create: `server/src/module/app-commerce/app-commerce-tenant.controller.ts`
- Create: `server/src/module/app-commerce/app-commerce-tenant.controller.spec.ts`
- Modify: `server/src/module/app-commerce/app-commerce.module.ts`

**Interfaces:**
- Produces: `AppPricePlanService.listTenantPlans(appId, tenantId)`
- Produces: `AppPricePlanService.savePlan(appCode, dto, operatorId)`
- Produces: `AppLicenseAccessService.getAccessState(tenantId, app)`
- Produces:

```ts
interface TenantAppCommerceAccess {
  commerce_enabled: boolean;
  access_status:
    | 'legacy_free'
    | 'free'
    | 'included'
    | 'trialing'
    | 'licensed'
    | 'purchase_required'
    | 'expired'
    | 'revoked';
  can_install: boolean;
  can_open: boolean;
  action: 'install' | 'open' | 'start_trial' | 'purchase' | 'renew' | 'contact_admin';
  license_expires_at: string | null;
  plans: TenantVisibleAppPricePlan[];
}
```

- [ ] **Step 1: Write failing pricing and access tests**

Cover:

```ts
it('treats every app as legacy free while APP_COMMERCE_ENABLED is false');
it('keeps a published app with no active price plan legacy free');
it('returns free access for an active free plan');
it('returns included access only for an active matching SaaS subscription plan code');
it('filters selected-tenant plans by authoritative tenant id');
it('requires an active paid or trial license for paid-only applications');
it('does not return disabled plans or internal share calculations to tenants');
it('rejects free or included plans with a non-zero amount or developer share');
it('rejects paid plans without explicit developer_share_bps');
it('rejects duplicate active price-plan codes per application');
```

- [ ] **Step 2: Run pricing/access tests to verify RED**

```powershell
pnpm.cmd run test -- app-price-plan.service.spec.ts app-license-access.service.spec.ts app-commerce-platform.controller.spec.ts app-commerce-tenant.controller.spec.ts --runInBand
```

Expected: FAIL because services and controllers do not exist.

- [ ] **Step 3: Implement price validation and platform CRUD**

Platform routes:

```text
GET  /api/app-platform/commerce/apps/:code/prices
POST /api/app-platform/commerce/apps/:code/prices
PUT  /api/app-platform/commerce/apps/:code/prices/:planCode
PUT  /api/app-platform/commerce/apps/:code/prices/:planCode/status
```

Permissions:

```text
app:commerce:view
app:commerce:manage
```

Normalize plan codes to `^[a-z][a-z0-9_]{2,49}$`, deduplicate included SaaS plan codes and tenant IDs, and return integer cents only.

- [ ] **Step 4: Implement tenant access evaluation**

Tenant route:

```text
GET /api/app-tenant/commerce/apps/:code
```

Evaluation order:

1. commerce disabled -> `legacy_free`;
2. no active tenant-visible plans -> `legacy_free`;
3. active free plan -> `free`;
4. included plan plus current matching SaaS subscription -> `included`;
5. current active/trial license -> `licensed|trialing`;
6. historical expired/refunded/revoked license -> actionable state;
7. otherwise -> `purchase_required`.

- [ ] **Step 5: Run Task 2 tests and build**

```powershell
pnpm.cmd run test -- app-price-plan.service.spec.ts app-license-access.service.spec.ts app-commerce-platform.controller.spec.ts app-commerce-tenant.controller.spec.ts --runInBand
pnpm.cmd run build
```

- [ ] **Step 6: Review and commit Task 2**

```powershell
git add server/src/module/app-commerce
git commit -m "feat(app): manage application pricing"
```

---

### Task 3: Tenant Orders, Trials, License Activation, And Charge Ledger

**Files:**
- Create: `server/src/module/app-commerce/dto/app-order.dto.ts`
- Create: `server/src/module/app-commerce/services/app-order.service.ts`
- Create: `server/src/module/app-commerce/services/app-order.service.spec.ts`
- Create: `server/src/module/app-commerce/services/app-revenue-ledger.service.ts`
- Create: `server/src/module/app-commerce/services/app-revenue-ledger.service.spec.ts`
- Modify: `server/src/module/app-commerce/app-commerce-tenant.controller.ts`
- Modify: `server/src/module/app-commerce/app-commerce-tenant.controller.spec.ts`
- Modify: `server/src/module/app-commerce/app-commerce.module.ts`

**Interfaces:**
- Produces: `AppOrderService.createTenantOrder(tenantId, userId, appCode, dto)`
- Produces: `AppOrderService.confirmDevPayment(tenantId, orderNo)`
- Produces: `AppOrderService.confirmAlipayPayment(orderNo, tradeNo)`
- Produces: `AppOrderService.markTenantPaymentRequested(tenantId, orderNo, now)`
- Produces: `AppOrderService.startTrial(tenantId, userId, appCode, planCode)`
- Produces: `AppRevenueLedgerService.recordCharge(manager, order, license)`

- [ ] **Step 1: Write failing order/license/ledger tests**

Cover:

```ts
it('creates an AO order from the current backend price snapshot');
it('ignores amount, currency, share, developer, and license dates supplied by clients');
it('rejects free, included, disabled, foreign-tenant, unpublished, or unavailable price plans');
it('rejects a one-time purchase when a current one-time license already exists');
it('allows subscription renewal while preserving one current license');
it('activates license and charge ledger in the same transaction as paid status');
it('returns the existing paid order on duplicate confirmation without duplicate license or ledger rows');
it('calculates developer share with integer basis points and assigns the remainder to platform share');
it('starts one bounded trial and rejects every repeated trial attempt');
it('never creates a paid ledger row for free, included, or trial access');
```

- [ ] **Step 2: Run Task 3 tests to verify RED**

```powershell
pnpm.cmd run test -- app-order.service.spec.ts app-revenue-ledger.service.spec.ts app-commerce-tenant.controller.spec.ts --runInBand
```

- [ ] **Step 3: Implement tenant order and trial endpoints**

Routes:

```text
POST /api/app-tenant/commerce/apps/:code/orders
POST /api/app-tenant/commerce/apps/:code/trial
GET  /api/app-tenant/commerce/orders
GET  /api/app-tenant/commerce/orders/:orderNo
```

Permissions:

```text
app:tenant:purchase
app:tenant:orders
```

Order creation input contains only `price_plan_code` and `payment_method`. The saved order snapshots app name/code, pricing model, billing period, amount, currency, developer, and share basis points.

- [ ] **Step 4: Implement transactional payment activation**

Under a pessimistic order lock:

1. return existing paid state for duplicate confirmation;
2. reject every non-pending state;
3. mark order paid and store provider trade number;
4. expire the prior current subscription license when renewing;
5. create one current license with order-derived dates;
6. insert one immutable `charge` ledger row with event key `charge:<orderNo>`;
7. commit all changes together.

- [ ] **Step 5: Run Task 3 tests and build**

```powershell
pnpm.cmd run test -- app-order.service.spec.ts app-revenue-ledger.service.spec.ts app-commerce-tenant.controller.spec.ts --runInBand
pnpm.cmd run build
```

- [ ] **Step 6: Review and commit Task 3**

```powershell
git add server/src/module/app-commerce
git commit -m "feat(app): activate tenant app licenses"
```

---

### Task 4: Existing Alipay And Development Payment Integration

**Files:**
- Modify: `server/src/module/saas/services/saas-payment.service.ts`
- Modify: `server/src/module/saas/services/saas-payment.service.spec.ts`
- Modify: `server/src/module/saas/saas-payment.controller.ts`
- Modify: `server/src/module/saas/saas-payment.controller.spec.ts`
- Modify: `server/src/module/saas/saas.module.ts`
- Modify: `server/src/module/app-commerce/app-commerce.module.ts`
- Modify: `server/src/module/saas/saas-main-flow.integration.spec.ts`

**Interfaces:**
- Extends: `SaasPaymentOrderType = 'plan' | 'resource_pack' | 'app'`
- Consumes: `AppOrderService.findTenantOrder`, `findPlatformOrder`, `markTenantPaymentRequested`, `confirmDevPayment`, `confirmAlipayPayment`

- [ ] **Step 1: Write failing payment adapter tests**

Cover:

```ts
it('creates an Alipay page payment for an owned pending app order');
it('derives app order type only from the AO prefix during notify handling');
it('verifies signature, app id, paid trade state, exact order number, and exact amount');
it('activates the app license after a valid paid callback');
it('returns duplicate success for a replayed app callback');
it('rejects a cross-tenant create-payment request');
it('does not change plan or resource-pack payment behavior');
it('confirms app payments through the development endpoint only outside production');
```

- [ ] **Step 2: Run payment tests to verify RED**

```powershell
pnpm.cmd run test -- saas-payment.service.spec.ts saas-payment.controller.spec.ts saas-main-flow.integration.spec.ts app-order.service.spec.ts --runInBand
```

- [ ] **Step 3: Import the independent commerce module into SaaS payment**

`SaasModule` imports and re-exports `AppCommerceModule`. `AppCommerceModule` must still have no import of `SaasModule`.

- [ ] **Step 4: Extend payment service and controller**

Add app branches to payable-order resolution, payment-request marking, dev confirmation, platform order lookup, callback confirmation, and subject construction. Do not refactor plan/resource-pack behavior beyond extracting a three-way dispatch helper where required by tests.

Add `app:tenant:purchase` to the payment creation permission alternatives.

- [ ] **Step 5: Run Task 4 tests and build**

```powershell
pnpm.cmd run test -- saas-payment.service.spec.ts saas-payment.controller.spec.ts saas-main-flow.integration.spec.ts app-order.service.spec.ts --runInBand
pnpm.cmd run build
```

- [ ] **Step 6: Review and commit Task 4**

```powershell
git add server/src/module/saas server/src/module/app-commerce
git commit -m "feat(app): accept application payments"
```

---

### Task 5: License Enforcement Across Marketplace, Install, Open, Sessions, And Services

**Files:**
- Modify: `server/src/module/app/services/app-tenant.service.ts`
- Modify: `server/src/module/app/services/app-tenant.service.spec.ts`
- Modify: `server/src/module/app/services/app-runtime-session.service.ts`
- Modify: `server/src/module/app/services/app-runtime-session.service.spec.ts`
- Modify: `server/src/module/app/services/app-service-invocation-policy.service.ts`
- Modify: `server/src/module/app/services/app-service-invocation-policy.service.spec.ts`
- Modify: `server/src/module/app/entities/app-open-log.entity.ts`
- Modify: `server/src/module/app/app.module.ts`
- Modify: `server/src/module/app/app-tenant.controller.spec.ts`

**Interfaces:**
- Consumes: `AppLicenseAccessService.getAccessState(tenantId, app)`
- Produces marketplace fields: `commerce`, `can_install`, `can_open`, `commerce_action`
- Adds open denial reasons: `license_required`, `license_expired`, `license_revoked`

- [ ] **Step 1: Write failing authority tests**

Cover:

```ts
it('preserves install and open behavior when commerce is disabled');
it('preserves legacy-free apps with no active price plan');
it('blocks install for a paid app without a current license');
it('blocks open after license expiry, refund, or platform revocation');
it('allows included access only while the matching SaaS subscription remains active');
it('denies runtime-session issue and authorization after license loss');
it('denies restricted service target invocation when the target license is inactive');
it('does not revoke a paid license when the tenant uninstalls the app');
it('returns an actionable commerce state instead of Tenant has not enabled this module');
```

- [ ] **Step 2: Run authority tests to verify RED**

```powershell
pnpm.cmd run test -- app-tenant.service.spec.ts app-runtime-session.service.spec.ts app-service-invocation-policy.service.spec.ts app-tenant.controller.spec.ts --runInBand
```

- [ ] **Step 3: Add commerce state to marketplace and installed responses**

Load price/access state in bounded batches. Do not run one price/license/subscription query per application. The service may add one query per table and build maps by app ID and tenant ID.

- [ ] **Step 4: Enforce access at every authority transition**

Call the access service:

1. before install persistence;
2. after installation lookup and before open metadata/session creation;
3. during runtime-session issue;
4. during every runtime-session authorize call;
5. while resolving a target service for `service.invoke`.

Use stable generic denial messages and store only bounded reason codes in open/runtime audit rows.

- [ ] **Step 5: Run Task 5 tests and readiness gates**

```powershell
pnpm.cmd run test -- app-tenant.service.spec.ts app-runtime-session.service.spec.ts app-service-invocation-policy.service.spec.ts app-tenant.controller.spec.ts --runInBand
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run verify:app-developer-service-readiness
pnpm.cmd run build
```

- [ ] **Step 6: Review and commit Task 5**

```powershell
git add server/src/module/app
git commit -m "feat(app): enforce application licenses"
```

---

### Task 6: Full Refunds, Immutable Revenue, And Manual Settlement

**Files:**
- Create: `server/src/module/app-commerce/dto/app-settlement.dto.ts`
- Create: `server/src/module/app-commerce/services/app-settlement.service.ts`
- Create: `server/src/module/app-commerce/services/app-settlement.service.spec.ts`
- Modify: `server/src/module/app-commerce/services/app-order.service.ts`
- Modify: `server/src/module/app-commerce/services/app-order.service.spec.ts`
- Modify: `server/src/module/app-commerce/services/app-revenue-ledger.service.ts`
- Modify: `server/src/module/app-commerce/services/app-revenue-ledger.service.spec.ts`
- Modify: `server/src/module/app-commerce/app-commerce-platform.controller.ts`
- Modify: `server/src/module/app-commerce/app-commerce-platform.controller.spec.ts`
- Create: `server/src/module/app-commerce/app-commerce-developer.controller.ts`
- Create: `server/src/module/app-commerce/app-commerce-developer.controller.spec.ts`
- Modify: `server/src/module/app-commerce/app-commerce.module.ts`

**Interfaces:**
- Produces: `AppOrderService.recordFullRefund(orderNo, operatorId, reason, providerReference)`
- Produces: `AppRevenueLedgerService.getPlatformOverview(query)`
- Produces: `AppRevenueLedgerService.getDeveloperOverview(developerId, query)`
- Produces: `AppSettlementService.createBatch(developerId, period, operatorId)`
- Produces: `AppSettlementService.approveBatch(id, operatorId, note)`
- Produces: `AppSettlementService.markPaid(id, operatorId, paymentReference)`

- [ ] **Step 1: Write failing refund, revenue, and settlement tests**

Cover:

```ts
it('records one full refund and one negative immutable ledger row');
it('revokes the order-backed current license in the refund transaction');
it('returns the existing refunded state for duplicate refund recording');
it('does not mutate a paid settlement when a later refund creates a negative carry-forward');
it('aggregates platform and developer amounts without exposing other developers to owned endpoints');
it('claims only unsettled rows inside the closed period for one developer');
it('rejects current or future settlement periods');
it('allows draft to approved to paid and rejects every backward transition');
it('requires a bounded payment reference but performs no automated payout');
```

- [ ] **Step 2: Run Task 6 tests to verify RED**

```powershell
pnpm.cmd run test -- app-order.service.spec.ts app-revenue-ledger.service.spec.ts app-settlement.service.spec.ts app-commerce-platform.controller.spec.ts app-commerce-developer.controller.spec.ts --runInBand
```

- [ ] **Step 3: Implement platform refund and revenue endpoints**

Routes:

```text
POST /api/app-platform/commerce/orders/:orderNo/refund
GET  /api/app-platform/commerce/orders
GET  /api/app-platform/commerce/licenses
PUT  /api/app-platform/commerce/licenses/:id/revoke
GET  /api/app-platform/commerce/revenue
```

Refund is a recorded full refund only after the operator confirms the provider-side result. No provider credentials or raw callback payload is accepted or stored.

- [ ] **Step 4: Implement developer revenue and manual settlement endpoints**

Routes:

```text
GET  /api/app-developer/commerce/revenue
GET  /api/app-developer/commerce/settlements
GET  /api/app-platform/commerce/settlements
POST /api/app-platform/commerce/settlements
POST /api/app-platform/commerce/settlements/:id/approve
POST /api/app-platform/commerce/settlements/:id/paid
POST /api/app-platform/commerce/settlements/:id/cancel
```

Developer responses contain owned app code/name, period, gross/refund/developer amounts, order count, and batch status only. They contain no tenant contact details, provider identifiers, payment keys, or other developers' rows.

- [ ] **Step 5: Run Task 6 tests and build**

```powershell
pnpm.cmd run test -- app-order.service.spec.ts app-revenue-ledger.service.spec.ts app-settlement.service.spec.ts app-commerce-platform.controller.spec.ts app-commerce-developer.controller.spec.ts --runInBand
pnpm.cmd run build
```

- [ ] **Step 6: Review and commit Task 6**

```powershell
git add server/src/module/app-commerce
git commit -m "feat(app): settle application revenue"
```

---

### Task 7: Commerce Menus And Conversion UI

**Files:**
- Create: `server/src/migrations/1760000000045-SeedAppCommercializationMenus.ts`
- Create: `server/src/migration-specs/seed-app-commercialization-menus.spec.ts`
- Create: `web/src/api/app-commerce.ts`
- Modify: `web/src/api/app-marketplace.ts`
- Modify: `web/src/views/app-center/marketplace/index.vue`
- Modify: `web/src/views/app-center/installed/index.vue`
- Create: `web/src/views/app-center/orders/index.vue`
- Create: `web/src/views/app-center/developer-revenue/index.vue`
- Create: `web/src/views/app-platform/commercial/index.vue`
- Create: `web/scripts/verify-app-commerce-readiness.ts`
- Modify: `web/package.json`

**Interfaces:**
- Produces frontend `AppPricePlanRecord`, `TenantAppCommerceAccess`, `AppOrderRecord`, `TenantAppLicenseRecord`, `AppRevenueOverview`, and `AppSettlementRecord`.

- [ ] **Step 1: Write failing menu and deterministic UI readiness tests**

The menu migration must create:

```text
/app-platform/commercial
/app-center/orders
/app-center/developer-revenue
app:commerce:view
app:commerce:manage
app:settlement:manage
app:tenant:purchase
app:tenant:orders
app:developer:revenue
```

The readiness gate must fail until APIs, pages, price labels, loading/empty/error states, trial action, payment continuation, refund confirmation, and settlement state controls exist.

- [ ] **Step 2: Run menu/readiness tests to verify RED**

```powershell
cd server
pnpm.cmd run test -- seed-app-commercialization-menus.spec.ts --runInBand
cd ../web
pnpm.cmd run verify:app-commerce-readiness
```

- [ ] **Step 3: Implement menu grants**

Grant platform commerce menus only to `admin` and `super_admin`. Grant tenant order/purchase permissions to tenant owner/admin roles, marketplace/order read to tenant members, and developer revenue only alongside the existing developer workspace roles.

- [ ] **Step 4: Implement tenant conversion UI**

Marketplace cards show the actual access state and the lowest applicable tenant-visible plan. Actions are deterministic:

```text
legacy_free/free/included -> Install or Open
trial available -> Start trial
purchase_required -> Choose plan and pay
expired -> Renew
revoked -> Contact administrator
pending order -> Continue payment
```

The purchase dialog displays application, plan, billing period, amount, trial terms, and payment provider before creating the order. It never calculates totals or shares locally.

- [ ] **Step 5: Implement platform and developer commerce workspaces**

The platform page uses tabs for Price Plans, Orders, Licenses, Revenue, and Settlements. Use compact tables, dialogs for mutations, explicit confirmation for refund/revoke/paid transitions, and loading/empty/error/retry states.

The developer page shows owned gross, refunds, developer amount, unsettled amount, and settlement history without tenant-sensitive details.

- [ ] **Step 6: Run Task 7 frontend and migration gates**

```powershell
cd server
pnpm.cmd run test -- seed-app-commercialization-menus.spec.ts --runInBand
cd ../web
pnpm.cmd run verify:app-commerce-readiness
pnpm.cmd run verify:app-developer-readiness
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run build
```

- [ ] **Step 7: Review and commit Task 7**

```powershell
git add server/src/migrations/1760000000045-SeedAppCommercializationMenus.ts server/src/migration-specs/seed-app-commercialization-menus.spec.ts web/src/api web/src/views/app-center web/src/views/app-platform/commercial web/scripts web/package.json
git commit -m "feat(app): add commerce workspaces"
```

---

### Task 8: Disposable Purchase E2E, Operations, Security Review, And Final Commit

**Files:**
- Create: `server/scripts/verify-app-commerce-live-e2e-contract.ts`
- Create: `server/scripts/verify-app-commerce-live-e2e.ts`
- Modify: `server/package.json`
- Modify: `web/scripts/run-saas-readiness.ts`
- Create: `docs/deployment/app-commerce-baota.md`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Produces: `pnpm run verify:app-commerce-live-e2e-contract`
- Produces: `pnpm run verify:app-commerce-live-e2e`
- Adds P12 deterministic readiness to repository SaaS readiness.

- [ ] **Step 1: Write the live contract gate before the live script**

Require:

```text
disposable database and isolated non-zero Redis DB
feature flag initially disabled
published legacy-free app compatibility
free and included access
single-use trial
backend-owned paid order snapshot
development payment activation
duplicate payment confirmation idempotency
install and open after license activation
runtime authorization denial after expiry/refund/revocation
full refund ledger
developer ownership isolation
manual settlement transitions
no invoice or automated payout behavior
cleanup on success, failure, and signal
no credential, token, callback payload, environment, path, or provider-key output
```

- [ ] **Step 2: Run live contract to verify RED**

```powershell
cd server
pnpm.cmd run verify:app-commerce-live-e2e-contract
```

- [ ] **Step 3: Implement the disposable live lifecycle**

The gate creates a disposable app, developer, two tenants, free/included/paid/trial plans, paid order, license, charge/refund ledger, and settlement rows. It proves cross-tenant purchase/open denial, replay safety, runtime invalidation after refund, and cleanup. Real Alipay network calls are not made; the existing development confirmation path is used only in an explicitly non-production disposable backend.

- [ ] **Step 4: Write the disabled-first Baota runbook**

Document backup, migration, payment callback verification, initially disabled feature flag, internal free/paid smoke, developer share review, refund recording, settlement approval, observation, rollback, and cleanup. Use variable names only and include no credentials, provider keys, environment values, concrete runtime paths, or production identifiers.

- [ ] **Step 5: Run focused P12 backend gates**

```powershell
pnpm.cmd run test -- app-commerce-entities.spec.ts create-app-commercialization.spec.ts seed-app-commercialization-menus.spec.ts app-price-plan.service.spec.ts app-license-access.service.spec.ts app-order.service.spec.ts app-revenue-ledger.service.spec.ts app-settlement.service.spec.ts app-commerce-platform.controller.spec.ts app-commerce-tenant.controller.spec.ts app-commerce-developer.controller.spec.ts saas-payment.service.spec.ts saas-payment.controller.spec.ts app-tenant.service.spec.ts app-runtime-session.service.spec.ts app-service-invocation-policy.service.spec.ts --runInBand
pnpm.cmd run verify:saas-readiness
pnpm.cmd run verify:app-commerce-live-e2e-contract
pnpm.cmd run build
```

- [ ] **Step 6: Run focused P12 frontend gates**

```powershell
cd ../web
pnpm.cmd run verify:app-commerce-readiness
pnpm.cmd run verify:app-developer-readiness
pnpm.cmd run verify:app-developer-service-readiness
pnpm.cmd run verify:app-runtime-sdk
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run verify:saas-readiness
pnpm.cmd run build
```

- [ ] **Step 7: Run or safely block the live gate**

Run the live gate only in an explicitly disposable environment. On Windows or absent isolation variables, it must exit before resource creation and report variable names only. A green disposable Linux run remains required before production enablement.

- [ ] **Step 8: Perform final security and scope review**

Verify:

- every payable amount/share/currency/app/tenant/developer field comes from locked backend rows;
- callbacks derive app order type from `AO`, verify exact amount, and are replay-safe;
- licenses are tenant/application scoped and rechecked at every authority transition;
- included access disappears with SaaS subscription loss;
- uninstall preserves license while refund/revocation/expiry denies open and runtime calls;
- ledger rows are immutable and settlement claims each row at most once;
- developer APIs cannot read other developers, tenants, provider identifiers, or payment payloads;
- plan/resource-pack orders, current SaaS revenue report, marketplace, analytics, P9, P10, and P11 remain green;
- no coupon, tax, foreign currency, usage charging, automatic renewal, stored payment method, automated payout, or invoice behavior entered the diff.

- [ ] **Step 9: Inspect diff and commit final P12 verification**

```powershell
git diff --check
git status --short
git diff --stat db235ce..HEAD
git log --oneline db235ce..HEAD
```

Expected: only P12 commerce, payment adapter, application authority, UI, migration, readiness, and operations changes; no generated output, dependency directory, environment file, credential, runtime artifact, or unrelated change.

```powershell
git add server/scripts server/package.json web/scripts/run-saas-readiness.ts docs/deployment/app-commerce-baota.md docs/saas-launch-readiness-checklist.md
git commit -m "test(app): verify application commerce"
```

---

## Plan Self-Review

- **Spec coverage:** Price plans, free/included/subscription/one-time models, trials, application orders, existing Alipay payment verification, tenant licenses, refund invalidation, immutable revenue, manual settlement, tenant conversion UI, platform operations, developer revenue, and launch gates are each assigned to a task.
- **Backward compatibility:** Commerce is disabled by default and apps without active price plans remain legacy free. Existing plan/resource-pack payment behavior and SaaS revenue reporting are preserved.
- **Dependency direction:** `AppCommerceModule` has no dependency on `SaasModule` or `AppMarketplaceModule`; `SaasModule` imports commerce for payment dispatch; application marketplace consumes the re-exported access service.
- **Authority consistency:** Tenant and price authority come from backend rows. License checks occur at install, open, runtime issue/authorize, and service-target invocation.
- **Payment consistency:** Application orders use `AO`; callback amount and order type are server-derived; duplicate confirmation is idempotent and transactional.
- **Accounting consistency:** Charge/refund/adjustment rows are immutable, integer-cent shares use explicit basis points, and settled history is not rewritten by later refunds.
- **Scope control:** No invoices, automatic payouts, Alipay refund initiation, partial refunds, coupons, tax, foreign currency, usage billing, automatic renewal, stored payment methods, containers, or unrelated refactors.
- **No placeholders:** Every task has exact files, interfaces, behaviors, commands, expected failures/passes, review checks, and commit boundaries.
