# Taixu Shared Route Any Feature Gates P8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate Taixu shared workspace routes with at least one relevant SaaS feature (`ai_chat` or `rag`) instead of allowing broad `taixu_workspace` access alone.

**Architecture:** Extend `SystemModuleAccessService.assertModuleAccess()` with an optional `requiredAnySaasModuleCodes` array. Keep exact single-feature checks for routes that clearly belong to one feature, and use the new any-feature check for shared Taixu model/history/memory/setting routes that support both AI chat and RAG workflows. Keep home/user/public routes on broad workspace behavior.

**Tech Stack:** NestJS guard, Jest unit tests, TypeScript access options.

---

## File Structure

- Modify: `server/src/module/system-module/services/system-module-access.service.ts`
  - Add `requiredAnySaasModuleCodes?: string[]` to `AssertModuleAccessOptions`.
  - Load tenant SaaS module codes when an any-feature requirement is present.
  - Deny access when none of the required-any feature codes are enabled.
  - Preserve existing exact `requiredSaasModuleCode` behavior.
- Modify: `server/src/module/system-module/services/system-module-access.service.spec.ts`
  - Add tests proving any-feature requirements pass when one listed feature exists.
  - Add tests proving any-feature requirements fail when none exist.
  - Add a regression proving explicit tenant module grants do not bypass any-feature requirements.
