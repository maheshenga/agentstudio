# P3 SaaS Public Origin Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder production SEO/crawler origin with the deployed public domain and guard it in readiness.

**Architecture:** Keep existing Vite HTML metadata behavior using `%VITE_PUBLIC_SITE_URL%`. Add a frontend readiness script that verifies production env, robots, and sitemap use `https://studio.qingyouai.com` and no longer contain `agentstudio.example.com`, then integrate it into the frontend readiness runner.

**Tech Stack:** TypeScript, tsx, Vite env files, static public assets.

## Global Constraints

- Do not change app routes, backend APIs, authenticated UI behavior, or local development origins.
- Keep `web/index.html` using `%VITE_PUBLIC_SITE_URL%` placeholders so Vite can inject env-specific origins.
- Use `https://studio.qingyouai.com` as the production public origin.
- Use TDD: add failing readiness script and runner expectation before changing config/assets.
- Do not push to remote.

---

### Task 1: Guard The Production Public Origin

**Files:**
- Create: `web/scripts/verify-saas-public-origin.ts`
- Modify: `web/scripts/run-saas-readiness.ts`
- Modify: `web/scripts/verify-saas-readiness-command.ts`
- Modify: `web/.env.production`
- Modify: `web/public/robots.txt`
- Modify: `web/public/sitemap.xml`

**Interfaces:**
- Consumes: `web/.env.production`, `web/public/robots.txt`, `web/public/sitemap.xml`, `web/index.html`.
- Produces: CLI command `pnpm.cmd exec tsx scripts/verify-saas-public-origin.ts` and inclusion in `pnpm.cmd run verify:saas-readiness`.

- [ ] **Step 1: Write the failing public-origin readiness script**

Create `web/scripts/verify-saas-public-origin.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const webRoot = process.cwd()
const failures: string[] = []
const productionOrigin = 'https://studio.qingyouai.com'
const placeholderOrigin = 'https://agentstudio.example.com'

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function readFile(path: string) {
  const fullPath = resolve(webRoot, path)
  assert(existsSync(fullPath), `${path} must exist`)
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : ''
}

const productionEnv = readFile('.env.production')
const robots = readFile('public/robots.txt')
const sitemap = readFile('public/sitemap.xml')
const indexHtml = readFile('index.html')

assert(
  productionEnv.includes(`VITE_PUBLIC_SITE_URL = ${productionOrigin}`),
  '.env.production must set VITE_PUBLIC_SITE_URL to the deployed public origin'
)
assert(!productionEnv.includes(placeholderOrigin), '.env.production must not use placeholder origin')

assert(robots.includes(`Sitemap: ${productionOrigin}/sitemap.xml`), 'robots.txt must point to production sitemap')
assert(!robots.includes(placeholderOrigin), 'robots.txt must not use placeholder origin')

for (const path of ['/', '/auth/login', '/auth/register', '/privacy-policy', '/terms']) {
  assert(sitemap.includes(`<loc>${productionOrigin}${path}</loc>`), `sitemap.xml must include ${productionOrigin}${path}`)
}
assert(!sitemap.includes(placeholderOrigin), 'sitemap.xml must not use placeholder origin')

assert(
  indexHtml.includes('href="%VITE_PUBLIC_SITE_URL%/"') &&
    indexHtml.includes('content="%VITE_PUBLIC_SITE_URL%/"'),
  'index.html must keep VITE_PUBLIC_SITE_URL placeholders for Vite HTML env replacement'
)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS public origin verified.')
```

- [ ] **Step 2: Run script to verify it fails**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-public-origin.ts
```

Expected: FAIL because production env, robots, and sitemap still use `https://agentstudio.example.com`.

- [ ] **Step 3: Add runner expectation and verify it fails**

Add `'verify-saas-public-origin.ts'` to `expectedScripts` in `web/scripts/verify-saas-readiness-command.ts` after `verify-saas-public-brand-surfaces.ts`.

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: FAIL because `web/scripts/run-saas-readiness.ts` does not include the new script yet.

- [ ] **Step 4: Update production public origin files**

In `web/.env.production`, replace:

```text
VITE_PUBLIC_SITE_URL = https://agentstudio.example.com
```

with:

```text
VITE_PUBLIC_SITE_URL = https://studio.qingyouai.com
```

In `web/public/robots.txt`, replace the sitemap origin with `https://studio.qingyouai.com`.

In `web/public/sitemap.xml`, replace every `https://agentstudio.example.com` with `https://studio.qingyouai.com`.

- [ ] **Step 5: Integrate the readiness runner**

Add `'verify-saas-public-origin.ts'` to `checks` in `web/scripts/run-saas-readiness.ts` after `verify-saas-public-brand-surfaces.ts`.

- [ ] **Step 6: Run focused verification**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-public-origin.ts
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
pnpm.cmd run verify:saas-readiness
```

Expected: all commands exit 0.

- [ ] **Step 7: Run root readiness**

Run from repo root:

```powershell
node scripts/run-saas-readiness.cjs
```

Expected: frontend readiness, frontend build, frontend preview smoke, backend build, and backend readiness all pass.

- [ ] **Step 8: Review and commit**

Run:

```powershell
git diff --check
git diff -- docs/superpowers/plans/2026-07-09-p3-saas-public-origin-readiness.md web/scripts/verify-saas-public-origin.ts web/scripts/run-saas-readiness.ts web/scripts/verify-saas-readiness-command.ts web/.env.production web/public/robots.txt web/public/sitemap.xml
git status --short --branch
```

Then commit:

```powershell
git add docs/superpowers/plans/2026-07-09-p3-saas-public-origin-readiness.md web/scripts/verify-saas-public-origin.ts web/scripts/run-saas-readiness.ts web/scripts/verify-saas-readiness-command.ts web/.env.production web/public/robots.txt web/public/sitemap.xml
git commit -m "test: guard saas production public origin"
```

Expected: one local commit on `saas-order-risk-ops`.

## Self-Review

- Spec coverage: The plan covers replacing the placeholder production public origin, guarding the config/assets, runner integration, root readiness, review, and commit.
- Placeholder scan: No TBD/TODO/fill-in-later items remain.
- Type consistency: The script runs from `web/`, uses existing readiness script style, and preserves Vite HTML env placeholder behavior.
