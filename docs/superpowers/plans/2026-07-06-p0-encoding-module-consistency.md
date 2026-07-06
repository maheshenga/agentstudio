# P0 Encoding and Module Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the current SaaS system by preventing user-visible mojibake regressions and enforcing consistency between system-module route guards and built-in module manifests.

**Architecture:** Keep runtime behavior conservative. Add tests first, export existing route binding metadata for verification, align manifest metadata with actual guarded routes, and clean only confirmed broken seed data text. Do not rebuild the guard to load from the database in P0.

**Tech Stack:** NestJS, TypeScript, Jest, TypeORM-style manifests, Vue source scanning through Jest filesystem tests, MySQL seed SQL.

---

## File Structure

- Modify `server/src/module/saas/saas-visible-text-encoding.spec.ts`
  - Expand visible-text scan targets from SaaS-only to active SaaS, AI, Taixu, login/user, logging, and seed SQL surfaces.
  - Add a U+FFFD replacement-character assertion for seed SQL and user-visible sources.

- Modify `database/init.sql`
  - Remove unrecoverable replacement-character mojibake from demo AI chat and memory seed text.
  - Preserve readable Chinese content and avoid guessing lost emoji.

- Modify `server/src/module/system-module/system-module.guard.ts`
  - Export the route binding type and constant as readonly metadata.
  - Keep `SystemModuleGuard` runtime behavior unchanged.

- Modify `server/src/module/system-module/manifests/built-in-modules.ts`
  - Add route namespaces for modules actually protected by `SystemModuleGuard`.
  - Align AI admin API tenant scope and stale article/log API paths with real controllers.

- Create `server/src/module/system-module/system-module-route-consistency.spec.ts`
  - Assert guarded manifests match route bindings by namespace, module code, and tenant scope.
  - Assert every guard binding belongs to a manifest route namespace.
  - Assert guard feature gates map through `SAAS_TO_SYSTEM_MODULE_BRIDGE`.

---

### Task 1: Visible Text Encoding Guardrail

**Files:**
- Modify: `server/src/module/saas/saas-visible-text-encoding.spec.ts`
- Modify: `database/init.sql`

- [ ] **Step 1: Write the failing seed SQL replacement-character test**

Add `database/init.sql` to the scan target list and add a focused assertion that production/demo seed text contains no Unicode replacement characters:

```typescript
const VISIBLE_TEXT_TARGETS: SourceTarget[] = [
  {
    relativePath: 'database/init.sql',
    extensions: ['.sql'],
  },
  {
    relativePath: 'server/src/module/saas',
    extensions: ['.ts'],
    exclude: (relativePath) => relativePath.endsWith('.spec.ts'),
  },
  {
    relativePath: 'server/src/module/ai',
    extensions: ['.ts'],
    exclude: (relativePath) => relativePath.endsWith('.spec.ts'),
  },
  {
    relativePath: 'server/src/module/taixu',
    extensions: ['.ts'],
    exclude: (relativePath) => relativePath.endsWith('.spec.ts'),
  },
  {
    relativePath: 'server/src/module/main/main.controller.ts',
    extensions: ['.ts'],
  },
  {
    relativePath: 'server/src/module/main/main.service.ts',
    extensions: ['.ts'],
  },
  {
    relativePath: 'server/src/module/system/user',
    extensions: ['.ts'],
    exclude: (relativePath) => relativePath.endsWith('.spec.ts'),
  },
  {
    relativePath: 'server/src/common',
    extensions: ['.ts'],
    exclude: (relativePath) => relativePath.endsWith('.spec.ts'),
  },
  {
    relativePath: 'server/src/migrations',
    extensions: ['.ts'],
  },
  {
    relativePath: 'web/src/api/saas.ts',
    extensions: ['.ts'],
  },
  {
    relativePath: 'web/src/views/saas',
    extensions: ['.vue', '.ts'],
  },
  {
    relativePath: 'web/src/views/ai',
    extensions: ['.vue', '.ts'],
  },
  {
    relativePath: 'web/src/views/taixu',
    extensions: ['.vue', '.ts'],
  },
  {
    relativePath: 'web/src/views/auth/login/index.vue',
    extensions: ['.vue'],
  },
];
```

Rename `collectActiveSaasSourceFiles()` to `collectVisibleTextSourceFiles()` and add:

```typescript
function findReplacementCharacterFindings(sourceFiles: SourceFile[]): VisibleTextEncodingFinding[] {
  return sourceFiles.flatMap((sourceFile) => {
    const lines = sourceFile.source.split(/\r?\n/);
    return lines.flatMap((line, lineIndex) =>
      findAllIndexes(line, '\uFFFD').map((startIndex) => createFinding(sourceFile, line, lineIndex, startIndex, '\uFFFD')),
    );
  });
}
```

Add the test:

```typescript
it('keeps visible text free of Unicode replacement characters', () => {
  const sourceFiles = collectVisibleTextSourceFiles();
  const findings = findReplacementCharacterFindings(sourceFiles);

  expect(formatFindings(findings)).toBe('');
  expect(findings).toEqual([]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-visible-text-encoding.spec.ts --runInBand
```

