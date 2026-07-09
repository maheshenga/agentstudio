# P1 App Entitlement Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make marketplace apps respect SaaS plan modules, system-module access, and tenant-facing availability states before install or open.

**Architecture:** Keep `app_package` as the marketplace/runtime record and reuse existing entitlement services instead of creating a parallel authorization layer. `AppTenantService` will call `SaasModuleService.assertTenantModuleEnabled()` for `saas_module_code` and `SystemModuleAccessService.diagnoseModuleAccess()` / `assertModuleAccess()` for `system_module_code`; the frontend will expose selectable bindings and render availability reasons returned by the tenant API.

**Tech Stack:** NestJS 11, TypeORM repositories, Jest, Vue 3, Element Plus, existing request wrapper, existing SaaS/system module APIs.

## Global Constraints

- P1 must not execute uploaded backend code.
- Static apps stay sandboxed and must not add `allow-same-origin`.
- Tenant id must come from auth context, not request body.
- Existing SaaS module, system-module, and route-permission behavior must remain compatible.
- No invoice functionality.
- Use `pnpm.cmd` commands in PowerShell.
- Keep existing app marketplace P0 APIs stable unless adding optional response fields.

---

## File Structure

Backend modify:

- `server/src/module/app/app.module.ts`: import `SaasModule` and `SystemModuleRegistryModule` so app services can use existing entitlement services.
- `server/src/module/app/services/app-tenant.service.ts`: enrich marketplace availability and enforce SaaS/system-module access during install/open.
- `server/src/module/app/services/app-tenant.service.spec.ts`: prove hidden, unavailable, install-blocked, and open-blocked states.

Frontend modify:

- `web/src/api/app-marketplace.ts`: add availability fields to tenant app records.
- `web/src/views/app-platform/apps/index.vue`: replace free-text binding fields with module selectors sourced from existing APIs.
- `web/src/views/app-center/marketplace/index.vue`: show app availability, disable install/open when unavailable, and show a clear reason.
- `web/src/views/app-center/installed/index.vue`: show app availability for installed apps and disable open when unavailable.
- `web/scripts/verify-app-marketplace-readiness.ts`: assert P1 bridge UI and sandbox invariants.

Docs modify:

- `docs/saas-launch-readiness-checklist.md`: add P1 manual checks for bound apps.

---

### Task 1: Backend entitlement diagnostics

**Files:**

- Modify: `server/src/module/app/app.module.ts`
- Modify: `server/src/module/app/services/app-tenant.service.ts`
- Test: `server/src/module/app/services/app-tenant.service.spec.ts`

**Interfaces:**

- Consumes: `SaasModuleService.assertTenantModuleEnabled(tenantId: number, moduleCode: string): Promise<boolean>`
- Consumes: `SystemModuleAccessService.diagnoseModuleAccess(options): Promise<SystemModuleAccessDiagnosis>`
- Consumes: `SystemModuleAccessService.assertModuleAccess(options): Promise<boolean>`
- Produces: `AppTenantService.getAppAvailability(tenantId: number, app: AppPackageEntity): Promise<AppAvailability>`
- Adds response fields to marketplace and installed app records:
  - `available: boolean`
  - `availability_status: 'available' | 'missing_plan_module' | 'missing_system_module' | 'system_module_unavailable'`
  - `availability_reason: string`
  - `required_saas_module_code: string`
  - `required_system_module_code: string`

- [ ] **Step 1: Write failing tests**

Add tests to `app-tenant.service.spec.ts`:

```ts
it('marks marketplace apps unavailable when the SaaS plan does not include the required module', async () => {
  appRepo.find.mockResolvedValue([
    {
      id: 7,
      code: 'job_board',
      name: 'Job Board',
      type: 'iframe',
      status: 'published',
      visibility: 'marketplace',
      entryMode: 'iframe',
      entryUrl: 'https://jobs.example.com',
      saasModuleCode: 'recruiting',
    },
  ]);
  installRepo.find.mockResolvedValue([]);
  saasModuleService.assertTenantModuleEnabled.mockRejectedValue(new BadRequestException('Current plan has not enabled this module'));

  await expect(service.listMarketplace(23)).resolves.toEqual([
    expect.objectContaining({
      code: 'job_board',
      available: false,
      availability_status: 'missing_plan_module',
      availability_reason: 'Current plan has not enabled this module',
      required_saas_module_code: 'recruiting',
    }),
  ]);
});

it('marks marketplace apps unavailable when the mapped system module is not enabled for the tenant', async () => {
  appRepo.find.mockResolvedValue([
    {
      id: 8,
      code: 'crm_portal',
      name: 'CRM Portal',
      type: 'iframe',
      status: 'published',
      visibility: 'marketplace',
      entryMode: 'iframe',
      entryUrl: 'https://crm.example.com',
      systemModuleCode: 'crm',
    },
  ]);
  installRepo.find.mockResolvedValue([]);
  systemModuleAccessService.diagnoseModuleAccess.mockResolvedValue({
    allowed: false,
    status: 'missing_tenant_module',
    reason: 'Tenant has not enabled this module',
    module_code: 'crm',
    module_name: 'CRM',
    required_saas_module_codes: [],
    missing_saas_module_codes: [],
    tenant_saas_module_codes: [],
    tenant_enabled: false,
    tenant_entitlement_source: null,
    suggestions: [],
  });

  await expect(service.listMarketplace(23)).resolves.toEqual([
    expect.objectContaining({
      code: 'crm_portal',
      available: false,
      availability_status: 'missing_system_module',
      availability_reason: 'Tenant has not enabled this module',
      required_system_module_code: 'crm',
    }),
  ]);
});
```

Update the testing module providers:

```ts
const saasModuleService = {
  assertTenantModuleEnabled: jest.fn(),
};
const systemModuleAccessService = {
  diagnoseModuleAccess: jest.fn(),
  assertModuleAccess: jest.fn(),
};
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-tenant.service.spec.ts
```

Expected: fail because `AppTenantService` does not inject the entitlement services and does not return availability fields.

- [ ] **Step 3: Implement backend diagnostics**

Update `AppMarketplaceModule` imports:

```ts
imports: [
  SaasModule,
  SystemModuleRegistryModule,
  TypeOrmModule.forFeature([...]),
],
```

Update `AppTenantService` constructor:

```ts
private readonly saasModuleService: SaasModuleService,
private readonly systemModuleAccessService: SystemModuleAccessService,
```

Add:

```ts
export type AppAvailabilityStatus =
  | 'available'
  | 'missing_plan_module'
  | 'missing_system_module'
  | 'system_module_unavailable';

export interface AppAvailability {
  available: boolean;
  availability_status: AppAvailabilityStatus;
  availability_reason: string;
  required_saas_module_code: string;
  required_system_module_code: string;
}
```

Add `getAppAvailability()` with this behavior:

- no bound modules: return `available`.
- `saasModuleCode`: call `assertTenantModuleEnabled`; convert thrown message to `missing_plan_module`.
- `systemModuleCode`: call `diagnoseModuleAccess({ tenantId, moduleCode: app.systemModuleCode, requiredSaasModuleCode: app.saasModuleCode || undefined })`.
- diagnosis `allowed: false` with `status === 'missing_tenant_module'`: return `missing_system_module`.
- diagnosis `allowed: false` with any other status: return `system_module_unavailable`.
- both checks must pass to return available.

Merge availability fields into `listMarketplace()` and installed `app` metadata.

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-tenant.service.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app/app.module.ts server/src/module/app/services/app-tenant.service.ts server/src/module/app/services/app-tenant.service.spec.ts
git commit -m "feat: add app entitlement diagnostics"
```

### Task 2: Backend install/open enforcement

**Files:**

- Modify: `server/src/module/app/services/app-tenant.service.ts`
- Test: `server/src/module/app/services/app-tenant.service.spec.ts`

**Interfaces:**

- Consumes: `getAppAvailability()`
- Produces: install/open rejection before creating install rows or open logs.

- [ ] **Step 1: Write failing tests**

Add tests:

```ts
it('rejects installing a published app when the current plan lacks the required SaaS module', async () => {
  appRepo.findOne.mockResolvedValue({
    id: 7,
    code: 'job_board',
    type: 'iframe',
    status: 'published',
    visibility: 'marketplace',
    entryMode: 'iframe',
    entryUrl: 'https://jobs.example.com',
    saasModuleCode: 'recruiting',
  });
  saasModuleService.assertTenantModuleEnabled.mockRejectedValue(new BadRequestException('Current plan has not enabled this module'));

  await expect(service.installApp(23, 'job_board', 7)).rejects.toThrow('Current plan has not enabled this module');
  expect(installRepo.save).not.toHaveBeenCalled();
});

