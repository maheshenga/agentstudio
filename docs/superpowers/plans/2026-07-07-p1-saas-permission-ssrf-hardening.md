# P1 SaaS Permission and SSRF Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split high-risk tenant member permissions, validate member route parameters at the controller boundary, and block unsafe outbound URLs before AI provider tests or Taixu website imports can trigger SSRF.

**Architecture:** Keep existing SaaS, AI, and Taixu module boundaries. Add a shared URL safety utility under `server/src/common/utils`, call it from AI provider admin and Taixu document ingestion, and update focused Jest specs plus frontend validation copy to match backend password policy.

**Tech Stack:** NestJS, TypeScript, Jest, class-validator, Node `dns/promises`, Node `net`, Vue 3, Element Plus, pnpm.

## Global Constraints

- Worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.
- Branch: `saas-order-risk-ops`.
- Do not push unless the user explicitly asks.
- Do not change public API route paths.
- Do not introduce broad refactors or unrelated encoding cleanup.
- Keep tenant owner/admin backward compatible by granting new mutation permissions in the existing tenant member migration.

---

## File Structure

- Modify `server/src/module/saas/saas-tenant.controller.ts`: import `ParseIntPipe`, use it for member `user_id`, and replace reused `tenant:member:create` with mutation-specific permissions.
- Modify `server/src/module/saas/saas-tenant.controller.spec.ts`: update permission expectations and direct controller test calls to numeric IDs.
- Modify `server/src/migrations/1760000000015-AlignSaasTenantMemberMenu.ts`: seed `tenant:member:update`, `tenant:member:remove`, and `tenant:member:reset-password`; grant them to tenant owner/admin roles.
- Modify `server/src/migration-specs/align-saas-tenant-member-menu.spec.ts`: assert new permission slugs are seeded.
- Create `server/src/common/utils/safe-url.util.ts`: normalize external HTTP(S) URLs and reject localhost/private/link-local/reserved addresses.
- Create `server/src/common/utils/safe-url.util.spec.ts`: cover allowed public URLs and blocked local/private URLs, including DNS-resolved private addresses.
- Modify `server/src/module/ai/services/ai-admin.service.ts`: validate provider `base_url` on create/update and before provider test calls.
- Modify `server/src/module/ai/services/ai-admin.service.spec.ts`: cover rejected private provider URLs and ensure unsafe provider tests do not call the LLM service.
- Modify `server/src/module/taixu/document/taixu-document.service.ts`: validate website URLs before `axios.get` and disable redirects for the fetch.
- Modify `server/src/module/taixu/document/dto/document.dto.ts`: add URL shape and max length validation for website imports.
- Create `server/src/module/taixu/document/taixu-document.service.spec.ts`: cover private URL rejection and a mocked public URL import path.
- Modify `web/src/views/saas/tenant/member/index.vue`: align member create/reset password rules with backend policy.

## Task 1: Split Tenant Member Permissions and Validate Params

**Files:**
- Modify: `server/src/module/saas/saas-tenant.controller.ts`
- Test: `server/src/module/saas/saas-tenant.controller.spec.ts`

**Interfaces:**
- Produces: `changeMemberRole()` requires `tenant:member:update`.
- Produces: `updateMemberStatus()` requires `tenant:member:update`.
- Produces: `removeMember()` requires `tenant:member:remove`.
- Produces: `resetMemberPassword()` requires `tenant:member:reset-password`.
- Produces: all `members/:user_id` handlers receive `userId: number` from `ParseIntPipe`.

- [ ] **Step 1: Update the failing permission expectation**

```ts
const expected: Array<[keyof SaasTenantController, string]> = [
  ['members', 'tenant:member:index'],
  ['createMember', 'tenant:member:create'],
  ['changeMemberRole', 'tenant:member:update'],
  ['updateMemberStatus', 'tenant:member:update'],
  ['removeMember', 'tenant:member:remove'],
  ['resetMemberPassword', 'tenant:member:reset-password'],
];
```

- [ ] **Step 2: Run controller spec and confirm it fails**

Run: `cd server && pnpm test -- saas-tenant.controller.spec.ts --runInBand --forceExit`

Expected before implementation: FAIL because controller still uses `tenant:member:create` for all member mutations.

- [ ] **Step 3: Apply controller decorators and ParseIntPipe**

```ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';

@Patch('members/:user_id/role')
@RequirePermission('tenant:member:update')
async changeMemberRole(@Param('user_id', ParseIntPipe) userId: number, @Body() body: { role: 'admin' | 'member' }) {
  await this.tenantMemberService.changeMemberRole(tenantId, userId, body.role);
}

@Patch('members/:user_id/status')
@RequirePermission('tenant:member:update')
async updateMemberStatus(@Param('user_id', ParseIntPipe) userId: number, @Body() body: { status: 0 | 1 }) {
  await this.tenantMemberService.updateMemberStatus(tenantId, userId, Number(body.status) as 0 | 1);
}

@Delete('members/:user_id')
@RequirePermission('tenant:member:remove')
async removeMember(@Param('user_id', ParseIntPipe) userId: number) {
  await this.tenantMemberService.removeMember(tenantId, userId);
}

@Post('members/:user_id/reset-password')
@RequirePermission('tenant:member:reset-password')
async resetMemberPassword(@Param('user_id', ParseIntPipe) userId: number, @Body() body: { password: string }) {
  await this.tenantMemberService.resetMemberPassword(tenantId, userId, body.password);
}
```

- [ ] **Step 4: Update direct unit calls to pass numeric IDs**

```ts
await controller.changeMemberRole(8, { role: 'admin' });
await controller.updateMemberStatus(8, { status: 0 });
await controller.removeMember(8);
await controller.resetMemberPassword(8, { password: 'NewPass123!' });
```

- [ ] **Step 5: Run controller spec and confirm pass**

Run: `cd server && pnpm test -- saas-tenant.controller.spec.ts --runInBand --forceExit`

Expected: PASS.

## Task 2: Seed New Member Permissions

**Files:**
- Modify: `server/src/migrations/1760000000015-AlignSaasTenantMemberMenu.ts`
- Test: `server/src/migration-specs/align-saas-tenant-member-menu.spec.ts`

**Interfaces:**
- Produces: new permission slugs `tenant:member:update`, `tenant:member:remove`, `tenant:member:reset-password`.
- Produces: existing tenant owner/admin roles get all member permissions.
- Produces: existing tenant member roles keep only menu visibility plus `tenant:member:index`.

- [ ] **Step 1: Add failing migration assertions**

```ts
expect(params).toContain('tenant:member:update');
expect(params).toContain('tenant:member:remove');
expect(params).toContain('tenant:member:reset-password');
```

- [ ] **Step 2: Run migration spec and confirm it fails**

Run: `cd server && pnpm test -- align-saas-tenant-member-menu.spec.ts --runInBand --forceExit`

Expected before implementation: FAIL because only `index` and `create` are seeded.

- [ ] **Step 3: Add permission seeds**

```ts
{
  parentCode: 'TenantMember',
  name: 'Update',
  slug: 'tenant:member:update',
  method: 'PATCH',
  sort: 30,
  remark: 'Seeded tenant member update permission',
}
```

Also add `tenant:member:remove` with `DELETE` and `tenant:member:reset-password` with `POST`.

- [ ] **Step 4: Update down/grant SQL slug lists**

Owner/admin slug list:

```sql
'tenant:member:index',
'tenant:member:create',
'tenant:member:update',
'tenant:member:remove',
'tenant:member:reset-password'
```

Member slug list:

```sql
'tenant:member:index'
```

- [ ] **Step 5: Run migration spec and confirm pass**

Run: `cd server && pnpm test -- align-saas-tenant-member-menu.spec.ts --runInBand --forceExit`

Expected: PASS.

## Task 3: Add Shared External URL Guard

**Files:**
- Create: `server/src/common/utils/safe-url.util.ts`
- Create: `server/src/common/utils/safe-url.util.spec.ts`

**Interfaces:**
- Produces: `normalizeExternalHttpUrl(raw, options): string`.
- Produces: `assertPublicResolvedUrl(raw, options): Promise<string>`.
- Blocks: non-http(s), credentials in URL, localhost, loopback, private IPv4, link-local IPv4, unique-local IPv6, link-local IPv6, DNS results resolving to non-public addresses.

- [ ] **Step 1: Write focused unit tests**

```ts
expect(normalizeExternalHttpUrl('https://api.example.com/v1/', { stripTrailingSlash: true })).toBe(
  'https://api.example.com/v1',
);
expect(() => normalizeExternalHttpUrl('http://127.0.0.1:11434/v1')).toThrow(BadRequestException);
expect(() => normalizeExternalHttpUrl('file:///etc/passwd')).toThrow(BadRequestException);
```

