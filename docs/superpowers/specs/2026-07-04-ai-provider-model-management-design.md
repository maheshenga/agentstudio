# AI Provider And Model Management Design

Date: 2026-07-04

## Goal

Improve the existing backend AI provider and model management so platform and tenant admins can safely configure multiple OpenAI-compatible providers, validate connectivity, choose usable models, and run chat through one small provider resolution path.

This is not a rewrite. The project already has provider/model tables, CRUD pages, encrypted API keys, model selection in chat, and OpenAI-compatible streaming. The next slice makes those pieces reliable enough for SaaS use.

## Current Context

Existing backend files:

- `server/src/module/ai/entities/ai-provider.entity.ts`
- `server/src/module/ai/entities/ai-model.entity.ts`
- `server/src/module/ai/services/ai-admin.service.ts`
- `server/src/module/ai/services/ai-config.service.ts`
- `server/src/module/ai/services/chat.service.ts`
- `server/src/module/ai/providers/openai-stream.util.ts`

Existing frontend files:

- `web/src/api/ai-admin.ts`
- `web/src/views/ai/provider/index.vue`
- `web/src/views/ai/provider/modules/edit-dialog.vue`
- `web/src/views/ai/model/index.vue`
- `web/src/views/ai/model/modules/edit-dialog.vue`
- `web/src/views/ai/chat/index.vue`

Current gaps:

- Admin input uses loose `Record<string, any>` instead of DTO validation.
- Provider and model uniqueness is not enforced at the service level.
- A model can reference a disabled or inaccessible provider if validation is missed.
- Provider `adapter_type` is stored, but chat always calls the OpenAI-compatible util directly.
- There is no admin endpoint to test provider/model connectivity before users hit chat.
- Several AI admin UI and Swagger strings are mojibake and need normal Chinese text.

## Scope

### In Scope

1. Provider management hardening:
   - Validate create/update bodies with DTOs.
   - Require provider `code`, `name`, `base_url`, and API key on create.
   - Keep API key optional on update.
   - Normalize `base_url` by trimming trailing slashes for storage.
   - Reject duplicate provider `code` within the same tenant scope.
   - Keep `tenant_id = 0` as platform-level provider and tenant ID as tenant-level provider.

2. Model management hardening:
   - Validate create/update bodies with DTOs.
   - Require `provider_id`, `model_code`, and `name`.
   - Reject duplicate `model_code` under the same provider and tenant scope.
   - Only allow enabled or owned provider IDs.
   - Keep the existing single default model per tenant scope behavior.

3. Provider test endpoint:
   - Add an admin endpoint to test a provider with a small non-streaming chat request.
   - Endpoint accepts provider ID and optional model code.
   - If model code is omitted, use the first enabled model under that provider.
   - Return success flag, latency, provider ID, model code, and a short error message when failed.

4. Unified provider runner:
   - Add a small service that resolves adapter type and calls the current OpenAI-compatible utilities.
   - First supported adapter: `openai_compatible`.
   - Chat and provider test both use this service.
   - Unknown adapter types fail early with a clear error.

5. UI polish:
   - Replace mojibake text in AI provider/model admin pages with normal Chinese labels.
   - Add a provider test action on provider rows.
   - Keep existing layout and Element Plus components.

6. Tests:
   - Unit tests for provider duplicate checks, model duplicate checks, default model behavior, and provider test behavior.
   - Controller tests for the new provider test endpoint.
   - Existing chat service tests stay focused on chat behavior.

### Out Of Scope

- Separate SDK implementations for Anthropic, Gemini, or non-OpenAI protocols.
- Cost accounting, token pricing, and provider billing reports.
- Automatic provider failover.
- Per-tenant provider marketplace.
- User-facing model favorites.
- Invoice features.

## Recommended Approach

Use the existing tables and add only service-level validation plus one narrow runner service.

Alternatives considered:

1. Keep direct calls from chat to `openai-stream.util`.
   - Lowest diff, but provider test and chat would duplicate adapter handling.

