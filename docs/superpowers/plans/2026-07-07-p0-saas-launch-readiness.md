# P0 SaaS Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the highest-risk SaaS launch blockers in tenant provisioning permissions, public signup validation, and public signup routing.

**Architecture:** Keep changes narrow and compatible with the current NestJS + Vue codebase. Backend provisioning keeps using seeded menu slugs and existing Jest tests. Frontend signup policy is centralized in a tiny utility so validation behavior can be tested without adding a full frontend test runner.

**Tech Stack:** NestJS, TypeORM, Jest, Vue 3, Element Plus, TypeScript, tsx.

## Global Constraints

- Worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.
- Do not change unrelated modules or rewrite SaaS pages.
- Use TDD: add a failing test or verification script before production code.
- Use `pnpm.cmd` on Windows for package scripts.
- Keep public signup password policy aligned with backend: 8 to 100 characters, at least one letter and one digit.
- Do not push to remote.

---

## File Structure

- Modify: `server/src/module/saas/services/saas-provisioning.service.ts`
  - Responsibility: grant default SaaS tenant owner/admin role menus and permissions during tenant provisioning.
- Modify: `server/src/module/saas/services/saas-provisioning.service.spec.ts`
  - Responsibility: prove new tenants get complete member mutation permissions.
- Create: `web/src/utils/saas/signup-password-policy.ts`
  - Responsibility: expose signup password constants, regex, localized messages, and a predicate usable by Vue forms and scripts.
- Modify: `web/src/views/saas/signup/index.vue`
  - Responsibility: use the shared signup password policy in public tenant signup validation and copy.
- Create: `web/scripts/verify-saas-signup-password-policy.ts`
  - Responsibility: executable frontend regression check for password policy behavior and signup page usage.
- Modify: `web/src/router/routes/staticRoutes.ts`
  - Responsibility: expose `/saas/signup` as a public route alias to the existing register page.
- Create: `web/scripts/verify-saas-signup-route.ts`
  - Responsibility: executable regression check that `/saas/signup` is a public static route pointing to register.

---

## Task 1: Complete New Tenant Member Permissions

**Files:**
- Modify: `server/src/module/saas/services/saas-provisioning.service.spec.ts`
- Modify: `server/src/module/saas/services/saas-provisioning.service.ts`

**Interfaces:**
- Consumes: `TENANT_OWNER_ADMIN_PERMISSION_SLUGS` inside `saas-provisioning.service.ts`.
- Produces: owner/admin role menu rows for `tenant:member:update`, `tenant:member:remove`, and `tenant:member:reset-password`.

- [ ] **Step 1: Write the failing test**

Add these menu records to `tenantMenuRecords` in `saas-provisioning.service.spec.ts`:

```ts
{ id: 518, code: null, slug: 'tenant:member:update' },
{ id: 519, code: null, slug: 'tenant:member:remove' },
{ id: 520, code: null, slug: 'tenant:member:reset-password' },
```

Add these expected rows to the first provisioning test:

```ts
{ roleId: 301, menuId: 518 },
{ roleId: 301, menuId: 519 },
{ roleId: 301, menuId: 520 },
{ roleId: 302, menuId: 518 },
{ roleId: 302, menuId: 519 },
{ roleId: 302, menuId: 520 },
```

Add member negative assertions:

```ts
{ roleId: 303, menuId: 518 },
{ roleId: 303, menuId: 519 },
{ roleId: 303, menuId: 520 },
```

- [ ] **Step 2: Run test to verify it fails**

Run from `server`:

```powershell
pnpm.cmd test -- saas-provisioning.service.spec.ts --runInBand --forceExit
```

Expected: FAIL because owner/admin rows for menu IDs `518`, `519`, and `520` are missing.

- [ ] **Step 3: Write minimal implementation**

Add these slugs to `TENANT_OWNER_ADMIN_PERMISSION_SLUGS` in `saas-provisioning.service.ts` immediately after `tenant:member:create`:

```ts
'tenant:member:update',
'tenant:member:remove',
'tenant:member:reset-password',
```

- [ ] **Step 4: Run test to verify it passes**

