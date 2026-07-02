# SaaS Payment Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal SaaS upgrade flow with tenant upgrade orders, local simulated payment success, and reserved Alipay notify entrypoint.

**Architecture:** Add a focused SaaS order domain beside the existing plan, subscription, and quota services. The backend owns pricing and subscription mutation; the frontend only requests a target plan and shows order/payment state.

**Tech Stack:** NestJS, TypeORM migrations/entities, Jest, Vue 3, Element Plus, existing request wrapper.

## Global Constraints

- Keep changes scoped to existing `server/src/module/saas` and `web/src/views/saas/tenant/plan`.
- Use TDD for backend order/payment behavior before production implementation.
- Store money as integer cents in backend data model.
- Do not integrate real Alipay SDK in this slice; expose a notify endpoint placeholder and a development confirm endpoint.
- Payment success is the only event that upgrades subscription and synchronizes quotas.

---

### Task 1: Backend Order Domain

**Files:**
- Create: `server/src/module/saas/entities/saas-order.entity.ts`
- Create: `server/src/module/saas/dto/create-upgrade-order.dto.ts`
- Create: `server/src/module/saas/services/saas-order.service.ts`
- Test: `server/src/module/saas/services/saas-order.service.spec.ts`
- Modify: `server/src/module/saas/saas.module.ts`

**Interfaces:**
- Produces: `SaasOrderService.createUpgradeOrder(tenantId: number, dto: CreateUpgradeOrderDto): Promise<SaasOrderEntity>`
- Produces: `SaasOrderService.confirmDevPayment(tenantId: number, orderNo: string): Promise<SaasOrderEntity>`

- [ ] Write failing service tests for creating a pending upgrade order and confirming payment.
- [ ] Implement `SaasOrderEntity` and DTO.
- [ ] Implement `SaasOrderService` with backend-owned pricing and transaction-safe subscription/quota update.
- [ ] Register entity and service in `SaasModule`.
- [ ] Run targeted Jest tests.

### Task 2: Migration And API Surface

**Files:**
- Create: `server/src/migrations/1760000000003-CreateSaasOrdersAndPlanPrices.ts`
- Modify: `server/src/module/saas/entities/saas-plan.entity.ts`
- Modify: `server/src/module/saas/saas-tenant.controller.ts`
- Test: `server/src/module/saas/saas-tenant.controller.spec.ts`

**Interfaces:**
- Produces: `GET /api/saas/tenant/plans`
- Produces: `POST /api/saas/tenant/orders`
- Produces: `GET /api/saas/tenant/orders/:order_no`
- Produces: `POST /api/saas/payment/dev-confirm`
- Produces: `POST /api/saas/payment/alipay/notify`

- [ ] Write failing controller tests for tenant plan listing and order endpoints.
- [ ] Add plan price fields and `saas_order` migration.
- [ ] Add tenant controller endpoints.
- [ ] Add payment controller endpoints.
- [ ] Run migration locally.

### Task 3: Frontend Upgrade Flow

**Files:**
- Modify: `web/src/api/saas.ts`
- Modify: `web/src/views/saas/tenant/plan/index.vue`

**Interfaces:**
- Consumes: backend plan list, create order, dev-confirm, subscription summary.
- Produces: plan cards with upgrade button and local simulated payment confirmation.

- [ ] Add SaaS API methods/types.
- [ ] Replace disabled payment button with plan cards.
- [ ] Create order from selected plan and show pending order.
- [ ] Add development “simulate payment success” action.
- [ ] Refresh subscription after payment success.

### Task 4: Verification And Commit

**Files:**
- All files changed by Tasks 1-3.

- [ ] Run `pnpm exec jest --runInBand` in `server`.
- [ ] Run `pnpm exec tsc --noEmit` in `server`.
- [ ] Run `pnpm exec vue-tsc --noEmit` in `web`.
- [ ] Verify local API flow: plans, create order, dev-confirm, subscription, usage.
- [ ] Verify browser flow on `http://127.0.0.1:5731/#/tenant-saas/plan`.
- [ ] Commit with message `feat: add SaaS upgrade order flow`.
