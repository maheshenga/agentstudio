# Hybrid App Platform Completion Design

## Status

Approved on 2026-07-12.

This design completes the remaining app-platform scope after the verified P0 through P9-A implementation. It covers P9-B runtime sessions and capability enforcement, P9-C shared runtime capabilities, host-process service plugins, certified developer submissions, external applications, and app commercialization.

## Goal

Turn the existing static-app marketplace and runtime SDK into an extensible SaaS application platform that can host static pages, connect external systems, run reviewed Bun/Node service plugins, and expose native platform modules through one lifecycle, entitlement, review, analytics, and billing model.

## Current Baseline

The repository already provides:

- application, version, review, publish, rollback, install, and open lifecycles;
- static package extraction and manifest validation;
- platform and developer application workspaces;
- module and SaaS-plan entitlement enforcement;
- tenant marketplace and installed-application management;
- open-outcome auditing and platform/tenant analytics;
- sandboxed static application runtime bootstrap;
- runtime message protocol, SDK, HTML starter, and deterministic/live gates.

The implementation baseline is commit `161760329abd82c1ae9f77f470273debb2f3b7c4`. The production deployment of that baseline must be completed before new runtime capability work is released.

## Scope

### Included

- short-lived scoped runtime sessions;
- explicit capability grants and tenant consent;
- tenant/application-isolated KV and file storage;
- controlled HTTP, webhook, notification, AI, and service invocation;
- external iframe application registration and signed launch;
- reviewed Bun/Node service plugins running as separate host processes;
- administrator-trusted and certified-developer-restricted trust tiers;
- health checks, quotas, logs, release switching, and rollback;
- free, plan-included, subscription, and one-time app licensing;
- revenue ledger and manual settlement batches;
- SDK, starter, documentation, readiness gates, and rollout controls.

### Excluded

- Docker or Kubernetes orchestration;
- Python or arbitrary native executable plugins;
- loading third-party code into the NestJS process;
- plugin access to the platform database, Redis, payment keys, or main `.env`;
- production-side arbitrary package builds or package lifecycle scripts;
- usage-based automatic charging;
- automated developer payouts;
- invoices;
- automatic rollback of plugin data.

## Design Principles

1. Reuse the existing application marketplace instead of introducing a second plugin catalog.
2. Keep all untrusted or semi-trusted code outside the NestJS process.
3. Make authority explicit through short-lived sessions and named capabilities.
4. Enforce tenant ownership on every storage and gateway operation.
5. Keep old and new versions side by side so release switching is reversible.
6. Make capability increases require a new platform review and tenant consent.
7. Ship each phase behind a disabled-by-default feature flag.
8. Prefer prebuilt single-file service artifacts to production dependency installation.

## Application Runtime Model

The existing application package becomes the common product record for four runtime types.

### Static

`static` applications are HTML, CSS, and JavaScript packages. They continue to run in the existing sandbox and communicate only through the runtime SDK.

### Iframe

`iframe` applications point to an approved HTTPS origin. The platform owns menu placement, entitlement checks, tenant authorization, signed launch, origin validation, and runtime message policy.

### Service

`service` applications are reviewed Bun/Node services. Each published version runs as a separate low-privilege process on a loopback-only port. The NestJS capability gateway is the only supported route to SaaS data and platform actions.

### Native

`native` applications are platform-owned NestJS/Vue modules released with the main repository. They participate in the same catalog, entitlement, analytics, and licensing model but are not dynamically loaded.

## Trust Model

### Platform Trusted

`platform_trusted` is available to platform administrators. Trusted applications can request broader capabilities and larger quotas, but every release and capability change remains auditable. High-authority releases require review by a second platform operator who has publish permission.

### Developer Restricted

`developer_restricted` is available only to certified developers. Packages require automated validation, frozen review content, manual approval, candidate health checks, low-privilege execution, bounded resources, and network restrictions.

### External Managed

`external_managed` applies to iframe integrations. The platform validates origins and uses one-time signed launch sessions. External applications do not receive platform cookies or long-lived platform tokens.

### Static Sandboxed

`static_sandboxed` applies to uploaded static packages. The existing iframe sandbox remains mandatory, and all platform operations use the runtime protocol.

## Data Model

### Existing Application Package Extensions

Extend the current application package with:

- `runtime_type`: `static`, `iframe`, `service`, or `native`;
- `trust_level`: `platform_trusted`, `developer_restricted`, `external_managed`, or `static_sandboxed`;
- `requested_capabilities`: normalized capability-name array;
- `allowed_origins`: normalized HTTPS origin array;
- `service_health_path`: relative health endpoint for service packages;
- `runtime_config`: non-secret, schema-validated runtime settings.

Compatibility rules:

