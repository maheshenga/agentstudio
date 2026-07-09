# P0 Local Stability Checklist

This checklist records the current P0 baseline for the SaaS/Admin/AI system.

## Scope

- Keep active SaaS/Admin user-facing files free of common mojibake text.
- Ensure seeded SaaS menu routes map to real Vue pages.
- Verify backend tests, backend build, and frontend build before a stability commit.
- Do not include local index folders or dependency lock noise unless intentionally changed.

## Route Baseline

Tenant SaaS pages:

- `/#/tenant-saas/usage`
- `/#/tenant-saas/plan`
- `/#/tenant-saas/members`
- `/#/tenant-saas/modules`
- `/#/tenant-saas/resource-packs`

Platform SaaS pages:

- `/#/saas-platform/usage`
- `/#/saas-platform/tenants`
- `/#/saas-platform/plans`
- `/#/saas-platform/module`
- `/#/saas-platform/subscription`
- `/#/saas-platform/resource-packs`
- `/#/saas-platform/resource-pack-orders`
- `/#/saas-platform/payment-config`
- `/#/saas-platform/revenue`

## Verification Commands

Backend focused P0 audits:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-visible-text-encoding.spec.ts src/module/saas/saas-route-consistency.spec.ts src/migration-specs/align-saas-resource-pack-order-menu.spec.ts --runInBand
```

Backend full verification:

```powershell
cd server
pnpm.cmd exec jest --runInBand
pnpm.cmd run build
```

Frontend build:

```powershell
cd web
pnpm.cmd run build
```

## Known Local Exclusions

These files/directories are local tooling or dependency state and should not be staged by a P0 stability commit unless explicitly requested:

- `.codebase-memory/`
- `.codegraph/`
- `server/pnpm-lock.yaml`
- `server/node_modules/`
- `web/node_modules/`
- `server/dist/`
- `web/dist/`