it('rejects opening an installed app when the mapped system module is unavailable', async () => {
  appRepo.findOne.mockResolvedValue({
    id: 8,
    code: 'crm_portal',
    name: 'CRM Portal',
    type: 'iframe',
    status: 'published',
    visibility: 'marketplace',
    entryMode: 'iframe',
    entryUrl: 'https://crm.example.com',
    systemModuleCode: 'crm',
  });
  installRepo.findOne.mockResolvedValue({ id: 6, tenantId: 23, appId: 8, enabled: 1 });
  systemModuleAccessService.diagnoseModuleAccess.mockResolvedValue({
    allowed: false,
    status: 'missing_tenant_module',
    reason: 'Tenant has not enabled this module',
    module_code: 'crm',
    module_name: 'CRM',
    required_saas_module_codes: [],
    missing_saas_module_codes: [],
    tenant_saas_module_codes: [],
    tenant_enabled: false,
    tenant_entitlement_source: null,
    suggestions: [],
  });

  await expect(service.getOpenMetadata(23, 'crm_portal', 7)).rejects.toThrow('Tenant has not enabled this module');
  expect(openLogRepo.save).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-tenant.service.spec.ts
```

Expected: fail because install/open do not enforce bound modules.

- [ ] **Step 3: Implement enforcement**

Add:

```ts
private assertAvailability(availability: AppAvailability) {
  if (!availability.available) {
    throw new BadRequestException(availability.availability_reason || 'App is not available for this tenant');
  }
}
```

Call it in:

- `installApp()` immediately after `findPublishedApp(code)` and before version lookup / install save.
- `getOpenMetadata()` after install lookup and before version lookup / open log save.

- [ ] **Step 4: Run test to verify GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-tenant.service.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/app/services/app-tenant.service.ts server/src/module/app/services/app-tenant.service.spec.ts
git commit -m "feat: enforce app entitlement access"
```

### Task 3: Platform binding selectors

**Files:**

- Modify: `web/src/views/app-platform/apps/index.vue`
- Modify: `web/scripts/verify-app-marketplace-readiness.ts`

**Interfaces:**

- Consumes: `fetchPlatformModules({ status: 1 })` from `web/src/api/saas.ts`
- Consumes: `fetchSystemModules({ status: 'enabled' })` from `web/src/api/system-module.ts`
- Produces: two selector lists for `saas_module_code` and `system_module_code`.

- [ ] **Step 1: Write failing readiness assertions**

Update `verify-app-marketplace-readiness.ts` to require these tokens in `app-platform/apps/index.vue`:

```ts
'fetchPlatformModules',
'fetchSystemModules',
'saasModuleOptions',
'systemModuleOptions',
'ElOption'
```

- [ ] **Step 2: Run readiness to verify RED**

Run:

```powershell
cd web
pnpm.cmd run verify:app-marketplace-readiness
```

Expected: fail because the platform page currently uses free-text inputs.

- [ ] **Step 3: Implement selectors**

In `app-platform/apps/index.vue`:

- import `fetchPlatformModules` from `@/api/saas`.
- import `fetchSystemModules` from `@/api/system-module`.
- define:

```ts
const saasModuleOptions = ref<SaasModuleRecord[]>([])
const systemModuleOptions = ref<SystemModuleRecord[]>([])
```

- add `loadModuleOptions()` that calls both APIs, stores arrays, and keeps empty arrays on failure.
- call `loadModuleOptions()` from `onMounted()`.
- replace the two binding `<ElInput>` controls with clearable `<ElSelect filterable>` controls using `<ElOption :label="\`\${item.name} (\${item.code})\`" :value="item.code" />`.

- [ ] **Step 4: Run readiness and build**

Run:

```powershell
cd web
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run build
```

Expected: both pass.

- [ ] **Step 5: Commit**

```powershell
git add web/src/views/app-platform/apps/index.vue web/scripts/verify-app-marketplace-readiness.ts
git commit -m "feat: add app module binding selectors"
```

### Task 4: Tenant availability UI

**Files:**

- Modify: `web/src/api/app-marketplace.ts`
- Modify: `web/src/views/app-center/marketplace/index.vue`
- Modify: `web/src/views/app-center/installed/index.vue`
- Modify: `web/scripts/verify-app-marketplace-readiness.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**

- Consumes tenant app fields from Task 1.
- Produces disabled install/open controls when `available === false`.

- [ ] **Step 1: Write failing readiness assertions**

Update `verify-app-marketplace-readiness.ts` to require:

```ts
'available',
'availability_status',
'availability_reason',
'required_saas_module_code',
'required_system_module_code'
```

Require marketplace page tokens:

```ts
'availability_reason',
':disabled="!row.available"',
'Upgrade'
```

Require installed page tokens:

```ts
'availability_reason',
':disabled="row.app?.available === false"'
```

- [ ] **Step 2: Run readiness to verify RED**

Run:

```powershell
cd web
pnpm.cmd run verify:app-marketplace-readiness
```

Expected: fail because tenant pages do not expose unavailable states.

- [ ] **Step 3: Update API types**

Add optional fields to `AppPackageRecord`:

```ts
available?: boolean
availability_status?: 'available' | 'missing_plan_module' | 'missing_system_module' | 'system_module_unavailable'
availability_reason?: string
required_saas_module_code?: string
required_system_module_code?: string
```

- [ ] **Step 4: Update tenant marketplace page**

In `marketplace/index.vue`:

- add an availability column or tag beside status.
- disable install/open when `row.available === false`.
- show `row.availability_reason` in a tooltip or helper text.
- show an `Upgrade` button for `row.availability_status === 'missing_plan_module'` that routes to `/tenant-saas/plan`.

- [ ] **Step 5: Update tenant installed page**

In `installed/index.vue`:

- show unavailable reason when `row.app?.available === false`.
- disable open when unavailable.
- keep uninstall available.

- [ ] **Step 6: Update checklist**

Add manual checks:

```md
7. Confirm an app bound to a missing SaaS module shows Requires upgrade and cannot be installed.
8. Confirm an installed app bound to a disabled system module cannot be opened and shows Tenant has not enabled this module.
```

- [ ] **Step 7: Run frontend verification**

Run:

```powershell
cd web
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run build
```

Expected: both pass.

- [ ] **Step 8: Commit**

```powershell
git add web/src/api/app-marketplace.ts web/src/views/app-center/marketplace/index.vue web/src/views/app-center/installed/index.vue web/scripts/verify-app-marketplace-readiness.ts docs/saas-launch-readiness-checklist.md
git commit -m "feat: show tenant app availability"
```

### Task 5: Final P1 review

**Files:**

- All files changed by Tasks 1-4.

**Interfaces:**

- Verifies P1 scope against `docs/superpowers/specs/2026-07-09-app-module-platform-design.md`.

- [ ] **Step 1: Run targeted backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-tenant.service.spec.ts app-platform.service.spec.ts system-module-access.service.spec.ts saas-module.service.spec.ts
```

Expected: pass.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 3: Run frontend build and readiness**

Run:

```powershell
cd web
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd run build
```

Expected: pass.

- [ ] **Step 4: Review diff and whitespace**

Run:

```powershell
git diff --check HEAD
git status --short --branch
git log --oneline -8
```

Expected: no whitespace errors; only intentional commits are present.

- [ ] **Step 5: Commit review updates if needed**

```powershell
git add .
git commit -m "chore: review app entitlement bridge"
```

Use this only if the review found and fixed issues after earlier task commits.

## Self-Review

- Spec coverage: Task 1 and Task 2 cover P1 backend SaaS/system-module gating and open/install enforcement. Task 3 covers platform binding UX. Task 4 covers tenant availability UX. Task 5 covers verification and review.
- Placeholder scan: This plan contains no open placeholder markers or deferred implementation notes.
- Type consistency: `available`, `availability_status`, `availability_reason`, `required_saas_module_code`, and `required_system_module_code` are consistent across backend and frontend tasks.
