# P2 SaaS Tenant UI State Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a tenant-side UI state readiness gate and close the remaining tenant module page error-feedback gap.

**Architecture:** Keep this as a narrow frontend readiness slice. Add one static verification script under `web/scripts` that checks tenant SaaS pages for loading, empty, and recoverable error-state wiring. Only change the tenant modules page because usage, plan, member, and resource-pack pages already expose the needed state surfaces.

**Tech Stack:** Vue 3, Element Plus, TypeScript, tsx, pnpm.

## Global Constraints

- Worktree: `E:\\code\\agentstudio\\FssAdmin_NestJs\\.worktrees\\saas-order-risk-ops`.
- Do not push to remote.
- Do not change backend, database, payment, tenant entitlement, or permission logic.
- Keep edits scoped to tenant SaaS UI state readiness.
- Use verification-first: add the script, run it red, then implement minimal UI changes.
- Keep new script and plan mostly ASCII to avoid Windows terminal encoding confusion.
- `apply_patch` is currently blocked by WindowsApps access denial in this session, so file edits are applied with UTF-8-safe Node scripts and verified through diff/tests.

---

## File Structure

- Create: `web/scripts/verify-saas-tenant-ui-state-readiness.ts`
  - Static gate for tenant SaaS page loading, empty, and error-state wiring.
- Modify: `web/src/views/saas/tenant/modules/index.vue`
  - Add recoverable page-level error alert and retry button when tenant modules fail to load.
- Modify: `docs/saas-launch-readiness-checklist.md`
  - Include the new tenant UI state gate in demo/release readiness checks.
- Create: `docs/superpowers/plans/2026-07-08-p2-saas-tenant-ui-state-readiness.md`
  - Capture the P2 plan and execution evidence.

---

### Task 1: Add Tenant UI State Verification Script

**Files:**
- Create: `web/scripts/verify-saas-tenant-ui-state-readiness.ts`

**Interfaces:**
- Produces command: `pnpm.cmd exec tsx scripts/verify-saas-tenant-ui-state-readiness.ts`
- Consumes tenant page source files under `web/src/views/saas/tenant`.

- [x] **Step 1: Write the failing verification script**

Create a script that:
- Checks `tenant/modules/index.vue` for `loadError`, `.tenant-modules-page__load-error`, `ElAlert`, retry via `loadModules`, `ElEmpty`, a console error, and `ElMessage.error(loadError.value)`.
- Fails if `tenant/modules/index.vue` still contains `throw error` in load failure handling.
- Checks `tenant/usage/index.vue` for existing `errorMessage`, `ElResult`, `ElEmpty`, ledger loading, and load failure logging.
- Checks `tenant/plan/index.vue` for existing skeleton, error, empty, order-history loading, and load failure logging.
- Checks `tenant/member/index.vue` for module error, disabled-module empty state, table empty slot, table loading, and load failure logging.
- Checks `tenant/resource-pack/index.vue` for existing skeleton, error, empty, order-history loading, and load failure logging.
- Checks `docs/saas-launch-readiness-checklist.md` for `verify-saas-tenant-ui-state-readiness.ts`.

- [x] **Step 2: Run RED verification**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-tenant-ui-state-readiness.ts
```

Expected: FAIL because the tenant modules page does not yet expose `loadError`, a page-level error alert, and non-throwing load failure handling; the checklist also does not reference this script yet.

---

### Task 2: Add Recoverable Tenant Modules Error State

**Files:**
- Modify: `web/src/views/saas/tenant/modules/index.vue`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Produces `loadError: Ref<string>` in the tenant modules page.
- Produces visible `.tenant-modules-page__load-error` block with `ElAlert` and retry button.
- Produces non-throwing `catch (error)` behavior in `loadModules()`.

- [x] **Step 1: Add load error state**

After `const loading = ref(false)`, add:

```ts
const loadError = ref('')
```

- [x] **Step 2: Render a recoverable error block above the table**

Before `<ElTable v-loading="loading" :data="records" border>`, add:

```vue
<div v-if="loadError" class="tenant-modules-page__load-error">
  <ElAlert type="error" :title="loadError" show-icon :closable="false" />
  <ElButton size="small" type="primary" link :loading="loading" @click="loadModules">Retry</ElButton>
</div>
```

- [x] **Step 3: Handle load failure without rethrowing**

Change `loadModules()` to:

```ts
async function loadModules() {
  loading.value = true
  loadError.value = ''
  try {
    records.value = await fetchTenantSystemModules()
  } catch (error) {
    console.error('[TenantModulesPage] load modules failed:', error)
    records.value = []
    loadError.value = 'Failed to load tenant modules'
    ElMessage.error(loadError.value)
  } finally {
    loading.value = false
  }
}
```

- [x] **Step 4: Add lightweight error layout style**

Add:

```css
.tenant-modules-page__load-error {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
```

- [x] **Step 5: Add checklist gate**

In `docs/saas-launch-readiness-checklist.md`, add after the existing platform UI state gate:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-tenant-ui-state-readiness.ts
```

- [x] **Step 6: Run GREEN verification**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-tenant-ui-state-readiness.ts
```

Expected: PASS with `SaaS tenant UI state readiness verified.`

---

### Task 3: Final Verification, Review, and Commit

**Files:**
- Test: `web/scripts/verify-saas-tenant-ui-state-readiness.ts`
- Test: `web/scripts/verify-saas-ui-state-readiness.ts`
- Test: `web/scripts/verify-saas-launch-flow-readiness.ts`
- Build: `web` production build.

**Interfaces:**
- Produces a local commit on `saas-order-risk-ops`.

- [x] **Step 1: Run focused tenant UI verification**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-tenant-ui-state-readiness.ts
```

Expected: PASS.

- [x] **Step 2: Run platform UI and launch readiness gates**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-ui-state-readiness.ts
pnpm.cmd exec tsx scripts/verify-saas-launch-flow-readiness.ts
```

Expected: both commands PASS.

- [x] **Step 3: Run frontend build**

Run from `web`:

```powershell
pnpm.cmd build
```

Expected: build exits 0.

- [x] **Step 4: Review diff**

Run from repo root:

```powershell
git diff --check
git diff --stat
git status --short
```

Expected: only the P2 plan, tenant UI script, checklist, and tenant modules page changed.

- [x] **Step 5: Commit**

Run from repo root:

```powershell
git add docs/superpowers/plans/2026-07-08-p2-saas-tenant-ui-state-readiness.md docs/saas-launch-readiness-checklist.md web/scripts/verify-saas-tenant-ui-state-readiness.ts web/src/views/saas/tenant/modules/index.vue
git commit -m "feat: add saas tenant ui state readiness gate"
```

Expected: commit created locally. Do not push.

## Self-Review

- Spec coverage: tenant usage, plan, modules, member, and resource-pack state surfaces are checked by the script; only the modules page needs production changes.
- Placeholder scan: no TBD/TODO/later placeholders remain.
- Type consistency: `loadError`, `loadModules`, and `tenant-modules-page__load-error` are used consistently across plan and script.
