# Module Platform Hardening Implementation Plan

**Goal:** Close the highest-risk module-platform gaps without replacing the existing System Module, App Platform, runtime, or commerce boundaries.

**Architecture:** System Module remains metadata and entitlement governance. Executable delivery remains in App Platform. Changes are additive where possible: pre-body runtime authorization, immutable static artifact digests, explicit lifecycle transitions, paginated catalog contracts, short-lived entitlement snapshots, tenant-controlled upgrades, developer certification gates, runtime-aware capability schemas, and versioned factory templates.

**Tech stack:** NestJS, TypeORM, Jest, Vue 3, Element Plus, Vite, TypeScript, MySQL, Redis-compatible cache abstractions.

## Global Constraints

- Do not execute plugin manifest hooks or uploaded backend code outside the existing service runtime.
- Preserve tenant ownership checks and `runOutsideTenant` for platform operations.
- Preserve current routes where a compatible query or response extension is sufficient.
- Add a failing regression test before every behavior change.
- Do not expose secrets, filesystem paths, container identifiers, raw cookies, or runtime tokens.
- Keep migrations forward-only and safe for an empty pre-production database.

## Task 1: Pre-body runtime file authorization

**Files:**
- Create `server/src/module/app/guards/app-runtime-file-upload.guard.ts`
- Create `server/src/module/app/guards/app-runtime-file-upload.guard.spec.ts`
- Modify `server/src/module/app/app-runtime.controller.ts`
- Modify `server/src/module/app/app.module.ts`

1. Add a failing guard test proving an invalid/missing runtime token is rejected before the controller handler and proving an authorized session is attached to the request.
2. Implement a dedicated `CanActivate` guard that calls `AppRuntimeSessionService.authorize(token, 'files.write')` and stores the bounded session on the request.
3. Apply the guard before `FileInterceptor`; make the handler consume the pre-authorized session without a second authorization call.
4. Add controller regression coverage and run both focused specs.

## Task 2: Immutable static publication digest

**Files:**
- Modify `server/src/module/app/entities/app-package-version.entity.ts`
- Modify `server/src/module/app/services/app-package-storage.service.ts`
- Modify `server/src/module/app/services/app-platform.service.ts`
- Add a TypeORM migration under `server/src/migrations`
- Modify corresponding storage/platform/entity specs

1. Add failing tests for deterministic directory hashing and publication rejection after reviewed files are modified.
2. Add `content_hash` to app versions and calculate a canonical SHA-256 over sorted relative paths and bytes after extraction.
3. Recompute and compare the digest immediately before static publication.
4. Keep the existing ZIP `file_hash` for audit compatibility.

## Task 3: System Module lifecycle state machine

**Files:**
- Create `server/src/module/system-module/system-module-lifecycle.ts`
- Create `server/src/module/system-module/system-module-lifecycle.spec.ts`
- Modify `server/src/module/system-module/services/system-module-registry.service.ts`
- Modify registry specs

1. Add failing transition-table tests and tests that prevent disabling a module with enabled dependants.
2. Implement explicit allowed transitions and accurate event mapping for install, enable, disable, upgrade, failure, and uninstall states.
3. Enforce dependency protection transactionally before status mutation.
4. Preserve no-op behavior when the status is unchanged.

## Task 4: Scalable catalog and entitlement reads

**Files:**
- Modify app list DTOs, controllers, APIs, services, and Vue list pages
- Create `server/src/module/system-module/services/system-module-access-cache.service.ts`
- Modify System Module access/registry services and specs

1. Add failing API/service tests for bounded `page`, `limit`, keyword, category, type, and status filters.
2. Return `{ list, total, page, limit }` from platform and tenant catalog endpoints and update UI pagination.
3. Batch catalog availability by unique SaaS/System Module requirements.
4. Add a short-lived compiled entitlement cache with explicit invalidation after status, bridge, grant, or configuration changes.

## Task 5: Upgrade, developer gate, and capability matrix

**Files:**
- Modify tenant/developer controllers and services, app manifest types, APIs, and app-center views
- Modify related specs and readiness scripts

1. Add failing tests for `update_available`, explicit tenant upgrade, capability re-consent, and runtime-session revocation.
2. Add an upgrade endpoint that changes the pinned version transactionally and never silently grants new capabilities.
3. Require an approved developer profile for the selected app runtime type before developer creation/upload/submit.
4. Persist normalized HTTPS `allowedOrigins` for static apps and reject runtime/capability combinations that cannot execute.

## Task 6: Product and maintenance convergence

**Files:**
- Modify app metadata DTO/entity/API/UI files and migration
- Add focused composables/components under `web/src/views/app-platform` and `web/src/views/app-center`
- Modify `web/vite.config.ts` and readiness scripts

1. Add marketplace detail metadata: screenshots, documentation URL, support URL, and changelog.
2. Add a tenant marketplace detail drawer and normalize module/app-center user-facing copy to Chinese.
3. Extract lifecycle/dialog/query concerns from oversized module pages as they are touched.
4. Enforce a generated-build asset budget and lower the hidden chunk warning threshold.

## Task 7: Versioned recruitment and classifieds factory templates

**Files:**
- Modify factory template entity/DTO/service/API/UI and seed migration
- Add factory template contract and service specs

1. Add failing tests for template schema version, runtime target, manifest defaults, and immutable published template versions.
2. Upgrade the existing recruitment and classifieds seeds into versioned scaffolds that generate valid static or service app manifests.
3. Keep publication routed through the existing App Platform review/runtime boundary; factory output must never bypass review for executable service code.

## Final Review Gate

1. Review `git diff` for tenant-scope regressions, secret exposure, unsafe status transitions, and compatibility gaps.
2. Run focused RED/GREEN specs after each task.
3. Run app/system-module/backend readiness suites, all app frontend readiness scripts, SDK verification, full Vue build, `git diff --check`, and `git status`.
4. Commit only after every required gate passes; otherwise report the exact blocker without claiming completion.