```ts
(lookup as jest.Mock).mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
await expect(assertPublicResolvedUrl('https://internal.example.test')).rejects.toBeInstanceOf(BadRequestException);
```

- [ ] **Step 2: Run utility spec and confirm failure**

Run: `cd server && pnpm test -- safe-url.util.spec.ts --runInBand --forceExit`

Expected before implementation: FAIL because the utility does not exist.

- [ ] **Step 3: Implement URL normalization and IP checks**

```ts
export function normalizeExternalHttpUrl(raw: string, options: SafeExternalUrlOptions = {}): string {
  const parsed = new URL(String(raw || '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new BadRequestException(`${label} must use http or https`);
  if (parsed.username || parsed.password) throw new BadRequestException(`${label} must not contain credentials`);
  assertPublicHostname(parsed.hostname, label);
  return normalized;
}
```

- [ ] **Step 4: Implement DNS resolution check**

```ts
export async function assertPublicResolvedUrl(raw: string, options: SafeExternalUrlOptions = {}): Promise<string> {
  const normalized = normalizeExternalHttpUrl(raw, options);
  const parsed = new URL(normalized);
  if (isIP(parsed.hostname)) return normalized;
  const records = await lookup(parsed.hostname, { all: true, verbatim: true });
  for (const record of records) assertPublicIp(record.address, options.label || 'URL');
  return normalized;
}
```

- [ ] **Step 5: Run utility spec and confirm pass**

Run: `cd server && pnpm test -- safe-url.util.spec.ts --runInBand --forceExit`

Expected: PASS.

## Task 4: Guard AI Provider Base URLs

**Files:**
- Modify: `server/src/module/ai/services/ai-admin.service.ts`
- Test: `server/src/module/ai/services/ai-admin.service.spec.ts`

**Interfaces:**
- Consumes: `normalizeExternalHttpUrl`.
- Consumes: `assertPublicResolvedUrl`.
- Produces: unsafe provider `base_url` is rejected on create/update/test before any remote model call.

- [ ] **Step 1: Add failing AI service tests**

```ts
await expect(
  service.createProvider(user, {
    code: 'local',
    name: 'Local',
    base_url: 'http://127.0.0.1:11434/v1',
    api_key: 'secret',
  } as any),
).rejects.toBeInstanceOf(BadRequestException);
```

