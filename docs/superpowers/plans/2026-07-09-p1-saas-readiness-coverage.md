# P1 SaaS Readiness Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the backend SaaS readiness command actually runs the high-value SaaS security, tenant-member, billing, module, subscription, and outbound URL regression tests that already exist.

**Architecture:** Add one package-script contract spec that reads `server/package.json` and asserts `verify:saas-readiness` contains every required spec filename. Then update the readiness command and launch checklist so local/demo/pre-release gates run the same expanded backend suite.

**Tech Stack:** NestJS/Jest, Node `fs` package reads, npm/pnpm scripts, Markdown checklist.

## Global Constraints

- Worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.
- Branch: `saas-order-risk-ops`.
- Do not push unless the user explicitly asks.
- Do not change application runtime behavior.
- Keep this slice limited to readiness coverage, documentation, verification, review, and commit.
- Use TDD: add the failing package-script contract spec first, run it red, update scripts/docs, run green.

---

## File Structure

- Create: `server/src/config/saas-readiness-command.spec.ts`
  - Owns the backend readiness command contract and required spec filename list.
- Modify: `server/package.json`
  - Expands `verify:saas-readiness` to include the required regression suites.
- Modify: `server/src/module/saas/saas-platform.controller.imports.spec.ts`
  - Keeps the type-only import guard semantic so combined `import type` lines are accepted.
- Modify: `docs/saas-launch-readiness-checklist.md`
  - Updates the expanded backend gate example so manual release review matches the package script.

## Required Backend Readiness Specs

The contract spec must require these filenames in `server/package.json` `scripts.verify:saas-readiness`:

```ts
const REQUIRED_BACKEND_SAAS_READINESS_SPECS = [
  'saas-main-flow.integration.spec.ts',
  'saas-route-consistency.spec.ts',
  'saas-route-prefix.spec.ts',
  'saas-tenant.controller.spec.ts',
  'saas-platform.controller.spec.ts',
  'saas-platform.controller.imports.spec.ts',
  'saas-platform.service.spec.ts',
  'saas-payment.controller.spec.ts',
  'saas-payment.service.spec.ts',
  'saas-payment-config.service.spec.ts',
  'create-saas-payment-notify-logs.spec.ts',
  'create-saas-payment-configs.spec.ts',
  'align-saas-payment-config-menu.spec.ts',
  'create-tenant-member.dto.spec.ts',
  'saas-tenant-member.service.spec.ts',
  'align-saas-tenant-member-menu.spec.ts',
  'saas-visible-text-encoding.spec.ts',
  'saas-resource-pack.service.spec.ts',
  'saas-resource-pack-order.service.spec.ts',
  'save-saas-resource-pack.dto.spec.ts',
  'align-saas-resource-pack-crud-permissions.spec.ts',
  'saas-order.service.spec.ts',
  'saas-order-risk.service.spec.ts',
  'add-saas-order-close-metadata.spec.ts',
  'add-saas-order-payment-requested-at.spec.ts',
  'saas-plan.service.spec.ts',
  'saas-quota.service.spec.ts',
  'saas-module.service.spec.ts',
  'align-saas-module-routes.spec.ts',
  'saas-subscription-lifecycle.service.spec.ts',
  'enforce-single-active-saas-subscription.spec.ts',
  'saas-revenue-report.service.spec.ts',
  'align-saas-revenue-report-menu.spec.ts',
  'signup.dto.spec.ts',
  'saas-env-contract.spec.ts',
  'saas-runtime-health.service.spec.ts',
  'safe-url.util.spec.ts',
  'ai-admin.service.spec.ts',
  'taixu-document.service.spec.ts',
];
```

### Task 1: Add Backend Readiness Command Contract

**Files:**
- Create: `server/src/config/saas-readiness-command.spec.ts`

**Interfaces:**
- Consumes: `server/package.json`.
- Produces: a Jest suite that fails when `verify:saas-readiness` omits any required high-value spec.

- [ ] **Step 1: Write failing contract spec**

Create `server/src/config/saas-readiness-command.spec.ts` with:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '../../..');

