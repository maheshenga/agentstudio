# Hybrid App Platform Execution Index

> **For agentic workers:** Execute each phase inline with `superpowers:executing-plans`. Do not overlap phases that change the same app runtime, marketplace, migration, or SDK contracts. Every phase ends with tests, review, and an independent commit.

**Goal:** Deliver the approved hybrid application platform from the verified P9-A baseline through production launch.

**Architecture:** Close the existing production release first, then extend the current application marketplace in dependency order. Browser runtime authority is built before shared capabilities; shared capabilities are built before service processes; service operations are built before third-party submissions; licensing is added only after application authority is stable.

**Tech Stack:** NestJS, TypeORM, MySQL 8, Redis, Vue 3, Vite, Bun, Node.js 20+, PM2, TypeScript, Jest, Playwright, Baota/Nginx, Alipay.

## Global Constraints

- Authoritative specification: `docs/superpowers/specs/2026-07-12-hybrid-app-platform-completion-design.md`.
- Preserve tenant isolation on every query and operation.
- Never expose application runtime tokens, platform JWTs, secrets, database credentials, Redis credentials, or `.env` values in logs, tests, screenshots, or API responses beyond the one-time runtime token response.
- Keep existing static applications and protocol-v1 `context.get` behavior compatible.
- All new feature flags default to disabled.
- Do not load uploaded code into the NestJS process.
- Do not execute uploaded package lifecycle scripts or arbitrary shell commands.
- Do not add Docker, Python plugins, automated payouts, invoices, or usage-based charging.
- Use forward-only production migrations and create a verified database backup before applying them.
- Each phase uses TDD for new behavior, passes focused and repository gates, receives a diff review, and lands in an independent commit.
- Do not begin a dependent phase while the previous phase has failing tests, unreviewed changes, or an incomplete production migration contract.

## Ordered Phases

1. **Release baseline:** Finish the existing P0 production deployment plan at `docs/superpowers/plans/2026-07-11-p0-release-integration-deployment-recovery.md`.
2. **P9-B:** Runtime sessions, platform capability approval, tenant consent, context gateway, revocation, audit, and SDK/runner compatibility.
3. **P9-C:** KV, files, HTTP/webhook proxy, signed iframe launch, SDK methods, and lifecycle E2E.
4. **P10:** Manifest V2 and administrator-trusted host-process service plugins.
5. **P11:** Certified developer profiles, restricted service submission, review, quotas, circuit breaking, and owned observability.
6. **P12:** App price plans, licenses, existing order/Alipay integration, revenue ledger, and manual settlement batches.
7. **P13:** Documentation, rollout flags, migration rehearsal, full regression, production deployment, and completion audit.

## Phase Gate

Every phase must produce all of the following before the next phase begins:

- focused unit and integration tests for positive, negative, and cross-tenant paths;
- frontend type-check/build and relevant readiness scripts;
- backend build and focused Jest suites;
- `git diff --check` and a clean tracked worktree after commit;
- a security review for token, secret, tenant, permission, upload, outbound-network, payment, or process risks touched by the phase;
- an updated readiness checklist with exact commands and expected evidence;
- one conventional commit or a small reviewed series whose final tree passes the phase gate.

## Completion Evidence

The execution is complete only when P13 proves every acceptance criterion in the specification, deploys the exact reviewed commit, verifies platform and tenant user flows in production, observes stable health, and retains a reversible previous release.

