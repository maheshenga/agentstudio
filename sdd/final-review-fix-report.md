Final Review Fix Report

Fixed findings:
- Tenant owner/admin/member roles now receive baseline SaaS menus and permissions during provisioning.
- Tenant menu seed paths now point at the implemented tenant plan and usage views.
- Platform SaaS menu component paths now resolve to frontend views.
- Tenant subscription API now returns the summary fields consumed by the plan page.
- Platform tenant provisioning now honors non-free plan_code values for subscription and quota initialization.

Verification:
- server: pnpm run test -- saas --runInBand
  Result: 4 suites passed, 9 tests passed.
- server: pnpm exec tsc --noEmit
  Result: passed.
- web: pnpm exec vue-tsc --noEmit
  Result: passed.
