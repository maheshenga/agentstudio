# SaaS Module Access Hardening P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make tenant-scoped feature checks use the system-module access gate while preserving existing SaaS plan behavior and error semantics.

**Architecture:** Extend `SystemModuleAccessService.assertModuleAccess` with an optional `requiredSaasModuleCode` gate. Route-level module checks keep validating the broad system module, while service-level feature checks can require a precise commercial SaaS module such as `ai_chat`. Migrate AI chat send to the system-module gate first because it is a high-value tenant feature outside the SaaS controller package and already guarded by `/api/ai -> ai_console`.

**Tech Stack:** NestJS, TypeORM repositories, Jest, existing SaaS module bridge constants, existing AI chat quota tests.

---

## File Structure

- Modify: `server/src/module/system-module/services/system-module-access.service.ts`
  - Add `requiredSaasModuleCode?: string` to access options.
  - Load tenant SaaS module codes once when a precise SaaS feature gate is required.
  - Deny missing required SaaS feature with the existing message `Current plan has not enabled this module`.
- Modify: `server/src/module/system-module/services/system-module-access.service.spec.ts`
  - Add coverage for exact SaaS feature allow/deny behavior.
  - Prove a broad system entitlement such as `rag -> taixu_workspace` does not satisfy an `ai_chat` feature gate.
- Modify: `server/src/module/ai/services/chat.service.ts`
  - Replace direct `SaasModuleService.assertTenantModuleEnabled(tenantId, 'ai_chat')` with `SystemModuleAccessService.assertModuleAccess({ moduleCode: 'ai_console', requiredSaasModuleCode: 'ai_chat' })`.
- Modify: `server/src/module/ai/services/chat.service.spec.ts`
  - Replace the direct SaaS module mock with `SystemModuleAccessService`.
  - Verify the access gate still runs before quota checks and message writes.

## Scope

### In Scope

- AI chat feature gate migration.
- Reusable `requiredSaasModuleCode` support in `SystemModuleAccessService`.
- Focused backend tests and backend build.

### Out Of Scope

- Rewriting SaaS tenant controller and resource-pack order service gates in this P0 slice.
- Frontend changes.
- Database schema changes.
- Remote push.

Reason for excluding SaaS services in P0: `SystemModuleAccessService` already depends on `SaasModuleService` to derive plan entitlements. Moving providers inside `SaasModule` to depend back on `SystemModuleAccessService` should be done as a separate P1 cycle after dependency-direction review, so P0 does not introduce a risky Nest provider cycle.

---

## Task 1: Add Precise SaaS Feature Gate To SystemModuleAccessService

**Files:**
- Modify: `server/src/module/system-module/services/system-module-access.service.ts`
- Test: `server/src/module/system-module/services/system-module-access.service.spec.ts`

- [ ] **Step 1: Write failing tests for exact feature gates**

Add these tests near the existing SaaS bridge tests:

```ts
it('allows access when the required SaaS feature is present', async () => {
  const { service } = createService({
    modules: [enabledModule('ai_console')],
  });

  await expect(
    service.assertModuleAccess({
      tenantId: 10,
      moduleCode: 'ai_console',
      requiredSaasModuleCode: 'ai_chat',
      saasModuleCodes: ['ai_chat'],
    }),
  ).resolves.toBe(true);
});

it('denies access when the exact required SaaS feature is missing', async () => {
  const { service } = createService({
    modules: [enabledModule('taixu_workspace')],
  });

  await expect(
    service.assertModuleAccess({
      tenantId: 10,
      moduleCode: 'taixu_workspace',
      requiredSaasModuleCode: 'ai_chat',
      saasModuleCodes: ['rag'],
    }),
  ).rejects.toThrow('Current plan has not enabled this module');
});

it('does not let an explicit tenant module bypass a required SaaS feature gate', async () => {
  const { service } = createService({
    modules: [enabledModule('ai_console')],
    tenantModules: [{ tenantId: 10, moduleCode: 'ai_console', enabled: 1 }],
    saasModuleCodes: ['rag'],
  });

  await expect(
    service.assertModuleAccess({
      tenantId: 10,
      moduleCode: 'ai_console',
      requiredSaasModuleCode: 'ai_chat',
    }),
  ).rejects.toThrow('Current plan has not enabled this module');
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/services/system-module-access.service.spec.ts --runInBand
```

Expected: FAIL with TypeScript or assertion errors because `requiredSaasModuleCode` is not implemented.

- [ ] **Step 3: Implement the minimal access-service change**

Update the interface and the tenant-gate block to this shape:

```ts
export interface AssertModuleAccessOptions {
  tenantId?: number;
  userId?: number;
  moduleCode: string;
  permission?: string;
  userPermissions?: string[];
  saasModuleCodes?: string[];
  requiredSaasModuleCode?: string;
}
```

```ts
if (options.tenantId !== undefined) {
  const tenantSaasModuleCodes =
    options.requiredSaasModuleCode || options.saasModuleCodes
      ? options.saasModuleCodes ?? (await this.loadTenantSaasModuleCodes(options.tenantId))
      : undefined;

  if (
    options.requiredSaasModuleCode &&
    !(tenantSaasModuleCodes || []).includes(options.requiredSaasModuleCode)
  ) {
    throw new BadRequestException('Current plan has not enabled this module');
  }

  const entitled = await this.isTenantEntitled(
    options.tenantId,
    options.moduleCode,
    tenantSaasModuleCodes,
  );
  if (!entitled) {
    throw new BadRequestException('Tenant has not enabled this module');
  }
}
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/services/system-module-access.service.spec.ts --runInBand
```

