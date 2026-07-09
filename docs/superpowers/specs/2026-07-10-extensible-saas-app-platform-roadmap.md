# Extensible SaaS App Platform Roadmap

Date: 2026-07-10

## Goal

Turn the current SaaS system into an extensible app platform where platform admins, approved developers, and later tenant creators can package new capabilities as governed apps. An app can be an AI tool, industry module, lifestyle utility, static HTML page, iframe integration, or a more complex business module, but every app must pass through a safe lifecycle before tenants can install and users can open it.

## Current State

The project already has four related layers:

1. SaaS commercial layer: plans, subscriptions, resource packs, SaaS modules, quota, orders, payment, and tenant entitlements.
2. System module layer: built-in product modules, tenant module enablement, route guards, SaaS bridge, and diagnostics.
3. App marketplace layer: app packages, versions, review logs, tenant installs, open logs, static/iframe/internal runtime, sandboxed app runner, and entitlement checks.
4. Module factory layer: platform-created static HTML/CSS modules, safe publish to marketplace apps, and curated factory templates.

The current P0-P3 work makes the app platform usable, but it is not yet a complete app ecosystem. The missing pieces are version governance, review operations, developer submission, runtime API contracts, tenant/admin analytics, and eventually safe service-plugin execution.

## Product Requirements

### Platform Admin

- Create internal, iframe, static, and factory-generated apps.
- Bind apps to SaaS modules and system modules.
- Review uploaded or generated versions before publishing.
- Unpublish, rollback, disable, archive, and audit app changes.
- See install/open usage, failed opens, entitlement blockers, and app health.
- Curate app categories, templates, featured apps, and recommended modules.

### Developer Or Creator

- Submit static app packages or factory modules for review.
- See package validation results, review state, publish state, and rejection reasons.
- Manage versions without directly editing production app state.
- Later: request developer approval, manage app profile, docs, screenshots, changelog, support links, and API scopes.

### Tenant Admin

- Browse marketplace apps with clear availability state.
- Install/uninstall apps allowed by plan and system-module entitlement.
- See which plan/module unlocks an unavailable app.
- Manage tenant app configuration and member visibility.
- Open installed apps through a controlled runner.

### Ordinary User

- Open installed apps from the app center.
- See understandable errors when an app is disabled, missing, uninstalled, unavailable, or unpublished.
- Avoid needing to understand SaaS internals, review flow, or module bindings.

## App Lifecycle

```text
draft -> uploaded/generated -> pending_review -> approved -> published
      -> unpublished_retired -> rollback/publish -> published
      -> disabled/archived
```

Required lifecycle guarantees:

- Only approved static versions can be published.
- Only published apps are visible in tenant marketplace/open flows.
- A static app should have at most one active published version for normal tenant opening.
- Version operations must record review/audit logs with operator and reason.
- Tenant installs must continue to point to a valid version or fail with a clear error after unpublish.
- Rollback must not execute or import uploaded code into the admin SPA.

## Platform Boundaries

The app platform is a container and lifecycle system, not a replacement for SaaS plans or system-module guards.

- `saas_module` controls commercial entitlement.
- `system_module` controls built-in product/runtime access.
- `app_package` controls discoverability, review, install, open, and app metadata.
- `app_factory_module` controls admin-created static content that can become an app package.

## Security Requirements

- No host execution for uploaded packages in the current static/iframe/factory phases.
- Static apps and iframe apps remain sandboxed and must not use `allow-same-origin`.
- Package extraction must reject traversal, symlinks, excessive size/count, and server-executable files.
- Backend routes must use authenticated operator and tenant context, never tenant id from request body.
- Runtime/open endpoints must verify app state, tenant install, published version, and module entitlement.
- Review logs must capture publish, unpublish, rollback, reject, approve, disable, and archive events.
- Future service plugins must run outside the main NestJS process in a separately governed runtime.

## UX Requirements

- Platform app list must show app state, bindings, current active version, and version governance actions.
- Version drawer must show review status, publish status, active version, entry file, review message, and timestamps.
- Tenant marketplace must explain unavailable apps without making users guess which module or plan is missing.
- Factory templates must help admins create real modules quickly, but publishing still goes through safe static runtime.
- Empty, loading, failed, and permission-denied states must be explicit on marketplace, installed apps, runner, and factory pages.

## Roadmap

### P4: App Version Governance

Add unpublish and rollback operations for app versions, expose reason prompts in the platform UI, and make version drawer clearly show the active published version.

Acceptance:

- Platform admin can unpublish a published static version.
- Platform admin can rollback to an approved publishable static version.
- Audit log records `unpublish` and `rollback`.
- The active app `entry_url` follows the selected published version.
- Frontend readiness and backend tests cover the governance actions.

### P5: Review Operations Center

Add a dedicated review queue across uploaded packages and factory-generated apps.

Acceptance:

- Reviewers can filter pending, approved, rejected, published, and retired versions.
- Review page shows manifest, hash, entry, package metadata, developer, app binding, and risk notes.
- Approve/reject/publish/governance actions remain permission-protected.

### P6: Developer Submission Center

Let approved creators submit static packages and track review state without platform-wide admin access.

Acceptance:

- Creator can create draft app metadata and upload static versions.
- Creator cannot approve, publish, rollback, or modify another developer's app.
- Platform admin can approve developer profile and app versions.

### P7: App Analytics And Operations

Add operational metrics for installs, opens, failed opens, entitlement blockers, and version adoption.

Acceptance:

- Platform admin can see app usage overview and per-app metrics.
- Tenant admin can see installed app usage for their tenant.
- Failed opens are auditable without leaking secrets.

### P8: Safe App Runtime API

Define a small browser-to-platform API contract for static apps, starting with read-only context and later scoped data APIs.

Acceptance:

- Static apps can request sanitized tenant/user/app context through postMessage.
- API scopes are tied to app permissions and tenant entitlement.
- No platform token is exposed to uploaded apps.

### Later: Service Plugin Runtime

Add executable modules only after container isolation, resource limits, network policy, signed packages, and rollout/rollback controls exist.

Acceptance:

- No uploaded code runs in the main NestJS host process.
- Plugin runtime has health checks, logs, versioned deployment, and emergency disable.

## Near-Term Recommendation

Start with P4 because P0-P3 already allow publishing apps. Without version governance, every published app is operationally brittle: admins can publish but cannot safely retire or rollback a version. P4 is small enough to implement with focused tests and large enough to make the marketplace materially safer.

