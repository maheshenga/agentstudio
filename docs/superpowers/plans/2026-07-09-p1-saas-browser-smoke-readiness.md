# P1 SaaS Browser Smoke Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real browser smoke gate for the built SaaS frontend so release readiness catches white screens, broken chunks, and route-guard regressions that fetch-only preview checks cannot catch.

**Architecture:** Keep the existing fetch-based `verify-saas-preview-smoke.ts` as a fast asset/server check. Add a separate Playwright-based `verify-saas-browser-smoke.ts` that starts Vite preview from `web/dist`, opens Chromium, mocks backend API calls, verifies the public SaaS signup page renders real form DOM, and verifies protected tenant/platform SaaS routes redirect to login with the original route preserved.

**Tech Stack:** TypeScript, tsx, Vite preview, Playwright Chromium, existing pnpm readiness scripts.

## Global Constraints

- Do not change SaaS runtime behavior, routes, APIs, permissions, payment behavior, or UI page implementation.
- Do not add a seeded database/browser login flow in this P1 slice; the browser gate must run without MySQL, Redis, or backend services.
- Do not push to remote.
- Invoice functionality remains out of scope.
- Use `playwright@1.61.1` as the web dev dependency to match the version already present in the backend lock tree.

---

### Task 1: Add Browser Smoke Contracts

**Files:**
- Modify: `web/scripts/verify-saas-readiness-command.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`
- Create: `docs/superpowers/plans/2026-07-09-p1-saas-browser-smoke-readiness.md`

**Interfaces:**
- Consumes: existing `web/package.json` scripts and root `scripts/run-saas-readiness.cjs`.
- Produces: readiness expectations for `verify:saas-browser-smoke`, `scripts/verify-saas-browser-smoke.ts`, and root/checklist wiring.

- [ ] **Step 1: Add failing verifier assertions**

In `web/scripts/verify-saas-readiness-command.ts`, after the existing preview smoke checks:

```typescript
const browserSmokePath = resolve(process.cwd(), 'scripts/verify-saas-browser-smoke.ts')
assert(existsSync(browserSmokePath), 'scripts/verify-saas-browser-smoke.ts must exist')
assert(
  packageJson.scripts?.['verify:saas-browser-smoke'] ===
    'tsx scripts/verify-saas-browser-smoke.ts',
  'package.json must define verify:saas-browser-smoke'
)
```

Then add a launch checklist assertion after the preview smoke assertion:

```typescript
assertIncludes(
  checklist,
  'pnpm.cmd run verify:saas-browser-smoke',
  'launch readiness checklist'
)
```

Then update the root runner token loop from:

```typescript
for (const token of ['verify:saas-readiness', 'build', 'verify:saas-preview-smoke']) {
  assertIncludes(rootRunner, token, 'root readiness runner')
}
```

to:

```typescript
for (const token of [
  'verify:saas-readiness',
  'build',
  'verify:saas-preview-smoke',
  'verify:saas-browser-smoke'
]) {
  assertIncludes(rootRunner, token, 'root readiness runner')
}
```

- [ ] **Step 2: Verify the new contract fails**

Run from `web`:

```powershell
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: FAIL with messages that `scripts/verify-saas-browser-smoke.ts`, `verify:saas-browser-smoke`, root runner wiring, and launch checklist command are missing.

---

### Task 2: Implement The Browser Smoke Script

**Files:**
- Create: `web/scripts/verify-saas-browser-smoke.ts`
- Modify: `web/package.json`
- Modify: `web/pnpm-lock.yaml`
- Modify: `scripts/run-saas-readiness.cjs`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: built `web/dist/index.html`, Vite CLI, Playwright Chromium.
- Produces: CLI command `pnpm.cmd run verify:saas-browser-smoke`.

- [ ] **Step 1: Add the web dev dependency**

Run from `web`:

```powershell
pnpm.cmd add -D playwright@1.61.1
```

Expected: `web/package.json` gains `playwright` in `devDependencies`, and `web/pnpm-lock.yaml` is updated.

- [ ] **Step 2: Install Chromium for local verification**

Run from `web`:

```powershell
pnpm.cmd exec playwright install chromium
```

Expected: Chromium browser binaries are available for the smoke script.

- [ ] **Step 3: Add the package script**

In `web/package.json`, add:

```json
"verify:saas-browser-smoke": "tsx scripts/verify-saas-browser-smoke.ts"
```

next to `verify:saas-preview-smoke`.

- [ ] **Step 4: Create the browser smoke script**

Create `web/scripts/verify-saas-browser-smoke.ts`:

```typescript
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'

