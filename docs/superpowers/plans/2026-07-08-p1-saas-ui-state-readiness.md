# P1 SaaS UI State Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a P1 frontend readiness gate that verifies critical SaaS platform pages expose loading, empty, and recoverable error states, then fix the highest-value gaps.

**Architecture:** Keep this phase frontend-only and non-invasive. Add one static verification script under `web/scripts` and use small Element Plus state affordances on the existing platform list pages without changing API contracts, backend behavior, routes, or database schema.

**Tech Stack:** Vue 3, Element Plus, TypeScript, tsx verification scripts, Vite, pnpm.

## Global Constraints

- Worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.
- Branch: `saas-order-risk-ops`.
- Do not push to remote.
- Do not add invoice functionality.
- Do not change backend payment, permission, tenant, module, or subscription logic.
- Avoid broad visual redesign; keep the existing compact admin-console UI.
- Use TDD or verification-first scripts before production changes.
- Use `apply_patch` for manual edits.
- Use `pnpm.cmd` on Windows PowerShell.

---

## File Structure

- Create: `web/scripts/verify-saas-ui-state-readiness.ts`
  - Responsibility: statically verify critical SaaS platform pages include table empty states, load error state, retry affordance, and user-facing error messages.
- Modify: `web/src/views/saas/platform/plan/index.vue`
  - Responsibility: add load error state and empty table copy to the platform plan list.
- Modify: `web/src/views/saas/platform/module/index.vue`
  - Responsibility: add load error state and empty table copy to the module catalog list.
- Modify: `web/src/views/saas/platform/resource-pack/index.vue`
  - Responsibility: add load error state and empty table copy to the platform resource-pack catalog list.
- Modify: `web/src/views/saas/platform/resource-pack-order/index.vue`
  - Responsibility: add load error state and empty table copy to the platform resource-pack order list and detail fetch.
- Modify: `docs/saas-launch-readiness-checklist.md`
  - Responsibility: add the new automated P1 UI state gate to release/demo commands.

---

## Task 1: Add UI State Verification Script

**Files:**
- Create: `web/scripts/verify-saas-ui-state-readiness.ts`

**Interfaces:**
- Consumes: `web/src/views/saas/platform/{plan,module,resource-pack,resource-pack-order}/index.vue`.
- Produces: CLI command `pnpm.cmd exec tsx scripts/verify-saas-ui-state-readiness.ts`.

- [x] **Step 1: Write the failing verification script**

Create `web/scripts/verify-saas-ui-state-readiness.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type PageExpectation = {
  file: string
  label: string
  blockClass: string
  loadFunction: string
  emptyText: string
  errorText: string
}

const pages: PageExpectation[] = [
  {
    file: 'src/views/saas/platform/plan/index.vue',
    label: 'platform plan page',
    blockClass: 'saas-plan-page__load-error',
    loadFunction: 'loadPlans',
    emptyText: '暂无套餐数据',
    errorText: '套餐列表加载失败'
  },
  {
    file: 'src/views/saas/platform/module/index.vue',
    label: 'platform module page',
    blockClass: 'saas-module-page__load-error',
    loadFunction: 'loadModules',
    emptyText: '暂无模块数据',
    errorText: '模块列表加载失败'
  },
  {
    file: 'src/views/saas/platform/resource-pack/index.vue',
    label: 'platform resource pack page',
    blockClass: 'saas-resource-pack-page__load-error',
    loadFunction: 'loadResourcePacks',
    emptyText: '暂无资源包数据',
    errorText: '资源包列表加载失败'
  },
  {
    file: 'src/views/saas/platform/resource-pack-order/index.vue',
    label: 'platform resource pack order page',
    blockClass: 'saas-resource-pack-order-page__load-error',
    loadFunction: 'loadOrders',
    emptyText: '暂无资源包订单',
    errorText: '资源包订单加载失败'
  }
]

const failures: string[] = []

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function assertIncludes(source: string, token: string, label: string) {
  if (!source.includes(token)) {
    failures.push(`${label} must include ${token}`)
  }
}

for (const page of pages) {
  const source = readProjectFile(page.file)
  assertIncludes(source, 'const loadError = ref', page.label)
  assertIncludes(source, page.blockClass, page.label)
  assertIncludes(source, '<template #empty>', page.label)
  assertIncludes(source, `<ElEmpty description="${page.emptyText}"`, page.label)
  assertIncludes(source, page.errorText, page.label)
  assertIncludes(source, 'catch (error)', page.label)
  assertIncludes(source, 'ElMessage.error(loadError.value)', page.label)
  assertIncludes(source, `@click="${page.loadFunction}"`, page.label)
}

const checklist = readFileSync(resolve(process.cwd(), '../docs/saas-launch-readiness-checklist.md'), 'utf8')
assertIncludes(checklist, 'verify-saas-ui-state-readiness.ts', 'launch readiness checklist')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS UI state readiness verified.')
```

