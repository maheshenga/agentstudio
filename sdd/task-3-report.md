# Task 3 Report: Tenant Provisioning Service

## Scope

Implemented Task 3 in `server/src/module/saas` by adding:

- `dto/signup.dto.ts`
- `dto/tenant-provision.dto.ts`
- `services/saas-provisioning.service.ts`
- `services/saas-provisioning.service.spec.ts`
- `saas.module.ts` update to register/export `SaasProvisioningService`

I preserved unrelated dirty and untracked files already present in the worktree.

## Requirements Summary

Delivered:

- `SaasProvisioningService.signup(dto: SaasSignupDto): Promise<{ userId: number; tenantId: number }>`
- `SaasProvisioningService.createTenantFromPlatform(dto: TenantProvisionDto): Promise<{ userId: number; tenantId: number }>`
- TypeORM transaction for user/tenant/membership/role/subscription/trial creation
- password hashing with `bcryptjs`
- generated tenant code from a sanitized prefix plus timestamp when no explicit code is provided
- default tenant roles: `owner`, `admin`, `member`
- owner role assignment to the provisioned user
- free active subscription creation
- 14-day trial creation
- quota initialization through `SaasQuotaService.initializeTenantQuota(tenantId, freePlan.id)`

## TDD Evidence

### RED

Command:

```powershell
pnpm run test -- saas-provisioning.service.spec.ts --runInBand
```

Result:

- Exit code: `1`
- Failure cause: missing module `./saas-provisioning.service`

Observed failure excerpt:

```text
TS2307: Cannot find module './saas-provisioning.service' or its corresponding type declarations.
```

This confirmed the new spec was genuinely testing behavior that did not yet exist.

### GREEN

Command:

```powershell
pnpm run test -- saas-provisioning.service.spec.ts --runInBand
```

Result:

- Exit code: `0`
- `2` tests passed

Observed success summary:

```text
PASS src/module/saas/services/saas-provisioning.service.spec.ts
Tests: 2 passed, 2 total
```

## Verification

### Focused test

Command:

```powershell
pnpm run test -- saas-provisioning.service.spec.ts --runInBand
```

Result:

- Exit code: `0`

### TypeScript compile

Command:

```powershell
pnpm exec tsc --noEmit
```

Result:

- Exit code: `0`

## Files Changed

- `server/src/module/saas/dto/signup.dto.ts`
- `server/src/module/saas/dto/tenant-provision.dto.ts`
- `server/src/module/saas/services/saas-provisioning.service.ts`
- `server/src/module/saas/services/saas-provisioning.service.spec.ts`
- `server/src/module/saas/saas.module.ts`

## Implementation Notes

- `signup()` maps self-service registration data into the shared provisioning flow.
- `createTenantFromPlatform()` maps platform-side owner + tenant inputs into the same flow.
- The provisioning flow:
  1. loads the free plan from `SaasPlanService`
  2. hashes the password
  3. creates the user
  4. creates the tenant
  5. creates the user-tenant membership
  6. creates `Owner`, `Admin`, and `Member` roles
  7. assigns the owner role to the new user
  8. creates an active free subscription
  9. creates a 14-day trial
  10. initializes quota after the transaction completes

## Self-Review

- The service is narrowly scoped and does not modify existing system user or tenant services.
- DTOs follow the repo's current Swagger/class-validator style.
- The focused spec verifies the key orchestration outputs and payloads, including:
  - hashed password usage
  - generated tenant code shape
  - owner role assignment
  - subscription/trial creation
  - quota initialization
- `saas.module.ts` change is minimal and limited to provider registration/export.

## Concerns

- `TenantProvisionDto.plan_code` is present in the task brief, but current Task 2 service support only exposes `getFreePlan()`. This implementation provisions the free plan for both flows, which matches the brief's subscription requirement but does not yet branch on `plan_code`.
- Quota initialization currently runs after the transaction completes because `SaasQuotaService` uses its own repositories and no transactional interface was provided. This keeps the orchestration simple and type-safe, but quota creation is not part of the same DB transaction boundary.

## Commit

Created commit:

```text
feat: add SaaS tenant provisioning
```
