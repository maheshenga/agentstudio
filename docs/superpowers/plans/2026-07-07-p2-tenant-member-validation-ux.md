# P2 Tenant Member Validation and UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish tenant member management hardening by validating mutation request bodies, aligning reset password policy with create-member policy, and hiding frontend actions when the user lacks the matching permission.

**Architecture:** Keep the current tenant member controller/service flow. Add focused DTOs next to `CreateTenantMemberDto`, reuse the same password pattern in the service, and add `v-permission` directives to the existing Vue action buttons without changing routes or API clients.

**Tech Stack:** NestJS, class-validator, Jest, Vue 3, Element Plus, pnpm, vue-tsc.

## Global Constraints

- Worktree: `E:\code\agentstudio\FssAdmin_NestJs\.worktrees\saas-order-risk-ops`.
- Branch: `saas-order-risk-ops`.
- Do not push unless the user explicitly asks.
- Do not change public API route paths.
- Keep P1 permission slugs: `tenant:member:create`, `tenant:member:update`, `tenant:member:remove`, `tenant:member:reset-password`.
- Keep backend and frontend password policy aligned: at least 8 characters and contains both letters and digits.

---

## File Structure

- Modify `server/src/module/saas/dto/create-tenant-member.dto.ts`: export shared password pattern and add mutation DTOs.
- Modify `server/src/module/saas/dto/create-tenant-member.dto.spec.ts`: add validation coverage for role/status/reset-password DTOs.
- Modify `server/src/module/saas/saas-tenant.controller.ts`: use the new DTO classes for role/status/reset-password bodies.
- Modify `server/src/module/saas/services/saas-tenant-member.service.ts`: enforce the same password pattern in `createMember` and `resetMemberPassword`.
- Modify `server/src/module/saas/services/saas-tenant-member.service.spec.ts`: cover weak create and reset password rejection.
- Modify `web/src/views/saas/tenant/member/index.vue`: add `v-permission` to create/update/reset/remove action buttons.

## Task 1: Add Tenant Member Mutation DTOs

**Files:**
- Modify: `server/src/module/saas/dto/create-tenant-member.dto.ts`
- Test: `server/src/module/saas/dto/create-tenant-member.dto.spec.ts`

**Interfaces:**
- Produces: `ChangeTenantMemberRoleDto` with `role: 'admin' | 'member'`.
- Produces: `UpdateTenantMemberStatusDto` with `status: 0 | 1`.
- Produces: `ResetTenantMemberPasswordDto` with the shared password policy.
- Produces: `TENANT_MEMBER_PASSWORD_PATTERN` export for service reuse.

- [ ] **Step 1: Add failing DTO tests**

```ts
await expect(validate(Object.assign(new ResetTenantMemberPasswordDto(), { password: '123456' }))).resolves.toEqual(
  expect.arrayContaining([expect.objectContaining({ property: 'password' })]),
);
await expect(validate(Object.assign(new ResetTenantMemberPasswordDto(), { password: 'Secret123' }))).resolves.toHaveLength(0);
```

```ts
await expect(validate(Object.assign(new ChangeTenantMemberRoleDto(), { role: 'owner' }))).resolves.toEqual(
  expect.arrayContaining([expect.objectContaining({ property: 'role' })]),
);
await expect(validate(Object.assign(new UpdateTenantMemberStatusDto(), { status: 2 }))).resolves.toEqual(
  expect.arrayContaining([expect.objectContaining({ property: 'status' })]),
);
```

- [ ] **Step 2: Run DTO spec and confirm failure**

Run: `cd server && pnpm test -- create-tenant-member.dto.spec.ts --runInBand --forceExit`

Expected before implementation: FAIL because the DTO classes are missing.

- [ ] **Step 3: Add DTO classes and exported pattern**

```ts
export const TENANT_MEMBER_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,100}$/;

export class ChangeTenantMemberRoleDto {
  @ApiProperty({ required: true, enum: ['admin', 'member'] })
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member';
}

export class UpdateTenantMemberStatusDto {
  @ApiProperty({ required: true, enum: [0, 1] })
  @IsIn([0, 1])
  status: 0 | 1;
}

export class ResetTenantMemberPasswordDto {
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(TENANT_MEMBER_PASSWORD_PATTERN)
  password: string;
}
```

- [ ] **Step 4: Run DTO spec and confirm pass**

Run: `cd server && pnpm test -- create-tenant-member.dto.spec.ts --runInBand --forceExit`

Expected: PASS.

## Task 2: Use DTOs in Controller and Service

