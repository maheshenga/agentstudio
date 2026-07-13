# Application Commerce Baota Runbook

This runbook deploys application pricing, orders, licenses, revenue, refunds, and manual settlements through Baota. Application commerce is disabled by default and must remain disabled until every preflight and smoke check below passes.

## Protected Inputs

Keep deployment values in the existing protected Baota environment editor or secret store. Document names only:

```text
APP_COMMERCE_ENABLED
APP_COMMERCE_E2E_DB_HOST
APP_COMMERCE_E2E_DB_PORT
APP_COMMERCE_E2E_DB_USERNAME
APP_COMMERCE_E2E_DB_PASSWORD
APP_COMMERCE_E2E_PLATFORM_USERNAME
APP_COMMERCE_E2E_PLATFORM_PASSWORD
APP_COMMERCE_E2E_REDIS_HOST
APP_COMMERCE_E2E_REDIS_PORT
APP_COMMERCE_E2E_REDIS_PASSWORD
APP_COMMERCE_E2E_REDIS_DB
APP_COMMERCE_E2E_REDIS_ISOLATED
```

Never paste `.env`, payment keys, database credentials, Redis credentials, Baota session data, tokens, or cookies into source files, release notes, shell history, screenshots, or verification output.

## 1. Backup And Preflight

1. Keep `APP_COMMERCE_ENABLED` false in the release environment.
2. Record the current Git commit, process configuration, Node.js version, Bun/pnpm version, and migration state without recording environment values.
3. Create a Baota database backup and verify it can be listed and restored.
4. Back up the current backend and frontend release artifacts and retain the prior process definition for rollback.
5. Confirm MySQL and Redis health independently from the reverse proxy and public domain.
6. Confirm the selected disposable Redis logical database for the live gate is isolated, non-zero, and empty. Never reuse a production application database.
7. Confirm no developer share, full refund, or manual settlement operation is pending outside the system before migration.

## 2. Deterministic Gates

Run from the checked-out release candidate:

```powershell
cd server
pnpm.cmd run verify:app-commerce-live-e2e-contract
pnpm.cmd run verify:saas-readiness
pnpm.cmd run build

cd ../web
pnpm.cmd run verify:app-commerce-readiness
pnpm.cmd run verify:saas-readiness
pnpm.cmd run build
```

The live gate is Linux-only and must use the protected `APP_COMMERCE_E2E_*` variables. It creates a disposable MySQL database, claims an empty isolated Redis database atomically, starts with commerce disabled, restarts with commerce enabled, uses development payment confirmation under `NODE_ENV=test`, and performs no real Alipay request.

```powershell
cd server
pnpm.cmd run verify:app-commerce-live-e2e
```

Do not enable production commerce without a green disposable run and verified cleanup of its MySQL database and Redis lease.

## 3. Migration

1. Stop write traffic or enter the existing maintenance mode.
2. Apply the application commerce schema and menu migrations once.
3. Verify the price plan, order, license, revenue ledger, settlement, menu, permission, and migration records exist.
4. Verify future tenant provisioning grants the application order workspace and the intended owner/admin/member permissions.
5. Keep `APP_COMMERCE_ENABLED` false and restart the backend through the existing Baota process manager.
6. Verify backend health, reverse-proxy health, and authenticated platform access separately.

## 4. Disabled-First Smoke

With commerce still disabled:

1. Open a published application with no price plan and confirm legacy-free compatibility.
2. Open an application that already has a paid price definition and confirm tenants still receive legacy-free behavior while the flag is off.
3. Confirm existing SaaS plan, resource-pack, marketplace, analytics, P9, P10, and P11 paths remain available.
4. Confirm application orders, licenses, ledger rows, and settlements are not created by read-only navigation.

## 5. Internal Enablement Smoke

Enable `APP_COMMERCE_ENABLED` only for the controlled release environment, restart the backend, and verify:

1. A free application can be installed and opened without an order.
2. An included application follows the tenant's active SaaS plan and loses entitlement when that subscription ends.
3. A paid application shows the backend price, billing period, trial terms, and Alipay provider before order creation.
4. One trial can be started once and cannot be replayed.
5. A paid order stores the backend-owned amount, currency, application, tenant, plan, developer, and developer share snapshot.
6. The Alipay callback endpoint is reachable through the configured public route, validates signatures and exact amounts, and remains replay-safe. Do not send production callbacks to a disposable environment.
7. Successful payment creates one current license and one immutable charge ledger row.
8. Install, open, and runtime context work only while the license remains valid.
9. Cross-tenant order, payment, install, open, and runtime access fail closed.

## 6. Refund And Settlement Operations

1. Confirm the provider-side full refund result before recording a full refund in the platform workspace.
2. Verify the order and license become refunded and one negative immutable ledger row offsets the original charge.
3. Verify refund recording does not initiate an Alipay refund request.
4. Review the developer share totals for the closed month before creating a manual settlement.
5. Create the settlement once, approve it with an operator note, perform the external transfer separately, and mark it paid with a bounded reference.
6. Verify no invoice or automated payout behavior runs and no settlement can move backward.

## 7. Observation

Run a 15-minute observation window before broad tenant enablement. Monitor fixed, non-sensitive metrics for:

- application order creation and payment confirmation errors;
- duplicate callback or duplicate ledger conflicts;
- license denial reasons and runtime authorization failures;
- refund recording failures;
- settlement transition failures;
- MySQL latency, Redis errors, process restarts, and reverse-proxy errors.

Do not capture request payloads, callbacks, tokens, cookies, order identifiers, provider references, or payment keys in ad hoc logs.

## 8. Rollback

1. Set `APP_COMMERCE_ENABLED` false and restart the backend.
2. Confirm all applications return legacy-free compatibility while existing order, license, ledger, and settlement rows remain intact.
3. Restore the prior backend/frontend release if the issue is not feature-flag isolated.
4. Revert migrations only when the release created no production commerce rows and the database backup has been verified.
5. Never delete paid orders, licenses, immutable ledger rows, or settlement history as a rollback shortcut.

## 9. Cleanup And Sign-Off

1. Confirm the disposable live-gate database no longer exists.
2. Confirm the leased Redis logical database is empty and its owner key is gone.
3. Remove disposable upload, package, and public artifacts created by the gate.
4. Record the deployed commit, migration result, deterministic gates, disposable live result, internal smoke result, observation result, and rollback owner.
5. Keep application commerce disabled if any cleanup, callback, tenant isolation, runtime invalidation, refund, or settlement evidence is incomplete.
