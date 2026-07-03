# SaaS AI Quota Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce and consume SaaS AI quotas whenever a tenant uses AI chat.

**Architecture:** Extend `SaasQuotaService` with small quota check/consume primitives, then inject it into `ChatService`. AI quota is checked before model streaming and consumed only after a completed assistant response is persisted.

**Tech Stack:** NestJS 11, TypeORM repositories, Jest, existing AI WebSocket flow, existing SaaS quota tables.

## Global Constraints

- Only quota keys `ai_calls` and `tokens` are in scope.
- Treat `total_quota <= 0` as unlimited.
- Do not consume quota for failed or stopped AI generations.
- Do not implement resource packs, token estimation, storage quota, RAG quota, or chat UI upgrade prompts in this slice.
- Preserve current AI message persistence and WebSocket event behavior.
- Use TDD for backend service behavior.
- Preserve unrelated dirty worktree changes.

---

## File Structure

- Modify `server/src/module/saas/services/saas-quota.service.ts`: add quota availability and consumption methods.
- Modify `server/src/module/saas/services/saas-quota.service.spec.ts`: add tests for finite quota, unlimited quota, exhausted quota, and AI usage consumption.
- Modify `server/src/module/ai/ai.module.ts`: import `SaasModule` so `ChatService` can inject `SaasQuotaService`.
- Modify `server/src/module/ai/services/chat.service.ts`: check AI quotas before provider streaming and consume usage after successful completion.
- Create `server/src/module/ai/services/chat.service.spec.ts`: focused tests for SaaS quota interaction in `ChatService`.

## Task 1: SaaS Quota Check And Consume Primitives

**Files:**
- Modify: `server/src/module/saas/services/saas-quota.service.ts`
- Modify: `server/src/module/saas/services/saas-quota.service.spec.ts`

**Interfaces:**
- Produces: `SaasQuotaService.assertTenantQuotaAvailable(tenantId: number, resourceType: string, amount: number, message?: string): Promise<void>`
- Produces: `SaasQuotaService.consumeTenantQuota(tenantId: number, resourceType: string, amount: number): Promise<void>`
- Produces: `SaasQuotaService.consumeAiUsage(tenantId: number, usage: { totalTokens?: number }): Promise<void>`

- [ ] **Step 1: Write failing quota tests**

Add mocks to `tenantResourceRepo`:

```ts
const tenantResourceRepo = {
  upsert: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  increment: jest.fn(),
};
```

Add tests to `server/src/module/saas/services/saas-quota.service.spec.ts`:

```ts
it('allows quota checks when remaining quota is enough', async () => {
  tenantResourceRepo.findOne.mockResolvedValue({
    tenantId: 42,
    resourceType: 'tokens',
    totalQuota: 100,
    usedQuota: 20,
    status: 1,
  });

  await expect(service.assertTenantQuotaAvailable(42, 'tokens', 30)).resolves.toBeUndefined();

  expect(tenantResourceRepo.findOne).toHaveBeenCalledWith({
    where: { tenantId: 42, resourceType: 'tokens', status: 1 },
  });
});

it('rejects quota checks when remaining quota is exhausted', async () => {
  tenantResourceRepo.findOne.mockResolvedValue({
    tenantId: 42,
    resourceType: 'ai_calls',
    totalQuota: 3,
    usedQuota: 3,
    status: 1,
  });

  await expect(
    service.assertTenantQuotaAvailable(42, 'ai_calls', 1, 'AI 调用次数额度不足'),
  ).rejects.toThrow('AI 调用次数额度不足');
});

it('treats non-positive total quota as unlimited', async () => {
  tenantResourceRepo.findOne.mockResolvedValue({
    tenantId: 42,
    resourceType: 'tokens',
    totalQuota: 0,
    usedQuota: 999999,
    status: 1,
  });

  await expect(service.assertTenantQuotaAvailable(42, 'tokens', 500)).resolves.toBeUndefined();
});

it('increments tenant quota usage when amount is positive', async () => {
  tenantResourceRepo.increment.mockResolvedValue({ affected: 1 });

  await service.consumeTenantQuota(42, 'tokens', 123);

  expect(tenantResourceRepo.increment).toHaveBeenCalledWith(
    { tenantId: 42, resourceType: 'tokens', status: 1 },
    'usedQuota',
    123,
  );
});

it('checks and consumes AI call and token usage', async () => {
  tenantResourceRepo.findOne
    .mockResolvedValueOnce({ tenantId: 42, resourceType: 'ai_calls', totalQuota: 10, usedQuota: 2, status: 1 })
    .mockResolvedValueOnce({ tenantId: 42, resourceType: 'tokens', totalQuota: 1000, usedQuota: 200, status: 1 });
  tenantResourceRepo.increment.mockResolvedValue({ affected: 1 });

  await service.consumeAiUsage(42, { totalTokens: 321 });

  expect(tenantResourceRepo.increment).toHaveBeenCalledWith(
    { tenantId: 42, resourceType: 'ai_calls', status: 1 },
    'usedQuota',
    1,
  );
  expect(tenantResourceRepo.increment).toHaveBeenCalledWith(
    { tenantId: 42, resourceType: 'tokens', status: 1 },
    'usedQuota',
    321,
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
pnpm run test -- saas-quota.service.spec.ts --runInBand
```