const webRoot = process.cwd()
const failures: string[] = []
const host = '127.0.0.1'
const port = Number(process.env.SAAS_BROWSER_SMOKE_PORT || 4181)
const baseUrl = `http://${host}:${port}`
const distIndex = resolve(webRoot, 'dist/index.html')
const viteCli = resolve(webRoot, 'node_modules/vite/bin/vite.js')
const transparentGif =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function readBuiltIndex() {
  assert(existsSync(distIndex), 'dist/index.html must exist; run pnpm.cmd build before browser smoke')
  return existsSync(distIndex) ? readFileSync(distIndex, 'utf8') : ''
}

function startPreview() {
  assert(existsSync(viteCli), 'node_modules/vite/bin/vite.js must exist')
  if (!existsSync(viteCli)) return null

  const child = spawn(
    process.execPath,
    [viteCli, 'preview', '--host', host, '--port', String(port), '--strictPort'],
    {
      cwd: webRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )

  child.stdout.on('data', (data) => process.stdout.write(data))
  child.stderr.on('data', (data) => process.stderr.write(data))
  return child
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000
  let lastError = ''

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = (error as Error).message
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
  }

  failures.push(`vite preview did not become ready at ${baseUrl}: ${lastError}`)
}

async function mockBackendApis(page: Page) {
  await page.route(/\/(?:nest-api\/)?api\//, async (route) => {
    const url = route.request().url()
    let data: unknown = {}

    if (url.includes('/core/login-captcha')) {
      data = { enabled: false }
    } else if (url.includes('/core/config/public/site_name')) {
      data = { key: 'site_name', value: 'AgentStudio' }
    } else if (url.includes('/core/captcha')) {
      data = { uuid: 'browser-smoke', image: transparentGif }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, message: 'success', data })
    })
  })
}

async function assertHealthyPage(page: Page, label: string) {
  await page.waitForSelector('#app > *', { timeout: 15_000 })
  const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '')
  assert(bodyText.trim().length > 0, `${label} must render visible text`)
  assert(!/\b(404|500)\b/.test(bodyText), `${label} must not render an exception page`)
}

async function verifySignupPage(page: Page) {
  await page.goto(`${baseUrl}/#/saas/signup`, { waitUntil: 'domcontentloaded' })
  await assertHealthyPage(page, 'SaaS signup page')
  await page.waitForSelector('.signup-form', { timeout: 15_000 })

  const inputCount = await page.locator('.signup-form input').count()
  const hasAgreement = (await page.locator('.signup-form .signup-form__agreement').count()) > 0
  const hasSubmit = (await page.locator('.signup-form__submit button').count()) > 0

  assert(inputCount >= 6, `SaaS signup page must render form inputs, got ${inputCount}`)
  assert(hasAgreement, 'SaaS signup page must render agreement checkbox')
  assert(hasSubmit, 'SaaS signup page must render submit button')
}

async function verifyProtectedRedirect(page: Page, routePath: string) {
  await page.goto(`${baseUrl}/#${routePath}`, { waitUntil: 'domcontentloaded' })
  await page.waitForURL(
    (url) => url.hash.startsWith('#/auth/login') && decodeURIComponent(url.hash).includes(routePath),
    { timeout: 15_000 }
  )
  await assertHealthyPage(page, `${routePath} protected redirect`)

  const hash = decodeURIComponent(new URL(page.url()).hash)
  const hasLoginForm = (await page.locator('.login-form').count()) > 0

  assert(hash.startsWith('#/auth/login'), `${routePath} must redirect to login, got ${hash}`)
  assert(hash.includes(`redirect=${routePath}`), `${routePath} login redirect must preserve original path`)
  assert(hasLoginForm, `${routePath} redirect must render the login form`)
}