Expected: PASS.

---

## Task 2: Migrate AI Chat Send To SystemModuleAccessService

**Files:**
- Modify: `server/src/module/ai/services/chat.service.ts`
- Modify: `server/src/module/ai/services/chat.service.spec.ts`

- [ ] **Step 1: Update the AI chat test to expect the system-module gate**

In `chat.service.spec.ts`, replace:

```ts
import { SaasModuleService } from '../../saas/services/saas-module.service';
```

with:

```ts
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
```

Replace the mock:

```ts
const saasModuleService = {
  assertTenantModuleEnabled: jest.fn(),
};
```

with:

```ts
const systemModuleAccessService = {
  assertModuleAccess: jest.fn(),
};
```

Replace the provider:

```ts
{ provide: SaasModuleService, useValue: saasModuleService },
```

with:

```ts
{ provide: SystemModuleAccessService, useValue: systemModuleAccessService },
```

Update the first test to:

```ts
it('checks AI chat module before quota and message writes', async () => {
  aiConfigService.isAiEnabled.mockResolvedValue(true);
  sessionRepo.findOne.mockResolvedValue({
    id: 'session-db-id',
    sessionUuid: 'session-uuid',
    userId: 7,
    tenantId: 42,
    defaultModelId: 'model-1',
    messageCount: 0,
  });
  systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(new BadRequestException('Module disabled'));

  await expect(
    service.handleChatSend(
      { userId: 7, tenantId: 42, userName: 'owner' } as any,
      { session_uuid: 'session-uuid', content: 'hello' } as any,
      jest.fn(),
    ),
  ).rejects.toThrow('Module disabled');

  expect(systemModuleAccessService.assertModuleAccess).toHaveBeenCalledWith({
    tenantId: 42,
    userId: 7,
    moduleCode: 'ai_console',
    requiredSaasModuleCode: 'ai_chat',
  });
  expect(saasQuotaService.assertTenantQuotaAvailable).not.toHaveBeenCalled();
  expect(messageRepo.save).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused AI test and confirm RED**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/ai/services/chat.service.spec.ts --runInBand
```

Expected: FAIL because `ChatService` still injects and calls `SaasModuleService`.

- [ ] **Step 3: Implement the minimal ChatService change**

In `chat.service.ts`, replace:

```ts
import { SaasModuleService } from '../../saas/services/saas-module.service';
```

with:

```ts
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
```

Replace the constructor dependency:

```ts
private readonly saasModuleService: SaasModuleService,
```

with:

```ts
private readonly systemModuleAccessService: SystemModuleAccessService,
```

Replace the direct gate:

```ts
await this.saasModuleService.assertTenantModuleEnabled(owned.tenantId, 'ai_chat');
```

with:

```ts
await this.systemModuleAccessService.assertModuleAccess({
  tenantId: owned.tenantId,
  userId: owned.userId,
  moduleCode: 'ai_console',
  requiredSaasModuleCode: 'ai_chat',
});
```

- [ ] **Step 4: Run the focused AI test and confirm GREEN**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/ai/services/chat.service.spec.ts --runInBand
```

Expected: PASS.

---

## Task 3: Integration Verification And Review

**Files:**
- Review only: `server/src/module/system-module/services/system-module-access.service.ts`
- Review only: `server/src/module/ai/services/chat.service.ts`
- Review only: related specs

- [ ] **Step 1: Run focused backend tests**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/services/system-module-access.service.spec.ts src/module/system-module/system-module.guard.spec.ts src/module/ai/services/chat.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Review the diff**

Run:

```powershell
git diff -- server/src/module/system-module/services/system-module-access.service.ts server/src/module/system-module/services/system-module-access.service.spec.ts server/src/module/ai/services/chat.service.ts server/src/module/ai/services/chat.service.spec.ts docs/superpowers/plans/2026-07-06-saas-module-access-hardening-p0.md
```

Check:
- No unrelated formatting churn.
- Error message for missing exact feature remains `Current plan has not enabled this module`.
- Route-level `SystemModuleGuard` behavior is unchanged.
- AI chat still checks quotas after module access and before message writes.

- [ ] **Step 4: Commit P0**

Stage only intentional files:

```powershell
git add docs/superpowers/plans/2026-07-06-saas-module-access-hardening-p0.md server/src/module/system-module/services/system-module-access.service.ts server/src/module/system-module/services/system-module-access.service.spec.ts server/src/module/ai/services/chat.service.ts server/src/module/ai/services/chat.service.spec.ts
git commit -m "fix: harden ai saas module access gate"
```

Do not stage:

```text
server/pnpm-lock.yaml
.codebase-memory/
.codegraph/
```

---

## Self-Review

Spec coverage:
- The plan covers the highest-risk split gate: AI chat used direct `SaasModuleService` while the global module guard used `SystemModuleAccessService`.
- The plan adds reusable precise SaaS feature checking to `SystemModuleAccessService`.
- The plan preserves existing SaaS package behavior and does not change route-level bindings.

Placeholder scan:
- No TBD/TODO placeholders.
- Every code change has concrete expected snippets and verification commands.

Risk controls:
- P0 does not introduce a provider-cycle risk by changing SaaS services that are already part of the dependency source used by `SystemModuleAccessService`.
- Tests prove exact commercial feature gates are stricter than broad system-module entitlement.
