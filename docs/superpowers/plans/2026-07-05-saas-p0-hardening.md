# SaaS P0 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the current SaaS foundation by fixing user-facing mojibake messages and enforcing one active subscription per tenant.

**Architecture:** Keep the changes narrow and backend-first. User-facing messages are corrected where the SaaS services throw errors; the subscription invariant is enforced at the database layer with a generated active-tenant key and a unique index so existing service flows continue to work.

**Tech Stack:** NestJS, TypeORM, MySQL migrations, Jest, pnpm.

**Execution Note:** During implementation, Node/Jest UTF-8 reads showed the SaaS service messages already resolve to normal Chinese at runtime; PowerShell `Get-Content` was displaying UTF-8 as mojibake. Task 1 therefore adds Unicode regression coverage and does not require production message edits.

---

## File Structure

- Modify: `server/src/module/saas/services/saas-quota.service.spec.ts`
  - Add/adjust regression tests that assert readable Chinese error messages for quota exhaustion, missing tenant context, and AI quota consumption.
- No production message file changes required after UTF-8 runtime verification.
- Create: `server/src/migrations/1760000000022-EnforceSingleActiveSaasSubscription.ts`
  - Expire duplicate active subscriptions, add generated `active_tenant_id`, add unique index.
- Create: `server/src/migration-specs/enforce-single-active-saas-subscription.spec.ts`
  - Verify the migration cleans duplicates, creates the generated column, and creates/drops the unique index.
- Modify: `server/src/module/saas/entities/saas-subscription.entity.ts`
  - Add a read-only generated-column mapping for `active_tenant_id`.

---

### Task 1: Guard SaaS Messages Against Mojibake Regression

**Files:**
- Modify: `server/src/module/saas/services/saas-quota.service.spec.ts`
- No production message file changes required after UTF-8 runtime verification.

- [ ] **Step 1: Write failing tests for readable messages**

Add or update these expectations in `server/src/module/saas/services/saas-quota.service.spec.ts`:

```typescript
await expect(
  service.assertTenantQuotaAvailable(42, 'ai_calls', 1, 'AI 调用次数额度不足'),
).rejects.toThrow('AI 调用次数额度不足');

await expect(service.assertTenantQuotaAvailable(0, 'tokens', 1)).rejects.toThrow('缺少租户上下文');

await expect(service.consumeTenantQuota(0, 'tokens', 1)).rejects.toThrow('缺少租户上下文');
```

For `consumeAiUsage`, mock `consumeTenantQuota` to throw using the provided option messages and assert the thrown message is readable:

```typescript
const spy = jest
  .spyOn(service, 'consumeTenantQuota')
  .mockRejectedValueOnce(new BadRequestException('AI 调用次数额度不足'));

await expect(service.consumeAiUsage(42, { totalTokens: 100 })).rejects.toThrow('AI 调用次数额度不足');
expect(spy).toHaveBeenCalledWith(
  42,
  'ai_calls',
  1,
  expect.objectContaining({ message: 'AI 调用次数额度不足' }),
  expect.anything(),
);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd server
pnpm.cmd exec jest src/module/saas/services/saas-quota.service.spec.ts --runInBand
```

Expected before implementation: FAIL because current messages include mojibake text such as `璧勬簮棰濆害涓嶈冻`.

- [ ] **Step 3: Replace mojibake production strings**

In `server/src/module/saas/services/saas-quota.service.ts`, use these exact readable messages:

```typescript
message = '资源额度不足'
throw new BadRequestException('缺少租户上下文');
throw new BadRequestException(options.message || '资源额度不足');
{ message: 'AI 调用次数额度不足', sourceType: 'ai_chat', remark: 'AI chat completed' }
{ message: 'Token 额度不足', sourceType: 'ai_chat', remark: 'AI chat completed' }
```

In `server/src/module/saas/services/saas-provisioning.service.ts`, use:

```typescript
throw new BadRequestException('登录账号或租户编码已存在，请更换后重试');
```

- [ ] **Step 4: Run focused quota tests and verify GREEN**

Run:

```bash
cd server
pnpm.cmd exec jest src/module/saas/services/saas-quota.service.spec.ts --runInBand
```

Expected after implementation: PASS.

---

### Task 2: Enforce One Active SaaS Subscription Per Tenant

**Files:**
- Create: `server/src/migrations/1760000000022-EnforceSingleActiveSaasSubscription.ts`
- Create: `server/src/migration-specs/enforce-single-active-saas-subscription.spec.ts`
- Modify: `server/src/module/saas/entities/saas-subscription.entity.ts`

- [ ] **Step 1: Write failing migration spec**

Create `server/src/migration-specs/enforce-single-active-saas-subscription.spec.ts`:

```typescript
import { EnforceSingleActiveSaasSubscription1760000000022 } from '../migrations/1760000000022-EnforceSingleActiveSaasSubscription';

describe('EnforceSingleActiveSaasSubscription1760000000022', () => {
  it('expires duplicate active subscriptions before adding a unique active tenant index', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new EnforceSingleActiveSaasSubscription1760000000022().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('UPDATE `saas_subscription` `subscription`');
    expect(sql).toContain("`subscription`.`status` = 'active'");
    expect(sql).toContain('ADD COLUMN `active_tenant_id` bigint GENERATED ALWAYS AS');
    expect(sql).toContain("`status` = 'active'");
    expect(sql).toContain('CREATE UNIQUE INDEX `uk_saas_subscription_active_tenant`');
  });

  it('drops the unique active tenant index and generated column on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new EnforceSingleActiveSaasSubscription1760000000022().down(queryRunner as any);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'DROP INDEX `uk_saas_subscription_active_tenant` ON `saas_subscription`',
    );
    expect(queryRunner.query).toHaveBeenCalledWith('ALTER TABLE `saas_subscription` DROP COLUMN `active_tenant_id`');
  });
});
```

