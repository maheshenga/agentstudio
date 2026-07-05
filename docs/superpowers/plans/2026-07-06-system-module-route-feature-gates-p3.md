# System Module Route Feature Gates P3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the global `SystemModuleGuard` pass exact SaaS feature requirements for tenant feature routes before controllers or services run.

**Architecture:** Keep `SystemModuleAccessService.assertModuleAccess` as the single access decision point. Extend `SystemModuleGuard` route bindings with optional `requiredSaasModuleCode`, order specific tenant feature prefixes before broad module prefixes, and pass the required SaaS module code through to the access service. This complements, rather than replaces, the controller/service gates added in P1/P2.

**Tech Stack:** NestJS guard, Jest unit tests, TypeScript route binding metadata.

---

## File Structure

- Modify: `server/src/module/system-module/system-module.guard.ts`
  - Add `requiredSaasModuleCode?: string` to route binding metadata.
  - Add specific bindings for tenant member and resource-pack routes before `/api/saas/tenant`.
  - Add a specific binding for non-admin AI chat routes before the broad `/api/ai` binding.
  - Match route prefixes with path-segment boundaries and choose the longest matching prefix.
  - Include `requiredSaasModuleCode` in the `assertModuleAccess` call.
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`
  - Add tests proving specific feature routes pass `requiredSaasModuleCode`.
  - Add a test proving `/api/ai/admin` stays broad `ai_console` access and is not incorrectly gated by `ai_chat`.
- Review only: `server/src/module/saas/saas-tenant.controller.ts`
  - Existing P1 controller feature gates remain in place as defense in depth.
- Review only: `server/src/module/ai/ai-admin.controller.ts`
  - AI admin routes must not be treated as tenant chat feature routes.

## Scope

### In Scope

- Global route-level feature gate metadata for:
  - `/api/saas/tenant/members` -> `tenant_saas` + `member_management`
  - `/api/saas/tenant/resource-packs` -> `tenant_saas` + `resource_pack`
  - `/api/saas/tenant/resource-pack-orders` -> `tenant_saas` + `resource_pack`
  - `/api/ai/sessions`, `/api/ai/models/options`, `/api/ai/agents/options` -> `ai_console` + `ai_chat`
- Guard unit tests.
- Focused backend tests and build.

### Out Of Scope

- Removing existing P1/P2 controller/service gates.
- Changing SaaS plan/module bridge behavior.
- Changing AI admin provider/model management gates.
- Frontend changes.
- Database migrations.
- Remote push.

---

## Task 1: Add Failing Guard Tests

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Add a member route feature-gate test**

Append this test inside `describe('SystemModuleGuard', () => { ... })`:

```ts
  it('passes member management SaaS feature requirements for tenant member routes', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/saas/tenant/members', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'tenant_saas',
      tenantId: 23,
      userId: 9,
      requiredSaasModuleCode: 'member_management',
    });
  });
```

- [ ] **Step 2: Add a resource-pack route feature-gate test**

Append this test:

```ts
  it('passes resource pack SaaS feature requirements for tenant resource pack order routes', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/saas/tenant/resource-pack-orders', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'tenant_saas',
      tenantId: 23,
      userId: 9,
      requiredSaasModuleCode: 'resource_pack',
    });
  });
```

- [ ] **Step 3: Add an AI chat route feature-gate test**

Append this test:

```ts
  it('passes AI chat SaaS feature requirements for tenant chat routes', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/ai/sessions', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'ai_console',
      tenantId: 23,
      userId: 9,
      requiredSaasModuleCode: 'ai_chat',
    });
  });
```

- [ ] **Step 4: Add an AI admin broad-gate regression test**

Append this test:

```ts
  it('does not require ai_chat for AI admin routes', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/ai/admin/providers/list', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'ai_console',
      tenantId: 23,
      userId: 9,
    });
  });
```

- [ ] **Step 5: Add a route segment-boundary regression test**

Append this test:

```ts
  it('keeps feature bindings scoped to route segment boundaries', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/saas/tenant/resource-pack-orders-admin', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'tenant_saas',
      tenantId: 23,
      userId: 9,
    });
  });
```

- [ ] **Step 6: Run the focused guard test and confirm RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: FAIL because `SystemModuleGuard` currently does not pass `requiredSaasModuleCode` and uses raw `startsWith()` route matching.

---

## Task 2: Implement Exact Route Feature Bindings

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.ts`

- [ ] **Step 1: Extend the route binding type**

Replace:

```ts
type SystemModuleRouteBinding = {
  prefix: string;
  moduleCode: string;
  tenantScoped: boolean;
};
```

with:

```ts
type SystemModuleRouteBinding = {
  prefix: string;
  moduleCode: string;
  tenantScoped: boolean;
  requiredSaasModuleCode?: string;
};
```

- [ ] **Step 2: Add specific feature route bindings before broad bindings**

Replace the `ROUTE_BINDINGS` array with:

```ts
const ROUTE_BINDINGS: SystemModuleRouteBinding[] = [
  { prefix: '/api/saas/tenant/members', moduleCode: 'tenant_saas', tenantScoped: true, requiredSaasModuleCode: 'member_management' },
  { prefix: '/api/saas/tenant/resource-pack-orders', moduleCode: 'tenant_saas', tenantScoped: true, requiredSaasModuleCode: 'resource_pack' },
  { prefix: '/api/saas/tenant/resource-packs', moduleCode: 'tenant_saas', tenantScoped: true, requiredSaasModuleCode: 'resource_pack' },
  { prefix: '/api/ai/admin', moduleCode: 'ai_console', tenantScoped: true },
  { prefix: '/api/ai/sessions', moduleCode: 'ai_console', tenantScoped: true, requiredSaasModuleCode: 'ai_chat' },
  { prefix: '/api/ai/models/options', moduleCode: 'ai_console', tenantScoped: true, requiredSaasModuleCode: 'ai_chat' },
  { prefix: '/api/ai/agents/options', moduleCode: 'ai_console', tenantScoped: true, requiredSaasModuleCode: 'ai_chat' },
  { prefix: '/api/saas/platform', moduleCode: 'saas_platform', tenantScoped: false },
  { prefix: '/api/saas/tenant', moduleCode: 'tenant_saas', tenantScoped: true },
  { prefix: '/api/ai', moduleCode: 'ai_console', tenantScoped: true },
  { prefix: '/api/taixu', moduleCode: 'taixu_workspace', tenantScoped: true },
];
```

Ordering matters: specific prefixes must come before broad prefixes because `matchBinding()` returns the first matching binding.

- [ ] **Step 3: Pass the exact SaaS feature to the access service only when configured**

Update the existing access-service import:

```ts
import { SystemModuleAccessService, type AssertModuleAccessOptions } from './services/system-module-access.service';
```

Replace:

```ts
    await this.accessService.assertModuleAccess({
      moduleCode: binding.moduleCode,
      tenantId,
      userId: this.resolveUserId(user),
    });
```

with:

```ts
    const accessOptions: AssertModuleAccessOptions = {
      moduleCode: binding.moduleCode,
      tenantId,
      userId: this.resolveUserId(user),
    };
    if (binding.requiredSaasModuleCode) {
      Object.assign(accessOptions, { requiredSaasModuleCode: binding.requiredSaasModuleCode });
    }

    await this.accessService.assertModuleAccess(accessOptions);
```

- [ ] **Step 4: Replace raw prefix matching with segment-boundary longest-prefix matching**

Replace:

```ts
    return ROUTE_BINDINGS.find((binding) => normalizedPath.startsWith(binding.prefix));
```

with:

```ts
    return ROUTE_BINDINGS.filter(
      (binding) => normalizedPath === binding.prefix || normalizedPath.startsWith(`${binding.prefix}/`),
    ).sort((left, right) => right.prefix.length - left.prefix.length)[0];
```

- [ ] **Step 5: Run focused guard test and confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: PASS.

---

## Task 3: Verify, Review, And Commit P3

**Files:**
- Review: `server/src/module/system-module/system-module.guard.ts`
- Review: `server/src/module/system-module/system-module.guard.spec.ts`
- Review: `docs/superpowers/plans/2026-07-06-system-module-route-feature-gates-p3.md`

- [ ] **Step 1: Run guard and access regression tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts src/module/system-module/services/system-module-access.service.spec.ts src/module/saas/saas-tenant.controller.spec.ts src/module/saas/services/saas-resource-pack-order.service.spec.ts src/module/ai/services/chat.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Request code review**

Ask a review worker to check:

- Specific route bindings are ordered before broad route bindings.
- AI admin routes are not accidentally gated by `ai_chat`.
- Tenant member and resource-pack routes pass exact SaaS feature requirements.
- Existing controller/service gates remain intact.
- No unrelated files are staged.

- [ ] **Step 4: Commit P3**

Stage only:

```powershell
git add docs/superpowers/plans/2026-07-06-system-module-route-feature-gates-p3.md server/src/module/system-module/system-module.guard.ts server/src/module/system-module/system-module.guard.spec.ts
git commit -m "fix: add exact system module route feature gates"
```

Do not stage:

```text
server/pnpm-lock.yaml
.codebase-memory/
.codegraph/
```

---

## Self-Review

Spec coverage:
- Tenant member routes are covered by a guard-level `member_management` feature requirement.
- Tenant resource-pack routes are covered by a guard-level `resource_pack` feature requirement.
- Tenant AI chat routes are covered by a guard-level `ai_chat` feature requirement.
- AI admin routes retain broad `ai_console` behavior.
- P1/P2 controller/service gates remain as defense in depth.

Placeholder scan:
- No TODO/TBD placeholders.
- Every implementation step includes concrete code and exact commands.

Risk controls:
- Route ordering is explicit and tested.
- No database, frontend, or SaaS bridge changes are included.
- Existing broad module gates remain as fallback bindings.
