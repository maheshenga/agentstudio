# P3 Frontend URL Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move obvious URL validation failures to the frontend for AI provider setup and Taixu website import, matching the P1 backend URL guard enough to reduce failed submissions.

**Architecture:** Add a small frontend URL helper under `web/src/utils`, then reuse it from the existing AI provider dialog and Taixu document page. The backend remains the security boundary; frontend validation only improves feedback and normalizes user input before submit.

**Tech Stack:** Vue 3, Element Plus form rules, TypeScript, pnpm, vue-tsc.

## Global Constraints

- Worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.
- Branch: `saas-order-risk-ops`.
- Do not push unless the user explicitly asks.
- Do not change backend routes or API clients.
- Frontend URL validation must not be presented as the security boundary; backend P1 guard remains authoritative.

---

## File Structure

- Create `web/src/utils/safe-url.ts`: browser-side HTTP(S) URL normalization and obvious local/private host rejection.
- Modify `web/src/views/ai/provider/modules/edit-dialog.vue`: validate and normalize `base_url`; disallow query params.
- Modify `web/src/views/taixu/document/index.vue`: add Element Plus form validation for website import and normalize before submit.

## Task 1: Add Frontend URL Helper

**Files:**
- Create: `web/src/utils/safe-url.ts`

**Interfaces:**
- Produces: `normalizeExternalHttpUrlInput(raw, options): string`.
- Produces: `getExternalHttpUrlError(raw, options): string | null`.
- Blocks: non-http(s), URL credentials, localhost, `.localhost`, `.local`, `.internal`, obvious private IPv4 ranges, and obvious local IPv6 ranges.

- [ ] **Step 1: Implement helper**

```ts
export function normalizeExternalHttpUrlInput(raw: string, options: FrontendSafeUrlOptions = {}) {
  const parsed = new URL(String(raw || '').trim())
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`${label} 必须使用 http 或 https`)
  if (parsed.username || parsed.password) throw new Error(`${label} 不能包含用户名或密码`)
  assertAllowedHost(parsed.hostname, label)
  return normalized
}
```

- [ ] **Step 2: Add error-wrapper function**

```ts
export function getExternalHttpUrlError(raw: string, options: FrontendSafeUrlOptions = {}) {
  try {
    normalizeExternalHttpUrlInput(raw, options)
    return null
  } catch (error: any) {
    return error?.message || '请输入有效 URL'
  }
}
```

## Task 2: Validate AI Provider Base URL

**Files:**
- Modify: `web/src/views/ai/provider/modules/edit-dialog.vue`

**Interfaces:**
- Consumes: `normalizeExternalHttpUrlInput`.
- Consumes: `getExternalHttpUrlError`.
- Produces: `base_url` form rule rejects invalid/unsafe obvious values before submit.
- Produces: submitted `base_url` is normalized with trailing slash removed.

- [ ] **Step 1: Add import and rule**

```ts
import { getExternalHttpUrlError, normalizeExternalHttpUrlInput } from '@/utils/safe-url'

base_url: [
  { required: true, message: '请输入 Base URL', trigger: 'blur' },
  {
    validator: (_rule, value, callback) => {
      const error = getExternalHttpUrlError(value, {
        label: 'Base URL',
        stripTrailingSlash: true,
        allowQuery: false
      })
      error ? callback(new Error(error)) : callback()
    },
    trigger: 'blur'
  }
]
```

- [ ] **Step 2: Normalize payload before save/update**

```ts
payload.base_url = normalizeExternalHttpUrlInput(payload.base_url, {
  label: 'Base URL',
  stripTrailingSlash: true,
  allowQuery: false
})
```

## Task 3: Validate Taixu Website Import URL

**Files:**
- Modify: `web/src/views/taixu/document/index.vue`

**Interfaces:**
- Consumes: `normalizeExternalHttpUrlInput`.
- Consumes: `getExternalHttpUrlError`.
- Produces: website dialog validates URL before calling `uploadTaixuWebsite`.
- Produces: submitted website URL is normalized.

- [ ] **Step 1: Replace website ref with form model**

```ts
const websiteFormRef = ref<FormInstance>()
const websiteForm = reactive({ website: '' })
```

- [ ] **Step 2: Add Element Plus form rules**

```ts
const websiteRules: FormRules = {
  website: [
    { required: true, message: '请输入站点 URL', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const error = getExternalHttpUrlError(value, { label: '站点 URL' })
        error ? callback(new Error(error)) : callback()
      },
      trigger: 'blur'
    }
  ]
}
```

- [ ] **Step 3: Normalize before upload**

```ts
await websiteFormRef.value?.validate()
const url = normalizeExternalHttpUrlInput(websiteForm.website, { label: '站点 URL' })
await uploadTaixuWebsite(url)
```

## Task 4: Verification, Review, and Commit

**Files:**
- Modify: all files listed above plus this plan.

**Interfaces:**
- Produces: a local commit on `saas-order-risk-ops`.

- [ ] **Step 1: Run frontend typecheck**

Run: `cd web && pnpm exec vue-tsc --noEmit --pretty false`

Expected: exit code 0.

- [ ] **Step 2: Run backend typecheck as safety check**

Run: `cd server && pnpm run typecheck`

Expected: exit code 0.

- [ ] **Step 3: Run diff checks**

Run: `git diff --check && git diff --cached --check`

Expected: exit code 0; CRLF warnings are acceptable if no whitespace errors are reported.

- [ ] **Step 4: Review and commit**

```bash
git add web/src/utils/safe-url.ts web/src/views/ai/provider/modules/edit-dialog.vue web/src/views/taixu/document/index.vue docs/superpowers/plans/2026-07-07-p3-frontend-url-validation.md
git commit -m "fix: validate outbound urls in frontend forms"
```

Expected: commit created on `saas-order-risk-ops`.

## Self-Review

- Spec coverage: AI provider base URL, Taixu website import URL, verification, review, and commit are covered.
- Placeholder scan: no placeholder implementation steps remain.
- Type consistency: helper function names match both Vue imports.
