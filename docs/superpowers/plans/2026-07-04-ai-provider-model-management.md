# AI Provider And Model Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden existing AI provider/model management with validation, provider testing, one unified OpenAI-compatible runner, and readable admin UI text.

**Architecture:** Reuse `sa_ai_provider` and `sa_ai_model`. Add DTOs and one `LlmProviderService`; keep all real provider calls on the existing OpenAI-compatible utilities. No new tables, no new dependencies, no non-compatible SDKs.

**Tech Stack:** NestJS, TypeORM, class-validator, Jest, Vue 3, Element Plus, pnpm.

---

## File Structure

- Create `server/src/module/ai/dto/save-ai-provider.dto.ts`: provider create/update validation.
- Create `server/src/module/ai/dto/save-ai-model.dto.ts`: model create/update validation.
- Create `server/src/module/ai/dto/test-ai-provider.dto.ts`: provider test request validation.
- Create `server/src/module/ai/services/llm-provider.service.ts`: one small runner for OpenAI-compatible streaming and non-streaming calls.
- Create `server/src/module/ai/services/llm-provider.service.spec.ts`: unsupported adapter and delegation tests.
- Create `server/src/module/ai/services/ai-admin.service.spec.ts`: admin hardening and provider test tests.
- Create `server/src/module/ai/ai-admin.controller.spec.ts`: new route delegation test.
- Modify `server/src/module/ai/services/ai-admin.service.ts`: DTO-shaped inputs, duplicate checks, provider test.
- Modify `server/src/module/ai/ai-admin.controller.ts`: normal Chinese summaries and test endpoint.
- Modify `server/src/module/ai/services/chat.service.ts`: call `LlmProviderService.streamChat`.
- Modify `server/src/module/ai/services/chat.service.spec.ts`: mock `LlmProviderService`.
- Modify `server/src/module/ai/ai.module.ts`: register `LlmProviderService`.
- Modify `web/src/api/ai-admin.ts`: add provider test API.
- Modify `web/src/views/ai/provider/index.vue`: readable labels and test action.
- Modify `web/src/views/ai/provider/modules/edit-dialog.vue`: readable labels and adapter select.
- Modify `web/src/views/ai/model/index.vue`: readable labels.
- Modify `web/src/views/ai/model/modules/edit-dialog.vue`: readable labels.

---

### Task 1: LLM Provider Runner

**Files:**
- Create: `server/src/module/ai/services/llm-provider.service.ts`
- Create: `server/src/module/ai/services/llm-provider.service.spec.ts`
- Modify: `server/src/module/ai/ai.module.ts`

- [ ] **Step 1: Write failing tests**

Create `server/src/module/ai/services/llm-provider.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

import { AiProviderEntity } from '../entities/ai-provider.entity';
import {
  completeOpenAiChatCompletions,
  streamOpenAiChatCompletions,
} from '../providers/openai-stream.util';
import { LlmProviderService } from './llm-provider.service';

jest.mock('../providers/openai-stream.util', () => ({
  completeOpenAiChatCompletions: jest.fn(),
  streamOpenAiChatCompletions: jest.fn(),
}));

describe('LlmProviderService', () => {
  const service = new LlmProviderService();

  const provider = {
    id: '1',
    adapterType: 'openai_compatible',
    baseUrl: 'https://api.example.test/v1',
    extraHeaders: { 'X-Test': '1' },
  } as AiProviderEntity;

  it('delegates non-streaming calls to the OpenAI-compatible util', async () => {
    (completeOpenAiChatCompletions as jest.Mock).mockResolvedValue({ content: 'ok', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } });

    const result = await service.completeChat(provider, 'secret', {
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 8,
    });

    expect(result.content).toBe('ok');
    expect(completeOpenAiChatCompletions).toHaveBeenCalledWith(expect.objectContaining({
      baseUrl: provider.baseUrl,
      apiKey: 'secret',
      model: 'gpt-test',
      extraHeaders: provider.extraHeaders,
    }));
  });

  it('delegates streaming calls to the OpenAI-compatible util', () => {
    const stream = (async function* () {
      yield { delta: 'hi' };
      return { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
    })();
    (streamOpenAiChatCompletions as jest.Mock).mockReturnValue(stream);

    const result = service.streamChat(provider, 'secret', {
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'ping' }],
    });

    expect(result).toBe(stream);
  });

  it('rejects unsupported adapter types', async () => {
    await expect(
      service.completeChat({ ...provider, adapterType: 'anthropic' } as AiProviderEntity, 'secret', {
        model: 'claude',
        messages: [{ role: 'user', content: 'ping' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

```powershell
cd server
pnpm exec jest llm-provider.service.spec.ts --runInBand
```

Expected: FAIL because `LlmProviderService` does not exist.

- [ ] **Step 3: Implement runner**

Create `server/src/module/ai/services/llm-provider.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';

