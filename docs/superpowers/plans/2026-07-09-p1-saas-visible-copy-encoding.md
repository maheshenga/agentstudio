# P1 SaaS Visible Copy Encoding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an automated UTF-8 visible-copy gate for the critical SaaS signup/login/tenant/platform UI surface so terminal display mojibake cannot be mistaken for real source corruption, and real source corruption cannot silently regress.

**Architecture:** Add one static frontend readiness script that reads files through Node as UTF-8, scans critical SaaS UI files for common UTF-8-as-GBK mojibake markers, and asserts core Chinese phrases are readable. Add the script to the existing frontend readiness runner and document that `Get-Content` may display UTF-8 files incorrectly in legacy PowerShell.

**Tech Stack:** Vue 3, Vite, TypeScript, tsx, PowerShell/.NET encoding APIs, existing `pnpm.cmd run verify:saas-readiness`.

## Global Constraints

- Do not add browser E2E dependencies in this slice.
- Do not touch invoice functionality.
- Use TDD: write the readiness script first, run it red through the missing checklist integration, then add runner/docs integration, then run green.
- Keep scope to `web/scripts/**`, `docs/saas-launch-readiness-checklist.md`, and this plan unless the UTF-8 gate proves a source file is truly corrupted.
- Use ASCII in new code and comments unless checking expected Chinese strings is the purpose of the test.

---

### Task 1: Add Visible Copy Encoding Gate

**Files:**
- Create: `web/scripts/verify-saas-visible-copy-encoding.ts`

**Interfaces:**
- Consumes: Existing web project root as `process.cwd()`.
- Produces: A script runnable with `pnpm.cmd exec tsx scripts/verify-saas-visible-copy-encoding.ts`.
- Produces: The script exits non-zero when critical SaaS files contain mojibake markers such as `鐧`, `绉`, `鏆`, `鍔`, `璇`, `涓`, `槸`, or `澶`.

- [ ] **Step 1: Write the failing test script**

Create `web/scripts/verify-saas-visible-copy-encoding.ts` with this content:

```ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const failures: string[] = []
const webRoot = process.cwd()

type ReadableCopyExpectation = {
  file: string
  label: string
  expectedReadable: string[]
}

const mojibakeMarkers = ['鐧', '绉', '鏆', '鍔', '璇', '涓', '槸', '澶']

const criticalFiles: ReadableCopyExpectation[] = [
  {
    file: 'src/views/auth/login/index.vue',
    label: 'login page',
    expectedReadable: ['请选择租户', '请先输入用户名', '注册成功']
  },
  {
    file: 'src/views/saas/signup/index.vue',
    label: 'saas signup page',
    expectedReadable: ['创建租户账号', '租户名称', '注册成功']
  },
  {
    file: 'src/views/saas/tenant/usage/index.vue',
    label: 'tenant usage page',
    expectedReadable: ['用量中心', '暂无额度流水', '刷新']
  },
  {
    file: 'src/views/saas/tenant/plan/index.vue',
    label: 'tenant plan page',
    expectedReadable: ['当前套餐', '订单记录', '支付宝']
  },
  {
    file: 'src/views/saas/tenant/modules/index.vue',
    label: 'tenant modules page',
    expectedReadable: ['查看原因', '当前租户未启用该系统模块', '租户模块加载失败']
  },
  {
    file: 'src/views/saas/tenant/member/index.vue',
    label: 'tenant member page',
    expectedReadable: ['成员管理', '添加成员', '重置密码']
  },
  {
    file: 'src/views/saas/tenant/resource-pack/index.vue',
    label: 'tenant resource pack page',
    expectedReadable: ['资源包', '订单记录', '支付宝']
  },
  {
    file: 'src/views/saas/platform/usage/index.vue',
    label: 'platform usage page',
    expectedReadable: ['SaaS Usage', 'Payment reconciliation', 'Scan']
  },
  {
    file: 'src/views/saas/platform/payment-config/index.vue',
    label: 'platform payment config page',
    expectedReadable: ['支付宝配置', '保存配置', '网关地址']
  }
]

function readWebFile(path: string) {
  const fullPath = resolve(webRoot, path)
  if (!existsSync(fullPath)) {
    failures.push(`${path} must exist`)
    return ''
  }
  return readFileSync(fullPath, 'utf8')
}

function assertIncludes(source: string, token: string, label: string) {
  if (!source.includes(token)) {
    failures.push(`${label} must include readable copy: ${token}`)
  }
}

for (const item of criticalFiles) {
  const source = readWebFile(item.file)
  for (const marker of mojibakeMarkers) {
    if (source.includes(marker)) {
      failures.push(`${item.label} must not contain mojibake marker ${marker}`)
    }
  }
  for (const token of item.expectedReadable) {
    assertIncludes(source, token, item.label)
  }
}

const checklist = readWebFile('../docs/saas-launch-readiness-checklist.md')
assertIncludes(checklist, 'verify-saas-visible-copy-encoding.ts', 'launch readiness checklist')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS visible copy encoding verified.')
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-visible-copy-encoding.ts
```

