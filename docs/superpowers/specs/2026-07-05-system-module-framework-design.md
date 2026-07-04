# System Module Framework Design

Date: 2026-07-05

## Goal

Add a complete system module framework that organizes backend, frontend, permissions, menus, configuration, tenant availability, and future plugin installation under one module registry.

This is not a product modularization effort. Product packaging, SaaS plans, and the existing `saas_module` table should become consumers of this lower-level module framework instead of being the framework itself.

## Current Context

The project currently has several partially related concepts:

- NestJS feature modules under `server/src/module`, such as `system`, `saas`, `ai`, `taixu`, `article`, and `monitor`.
- Frontend view groups under `web/src/views`, such as `system`, `saas`, `ai`, `taixu`, `tool`, and `dashboard`.
- Dynamic menus and permission slugs in `sa_system_menu`.
- Tenant membership and tenant-scoped roles.
- SaaS plan feature mapping in `saas_plan_feature`.
- A SaaS module market foundation using `saas_module`, which defines product/package capabilities such as `ai_chat`, `rag`, `member_management`, and `resource_pack`.

The gap is that there is no authoritative module registry for the system itself. Modules are implied by folders, menus, permissions, services, migrations, and SaaS plan features, but those pieces are not connected through a single lifecycle model.

## Scope

### In Scope

1. Add a platform-level module registry for both built-in and plugin modules.
2. Track module metadata, version, status, lifecycle, dependencies, menus, permissions, routes, API endpoints, configuration schema, and tenant availability.
3. Support two module sources:
   - `built_in`: code shipped with the main application.
   - `plugin`: installed extension package, initially metadata-only with execution hooks reserved.
4. Provide platform admin APIs and pages to inspect modules, enable/disable them, configure them, and view health/install logs.
5. Provide tenant admin APIs and pages to view modules available to the current tenant and configure tenant-scoped module settings.
6. Keep ordinary users limited to modules that are both tenant-enabled and permitted by their role.
7. Preserve existing SaaS plan module behavior while designing a clean bridge from `saas_module` to the new module registry.

### Out Of Scope For The First Implementation Slice

- Uploading executable plugin packages.
- Running untrusted third-party code in-process.
- A public plugin marketplace.
- Billing for plugin purchases outside existing SaaS plan/order flows.
- Hot-loading backend controllers from uploaded code.
- Full module sandboxing.

## Terminology

| Term | Meaning |
| --- | --- |
| System module | A registered application capability with lifecycle, dependencies, menus, permissions, APIs, and configuration. |
| Built-in module | A system module implemented in the main codebase and released with normal deployments. |
| Plugin module | A system module installed from an external manifest/package. First slice stores metadata and lifecycle only. |
| Product module | A SaaS-commercial capability currently represented by `saas_module`; it can reference one or more system modules. |
| Module manifest | The declarative definition of a module: code, version, dependencies, menus, permissions, routes, APIs, config schema, and hooks. |
| Module entitlement | Whether a tenant can use a module. This can come from platform assignment, SaaS plan, or future plugin purchase. |

## Architecture

The framework should use three separate layers:

1. **Registry Layer**
   Stores module identity, source, version, lifecycle state, dependencies, and manifest metadata. This is the source of truth for what modules exist.

2. **Binding Layer**
   Connects modules to menus, permissions, API endpoints, routes, configuration schemas, health checks, and tenant availability. These bindings let the rest of the system query module capabilities consistently.

3. **Consumer Layer**
   Existing systems use the registry:
   - Menus decide whether a module entry should be visible.
   - Permission guards verify whether a user can access a module action.
   - SaaS plans map commercial packages to module entitlements.
   - Tenant admin pages show enabled/configurable modules.
   - Future plugin installers write module manifests into the registry.

`saas_module` should remain as the SaaS product capability table during migration. It should not become the system module registry. A later bridge can map `saas_module.code` to one or more `system_module.code` values.

## Module Lifecycle

Use explicit lifecycle states:

| State | Meaning |
| --- | --- |
| `draft` | Registered metadata exists but module is not installable/enabled yet. |
| `installed` | Module is installed and available for platform configuration. |
| `enabled` | Module is globally enabled. Tenant and role checks still apply. |
| `disabled` | Module exists but is globally unavailable. |
| `upgrading` | Module migration or manifest upgrade is in progress. |
| `failed` | Install/upgrade/health check failed. |
| `uninstalled` | Module was removed or retired; historical logs remain. |

