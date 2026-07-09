# P7 SaaS Public Live Smoke Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The project owner asked to continue inline and not use subagents for interrupted continuation work.

**Goal:** Add an optional read-only public deployed-origin smoke gate for the SaaS web app so Baota/Nginx deployments such as `https://studio.qingyouai.com` can be verified after release.

**Architecture:** Keep the default repository readiness deterministic and offline-friendly. Add a contract assertion for a new optional frontend command, implement a standalone TypeScript HTTP smoke script, and document when operators should run it. The script validates deployed HTML shell, route fallback, robots, sitemap, SEO placeholders, and static assets without credentials or data mutation.

**Tech Stack:** TypeScript, tsx, Node fetch, Vue SPA hash app deployed behind Nginx/Baota, existing SaaS readiness command contracts.

## Global Constraints

- Do not add this live public command to the default root readiness gate.
- Do not require credentials, cookies, or bearer tokens.
- Do not print secrets or environment variables beyond the public base URL.
- Default public origin is `https://studio.qingyouai.com`; allow override with `SAAS_PUBLIC_LIVE_BASE_URL`.
- Keep invoice functionality out of scope.
- Use PowerShell command examples with `pnpm.cmd`.
- Keep checks read-only: only GET public pages, `robots.txt`, `sitemap.xml`, and static assets.

---

### Task 1: Public Live Smoke Contract

**Files:**
- Modify: `web/scripts/verify-saas-readiness-command.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: existing frontend readiness command contract.
- Produces: failing assertions for the new optional public live smoke command, script source, package script, and checklist documentation.

- [ ] **Step 1: Write failing contract assertions**

Add these assertions after the existing public origin checks:

```typescript
const publicLiveSmokePath = resolve(process.cwd(), 'scripts/verify-saas-public-live-smoke.ts')
assert(existsSync(publicLiveSmokePath), 'scripts/verify-saas-public-live-smoke.ts must exist')
assert(
  packageJson.scripts?.['verify:saas-public-live-smoke'] ===
    'tsx scripts/verify-saas-public-live-smoke.ts',
  'package.json must define verify:saas-public-live-smoke'
)
const publicLiveSmokeSource = existsSync(publicLiveSmokePath)
  ? readFile('scripts/verify-saas-public-live-smoke.ts')
  : ''
assertIncludes(publicLiveSmokeSource, 'SAAS_PUBLIC_LIVE_BASE_URL', 'public live smoke')
assertIncludes(publicLiveSmokeSource, 'https://studio.qingyouai.com', 'public live smoke')
assertIncludes(publicLiveSmokeSource, '%VITE_PUBLIC_SITE_URL%', 'public live smoke')
assertIncludes(publicLiveSmokeSource, 'agentstudio.example.com', 'public live smoke')
assertIncludes(publicLiveSmokeSource, 'robots.txt', 'public live smoke')
assertIncludes(publicLiveSmokeSource, 'sitemap.xml', 'public live smoke')
assertIncludes(publicLiveSmokeSource, '/auth/register', 'public live smoke')

assertIncludes(
  checklist,
  'pnpm.cmd run verify:saas-public-live-smoke',
  'launch readiness checklist'
)
assertIncludes(checklist, 'SAAS_PUBLIC_LIVE_BASE_URL', 'launch readiness checklist')
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: FAIL because the optional public live smoke script, package command, and checklist section do not yet exist.

---

### Task 2: Public Live Smoke Script

**Files:**
- Create: `web/scripts/verify-saas-public-live-smoke.ts`
- Modify: `web/package.json`

**Interfaces:**
- Consumes environment:
  - optional `SAAS_PUBLIC_LIVE_BASE_URL`
- Produces:
  - package script `verify:saas-public-live-smoke`
  - read-only HTTP checks for public deployed SaaS surfaces.

- [ ] **Step 1: Create the smoke script**

Create `web/scripts/verify-saas-public-live-smoke.ts` with:

```typescript
const defaultBaseUrl = 'https://studio.qingyouai.com'
const placeholderOrigin = 'https://agentstudio.example.com'
const baseUrl = normalizeBaseUrl(process.env.SAAS_PUBLIC_LIVE_BASE_URL || defaultBaseUrl)
const htmlPaths = ['/', '/auth/login', '/auth/register', '/privacy-policy', '/terms']
```

Implement helpers:

```typescript
function normalizeBaseUrl(value: string) {
  const url = new URL(value)
  url.hash = ''
  url.search = ''
  return url.toString().replace(/\/$/, '')
}

async function fetchText(path: string) {
  const target = new URL(path, `${baseUrl}/`)
  const response = await fetch(target, {
    headers: { accept: 'text/html,application/xml,text/plain,*/*' },
    signal: AbortSignal.timeout(15_000)
  })
  const text = await response.text()
  assert(response.ok, `${target.toString()} must return HTTP 2xx, got ${response.status}`)
  return { url: target.toString(), contentType: response.headers.get('content-type') || '', text }
}
```

