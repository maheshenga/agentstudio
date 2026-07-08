# P9 SaaS Preview Smoke Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a post-build SaaS preview smoke gate so the full repository readiness command proves the built frontend can be served and its entry assets are reachable.

**Architecture:** Keep the existing fast `web` SaaS readiness runner focused on source-level checks. Add a separate `verify:saas-preview-smoke` script that requires `web/dist`, starts `vite preview` on `127.0.0.1`, fetches the root HTML and referenced JS/CSS assets, then shuts preview down. Update the root `scripts/run-saas-readiness.cjs` to run frontend source checks, frontend build, preview smoke, then backend readiness.

**Tech Stack:** Node.js built-in `fetch`, `child_process.spawn`, Vite preview, TypeScript via `tsx`, existing `pnpm.cmd` scripts.

## Global Constraints

- Do not introduce Playwright, Puppeteer, Cypress, or browser binary dependencies in this phase.
- Do not require a seeded database or logged-in browser session for P9.
- Keep `web/scripts/run-saas-readiness.ts` fast; do not make `pnpm.cmd run verify:saas-readiness` require a prior build.
- The full root command `node scripts/run-saas-readiness.cjs` may run the frontend build and preview smoke.
- Use `pnpm.cmd` on Windows PowerShell.
- Use TDD: first expand the command verifier so it fails until the preview smoke script, package command, checklist, and root runner are wired.

---

### Task 1: Add a Failing Command Contract for Preview Smoke

**Files:**
- Modify: `web/scripts/verify-saas-readiness-command.ts`

**Interfaces:**
- Consumes: `web/package.json`, `docs/saas-launch-readiness-checklist.md`, and root `scripts/run-saas-readiness.cjs`.
- Produces: source-level test coverage that requires the new `verify:saas-preview-smoke` command and root gate wiring.

- [ ] **Step 1: Extend the verifier**

Update `web/scripts/verify-saas-readiness-command.ts` to assert:

```typescript
const previewSmokePath = resolve(process.cwd(), 'scripts/verify-saas-preview-smoke.ts')
assert(existsSync(previewSmokePath), 'scripts/verify-saas-preview-smoke.ts must exist')
assert(
  packageJson.scripts?.['verify:saas-preview-smoke'] === 'tsx scripts/verify-saas-preview-smoke.ts',
  'package.json must define verify:saas-preview-smoke'
)
assertIncludes(checklist, 'pnpm.cmd run verify:saas-preview-smoke', 'launch readiness checklist')

const rootRunner = readFile('../scripts/run-saas-readiness.cjs')
for (const token of ['verify:saas-readiness', 'build', 'verify:saas-preview-smoke']) {
  assertIncludes(rootRunner, token, 'root readiness runner')
}
```

- [ ] **Step 2: Run the verifier to verify RED**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: FAIL with messages including `scripts/verify-saas-preview-smoke.ts must exist` and `package.json must define verify:saas-preview-smoke`.

### Task 2: Add the Preview Smoke Script and Web Command

**Files:**
- Create: `web/scripts/verify-saas-preview-smoke.ts`
- Modify: `web/package.json`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: `web/dist/index.html` and local `node_modules/vite/bin/vite.js`.
- Produces: `pnpm.cmd run verify:saas-preview-smoke`.

- [ ] **Step 1: Create `verify-saas-preview-smoke.ts`**

Create a dependency-free script with these behaviors:

```typescript
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const webRoot = process.cwd()
const failures: string[] = []
const host = '127.0.0.1'
const port = Number(process.env.SAAS_PREVIEW_PORT || 4179)
const baseUrl = `http://${host}:${port}`
const distIndex = resolve(webRoot, 'dist/index.html')
const viteCli = resolve(webRoot, 'node_modules/vite/bin/vite.js')
const smokeUrls = ['/', '/#/saas/signup', '/#/tenant-saas/usage', '/#/saas-platform/usage']

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function readBuiltIndex() {
  assert(existsSync(distIndex), 'dist/index.html must exist; run pnpm.cmd build before preview smoke')
  return existsSync(distIndex) ? readFileSync(distIndex, 'utf8') : ''
}