const REQUIRED_BACKEND_SAAS_READINESS_SPECS = [
  'saas-main-flow.integration.spec.ts',
  'saas-route-consistency.spec.ts',
  'saas-route-prefix.spec.ts',
  'saas-tenant.controller.spec.ts',
  'saas-platform.controller.spec.ts',
  'saas-platform.controller.imports.spec.ts',
  'saas-platform.service.spec.ts',
  'saas-payment.controller.spec.ts',
  'saas-payment.service.spec.ts',
  'saas-payment-config.service.spec.ts',
  'create-saas-payment-notify-logs.spec.ts',
  'create-saas-payment-configs.spec.ts',
  'align-saas-payment-config-menu.spec.ts',
  'create-tenant-member.dto.spec.ts',
  'saas-tenant-member.service.spec.ts',
  'align-saas-tenant-member-menu.spec.ts',
  'saas-visible-text-encoding.spec.ts',
  'saas-resource-pack.service.spec.ts',
  'saas-resource-pack-order.service.spec.ts',
  'save-saas-resource-pack.dto.spec.ts',
  'align-saas-resource-pack-crud-permissions.spec.ts',
  'saas-order.service.spec.ts',
  'saas-order-risk.service.spec.ts',
  'add-saas-order-close-metadata.spec.ts',
  'add-saas-order-payment-requested-at.spec.ts',
  'saas-plan.service.spec.ts',
  'saas-quota.service.spec.ts',
  'saas-module.service.spec.ts',
  'align-saas-module-routes.spec.ts',
  'saas-subscription-lifecycle.service.spec.ts',
  'enforce-single-active-saas-subscription.spec.ts',
  'saas-revenue-report.service.spec.ts',
  'align-saas-revenue-report-menu.spec.ts',
  'signup.dto.spec.ts',
  'saas-env-contract.spec.ts',
  'saas-runtime-health.service.spec.ts',
  'safe-url.util.spec.ts',
  'ai-admin.service.spec.ts',
  'taixu-document.service.spec.ts',
] as const;

describe('SaaS backend readiness command', () => {
  it('runs all high-value SaaS regression specs', () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'server/package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const command = packageJson.scripts?.['verify:saas-readiness'] || '';

    for (const spec of REQUIRED_BACKEND_SAAS_READINESS_SPECS) {
      expect(command).toContain(spec);
    }

    expect(command).toContain('--runInBand');
    expect(command).toContain('--forceExit');
  });
});
```

- [ ] **Step 2: Run the spec to verify RED**

Run:

```powershell
cd server
npm.cmd test -- saas-readiness-command.spec.ts --runInBand
```

Expected: FAIL because the current package script omits several required specs such as `safe-url.util.spec.ts`, `ai-admin.service.spec.ts`, `taixu-document.service.spec.ts`, and tenant-member validation specs.

### Task 2: Expand Backend Readiness Command

**Files:**
- Modify: `server/package.json`

**Interfaces:**
- Produces: `npm.cmd run verify:saas-readiness` and `pnpm.cmd run verify:saas-readiness` run the expanded regression suite.

- [ ] **Step 1: Update `verify:saas-readiness` script**

Replace the script value with one command containing every required spec filename:

```json
"verify:saas-readiness": "jest -- saas-main-flow.integration.spec.ts saas-route-consistency.spec.ts saas-route-prefix.spec.ts saas-tenant.controller.spec.ts saas-platform.controller.spec.ts saas-platform.controller.imports.spec.ts saas-platform.service.spec.ts saas-payment.controller.spec.ts saas-payment.service.spec.ts saas-payment-config.service.spec.ts create-saas-payment-notify-logs.spec.ts create-saas-payment-configs.spec.ts align-saas-payment-config-menu.spec.ts create-tenant-member.dto.spec.ts saas-tenant-member.service.spec.ts align-saas-tenant-member-menu.spec.ts saas-visible-text-encoding.spec.ts saas-resource-pack.service.spec.ts saas-resource-pack-order.service.spec.ts save-saas-resource-pack.dto.spec.ts align-saas-resource-pack-crud-permissions.spec.ts saas-order.service.spec.ts saas-order-risk.service.spec.ts add-saas-order-close-metadata.spec.ts add-saas-order-payment-requested-at.spec.ts saas-plan.service.spec.ts saas-quota.service.spec.ts saas-module.service.spec.ts align-saas-module-routes.spec.ts saas-subscription-lifecycle.service.spec.ts enforce-single-active-saas-subscription.spec.ts saas-revenue-report.service.spec.ts align-saas-revenue-report-menu.spec.ts signup.dto.spec.ts saas-env-contract.spec.ts saas-runtime-health.service.spec.ts safe-url.util.spec.ts ai-admin.service.spec.ts taixu-document.service.spec.ts saas-readiness-command.spec.ts --runInBand --forceExit"
```

- [ ] **Step 2: Run the contract spec to verify GREEN**

Run:

```powershell
cd server
npm.cmd test -- saas-readiness-command.spec.ts --runInBand
```

Expected: PASS.

### Task 3: Update Launch Readiness Checklist

**Files:**
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Produces: backend gate documentation that matches the expanded package script and tells maintainers to prefer the package script.

- [ ] **Step 1: Update expanded backend gate block**

Replace the backend expanded-gate command with:

```powershell
cd server
pnpm.cmd run verify:saas-readiness