- [ ] **Step 2: Run migration spec and verify RED**

Run:

```bash
cd server
pnpm.cmd exec jest src/migration-specs/enforce-single-active-saas-subscription.spec.ts --runInBand
```

Expected before implementation: FAIL because the migration file does not exist.

- [ ] **Step 3: Add migration**

Create `server/src/migrations/1760000000022-EnforceSingleActiveSaasSubscription.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceSingleActiveSaasSubscription1760000000022 implements MigrationInterface {
  name = 'EnforceSingleActiveSaasSubscription1760000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`saas_subscription\` \`subscription\`
      INNER JOIN (
        SELECT \`tenant_id\`, MAX(\`id\`) AS \`keep_id\`
        FROM \`saas_subscription\`
        WHERE \`status\` = 'active'
          AND \`delete_time\` IS NULL
        GROUP BY \`tenant_id\`
        HAVING COUNT(1) > 1
      ) \`duplicate_active\`
        ON \`duplicate_active\`.\`tenant_id\` = \`subscription\`.\`tenant_id\`
      SET
        \`subscription\`.\`status\` = 'expired',
        \`subscription\`.\`end_time\` = COALESCE(\`subscription\`.\`end_time\`, NOW()),
        \`subscription\`.\`remark\` = CONCAT(
          COALESCE(\`subscription\`.\`remark\`, ''),
          ' Expired by single active subscription migration'
        )
      WHERE \`subscription\`.\`status\` = 'active'
        AND \`subscription\`.\`delete_time\` IS NULL
        AND \`subscription\`.\`id\` <> \`duplicate_active\`.\`keep_id\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`saas_subscription\`
      ADD COLUMN \`active_tenant_id\` bigint GENERATED ALWAYS AS (
        CASE
          WHEN \`status\` = 'active' AND \`delete_time\` IS NULL THEN \`tenant_id\`
          ELSE NULL
        END
      ) STORED
    `);

    await queryRunner.query(
      'CREATE UNIQUE INDEX `uk_saas_subscription_active_tenant` ON `saas_subscription` (`active_tenant_id`)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX `uk_saas_subscription_active_tenant` ON `saas_subscription`');
    await queryRunner.query('ALTER TABLE `saas_subscription` DROP COLUMN `active_tenant_id`');
  }
}
```

- [ ] **Step 4: Add entity mapping**

In `server/src/module/saas/entities/saas-subscription.entity.ts`, add the generated column after `tenantId`:

```typescript
@Column({
  type: 'bigint',
  name: 'active_tenant_id',
  asExpression: "CASE WHEN `status` = 'active' AND `delete_time` IS NULL THEN `tenant_id` ELSE NULL END",
  generatedType: 'STORED',
  nullable: true,
  select: false,
  insert: false,
  update: false,
})
activeTenantId?: number | null;
```

- [ ] **Step 5: Run migration spec and verify GREEN**

Run:

```bash
cd server
pnpm.cmd exec jest src/migration-specs/enforce-single-active-saas-subscription.spec.ts --runInBand
```

Expected after implementation: PASS.

---

### Task 3: Full Verification, Review, and Commit

**Files:**
- No additional production files expected.

- [ ] **Step 1: Run focused SaaS tests**

Run:

```bash
cd server
pnpm.cmd exec jest src/module/saas/services/saas-quota.service.spec.ts src/migration-specs/enforce-single-active-saas-subscription.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run broader backend verification**

Run:

```bash
cd server
pnpm.cmd exec jest --runInBand
pnpm.cmd run build
```

Expected: all Jest suites pass and the backend build exits 0.

- [ ] **Step 3: Review the diff**

Run:

```bash
git diff -- server/src/module/saas/services/saas-quota.service.ts server/src/module/saas/services/saas-quota.service.spec.ts server/src/module/saas/services/saas-provisioning.service.ts server/src/module/saas/entities/saas-subscription.entity.ts server/src/migrations/1760000000022-EnforceSingleActiveSaasSubscription.ts server/src/migration-specs/enforce-single-active-saas-subscription.spec.ts docs/superpowers/plans/2026-07-05-saas-p0-hardening.md
```

Check:
- No mojibake remains in touched SaaS error messages.
- The migration rollback reverses only what this migration adds.
- Existing unrelated dirty files remain unstaged.

- [ ] **Step 4: Commit only this task's files**

Run:

```bash
git add docs/superpowers/plans/2026-07-05-saas-p0-hardening.md \
  server/src/module/saas/services/saas-quota.service.ts \
  server/src/module/saas/services/saas-quota.service.spec.ts \
  server/src/module/saas/services/saas-provisioning.service.ts \
  server/src/module/saas/entities/saas-subscription.entity.ts \
  server/src/migrations/1760000000022-EnforceSingleActiveSaasSubscription.ts \
  server/src/migration-specs/enforce-single-active-saas-subscription.spec.ts
git commit -m "fix: harden saas subscription and messages"
```

Expected: commit succeeds; `server/pnpm-lock.yaml`, `.codebase-memory/`, and `.codegraph/` remain uncommitted unless they were already intentionally staged outside this task.

---

## Self-Review

- Spec coverage: The plan covers the P0 items selected from the SaaS analysis: readable prompts and active subscription uniqueness.
- Placeholder scan: No TBD/TODO/fill-in instructions remain.
- Type consistency: The migration class name, filename, entity field, and spec import all use `EnforceSingleActiveSaasSubscription1760000000022`.
