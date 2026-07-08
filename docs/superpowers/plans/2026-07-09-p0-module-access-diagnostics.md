# P0 Module Access Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make tenant/module entitlement failures understandable for administrators and tenant owners without weakening RBAC or SaaS module gates.

**Architecture:** Add a read-only diagnosis path beside the existing `SystemModuleAccessService.assertModuleAccess()` gate. The guard policy stays unchanged; the new service method returns a structured explanation for UI and support diagnostics. The tenant module page consumes this diagnosis and shows clear Chinese guidance when a module is unavailable.

**Tech Stack:** NestJS, TypeORM repositories, Jest, Vue 3 `<script setup>`, Element Plus, Vite readiness scripts.

## Global Constraints

- Do not bypass `SystemModuleGuard` entitlement checks.
- Keep existing error messages from `assertModuleAccess()` compatible: `Current plan has not enabled this module`, `Tenant has not enabled this module`, `Missing module permission`.
- Tenant-facing diagnosis must require tenant context and `tenant:module:list`.
- Do not add a new dependency.
- Keep UI copy in readable Chinese.

---

### Task 1: Backend Diagnosis Service

**Files:**
- Modify: `server/src/module/system-module/services/system-module-access.service.ts`
- Test: `server/src/module/system-module/services/system-module-access.service.spec.ts`

**Interfaces:**
- Consumes: existing `AssertModuleAccessOptions`.
- Produces:
  - `ModuleAccessDiagnosisStatus = 'available' | 'module_not_found' | 'module_disabled' | 'dependency_missing' | 'missing_plan_module' | 'missing_tenant_module' | 'permission_missing'`
  - `SystemModuleAccessDiagnosis`
  - `SystemModuleAccessService.diagnoseModuleAccess(options: AssertModuleAccessOptions): Promise<SystemModuleAccessDiagnosis>`

- [ ] **Step 1: Write failing service tests**

Add tests that call `diagnoseModuleAccess()` directly:

```ts
it('diagnoses missing required SaaS plan module without throwing', async () => {
  const { service } = createService({
    modules: [enabledModule('ai_console')],
    saasModuleCodes: ['rag'],
  });

  await expect(
    service.diagnoseModuleAccess({
      tenantId: 10,
      moduleCode: 'ai_console',
      requiredSaasModuleCode: 'ai_chat',
    }),
  ).resolves.toEqual(
    expect.objectContaining({
      allowed: false,
      status: 'missing_plan_module',
      reason: '当前套餐未包含所需 SaaS 模块',
      required_saas_module_codes: ['ai_chat'],
      missing_saas_module_codes: ['ai_chat'],
      tenant_saas_module_codes: ['rag'],
    }),
  );
});

it('diagnoses missing tenant system-module entitlement without throwing', async () => {
  const { service } = createService({
    modules: [enabledModule('taixu_workspace')],
    saasModuleCodes: ['member_management'],
  });

  await expect(
    service.diagnoseModuleAccess({
      tenantId: 10,
      moduleCode: 'taixu_workspace',
    }),
  ).resolves.toEqual(
    expect.objectContaining({
      allowed: false,
      status: 'missing_tenant_module',
      reason: '当前租户未启用该系统模块',
      tenant_enabled: false,
      tenant_entitlement_source: null,
    }),
  );
});

it('diagnoses explicit tenant entitlement as available', async () => {
  const { service } = createService({
    modules: [enabledModule('ai_console')],
    tenantModules: [{ tenantId: 10, moduleCode: 'ai_console', enabled: 1, source: 'platform' }],
  });

  await expect(
    service.diagnoseModuleAccess({
      tenantId: 10,
      moduleCode: 'ai_console',
    }),
  ).resolves.toEqual(
    expect.objectContaining({
      allowed: true,
      status: 'available',
      reason: '模块已开通',
      tenant_enabled: true,
      tenant_entitlement_source: 'platform',
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- system-module-access.service.spec.ts --runInBand`

Expected: FAIL because `diagnoseModuleAccess` does not exist.

- [ ] **Step 3: Implement diagnosis**

Add exported diagnosis types, then implement `diagnoseModuleAccess()` in `SystemModuleAccessService`. The method should:

```ts
const module = await this.moduleRepo.findOne({ where: { code: options.moduleCode, deleteTime: IsNull() } });
if (!module) return this.createDiagnosis(options, { status: 'module_not_found', allowed: false, reason: `系统模块 ${options.moduleCode} 不存在` });
if (module.status !== 'enabled') return this.createDiagnosis(options, { status: 'module_disabled', allowed: false, reason: '系统模块未启用' });
```

Then check dependencies, required SaaS feature codes, tenant entitlement, and optional permission. Reuse `loadTenantSaasModuleCodes()` and `resolveSystemModuleCodesFromSaasModules()` so diagnosis matches existing guard behavior.

- [ ] **Step 4: Keep assert behavior compatible**

Update `assertModuleAccess()` to call `diagnoseModuleAccess()` and translate diagnosis statuses into existing exceptions:

```ts
if (diagnosis.allowed) return true;
if (diagnosis.status === 'module_not_found') throw new NotFoundException(`Module ${options.moduleCode} not found`);
if (diagnosis.status === 'module_disabled') throw new BadRequestException('Module is disabled');
if (diagnosis.status === 'dependency_missing') throw new BadRequestException('Module dependency is not satisfied');
if (diagnosis.status === 'missing_plan_module') throw new BadRequestException('Current plan has not enabled this module');
if (diagnosis.status === 'missing_tenant_module') throw new BadRequestException('Tenant has not enabled this module');
if (diagnosis.status === 'permission_missing') throw new ForbiddenException('Missing module permission');
```

- [ ] **Step 5: Run service tests**

