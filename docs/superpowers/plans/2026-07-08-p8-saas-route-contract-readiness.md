# P8 SaaS Route Contract Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an automated frontend readiness gate that prevents SaaS signup and tenant/platform SaaS route-component mappings from drifting into 404 or wrong-page states.

**Architecture:** Keep this as a dependency-free TypeScript verifier under `web/scripts`, consistent with the existing SaaS readiness scripts. The verifier checks the public `/saas/signup` static route directly loads the SaaS signup page, confirms the dynamic component loader still supports SaaS menu component paths, and validates every critical tenant/platform SaaS route maps to an existing Vue page.

**Tech Stack:** Node.js, TypeScript, tsx, Vite/Vue static route source, existing `pnpm.cmd run verify:saas-readiness` runner.

## Global Constraints

- Do not add browser/E2E dependencies in this phase.
- Do not change invoice functionality; invoices remain out of scope.
- Preserve existing SaaS route paths: `/saas/signup`, `/tenant-saas/*`, `/saas-platform/*`.
- Use `pnpm.cmd` on Windows PowerShell.
- Use TDD: add the failing route-contract verifier before changing production route source.

---

### Task 1: Add Frontend Route Contract Verifier

**Files:**
- Create: `web/scripts/verify-saas-route-contract.ts`
- Modify: `web/scripts/run-saas-readiness.ts`
- Modify: `web/scripts/verify-saas-readiness-command.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: `web/src/router/routes/staticRoutes.ts`, `web/src/router/core/ComponentLoader.ts`, and SaaS page files under `web/src/views/saas`.
- Produces: a new command `pnpm.cmd exec tsx scripts/verify-saas-route-contract.ts`, included in `pnpm.cmd run verify:saas-readiness`.

- [ ] **Step 1: Write the failing verifier**

Create `web/scripts/verify-saas-route-contract.ts` with these checks:

```typescript
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const failures: string[] = []
const webRoot = process.cwd()

type RouteContract = {
  routePath: string
  componentPath: string
  pageFile: string
}

const criticalRoutes: RouteContract[] = [
  { routePath: '/saas-platform/tenants', componentPath: '/saas/platform/tenant', pageFile: 'src/views/saas/platform/tenant/index.vue' },
  { routePath: '/saas-platform/plans', componentPath: '/saas/platform/plan', pageFile: 'src/views/saas/platform/plan/index.vue' },
  { routePath: '/saas-platform/module', componentPath: '/saas/platform/module', pageFile: 'src/views/saas/platform/module/index.vue' },
  { routePath: '/saas-platform/subscription', componentPath: '/saas/platform/subscription', pageFile: 'src/views/saas/platform/subscription/index.vue' },
  { routePath: '/saas-platform/usage', componentPath: '/saas/platform/usage', pageFile: 'src/views/saas/platform/usage/index.vue' },
  { routePath: '/saas-platform/revenue', componentPath: '/saas/platform/revenue', pageFile: 'src/views/saas/platform/revenue/index.vue' },
  { routePath: '/saas-platform/resource-packs', componentPath: '/saas/platform/resource-pack', pageFile: 'src/views/saas/platform/resource-pack/index.vue' },
  { routePath: '/saas-platform/resource-pack-orders', componentPath: '/saas/platform/resource-pack-order', pageFile: 'src/views/saas/platform/resource-pack-order/index.vue' },
  { routePath: '/saas-platform/payment-config', componentPath: '/saas/platform/payment-config', pageFile: 'src/views/saas/platform/payment-config/index.vue' },
  { routePath: '/tenant-saas/usage', componentPath: '/saas/tenant/usage', pageFile: 'src/views/saas/tenant/usage/index.vue' },
  { routePath: '/tenant-saas/plan', componentPath: '/saas/tenant/plan', pageFile: 'src/views/saas/tenant/plan/index.vue' },
  { routePath: '/tenant-saas/modules', componentPath: '/saas/tenant/modules/index', pageFile: 'src/views/saas/tenant/modules/index.vue' },
  { routePath: '/tenant-saas/members', componentPath: '/saas/tenant/member', pageFile: 'src/views/saas/tenant/member/index.vue' },
  { routePath: '/tenant-saas/resource-packs', componentPath: '/saas/tenant/resource-pack', pageFile: 'src/views/saas/tenant/resource-pack/index.vue' }
]

function readFile(path: string): string {
  const fullPath = resolve(webRoot, path)
  if (!existsSync(fullPath)) {
    failures.push(`${path} must exist`)
    return ''
  }
  return readFileSync(fullPath, 'utf8')
}

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function assertIncludes(source: string, token: string, label: string) {
  assert(source.includes(token), `${label} must include ${token}`)
}

function componentExists(componentPath: string) {
  const normalized = componentPath.replace(/^\/+/, '')
  return (
    existsSync(resolve(webRoot, 'src/views', `${normalized}.vue`)) ||
    existsSync(resolve(webRoot, 'src/views', normalized, 'index.vue'))
  )
}

