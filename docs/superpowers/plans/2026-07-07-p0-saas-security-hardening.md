# P0 SaaS Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-risk SaaS security gaps in payment notification validation, refresh-token tenant continuity, and public tenant lookup enumeration.

**Architecture:** Keep the changes narrow and compatibility-focused. Payment callbacks validate signature plus local order identity and amount before mutating orders; refresh tokens store a server-side tenant context so rotated sessions preserve the selected tenant; public tenant lookup becomes password-gated while the old username-only endpoint stops disclosing tenant membership.

**Tech Stack:** NestJS, TypeORM repositories, Redis-backed sessions, Jest, Vue 3, Element Plus, pnpm.

---

## File Structure

- Modify: `server/src/module/saas/services/saas-payment.service.ts`
  - Add paid Alipay notification validation with app id, paid status, order number, amount, and trade number checks.
- Modify: `server/src/module/saas/services/saas-payment.service.spec.ts`
  - Add regression tests for valid paid notify, invalid signature, app mismatch, unpaid status, order mismatch, amount mismatch, and malformed amount.
- Modify: `server/src/module/saas/saas-payment.controller.ts`
  - Resolve local plan/resource-pack order before confirming paid callbacks and use the stricter validation result.
- Modify: `server/src/module/saas/saas-payment.controller.spec.ts`
  - Verify paid callbacks are confirmed only after local order lookup and paid-notify validation.
- Modify: `server/src/module/system/user/user.service.ts`
  - Store refresh token metadata with user and tenant context; preserve tenant during login, refresh, and tenant switch.
  - Add credential-gated tenant lookup while preserving a non-enumerating username-only response.
- Modify: `server/src/module/system/user/user.service.spec.ts`
  - Add regression tests for refresh-token metadata and credential-gated tenant lookup.
- Modify: `server/src/module/main/main.service.ts`
  - Proxy the new credential-gated tenant lookup endpoint.
- Modify: `server/src/module/main/main.controller.ts`
  - Add `POST /api/core/tenants-by-credentials` and keep `GET /api/core/tenants-by-username` non-enumerating.
- Modify: `web/src/api/auth.ts`
  - Add `fetchTenantsByCredentials` and keep `fetchTenantsByUsername` for backward compatibility.
- Modify: `web/src/views/auth/login/index.vue`
  - Trigger tenant lookup after username and password are available rather than exposing tenants by username alone.

---

### Task 1: Harden Alipay Paid Notify Validation

- [ ] Step 1: Add failing service tests for `verifyAlipayPaidNotify`.
- [ ] Step 2: Run focused service tests and confirm RED.
- [ ] Step 3: Implement `verifyAlipayPaidNotify` with signature, `app_id`, paid status, `out_trade_no`, and `total_amount` validation.
- [ ] Step 4: Run focused service tests and confirm GREEN.
- [ ] Step 5: Add failing controller tests proving paid callbacks load the local order and reject validation failures.
- [ ] Step 6: Run focused controller tests and confirm RED.
- [ ] Step 7: Update controller callback flow to validate the paid notify against local order data before confirmation.
- [ ] Step 8: Run focused payment tests and confirm GREEN.

### Task 2: Preserve Tenant Context During Refresh Token Rotation

- [ ] Step 1: Add failing tests for refresh-token metadata storing `tenantId` and refresh preserving that tenant even without a usable old access token.
- [ ] Step 2: Run focused user service tests and confirm RED.
- [ ] Step 3: Store refresh-token metadata as JSON-compatible data and read both legacy numeric and new object formats.
- [ ] Step 4: Pass `tenantId` when creating refresh tokens during login, refresh, and tenant switch.
- [ ] Step 5: Run focused user service tests and confirm GREEN.

### Task 3: Stop Public Username Tenant Enumeration

- [ ] Step 1: Add failing tests proving username-only lookup returns an empty non-enumerating response and credential lookup returns tenants only after password verification.
- [ ] Step 2: Run focused user service tests and confirm RED.
- [ ] Step 3: Add `getTenantsByCredentials` and make `getTenantsByUsername` non-enumerating.
- [ ] Step 4: Add controller/service proxy for `POST /api/core/tenants-by-credentials`.
- [ ] Step 5: Update the login page to call credential-gated tenant lookup after username and password input.
- [ ] Step 6: Run focused backend tests and frontend build/type verification.

### Task 4: Verification, Review, and Commit

- [ ] Step 1: Run focused backend tests:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/services/saas-payment.service.spec.ts src/module/saas/saas-payment.controller.spec.ts src/module/system/user/user.service.spec.ts src/module/main/main.service.permissions.spec.ts --runInBand
```

- [ ] Step 2: Run backend build:

```powershell
cd server
pnpm.cmd run build
```

- [ ] Step 3: Run frontend build:

```powershell
cd web
pnpm.cmd run build
```

- [ ] Step 4: Review only the intentional diff and keep unrelated local files unstaged:

```powershell
git diff --check
git diff -- docs/superpowers/plans/2026-07-07-p0-saas-security-hardening.md server/src/module/saas server/src/module/system/user/user.service.ts server/src/module/system/user/user.service.spec.ts server/src/module/main/main.service.ts server/src/module/main/main.controller.ts web/src/api/auth.ts web/src/views/auth/login/index.vue
git status --short
```

- [ ] Step 5: Commit P0 changes:

```powershell
git add docs/superpowers/plans/2026-07-07-p0-saas-security-hardening.md server/src/module/saas/services/saas-payment.service.ts server/src/module/saas/services/saas-payment.service.spec.ts server/src/module/saas/saas-payment.controller.ts server/src/module/saas/saas-payment.controller.spec.ts server/src/module/system/user/user.service.ts server/src/module/system/user/user.service.spec.ts server/src/module/main/main.service.ts server/src/module/main/main.controller.ts web/src/api/auth.ts web/src/views/auth/login/index.vue
git commit -m "fix: harden p0 saas security flows"
```

---

## Self-Review

- Spec coverage: The plan covers all P0 risks selected from the SaaS audit: Alipay notify trust boundary, refresh tenant drift, and public tenant enumeration.
- Placeholder scan: No TBD/TODO/fill-in instructions remain.
- Type consistency: Planned method names, route names, and file paths match the current project conventions.
- Scope check: The plan intentionally avoids invoice support, broad UI redesign, DB-driven authorization rewrites, or remote push.