- Modify: `server/src/module/system-module/system-module.guard.ts`
  - Add `requiredAnySaasModuleCodes?: string[]` to route binding metadata.
  - Pass `requiredAnySaasModuleCodes` into `assertModuleAccess()`.
  - Add shared Taixu route bindings for `/api/taixu/model`, `/api/taixu/history`, `/api/taixu/memory`, and `/api/taixu/setting`.
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`
  - Add tests for shared Taixu routes requiring any of `ai_chat` or `rag`.
  - Move generic broad fallback coverage to `/api/taixu/home/current_weather` so model routes are no longer treated as broad-only.
  - Add regressions proving `/api/taixu/user/*` stays broad and shared prefixes remain segment-boundary scoped.
  - Keep public and segment-boundary regressions.

## Scope

### In Scope

- Any-feature access support in the system module access service.
- Shared Taixu route gates:
  - `/api/taixu/model/*` -> `taixu_workspace` + any of `ai_chat`, `rag`
  - `/api/taixu/history/*` -> `taixu_workspace` + any of `ai_chat`, `rag`
  - `/api/taixu/memory/*` -> `taixu_workspace` + any of `ai_chat`, `rag`
  - `/api/taixu/setting/*` -> `taixu_workspace` + any of `ai_chat`, `rag`
- Guard and access-service unit tests.
- Focused backend tests and build.
- Local commit only.

### Out Of Scope

- Dynamic per-request setting gates based on `source` query/body fields.
- Home/user Taixu workspace routes.
- New SaaS module codes.
- Database migrations.
- Frontend changes.
- Remote push.
- Invoice functionality.

---

## Task 1: Add Failing Access-Service Tests

**Files:**
- Modify: `server/src/module/system-module/services/system-module-access.service.spec.ts`

- [ ] **Step 1: Add an any-feature allow test**

Append this test inside `describe('SystemModuleAccessService', () => { ... })`:

```ts
  it('allows access when any required SaaS feature is present', async () => {
    const { service } = createService({
      modules: [enabledModule('taixu_workspace')],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'taixu_workspace',
        requiredAnySaasModuleCodes: ['ai_chat', 'rag'],
        saasModuleCodes: ['rag'],
      }),
    ).resolves.toBe(true);
  });
```

- [ ] **Step 2: Add an any-feature deny test**

Append this test:

```ts
  it('denies access when all required-any SaaS features are missing', async () => {
    const { service } = createService({
      modules: [enabledModule('taixu_workspace')],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'taixu_workspace',
        requiredAnySaasModuleCodes: ['ai_chat', 'rag'],
        saasModuleCodes: ['member_management'],
      }),
    ).rejects.toThrow('Current plan has not enabled this module');
  });
```

- [ ] **Step 3: Add an explicit tenant module bypass regression test**

Append this test:

```ts
  it('does not let an explicit tenant module bypass required-any SaaS feature gates', async () => {
    const { service } = createService({
      modules: [enabledModule('taixu_workspace')],
      tenantModules: [{ tenantId: 10, moduleCode: 'taixu_workspace', enabled: 1 }],
      saasModuleCodes: ['member_management'],
    });

    await expect(
      service.assertModuleAccess({
        tenantId: 10,
        moduleCode: 'taixu_workspace',
        requiredAnySaasModuleCodes: ['ai_chat', 'rag'],
      }),
    ).rejects.toThrow('Current plan has not enabled this module');
  });
```

- [ ] **Step 4: Run access-service tests and confirm RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/services/system-module-access.service.spec.ts --runInBand
```

Expected: FAIL because `AssertModuleAccessOptions` and `assertModuleAccess()` do not support `requiredAnySaasModuleCodes`.

---

## Task 2: Implement Any-Feature Access Checks

**Files:**
- Modify: `server/src/module/system-module/services/system-module-access.service.ts`

- [ ] **Step 1: Extend access options**

Add the new option:

```ts
  requiredAnySaasModuleCodes?: string[];
```

- [ ] **Step 2: Load tenant SaaS module codes for any-feature checks**

Replace:

```ts
      const tenantSaasModuleCodes =
        options.requiredSaasModuleCode || options.saasModuleCodes
          ? options.saasModuleCodes ?? (await this.loadTenantSaasModuleCodes(options.tenantId))
          : undefined;
```

with:

```ts
      const requiredAnySaasModuleCodes = (options.requiredAnySaasModuleCodes || []).filter(Boolean);
      const tenantSaasModuleCodes =
        options.requiredSaasModuleCode || requiredAnySaasModuleCodes.length || options.saasModuleCodes
          ? options.saasModuleCodes ?? (await this.loadTenantSaasModuleCodes(options.tenantId))
          : undefined;
```

- [ ] **Step 3: Deny when no required-any feature is present**

After the exact `requiredSaasModuleCode` check, add:

```ts
      if (
        requiredAnySaasModuleCodes.length &&
        !requiredAnySaasModuleCodes.some((code) => (tenantSaasModuleCodes || []).includes(code))
      ) {
        throw new BadRequestException('Current plan has not enabled this module');
      }
```

- [ ] **Step 4: Run access-service tests and confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/services/system-module-access.service.spec.ts --runInBand
```

Expected: PASS.

---

## Task 3: Add Failing Guard Tests For Shared Taixu Routes

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.spec.ts`

- [ ] **Step 1: Add shared Taixu route tests**

Append this test:

```ts
  it.each([
    '/api/taixu/model/page',
    '/api/taixu/model/list',
    '/api/taixu/history/records',
    '/api/taixu/history/update',
    '/api/taixu/memory/details',
    '/api/taixu/memory/download',
    '/api/taixu/setting/list',
    '/api/taixu/setting/save',
  ])('passes any AI/RAG SaaS feature requirements for shared Taixu route %s', async (path) => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext(path, {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'taixu_workspace',
      tenantId: 23,
      userId: 9,
      requiredAnySaasModuleCodes: ['ai_chat', 'rag'],
    });
  });
```

- [ ] **Step 2: Update generic broad fallback test path**

Replace:

```ts
        createContext('/api/taixu/model/page', {
```

with:

```ts
        createContext('/api/taixu/home/current_weather', {
```

- [ ] **Step 3: Run guard tests and confirm RED**

Add these regressions after the broad fallback test:

```ts
  it('keeps Taixu user routes on the broad workspace gate', async () => {
    const access = {
      assertModuleAccess: jest.fn().mockResolvedValue(true),
    };
    const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

    await expect(
      guard.canActivate(
        createContext('/api/taixu/user/page', {
          userId: 9,
          tenantId: 23,
        }),
      ),
    ).resolves.toBe(true);

    expect(access.assertModuleAccess).toHaveBeenCalledWith({
      moduleCode: 'taixu_workspace',
      tenantId: 23,
      userId: 9,
    });
  });

  it.each(['/api/taixu/modeling/page', '/api/taixu/settings/list'])(
    'keeps shared Taixu feature bindings scoped to route segment boundaries for %s',
    async (path) => {
      const access = {
        assertModuleAccess: jest.fn().mockResolvedValue(true),
      };
      const guard = new SystemModuleGuard(new Reflector(), access as unknown as SystemModuleAccessService);

      await expect(
        guard.canActivate(
          createContext(path, {
            userId: 9,
            tenantId: 23,
          }),
        ),
      ).resolves.toBe(true);

      expect(access.assertModuleAccess).toHaveBeenCalledWith({
        moduleCode: 'taixu_workspace',
        tenantId: 23,
        userId: 9,
      });
    },
  );
```

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: FAIL because shared routes currently pass only broad `taixu_workspace` without `requiredAnySaasModuleCodes`.

---

## Task 4: Implement Shared Taixu Route Bindings

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.ts`

- [ ] **Step 1: Extend route binding metadata**

Add the new binding field:

```ts
  requiredAnySaasModuleCodes?: string[];
```

- [ ] **Step 2: Add a shared feature constant**

Add near `ROUTE_BINDINGS`:

```ts
const TAIXU_SHARED_SAAS_MODULE_CODES = ['ai_chat', 'rag'];
```

- [ ] **Step 3: Add shared route bindings before broad `/api/taixu`**

Insert before broad `/api/taixu`:

```ts
  {
    prefix: '/api/taixu/model',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredAnySaasModuleCodes: TAIXU_SHARED_SAAS_MODULE_CODES,
  },
  {
    prefix: '/api/taixu/history',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredAnySaasModuleCodes: TAIXU_SHARED_SAAS_MODULE_CODES,
  },
  {
    prefix: '/api/taixu/memory',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredAnySaasModuleCodes: TAIXU_SHARED_SAAS_MODULE_CODES,
  },
  {
    prefix: '/api/taixu/setting',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredAnySaasModuleCodes: TAIXU_SHARED_SAAS_MODULE_CODES,
  },
```

- [ ] **Step 4: Pass any-feature requirements into access service**

After the existing exact requirement assignment, add:

```ts
    if (binding.requiredAnySaasModuleCodes?.length) {
      accessOptions.requiredAnySaasModuleCodes = binding.requiredAnySaasModuleCodes;
    }
```

- [ ] **Step 5: Run guard tests and confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: PASS.

---

## Task 5: Review, Verify, And Commit P8

**Files:**
- Review: `server/src/module/system-module/services/system-module-access.service.ts`
- Review: `server/src/module/system-module/services/system-module-access.service.spec.ts`
- Review: `server/src/module/system-module/system-module.guard.ts`
- Review: `server/src/module/system-module/system-module.guard.spec.ts`
- Review: `docs/superpowers/plans/2026-07-06-taixu-shared-route-any-feature-gates-p8.md`

- [ ] **Step 1: Run focused access regression tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module.guard.spec.ts src/module/system-module/services/system-module-access.service.spec.ts src/module/saas/services/saas-module.service.spec.ts src/module/ai/services/chat.service.spec.ts --runInBand
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

Ask review workers to check:

- `requiredAnySaasModuleCodes` preserves existing exact `requiredSaasModuleCode` behavior.
- Explicit tenant module grants do not bypass any-feature requirements.
- Shared Taixu routes require either `ai_chat` or `rag`.
- Home/user/public routes stay broad or public as intended.
- Route segment-boundary behavior is not weakened.
- No unrelated files are staged.

- [ ] **Step 4: Commit P8**

Stage only:

```powershell
git add docs/superpowers/plans/2026-07-06-taixu-shared-route-any-feature-gates-p8.md server/src/module/system-module/services/system-module-access.service.ts server/src/module/system-module/services/system-module-access.service.spec.ts server/src/module/system-module/system-module.guard.ts server/src/module/system-module/system-module.guard.spec.ts
git diff --cached --name-only
git diff --cached --check
git commit -m "fix: gate shared taixu routes by saas features"
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
- Shared Taixu routes are covered by any-feature SaaS requirements.
- Exact single-feature routes from P7 remain exact.
- Explicit tenant module bypass is tested for any-feature requirements.
- Broad fallback remains for Taixu home/user workspace routes.

Placeholder scan:
- No TODO/TBD placeholders.
- Every implementation step includes concrete code and exact commands.

Risk controls:
- New access option is additive.
- Exact requirement and any-feature requirement can coexist and are both enforced.
- No database or frontend changes are included.