Run: `npm.cmd test -- system-module-access.service.spec.ts --runInBand`

Expected: PASS.

### Task 2: Tenant Diagnosis API

**Files:**
- Modify: `server/src/module/system-module/system-module-tenant.controller.ts`
- Test: `server/src/module/system-module/system-module-tenant.controller.spec.ts`

**Interfaces:**
- Consumes: `SystemModuleAccessService.diagnoseModuleAccess({ tenantId, moduleCode })`.
- Produces: `GET /api/tenant/modules/:code/access-diagnosis`.

- [ ] **Step 1: Write failing controller test**

Add a test:

```ts
it('returns module access diagnosis for current tenant', async () => {
  const diagnosis = { module_code: 'ai_console', allowed: false, status: 'missing_tenant_module' };
  mockedGetTenantId.mockReturnValue(23);
  access.diagnoseModuleAccess.mockResolvedValue(diagnosis);

  const result = await controller.diagnoseModule('ai_console');

  expect(access.diagnoseModuleAccess).toHaveBeenCalledWith({ tenantId: 23, moduleCode: 'ai_console' });
  expect(result.data).toEqual(diagnosis);
});
```

Also verify no service call occurs without tenant context.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- system-module-tenant.controller.spec.ts --runInBand`

Expected: FAIL because controller has no injected access service and no `diagnoseModule()` method.

- [ ] **Step 3: Implement endpoint**

Inject `SystemModuleAccessService` into `SystemModuleTenantController` and add:

```ts
@Get(':code/access-diagnosis')
@RequirePermission('tenant:module:list')
@ApiOperation({ summary: 'Diagnose current tenant system module access' })
async diagnoseModule(@Param('code') code: string) {
  const tenantId = getTenantId();
  if (!tenantId) return ResultData.fail(401, 'Tenant context is required');
  return ResultData.ok(await this.access.diagnoseModuleAccess({ tenantId, moduleCode: code }));
}
```

- [ ] **Step 4: Run controller tests**

Run: `npm.cmd test -- system-module-tenant.controller.spec.ts --runInBand`

Expected: PASS.

### Task 3: Frontend Diagnosis UX

**Files:**
- Modify: `web/src/api/system-module.ts`
- Modify: `web/src/views/saas/tenant/modules/index.vue`
- Test: `web/scripts/verify-saas-tenant-ui-state-readiness.ts`

**Interfaces:**
- Produces API client: `fetchTenantSystemModuleAccessDiagnosis(code: string)`.
- Produces UI states: disabled module rows show Chinese reason and a `查看原因` action.

- [ ] **Step 1: Write failing readiness assertions**

In `verify-saas-tenant-ui-state-readiness.ts`, assert:

```ts
assertIncludes(systemModuleApi, 'export interface SystemModuleAccessDiagnosis', 'tenant module diagnosis api')
assertIncludes(systemModuleApi, 'fetchTenantSystemModuleAccessDiagnosis', 'tenant module diagnosis api')
assertIncludes(tenantModulesPage, 'diagnosisByCode', 'tenant modules diagnosis state')
assertIncludes(tenantModulesPage, '查看原因', 'tenant modules diagnosis action')
assertIncludes(tenantModulesPage, '当前租户未启用该系统模块', 'tenant modules diagnosis copy')
assertIncludes(tenantModulesPage, "loadError.value = '租户模块加载失败，请稍后重试'", 'tenant modules Chinese error copy')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec tsx scripts/verify-saas-tenant-ui-state-readiness.ts`

Expected: FAIL because API and UI diagnosis tokens are missing.

- [ ] **Step 3: Implement API client**

Add:

```ts
export interface SystemModuleAccessDiagnosis {
  module_code: string
  module_name?: string
  allowed: boolean
  status: string
  reason: string
  required_saas_module_codes: string[]
  missing_saas_module_codes: string[]
  tenant_saas_module_codes: string[]
  tenant_enabled: boolean
  tenant_entitlement_source?: string | null
  suggestions: string[]
}

export function fetchTenantSystemModuleAccessDiagnosis(code: string) {
  return request.get<SystemModuleAccessDiagnosis>({ url: `/api/tenant/modules/${code}/access-diagnosis` })
}
```

- [ ] **Step 4: Implement tenant module page UX**

Update the page to:
- use Chinese error copy: `租户模块加载失败，请稍后重试`
- add `diagnosisByCode = reactive<Record<string, SystemModuleAccessDiagnosis>>({})`
- add `loadDiagnosis(row)` that calls `fetchTenantSystemModuleAccessDiagnosis(row.code)`
- show a compact reason for disabled rows and a `查看原因` button.

- [ ] **Step 5: Run frontend readiness**

Run: `pnpm.cmd exec tsx scripts/verify-saas-tenant-ui-state-readiness.ts`

Expected: PASS.

### Task 4: Final Verification and Commit

**Files:**
- Review all changed files.

- [ ] **Step 1: Run backend targeted tests**

Run:

```powershell
npm.cmd test -- system-module-access.service.spec.ts system-module-tenant.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run SaaS readiness**

Run:

```powershell
npm.cmd run verify:saas-readiness
pnpm.cmd run verify:saas-readiness
```

Expected: both PASS.

- [ ] **Step 3: Review diff**

Run:

```powershell
git diff -- server/src/module/system-module web/src docs/superpowers/plans/2026-07-09-p0-module-access-diagnostics.md
git status --short
```

Expected: only planned files changed.

- [ ] **Step 4: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-09-p0-module-access-diagnostics.md server/src/module/system-module web/src/api/system-module.ts web/src/views/saas/tenant/modules/index.vue web/scripts/verify-saas-tenant-ui-state-readiness.ts
git commit -m "feat: add tenant module access diagnostics"
```

Expected: commit succeeds.