For every HTML path, assert:

```typescript
assert(text.includes('<div id="app"'), `${path} must serve the Vue app shell`)
assert(!text.includes('%VITE_PUBLIC_SITE_URL%'), `${path} must not expose Vite public-site placeholder`)
assert(!text.includes(placeholderOrigin), `${path} must not expose placeholder origin`)
assert(contentType.includes('text/html'), `${path} must return text/html`)
```

For `/`, additionally assert title, description, canonical URL, OpenGraph URL, and at least one JS/CSS asset reference. Fetch every discovered `/assets/*.js` and `/assets/*.css` URL and assert HTTP 2xx plus non-empty body.

For `/robots.txt`, assert it points to `${baseUrl}/sitemap.xml` and does not contain the placeholder origin.

For `/sitemap.xml`, assert it includes:

```typescript
`${baseUrl}/`
`${baseUrl}/auth/login`
`${baseUrl}/auth/register`
`${baseUrl}/privacy-policy`
`${baseUrl}/terms`
```

Print only:

```typescript
console.log(JSON.stringify({ base_url: baseUrl, checked_paths: htmlPaths.length, checked_assets: assetCount }, null, 2))
console.log('SaaS public live smoke verified.')
```

- [ ] **Step 2: Add package command**

Add to `web/package.json` scripts:

```json
"verify:saas-public-live-smoke": "tsx scripts/verify-saas-public-live-smoke.ts"
```

- [ ] **Step 3: Run focused contract check**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: FAIL until Task 3 checklist documentation is added, then PASS.

---

### Task 3: Checklist Documentation

**Files:**
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: `web/scripts/verify-saas-public-live-smoke.ts`.
- Produces: operator instructions for verifying the deployed public origin after Baota/Nginx deployment.

- [ ] **Step 1: Add optional public live smoke section**

Add after the automated frontend smoke section:

```markdown
### Optional Public Live Smoke Gate

Run this after deploying the frontend through Baota/Nginx and binding the public domain:

```powershell
cd web
$env:SAAS_PUBLIC_LIVE_BASE_URL = 'https://studio.qingyouai.com'
pnpm.cmd run verify:saas-public-live-smoke
```

This command is read-only. It checks the deployed app shell, direct-route fallback, robots.txt, sitemap.xml, SEO origin replacement, and static asset reachability. Keep it outside the default repository gate because it depends on public DNS, TLS, and Nginx availability.
```

- [ ] **Step 2: Run focused contract check**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: PASS.

---

### Task 4: Verification and Commit

**Files:**
- No additional implementation files.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: reviewed commit.

- [ ] **Step 1: Run script type check**

Run:

```powershell
cd web
pnpm.cmd exec tsc --noEmit --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --lib ES2022,DOM,DOM.Iterable scripts/verify-saas-public-live-smoke.ts
```

Expected: exit 0.

- [ ] **Step 2: Run focused readiness command check**

Run:

```powershell
cd web
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: PASS.

- [ ] **Step 3: Run optional public live smoke**

Run:

```powershell
cd web
$env:SAAS_PUBLIC_LIVE_BASE_URL = 'https://studio.qingyouai.com'
pnpm.cmd run verify:saas-public-live-smoke
```

Expected: PASS if DNS, TLS, Nginx, and deployed assets are healthy. If public infrastructure is unavailable, record the exact blocker and continue with repository-local gates only.

- [ ] **Step 4: Run repository readiness**

Run:

```powershell
node scripts\run-saas-readiness.cjs
```

Expected: exit 0.

- [ ] **Step 5: Review and commit**

Run:

```powershell
git diff --check
git diff --stat
git status --short --branch
git add docs/superpowers/plans/2026-07-09-p7-saas-public-live-smoke-readiness.md docs/saas-launch-readiness-checklist.md web/package.json web/scripts/verify-saas-public-live-smoke.ts web/scripts/verify-saas-readiness-command.ts
git commit -m "test: add saas public live smoke readiness"
```

Expected: commit succeeds. Do not push unless the user explicitly asks.

## Self-Review

- Spec coverage: The plan covers contract assertions, package command, standalone public live HTTP smoke, operator docs, type check, focused readiness, optional live run, repository readiness, review, and commit.
- Placeholder scan: No TBD/TODO or incomplete implementation language remains.
- Type consistency: Environment names, script names, route paths, and package command names match across tasks.