Run from `server`:

```powershell
pnpm.cmd test -- saas-provisioning.service.spec.ts --runInBand --forceExit
```

Expected: PASS.

---

## Task 2: Align Public Signup Password Policy

**Files:**
- Create: `web/src/utils/saas/signup-password-policy.ts`
- Create: `web/scripts/verify-saas-signup-password-policy.ts`
- Modify: `web/src/views/saas/signup/index.vue`

**Interfaces:**
- Produces: `SIGNUP_PASSWORD_MIN_LENGTH`, `SIGNUP_PASSWORD_MAX_LENGTH`, `SIGNUP_PASSWORD_PATTERN`, `SIGNUP_PASSWORD_MESSAGE`, `SIGNUP_PASSWORD_MESSAGE_EN`, and `isStrongSignupPassword(password: string): boolean`.
- Consumes: the public signup Vue form uses the shared policy constants and pattern.

- [ ] **Step 1: Write the failing verification script**

Create `web/scripts/verify-saas-signup-password-policy.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  SIGNUP_PASSWORD_MAX_LENGTH,
  SIGNUP_PASSWORD_MESSAGE,
  SIGNUP_PASSWORD_MESSAGE_EN,
  SIGNUP_PASSWORD_MIN_LENGTH,
  isStrongSignupPassword
} from '../src/utils/saas/signup-password-policy'

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

assert(SIGNUP_PASSWORD_MIN_LENGTH === 8, 'signup password minimum length must be 8')
assert(SIGNUP_PASSWORD_MAX_LENGTH === 100, 'signup password maximum length must be 100')
assert(!isStrongSignupPassword('123456'), 'numeric 6-character password must be rejected')
assert(!isStrongSignupPassword('12345678'), 'numeric-only 8-character password must be rejected')
assert(!isStrongSignupPassword('abcdefgh'), 'letter-only 8-character password must be rejected')
assert(isStrongSignupPassword('abc12345'), 'letter+digit 8-character password must be accepted')
assert(SIGNUP_PASSWORD_MESSAGE.includes('8') && SIGNUP_PASSWORD_MESSAGE.includes('字母') && SIGNUP_PASSWORD_MESSAGE.includes('数字'), 'Chinese signup copy must describe the policy')
assert(SIGNUP_PASSWORD_MESSAGE_EN.includes('8') && SIGNUP_PASSWORD_MESSAGE_EN.includes('letter') && SIGNUP_PASSWORD_MESSAGE_EN.includes('number'), 'English signup copy must describe the policy')

const signupVue = readFileSync(resolve(process.cwd(), 'src/views/saas/signup/index.vue'), 'utf8')
assert(signupVue.includes("from '@/utils/saas/signup-password-policy'"), 'signup page must import shared password policy')
assert(!signupVue.includes('PASSWORD_MIN_LENGTH = 6'), 'signup page must not keep stale 6-character policy')
```

- [ ] **Step 2: Run verification to confirm it fails**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-signup-password-policy.ts
```

Expected: FAIL because `web/src/utils/saas/signup-password-policy.ts` does not exist yet.

- [ ] **Step 3: Write minimal shared policy**

Create `web/src/utils/saas/signup-password-policy.ts`:

```ts
export const SIGNUP_PASSWORD_MIN_LENGTH = 8
export const SIGNUP_PASSWORD_MAX_LENGTH = 100
export const SIGNUP_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/
export const SIGNUP_PASSWORD_MESSAGE = '密码长度需在 8 到 100 个字符之间，且必须包含字母和数字'
export const SIGNUP_PASSWORD_MESSAGE_EN = 'Password must be 8 to 100 characters and include at least one letter and one number'

