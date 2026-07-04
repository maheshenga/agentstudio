# SaaS Resource Pack Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add catalog-only SaaS resource packs so platform operators can view seeded add-on quota products and tenants can browse active packs.

**Architecture:** Add a `saas_resource_pack` catalog table and a focused service in the existing SaaS module. Platform APIs list all packs with filters; tenant APIs list active packs only. Frontend adds one platform table page and one tenant catalog page using the existing `web/src/api/saas.ts` wrapper.

**Tech Stack:** NestJS 11, TypeORM, MySQL migrations, Jest, Vue 3, Element Plus, existing backend-menu dynamic route system.

## Global Constraints

- Catalog-only slice: do not implement resource-pack orders, Alipay payment, delivery, balance stacking, or consumption priority.
- Store money as integer cents in `price_cents`.
- Use quota resource keys already used by SaaS quotas: `ai_calls`, `tokens`, `storage_mb`, `rag_documents`.
- Platform resource-pack APIs must run outside tenant scope with `TenantContext.run(... ignoreTenant: true ...)`.
- Tenant resource-pack APIs must require tenant context and return active packs only.
- Use TDD for backend service/controller behavior.
- Preserve unrelated dirty worktree changes.

---

## File Structure

- Create `server/src/module/saas/entities/saas-resource-pack.entity.ts`: TypeORM entity for `saas_resource_pack`.
- Create `server/src/migrations/1760000000005-CreateSaasResourcePacks.ts`: table creation migration.
- Modify `server/src/module/saas/saas.module.ts`: register resource pack entity and service.
- Create `server/src/module/saas/services/saas-resource-pack.service.ts`: platform and tenant list logic.
- Create `server/src/module/saas/services/saas-resource-pack.service.spec.ts`: unit tests for filtering and response shape.
- Modify `server/src/module/saas/saas-platform.controller.ts`: add platform list endpoint.
- Modify `server/src/module/saas/saas-platform.controller.spec.ts`: controller test for resource pack list.
- Modify `server/src/module/saas/saas-tenant.controller.ts`: add tenant catalog endpoint.
- Modify `server/src/module/saas/saas-tenant.controller.spec.ts`: controller test for active tenant pack list.
- Modify `server/src/migrations/1760000000001-SeedSaasFoundationData.ts`: seed resource packs and menus.
- Modify `server/src/migration-specs/seed-saas-foundation-data.spec.ts`: assert resource-pack seed/menu permissions.
- Modify `web/src/api/saas.ts`: add resource pack types/API wrappers.
- Create `web/src/views/saas/platform/resource-pack/index.vue`: platform resource-pack table.
- Create `web/src/views/saas/tenant/resource-pack/index.vue`: tenant resource-pack catalog.

## Task 1: Backend Entity, Migration, And Service

**Files:**
- Create: `server/src/module/saas/entities/saas-resource-pack.entity.ts`
- Create: `server/src/migrations/1760000000005-CreateSaasResourcePacks.ts`
- Create: `server/src/module/saas/services/saas-resource-pack.service.ts`
- Create: `server/src/module/saas/services/saas-resource-pack.service.spec.ts`
- Modify: `server/src/module/saas/saas.module.ts`

**Interfaces:**
- Produces: `SaasResourcePackEntity`
- Produces: `SaasResourcePackService.listPlatformResourcePacks(query: SaasResourcePackListQuery)`
- Produces: `SaasResourcePackService.listTenantResourcePacks()`
- Produces response item shape `{ id, code, name, resource_type, quota_amount, price_cents, currency, status, sort, remark }`.

- [ ] **Step 1: Write failing service tests**

