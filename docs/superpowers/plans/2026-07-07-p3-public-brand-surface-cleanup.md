# P3 Public Brand Surface Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove remaining user-visible legacy project brand links from public SaaS UI surfaces and add a regression check.

**Architecture:** Keep this as a narrow frontend-only P3 hardening slice. Add one verification script that scans explicit public/user-visible files, then update only those files so internal composable names such as `useSaiAdmin` remain untouched.

**Tech Stack:** Vue 3, TypeScript, Vite, Node/tsx verification scripts, pnpm.

## Global Constraints

- Do not use subagents for this execution; the user requested direct execution.
- Do not push to remote unless explicitly requested.
- Do not rename broad internal helpers in this P3 task.
- Do not change invoice functionality.
- Use `apply_patch` for manual file edits.
- Verify with a fresh script run and frontend build before committing.

---

### Task 1: Add Public Brand Regression Check

**Files:**
- Create: `web/scripts/verify-saas-public-brand-surfaces.ts`

**Interfaces:**
- Consumes: filesystem paths under `web/`.
- Produces: a CLI verification script runnable with `pnpm.cmd exec tsx scripts/verify-saas-public-brand-surfaces.ts`.

- [ ] **Step 1: Write the failing verification script**

```typescript
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

const files = [
  'src/utils/sys/console.ts',
  'src/views/dashboard/console/modules/about-project.vue',
  'src/views/dashboard/hrm/index.vue',
  'index.html',
  'src/config/index.ts'
]

const forbiddenPatterns = [
  /Fssphp/i,
  /FSSPHP/,
  /FSSADMIN/,
  /phpframe\.org/i,
  /fsscms/i,
  /NovaFrame/i,
  /SpeedThinkphp/i,
  /FSSDB/i,
  /xuey490\/project/i
]

const failures: string[] = []

for (const file of files) {
  const content = readFileSync(resolve(webRoot, file), 'utf8')
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      failures.push(`${file} contains legacy brand pattern ${pattern}`)
    }
  }
}

const consoleContent = readFileSync(resolve(webRoot, 'src/utils/sys/console.ts'), 'utf8')
if (!consoleContent.includes('AgentStudio SaaS')) {
  failures.push('src/utils/sys/console.ts should keep the AgentStudio SaaS console greeting')
}

const aboutProjectContent = readFileSync(
  resolve(webRoot, 'src/views/dashboard/console/modules/about-project.vue'),
  'utf8'
)
for (const expected of ['AgentStudio', 'https://github.com/maheshenga/agentstudio']) {
  if (!aboutProjectContent.includes(expected)) {
    failures.push(`about-project.vue should include ${expected}`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS public brand surfaces verified.')
```

- [ ] **Step 2: Run script to verify it fails**

Run: `cd web && pnpm.cmd exec tsx scripts/verify-saas-public-brand-surfaces.ts`

Expected: FAIL because `console.ts`, `about-project.vue`, and `hrm/index.vue` still contain legacy project names or links.

### Task 2: Replace Public Legacy Brand Surfaces

**Files:**
- Modify: `web/src/utils/sys/console.ts`
- Modify: `web/src/views/dashboard/console/modules/about-project.vue`
- Modify: `web/src/views/dashboard/hrm/index.vue`

**Interfaces:**
- Consumes: existing UI text and links.
- Produces: AgentStudio-focused public text with no legacy public links.

- [ ] **Step 1: Update console greeting**

Replace the legacy `Fssphp` website line with an AgentStudio line.

- [ ] **Step 2: Update About Project links**

Use AgentStudio-focused links:

```typescript
const linkList = [
  { label: '项目仓库', url: 'https://github.com/maheshenga/agentstudio' },
  { label: '租户运营', url: '/#/saas-platform/tenants' },
  { label: '套餐管理', url: '/#/saas-platform/plans' },
  { label: '用量总览', url: '/#/saas-platform/usage' }
]
```

- [ ] **Step 3: Update HRM demo project list**

Replace legacy project rows with AgentStudio SaaS capability examples:

```typescript
const projectList = ref<ProjectItem[]>([
  {
    name: 'AgentStudio SaaS',
    url: 'https://github.com/maheshenga/agentstudio',
    desc: '多租户 SaaS 平台，覆盖租户、套餐、模块、订阅、用量和支付运营。',
    mine: true
  },
  {
    name: '租户运营中心',
    url: '/#/saas-platform/tenants',
    desc: '集中管理租户创建、启用状态、负责人和基础运营信息。',
    mine: true
  },
  {
    name: '套餐与模块体系',
    url: '/#/saas-platform/plans',
    desc: '维护套餐、模块权限、资源额度和订阅能力边界。'
  },
  {
    name: '资源包与用量',
    url: '/#/saas-platform/usage',
    desc: '跟踪资源消耗、额度账本和资源包购买后的交付状态。'
  }
])
```

### Task 3: Verify, Review, Commit

**Files:**
- Test: `web/scripts/verify-saas-public-brand-surfaces.ts`

**Interfaces:**
- Consumes: completed frontend edits.
- Produces: verified git commit.

- [ ] **Step 1: Run verification script**

Run: `cd web && pnpm.cmd exec tsx scripts/verify-saas-public-brand-surfaces.ts`

Expected: PASS with `SaaS public brand surfaces verified.`

- [ ] **Step 2: Run frontend build**

Run: `cd web && pnpm.cmd build`

Expected: PASS.

- [ ] **Step 3: Review diff**

Run: `git diff --check` and `git diff --stat`.

Expected: no whitespace errors and only the planned files changed.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-07-07-p3-public-brand-surface-cleanup.md web/scripts/verify-saas-public-brand-surfaces.ts web/src/utils/sys/console.ts web/src/views/dashboard/console/modules/about-project.vue web/src/views/dashboard/hrm/index.vue
git commit -m "chore: clean public saas brand surfaces"
```
