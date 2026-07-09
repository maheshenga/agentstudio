# App Module Platform Design

Date: 2026-07-09

## Goal

Build an extensible SaaS app platform that can host an app marketplace, app package review flow, and module factory on top of the existing SaaS and system-module foundations.

The platform should let platform admins and approved creators add new capabilities without changing the core product for every small feature. Apps can be AI tools, industry modules, lifestyle utilities, function plugins, simple HTML pages, iframe integrations, or complex business systems packaged behind a safe runtime boundary.

## Current Context

The project already has two related but different module layers:

- SaaS commercial modules: `saas_module`, `saas_plan_feature`, and subscription-derived tenant entitlements.
- System modules: `system_module`, `system_tenant_module`, `system_module_saas_bridge`, built-in manifests, platform module pages, tenant module pages, and `SystemModuleGuard`.

The current plugin support is metadata-oriented. `registerPluginManifest()` can register a plugin manifest into `system_module`, but it does not manage uploaded app packages, admin review, static publishing, app installation, or runtime opening.

The app platform adds a third layer:

```text
app package -> app version -> review -> publish -> install -> open
```

This layer consumes the existing system-module and SaaS-module layers instead of replacing them.

## Product Principles

1. Keep commercial packaging separate from runtime packaging.
   - `saas_module` answers what a plan includes.
   - `system_module` answers what the platform can run and guard.
   - `app_package` answers what users can discover, review, install, and open.

2. Ship a safe app container first.
   - P0 supports `static` and `iframe` apps only.
   - P0 must not execute uploaded backend code.
   - Executable service plugins require a later sandbox/container phase.

3. Let admins package platform functions as apps.
   - Built-in routes can be exposed as marketplace apps through `internal` app records.
   - Admins can decide whether an app is public, tenant-only, plan-gated, or hidden.

4. Let creators upload simple apps.
   - A user or developer uploads a zip with a manifest and static build output.
   - Admins review the upload before it can be opened by tenants.

## App Types

### `internal`

A wrapper around an existing platform route or system module.

Use cases:

- Package tenant member management as an app.
- Package Taixu workspace as an app.
- Package an admin-created page or tool as an app.

Runtime:

- Opens an existing frontend route.
- Access remains controlled by existing permissions and module guards.

### `static`

A static app package uploaded as a zip.

Package shape:

```text
app.zip
|- manifest.json
|- dist/
|  |- index.html
|  |- assets/
|- README.md
```

Runtime:

- Published to a server-managed static directory.
- Opened through a controlled app runner page or iframe.

### `iframe`

An app that opens an external URL in a controlled iframe.

Runtime:

- URL must pass platform allowlist validation.
- Admin can decide whether the iframe opens embedded or in a new tab.

### Later: `lowcode_crud`

A module factory output that creates data models, forms, lists, permissions, and tenant-scoped storage.

### Later: `service_plugin`

A backend-capable app running in a sandboxed container or separate service runtime.

P0 explicitly excludes direct execution of uploaded Node, PHP, Python, shell, or binary code.

## P0 Scope

P0 creates a usable marketplace foundation:

1. Platform admins can create iframe apps.
2. Platform admins can create internal route apps.
3. Users or admins can upload static app zip packages.
4. Static package upload validates a strict `manifest.json`.
5. Uploaded apps enter `pending_review`.
6. Platform admins can approve or reject versions.
7. Approved static app versions can be published to a server static directory.
8. Tenants can view available apps.
9. Tenants can install or uninstall approved apps.
10. Ordinary users can open installed apps through a controlled app runner.
11. Apps can optionally be linked to a `system_module` and `saas_module`.

P0 does not add app payments, revenue sharing, executable plugins, in-app API proxying, or marketplace public SEO pages.

## P0 Data Model

### `app_package`

Stores app identity and marketplace metadata.

Columns:

- `id`
- `code`: unique stable code, lowercase snake case.
- `name`
- `type`: `internal`, `static`, or `iframe`.
- `category`
- `icon`
- `summary`
- `description`
- `developer_id`
- `developer_name`
- `status`: `draft`, `pending_review`, `approved`, `published`, `rejected`, `disabled`, `archived`.
- `visibility`: `platform`, `tenant`, `marketplace`, or `private`.
- `entry_mode`: `internal_route`, `static`, `iframe`, or `new_window`.
- `entry_url`
- `system_module_code`
- `saas_module_code`
- `sort`
- `remark`
- standard timestamps.

### `app_package_version`

Stores reviewable and publishable versions.

Columns:

- `id`
- `app_id`
- `version`
- `manifest`
- `package_path`
- `publish_path`
- `entry_file`
- `file_hash`
- `file_size`
- `review_status`: `pending`, `approved`, `rejected`.
- `publish_status`: `unpublished`, `published`, `failed`, `unpublished_retired`.
- `review_message`
- `reviewer_id`
- `review_time`
- standard timestamps.

### `app_review_log`

Stores review events.

Columns:

- `id`
- `app_id`
- `version_id`
- `action`: `submit`, `approve`, `reject`, `publish`, `disable`, `archive`.
- `message`
- `operator_id`
- `metadata`
- `create_time`.

### `tenant_app_install`

Stores tenant-level installs.

Columns:

- `id`
- `tenant_id`
- `app_id`
- `version_id`
- `enabled`
- `source`: `marketplace`, `plan`, `platform`, or `manual`.
- `config`
- `installed_by`
- `installed_time`
- standard timestamps.

### `app_open_log`

Stores app launch audit events.

Columns:

- `id`
- `tenant_id`
- `user_id`
- `app_id`
- `version_id`
- `open_mode`
- `ip`
- `user_agent`
- `create_time`.

## Manifest

Static apps must include `manifest.json`:

```json
{
  "code": "job_board",
  "name": "Job Board",
  "version": "1.0.0",
  "type": "static",
  "entry": "dist/index.html",
  "category": "Industry",
  "summary": "Publish jobs and collect resumes",
  "description": "A lightweight recruitment module for tenant teams.",
  "icon": "ri:briefcase-line",
  "tenant_scoped": true,
  "permissions": ["job:view", "job:manage"]
}
```

Validation rules:

- `code` must match `^[a-z][a-z0-9_]{2,79}$`.
- `version` must match semantic version `x.y.z`.
- `type` must be `static` for uploaded zip packages.
- `entry` must resolve inside the extracted package.
- `entry` must end with `.html`.
- Package cannot contain path traversal segments.
- Package cannot contain server-executable extensions in P0.
- Package size and file count must be limited by config.

## Runtime And Publishing

Published static apps should use a dedicated static root separate from generic uploads.

Recommended server path:

```text
../upload/app-packages
../upload/app-public
```

Recommended URL prefix:

```text
/apps-static/
```

Published URL shape:

```text
/apps-static/{app_code}/{version}/index.html
```

The app runner route should be:

```text
/#/app-center/open?code={app_code}
```

The runner fetches open metadata from the backend and renders:

- internal route redirect for `internal` apps.
- sandboxed iframe for `static` apps.
- sandboxed iframe or new tab for `iframe` apps.

## Backend API

Platform APIs:

```text
GET    /api/app-platform/apps
POST   /api/app-platform/apps
GET    /api/app-platform/apps/:code
PUT    /api/app-platform/apps/:code
POST   /api/app-platform/apps/:code/versions/upload
POST   /api/app-platform/apps/:code/versions/:version/submit
POST   /api/app-platform/apps/:code/versions/:version/approve
POST   /api/app-platform/apps/:code/versions/:version/reject
POST   /api/app-platform/apps/:code/versions/:version/publish
PUT    /api/app-platform/apps/:code/status
```

Tenant APIs:

```text
GET    /api/app-tenant/marketplace
GET    /api/app-tenant/installed
POST   /api/app-tenant/apps/:code/install
POST   /api/app-tenant/apps/:code/uninstall
GET    /api/app-tenant/apps/:code/open
```

## Permissions

Platform permissions:

```text
app:platform:list
app:platform:read
app:platform:create
app:platform:update
app:platform:upload
app:platform:review
app:platform:publish
app:platform:status
```

Tenant permissions:

```text
app:tenant:marketplace
app:tenant:install
app:tenant:open
```

## Frontend Pages

Platform:

```text
/app-platform/apps
/app-platform/apps/detail
/app-platform/reviews
```

Tenant:

```text
/app-center/marketplace
/app-center/installed
/app-center/open
```

UX requirements:

- Marketplace cards show type, category, install state, and availability.
- Empty states explain whether no apps exist, no apps are approved, or the tenant plan does not allow apps.
- Upload flow shows validation errors from manifest/package checks.
- Review flow shows manifest, file hash, entry, version, and risk warnings before approval.
- Open flow shows an actionable error when the app is disabled, not installed, not plan-entitled, or not published.

## Entitlement Rules

An app is openable only when:

1. App exists and is not disabled or archived.
2. App has an approved and published version when type is `static`.
3. Tenant has installed the app, or the app is platform-assigned/plan-derived.
4. If `saas_module_code` exists, the current tenant plan includes that SaaS module.
5. If `system_module_code` exists, `SystemModuleAccessService` allows the mapped module.
6. User has the required tenant permission.

## Security

P0 security rules:

- Never execute uploaded code on the host.
- Never import uploaded JavaScript into the admin SPA runtime.
- Open static and iframe apps in sandboxed iframes.
- Strip or reject dangerous zip entries.
- Reject hidden path traversal, absolute paths, and symlinks.
- Reject executable server-side extensions.
- Store uploaded package files outside the frontend source tree.
- Keep tenant id from auth context, not request body.
- Record review, publish, install, and open audit logs.
- Do not expose platform tokens to uploaded apps.

## Testing

Backend tests:

- Migration creates all P0 tables and indexes.
- Manifest validator accepts valid static manifests.
- Manifest validator rejects bad code, bad version, missing entry, path traversal, and executable files.
- Platform service creates iframe and internal apps.
- Upload service creates pending static versions.
- Review approve/reject records logs.
- Publish copies only approved static versions to public app root.
- Tenant install requires approved/published app.
- Open metadata rejects disabled, uninstalled, or unpublished apps.

Frontend checks:

- API wrappers compile.
- Platform app list page has empty, loading, error, and action states.
- Tenant marketplace page has install/open states.
- App runner handles internal, static, iframe, and error modes.

Verification commands:

```text
cd server && pnpm.cmd exec jest --runInBand -- app-package
cd server && pnpm.cmd run build
cd web && pnpm.cmd run build
```

## Implementation Phases

### P0: Safe app marketplace foundation

Implement static, iframe, and internal app records; review/publish flow; tenant install; app runner.

### P1: SaaS and system-module bridge

Add UI and backend wiring for optional `saas_module_code` and `system_module_code` gating.

### P2: Module factory

Add low-code CRUD factory for form/list/detail modules and admin-created pages.

### P3: Developer ecosystem

Add developer center, version history, ratings, usage metrics, monetization, and containerized service-plugin runtime design.

## Acceptance Criteria For P0

- Platform admins can create internal and iframe apps.
- Platform admins can upload a static app package and see validation results.
- Uploaded static app versions require admin approval before publishing.
- Approved static app versions can be published under the dedicated static app prefix.
- Tenants can see approved marketplace apps.
- Tenants can install and uninstall apps.
- Users can open installed apps through a controlled runner.
- The server never executes uploaded app code in P0.
- Existing SaaS module and system-module behavior remains compatible.