Create `server/src/module/saas/services/saas-resource-pack.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasResourcePackEntity } from '../entities/saas-resource-pack.entity';
import { SaasResourcePackService } from './saas-resource-pack.service';

describe('SaasResourcePackService', () => {
  let service: SaasResourcePackService;

  const resourcePackRepo = {
    findAndCount: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasResourcePackService,
        { provide: getRepositoryToken(SaasResourcePackEntity), useValue: resourcePackRepo },
      ],
    }).compile();

    service = module.get(SaasResourcePackService);
  });

  it('lists platform resource packs with pagination and filters', async () => {
    resourcePackRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 1,
          code: 'tokens_1m',
          name: 'Token Pack 1M',
          resourceType: 'tokens',
          quotaAmount: 1000000,
          priceCents: 19900,
          currency: 'CNY',
          status: 1,
          sort: 20,
          remark: 'Adds 1M tokens',
        },
      ],
      1,
    ]);

    await expect(
      service.listPlatformResourcePacks({ page: '2', limit: '10', status: '1', resource_type: 'tokens' }),
    ).resolves.toEqual({
      list: [
        {
          id: 1,
          code: 'tokens_1m',
          name: 'Token Pack 1M',
          resource_type: 'tokens',
          quota_amount: 1000000,
          price_cents: 19900,
          currency: 'CNY',
          status: 1,
          sort: 20,
          remark: 'Adds 1M tokens',
        },
      ],
      total: 1,
      page: 2,
      limit: 10,
    });

    expect(resourcePackRepo.findAndCount).toHaveBeenCalledWith({
      where: { status: 1, resourceType: 'tokens' },
      order: { resourceType: 'ASC', sort: 'ASC', id: 'ASC' },
      skip: 10,
      take: 10,
    });
  });

  it('lists only active resource packs for tenants', async () => {
    resourcePackRepo.find.mockResolvedValue([
      {
        id: 2,
        code: 'ai_calls_1k',
        name: 'AI Calls 1K',
        resourceType: 'ai_calls',
        quotaAmount: 1000,
        priceCents: 9900,
        currency: 'CNY',
        status: 1,
        sort: 10,
        remark: 'Adds 1K AI calls',
      },
    ]);

    await expect(service.listTenantResourcePacks()).resolves.toEqual([
      {
        id: 2,
        code: 'ai_calls_1k',
        name: 'AI Calls 1K',
        resource_type: 'ai_calls',
        quota_amount: 1000,
        price_cents: 9900,
        currency: 'CNY',
        status: 1,
        sort: 10,
        remark: 'Adds 1K AI calls',
      },
    ]);

    expect(resourcePackRepo.find).toHaveBeenCalledWith({
      where: { status: 1 },
      order: { resourceType: 'ASC', sort: 'ASC', id: 'ASC' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm run test -- saas-resource-pack.service.spec.ts --runInBand
```

Expected: FAIL because the entity and service do not exist.

- [ ] **Step 3: Create entity**

Create `server/src/module/saas/entities/saas-resource-pack.entity.ts`:

```ts
import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('saas_resource_pack', { comment: 'SaaS resource pack catalog' })
export class SaasResourcePackEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'code', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', name: 'name', length: 100 })
  name: string;

  @Column({ type: 'varchar', name: 'resource_type', length: 50 })
  resourceType: string;

  @Column({ type: 'bigint', name: 'quota_amount', default: 0 })
  quotaAmount: number;

  @Column({ type: 'bigint', name: 'price_cents', default: 0 })
  priceCents: number;

  @Column({ type: 'varchar', name: 'currency', length: 10, default: 'CNY' })
  currency: string;

  @Column({ type: 'tinyint', name: 'status', default: 1 })
  status: number;

  @Column({ type: 'int', name: 'sort', default: 100 })
  sort: number;

  @Column({ type: 'varchar', name: 'remark', length: 255, nullable: true })
  remark?: string;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
```

- [ ] **Step 4: Create table migration**

Create `server/src/migrations/1760000000005-CreateSaasResourcePacks.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaasResourcePacks1760000000005 implements MigrationInterface {
  name = 'CreateSaasResourcePacks1760000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`saas_resource_pack\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`code\` varchar(50) NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`resource_type\` varchar(50) NOT NULL,
        \`quota_amount\` bigint NOT NULL DEFAULT 0,
        \`price_cents\` bigint NOT NULL DEFAULT 0,
        \`currency\` varchar(10) NOT NULL DEFAULT 'CNY',
        \`status\` tinyint NOT NULL DEFAULT 1,
        \`sort\` int NOT NULL DEFAULT 100,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`update_time\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_saas_resource_pack_code\` (\`code\`),
        KEY \`idx_saas_resource_pack_resource_status\` (\`resource_type\`, \`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `saas_resource_pack`');
  }
}
```

- [ ] **Step 5: Implement service**