import { AiProviderEntity } from '../entities/ai-provider.entity';
import { buildProviderExtraBody } from '../providers/llm-provider.util';
import {
  completeOpenAiChatCompletions,
  LlmRequestOptions,
  LlmStreamOptions,
  streamOpenAiChatCompletions,
} from '../providers/openai-stream.util';

type RunnerOptions<T> = Omit<T, 'baseUrl' | 'apiKey' | 'extraHeaders' | 'extraBody'>;

@Injectable()
export class LlmProviderService {
  streamChat(provider: AiProviderEntity, apiKey: string, options: RunnerOptions<LlmStreamOptions>) {
    this.assertSupported(provider);
    return streamOpenAiChatCompletions({
      ...options,
      baseUrl: provider.baseUrl,
      apiKey,
      extraHeaders: provider.extraHeaders ?? undefined,
      extraBody: buildProviderExtraBody(provider),
    });
  }

  completeChat(provider: AiProviderEntity, apiKey: string, options: RunnerOptions<LlmRequestOptions>) {
    this.assertSupported(provider);
    return completeOpenAiChatCompletions({
      ...options,
      baseUrl: provider.baseUrl,
      apiKey,
      extraHeaders: provider.extraHeaders ?? undefined,
      extraBody: buildProviderExtraBody(provider),
    });
  }

  private assertSupported(provider: AiProviderEntity) {
    if ((provider.adapterType || 'openai_compatible') !== 'openai_compatible') {
      throw new BadRequestException(`Unsupported AI adapter ${provider.adapterType}`);
    }
  }
}
```

Modify `server/src/module/ai/ai.module.ts`:

```ts
import { LlmProviderService } from './services/llm-provider.service';
```

Add `LlmProviderService` to `providers`.

- [ ] **Step 4: Verify GREEN**

```powershell
cd server
pnpm exec jest llm-provider.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/src/module/ai/services/llm-provider.service.ts `
  server/src/module/ai/services/llm-provider.service.spec.ts `
  server/src/module/ai/ai.module.ts
git commit -m "feat: add AI provider runner"
```

---

### Task 2: Admin DTOs, Validation, And Provider Test

**Files:**
- Create: `server/src/module/ai/dto/save-ai-provider.dto.ts`
- Create: `server/src/module/ai/dto/save-ai-model.dto.ts`
- Create: `server/src/module/ai/dto/test-ai-provider.dto.ts`
- Create: `server/src/module/ai/services/ai-admin.service.spec.ts`
- Modify: `server/src/module/ai/services/ai-admin.service.ts`

- [ ] **Step 1: Write failing service tests**

Create `server/src/module/ai/services/ai-admin.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { decryptAiSecret } from '../../../common/utils/ai-crypto.util';
import { AiModelEntity } from '../entities/ai-model.entity';
import { AiProviderEntity } from '../entities/ai-provider.entity';
import { LlmProviderService } from './llm-provider.service';
import { AiAdminService } from './ai-admin.service';

jest.mock('../../../common/utils/ai-crypto.util', () => ({
  encryptAiSecret: jest.fn((value) => `enc:${value}`),
  decryptAiSecret: jest.fn((value) => String(value).replace(/^enc:/, '')),
  maskAiSecret: jest.fn(() => 'sk-****test'),
}));