Built-in modules normally move through:

```text
draft -> installed -> enabled -> disabled/enabled
```

Plugin modules later move through:

```text
draft -> installed -> enabled -> upgrading -> enabled/failed -> disabled -> uninstalled
```

## Module Sources

### Built-In Modules

Built-in modules are declared by code-owned manifests. Example candidates:

| Code | Name | Source | Existing Area |
| --- | --- | --- | --- |
| `core_system` | System Management | `built_in` | `server/src/module/system`, `web/src/views/system` |
| `saas_platform` | SaaS Platform | `built_in` | `server/src/module/saas`, `/saas-platform` |
| `tenant_saas` | Tenant SaaS Console | `built_in` | `/tenant-saas` |
| `ai_console` | AI Console | `built_in` | `server/src/module/ai`, `web/src/views/ai` |
| `taixu_workspace` | Taixu Workspace | `built_in` | `server/src/module/taixu`, `web/src/views/taixu` |
| `content_article` | Article Management | `built_in` | `server/src/module/article`, `web/src/views/article` |
| `ops_monitor` | Monitor And Jobs | `built_in` | `server/src/module/monitor`, `web/src/views/tool` |

### Plugin Modules

Plugin modules are represented by manifests first. The first implementation should support metadata, dependencies, configuration, and lifecycle state, but not execute uploaded code.

Future plugin manifests should be compatible with this shape:

```json
{
  "code": "example_plugin",
  "name": "Example Plugin",
  "source": "plugin",
  "version": "1.0.0",
  "description": "Adds an example feature",
  "dependencies": [{ "code": "core_system", "version": ">=1.0.0" }],
  "menus": [],
  "permissions": [],
  "routes": [],
  "api_endpoints": [],
  "config_schema": {},
  "hooks": {
    "install": "reserved",
    "upgrade": "reserved",
    "uninstall": "reserved",
    "health": "reserved"
  }
}
```

## Data Model

### `system_module`

Core registry table.

| Column | Meaning |
| --- | --- |
| `id` | Primary key |
| `code` | Unique stable module code |
| `name` | Display name |
| `source` | `built_in`, `plugin`, or `extension` |
| `version` | Semantic version string |
| `description` | Human readable description |
| `category` | Grouping, e.g. `core`, `saas`, `ai`, `ops`, `content` |
| `icon` | UI icon |
| `status` | Lifecycle state |
| `entry_route` | Preferred frontend entry route |
| `manifest` | JSON manifest snapshot |
| `config_schema` | JSON schema for platform/tenant config |
| `health_status` | `unknown`, `healthy`, `degraded`, `failed` |
| `sort` | Display order |
| `remark` | Admin note |
| `create_time`, `update_time`, `delete_time` | Standard timestamps |

### `system_module_dependency`

Tracks dependencies between modules.

| Column | Meaning |
| --- | --- |
| `id` | Primary key |
| `module_code` | Module requiring dependency |
| `depends_on_code` | Required module |
| `version_range` | Required version range |
| `required` | Required or optional dependency |

### `system_module_menu`

Maps module to menu entries.

| Column | Meaning |
| --- | --- |
| `id` | Primary key |
| `module_code` | Module code |
| `menu_id` | Existing `sa_system_menu.id` |
| `binding_type` | `owned`, `required`, or `optional` |

### `system_module_permission`

Maps module to permission slugs.

| Column | Meaning |
| --- | --- |
| `id` | Primary key |
| `module_code` | Module code |
| `permission_slug` | Permission slug from `sa_system_menu.slug` |
| `binding_type` | `owned`, `required`, or `optional` |

### `system_module_api`

Registers API endpoints owned or guarded by a module.

| Column | Meaning |
| --- | --- |
| `id` | Primary key |
| `module_code` | Module code |
| `method` | HTTP method |
| `path` | API path pattern |
| `permission_slug` | Optional permission required |
| `tenant_scoped` | Whether the endpoint requires tenant context |

### `system_tenant_module`

Tracks tenant-level module availability and configuration.