function startPreview() {
  assert(existsSync(viteCli), 'node_modules/vite/bin/vite.js must exist')
  if (!existsSync(viteCli)) return null

  const child = spawn(process.execPath, [viteCli, 'preview', '--host', host, '--port', String(port), '--strictPort'], {
    cwd: webRoot,
    stdio: ['ignore', 'pipe', 'pipe']
  })

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

function extractEntryAssets(html: string) {
  return Array.from(html.matchAll(/\b(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g))
    .map((match) => match[1])
    .filter((asset) => asset.startsWith('/assets/'))
}

async function fetchText(path: string) {
  const response = await fetch(new URL(path, baseUrl))
  assert(response.ok, `${path} must return HTTP 200, got ${response.status}`)
  return response.ok ? response.text() : ''
}

async function runSmoke() {
  const builtIndex = readBuiltIndex()
  assert(builtIndex.includes('<div id="app"'), 'dist/index.html must contain the Vue app mount point')

  const preview = startPreview()
  if (!preview) return

  try {
    await waitForPreview()
    if (failures.length) return

    for (const url of smokeUrls) {
      const html = await fetchText(url)
      assert(html.includes('<div id="app"'), `${url} must serve the Vue app shell`)
    }

    const html = await fetchText('/')
    const assets = extractEntryAssets(html)
    assert(assets.some((asset) => asset.endsWith('.js')), 'preview index must reference at least one JS asset')
    assert(assets.some((asset) => asset.endsWith('.css')), 'preview index must reference at least one CSS asset')

    for (const asset of assets) {
      const body = await fetchText(asset)
      assert(body.length > 0, `${asset} must not be empty`)
    }
  } finally {
    stopPreview(preview)
  }
}

function stopPreview(preview: ChildProcessWithoutNullStreams) {
  if (!preview.killed) preview.kill()
}

await runSmoke()

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS preview smoke verified.')
```

- [ ] **Step 2: Add the package script**

In `web/package.json`, add:

```json
"verify:saas-preview-smoke": "tsx scripts/verify-saas-preview-smoke.ts"
```

Place it next to `verify:saas-readiness`.

- [ ] **Step 3: Update the launch checklist**

In `docs/saas-launch-readiness-checklist.md`, under the frontend automated gates, add:

```powershell
pnpm.cmd run verify:saas-preview-smoke
```

immediately after `pnpm.cmd build`.

- [ ] **Step 4: Run command verifier**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: still FAIL until the root runner is updated, with `root readiness runner must include verify:saas-preview-smoke`.

### Task 3: Wire Preview Smoke into the Root Repository Gate

**Files:**
- Modify: `scripts/run-saas-readiness.cjs`

**Interfaces:**
- Consumes: web package scripts `verify:saas-readiness`, `build`, `verify:saas-preview-smoke`; server package script `verify:saas-readiness`.
- Produces: `node scripts/run-saas-readiness.cjs` that runs frontend source checks, frontend build, preview smoke, and backend checks.

- [ ] **Step 1: Generalize the root runner**

Replace the root checks with command-aware checks:

```javascript
const checks = [
  { label: 'frontend readiness', cwd: path.join(rootDir, 'web'), script: 'verify:saas-readiness' },
  { label: 'frontend build', cwd: path.join(rootDir, 'web'), script: 'build' },
  { label: 'frontend preview smoke', cwd: path.join(rootDir, 'web'), script: 'verify:saas-preview-smoke' },
  { label: 'backend readiness', cwd: path.join(rootDir, 'server'), script: 'verify:saas-readiness' }
]

function runPnpmScript(cwd, script) {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', `pnpm.cmd run ${script}`], {
      cwd,
      stdio: 'inherit',
      shell: false
    })
  }

  return spawnSync('pnpm', ['run', script], {
    cwd,
    stdio: 'inherit',
    shell: false
  })
}
```

Loop through `checks` and call `runPnpmScript(check.cwd, check.script)`.

- [ ] **Step 2: Run command verifier to verify GREEN**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: PASS.

### Task 4: Full P9 Verification and Commit

**Files:**
- No additional production files.

**Interfaces:**
- Consumes: changed scripts, checklist, plan.
- Produces: local commit if all gates pass.

- [ ] **Step 1: Run frontend source readiness**

Run:

```powershell
cd web
pnpm.cmd run verify:saas-readiness
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run:

```powershell
cd web
pnpm.cmd build
```

Expected: PASS and writes `web/dist/index.html`.

- [ ] **Step 3: Run preview smoke**

Run:

```powershell
cd web
pnpm.cmd run verify:saas-preview-smoke
```

Expected: PASS with `SaaS preview smoke verified.`

- [ ] **Step 4: Run root repository readiness**

Run:

```powershell
node scripts/run-saas-readiness.cjs
```

Expected: PASS; it should run frontend readiness, frontend build, frontend preview smoke, and backend readiness.

- [ ] **Step 5: Review diff and whitespace**

Run:

```powershell
git diff --check
git diff -- docs/superpowers/plans/2026-07-08-p9-saas-preview-smoke-readiness.md docs/saas-launch-readiness-checklist.md scripts/run-saas-readiness.cjs web/package.json web/scripts/verify-saas-preview-smoke.ts web/scripts/verify-saas-readiness-command.ts
```

Expected: no whitespace errors and diff limited to P9 readiness work.

- [ ] **Step 6: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-08-p9-saas-preview-smoke-readiness.md docs/saas-launch-readiness-checklist.md scripts/run-saas-readiness.cjs web/package.json web/scripts/verify-saas-preview-smoke.ts web/scripts/verify-saas-readiness-command.ts
git commit -m "test: add saas preview smoke readiness"
```

## Self-Review

- Spec coverage: The plan covers the known gap that existing source-level gates do not prove built frontend assets can be served.
- Placeholder scan: No placeholders remain.
- Type consistency: `verify:saas-preview-smoke`, `verify-saas-preview-smoke.ts`, and the checklist command are named consistently.