function extractRouteBlock(source: string, routePath: string): string {
  const pathIndex = source.indexOf(`path: '${routePath}'`)
  if (pathIndex === -1) return ''
  const blockStart = source.lastIndexOf('{', pathIndex)
  const nextRouteStart = source.indexOf('\n  {', pathIndex + routePath.length)
  return source.slice(blockStart, nextRouteStart === -1 ? source.indexOf('\n]', pathIndex) : nextRouteStart)
}

const staticRoutesSource = readFile('src/router/routes/staticRoutes.ts')
const saasSignupRoute = extractRouteBlock(staticRoutesSource, '/saas/signup')
assert(saasSignupRoute.length > 0, 'static routes must define /saas/signup')
assertIncludes(saasSignupRoute, "name: 'SaasSignup'", '/saas/signup route')
assertIncludes(saasSignupRoute, "import('@views/saas/signup/index.vue')", '/saas/signup route')
assert(!saasSignupRoute.includes("@views/auth/register/index.vue"), '/saas/signup route must not load the generic auth register wrapper')

const componentLoaderSource = readFile('src/router/core/ComponentLoader.ts')
assertIncludes(componentLoaderSource, "import.meta.glob", 'ComponentLoader')
assertIncludes(componentLoaderSource, '../../views/**/*.vue', 'ComponentLoader')
assertIncludes(componentLoaderSource, 'fullPathWithIndex', 'ComponentLoader')

for (const route of criticalRoutes) {
  assert(existsSync(resolve(webRoot, route.pageFile)), `${route.routePath} page file must exist at ${route.pageFile}`)
  assert(componentExists(route.componentPath), `${route.routePath} component ${route.componentPath} must be loadable`)
}

const signupPage = readFile('src/views/saas/signup/index.vue')
assertIncludes(signupPage, 'signupTenant', 'SaaS signup page')
assertIncludes(signupPage, "name: 'Login'", 'SaaS signup page redirect')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS route contract verified.')
```

- [ ] **Step 2: Run the verifier to verify RED**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-route-contract.ts
```

Expected: FAIL with `/saas/signup route must include import('@views/saas/signup/index.vue')` because the current route imports `@views/auth/register/index.vue`.

- [ ] **Step 3: Wire the new verifier into readiness**

Add `verify-saas-route-contract.ts` to `web/scripts/run-saas-readiness.ts` after `verify-saas-launch-flow-readiness.ts`.

Add it to the `expectedScripts` list in `web/scripts/verify-saas-readiness-command.ts` in the same position.

Add the command to `docs/saas-launch-readiness-checklist.md` under Expanded frontend gates.

- [ ] **Step 4: Run the command verifier**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: PASS once the runner/checklist references are in sync.

### Task 2: Make the SaaS Signup Static Route Explicit

**Files:**
- Modify: `web/src/router/routes/staticRoutes.ts`

**Interfaces:**
- Consumes: static Vue router definitions.
- Produces: `/saas/signup` directly renders `@views/saas/signup/index.vue`.

- [ ] **Step 1: Update the route component**

Change only the `/saas/signup` route:

```typescript
{
  path: '/saas/signup',
  name: 'SaasSignup',
  component: () => import('@views/saas/signup/index.vue'),
  meta: { title: 'menus.register.title', isHideTab: true }
}
```

Leave `/auth/register` pointing to `@views/auth/register/index.vue` so the existing general registration alias continues to work.

- [ ] **Step 2: Run the route contract verifier to verify GREEN**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-route-contract.ts
```

Expected: PASS with `SaaS route contract verified.`

### Task 3: Full P8 Verification and Review

**Files:**
- No additional production files.

**Interfaces:**
- Consumes: all changed scripts and route source.
- Produces: local commit if all gates pass.

- [ ] **Step 1: Run frontend SaaS readiness**

Run:

```powershell
cd web
pnpm.cmd run verify:saas-readiness
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run:

```powershell
cd web
pnpm.cmd build
```

Expected: PASS.

- [ ] **Step 3: Run full repository readiness**

Run:

```powershell
node scripts/run-saas-readiness.cjs
```

Expected: PASS.

- [ ] **Step 4: Review diff and whitespace**

Run:

```powershell
git diff --check
git diff -- web/scripts/verify-saas-route-contract.ts web/scripts/run-saas-readiness.ts web/scripts/verify-saas-readiness-command.ts web/src/router/routes/staticRoutes.ts docs/saas-launch-readiness-checklist.md
```

Expected: no whitespace errors; diff limited to P8 route contract readiness.

- [ ] **Step 5: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-08-p8-saas-route-contract-readiness.md docs/saas-launch-readiness-checklist.md web/scripts/verify-saas-route-contract.ts web/scripts/run-saas-readiness.ts web/scripts/verify-saas-readiness-command.ts web/src/router/routes/staticRoutes.ts
git commit -m "test: add saas route contract readiness"
```

## Self-Review

- Spec coverage: The plan covers the highest-priority discovered route gap: SaaS signup should render the SaaS tenant signup page directly, and critical SaaS route components should stay loadable.
- Placeholder scan: No placeholders or future-only tasks remain.
- Type consistency: `RouteContract.routePath`, `componentPath`, and `pageFile` are consistently used across the verifier.
