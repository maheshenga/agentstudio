# P2 SaaS Operational Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix medium-priority SaaS operational risks around payment secret storage, quota correctness, tenant member counting, and resource-pack delivery consistency.

**Architecture:** Keep existing service boundaries. Add focused Jest regression tests first, then make minimal service changes that preserve public API contracts and existing database schema.

**Tech Stack:** NestJS 11, TypeORM repository mocks, Jest, existing `ai-crypto.util` AES-GCM secret helpers.

---

## File Structure

- `server/src/module/saas/services/saas-payment-config.service.spec.ts`
  - Extend tests to verify Alipay private/public keys are encrypted at rest and decrypted only for runtime resolution/status checks.
- `server/src/module/saas/services/saas-payment-config.service.ts`
  - Reuse `encryptAiSecret` and `decryptAiSecret` for Alipay key fields.
- `server/src/module/saas/services/saas-tenant-member.service.spec.ts`
  - New focused test for quota counting excluding soft-deleted `SysUserTenantEntity` rows.
- `server/src/module/saas/services/saas-tenant-member.service.ts`
  - Add `deleteTime: IsNull()` to the quota count.
- `server/src/module/saas/services/saas-quota.service.spec.ts`
  - Add regression tests proving initialization preserves stateful `usedQuota` for existing resources.
- `server/src/module/saas/services/saas-quota.service.ts`
  - Replace unconditional `upsert(... usedQuota: 0 ...)` with create-or-update logic that updates quota/status while preserving existing `usedQuota`.
- `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
  - Add regression test proving quota grant failures do not leave an in-memory order marked paid/delivered before the transaction rolls back.
- `server/src/module/saas/services/saas-resource-pack-order.service.ts`
  - Move paid/delivered mutation after successful quota grant.

## Task 1: Encrypt Alipay Payment Secrets

**Files:**
- Modify: `server/src/module/saas/services/saas-payment-config.service.spec.ts`
- Modify: `server/src/module/saas/services/saas-payment-config.service.ts`

- [ ] **Step 1: Write failing tests**

Mock `../../../common/utils/ai-crypto.util`:

```typescript
jest.mock('../../../common/utils/ai-crypto.util', () => ({
  encryptAiSecret: jest.fn((value) => `enc:${value}`),
  decryptAiSecret: jest.fn((value) => String(value).replace(/^enc:/, '')),
  maskAiSecret: jest.fn((value) => `mask:${value}`),
}));
```

Add tests:

```typescript
it('encrypts Alipay private and public keys before saving them', async () => {
  repo.findOne.mockResolvedValue(null);
  repo.create.mockImplementation((value) => value);
  repo.save.mockImplementation(async (value) => value);

  await service.updateAlipayConfig({
    enabled: true,
    app_id: 'app-id',
    private_key: 'plain-private',
    public_key: 'plain-public',
    gateway_url: 'gateway',
    notify_url: 'notify',
    return_url: 'return',
  });

  expect(repo.save).toHaveBeenCalledWith(
    expect.objectContaining({
      privateKey: 'enc:plain-private',
      publicKey: 'enc:plain-public',
    }),
  );
});