- [x] **Step 2: Run RED verification**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-ui-state-readiness.ts
```

Expected: FAIL because the script is new and the target pages do not yet expose all required state markers.

---

## Task 2: Add Platform Page State Gaps

**Files:**
- Modify: `web/src/views/saas/platform/plan/index.vue`
- Modify: `web/src/views/saas/platform/module/index.vue`
- Modify: `web/src/views/saas/platform/resource-pack/index.vue`
- Modify: `web/src/views/saas/platform/resource-pack-order/index.vue`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Produces: a `loadError` ref in each page.
- Produces: an inline error alert block with a retry button.
- Produces: `ElTable` empty slots with page-specific empty copy.
- Produces: `ElMessage.error(loadError.value)` inside each primary list load failure path.

- [x] **Step 1: Add `loadError` state**

In each target page, add near `loading`:

```ts
const loadError = ref('')
```

- [x] **Step 2: Add recoverable error block above the table**

Use the page-specific class and load method, for example in the plan page:

```vue
<div v-if="loadError" class="saas-plan-page__load-error">
  <ElAlert type="error" :title="loadError" show-icon :closable="false" />
  <ElButton size="small" type="primary" link :loading="loading" @click="loadPlans">重试</ElButton>
</div>
```

- [x] **Step 3: Add table empty slots**

Use page-specific empty copy, for example:

```vue
<template #empty>
  <ElEmpty description="暂无套餐数据" />
</template>
```

- [x] **Step 4: Handle list load failures**

In each primary load function, clear the error before request and catch failures:

```ts
loadError.value = ''
try {
  // existing request
} catch (error) {
  console.error('[SaasPlatformPlanPage] load plans failed:', error)
  loadError.value = '套餐列表加载失败'
  ElMessage.error(loadError.value)
} finally {
  loading.value = false
}
```

- [x] **Step 5: Add lightweight styles**

Add a page-specific `__load-error` style:

```css
.saas-plan-page__load-error {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
```

- [x] **Step 6: Add checklist gate**

Add this command to `docs/saas-launch-readiness-checklist.md` under frontend automated gates:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-ui-state-readiness.ts
```

---

## Task 3: Verify, Review, Commit

**Files:**
- Test: `web/scripts/verify-saas-ui-state-readiness.ts`
- Test: changed Vue files.
- Test: `docs/saas-launch-readiness-checklist.md`.

- [x] **Step 1: Run UI state readiness verification**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-ui-state-readiness.ts
```

Expected: PASS with `SaaS UI state readiness verified.`

- [x] **Step 2: Run launch readiness verification**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-launch-flow-readiness.ts
```

Expected: PASS.

- [x] **Step 3: Run frontend build**

Run from `web`:

```powershell
pnpm.cmd build
```

Expected: PASS.

- [x] **Step 4: Review diff**

Run from repo root:

```powershell
git diff --check
git diff --stat
git diff -- docs/superpowers/plans/2026-07-08-p1-saas-ui-state-readiness.md docs/saas-launch-readiness-checklist.md web/scripts/verify-saas-ui-state-readiness.ts web/src/views/saas/platform/plan/index.vue web/src/views/saas/platform/module/index.vue web/src/views/saas/platform/resource-pack/index.vue web/src/views/saas/platform/resource-pack-order/index.vue
```

Expected: only P1 UI state readiness files are changed.

- [x] **Step 5: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-08-p1-saas-ui-state-readiness.md docs/saas-launch-readiness-checklist.md web/scripts/verify-saas-ui-state-readiness.ts web/src/views/saas/platform/plan/index.vue web/src/views/saas/platform/module/index.vue web/src/views/saas/platform/resource-pack/index.vue web/src/views/saas/platform/resource-pack-order/index.vue
git commit -m "feat: add saas ui state readiness gate"
```

Expected: commit created on `saas-order-risk-ops` without pushing.

## Self-Review

- Spec coverage: covers P1 UX state visibility for the highest-risk SaaS platform list pages and adds the release gate to the checklist.
- Placeholder scan: no TODO/TBD/deferred implementation steps.
- Type consistency: `loadError`, `ElMessage.error(loadError.value)`, page-specific `__load-error` classes, and page load methods are consistent with verification script tokens.