# Expanded backend gate is defined in server/package.json and guarded by:
pnpm.cmd test -- saas-readiness-command.spec.ts --runInBand --forceExit
```

- [ ] **Step 2: Confirm checklist mentions the new contract spec**

Run:

```powershell
Select-String -Path docs/saas-launch-readiness-checklist.md -Pattern 'saas-readiness-command.spec.ts'
```

Expected: at least one match.

### Task 4: Refresh Included Import Guard

**Files:**
- Modify: `server/src/module/saas/saas-platform.controller.imports.spec.ts`

**Interfaces:**
- Consumes: `server/src/module/saas/saas-platform.controller.ts`.
- Produces: a Bun-startup guard that rejects runtime query-interface imports while allowing multiple query types in one `import type` statement.

- [ ] **Step 1: If expanded readiness exposes the stale exact-import assertion, update the spec**

Use a line-level import list so the guard checks runtime-vs-type import semantics:

```ts
const platformServiceImports = source
  .split(/\r?\n/)
  .filter((line) => line.includes("from './services/saas-platform.service'"));

expect(platformServiceImports).toEqual(
  expect.arrayContaining([
    expect.stringMatching(/^import type .*SaasPlatformListQuery.*from '\.\/services\/saas-platform\.service';$/),
    expect.stringMatching(/^import type .*SaasPaymentNotifyLogListQuery.*from '\.\/services\/saas-platform\.service';$/),
  ]),
);
expect(platformServiceImports).not.toEqual(
  expect.arrayContaining([
    expect.stringMatching(/^import (?!type).*SaasPlatformListQuery/),
    expect.stringMatching(/^import (?!type).*SaasPaymentNotifyLogListQuery/),
  ]),
);
```

- [ ] **Step 2: Run the import guard**

Run:

```powershell
cd server
npm.cmd test -- saas-platform.controller.imports.spec.ts --runInBand
```

Expected: PASS.

### Task 5: Verification, Review, and Commit

**Files:**
- Modify: all files listed above plus this plan.

**Interfaces:**
- Produces: one local commit on `saas-order-risk-ops`.

- [ ] **Step 1: Run expanded backend readiness with npm**

Run:

```powershell
cd server
npm.cmd run verify:saas-readiness
```

Expected: all selected suites pass.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd server
npm.cmd run build
```

Expected: exit code 0.

- [ ] **Step 3: Run diff checks**

Run:

```powershell
git diff --check
git diff --stat
git status --short --branch
```

Expected: no whitespace errors; only this P1 readiness coverage slice is modified.

- [ ] **Step 4: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-09-p1-saas-readiness-coverage.md docs/saas-launch-readiness-checklist.md server/package.json server/src/config/saas-readiness-command.spec.ts
git commit -m "test: expand saas backend readiness coverage"
```

Expected: commit created on `saas-order-risk-ops`; do not push.

## Self-Review

- Spec coverage: Covers package-script contract, expanded backend readiness coverage, launch checklist alignment, verification, review, and commit.
- Placeholder scan: No TBD/TODO/later placeholders remain.
- Type consistency: The required spec list is identical between this plan and the package-script contract spec.