Expected: FAIL because `assertTenantQuotaAvailable`, `consumeTenantQuota`, and `consumeAiUsage` do not exist yet.

- [ ] **Step 3: Implement quota methods**

In `server/src/module/saas/services/saas-quota.service.ts`, import:

```ts
import { BadRequestException } from '@nestjs/common';
import { SAAS_QUOTA_AI_CALLS, SAAS_QUOTA_TOKENS } from '../constants';
```

Add methods inside `SaasQuotaService`:

```ts
async assertTenantQuotaAvailable(
  tenantId: number,
  resourceType: string,
  amount: number,
  message = '资源额度不足',
): Promise<void> {
  const normalizedAmount = Math.max(Number(amount || 0), 0);
  if (normalizedAmount <= 0) {
    return;
  }
  if (!tenantId) {
    throw new BadRequestException('缺少租户上下文');
  }

  const resource = await this.saasTenantResourceRepo.findOne({
    where: {
      tenantId,
      resourceType,
      status: 1,
    },
  });

  if (!resource) {
    throw new BadRequestException(message);
  }

  const totalQuota = Number(resource.totalQuota);
  if (totalQuota <= 0) {
    return;
  }

  const usedQuota = Number(resource.usedQuota);
  if (totalQuota - usedQuota < normalizedAmount) {
    throw new BadRequestException(message);
  }
}

async consumeTenantQuota(tenantId: number, resourceType: string, amount: number): Promise<void> {
  const normalizedAmount = Math.max(Number(amount || 0), 0);
  if (normalizedAmount <= 0) {
    return;
  }
  if (!tenantId) {
    throw new BadRequestException('缺少租户上下文');
  }

  await this.saasTenantResourceRepo.increment(
    {
      tenantId,
      resourceType,
      status: 1,
    },
    'usedQuota',
    normalizedAmount,
  );
}

async consumeAiUsage(tenantId: number, usage: { totalTokens?: number }): Promise<void> {
  const totalTokens = Math.max(Number(usage.totalTokens || 0), 0);

  await this.assertTenantQuotaAvailable(
    tenantId,
    SAAS_QUOTA_AI_CALLS,
    1,
    'AI 调用次数额度不足',
  );
  await this.assertTenantQuotaAvailable(
    tenantId,
    SAAS_QUOTA_TOKENS,
    totalTokens,
    'Token 额度不足',
  );

  await this.consumeTenantQuota(tenantId, SAAS_QUOTA_AI_CALLS, 1);
  await this.consumeTenantQuota(tenantId, SAAS_QUOTA_TOKENS, totalTokens);
}
```

- [ ] **Step 4: Run quota tests to verify they pass**

Run:

```powershell
pnpm run test -- saas-quota.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
git add server/src/module/saas/services/saas-quota.service.ts server/src/module/saas/services/saas-quota.service.spec.ts
git commit -m "feat: add SaaS quota consumption primitives"
```

## Task 2: AI Chat Quota Integration

**Files:**
- Modify: `server/src/module/ai/ai.module.ts`
- Modify: `server/src/module/ai/services/chat.service.ts`
- Create: `server/src/module/ai/services/chat.service.spec.ts`

**Interfaces:**
- Consumes: `SaasQuotaService.assertTenantQuotaAvailable(...)`
- Consumes: `SaasQuotaService.consumeAiUsage(...)`
- Produces: AI chat rejection before provider streaming when tenant quota is exhausted.
- Produces: AI quota consumption only after a completed assistant response.

- [ ] **Step 1: Write failing ChatService quota interaction test**

Create `server/src/module/ai/services/chat.service.spec.ts` with a focused unit test that mocks dependencies and verifies quota is checked after resolving the owned session:

```ts
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AiChatMessageEntity } from '../entities/ai-chat-message.entity';
import { AiChatSessionEntity } from '../entities/ai-chat-session.entity';
import { SAAS_QUOTA_AI_CALLS, SAAS_QUOTA_TOKENS } from '../../saas/constants';
import { SaasQuotaService } from '../../saas/services/saas-quota.service';
import { AiConfigService } from './ai-config.service';
import { ChatService } from './chat.service';
import { ContextBuilderService } from './context-builder.service';
import { LlmSemaphoreService } from './llm-semaphore.service';
import { SessionSummaryService } from './session-summary.service';

describe('ChatService SaaS quota integration', () => {
  const sessionRepo = {
    findOne: jest.fn(),
  };
  const messageRepo = {
    save: jest.fn(),
    create: jest.fn((value) => value),
    createQueryBuilder: jest.fn(),
  };
  const aiConfigService = {
    isAiEnabled: jest.fn(),
    resolveModel: jest.fn(),
  };
  const semaphore = {
    acquire: jest.fn(),
    release: jest.fn(),
  };
  const contextBuilder = {
    buildMessages: jest.fn(),
  };
  const sessionSummaryService = {
    scheduleSummarize: jest.fn(),
  };
  const saasQuotaService = {
    assertTenantQuotaAvailable: jest.fn(),
    consumeAiUsage: jest.fn(),
  };

  let service: ChatService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(AiChatSessionEntity), useValue: sessionRepo },
        { provide: getRepositoryToken(AiChatMessageEntity), useValue: messageRepo },
        { provide: AiConfigService, useValue: aiConfigService },
        { provide: LlmSemaphoreService, useValue: semaphore },
        { provide: ContextBuilderService, useValue: contextBuilder },
        { provide: SessionSummaryService, useValue: sessionSummaryService },
        { provide: SaasQuotaService, useValue: saasQuotaService },
      ],
    }).compile();

    service = module.get(ChatService);
  });

  it('checks AI call and token quota before creating chat messages', async () => {
    aiConfigService.isAiEnabled.mockResolvedValue(true);
    sessionRepo.findOne.mockResolvedValue({
      id: 'session-db-id',
      sessionUuid: 'session-uuid',
      userId: 7,
      tenantId: 42,
      defaultModelId: 'model-1',
      messageCount: 0,
    });
    saasQuotaService.assertTenantQuotaAvailable.mockRejectedValueOnce(
      new BadRequestException('AI 调用次数额度不足'),
    );

    await expect(
      service.handleChatSend(
        { userId: 7, tenantId: 42, userName: 'owner' } as any,
        { session_uuid: 'session-uuid', content: 'hello' } as any,
        jest.fn(),
      ),
    ).rejects.toThrow('AI 调用次数额度不足');

    expect(saasQuotaService.assertTenantQuotaAvailable).toHaveBeenCalledWith(
      42,
      SAAS_QUOTA_AI_CALLS,
      1,
      'AI 调用次数额度不足',
    );
    expect(saasQuotaService.assertTenantQuotaAvailable).toHaveBeenCalledWith(
      42,
      SAAS_QUOTA_TOKENS,
      1,
      'Token 额度不足',
    );
    expect(messageRepo.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm run test -- chat.service.spec.ts --runInBand
```