Create `server/src/module/saas/services/saas-resource-pack.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { SaasResourcePackEntity } from '../entities/saas-resource-pack.entity';

export interface SaasResourcePackListQuery {
  page?: string | number;
  limit?: string | number;
  status?: string | number;
  resource_type?: string;
}

@Injectable()
export class SaasResourcePackService {
  constructor(
    @InjectRepository(SaasResourcePackEntity)
    private readonly resourcePackRepo: Repository<SaasResourcePackEntity>,
  ) {}

  async listPlatformResourcePacks(query: SaasResourcePackListQuery = {}) {
    const { page, limit, skip } = this.resolvePagination(query);
    const where: FindOptionsWhere<SaasResourcePackEntity> = {};
    const status = this.resolveStatus(query.status);
    if (status !== undefined) {
      where.status = status;
    }
    if (query.resource_type) {
      where.resourceType = String(query.resource_type);
    }

    const [list, total] = await this.resourcePackRepo.findAndCount({
      where,
      order: { resourceType: 'ASC', sort: 'ASC', id: 'ASC' },
      skip,
      take: limit,
    });

    return {
      list: list.map((item) => this.toResponse(item)),
      total,
      page,
      limit,
    };
  }

  async listTenantResourcePacks() {
    const list = await this.resourcePackRepo.find({
      where: { status: 1 },
      order: { resourceType: 'ASC', sort: 'ASC', id: 'ASC' },
    });

    return list.map((item) => this.toResponse(item));
  }

  private toResponse(item: SaasResourcePackEntity) {
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      resource_type: item.resourceType,
      quota_amount: Number(item.quotaAmount),
      price_cents: Number(item.priceCents),
      currency: item.currency,
      status: item.status,
      sort: item.sort,
      remark: item.remark,
    };
  }

  private resolvePagination(query: SaasResourcePackListQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }

  private resolveStatus(value: string | number | undefined): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const status = Number(value);
    return Number.isFinite(status) ? status : undefined;
  }
}
```

- [ ] **Step 6: Register entity and service**

Modify `server/src/module/saas/saas.module.ts`:

```ts
import { SaasResourcePackEntity } from './entities/saas-resource-pack.entity';
import { SaasResourcePackService } from './services/saas-resource-pack.service';
```

Add `SaasResourcePackEntity` to `TypeOrmModule.forFeature`, and add `SaasResourcePackService` to `providers` and `exports`.

- [ ] **Step 7: Run service tests**

Run:

```powershell
pnpm run test -- saas-resource-pack.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

Run:

```powershell
git add server/src/module/saas/entities/saas-resource-pack.entity.ts server/src/migrations/1760000000005-CreateSaasResourcePacks.ts server/src/module/saas/services/saas-resource-pack.service.ts server/src/module/saas/services/saas-resource-pack.service.spec.ts server/src/module/saas/saas.module.ts
git commit -m "feat: add SaaS resource pack catalog service"
```

## Task 2: Backend Platform/Tenant APIs And Seeds

**Files:**
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`
- Modify: `server/src/module/saas/saas-tenant.controller.ts`
- Modify: `server/src/module/saas/saas-tenant.controller.spec.ts`
- Modify: `server/src/migrations/1760000000001-SeedSaasFoundationData.ts`
- Modify: `server/src/migration-specs/seed-saas-foundation-data.spec.ts`

**Interfaces:**
- Produces: `GET /api/saas/platform/resource-packs`
- Produces: `GET /api/saas/tenant/resource-packs`
- Produces permissions `saas:resource-pack:index` and `tenant:resource-pack:view`.

- [ ] **Step 1: Write failing controller tests**

In `server/src/module/saas/saas-platform.controller.spec.ts`, add `listResourcePacks` mock and test:

```ts
const platformService = {
  listOrders: jest.fn(),
  listSubscriptions: jest.fn(),
  listResourcePacks: jest.fn(),
};

it('lists platform SaaS resource packs outside tenant scope', async () => {
  platformService.listResourcePacks.mockResolvedValue({
    list: [{ code: 'tokens_1m' }],
    total: 1,
    page: 1,
    limit: 20,
  });

  const result = await controller.listResourcePacks({ resource_type: 'tokens' }, { userId: 1 } as any);

  expect(platformService.listResourcePacks).toHaveBeenCalledWith({ resource_type: 'tokens' });
  expect(result.data).toEqual({
    list: [{ code: 'tokens_1m' }],
    total: 1,
    page: 1,
    limit: 20,
  });
});
```

In `server/src/module/saas/saas-tenant.controller.spec.ts`, add `SaasResourcePackService` provider and test:

```ts
const saasResourcePackService = {
  listTenantResourcePacks: jest.fn(),
};

it('returns active tenant resource packs in tenant context', async () => {
  jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
  saasResourcePackService.listTenantResourcePacks.mockResolvedValue([{ code: 'ai_calls_1k' }]);

  const result = await controller.resourcePacks();

  expect(saasResourcePackService.listTenantResourcePacks).toHaveBeenCalled();
  expect(result.data).toEqual([{ code: 'ai_calls_1k' }]);
});
```

- [ ] **Step 2: Run controller tests to verify failure**

Run:

```powershell
pnpm run test -- saas-platform.controller.spec.ts --runInBand
pnpm run test -- saas-tenant.controller.spec.ts --runInBand
```

Expected: FAIL because controller methods/providers do not exist yet.

- [ ] **Step 3: Add platform endpoint**

Modify `server/src/module/saas/saas-platform.controller.ts`:

```ts
import type { SaasResourcePackListQuery } from './services/saas-resource-pack.service';
```

Add method:

```ts
@Get('resource-packs')
@ApiOperation({ summary: 'List SaaS resource packs' })
@RequirePermission('saas:resource-pack:index')
listResourcePacks(@Query() query: SaasResourcePackListQuery, @User() user: UserDto) {
  return TenantContext.run(
    {
      tenantId: undefined,
      userId: user?.userId,
      ignoreAudit: false,
      ignoreTenant: true,
    },
    () => this.platformService.listResourcePacks(query).then((data) => ResultData.ok(data)),
  );
}
```

Add `listResourcePacks` method in `SaasPlatformService` that delegates to `SaasResourcePackService`, or inject `SaasResourcePackService` into the controller directly. Prefer service delegation to keep platform controller thin:

```ts
constructor(
  ...
  private readonly resourcePackService: SaasResourcePackService,
) {}

listResourcePacks(query: SaasResourcePackListQuery = {}) {
  return this.resourcePackService.listPlatformResourcePacks(query);
}
```

- [ ] **Step 4: Add tenant endpoint**

Modify `server/src/module/saas/saas-tenant.controller.ts`:

```ts
import { SaasResourcePackService } from './services/saas-resource-pack.service';
```

Inject `private readonly saasResourcePackService: SaasResourcePackService`.

Add:

```ts
@Get('resource-packs')
@ApiOperation({ summary: 'Get active SaaS resource packs for current tenant' })
async resourcePacks() {
  const tenantId = getTenantId();
  if (!tenantId) {
    return ResultData.fail(401, 'Tenant context is required');
  }

  return ResultData.ok(await this.saasResourcePackService.listTenantResourcePacks());
}
```

- [ ] **Step 5: Seed starter packs and menus**

Modify `server/src/migrations/1760000000001-SeedSaasFoundationData.ts`:

Add `ResourcePackSeed` type and seed array:

```ts
type ResourcePackSeed = {
  code: string;
  name: string;
  resourceType: string;
  quotaAmount: number;
  priceCents: number;
  sort: number;
  remark: string;
};

const RESOURCE_PACK_SEEDS: ResourcePackSeed[] = [
  { code: 'ai_calls_1k', name: 'AI Calls 1,000', resourceType: 'ai_calls', quotaAmount: 1000, priceCents: 9900, sort: 10, remark: 'Adds 1,000 AI calls' },
  { code: 'tokens_1m', name: 'Tokens 1,000,000', resourceType: 'tokens', quotaAmount: 1000000, priceCents: 19900, sort: 20, remark: 'Adds 1,000,000 tokens' },
  { code: 'storage_10gb', name: 'Storage 10GB', resourceType: 'storage_mb', quotaAmount: 10240, priceCents: 29900, sort: 30, remark: 'Adds 10GB storage' },
  { code: 'rag_docs_1k', name: 'RAG Documents 1,000', resourceType: 'rag_documents', quotaAmount: 1000, priceCents: 39900, sort: 40, remark: 'Adds 1,000 RAG documents' },
];
```

Insert resource packs in `up()` after plan quotas. Delete them in `down()`.

Add platform menu:

```ts
{
  name: '资源包管理',
  code: 'SaasResourcePack',
  type: 2,
  path: 'resource-packs',
  component: '/saas/platform/resource-pack',
  icon: 'ri:stack-line',
  sort: 50,
  remark: 'Seeded SaaS resource pack management menu',
}
```

