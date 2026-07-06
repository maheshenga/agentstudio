# P3 SEO Brand Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve low-priority SaaS marketing and SEO foundations without changing authenticated application behavior.

**Architecture:** Keep the SPA architecture. Update static HTML metadata and public crawler files, then align the default product name shown by the frontend shell.

**Tech Stack:** Vue 3 SPA, Vite, static `public` assets, no runtime backend changes.

---

## File Structure

- `web/index.html`
  - Replace legacy FssAdmin/SaiAdmin metadata with AgentStudio SaaS metadata.
  - Add canonical, Open Graph, Twitter Card, theme color, and SoftwareApplication JSON-LD.
- `web/.env`
- `web/.env.development`
- `web/.env.production`
  - Add `VITE_PUBLIC_SITE_URL` so Vite can resolve metadata URLs during local development and production builds.
- `web/public/robots.txt`
  - New crawler policy pointing to sitemap.
- `web/public/sitemap.xml`
  - New basic SPA sitemap for public login/register/legal pages using an absolute placeholder origin until the production domain is finalized.
- `web/src/config/index.ts`
  - Change default system name from `FssAdmin` to `AgentStudio`.
- `web/src/utils/sys/console.ts`
  - Align browser console welcome brand.
- `web/src/views/auth/login/index.vue`
  - Align debug dialog title from `FssAdmin` to `AgentStudio`.

## Task 1: Static SEO Metadata

**Files:**
- Modify: `web/index.html`

- [ ] **Step 1: Run baseline metadata scan**

Run:

```powershell
rg -n "FssAdmin|SaiAdmin|Webman|og:title|twitter:card|application/ld\\+json|canonical" web/index.html
```

Expected: legacy title/description are present and OG/Twitter/JSON-LD/canonical are absent.

- [ ] **Step 2: Update metadata**

Set:
- title: `AgentStudio - SaaS AI Operations Platform`
- description: `AgentStudio is a multi-tenant SaaS platform for tenant management, subscriptions, modules, resource quotas, payments, and AI operations.`
- canonical: `%VITE_PUBLIC_SITE_URL%/` so deployment can inject the production domain without Vite treating `/` as a local asset.
- OG title/description/type/url/site_name
- Twitter card/title/description
- theme-color
- JSON-LD `SoftwareApplication`

- [ ] **Step 2.1: Add public site URL env defaults**

Set `VITE_PUBLIC_SITE_URL` in tracked env files:
- `.env`: `http://localhost:3060`
- `.env.development`: `http://localhost:4060`
- `.env.production`: `https://agentstudio.example.com`

Expected: Vite does not leave `%VITE_PUBLIC_SITE_URL%` unresolved during build. Replace the production placeholder with the real public origin before launch.

- [ ] **Step 3: Run metadata scan**

Run:

```powershell
rg -n "AgentStudio|og:title|twitter:card|application/ld\\+json|canonical" web/index.html
```

Expected: new metadata is present.

## Task 2: Public Crawler Files

**Files:**
- Create: `web/public/robots.txt`
- Create: `web/public/sitemap.xml`

- [ ] **Step 1: Add crawler files**

`robots.txt`:

```text
User-agent: *
Allow: /
Sitemap: https://agentstudio.example.com/sitemap.xml
```

`sitemap.xml` includes:
- `https://agentstudio.example.com/`
- `https://agentstudio.example.com/auth/login`
- `https://agentstudio.example.com/auth/register`
- `https://agentstudio.example.com/privacy-policy`
- `https://agentstudio.example.com/terms`

- [ ] **Step 2: Verify files exist**

Run:

```powershell
Test-Path web/public/robots.txt
Test-Path web/public/sitemap.xml
rg -n "sitemap|privacy-policy|terms" web/public/robots.txt web/public/sitemap.xml
```

Expected: both files exist and include the public routes.

## Task 3: Default Brand Alignment

**Files:**
- Modify: `web/src/config/index.ts`
- Modify: `web/src/utils/sys/console.ts`
- Modify: `web/src/views/auth/login/index.vue`

- [ ] **Step 1: Replace user-visible default brand**

Change the default `systemInfo.name` to `AgentStudio`, update the console welcome string, and align the login debug dialog title.

- [ ] **Step 2: Scan for remaining high-impact legacy public brand strings**

Run:

```powershell
rg -n "FssAdmin|SaiAdmin - A modern|Webman" web/index.html web/src/config/index.ts web/src/utils/sys/console.ts web/src/views/auth/login/index.vue
```

Expected: no matches in these high-impact public surfaces.

## Task 4: Verify, Review, Commit

**Files:**
- All changed files in Tasks 1-3.

- [ ] **Step 1: Run frontend typecheck**

Run:

```powershell
cd web
pnpm.cmd exec vue-tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 2: Run frontend build**

Run:

```powershell
cd web
pnpm.cmd run build
```

Expected: exit 0 and generated output includes `robots.txt` and `sitemap.xml`.

- [ ] **Step 3: Review diff**

Run:

```powershell
git diff --check
git diff -- web/index.html web/.env web/.env.development web/.env.production web/public/robots.txt web/public/sitemap.xml web/src/config/index.ts web/src/utils/sys/console.ts web/src/views/auth/login/index.vue docs/superpowers/plans/2026-07-06-p3-seo-brand-foundation.md
```

Expected: only P3 metadata/brand changes.

- [ ] **Step 4: Commit**

Run:

```powershell
git add web/index.html web/.env web/.env.development web/.env.production web/public/robots.txt web/public/sitemap.xml web/src/config/index.ts web/src/utils/sys/console.ts web/src/views/auth/login/index.vue docs/superpowers/plans/2026-07-06-p3-seo-brand-foundation.md
git commit -m "chore: improve saas p3 seo brand foundation"
```

Expected: commit created without staging unrelated `server/pnpm-lock.yaml`, `.codebase-memory/`, or `.codegraph/`.

## Self-Review

- Spec coverage: low-priority SEO/conversion foundation items are addressed with static metadata, crawler files, and default brand alignment.
- Placeholder scan: no TBD/TODO/later-only instructions.
- Type consistency: no app runtime contracts are changed.