Expected: FAIL because `database/init.sql` contains U+FFFD replacement characters in demo AI chat or memory seed text.

- [ ] **Step 3: Clean confirmed broken seed text**

In `database/init.sql`, remove unrecoverable replacement characters without inventing lost emoji. Apply replacements equivalent to:

```text
line 533: remove trailing U+FFFD characters after the final question mark
line 539: replace the U+FFFD run between two Chinese clauses with a normal comma
line 551: replace U+FFFD runs after short emphatic headings with normal punctuation
line 569: remove the broken U+FFFD icon before the markdown heading text
line 2564+: remove broken U+FFFD heading icons and keep the readable heading text
```

If additional U+FFFD sequences are found in `database/init.sql`, remove the broken glyphs or replace them with ordinary punctuation only when the surrounding sentence clearly needs punctuation.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-visible-text-encoding.spec.ts --runInBand
```

Expected: PASS with all tests in `saas-visible-text-encoding.spec.ts` green.

---

### Task 2: System Module Route Manifest Consistency

**Files:**
- Modify: `server/src/module/system-module/system-module.guard.ts`
- Modify: `server/src/module/system-module/manifests/built-in-modules.ts`
- Create: `server/src/module/system-module/system-module-route-consistency.spec.ts`

- [ ] **Step 1: Write the failing route consistency spec**

Create `server/src/module/system-module/system-module-route-consistency.spec.ts`:

```typescript
import { SAAS_TO_SYSTEM_MODULE_BRIDGE } from './constants';
import { BUILT_IN_SYSTEM_MODULES } from './manifests/built-in-modules';
import { SYSTEM_MODULE_ROUTE_BINDINGS } from './system-module.guard';

const normalizeRoute = (route: string) => (route.startsWith('/') ? route : `/${route}`).replace(/\/+$/, '');

const matchesRoutePrefix = (path: string, prefix: string) => {
  const normalizedPath = normalizeRoute(path);
  const normalizedPrefix = normalizeRoute(prefix);
  return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
};

const matchBinding = (path: string) =>
  SYSTEM_MODULE_ROUTE_BINDINGS.filter((binding) => matchesRoutePrefix(path, binding.prefix)).sort(
    (left, right) => right.prefix.length - left.prefix.length,
  )[0];

