# Login Production UX Implementation Plan

> **For agentic workers:** Execute inline in the current session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent production-only login distractions and untouched-form validation noise without changing authentication behavior.

**Architecture:** Add a production-safe debug gate in the existing login component and disable Element Plus validation triggered only by reactive rule changes. Extend the existing Playwright smoke so the built login page is the behavioral contract.

**Tech Stack:** Vue 3, Element Plus, Vite, TypeScript, Playwright, pnpm

## Global Constraints

- Do not change authentication, tenant lookup, captcha, or backend contracts.
- Keep submit-time validation behavior intact.
- Do not add dependencies or restructure the login feature.
- Use the existing browser smoke and production build pipeline.

---

### Task 1: Add the login initial-state regression

**Files:**
- Modify: `web/scripts/verify-saas-browser-smoke.ts`

**Interfaces:**
- Consumes: the built Vue application served by the existing Vite preview and mocked public APIs.
- Produces: `verifyLoginInitialState(page)` assertions for a clean untouched login form.

- [ ] Add a Playwright check that loads `/#/auth/login`, waits 2.2 seconds, and asserts zero visible `.welcome-dialog` and `.login-form .el-form-item__error` elements.
- [ ] Capture page errors and console warnings during the login check and require both collections to remain empty.
- [ ] Run `pnpm.cmd run verify:saas-browser-smoke` from `web` against the current `dist`.
- [ ] Confirm the command fails because the current production build shows the welcome dialog and validates untouched fields.

### Task 2: Apply the minimal production-safe fix

**Files:**
- Modify: `web/src/views/auth/login/index.vue`

**Interfaces:**
- Consumes: Vite `import.meta.env.DEV`, `VITE_HOME_DEGBUG`, and Element Plus `ElForm`.
- Produces: a production login page with explicit-submit validation only.

- [ ] Add `:validate-on-rule-change="false"` to the login `ElForm`.
- [ ] Change `homeDebugEnabled` to require both development mode and the existing debug flag.
- [ ] Run `pnpm.cmd run build` from `web`.
- [ ] Run `pnpm.cmd run verify:saas-browser-smoke` and confirm the new initial-state assertions pass.

### Task 3: Verify, review, and release

**Files:**
- Review: `web/src/views/auth/login/index.vue`
- Review: `web/scripts/verify-saas-browser-smoke.ts`

**Interfaces:**
- Consumes: the normal frontend readiness, public live smoke, Git, and production deployment flow.
- Produces: a reviewed commit and verified production release.

- [ ] Run `pnpm.cmd run verify:saas-readiness` from `web`.
- [ ] Review the final diff for scope, validation behavior, and accidental environment or generated-file changes.
- [ ] Commit and push the focused change to `maheshenga/main` without force-pushing.
- [ ] Deploy through the existing release-directory and `current` symlink workflow.
- [ ] Verify production login rendering, console health, public live smoke, PM2 status, and health dependencies.