export function isStrongSignupPassword(password: string) {
  return SIGNUP_PASSWORD_PATTERN.test(String(password || ''))
}
```

- [ ] **Step 4: Use policy in signup page**

Modify `web/src/views/saas/signup/index.vue`:

```ts
import {
  SIGNUP_PASSWORD_MAX_LENGTH,
  SIGNUP_PASSWORD_MESSAGE,
  SIGNUP_PASSWORD_MESSAGE_EN,
  SIGNUP_PASSWORD_MIN_LENGTH,
  SIGNUP_PASSWORD_PATTERN
} from '@/utils/saas/signup-password-policy'
```

Replace the local password constants with:

```ts
const PASSWORD_MIN_LENGTH = SIGNUP_PASSWORD_MIN_LENGTH
const PASSWORD_MAX_LENGTH = SIGNUP_PASSWORD_MAX_LENGTH
```

Replace password copy with `SIGNUP_PASSWORD_MESSAGE` and `SIGNUP_PASSWORD_MESSAGE_EN`.

Replace the password rule with:

```ts
{
  pattern: SIGNUP_PASSWORD_PATTERN,
  message: copy.value.rule.passwordLength,
  trigger: 'blur'
}
```

- [ ] **Step 5: Run verification to confirm it passes**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-signup-password-policy.ts
```

Expected: PASS.

---

## Task 3: Add Public `/saas/signup` Route Alias

**Files:**
- Create: `web/scripts/verify-saas-signup-route.ts`
- Modify: `web/src/router/routes/staticRoutes.ts`

**Interfaces:**
- Produces: public static route path `/saas/signup`.
- Consumes: existing `@views/auth/register/index.vue` component and `Register` page implementation.

- [ ] **Step 1: Write the failing verification script**

Create `web/scripts/verify-saas-signup-route.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

const source = readFileSync(resolve(process.cwd(), 'src/router/routes/staticRoutes.ts'), 'utf8')
const routeBlockMatch = source.match(/\{\s*path:\s*'\/saas\/signup'[\s\S]*?\n\s*\}/)

assert(routeBlockMatch, 'staticRoutes must define /saas/signup')

const routeBlock = routeBlockMatch![0]
assert(routeBlock.includes("name: 'SaasSignup'"), 'route alias must have stable name SaasSignup')
assert(routeBlock.includes("@views/auth/register/index.vue"), 'route alias must reuse register page')
assert(routeBlock.includes('isHideTab: true'), 'route alias must hide worktab')
```

- [ ] **Step 2: Run verification to confirm it fails**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-signup-route.ts
```

Expected: FAIL because `/saas/signup` is not in `staticRoutes.ts`.

- [ ] **Step 3: Add route alias**

Insert this route after `/auth/register`:

```ts
{
  path: '/saas/signup',
  name: 'SaasSignup',
  component: () => import('@views/auth/register/index.vue'),
  meta: { title: 'menus.register.title', isHideTab: true }
},
```

- [ ] **Step 4: Run verification to confirm it passes**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-signup-route.ts
```

Expected: PASS.

---

## Final Verification

- [ ] Run backend focused tests:

```powershell
pnpm.cmd test -- saas-provisioning.service.spec.ts signup.dto.spec.ts --runInBand --forceExit
```

- [ ] Run frontend focused verifications:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-signup-password-policy.ts
pnpm.cmd exec tsx scripts/verify-saas-signup-route.ts
```

- [ ] Run frontend build:

```powershell
pnpm.cmd build
```

- [ ] Review diff:

```powershell
git diff -- server/src/module/saas/services/saas-provisioning.service.ts server/src/module/saas/services/saas-provisioning.service.spec.ts web/src/utils/saas/signup-password-policy.ts web/src/views/saas/signup/index.vue web/src/router/routes/staticRoutes.ts web/scripts/verify-saas-signup-password-policy.ts web/scripts/verify-saas-signup-route.ts docs/superpowers/plans/2026-07-07-p0-saas-launch-readiness.md
```

- [ ] Commit:

```powershell
git add server/src/module/saas/services/saas-provisioning.service.ts server/src/module/saas/services/saas-provisioning.service.spec.ts web/src/utils/saas/signup-password-policy.ts web/src/views/saas/signup/index.vue web/src/router/routes/staticRoutes.ts web/scripts/verify-saas-signup-password-policy.ts web/scripts/verify-saas-signup-route.ts docs/superpowers/plans/2026-07-07-p0-saas-launch-readiness.md
git commit -m "fix: close p0 saas launch readiness gaps"
```