- existing `static` packages map to `runtime_type=static` and `trust_level=static_sandboxed`;
- existing `internal` packages map to `runtime_type=native` and `trust_level=platform_trusted`;
- existing entry URLs remain valid during migration;
- responses retain current fields while adding normalized runtime fields.

### Application Version Extensions

Each version stores:

- manifest version;
- package format and artifact checksum;
- normalized immutable manifest snapshot;
- approved capability snapshot;
- automated scan result summary;
- candidate health status;
- release and rollback metadata.

Version content becomes immutable after submission. A rejected version may be cloned into a new draft but cannot be edited in place.

### Runtime Session

`app_runtime_session` contains:

- session identifier and token digest;
- tenant, user, application, version, and install identifiers;
- granted capability snapshot;
- issued, expiry, revoked, and last-used timestamps;
- nonce and client/runtime metadata needed for replay protection.

The raw token is returned once and never stored. Default lifetime is five minutes. Revocation, uninstall, entitlement loss, license expiry, and capability withdrawal invalidate active sessions.

### Capability Grant

`app_capability_grant` records:

- application and version;
- requested capability;
- platform review status and reviewer;
- tenant consent status and tenant operator;
- policy and quota snapshot;
- grant, denial, revocation, and expiry timestamps.

Capabilities not present in both the platform approval and tenant consent snapshots are denied.

### Runtime KV

`app_runtime_kv` is uniquely keyed by tenant, application, namespace, and key. It stores a JSON value, size, optimistic-lock version, optional expiry, and audit timestamps. Queries must include both tenant and application identifiers.

### Storage Object

`app_storage_object` records tenant, application, owner user, storage key, MIME type, size, checksum, status, and expiry. Bytes use the existing storage service. Applications receive opaque object identifiers rather than filesystem paths.

### Service Instance

`app_service_instance` records application version, release directory, stable process name, loopback port, process status, health status, restart count, active/candidate role, and bounded diagnostic timestamps.

### Developer Profile

`app_developer_profile` records user ownership, certification status, approved runtime types, risk level, reviewer, certification expiry, and disabled state. A disabled or expired developer cannot submit new service versions.

### Commercial Records

- `app_price_plan`: pricing model, amount, currency, billing period, trial period, sale scope, and status;
- `tenant_app_license`: tenant, application, source, order, effective range, status, and revocation reason;
- `app_revenue_ledger`: immutable charge, refund, platform-share, and developer-share entries;
- `app_settlement_batch`: monthly developer totals and manual review/payment status.

## Manifest V2

All package types use a normalized manifest. A service example is:

```json
{
  "manifestVersion": 2,
  "code": "example-app",
  "version": "1.0.0",
  "runtime": "service",
  "entry": "dist/index.js",
  "healthPath": "/health",
  "capabilities": ["context.read", "kv.read", "kv.write"],
  "allowedOrigins": []
}
```

Developer-restricted service archives contain only:

```text
app.manifest.json
dist/index.js
assets/
```

They may not contain symbolic links, native binaries, executable scripts, package lifecycle scripts, absolute paths, traversal paths, or shell commands. Production does not run `npm install`, `pnpm install`, or `bun install` for these packages.

## Capability Gateway

The gateway exposes explicit capabilities instead of a generic database or internal-service proxy.

Initial capability names are:

- `context.read`;
- `kv.read`, `kv.write`, `kv.delete`;
- `files.read`, `files.write`;
- `http.request`;
- `webhook.emit`;
- `notifications.send`;
- `ai.invoke`;
- `service.invoke`.

Every request validates:

1. runtime token digest and expiry;
2. tenant, user, application, version, and installation binding;
3. current application publication and installation state;
4. SaaS plan and module entitlement;
5. application license validity;
6. platform capability approval;
7. tenant consent;
8. capability quota and rate limit.

The SDK exposes typed operations:

```ts
runtime.context.get()
runtime.kv.get()
runtime.kv.set()
runtime.kv.delete()
runtime.files.upload()
runtime.http.request()
runtime.webhooks.emit()
runtime.notifications.send()
runtime.ai.invoke()
runtime.services.invoke()
```

Capability handlers are separate services with separate DTO validation and tests. Adding one capability does not change the authorization rules of another capability.

## User Flows

### Platform Administrator

1. Create an application and choose its runtime type.
2. Enter catalog metadata, entry settings, and requested capabilities.
3. Upload a version or bind a native module.
4. Run package, manifest, dependency, and policy checks.
5. Review content changes, capability changes, and risk findings.
6. Start a service version as a loopback-only candidate.
7. Publish only after the candidate is healthy.
8. Bind visibility, SaaS plans, modules, and app pricing.
9. Roll back routing to the previous healthy version when needed.

### Certified Developer