describe('AiAdminService', () => {
  const providerRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: value.id || '1', ...value })),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const modelRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: value.id || '10', ...value })),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const llmProviderService = {
    completeChat: jest.fn(),
  };
  let service: AiAdminService;
  const user = { userId: 7, tenantId: 42 } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAdminService,
        { provide: getRepositoryToken(AiProviderEntity), useValue: providerRepo },
        { provide: getRepositoryToken(AiModelEntity), useValue: modelRepo },
        { provide: LlmProviderService, useValue: llmProviderService },
      ],
    }).compile();
    service = module.get(AiAdminService);
  });

  it('rejects duplicate provider code in tenant scope', async () => {
    providerRepo.findOne.mockResolvedValue({ id: 'old', tenantId: 42, code: 'deepseek' });

    await expect(service.createProvider(user, {
      code: 'deepseek',
      name: 'DeepSeek',
      base_url: 'https://api.deepseek.com/v1',
      api_key: 'secret',
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes provider base URL on create', async () => {
    providerRepo.findOne.mockResolvedValue(null);

    const result = await service.createProvider(user, {
      code: 'deepseek',
      name: 'DeepSeek',
      base_url: 'https://api.deepseek.com/v1/',
      api_key: 'secret',
      adapter_type: 'openai_compatible',
    } as any);

    expect(result.base_url).toBe('https://api.deepseek.com/v1');
  });

  it('rejects duplicate model code under provider', async () => {
    providerRepo.findOne.mockResolvedValue({ id: '1', tenantId: 42, status: '1' });
    modelRepo.findOne.mockResolvedValue({ id: 'old', tenantId: 42, providerId: '1', modelCode: 'deepseek-chat' });

    await expect(service.createModel(user, {
      provider_id: '1',
      model_code: 'deepseek-chat',
      name: 'DeepSeek Chat',
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps one default model per tenant scope', async () => {
    providerRepo.findOne.mockResolvedValue({ id: '1', tenantId: 42, status: '1' });
    modelRepo.findOne.mockResolvedValue(null);

    await service.createModel(user, {
      provider_id: '1',
      model_code: 'deepseek-chat',
      name: 'DeepSeek Chat',
      is_default: 1,
    } as any);

    expect(modelRepo.update).toHaveBeenCalledWith({ tenantId: 42 }, { isDefault: 0 });
  });

  it('tests a provider with the requested model code', async () => {
    providerRepo.findOne.mockResolvedValue({ id: '1', tenantId: 42, status: '1', apiKeyCipher: 'enc:secret', adapterType: 'openai_compatible', baseUrl: 'https://api.example.test/v1', extraHeaders: null });
    llmProviderService.completeChat.mockResolvedValue({ content: 'pong', usage: { totalTokens: 2 } });

    const result = await service.testProvider(user, '1', { model_code: 'gpt-test' } as any);

    expect(decryptAiSecret).toHaveBeenCalledWith('enc:secret');
    expect(llmProviderService.completeChat).toHaveBeenCalledWith(expect.any(Object), 'secret', expect.objectContaining({ model: 'gpt-test' }));
    expect(result).toMatchObject({ provider_id: '1', model_code: 'gpt-test', ok: true, message: 'pong' });
  });

  it('returns failed provider test result for remote errors', async () => {
    providerRepo.findOne.mockResolvedValue({ id: '1', tenantId: 42, status: '1', apiKeyCipher: 'enc:secret', adapterType: 'openai_compatible', baseUrl: 'https://api.example.test/v1', extraHeaders: null });
    llmProviderService.completeChat.mockRejectedValue(new Error('401 unauthorized'));

    await expect(service.testProvider(user, '1', { model_code: 'gpt-test' } as any)).resolves.toMatchObject({
      provider_id: '1',
      model_code: 'gpt-test',
      ok: false,
      message: '401 unauthorized',
    });
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

```powershell
cd server
pnpm exec jest ai-admin.service.spec.ts --runInBand
```

Expected: FAIL because the service lacks duplicate checks and `testProvider`.

- [ ] **Step 3: Add DTOs**

Create `server/src/module/ai/dto/save-ai-provider.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SaveAiProviderDto {
  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(32)
  code: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(64)
  name: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(255)
  base_url: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  api_key?: string;

  @ApiProperty({ required: false, enum: ['openai_compatible'] })
  @IsOptional()
  @IsIn(['openai_compatible'])
  adapter_type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  extra_headers?: Record<string, string> | null;

  @ApiProperty({ required: false, enum: ['0', '1', 0, 1] })
  @IsOptional()
  @IsIn(['0', '1', 0, 1])
  status?: string | number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
```

Create `server/src/module/ai/dto/save-ai-model.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SaveAiModelDto {
  @ApiProperty({ required: true })
  @IsString()
  provider_id: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(64)
  model_code: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(64)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1024)
  context_window?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(256)
  max_output_tokens?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  default_temperature?: number;

  @ApiProperty({ required: false, enum: [0, 1] })
  @IsOptional()
  @IsIn([0, 1])
  is_default?: number;

  @ApiProperty({ required: false, enum: ['0', '1', 0, 1] })
  @IsOptional()
  @IsIn(['0', '1', 0, 1])
  status?: string | number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
```

Create `server/src/module/ai/dto/test-ai-provider.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TestAiProviderDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  model_code?: string;
}
```

- [ ] **Step 4: Implement service hardening**

Modify `AiAdminService`:

```ts
constructor(
  @InjectRepository(AiProviderEntity)
  private readonly providerRepo: Repository<AiProviderEntity>,
  @InjectRepository(AiModelEntity)
  private readonly modelRepo: Repository<AiModelEntity>,
  private readonly llmProviderService: LlmProviderService,
) {}
```

Add imports:

```ts
import { SaveAiModelDto } from '../dto/save-ai-model.dto';
import { SaveAiProviderDto } from '../dto/save-ai-provider.dto';
import { TestAiProviderDto } from '../dto/test-ai-provider.dto';
import { LlmProviderService } from './llm-provider.service';
```

Change method signatures:

```ts
async createProvider(user: UserType, body: SaveAiProviderDto) {}
async updateProvider(user: UserType, id: string, body: Partial<SaveAiProviderDto>) {}
async createModel(user: UserType, body: SaveAiModelDto) {}
async updateModel(user: UserType, id: string, body: Partial<SaveAiModelDto>) {}
```

Add helpers:

```ts
private normalizeBaseUrl(baseUrl: string) {
  return `${baseUrl || ''}`.trim().replace(/\/+$/, '');
}

private async assertProviderCodeUnique(tenantId: number, code: string, excludeId?: string) {
  const existing = await this.providerRepo.findOne({ where: { tenantId, code, deleteTime: IsNull() } });
  if (existing && `${existing.id}` !== `${excludeId || ''}`) {
    throw new BadRequestException('Provider code already exists');
  }
}

private async assertModelCodeUnique(tenantId: number, providerId: string, modelCode: string, excludeId?: string) {
  const existing = await this.modelRepo.findOne({
    where: { tenantId, providerId, modelCode, deleteTime: IsNull() },
  });
  if (existing && `${existing.id}` !== `${excludeId || ''}`) {
    throw new BadRequestException('Model code already exists under this provider');
  }
}
```

Use them in create/update:

```ts
await this.assertProviderCodeUnique(tenantId, body.code);
baseUrl: this.normalizeBaseUrl(body.base_url),
```

```ts
if (body.code !== undefined && body.code !== entity.code) {
  await this.assertProviderCodeUnique(entity.tenantId, body.code, id);
  entity.code = body.code;
}
if (body.base_url !== undefined) entity.baseUrl = this.normalizeBaseUrl(body.base_url);
```

```ts
const provider = await this.getOwnedProvider(user, body.provider_id);
if (provider.status !== AI_STATUS_ENABLED) throw new BadRequestException('Provider is disabled');
await this.assertModelCodeUnique(tenantId, body.provider_id, body.model_code);
```

Add provider test:

```ts
async testProvider(user: UserType, id: string, body: TestAiProviderDto) {
  const provider = await this.getOwnedProvider(user, id);
  if (!provider.apiKeyCipher) {
    return { provider_id: id, model_code: body.model_code || '', ok: false, latency_ms: 0, message: 'Provider API key is not configured' };
  }

  const modelCode = body.model_code || await this.findFirstEnabledModelCode(user, id);
  if (!modelCode) {
    return { provider_id: id, model_code: '', ok: false, latency_ms: 0, message: 'No enabled model configured for this provider' };
  }

  const startedAt = Date.now();
  try {
    const result = await this.llmProviderService.completeChat(provider, decryptAiSecret(provider.apiKeyCipher), {
      model: modelCode,
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 16,
      temperature: 0,
    });
    return {
      provider_id: id,
      model_code: modelCode,
      ok: true,
      latency_ms: Date.now() - startedAt,
      message: result.content.slice(0, 100) || 'ok',
    };
  } catch (err: any) {
    return {
      provider_id: id,
      model_code: modelCode,
      ok: false,
      latency_ms: Date.now() - startedAt,
      message: (err?.message || 'Provider test failed').slice(0, 200),
    };
  }
}

private async findFirstEnabledModelCode(user: UserType, providerId: string) {
  const tenantId = this.tenantId(user);
  const model = await this.modelRepo.findOne({
    where: [
      { tenantId, providerId, status: AI_STATUS_ENABLED, deleteTime: IsNull() },
      { tenantId: 0, providerId, status: AI_STATUS_ENABLED, deleteTime: IsNull() },
    ],
    order: { sort: 'ASC', id: 'ASC' },
  });
  return model?.modelCode || '';
}
```

- [ ] **Step 5: Verify GREEN**

```powershell
cd server
pnpm exec jest ai-admin.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add server/src/module/ai/dto/save-ai-provider.dto.ts `
  server/src/module/ai/dto/save-ai-model.dto.ts `
  server/src/module/ai/dto/test-ai-provider.dto.ts `
  server/src/module/ai/services/ai-admin.service.ts `
  server/src/module/ai/services/ai-admin.service.spec.ts
git commit -m "feat: harden AI provider model admin"
```

---

### Task 3: Controller Route And Chat Runner Integration

**Files:**
- Create: `server/src/module/ai/ai-admin.controller.spec.ts`
- Modify: `server/src/module/ai/ai-admin.controller.ts`
- Modify: `server/src/module/ai/services/chat.service.ts`
- Modify: `server/src/module/ai/services/chat.service.spec.ts`

- [ ] **Step 1: Write failing controller test**

Create `server/src/module/ai/ai-admin.controller.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';

import { AiAdminController } from './ai-admin.controller';
import { AiAdminService } from './services/ai-admin.service';

describe('AiAdminController', () => {
  const aiAdminService = {
    testProvider: jest.fn(),
  };
  let controller: AiAdminController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiAdminController],
      providers: [{ provide: AiAdminService, useValue: aiAdminService }],
    }).compile();
    controller = module.get(AiAdminController);
  });

  it('delegates provider test requests', async () => {
    aiAdminService.testProvider.mockResolvedValue({ provider_id: '1', model_code: 'gpt-test', ok: true, latency_ms: 3, message: 'ok' });

    const result = await controller.testProvider({ userId: 7, tenantId: 42 } as any, '1', { model_code: 'gpt-test' });

    expect(aiAdminService.testProvider).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 42 }), '1', { model_code: 'gpt-test' });
    expect(result.data).toMatchObject({ ok: true, model_code: 'gpt-test' });
  });
});
```

- [ ] **Step 2: Run controller test and verify RED**

```powershell
cd server
pnpm exec jest ai-admin.controller.spec.ts --runInBand
```

Expected: FAIL because `testProvider` controller method does not exist.

- [ ] **Step 3: Add controller endpoint and readable Swagger text**

Modify `server/src/module/ai/ai-admin.controller.ts`:

```ts
import { TestAiProviderDto } from './dto/test-ai-provider.dto';
import { SaveAiModelDto } from './dto/save-ai-model.dto';
import { SaveAiProviderDto } from './dto/save-ai-provider.dto';
```

Use DTOs in method signatures and add:

```ts
@Post('providers/test/:id')
@ApiOperation({ summary: '测试 AI 供应商' })
testProvider(@User() user: UserDto, @Param('id') id: string, @Body() body: TestAiProviderDto) {
  return this.aiAdminService.testProvider(user as any, id, body).then((d) => ResultData.ok(d));
}
```

Replace mojibake summaries with normal Chinese:

```ts
@ApiTags('AI 管理')
@ApiOperation({ summary: '供应商列表' })
@ApiOperation({ summary: '创建供应商' })
@ApiOperation({ summary: '更新供应商' })
@ApiOperation({ summary: '删除供应商' })
@ApiOperation({ summary: '供应商选项' })
@ApiOperation({ summary: '模型列表' })
@ApiOperation({ summary: '创建模型' })
@ApiOperation({ summary: '更新模型' })
@ApiOperation({ summary: '删除模型' })
```

- [ ] **Step 4: Refactor chat to use `LlmProviderService`**

Modify `server/src/module/ai/services/chat.service.ts`:

```ts
import { LlmProviderService } from './llm-provider.service';
```

Inject:

```ts
private readonly llmProviderService: LlmProviderService,
```

Replace direct stream call:

```ts
const stream = this.llmProviderService.streamChat(resolved.provider, resolved.apiKey, {
  model: resolved.model.modelCode,
  messages: built.messages,
  temperature,
  maxTokens: resolved.model.maxOutputTokens,
  signal: abort.signal,
});
```

Remove direct imports of `streamOpenAiChatCompletions` and `buildProviderExtraBody`.

- [ ] **Step 5: Update chat tests**

Modify `server/src/module/ai/services/chat.service.spec.ts`:

```ts
import { LlmProviderService } from './llm-provider.service';
```

Remove the `jest.mock('../providers/openai-stream.util', ...)` block and use:

```ts
const llmProviderService = {
  streamChat: jest.fn(),
};
```

Add provider:

```ts
{ provide: LlmProviderService, useValue: llmProviderService },
```

Replace:

```ts
(streamOpenAiChatCompletions as jest.Mock).mockReturnValue(...)
```

with:

```ts
llmProviderService.streamChat.mockReturnValue(...)
```

Add assertion:

```ts
expect(llmProviderService.streamChat).toHaveBeenCalledWith(
  expect.objectContaining({ id: 'provider-1' }),
  'test-key',
  expect.objectContaining({ model: 'gpt-test' }),
);
```

- [ ] **Step 6: Verify GREEN**

```powershell
cd server
pnpm exec jest ai-admin.controller.spec.ts chat.service.spec.ts llm-provider.service.spec.ts ai-admin.service.spec.ts --runInBand
pnpm exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add server/src/module/ai/ai-admin.controller.ts `
  server/src/module/ai/ai-admin.controller.spec.ts `
  server/src/module/ai/services/chat.service.ts `
  server/src/module/ai/services/chat.service.spec.ts
git commit -m "feat: test AI providers from admin"
```

---

### Task 4: Frontend Admin Polish

**Files:**
- Modify: `web/src/api/ai-admin.ts`
- Modify: `web/src/views/ai/provider/index.vue`
- Modify: `web/src/views/ai/provider/modules/edit-dialog.vue`
- Modify: `web/src/views/ai/model/index.vue`
- Modify: `web/src/views/ai/model/modules/edit-dialog.vue`

- [ ] **Step 1: Add provider test API**

Modify `web/src/api/ai-admin.ts`:

```ts
test(id: string | number, params: { model_code?: string } = {}) {
  return request.post<{ provider_id: string; model_code: string; ok: boolean; latency_ms: number; message: string }>({
    url: '/api/ai/admin/providers/test/' + id,
    data: params
  })
}
```

- [ ] **Step 2: Fix provider list labels and add test action**

Modify `web/src/views/ai/provider/index.vue`:

```vue
<ElButton v-permission="'ai:provider:save'" @click="showDialog('add')" v-ripple>新增</ElButton>
```

Use readable column labels:

```ts
{ prop: 'code', label: '标识', minWidth: 100 },
{ prop: 'name', label: '名称', minWidth: 120 },
{ prop: 'adapter_type', label: '适配器', width: 140 },
{ prop: 'status', label: '状态', saiType: 'dict', saiDict: 'data_status', width: 90 },
{ prop: 'sort', label: '排序', width: 80 },
{ prop: 'operation', label: '操作', width: 210, fixed: 'right', useSlot: true }
```

Add action:

```vue
<ElButton link type="primary" :loading="testingId === row.id" @click="testProvider(row)">测试</ElButton>
```

Add script:

```ts
import { ElMessage } from 'element-plus'

const testingId = ref('')

async function testProvider(row: any) {
  testingId.value = row.id
  try {
    const res = await api.provider.test(row.id)
    if (res.ok) ElMessage.success(`测试成功：${res.message}`)
    else ElMessage.error(`测试失败：${res.message}`)
  } finally {
    testingId.value = ''
  }
}
```

- [ ] **Step 3: Fix provider dialog labels**

Modify `web/src/views/ai/provider/modules/edit-dialog.vue` labels:

```vue
:title="dialogType === 'add' ? '新增供应商' : '编辑供应商'"
<el-form-item label="标识 code" prop="code">
<el-form-item label="名称" prop="name">
<el-form-item label="API Key" prop="api_key">
:placeholder="dialogType === 'edit' ? '留空则不修改' : '必填'"
<el-form-item label="适配器">
  <el-select v-model="formData.adapter_type" style="width:100%">
    <el-option label="OpenAI Compatible" value="openai_compatible" />
  </el-select>
</el-form-item>
<el-form-item label="状态">
  <el-radio value="1">正常</el-radio>
  <el-radio value="0">停用</el-radio>
</el-form-item>
<el-form-item label="排序">
<el-form-item label="备注">
```

Fix validation messages:

```ts
code: [{ required: true, message: '请输入 code', trigger: 'blur' }],
name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
base_url: [{ required: true, message: '请输入 Base URL', trigger: 'blur' }],
```

- [ ] **Step 4: Fix model page and dialog labels**

Modify `web/src/views/ai/model/index.vue` readable labels:

```ts
{ prop: 'name', label: '名称', minWidth: 120 },
{ prop: 'model_code', label: '模型编码', minWidth: 140 },
{ prop: 'provider_name', label: '供应商', minWidth: 120 },
{ prop: 'context_window', label: '上下文', width: 100 },
{ prop: 'max_output_tokens', label: '最大输出', width: 100 },
{ prop: 'default_temperature', label: '温度', width: 80 },
{ prop: 'is_default', label: '默认', width: 80, useSlot: true },
{ prop: 'status', label: '状态', saiType: 'dict', saiDict: 'data_status', width: 90 },
{ prop: 'operation', label: '操作', width: 160, fixed: 'right', useSlot: true }
```

Fix default slot:

```vue
<ElTag :type="row.is_default ? 'success' : 'info'">{{ row.is_default ? '是' : '否' }}</ElTag>
```

Modify `web/src/views/ai/model/modules/edit-dialog.vue` readable labels and messages:

```vue
:title="dialogType === 'add' ? '新增模型' : '编辑模型'"
<el-form-item label="供应商" prop="provider_id">
<el-select v-model="formData.provider_id" placeholder="选择供应商" style="width:100%">
<el-form-item label="模型编码" prop="model_code">
<el-form-item label="显示名称" prop="name">
<el-form-item label="上下文窗口">
<el-form-item label="最大输出 tokens">
<el-form-item label="默认温度">
<el-form-item label="默认模型">
<el-form-item label="状态">
<el-radio value="1">正常</el-radio>
<el-radio value="0">停用</el-radio>
<el-form-item label="排序">
```

```ts
provider_id: [{ required: true, message: '请选择供应商', trigger: 'change' }],
model_code: [{ required: true, message: '请输入模型编码', trigger: 'blur' }],
name: [{ required: true, message: '请输入名称', trigger: 'blur' }]
```

- [ ] **Step 5: Verify frontend**

```powershell
cd web
pnpm exec vue-tsc --noEmit
pnpm run build
```

Expected: PASS. Existing build warnings are acceptable only if exit code is 0.

- [ ] **Step 6: Commit**

```powershell
git add web/src/api/ai-admin.ts `
  web/src/views/ai/provider/index.vue `
  web/src/views/ai/provider/modules/edit-dialog.vue `
  web/src/views/ai/model/index.vue `
  web/src/views/ai/model/modules/edit-dialog.vue
git commit -m "fix: clean AI admin management UI"
```

---

### Task 5: Final Verification

**Files:**
- No code changes unless verification finds a defect.

- [ ] **Step 1: Run backend verification**

```powershell
cd server
pnpm exec jest ai-admin.service.spec.ts ai-admin.controller.spec.ts llm-provider.service.spec.ts chat.service.spec.ts --runInBand
pnpm exec tsc --noEmit
pnpm run build
```

Expected: Jest suites pass, typecheck exits 0, build exits 0.

- [ ] **Step 2: Run frontend verification**

```powershell
cd web
pnpm exec vue-tsc --noEmit
pnpm run build
```

Expected: typecheck exits 0, build exits 0.

- [ ] **Step 3: Check git diff**

```powershell
cd ..
git diff --check
git status --short --untracked-files=all
```

Expected: only known `server/pnpm-lock.yaml` remains dirty unless a later task intentionally changes it.

- [ ] **Step 4: Commit fixes if verification required edits**

If Step 1 or Step 2 required edits:

```powershell
git add <changed-files>
git commit -m "fix: stabilize AI provider model management"
```

If no edits were needed, do not create an empty commit.
