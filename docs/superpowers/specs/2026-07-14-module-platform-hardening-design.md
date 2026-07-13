# Module Platform Hardening Design

## Goal

Converge the project on one executable module model and close every P0-P3 issue found in the July 14 module-system audit before the product is launched.

## Canonical Architecture

- `app` and `app-commerce` own executable applications, review, publication, tenant installation, runtime capabilities, licensing, revenue, and settlement.
- `system-module` owns system capability metadata, dependencies, route protection, tenant grants, configuration, health, menu links, permission links, and SaaS entitlement bridges.
- `saas` owns plans, subscriptions, quotas, and commercial module entitlement.
- The legacy `system/plugin` CRUD model is removed. Its status values never loaded executable code and must not remain as a competing plugin definition.

## Runtime Models

- `internal`: opens a native route and does not require a package version.
- `static`: installs a reviewed published static version and opens it in the sandboxed application runner.
- `iframe`: installs a reviewed published metadata version and opens an exact-origin signed launch URL.
- `service`: installs the current active, healthy, published service version. It is callable through `services.invoke`; it is not opened as an empty iframe.

## Governance

- Package status changes use an explicit transition table.
- A package cannot become `published` through the generic status endpoint. Static and iframe versions publish through version publication; service packages publish through runtime promotion.
- Capability approval is performed through one review flow. Missing `approved_capabilities` never means approve everything.
- Tenant module grants and revocations are explicit platform operations with source, operator, reason, and event history.

## Security

- All upload endpoints apply Multer limits before buffering.
- Archive inspection limits compressed bytes, uncompressed bytes, file count, per-file bytes, path depth, compression ratio, and extraction time.
- JavaScript service packages reject constructor/prototype escape primitives. Developer service execution remains feature-gated and is not considered a sandbox; production activation requires the existing non-root runtime plus an external isolation boundary.
- Route enforcement compiles validated module API metadata and retains explicit built-in bindings as a deterministic fallback.

## Entitlement And Dependencies

- Database SaaS bridges augment static bridge defaults by SaaS module instead of disabling all fallback mappings globally.
- Baseline tenant modules use one shared rule in access checks and list responses.
- Required dependencies are resolved transitively, cycles are rejected, and semver ranges are enforced.

## Module Operations

- Module configuration has platform defaults and tenant overrides validated against `config_schema`.
- Health checks update `health_status` and record bounded diagnostic events without secrets.
- Menu and permission metadata are synchronized with existing system menu records and remain subject to role permission checks.

## UX And Maintainability

- Platform review is the only approval UI.
- Service applications display service-specific installation and invocation states instead of an Open button.
- Large Vue pages are split by responsibility without redesigning the established admin visual language.
- User-facing module and application workflows use consistent Chinese copy.

## Verification

- Each behavior change starts with a failing Jest or Vitest test.
- Backend module, application, commerce, migration, route-consistency, and environment-contract suites must pass.
- Frontend type checking and production build must pass.
- Readiness checks are run after all module changes, followed by `git diff --check` and a focused code review.