2. Add a small `LlmProviderService`.
   - Recommended. It centralizes adapter selection without adding a factory tree.

3. Build a full adapter framework.
   - Too early. There is only one real implementation today.

## Backend Design

### DTOs

Create DTOs under `server/src/module/ai/dto`:

- `save-ai-provider.dto.ts`
- `save-ai-model.dto.ts`
- `test-ai-provider.dto.ts`

DTOs enforce required fields, length limits, numeric ranges, and status values. They also document the API for Swagger.

### Admin Service

`AiAdminService` keeps current responsibilities:

- list providers
- create provider
- update provider
- delete provider
- list provider options
- list models
- create model
- update model
- delete model

Add private helpers:

- `assertProviderCodeUnique(tenantId, code, excludeId?)`
- `assertModelCodeUnique(tenantId, providerId, modelCode, excludeId?)`
- `normalizeBaseUrl(baseUrl)`

The service should not expose decrypted API keys. Formatted provider output keeps `api_key_masked`.

### Provider Test Service Path

Add `AiAdminService.testProvider(user, id, body)`:

1. Load provider with existing ownership rules.
2. Resolve model code:
   - use `body.model_code` when provided
   - otherwise find the first enabled model for that provider in the same accessible scope
3. Decrypt provider API key.
4. Call `LlmProviderService.completeChat`.
5. Return:

```ts
{
  provider_id: string;
  model_code: string;
  ok: boolean;
  latency_ms: number;
  message: string;
}
```

Failures return `ok: false` with a short message for network, auth, unsupported adapter, or no model.

### LLM Provider Service

Create `server/src/module/ai/services/llm-provider.service.ts`.

Public methods:

- `streamChat(provider, apiKey, options)`
- `completeChat(provider, apiKey, options)`

For now, both methods support only `provider.adapterType === 'openai_compatible'` and call:

- `streamOpenAiChatCompletions`
- `completeOpenAiChatCompletions`

This removes adapter branching from `ChatService` while keeping one implementation.

## Frontend Design

Update only existing AI admin pages:

- Provider dialog:
  - normal Chinese labels
  - adapter type as a select with `openai_compatible`
  - API key input hint clearly says update can be empty

- Provider table:
  - add a test action beside edit/delete
  - show success or failure with `ElMessage`

- Model dialog:
  - normal Chinese labels
  - preserve existing fields and validation

No new page is needed.

## Error Handling

- Validation failures use `BadRequestException`.
- Missing provider or model uses `NotFoundException`.
- Unsupported adapter returns a clear `BadRequestException`.
- Provider test catches remote-call errors and returns `ok: false` instead of throwing, because test failures are expected admin feedback.
- Chat still throws when the selected model/provider is unavailable, because chat cannot continue.

## Testing

Backend tests:

- `ai-admin.service.spec.ts`
  - rejects duplicate provider code in tenant scope
  - rejects duplicate model code under provider
  - keeps one default model per tenant scope
  - tests provider successfully through `LlmProviderService`
  - returns failed test result for remote-call failure

- `ai-admin.controller.spec.ts`
  - delegates provider test endpoint

- Existing `chat.service.spec.ts`
  - update only where constructor dependencies change

Frontend verification:

- `cd web && pnpm exec vue-tsc --noEmit`
- `cd web && pnpm run build`

Backend verification:

- `cd server && pnpm exec jest ai-admin.service.spec.ts ai-admin.controller.spec.ts chat.service.spec.ts --runInBand`
- `cd server && pnpm exec tsc --noEmit`
- `cd server && pnpm run build`

## Acceptance Criteria

- Provider and model admin APIs reject invalid or duplicate configuration.
- Admins can test a provider from the backend and see success or failure.
- Chat calls through the unified provider runner while preserving current streaming behavior.
- Existing OpenAI-compatible providers still work.
- AI admin UI no longer shows mojibake on provider/model pages.
- No new dependency is added.
