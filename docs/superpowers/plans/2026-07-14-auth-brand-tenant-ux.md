# Auth Brand And Tenant UX Implementation Plan

> **For agentic workers:** Execute inline in the current session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align public authentication branding with AgentStudio and make tenant discovery understandable before login.

**Architecture:** Normalize only known legacy public brand values at the login boundary while preserving custom names, and conditionally migrate persisted legacy data. Represent tenant lookup presentation with computed text derived from credentials, request state, results, and errors.

**Tech Stack:** Vue 3, Vue I18n, Element Plus, TypeScript, Playwright, NestJS migrations, Jest, MySQL

## Global Constraints

- Preserve authentication and tenant lookup API contracts.
- Do not overwrite custom site names.
- Do not expose credentials in logs, tests, or deployment output.
- Do not add dependencies.

---

### Task 1: Add failing authentication UX regressions

**Files:**
- Modify: `web/scripts/verify-saas-browser-smoke.ts`
- Create: `server/src/migration-specs/align-agentstudio-site-name.spec.ts`

- [ ] Make the browser mock return `FssAdmin后台管理系统` for `site_name` and assert the login brand remains `AgentStudio`.
- [ ] Assert the tenant selector says to enter an account initially, then requests a password after the account is entered, then reports no available tenant after an empty lookup result.
- [ ] Assert the signup page exposes the AgentStudio brand.
- [ ] Add a migration test that expects an exact conditional legacy-brand update and a no-op rollback.
- [ ] Run the focused browser and Jest commands and confirm they fail for the missing behavior.

### Task 2: Implement brand normalization and tenant state copy

**Files:**
- Modify: `web/src/views/auth/login/index.vue`
- Modify: `web/src/locales/langs/zh.json`
- Modify: `web/src/locales/langs/en.json`

- [ ] Normalize only `FssAdmin` and `FssAdmin后台管理系统` to the configured AgentStudio default.
- [ ] Track tenant lookup attempted and failed state without changing request timing or payloads.
- [ ] Replace the binary tenant placeholder with localized computed state text.
- [ ] Keep the selector disabled until tenant options are available.

### Task 3: Align persisted brand defaults

**Files:**
- Create: `server/src/migrations/1760000000046-AlignAgentStudioSiteName.ts`
- Modify: `database/init.sql`
- Modify: `server/package.json`

- [ ] Add an idempotent migration that updates only exact legacy `site_name` values.
- [ ] Keep `down()` as a documented no-op so rollback cannot overwrite later administrator changes.
- [ ] Change the initial database seed value to `AgentStudio`.
- [ ] Include the new migration specification in the backend readiness command.

### Task 4: Verify and release

- [ ] Run frontend production build, browser smoke, and frontend readiness.
- [ ] Run the migration specification, backend build, and aggregate SaaS readiness.
- [ ] Review the diff and commit the focused implementation.
- [ ] Push without force and deploy through a new release directory.
- [ ] Apply the migration with a verified database backup, then verify public brand, tenant states, health, PM2, and public assets.
