# P3 Use Table CRUD Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the legacy `useSaiAdmin` frontend composable name from source code by renaming it to `useTableCrud` without changing runtime behavior.

**Architecture:** This is a mechanical frontend refactor. The composable keeps the same return shape and implementation, but the file, export, imports, and call sites are renamed to a product-neutral name.

**Tech Stack:** Vue 3, TypeScript, Vite, Node/tsx verification scripts, pnpm.

## Global Constraints

- Do not use subagents for this execution; the user requested direct execution.
- Do not push to remote unless explicitly requested.
- Do not alter composable behavior in this P3 task.
- Do not rename unrelated APIs, routes, database fields, or backend symbols.
- Use `apply_patch` for manual file edits; mechanical rewrite commands are allowed for bulk import/call replacement.
- Verify with a fresh script run and frontend build before committing.

---

### Task 1: Add Legacy Composable Naming Regression Check

**Files:**
- Create: `web/scripts/verify-no-legacy-saiadmin-composable.ts`

**Interfaces:**
- Consumes: filesystem paths under `web/src`.
- Produces: a CLI verification script runnable with `pnpm.cmd exec tsx scripts/verify-no-legacy-saiadmin-composable.ts`.

- [ ] **Step 1: Write the failing verification script**

```typescript
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, resolve } from 'node:path'

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const srcRoot = join(webRoot, 'src')
const forbiddenPatterns = [/useSaiAdmin/, /@\/composables\/useSaiAdmin/]
const failures: string[] = []

function collectFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return collectFiles(path)
    if (!/\.(ts|vue)$/.test(entry.name)) return []
    return [path]
  })
}

const legacyFile = join(srcRoot, 'composables', 'useSaiAdmin.ts')
if (existsSync(legacyFile)) {
  failures.push('src/composables/useSaiAdmin.ts should be renamed to useTableCrud.ts')
}

const newFile = join(srcRoot, 'composables', 'useTableCrud.ts')
if (!existsSync(newFile)) {
  failures.push('src/composables/useTableCrud.ts should exist')
}

for (const file of collectFiles(srcRoot)) {
  const content = readFileSync(file, 'utf8')
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      failures.push(`${relative(webRoot, file)} contains legacy composable name ${pattern}`)
    }
  }
}

if (existsSync(newFile)) {
  const newContent = readFileSync(newFile, 'utf8')
  if (!newContent.includes('export function useTableCrud()')) {
    failures.push('src/composables/useTableCrud.ts should export useTableCrud')
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('No legacy SaiAdmin composable names remain in web/src.')
```

- [ ] **Step 2: Run script to verify it fails**

Run: `cd web && pnpm.cmd exec tsx scripts/verify-no-legacy-saiadmin-composable.ts`

Expected: FAIL because `web/src/composables/useSaiAdmin.ts` and its imports/calls still exist.

### Task 2: Rename Composable and Call Sites

**Files:**
- Move: `web/src/composables/useSaiAdmin.ts` to `web/src/composables/useTableCrud.ts`
- Modify: all `web/src/**/*.vue` files importing or calling `useSaiAdmin`

**Interfaces:**
- Consumes: existing composable return object: `dialogType`, `dialogVisible`, `dialogData`, `selectedRows`, `showDialog`, `hideDialog`, `handleSelectionChange`, `deleteRow`, `deleteSelectedRows`.
- Produces: same return object from `useTableCrud`.

- [ ] **Step 1: Rename the file**

Run: `git mv web/src/composables/useSaiAdmin.ts web/src/composables/useTableCrud.ts`

- [ ] **Step 2: Rename the export and comments**

In `web/src/composables/useTableCrud.ts`, change:

```typescript
/**
 * SaiAdmin Composable
 * SaiAdmin状态管理
 */
export function useSaiAdmin() {
```

to:

```typescript
/**
 * Table CRUD composable
 * 管理表格选择、弹窗状态和删除确认
 */
export function useTableCrud() {
```

- [ ] **Step 3: Mechanically update imports and calls**

Replace in `web/src`:

```typescript
useSaiAdmin
@/composables/useSaiAdmin
```

with:

```typescript
useTableCrud
@/composables/useTableCrud
```

### Task 3: Verify, Review, Commit

**Files:**
- Test: `web/scripts/verify-no-legacy-saiadmin-composable.ts`

**Interfaces:**
- Consumes: completed frontend edits.
- Produces: verified git commit.

- [ ] **Step 1: Run naming verification script**

Run: `cd web && pnpm.cmd exec tsx scripts/verify-no-legacy-saiadmin-composable.ts`

Expected: PASS with `No legacy SaiAdmin composable names remain in web/src.`

- [ ] **Step 2: Run public brand verification script**

Run: `cd web && pnpm.cmd exec tsx scripts/verify-saas-public-brand-surfaces.ts`

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run: `cd web && pnpm.cmd build`

Expected: PASS.

- [ ] **Step 4: Review diff**

Run: `git diff --check` and `git diff --stat`.

Expected: no whitespace errors and only this mechanical rename plus plan/script files changed.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-07-07-p3-use-table-crud-rename.md web/scripts/verify-no-legacy-saiadmin-composable.ts web/src
git commit -m "refactor: rename legacy table crud composable"
```
