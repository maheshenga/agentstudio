# SaaS Module Market Design

Date: 2026-07-04

## Goal

Add a SaaS module market foundation so the platform can define product modules, attach modules to plans, and enforce tenant access by active subscription.

This is the first practical slice of the selected "complete module market" direction. It builds the catalog and entitlement core. It does not add separate module purchases yet.

## Current Context

The project already has:

- SaaS plans, subscriptions, orders, payments, resource packs, usage quotas, and tenant members.
- `saas_plan_feature`, which stores `plan_id`, `feature_key`, and `enabled`.
- Dynamic backend-driven menus and permissions.
- Tenant and platform SaaS pages under `web/src/views/saas`.

The missing piece is that modules are not first-class. `saas_plan_feature` exists, but nothing lets platform admins manage module definitions, attach them to plans in the UI, or enforce enabled modules at tenant business entry points.

## Scope

### In Scope

1. Platform module catalog:
   - List modules.
   - Create or update module metadata.
   - Enable or disable modules.
   - Fields: code, name, description, category, icon, route path, status, sort.

2. Plan module authorization:
   - Configure enabled modules for each SaaS plan.
   - Reuse `saas_plan_feature` as the plan-to-module mapping.
   - Existing quota configuration remains separate.

3. Tenant module entitlement:
   - Resolve enabled module codes from the tenant's active subscription plan.
   - Expose a tenant endpoint returning enabled modules.

4. Backend enforcement:
   - Add a small module-access service.
   - Check module access at selected SaaS entry points:
     - tenant member management: `member_management`
     - resource pack purchase: `resource_pack`
     - AI chat quota-gated usage: `ai_chat`

5. Frontend visibility:
   - Platform page for module catalog.
   - Plan page can configure modules.
   - Tenant UI hides or disables module links when the module is not enabled.

### Out Of Scope

- Separate module purchases.
- Per-module orders or payments.
- Per-module expiry independent from plan subscription.
- Module revenue reports.
- Plugin installation or uploaded modules.
- Marketplace landing page.
- Invoice support.

## Module Model

Add one module definition table:

```text
saas_module
```

Columns:

- `id`
- `code`: unique module code, e.g. `ai_chat`
- `name`
- `description`
- `category`
- `icon`
- `route_path`
- `status`: `1` enabled, `0` disabled
- `sort`
- `remark`
- `create_time`
- `update_time`
- `delete_time`

Use existing `saas_plan_feature` for plan authorization:

- `plan_id`
- `feature_key`: same value as `saas_module.code`
- `enabled`

No tenant-module table is needed in this slice. Tenant entitlement is derived from the active subscription plan.

## Default Modules

Seed these initial modules:

| Code | Name | Category | Route |
| --- | --- | --- | --- |
| `ai_chat` | AI Chat | AI | `/dashboard/taixu` |
| `rag` | Knowledge Base | AI | `/dashboard/taixu` |
| `member_management` | Member Management | Tenant | `/tenant-saas/members` |
| `resource_pack` | Resource Pack | Billing | `/tenant-saas/resource-pack` |
| `advanced_report` | Advanced Report | Report | `/saas-platform/revenue` |

The route is metadata for display and UI linking. It is not a replacement for existing router/menu permission checks.

## Backend Design

Create:

```text
server/src/module/saas/entities/saas-module.entity.ts
server/src/module/saas/services/saas-module.service.ts
server/src/module/saas/dto/save-saas-module.dto.ts
server/src/migrations/1760000000016-CreateSaasModules.ts
server/src/migrations/1760000000017-SeedSaasModules.ts
```

Add platform routes:

```text
GET /api/saas/platform/modules
POST /api/saas/platform/modules
PUT /api/saas/platform/modules/:code
PUT /api/saas/platform/modules/:code/status
PUT /api/saas/platform/plans/:code/modules
```

Add tenant route:

```text
GET /api/saas/tenant/modules
```

Service methods:

```ts
listPlatformModules(query)
savePlatformModule(dto)
updatePlatformModule(code, dto)
updatePlatformModuleStatus(code, status)
updatePlanModules(planCode, moduleCodes)
listTenantModules(tenantId)
assertTenantModuleEnabled(tenantId, moduleCode)
```

Rules:

- Disabled modules are not returned as tenant-enabled modules.
- A disabled plan module mapping does not grant access.
- If the tenant has no active subscription, module access fails.
- `free` plan modules are still valid and can grant basic access.

## Frontend Design

Create:

```text
web/src/views/saas/platform/module/index.vue
```

Add API wrappers in `web/src/api/saas.ts`:

```ts
fetchPlatformModules(params)
createPlatformModule(params)
updatePlatformModule(code, params)
updatePlatformModuleStatus(code, status)
updatePlatformPlanModules(planCode, moduleCodes)
fetchTenantModules()
```

Enhance:

```text
web/src/views/saas/platform/plan/index.vue
```

Add a "modules" dialog next to the existing quota dialog. It shows checkboxes for active modules and saves selected module codes for the plan.

Tenant-side visibility should be minimal:

- Fetch tenant module codes once after entering SaaS tenant pages.
- Hide member/resource-pack tenant entries when the module is disabled, where the current menu system allows it.
- Backend enforcement remains authoritative.

## Permissions And Menus

Add platform menu:

- code: `SaasModule`
- path: `module`
- component: `/saas/platform/module`

Add permissions:

- `saas:module:list`
- `saas:module:save`
- `saas:module:update`
- `saas:module:status`
- `saas:plan:module:update`

Tenant module query can use existing SaaS tenant auth. It does not need a separate visible menu permission.

## Enforcement Points

First slice enforcement:

- `member_management`: before listing or creating tenant members.
- `resource_pack`: before listing resource packs or creating resource-pack orders.
- `ai_chat`: before AI chat generation, alongside existing quota checks.

Do not enforce `advanced_report` yet because it is a platform-only report and should remain permission-driven until tenant-facing reports exist.

## Error Handling

When access is denied:

```text
Current plan has not enabled this module
```

Use normal business errors, not 500s.

For platform module operations:

- duplicate code returns bad request.
- unknown module returns not found.
- unknown plan returns not found.
- invalid module code format returns bad request.

## Testing

Backend tests:

- module list filters by status and keyword.
- create/update validates unique code.
- plan module update writes `saas_plan_feature`.
- tenant module list resolves active subscription modules.
- disabled module is not granted.
- member/resource-pack/AI enforcement rejects disabled modules.
- migrations create table and seed default modules idempotently.

Frontend checks:

- `pnpm exec vue-tsc --noEmit`
- platform module page loads.
- plan page opens module dialog and saves selected modules.
- tenant member/resource-pack entries respect disabled module state where wired.

## Acceptance Criteria

- Platform admins can maintain a module catalog.
- Platform admins can attach modules to SaaS plans.
- Tenants can query enabled modules from their current plan.
- Backend blocks disabled tenant modules for the first enforced entry points.
- Existing quota, order, payment, and subscription flows keep working.
- No separate module purchase flow is introduced in this slice.