Add tenant menu:

```ts
{
  name: '资源包',
  code: 'TenantResourcePack',
  type: 2,
  path: 'resource-packs',
  component: '/saas/tenant/resource-pack',
  icon: 'ri:stack-line',
  sort: 30,
  remark: 'Seeded tenant resource pack menu',
}
```

Add permissions:

```ts
{ parentCode: 'SaasResourcePack', name: '数据列表', slug: 'saas:resource-pack:index', method: 'GET', sort: 10, remark: 'Seeded SaaS resource pack list permission' }
{ parentCode: 'TenantResourcePack', name: '查看', slug: 'tenant:resource-pack:view', method: 'GET', sort: 10, remark: 'Seeded tenant resource pack view permission' }
```

- [ ] **Step 6: Update migration spec**

Modify `server/src/migration-specs/seed-saas-foundation-data.spec.ts` expectations:

```ts
expect(params).toContain('ai_calls_1k');
expect(params).toContain('tokens_1m');
expect(params).toContain('saas:resource-pack:index');
expect(params).toContain('tenant:resource-pack:view');
expect(params).toContain('/saas/platform/resource-pack');
expect(params).toContain('/saas/tenant/resource-pack');
```

- [ ] **Step 7: Run backend tests**

Run:

```powershell
pnpm run test -- saas-platform.controller.spec.ts --runInBand
pnpm run test -- saas-tenant.controller.spec.ts --runInBand
pnpm run test -- seed-saas-foundation-data.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

Run:

```powershell
git add server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-platform.controller.spec.ts server/src/module/saas/saas-tenant.controller.ts server/src/module/saas/saas-tenant.controller.spec.ts server/src/module/saas/services/saas-platform.service.ts server/src/migrations/1760000000001-SeedSaasFoundationData.ts server/src/migration-specs/seed-saas-foundation-data.spec.ts
git commit -m "feat: expose SaaS resource pack APIs"
```

## Task 3: Frontend Resource Pack Pages

**Files:**
- Modify: `web/src/api/saas.ts`
- Create: `web/src/views/saas/platform/resource-pack/index.vue`
- Create: `web/src/views/saas/tenant/resource-pack/index.vue`

**Interfaces:**
- Produces: `fetchPlatformResourcePacks(params)`
- Produces: `fetchTenantResourcePacks()`
- Produces pages matching backend component paths `/saas/platform/resource-pack` and `/saas/tenant/resource-pack`.

- [ ] **Step 1: Add API wrappers**

Modify `web/src/api/saas.ts`:

```ts
export interface SaasResourcePackRecord {
  id: number
  code: string
  name: string
  resource_type: string
  quota_amount: number
  price_cents: number
  currency: string
  status: number
  sort: number
  remark?: string
}

export interface SaasResourcePackListParams {
  page?: number
  limit?: number
  status?: number | string
  resource_type?: string
}

export function fetchPlatformResourcePacks(params: SaasResourcePackListParams) {
  return request.get<SaasPlatformPageResult<SaasResourcePackRecord>>({
    url: '/api/saas/platform/resource-packs',
    params
  })
}

