# Login Production UX Design

## Goal

Keep development-only guidance available to developers while ensuring the production login page opens without a debug dialog, premature validation messages, or Element Plus validation warnings.

## Root Cause

- `VITE_HOME_DEGBUG` is enabled in the production Vite environment, and the login component only checks that public flag before scheduling the welcome dialog.
- The login validation rules are computed from the asynchronously loaded captcha status. Element Plus validates the form when the rules object changes, so disabling captcha after mount validates untouched empty fields.

## Design

1. Gate the welcome dialog with both `import.meta.env.DEV` and `VITE_HOME_DEGBUG === 'true'`. The dialog remains available during local development but is impossible to enable in a production build.
2. Set `validate-on-rule-change` to `false` on the login form. Explicit submit validation remains unchanged, while captcha rule changes no longer validate untouched fields.
3. Extend the existing Playwright browser smoke with a production-build login initial-state check. It waits past the dialog timer and asserts that no welcome dialog, visible validation error, page error, or console warning is present.

## Scope

- No authentication API, tenant lookup, captcha, routing, or backend behavior changes.
- No broad form abstraction or login page redesign.
- Existing submit-time required-field validation remains mandatory.

## Verification

- Red: the new browser smoke assertions fail against the current production build.
- Green: rebuild and rerun the browser smoke after the component fix.
- Run the frontend build and SaaS frontend readiness suite.
- Recheck the deployed production login page and public live smoke after release.
