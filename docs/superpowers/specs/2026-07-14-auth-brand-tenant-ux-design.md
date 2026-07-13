# Auth Brand And Tenant UX Design

## Goal

Make the public login and signup experience consistently identify the product as AgentStudio and explain the tenant selection workflow at every stage.

## Root Cause

- The frontend default brand is AgentStudio, but the public `site_name` configuration can still contain the legacy `FssAdmin` value and overwrite the login header.
- The tenant selector only distinguishes an available list from an empty list, even though an empty list represents several different states: missing account, missing password, debounce pending, lookup in progress, no result, or request failure.

## Design

1. Keep runtime public branding configurable. The login page accepts custom non-empty names but normalizes the two known legacy FssAdmin names back to the AgentStudio default.
2. Add a conditional database migration and update `database/init.sql` so existing and new installations use AgentStudio. The migration only changes exact legacy values and does not overwrite custom brands.
3. Model tenant lookup presentation with explicit reactive state: prerequisites, pending/loading, success, empty result, and failure. The select remains disabled until options exist, and its placeholder explains the next action.
4. Add Chinese and English tenant-state copy under the existing login locale namespace.
5. Extend the existing browser smoke with a legacy public brand mock and tenant-state interactions. Add a migration specification covering the conditional update and safe no-op rollback.

## Scope

- No changes to login credentials, tenant lookup API shape, authorization, or signup submission.
- No global visual redesign.
- No custom administrator-defined brand is overwritten.

## Verification

- Browser smoke fails against the current build when the public API returns the legacy brand and when tenant placeholders are checked.
- Migration specification fails before the migration exists.
- Production build, browser smoke, frontend readiness, backend focused tests, backend build, public smoke, and production browser verification must pass.