export function fetchTenantResourcePacks() {
  return request.get<SaasResourcePackRecord[]>({
    url: '/api/saas/tenant/resource-packs'
  })
}
```

- [ ] **Step 2: Create platform page**

Create `web/src/views/saas/platform/resource-pack/index.vue` with:

```vue
<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-resource-pack-page">
      <template #header>
        <div class="saas-resource-pack-page__header">
          <div>
            <h1 class="saas-resource-pack-page__title">资源包管理</h1>
            <p class="saas-resource-pack-page__subtitle">查看平台可售的资源包目录。</p>
          </div>
          <ElButton :loading="loading" @click="loadResourcePacks">刷新</ElButton>
        </div>
      </template>

      <div class="saas-resource-pack-page__filters">
        <ElSelect v-model="filters.resource_type" clearable placeholder="资源类型" style="width: 180px" @change="loadResourcePacks">
          <ElOption label="AI 调用次数" value="ai_calls" />
          <ElOption label="Token" value="tokens" />
          <ElOption label="存储空间" value="storage_mb" />
          <ElOption label="知识库文档" value="rag_documents" />
        </ElSelect>
        <ElSelect v-model="filters.status" clearable placeholder="状态" style="width: 140px" @change="loadResourcePacks">
          <ElOption label="启用" :value="1" />
          <ElOption label="停用" :value="0" />
        </ElSelect>
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn prop="code" label="编码" width="170" />
        <ElTableColumn prop="name" label="名称" min-width="180" />
        <ElTableColumn label="资源类型" width="150">
          <template #default="{ row }">{{ formatResourceType(row.resource_type) }}</template>
        </ElTableColumn>
        <ElTableColumn label="额度" width="150">
          <template #default="{ row }">{{ formatQuota(row) }}</template>
        </ElTableColumn>
        <ElTableColumn label="价格" width="130">
          <template #default="{ row }">{{ formatPrice(row.price_cents, row.currency) }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'info'" effect="light">
              {{ row.status === 1 ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="remark" label="说明" min-width="220" />
      </ElTable>
    </ElCard>
  </div>
</template>
```

Implement script using `fetchPlatformResourcePacks`, `ref`, and `onMounted`.

- [ ] **Step 3: Create tenant page**

Create `web/src/views/saas/tenant/resource-pack/index.vue` with catalog cards:

```vue
<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="tenant-resource-pack-page">
      <template #header>
        <div class="tenant-resource-pack-page__header">
          <div>
            <h1 class="tenant-resource-pack-page__title">资源包</h1>
            <p class="tenant-resource-pack-page__subtitle">按需购买额外资源包，支付与到账功能即将开放。</p>
          </div>
          <ElButton :loading="loading" @click="loadResourcePacks">刷新</ElButton>
        </div>
      </template>

      <div v-if="!loading && !records.length" class="tenant-resource-pack-page__state">
        <ElEmpty description="暂无可购买资源包" />
      </div>

      <div v-else class="tenant-resource-pack-page__grid">
        <ElCard v-for="pack in records" :key="pack.code" shadow="never" class="tenant-resource-pack-page__pack">
          <div class="tenant-resource-pack-page__pack-header">
            <div>
              <p class="tenant-resource-pack-page__pack-type">{{ formatResourceType(pack.resource_type) }}</p>
              <h2 class="tenant-resource-pack-page__pack-name">{{ pack.name }}</h2>
            </div>
            <ElTag effect="light">即将开放</ElTag>
          </div>
          <div class="tenant-resource-pack-page__quota">{{ formatQuota(pack) }}</div>
          <div class="tenant-resource-pack-page__price">{{ formatPrice(pack.price_cents, pack.currency) }}</div>
          <p class="tenant-resource-pack-page__remark">{{ pack.remark || '资源包说明待补充' }}</p>
          <ElButton type="primary" disabled>即将开放</ElButton>
        </ElCard>
      </div>
    </ElCard>
  </div>
</template>
```

Implement script using `fetchTenantResourcePacks`, `ref`, and `onMounted`.

- [ ] **Step 4: Run frontend typecheck**

Run:

```powershell
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```powershell
git add web/src/api/saas.ts web/src/views/saas/platform/resource-pack/index.vue web/src/views/saas/tenant/resource-pack/index.vue
git commit -m "feat: add SaaS resource pack pages"
```

## Task 4: Final Verification

**Files:**
- Modify only files required to fix defects found during verification.

**Interfaces:**
- Confirms backend tests and typecheck pass.
- Confirms frontend typecheck passes.
- Confirms the new menu component paths resolve to real Vue files.

- [ ] **Step 1: Run full backend tests**

Run:

```powershell
pnpm exec jest --runInBand
```

Expected: PASS.

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

- [ ] **Step 4: Browser smoke check**

If the local backend and frontend are running with the latest code and migrations:

1. Open `http://localhost:5731/#/saas-platform/resource-packs`.
2. Confirm the platform resource-pack table renders.
3. Open `http://localhost:5731/#/tenant-saas/resource-packs`.
4. Confirm tenant resource-pack cards render and purchase buttons are disabled.

If the running DB has not applied the new migration/seed yet, record that browser smoke requires migration execution and rely on typecheck plus unit tests.

- [ ] **Step 5: Commit verification fixes if needed**

If verification required fixes:

```powershell
git add server/src/module/saas server/src/migrations server/src/migration-specs web/src/api/saas.ts web/src/views/saas
git commit -m "fix: stabilize SaaS resource pack foundation"
```

If no fixes were required, do not create an empty commit.