describe('system module route manifests', () => {
  const routeManagedModules = BUILT_IN_SYSTEM_MODULES.filter((module) => module.routes?.length);

  it('declares a manifest route namespace for every guarded route binding', () => {
    const missing = SYSTEM_MODULE_ROUTE_BINDINGS.filter(
      (binding) =>
        !BUILT_IN_SYSTEM_MODULES.some(
          (module) =>
            module.code === binding.moduleCode &&
            module.routes?.some((route) => matchesRoutePrefix(binding.prefix, route)),
        ),
    ).map((binding) => `${binding.moduleCode}:${binding.prefix}`);

    expect(missing).toEqual([]);
  });

  it('keeps route-managed manifest APIs aligned with the guard binding module and tenant scope', () => {
    const mismatches = routeManagedModules.flatMap((module) =>
      module.apis.flatMap((api) => {
        const binding = matchBinding(api.path);
        if (!binding) return [`${module.code}:${api.path} has no guard binding`];
        const issues: string[] = [];
        if (binding.moduleCode !== module.code) {
          issues.push(`${module.code}:${api.path} matched ${binding.moduleCode}`);
        }
        if (Boolean(api.tenantScoped) !== binding.tenantScoped) {
          issues.push(`${module.code}:${api.path} tenantScoped manifest=${Boolean(api.tenantScoped)} guard=${binding.tenantScoped}`);
        }
        return issues;
      }),
    );

    expect(mismatches).toEqual([]);
  });

  it('maps every guarded SaaS feature requirement back to the guarded system module', () => {
    const missing = SYSTEM_MODULE_ROUTE_BINDINGS.flatMap((binding) => {
      const requiredCodes = [binding.requiredSaasModuleCode, ...(binding.requiredAnySaasModuleCodes || [])].filter(
        (code): code is string => Boolean(code),
      );
      return requiredCodes
        .filter((saasCode) => !(SAAS_TO_SYSTEM_MODULE_BRIDGE[saasCode] || []).includes(binding.moduleCode))
        .map((saasCode) => `${binding.moduleCode}:${binding.prefix}:${saasCode}`);
    });

    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the consistency spec and verify RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module-route-consistency.spec.ts --runInBand
```

Expected: FAIL because `SYSTEM_MODULE_ROUTE_BINDINGS` is not exported yet, route namespaces are missing, and `ai_console` admin APIs are not tenant-scoped in the manifest.

- [ ] **Step 3: Export route binding metadata without changing runtime behavior**

In `server/src/module/system-module/system-module.guard.ts`, change:

```typescript
type SystemModuleRouteBinding = {
```

to:

```typescript
export type SystemModuleRouteBinding = {
```

Change:

```typescript
const ROUTE_BINDINGS: SystemModuleRouteBinding[] = [
```

to:

```typescript
export const SYSTEM_MODULE_ROUTE_BINDINGS: readonly SystemModuleRouteBinding[] = [
```

Change:

```typescript
return ROUTE_BINDINGS.filter((binding) =>
```

to:

```typescript
return SYSTEM_MODULE_ROUTE_BINDINGS.filter((binding) =>
```

- [ ] **Step 4: Align built-in module manifest metadata**

In `server/src/module/system-module/manifests/built-in-modules.ts`, add route namespaces only to modules guarded by `SystemModuleGuard`:

```typescript
routes: ['/api/saas/platform'],
```

```typescript
routes: ['/api/saas/tenant'],
```

```typescript
routes: ['/api/ai'],
```

```typescript
routes: ['/api/taixu', '/llm/chat', '/image/generate'],
```

Update AI admin APIs:

```typescript
{ method: 'GET', path: '/api/ai/admin/providers/list', permissionSlug: 'ai:provider:list', tenantScoped: true },
{ method: 'GET', path: '/api/ai/admin/models/list', permissionSlug: 'ai:model:list', tenantScoped: true },
```

Update stale content article APIs:

```typescript
{ method: 'GET', path: '/api/article/list', permissionSlug: 'article:list' },
{ method: 'POST', path: '/api/article/create', permissionSlug: 'article:create' },
{ method: 'PUT', path: '/api/article/update/:id', permissionSlug: 'article:update' },
```

Update stale ops monitor APIs:

```typescript
{ method: 'GET', path: '/api/tool/crontab/list', permissionSlug: 'tool:crontab:index' },
{ method: 'GET', path: '/api/core/logs/getLoginLogPageList', permissionSlug: 'core:logs:login' },
{ method: 'GET', path: '/api/core/logs/getOperLogPageList', permissionSlug: 'core:logs:Oper' },
```

- [ ] **Step 5: Run the focused module consistency tests and verify GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module-route-consistency.spec.ts src/module/system-module/manifests/built-in-modules.spec.ts src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: PASS.

---

### Task 3: P0 Integration Verification and Review

**Files:**
- Review changed files from Tasks 1 and 2.
- Do not stage existing unrelated `server/pnpm-lock.yaml`, `.codebase-memory/`, or `.codegraph/` unless P0 intentionally changes them.

- [ ] **Step 1: Run focused P0 backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/saas/saas-visible-text-encoding.spec.ts src/module/system-module/system-module-route-consistency.spec.ts src/module/system-module/manifests/built-in-modules.spec.ts src/module/system-module/system-module.guard.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: exit code 0.

- [ ] **Step 3: Run frontend typecheck and build only if frontend files changed**

If `git diff --name-only` includes files under `web/`, run:

```powershell
cd web
pnpm.cmd exec vue-tsc --noEmit
pnpm.cmd run build
```

Expected: exit code 0 for both commands. Existing Vite warnings are acceptable only if they match the known pre-existing warnings and no new warning appears from P0 files.

- [ ] **Step 4: Request code review**

Dispatch a reviewer with:

```text
Review P0 stabilization:
- visible text encoding guard now scans SaaS, AI, Taixu, login/user, common, migrations, web views, and database seed SQL
- database/init.sql confirmed U+FFFD mojibake is removed without inventing lost emoji
- SystemModuleGuard route bindings are exported as metadata
- built-in module manifest route namespaces and stale API paths are aligned
- new route consistency spec enforces manifest/guard/bridge consistency
```

Fix Critical and Important findings before committing.

- [ ] **Step 5: Commit P0**

Stage only intentional P0 files:

```powershell
git add database/init.sql server/src/module/saas/saas-visible-text-encoding.spec.ts server/src/module/system-module/system-module.guard.ts server/src/module/system-module/manifests/built-in-modules.ts server/src/module/system-module/system-module-route-consistency.spec.ts docs/superpowers/plans/2026-07-06-p0-encoding-module-consistency.md
git commit -m "fix: stabilize visible text and module route metadata"
```

Expected: commit succeeds and unrelated local noise remains unstaged.

---

## Self-Review

- Spec coverage: P0 covers confirmed user-visible seed SQL mojibake, wider visible-text regression protection, module route binding export, manifest route namespace consistency, AI tenant-scope mismatch, stale article/log API metadata, and SaaS bridge consistency.
- Placeholder scan: The plan contains no TBD, TODO, or deferred implementation steps.
- Type consistency: `SYSTEM_MODULE_ROUTE_BINDINGS`, `SystemModuleRouteBinding`, `BUILT_IN_SYSTEM_MODULES`, and `SAAS_TO_SYSTEM_MODULE_BRIDGE` names match existing or explicitly planned exported symbols.
- Scope check: Runtime guard behavior remains unchanged except for exporting metadata; P0 does not introduce DB-driven guard loading, invoice support, remote push, or frontend UI changes.
