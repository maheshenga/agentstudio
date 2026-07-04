# SaaS AI Quota Integration Design

Date: 2026-07-03

## Goal

Connect the existing AI chat flow to the SaaS quota system so tenant AI usage becomes enforceable and visible in the tenant usage center.

This slice covers only:

- AI call count quota: `ai_calls`
- AI token quota: `tokens`

It does not cover resource pack purchases, storage quota, RAG document quota, invoices, or subscription expiry automation.

## Current State

The SaaS foundation already has:

- `SaasQuotaService.initializeTenantQuota()`
- `SaasQuotaService.getTenantUsageSummary()`
- `saas_tenant_resource` rows with `total_quota` and `used_quota`
- tenant usage page at `/tenant-saas/usage`

The AI chat flow already has:

- tenant-aware chat sessions
- model invocation in `ChatService.handleChatSend()`
- final usage data with `promptTokens`, `completionTokens`, and `totalTokens`

The missing connection is that AI requests do not check quota before running and do not update SaaS usage after completion.

## Product Behavior

Before starting an AI generation:

- The backend checks that the current tenant has at least one remaining `ai_calls` quota.
- The backend checks that the tenant has remaining `tokens` quota.
- If either quota is exhausted, the AI request is rejected before calling the model provider.

After a successful AI generation:

- The backend increments `ai_calls.used_quota` by `1`.
- The backend increments `tokens.used_quota` by the returned `totalTokens`.
- The tenant usage page reflects the updated usage on refresh.

If the provider returns no token usage:

- The backend still increments `ai_calls` by `1`.
- The backend increments `tokens` by `0` in this slice.
- Token estimation can be added later if needed.

If the AI stream is stopped or fails:

- No quota is consumed for failed or stopped generations in this slice.
- The current persisted AI error behavior stays unchanged.

## Backend Design

Extend `SaasQuotaService` with focused quota methods:

- `assertTenantQuotaAvailable(tenantId, resourceType, amount)`
- `consumeTenantQuota(tenantId, resourceType, amount)`
- `consumeAiUsage(tenantId, usage)`

`assertTenantQuotaAvailable` reads the active tenant resource row and throws `BadRequestException` when:

- tenant ID is missing
- quota row does not exist
- quota is finite and remaining quota is lower than the requested amount

Quota value `total_quota <= 0` is treated as unlimited, matching the current frontend display behavior.

`consumeTenantQuota` atomically increments `used_quota` for one resource. It is intentionally small and reusable so later resource-pack work can use the same primitive.

`consumeAiUsage` performs:

- check `ai_calls` amount `1`
- check `tokens` amount `max(totalTokens, 0)`
- consume `ai_calls`
- consume `tokens` only when amount is greater than `0`

`ChatService.handleChatSend()` will call quota checks after resolving the tenant-owned session and before creating provider stream work. It will call `consumeAiUsage()` only after the assistant message is saved as completed.

## Error Handling

Quota exhaustion returns a normal HTTP/WebSocket business error with a clear message:

- AI call quota exhausted: `AI 调用次数额度不足`
- token quota exhausted: `Token 额度不足`

The frontend already receives `chat.error` events, so this slice does not add new UI surfaces. A later UI pass can display upgrade prompts in the chat panel.

## Testing

Backend unit tests will cover:

- quota check passes when remaining quota is enough
- quota check fails when remaining quota is exhausted
- unlimited quota allows consumption
- AI usage consumes one call and returned tokens
- AI quota is checked before provider streaming in `ChatService`

Verification commands:

- `pnpm run test -- saas-quota.service.spec.ts --runInBand`
- `pnpm run test -- chat.service.spec.ts --runInBand` if an existing focused test can be extended; otherwise add a focused SaaS quota interaction spec.
- `pnpm exec tsc --noEmit`

Frontend verification:

- `pnpm exec vue-tsc --noEmit`
- Manual browser/API check: complete one AI chat request, then refresh `/tenant-saas/usage` and confirm `AI 调用次数` and `Token 用量` changed.

## Out Of Scope

- Resource pack purchase and stacking
- Post-paid overage billing
- Token estimation when provider usage is missing
- Releasing quota after deleting chat messages
- Subscription expiry jobs
- UI upgrade prompts inside chat