| Column | Meaning |
| --- | --- |
| `id` | Primary key |
| `tenant_id` | Tenant id |
| `module_code` | Module code |
| `enabled` | Tenant-level enable flag |
| `source` | `platform`, `plan`, `plugin`, or `manual` |
| `config` | Tenant-specific module config JSON |
| `start_time`, `end_time` | Optional availability window |

### `system_module_event`

Audit log for lifecycle changes.

| Column | Meaning |
| --- | --- |
| `id` | Primary key |
| `module_code` | Module code |
| `event_type` | `install`, `enable`, `disable`, `upgrade`, `health_check`, `config_update`, `uninstall` |
| `status` | `success` or `failed` |
| `message` | Human-readable event summary |
| `metadata` | JSON details |
| `operator_id` | Acting user id |

## Permission And Role Model

### Platform Admin

Can:

- Register built-in module manifests.
- Install plugin metadata.
- Enable or disable modules globally.
- Update platform-level module config.
- View module health and lifecycle logs.
- Bind modules to SaaS plans or tenant entitlements.

Suggested permissions:

```text
system:module:list
system:module:read
system:module:install
system:module:update
system:module:status
system:module:config
system:module:tenant
system:module:event
```

### Tenant Owner/Admin

Can:

- View modules available to the tenant.
- Enable or disable tenant-configurable modules when platform allows it.
- Update tenant-level module config.

Suggested permissions:

```text
tenant:module:list
tenant:module:config
tenant:module:status
```

### Ordinary User

Can:

- See and use modules that are globally enabled, tenant-enabled, and role-permitted.
- Cannot install, enable, disable, or configure modules.

## Entitlement Rules

A module is usable for a request only when all required gates pass:

1. Module exists in `system_module`.
2. Module status is `enabled`.
3. Dependencies are satisfied.
4. If the request is tenant-scoped, tenant entitlement exists in `system_tenant_module` or is derived from a SaaS plan bridge.
5. User role has the required permission slug.
6. Optional module health policy allows access.

This produces a single authorization shape:

```text
module exists -> global enabled -> tenant enabled -> user permitted -> request allowed
```

## Relationship To Existing SaaS Modules

The existing `saas_module` table should remain for SaaS product packaging during the transition. It answers:

```text
Which commercial capability is included in a plan?
```

The new `system_module` table answers:

```text
Which system capability exists, what does it own, and can it run?
```

Bridge strategy:

1. Keep `saas_module` and `saas_plan_feature` unchanged initially.
2. Add optional `system_module_code` or a bridge table such as `saas_module_system_binding`.
3. When a tenant has an active SaaS plan, derive `system_tenant_module` availability from plan features.
4. Over time, move backend checks from `assertTenantModuleEnabled(tenantId, saasModuleCode)` to a generic module access service:

```ts
assertModuleAccess({
  tenantId,
  userId,
  moduleCode,
  permission,
});
```

## Backend API Design

### Platform APIs

```text
GET    /api/system/modules
GET    /api/system/modules/:code
POST   /api/system/modules/register
PUT    /api/system/modules/:code
PUT    /api/system/modules/:code/status
PUT    /api/system/modules/:code/config
GET    /api/system/modules/:code/events
POST   /api/system/modules/:code/health-check
GET    /api/system/modules/:code/dependencies
PUT    /api/system/modules/:code/dependencies
GET    /api/system/modules/:code/bindings
PUT    /api/system/modules/:code/bindings
GET    /api/system/modules/tenants/:tenant_id
PUT    /api/system/modules/tenants/:tenant_id/:code
```

### Tenant APIs

```text
GET    /api/tenant/modules
GET    /api/tenant/modules/:code
PUT    /api/tenant/modules/:code/config
PUT    /api/tenant/modules/:code/status
```

Tenant APIs must always use tenant context from auth/session, not a body-provided tenant id.

## Frontend Design

### Platform Pages

Create a system module management area:

```text
/system/modules
/system/modules/:code
```

Views:

- Module list: code, name, source, version, category, status, health, tenant count, updated time.
- Module detail: metadata, manifest, dependencies, menus, permissions, APIs, config schema, lifecycle logs.
- Tenant assignment dialog: enable/disable module for selected tenants.
- Health panel: last check result and event log.

### Tenant Pages

Create:

```text
/tenant-saas/modules
```

Views:

- Available modules list.
- Tenant module config where schema allows tenant edits.
- Status badge showing enabled, unavailable, expired, or disabled by platform.

### Ordinary User Navigation

User navigation should only include module entries when:

- backend menu permission allows the route,
- module is globally enabled,
- tenant module entitlement allows it for tenant-scoped areas.

Backend remains authoritative. Frontend filtering is only for UX.

## Manifest Design

Built-in modules can be seeded from versioned manifests checked into the repo:

```text
server/src/module/system-module/manifests/*.module.json
```

Each manifest should include:

- identity: code, name, source, version, category, icon.
- frontend: entry route and owned routes.
- backend: API endpoints and tenant scope.
- security: permission slugs.
- menu bindings: menu codes or slugs.
- dependencies: required/optional module codes.
- config schema: platform and tenant schema.
- lifecycle hooks: reserved names for future plugin runner.

The manifest importer must be idempotent.

## Error Handling

Use business errors rather than generic 500s:

| Case | Error |
| --- | --- |
| Unknown module | `Module not found` |
| Disabled module | `Module is disabled` |
| Tenant not entitled | `Tenant has not enabled this module` |
| Missing dependency | `Module dependency is not satisfied` |
| Invalid config | `Module config is invalid` |
| Plugin install failure | `Module installation failed` |

## Security

First implementation must not execute uploaded plugin code. Plugin support is metadata-only until a sandbox/runtime design exists.

Security rules:

- Tenant id must come from session context.
- Platform APIs require platform permissions.
- Tenant APIs require tenant module permissions.
- Module config should validate against schema before saving.
- Plugin manifests should reject unknown dangerous hook values during the metadata-only phase.
- Module access should not rely on frontend route hiding.

## Migration Strategy

Phase 1 should not rewrite existing SaaS module market behavior. It adds the new registry and registers built-in modules.

Recommended migration phases:

1. Add `system_module` tables and seed built-in module manifests.
2. Add platform module registry APIs and read-only UI.
3. Add tenant module availability derived from existing SaaS plan features.
4. Add generic `SystemModuleAccessService`.
5. Replace selected hardcoded checks with `assertModuleAccess`.
6. Add tenant module config.
7. Add plugin metadata install flow.
8. Design executable plugin runtime separately.

## Testing Strategy

Backend tests:

- Manifest import is idempotent.
- Built-in modules are registered with expected metadata.
- Dependencies are resolved and missing dependencies fail access.
- Platform module status gates tenant access.
- Tenant entitlement gates tenant-scoped access.
- User permission still gates action access after module entitlement passes.
- Existing `saas_module` plan behavior remains compatible.
- Tenant id cannot be spoofed from body/query params.

Frontend checks:

- Platform module list renders registry data.
- Module detail shows bindings, dependencies, config, and events.
- Tenant module list only shows tenant-available modules.
- Disabled/unavailable modules show clear status.

Verification commands:

```text
cd server && pnpm.cmd exec jest --runInBand
cd server && pnpm.cmd run build
cd web && pnpm.cmd run build
```

## Acceptance Criteria

- A platform admin can view a complete registry of built-in system modules.
- Module metadata includes source, version, status, entry route, dependencies, menus, permissions, APIs, and config schema.
- A platform admin can globally enable or disable a module.
- A tenant admin can view modules available to the current tenant.
- Ordinary users only see/use modules that pass module, tenant, and permission gates.
- Existing SaaS plan module functionality continues to work.
- Plugin modules can be registered as metadata without executing uploaded code.
- The design cleanly separates system modules from SaaS product modules.

## Open Decisions For Implementation Planning

1. Whether to place the new backend under `server/src/module/system-module` or inside `server/src/module/system/module-framework`.
2. Whether built-in manifests should be JSON files or TypeScript constants.
3. Whether tenant module config should ship in phase 1 or phase 2.
4. Whether to add the `saas_module_system_binding` bridge in the first implementation slice or keep it as a planned migration step.

Recommended default:

- Backend package: `server/src/module/system-module`.
- Built-in manifests: TypeScript constants first, JSON manifest compatibility in DTO shape.
- Tenant config: phase 2.
- SaaS bridge: phase 1 read-only derivation from existing `saas_plan_feature`, explicit bridge table in phase 2.