Expected: FAIL because `docs/saas-launch-readiness-checklist.md` does not yet include `verify-saas-visible-copy-encoding.ts`. If it fails on source mojibake markers, stop and inspect with Node before editing Vue files.

### Task 2: Integrate and Document the Encoding Gate

**Files:**
- Modify: `web/scripts/run-saas-readiness.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: Task 1 gate.
- Produces: `pnpm.cmd run verify:saas-readiness` includes the new encoding gate.
- Produces: Documentation includes both the automated gate and the PowerShell display caveat.

- [ ] **Step 1: Add the script to the frontend readiness runner**

Modify `web/scripts/run-saas-readiness.ts` so the checks list contains:

```ts
'verify-saas-tenant-ui-state-readiness.ts',
'verify-saas-visible-copy-encoding.ts',
'verify-saas-signup-activation.ts',
```

- [ ] **Step 2: Document the gate and the display caveat**

Add this command to the expanded frontend gates:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-visible-copy-encoding.ts
```

Add this note to the checklist:

```markdown
If PowerShell `Get-Content` displays Chinese as mojibake, verify with Node UTF-8 reads or run `verify-saas-visible-copy-encoding.ts` before editing source files. The browser/Vite path reads these source files as UTF-8.
```

- [ ] **Step 3: Run the focused gate**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-visible-copy-encoding.ts
```

Expected: PASS.

- [ ] **Step 4: Run existing frontend readiness**

Run:

```powershell
cd web
pnpm.cmd run verify:saas-readiness
```

Expected: PASS.

### Task 3: Full Verification, Review, Commit

**Files:**
- Review all files changed by Tasks 1 and 2.

**Interfaces:**
- Consumes: Task 1 and Task 2 outputs.
- Produces: A committed P1 slice.

- [ ] **Step 1: Run frontend build**

Run:

```powershell
cd web
pnpm.cmd run build
```

Expected: PASS.

- [ ] **Step 2: Run backend SaaS readiness only if server files changed**

If `git diff --name-only` includes `server/`, run:

```powershell
cd server
npm.cmd run verify:saas-readiness
```

Expected: PASS.

- [ ] **Step 3: Review diff**

Run:

```powershell
git diff --check
git diff --stat
git diff -- web/scripts/verify-saas-visible-copy-encoding.ts web/scripts/run-saas-readiness.ts docs/saas-launch-readiness-checklist.md
```

Expected: no whitespace errors; script and runner changes match this plan; no Vue source files changed unless the gate proved real corruption.

- [ ] **Step 4: Commit**

Run:

```powershell
git add docs/saas-launch-readiness-checklist.md docs/superpowers/plans/2026-07-09-p1-saas-visible-copy-encoding.md web/scripts
git commit -m "test: guard saas visible copy encoding"
```

Expected: commit succeeds and working tree is clean.

## Self-Review

- Spec coverage: The plan addresses UX/readability regression risk, terminal/source encoding confusion, core SaaS user journey copy, and adds a persistent automated gate.
- Placeholder scan: No TBD/TODO/later placeholders remain.
- Type consistency: The new script is standalone and uses the same `process.cwd()` style as existing SaaS readiness scripts.