it('decrypts encrypted Alipay keys only when resolving runtime config', async () => {
  repo.findOne.mockResolvedValue({
    provider: 'alipay',
    scope: 'platform',
    enabled: 1,
    appId: 'app-id',
    privateKey: 'enc:plain-private',
    publicKey: 'enc:plain-public',
    gatewayUrl: 'gateway',
    notifyUrl: 'notify',
    returnUrl: 'return',
  });

  await expect(service.resolveAlipayConfig()).resolves.toMatchObject({
    privateKey: 'plain-private',
    publicKey: 'plain-public',
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `cd server; pnpm.cmd test -- saas-payment-config.service.spec.ts --runInBand`

Expected: encryption test fails because current service stores plaintext.

- [ ] **Step 3: Implement encryption/decryption**

Implementation:
- Import `encryptAiSecret` and `decryptAiSecret`.
- On non-blank `dto.private_key`, store `encryptAiSecret(dto.private_key.trim())`.
- On non-blank `dto.public_key`, store `encryptAiSecret(dto.public_key.trim())`.
- In `toResolvedConfig`, decrypt `config.privateKey` and `config.publicKey` before returning them.
- Keep blank update behavior unchanged so existing keys are preserved.

- [ ] **Step 4: Run focused tests**

Run: `cd server; pnpm.cmd test -- saas-payment-config.service.spec.ts --runInBand`

Expected: PASS.

## Task 2: Correct Tenant Member Quota Counting

**Files:**
- Create: `server/src/module/saas/services/saas-tenant-member.service.spec.ts`
- Modify: `server/src/module/saas/services/saas-tenant-member.service.ts`

- [ ] **Step 1: Write failing quota test**

Instantiate `SaasTenantMemberService` with a fake `DataSource.transaction` and manager. Mock enough manager methods for `createMember`.

Assertion:

```typescript
expect(manager.count).toHaveBeenCalledWith(SysUserTenantEntity, {
  where: { tenantId: 42, deleteTime: IsNull() },
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `cd server; pnpm.cmd test -- saas-tenant-member.service.spec.ts --runInBand`

Expected: count assertion fails because current code omits `deleteTime: IsNull()`.

- [ ] **Step 3: Implement count filter**

Change:

```typescript
const currentUsers = await manager.count(SysUserTenantEntity, { where: { tenantId } });
```

To:

```typescript
const currentUsers = await manager.count(SysUserTenantEntity, {
  where: { tenantId, deleteTime: IsNull() },
});
```

- [ ] **Step 4: Run focused test**

Run: `cd server; pnpm.cmd test -- saas-tenant-member.service.spec.ts --runInBand`

Expected: PASS.

## Task 3: Preserve Existing Used Quota During Plan Initialization

**Files:**
- Modify: `server/src/module/saas/services/saas-quota.service.spec.ts`
- Modify: `server/src/module/saas/services/saas-quota.service.ts`

- [ ] **Step 1: Write failing initialization test**

Add a test where an existing resource has `usedQuota: 7`, then `initializeTenantQuota` runs for the same resource.

Expected:
- Existing resource is saved with updated `totalQuota` and `status`.
- Existing resource keeps `usedQuota: 7`.
- No `upsert` call resets usage to zero.

- [ ] **Step 2: Run tests and verify they fail**

Run: `cd server; pnpm.cmd test -- saas-quota.service.spec.ts --runInBand`

Expected: new test fails because current implementation uses `upsert` with `usedQuota: 0`.

- [ ] **Step 3: Implement create-or-update initialization**

For each active plan quota:
- `findOne({ where: { tenantId, resourceType: item.quotaType } })`
- If exists, set `totalQuota` and `status = 1`, keep `usedQuota`.
- If missing, create row with `usedQuota: 0`.
- Save rows through the resolved tenant resource repo.

- [ ] **Step 4: Run focused quota tests**

Run: `cd server; pnpm.cmd test -- saas-quota.service.spec.ts --runInBand`

Expected: PASS.

## Task 4: Make Resource Pack Delivery Mutation Atomic-Friendly

**Files:**
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.ts`

- [ ] **Step 1: Write failing delivery mutation test**

Add test:

```typescript
it('does not mutate order as paid when quota delivery fails', async () => {
  const order = {
    orderNo: 'RPO1',
    tenantId: 12,
    resourceType: 'tokens',
    quotaAmount: 1000,
    status: SAAS_ORDER_PENDING,
  };
  txOrderRepo.findOne.mockResolvedValue(order);
  saasQuotaService.grantTenantQuota.mockRejectedValueOnce(new Error('grant failed'));

  await expect(service.confirmDevPayment(12, 'RPO1')).rejects.toThrow('grant failed');

  expect(order.status).toBe(SAAS_ORDER_PENDING);
  expect(order.paidAt).toBeUndefined();
  expect(order.deliveredAt).toBeUndefined();
  expect(txOrderRepo.save).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `cd server; pnpm.cmd test -- saas-resource-pack-order.service.spec.ts --runInBand`

Expected: new test fails because current code mutates `order.status`, `paidAt`, and `deliveredAt` before quota grant.

- [ ] **Step 3: Move mutation after successful quota grant**

Keep transaction and locking unchanged. Call `grantTenantQuota` first, then assign:

```typescript
order.status = SAAS_ORDER_PAID;
order.paidAt = paidAt;
order.deliveredAt = paidAt;
order.alipayTradeNo = options.resolveTradeNo(order);
```

Then save.

- [ ] **Step 4: Run focused resource-pack tests**

Run: `cd server; pnpm.cmd test -- saas-resource-pack-order.service.spec.ts --runInBand`

Expected: PASS.

## Task 5: Verify, Review, Commit

**Files:**
- All changed files in Tasks 1-4.

- [ ] **Step 1: Run focused P2 tests**

Run:

```powershell
cd server
pnpm.cmd test -- saas-payment-config.service.spec.ts saas-tenant-member.service.spec.ts saas-quota.service.spec.ts saas-resource-pack-order.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: exit 0.

- [ ] **Step 3: Review staged diff**

Run:

```powershell
git diff --check
git diff --stat
git diff -- docs/superpowers/plans/2026-07-06-p2-saas-operational-hardening.md server/src/module/saas/services/saas-payment-config.service.ts server/src/module/saas/services/saas-payment-config.service.spec.ts server/src/module/saas/services/saas-tenant-member.service.ts server/src/module/saas/services/saas-tenant-member.service.spec.ts server/src/module/saas/services/saas-quota.service.ts server/src/module/saas/services/saas-quota.service.spec.ts server/src/module/saas/services/saas-resource-pack-order.service.ts server/src/module/saas/services/saas-resource-pack-order.service.spec.ts
```

Expected: only P2 changes plus plan file.

- [ ] **Step 4: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-06-p2-saas-operational-hardening.md server/src/module/saas/services/saas-payment-config.service.ts server/src/module/saas/services/saas-payment-config.service.spec.ts server/src/module/saas/services/saas-tenant-member.service.ts server/src/module/saas/services/saas-tenant-member.service.spec.ts server/src/module/saas/services/saas-quota.service.ts server/src/module/saas/services/saas-quota.service.spec.ts server/src/module/saas/services/saas-resource-pack-order.service.ts server/src/module/saas/services/saas-resource-pack-order.service.spec.ts
git commit -m "fix: harden saas p2 operational flows"
```

Expected: commit created without staging unrelated `server/pnpm-lock.yaml`, `.codebase-memory/`, or `.codegraph/`.

## Self-Review

- Spec coverage: all P2 items from the audit are mapped to tests and implementation steps.
- Placeholder scan: no TBD/TODO/later-only instructions.
- Type consistency: existing service return shapes and database entity fields are preserved.