**Files:**
- Modify: `server/src/module/saas/saas-tenant.controller.ts`
- Modify: `server/src/module/saas/services/saas-tenant-member.service.ts`
- Test: `server/src/module/saas/saas-tenant.controller.spec.ts`
- Test: `server/src/module/saas/services/saas-tenant-member.service.spec.ts`

**Interfaces:**
- Consumes: `ChangeTenantMemberRoleDto`, `UpdateTenantMemberStatusDto`, `ResetTenantMemberPasswordDto`.
- Consumes: `TENANT_MEMBER_PASSWORD_PATTERN`.
- Produces: create and reset password service methods reject weak passwords with the same policy as DTO.

- [ ] **Step 1: Update controller body types**

```ts
async changeMemberRole(@Param('user_id', ParseIntPipe) userId: number, @Body() body: ChangeTenantMemberRoleDto) {}
async updateMemberStatus(@Param('user_id', ParseIntPipe) userId: number, @Body() body: UpdateTenantMemberStatusDto) {}
async resetMemberPassword(@Param('user_id', ParseIntPipe) userId: number, @Body() body: ResetTenantMemberPasswordDto) {}
```

- [ ] **Step 2: Add service-level weak password tests**

```ts
await expect(service.createMember(88, { username: 'bob', password: '123456', role: 'member' })).rejects.toThrow(
  '成员密码至少 8 位且需要包含字母和数字',
);
await expect(service.resetMemberPassword(88, 8, '123456')).rejects.toThrow('新密码至少 8 位且需要包含字母和数字');
```

- [ ] **Step 3: Enforce shared pattern in service**

```ts
if (!TENANT_MEMBER_PASSWORD_PATTERN.test(String(dto.password || ''))) {
  throw new BadRequestException('成员密码至少 8 位且需要包含字母和数字');
}

if (!TENANT_MEMBER_PASSWORD_PATTERN.test(String(password || ''))) {
  throw new BadRequestException('新密码至少 8 位且需要包含字母和数字');
}
```

- [ ] **Step 4: Run controller and service specs**

Run: `cd server && pnpm test -- saas-tenant.controller.spec.ts saas-tenant-member.service.spec.ts --runInBand --forceExit`

Expected: PASS.

## Task 3: Gate Frontend Member Actions by Permission

**Files:**
- Modify: `web/src/views/saas/tenant/member/index.vue`

**Interfaces:**
- Produces: create button requires `tenant:member:create`.
- Produces: role/status buttons require `tenant:member:update`.
- Produces: reset password button requires `tenant:member:reset-password`.
- Produces: remove button requires `tenant:member:remove`.

- [ ] **Step 1: Add permission directives**

```vue
<ElButton v-permission="'tenant:member:create'" type="primary" @click="openCreateDialog">添加成员</ElButton>
<ElButton v-permission="'tenant:member:update'" link type="primary" @click="openRoleDialog(row)">角色</ElButton>
<ElButton v-permission="'tenant:member:update'" link :type="row.status === 1 ? 'warning' : 'success'" @click="toggleStatus(row)">
<ElButton v-permission="'tenant:member:reset-password'" link type="primary" @click="openResetPasswordDialog(row)">重置密码</ElButton>
<ElButton v-permission="'tenant:member:remove'" link type="danger" @click="removeMember(row)">移除</ElButton>
```

- [ ] **Step 2: Run frontend typecheck**

Run: `cd web && pnpm exec vue-tsc --noEmit --pretty false`

Expected: exit code 0.

## Task 4: Verification, Review, and Commit

**Files:**
- Modify: all files listed above plus this plan.

**Interfaces:**
- Produces: a local commit on `saas-order-risk-ops`.

- [ ] **Step 1: Run focused backend tests**

Run: `cd server && pnpm test -- create-tenant-member.dto.spec.ts saas-tenant.controller.spec.ts saas-tenant-member.service.spec.ts --runInBand --forceExit`

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

- [ ] **Step 5: Review and commit**

```bash
git add server/src/module/saas/dto/create-tenant-member.dto.ts server/src/module/saas/dto/create-tenant-member.dto.spec.ts server/src/module/saas/saas-tenant.controller.ts server/src/module/saas/services/saas-tenant-member.service.ts server/src/module/saas/services/saas-tenant-member.service.spec.ts web/src/views/saas/tenant/member/index.vue docs/superpowers/plans/2026-07-07-p2-tenant-member-validation-ux.md
git commit -m "fix: validate tenant member mutations"
```

Expected: commit created on `saas-order-risk-ops`.

## Self-Review

- Spec coverage: mutation DTOs, reset password service policy, frontend permission gating, verification, review, and commit are covered.
- Placeholder scan: no placeholder implementation steps remain.
- Type consistency: DTO class names and permission strings match controller and frontend usage.