Expected: FAIL because `ChatService` does not inject or call `SaasQuotaService` yet.

- [ ] **Step 3: Import SaaS module into AI module**

Modify `server/src/module/ai/ai.module.ts`:

```ts
import { SaasModule } from '../saas/saas.module';
```

Add `SaasModule` to the `imports` array:

```ts
imports: [
  SaasModule,
  TypeOrmModule.forFeature([
    AiProviderEntity,
    AiModelEntity,
    AiAgentEntity,
    AiChatSessionEntity,
    AiChatMessageEntity,
  ]),
],
```

- [ ] **Step 4: Inject and check quota in ChatService**

Modify `server/src/module/ai/services/chat.service.ts`.

Add imports:

```ts
import { SaasQuotaService } from '../../saas/services/saas-quota.service';
import { SAAS_QUOTA_AI_CALLS, SAAS_QUOTA_TOKENS } from '../../saas/constants';
```

Add constructor parameter:

```ts
private readonly saasQuotaService: SaasQuotaService,
```

After `const owned = await this.getOwnedSession(session, payload.session_uuid);`, add:

```ts
await this.saasQuotaService.assertTenantQuotaAvailable(
  owned.tenantId,
  SAAS_QUOTA_AI_CALLS,
  1,
  'AI 调用次数额度不足',
);
await this.saasQuotaService.assertTenantQuotaAvailable(
  owned.tenantId,
  SAAS_QUOTA_TOKENS,
  1,
  'Token 额度不足',
);
```

After `await this.messageRepo.save(assistantMsg);` in the successful completion path, add:

```ts
await this.saasQuotaService.consumeAiUsage(owned.tenantId, {
  totalTokens: usage.totalTokens,
});
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
pnpm run test -- chat.service.spec.ts --runInBand
pnpm run test -- saas-quota.service.spec.ts --runInBand
```

Expected: both commands PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```powershell
git add server/src/module/ai/ai.module.ts server/src/module/ai/services/chat.service.ts server/src/module/ai/services/chat.service.spec.ts
git commit -m "feat: enforce SaaS AI quotas in chat"
```

## Task 3: Verification

**Files:**
- Modify only files required to fix defects found during verification.

**Interfaces:**
- Confirms backend tests and typecheck pass.
- Confirms frontend remains type-safe.
- Confirms browser-visible tenant usage page can display updated quota data after AI use when local model/provider configuration is available.

- [ ] **Step 1: Run backend focused tests**

Run:

```powershell
pnpm run test -- saas-quota.service.spec.ts --runInBand
pnpm run test -- chat.service.spec.ts --runInBand
```

Expected: both commands PASS.

- [ ] **Step 2: Run backend typecheck**

Run:

```powershell
pnpm exec tsc --noEmit
```

Expected: exits with code `0`.

- [ ] **Step 3: Run frontend typecheck**

Run:

```powershell
pnpm exec vue-tsc --noEmit
```

Expected: exits with code `0`.

- [ ] **Step 4: Manual runtime check**

If AI provider configuration is available locally:

1. Login as a tenant user.
2. Open AI chat.
3. Send one short message.
4. Open `http://localhost:5731/#/tenant-saas/usage`.
5. Confirm `AI 调用次数` increased by `1`.
6. Confirm `Token 用量` increased by the model-returned total token count.

If AI provider configuration is unavailable locally, record that the manual AI runtime check was not possible and rely on unit tests plus typechecks.

- [ ] **Step 5: Commit verification fixes if needed**

If verification required fixes:

```powershell
git add server/src/module/saas server/src/module/ai
git commit -m "fix: stabilize SaaS AI quota integration"
```

If no fixes were required, do not create an empty commit.