```ts
await expect(service.testProvider(user, '1', { model_code: 'gpt-test' } as any)).rejects.toBeInstanceOf(
  BadRequestException,
);
expect(llmProviderService.completeChat).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run AI service spec and confirm failure**

Run: `cd server && pnpm test -- ai-admin.service.spec.ts --runInBand --forceExit`

Expected before implementation: FAIL because unsafe local base URLs are accepted.

- [ ] **Step 3: Validate base_url on create/update**

```ts
baseUrl: normalizeExternalHttpUrl(body.base_url, {
  label: 'base_url',
  stripTrailingSlash: true,
  allowQuery: false,
}),
```

- [ ] **Step 4: Validate resolved URL before provider test**

```ts
await assertPublicResolvedUrl(provider.baseUrl, {
  label: 'base_url',
  stripTrailingSlash: true,
  allowQuery: false,
});
```

- [ ] **Step 5: Run AI service spec and confirm pass**

Run: `cd server && pnpm test -- ai-admin.service.spec.ts --runInBand --forceExit`

Expected: PASS.

## Task 5: Guard Taixu Website Imports

**Files:**
- Modify: `server/src/module/taixu/document/taixu-document.service.ts`
- Modify: `server/src/module/taixu/document/dto/document.dto.ts`
- Create: `server/src/module/taixu/document/taixu-document.service.spec.ts`

**Interfaces:**
- Consumes: `assertPublicResolvedUrl`.
- Produces: `uploadWebsite()` rejects unsafe URLs before `axios.get`.
- Produces: `axios.get()` uses `maxRedirects: 0` to avoid redirecting from a public URL to a private URL.

- [ ] **Step 1: Add service tests**

```ts
await expect(service.uploadWebsite('http://127.0.0.1/admin')).rejects.toBeInstanceOf(BadRequestException);
expect(axios.get).not.toHaveBeenCalled();
```

```ts
await service.uploadWebsite('https://93.184.216.34/docs');
expect(axios.get).toHaveBeenCalledWith(
  'https://93.184.216.34/docs',
  expect.objectContaining({ timeout: 15000, responseType: 'arraybuffer', maxRedirects: 0 }),
);
```

- [ ] **Step 2: Run Taixu document spec and confirm failure**

Run: `cd server && pnpm test -- taixu-document.service.spec.ts --runInBand --forceExit`

Expected before implementation: FAIL because the spec does not exist or unsafe URLs are fetched.

- [ ] **Step 3: Validate website URL before fetch**

```ts
const safeWebsite = await assertPublicResolvedUrl(website, { label: 'website' });
const res = await axios.get(safeWebsite, { timeout: 15000, responseType: 'arraybuffer', maxRedirects: 0 });
```

- [ ] **Step 4: Add DTO URL validation**

```ts
@IsUrl({ protocols: ['http', 'https'], require_protocol: true })
@MaxLength(2048)
website: string;
```

- [ ] **Step 5: Run Taixu document spec and confirm pass**

Run: `cd server && pnpm test -- taixu-document.service.spec.ts --runInBand --forceExit`

Expected: PASS.

## Task 6: Align Frontend Member Password Validation

**Files:**
- Modify: `web/src/views/saas/tenant/member/index.vue`

**Interfaces:**
- Produces: member create/reset forms require at least 8 chars with letters and digits, matching backend DTO policy.

- [ ] **Step 1: Add shared regex and message**

```ts
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/
const PASSWORD_MESSAGE = '请输入至少 8 位且包含字母和数字的密码'
```

- [ ] **Step 2: Use the rule in both forms**

```ts
password: [{ required: true, pattern: PASSWORD_PATTERN, message: PASSWORD_MESSAGE, trigger: 'blur' }]
```

- [ ] **Step 3: Run frontend typecheck**

Run: `cd web && pnpm exec vue-tsc --noEmit --pretty false`

Expected: exit code 0.

## Task 7: Verification, Review, and Commit

**Files:**
- Modify: all files listed above.

**Interfaces:**
- Produces: a local commit on `saas-order-risk-ops`.

- [ ] **Step 1: Run focused backend tests**

Run: `cd server && pnpm test -- saas-tenant.controller.spec.ts align-saas-tenant-member-menu.spec.ts safe-url.util.spec.ts ai-admin.service.spec.ts taixu-document.service.spec.ts --runInBand --forceExit`

Expected: all selected suites pass.

- [ ] **Step 2: Run backend typecheck**

Run: `cd server && pnpm run typecheck`

Expected: exit code 0.

- [ ] **Step 3: Run frontend typecheck**

Run: `cd web && pnpm exec vue-tsc --noEmit --pretty false`

Expected: exit code 0.

- [ ] **Step 4: Run diff checks**

Run: `git diff --check && git diff --cached --check`

Expected: exit code 0; CRLF warnings are acceptable if no whitespace errors are reported.

- [ ] **Step 5: Review changes**

Run: `git diff --stat && git status --short`

Expected: only P1 permission, URL guard, Taixu website import, AI provider URL, frontend password validation, tests, and this plan file are present.

- [ ] **Step 6: Commit**

```bash
git add server/src/module/saas/saas-tenant.controller.ts server/src/module/saas/saas-tenant.controller.spec.ts server/src/migrations/1760000000015-AlignSaasTenantMemberMenu.ts server/src/migration-specs/align-saas-tenant-member-menu.spec.ts server/src/common/utils/safe-url.util.ts server/src/common/utils/safe-url.util.spec.ts server/src/module/ai/services/ai-admin.service.ts server/src/module/ai/services/ai-admin.service.spec.ts server/src/module/taixu/document/taixu-document.service.ts server/src/module/taixu/document/dto/document.dto.ts server/src/module/taixu/document/taixu-document.service.spec.ts web/src/views/saas/tenant/member/index.vue docs/superpowers/plans/2026-07-07-p1-saas-permission-ssrf-hardening.md
git commit -m "fix: harden tenant permissions and outbound urls"
```

Expected: commit created on `saas-order-risk-ops`.

## Self-Review

- Spec coverage: tenant member permissions, route parameter parsing, migration seeding, AI provider URL safety, Taixu website URL safety, frontend password validation, verification, review, and commit are covered.
- Placeholder scan: no placeholder implementation steps remain.
- Type consistency: `normalizeExternalHttpUrl`, `assertPublicResolvedUrl`, `tenant:member:update`, `tenant:member:remove`, and `tenant:member:reset-password` are used consistently.