async function runBrowserSmoke() {
  const builtIndex = readBuiltIndex()
  assert(builtIndex.includes('<div id="app"'), 'dist/index.html must contain the Vue app mount point')

  const preview = startPreview()
  if (!preview) return

  let browser: Browser | undefined
  const pageErrors: string[] = []

  try {
    await waitForPreview()
    if (failures.length) return

    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await mockBackendApis(page)

    await verifySignupPage(page)
    await verifyProtectedRedirect(page, '/tenant-saas/usage')
    await verifyProtectedRedirect(page, '/saas-platform/usage')

    assert(pageErrors.length === 0, `browser smoke must not emit page errors: ${pageErrors.join('; ')}`)
  } finally {
    if (browser) await browser.close()
    await stopPreview(preview)
  }
}

async function stopPreview(preview: ChildProcessWithoutNullStreams) {
  if (preview.killed) return

  await new Promise<void>((resolveStop) => {
    const timeout = setTimeout(resolveStop, 3_000)
    preview.once('close', () => {
      clearTimeout(timeout)
      resolveStop()
    })
    preview.kill()
  })
}

await runBrowserSmoke()

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS browser smoke verified.')
```

- [ ] **Step 5: Wire root readiness**

In `scripts/run-saas-readiness.cjs`, insert this check after `frontend preview smoke`:

```javascript
  { label: 'frontend browser smoke', cwd: path.join(rootDir, 'web'), script: 'verify:saas-browser-smoke' },
```

- [ ] **Step 6: Update the launch checklist**

In `docs/saas-launch-readiness-checklist.md`:

1. Change the aggregate sentence to:

```markdown
This aggregate gate runs frontend readiness, frontend build, frontend preview smoke, frontend browser smoke, backend build, and backend readiness.
```

2. Add this command after `pnpm.cmd run verify:saas-preview-smoke`:

```powershell
pnpm.cmd run verify:saas-browser-smoke
```

3. Replace the known out-of-scope browser E2E bullet with:

```markdown
- The automated browser smoke verifies public signup rendering and protected-route login redirects, but does not replace a full seeded-database login and payment E2E suite.
```

---

### Task 3: Verify And Commit

**Files:**
- Verify: `web/scripts/verify-saas-browser-smoke.ts`
- Verify: `web/scripts/verify-saas-readiness-command.ts`
- Verify: `scripts/run-saas-readiness.cjs`
- Verify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: built `web/dist`.
- Produces: one committed P1 slice.

- [ ] **Step 1: Run focused verification**

Run from `web`:

```powershell
pnpm.cmd build
pnpm.cmd run verify:saas-browser-smoke
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: all commands exit 0.

- [ ] **Step 2: Run frontend readiness**

Run from `web`:

```powershell
pnpm.cmd run verify:saas-readiness
```

Expected: exit 0. This does not run browser smoke because browser smoke requires a built `dist`.

- [ ] **Step 3: Run root readiness**

Run from repo root:

```powershell
node scripts/run-saas-readiness.cjs
```

Expected: frontend readiness, frontend build, frontend preview smoke, frontend browser smoke, backend build, and backend readiness all exit 0.

- [ ] **Step 4: Review and commit**

Run:

```powershell
git diff --check
git diff -- docs/superpowers/plans/2026-07-09-p1-saas-browser-smoke-readiness.md web/scripts/verify-saas-browser-smoke.ts web/scripts/verify-saas-readiness-command.ts web/package.json web/pnpm-lock.yaml scripts/run-saas-readiness.cjs docs/saas-launch-readiness-checklist.md
git status --short --branch
```

Then commit:

```powershell
git add docs/superpowers/plans/2026-07-09-p1-saas-browser-smoke-readiness.md web/scripts/verify-saas-browser-smoke.ts web/scripts/verify-saas-readiness-command.ts web/package.json web/pnpm-lock.yaml scripts/run-saas-readiness.cjs docs/saas-launch-readiness-checklist.md
git commit -m "test: add saas browser smoke readiness"
```

Expected: one local commit on `saas-order-risk-ops`.

## Self-Review

- Spec coverage: This plan adds the missing browser-level release gate without expanding into seeded database login, payment, or invoice work.
- Placeholder scan: No TBD, TODO, fill-in-later, or deferred implementation placeholders remain.
- Type consistency: The package script name is consistently `verify:saas-browser-smoke`; the script path is consistently `scripts/verify-saas-browser-smoke.ts`; the default browser smoke port is `4181`.