1. Obtain platform developer certification.
2. Create a static, iframe, or service application.
3. Build with an approved starter and upload a version.
4. Review automated validation findings.
5. Submit and freeze the version.
6. Receive structured approval or rejection results.
7. Inspect only owned application logs, reliability, usage, and revenue summaries.

### Tenant Administrator

1. Review application value, pricing, required plan/modules, and requested capabilities.
2. Purchase or activate a valid license when required.
3. Consent to capabilities and install the application.
4. Manage application configuration and permissions.
5. Revoke capabilities, disable, or uninstall the application.

### Tenant User

1. Open an installed and entitled application.
2. Receive a short-lived runtime session through open metadata.
3. Use the application while all platform calls pass through the capability gateway.
4. Receive actionable upgrade, authorization, or availability messages when access is denied.

## Upgrade Policy

- versions without capability increases may use tenant-configured automatic upgrades;
- versions with new capabilities require platform review and renewed tenant consent;
- service candidates start beside the active release;
- routing switches only after consecutive successful health probes;
- a failed candidate leaves the old release active;
- service plugins cannot execute platform database migrations;
- plugin KV and storage changes must remain backward compatible across one retained version.

## Host-Process Service Runtime

### Filesystem

Each version is installed under a versioned read-only directory:

```text
/www/wwwroot/agentstudio-plugins/<app-code>/<version>/
```

Writable application data is available only through gateway storage capabilities. Plugin processes cannot access the main project, shared environment files, database files, payment configuration, or other plugin directories.

### Process Model

- a dedicated low-privilege Linux account runs service plugins;
- every process uses a stable, validated PM2 name and random available loopback port;
- entry points are package-relative JavaScript files;
- stdout/stderr pass through bounded, redacting log handling;
- NestJS stores desired state while PM2 provides process supervision;
- instance reconciliation repairs safe state drift but never publishes an unreviewed version.

### Default Restricted Quotas

- 256 MB memory;
- 15-second request timeout;
- 2 MB request body;
- 20 concurrent requests;
- circuit open after five consecutive failures;
- automatic disable after more than five restarts in one minute;
- seven-day log retention.

Trusted administrators may raise a quota through an audited policy change.

### Network Policy

Plugin processes bind only to `127.0.0.1`. Production host rules prevent the plugin user from reaching public networks, cloud metadata addresses, MySQL, Redis, Baota management ports, or main service administrative ports. Approved outbound calls are performed by the gateway, which enforces HTTPS, origin allowlists, DNS/IP revalidation, private-address denial, timeouts, body limits, and redirect limits.

### Secrets

Application secrets are encrypted with a platform master key and never returned after creation. The gateway injects a configured secret into an approved outbound operation without exposing the plaintext to the application. UI values are masked, access is audited, and key rotation does not require an application release.

## Iframe Security

- only normalized HTTPS origins are allowed in production;
- launch uses a one-time signed session rather than platform cookies;
- `postMessage` validates exact origin, source window, request identifier, and protocol version;
- CSP and iframe sandbox permissions derive from approved capabilities;
- navigation, popups, downloads, clipboard, and same-origin permissions are denied unless explicitly required and reviewed;
- external applications never receive persistent platform access tokens.

## Commercial Model

### Pricing

Initial models are:

- `free`;
- `included` in selected SaaS plans;
- monthly or annual `subscription`;
- version-independent `one_time` license.

Usage is recorded for analytics and future billing but does not trigger automatic charges in this scope.

### Order Integration

App purchases reuse the existing SaaS order, Alipay, payment callback, refund, and idempotency mechanisms. Successful payment activates a tenant application license. Refund, expiry, order closure, administrator revocation, or entitlement loss updates the license and invalidates runtime sessions.

Installation and licensing remain separate: a paid application can be viewed before purchase but cannot be installed or opened without a valid license.

### Revenue and Settlement

Every charge and refund creates immutable revenue-ledger entries for gross amount, platform share, developer share, and adjustment. Monthly settlement batches are reviewed and marked paid manually. Automated transfers and invoices are excluded.

## User Interface

### Platform Administration

- Applications;
- Review Center;
- Runtime Instances;
- Capability Policies;
- Developer Certification;
- App Analytics;
- Pricing and Settlement.

### Developer Workspace

- My Applications;
- Versions and Reviews;
- Runtime Logs;
- SDK and Starters;
- Usage and Revenue.

### Tenant Administration

- Marketplace;
- Installed Applications;
- Application Permissions;
- Application Usage;
- Subscription and Purchase entry points.

The application detail view presents actual screenshots, use cases, requested permissions, plan requirements, pricing, trial terms, version history, certification, reliability, and reviews. Access failures provide an actionable install, consent, or purchase action instead of a generic module-disabled error.

## Feature Flags

All new capabilities default to disabled:

- `APP_RUNTIME_CAPABILITIES_ENABLED`;
- `APP_RUNTIME_STORAGE_ENABLED`;
- `APP_SERVICE_RUNTIME_ENABLED`;
- `APP_DEVELOPER_SERVICE_ENABLED`;
- `APP_MARKETPLACE_BILLING_ENABLED`.

Flags are enabled in order for platform administrators, designated test tenants, and certified developers. Existing static applications remain available when all new flags are disabled.

## Error Handling

- authentication and tenant-binding failures return a generic unauthorized response and create a security audit event;
- missing grants return the denied capability and an actionable consent state without exposing policy internals;
- quota failures return a stable retryable error and `retry_after` where applicable;
- candidate startup failures preserve the active release and bounded diagnostic output;
- gateway outbound failures redact secrets and upstream response bodies;
- payment and license transitions are idempotent and transactional;
- runtime log ingestion drops or masks known credential fields before persistence.

## Testing Strategy

### Unit and Contract Tests

- token issue, digest, expiry, revocation, and replay behavior;
- capability intersection and quota policy;
- manifest V2 parsing and archive rejection;
- KV isolation, TTL, quota, and optimistic locking;
- storage ownership and path opacity;
- HTTP allowlist, DNS rebinding, redirect, and SSRF denial;
- pricing, license, ledger, refund, and settlement calculations;
- SDK request lifecycle and error contracts.

### Integration Tests

- tenant and application isolation with negative cross-tenant cases;
- entitlement, license, installation, and capability composition;
- candidate process start, health, switch, crash, circuit break, and rollback;
- iframe origin and signed launch validation;
- payment callback replay and license activation/revocation;
- developer ownership and review-content immutability.

### End-to-End Tests

- static app install, consent, session, KV operation, and uninstall;
- external iframe signed launch and rejected-origin path;
- administrator service plugin publish and rollback;
- certified developer submission, review, candidate, and publish;
- paid app purchase, install, open, expiry, and refund;
- browser console/network assertions with no failed gateway requests or secret output.

Every disposable live test removes its application, processes, files, database rows, KV values, and Redis keys.

## Delivery Sequence

### Phase 0: Release Baseline - 1 Day

Complete the pending production deployment of P0 through P9-A, including backups, candidate build, atomic switch, controlled logins, application-open verification, and stability observation.

### P9-B: Runtime Sessions and Capability Gateway - 3 to 4 Days

Deliver session issuance, capability review/consent, context capability, rate limiting, audit, revocation, and SDK support.

### P9-C: Shared Runtime Capabilities - 4 to 5 Days

Deliver KV, files, HTTP/webhook proxy, iframe signed launch, SDK methods, starter updates, and full lifecycle E2E.

### P10: Administrator Service Plugins - 5 Days

Deliver Manifest V2, single-file service upload, scanning, low-privilege release directories, PM2 reconciliation, health checks, logs, publish, and rollback.

### P11: Certified Developer Service Plugins - 5 Days

Deliver developer certification, service submission, automated findings, frozen review content, candidate review, quotas, circuit breaking, and owned observability.

### P12: App Commercialization - 5 Days

Deliver app price plans, licenses, existing-order integration, Alipay activation, revenue ledger, manual settlement batches, and conversion UI.

### P13: Launch Hardening - 3 Days

Finalize SDK/starter documentation, run repository and live gates, rehearse production migration/rollback, enable staged rollout, and establish operational dashboards.

The expected total is 25 to 28 focused engineering days. P9-B and P9-C provide a useful static/external application platform after 8 to 10 days. Administrator service plugins become available at approximately three weeks.

## Acceptance Criteria

The design is complete when:

- existing static applications, marketplace, review, install, and analytics behavior remain green;
- expired, revoked, replayed, and cross-tenant sessions are rejected;
- every capability requires both platform approval and tenant consent;
- KV and file data are isolated by tenant and application;
- outbound proxy calls cannot reach private, loopback, link-local, metadata, or unapproved destinations;
- a plugin crash, timeout, memory breach, or restart loop does not stop NestJS;
- a failed service candidate never replaces the active version;
- uninstall, entitlement loss, license expiry, refund, and revocation invalidate access;
- repeated payment callbacks cannot duplicate licenses or ledger entries;
- logs and errors contain no raw tokens, secrets, credentials, or tenant-sensitive payloads;
- each phase passes focused tests, repository readiness, review, and an independent commit before the next phase begins.

## Residual Risk

Host-process execution without containers is not strong isolation for arbitrary code. Service plugins therefore remain restricted to platform administrators and certified developers, with mandatory automated checks, manual review, low-privilege execution, host filesystem/network policy, quotas, and audit. Uncertified developers may publish only static or approved iframe applications.
