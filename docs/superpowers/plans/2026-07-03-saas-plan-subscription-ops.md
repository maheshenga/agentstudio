# SaaS Plan Subscription Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build platform-managed SaaS plans, editable plan quotas, tenant plan quota display, explicit immediate subscription switching, and stronger plan order/subscription operations.

**Architecture:** Extend the existing `SaasPlanService`, `SaasOrderService`, and `SaasPlatformService` instead of introducing a new billing module. Reuse `saas_plan`, `saas_plan_quota`, `saas_order`, and `saas_subscription`; add DTOs, controller routes, menu permission migrations, and frontend views/API wrappers around those existing models. Keep subscription activation immediate and non-prorated.

**Tech Stack:** NestJS 11, TypeORM repositories/transactions, MySQL migrations, Jest, Vue 3, Element Plus, existing dynamic menu system, existing SaaS payment flow.

## Global Constraints

- Do not implement remaining-time proration.
- Do not implement delayed activation at subscription expiry.
- Do not implement auto-renewal, refunds, coupons, invoices, multi-currency billing, or multiple payment providers.
- Reuse existing SaaS tables unless a task explicitly says otherwise.
- Plan quota fields are `quotaType` and `totalQuota`; do not invent `resource_type`, `quota_limit`, or a new quota table.
- `free` is reserved for default provisioning and cannot be ordered as a paid upgrade.
- Disabled plans must not appear in tenant plan catalog and must not be orderable.
- Paid upgrade orders activate immediately and expire current active subscriptions immediately.
- Preserve unrelated untracked `sdd/` files and frontend temp logs.
- Use TDD for backend services, controllers, and migration behavior.

---

## File Structure

- Modify `server/src/module/saas/services/saas-plan.service.ts`: platform plan CRUD, quota management, tenant plan list with quotas.
- Create `server/src/module/saas/services/saas-plan.service.spec.ts`: plan service tests.
- Create `server/src/module/saas/dto/create-saas-plan.dto.ts`: create plan DTO.
- Create `server/src/module/saas/dto/update-saas-plan.dto.ts`: update plan DTO.
- Create `server/src/module/saas/dto/update-saas-plan-status.dto.ts`: status DTO.
- Create `server/src/module/saas/dto/update-saas-plan-quotas.dto.ts`: quota DTO.
- Modify `server/src/module/saas/saas-platform.controller.ts`: platform plan routes, order detail route, subscription detail route.
- Modify `server/src/module/saas/saas-platform.controller.spec.ts`: route/delegation tests.
- Modify `server/src/module/saas/saas-tenant.controller.ts`: tenant plans use `SaasPlanService.listTenantPlans`.
- Modify `server/src/module/saas/saas-tenant.controller.spec.ts`: tenant plan quota tests.
- Modify `server/src/module/saas/services/saas-order.service.ts`: reject free plan orders and strengthen immediate activation tests.
- Modify `server/src/module/saas/services/saas-order.service.spec.ts`: order and subscription switching tests.
- Modify `server/src/module/saas/services/saas-platform.service.ts`: order/subscription filters and detail lookups.
- Modify `server/src/module/saas/services/saas-platform.service.spec.ts`: platform ops tests.
- Create `server/src/migrations/1760000000011-AlignSaasPlanOperationsMenu.ts`: menu/permission migration.
- Create `server/src/migration-specs/align-saas-plan-operations-menu.spec.ts`: migration assertions.
- Modify `server/src/module/saas/saas.module.ts`: register any newly injected repositories if needed.
- Modify `web/src/api/saas.ts`: plan/order/subscription wrappers and types.
- Replace `web/src/views/saas/platform/plan/index.vue`: real plan management UI.
- Modify `web/src/views/saas/tenant/plan/index.vue`: quota display and free-plan ordering guard.
- Modify `web/src/views/saas/platform/subscription/index.vue`: order/subscription filters and detail drawers.

## Shared Interfaces

Use these API shapes consistently across tasks.

```ts
export type SaasBillingCycle = 'monthly' | 'yearly';

export interface SaasPlanQuotaInput {
  quota_type: 'users' | 'storage_mb' | 'ai_calls' | 'rag_documents' | 'tokens';
  total_quota: number;
  status?: number;
  remark?: string;
}

export interface SaasPlanResponse {
  id: number;
  code: string;
  name: string;
  billing_cycle: SaasBillingCycle;
  price_monthly: number;
  price_yearly: number;
  status: number;
  sort: number;
  remark?: string;
  create_time?: Date;
  update_time?: Date;
  quotas: SaasPlanQuotaInput[];
}
```

Supported quota types are exactly:

```ts
['users', 'storage_mb', 'ai_calls', 'rag_documents', 'tokens']
```

---

## Task 1: Backend Plan Catalog And Quota Service

**Files:**
- Modify: `server/src/module/saas/services/saas-plan.service.ts`
- Create: `server/src/module/saas/services/saas-plan.service.spec.ts`
- Create: `server/src/module/saas/dto/create-saas-plan.dto.ts`
- Create: `server/src/module/saas/dto/update-saas-plan.dto.ts`
- Create: `server/src/module/saas/dto/update-saas-plan-status.dto.ts`
- Create: `server/src/module/saas/dto/update-saas-plan-quotas.dto.ts`
- Modify: `server/src/module/saas/saas.module.ts` if `SaasPlanQuotaEntity` is not already registered for `SaasPlanService`

**Interfaces:**
- Produces: `SaasPlanService.listPlatformPlans(query)`
- Produces: `SaasPlanService.findPlatformPlan(code)`
- Produces: `SaasPlanService.createPlatformPlan(dto)`
- Produces: `SaasPlanService.updatePlatformPlan(code, dto)`
- Produces: `SaasPlanService.updatePlatformPlanStatus(code, status)`
- Produces: `SaasPlanService.updatePlatformPlanQuotas(code, quotas)`
- Produces: `SaasPlanService.listTenantPlans()`

- [ ] **Step 1: Write failing service tests**

Create `server/src/module/saas/services/saas-plan.service.spec.ts` with tests covering list/create/update/status/quota/tenant list.

```ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasPlanQuotaEntity } from '../entities/saas-plan-quota.entity';
import { SaasPlanService } from './saas-plan.service';

describe('SaasPlanService', () => {
  let service: SaasPlanService;
  const planRepo = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
  };
  const quotaRepo = {
    delete: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    planRepo.create.mockImplementation((value) => value);
    planRepo.save.mockImplementation(async (value) => ({ id: 8, ...value }));
    quotaRepo.save.mockImplementation(async (value) => value);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasPlanService,
        { provide: getRepositoryToken(SaasPlanEntity), useValue: planRepo },
        { provide: getRepositoryToken(SaasPlanQuotaEntity), useValue: quotaRepo },
      ],
    }).compile();

    service = module.get(SaasPlanService);
  });

  it('lists platform plans with filters and pagination', async () => {
    planRepo.findAndCount.mockResolvedValue([[{ id: 1, code: 'pro', name: 'Pro', status: 1 }], 1]);
    quotaRepo.find.mockResolvedValue([{ planId: 1, quotaType: 'tokens', totalQuota: 1000, status: 1 }]);

    await expect(service.listPlatformPlans({ page: '2', limit: '10', status: '1', keyword: 'pro' })).resolves.toMatchObject({ total: 1, page: 2, limit: 10 });

    expect(planRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: [
        expect.objectContaining({ code: expect.any(Object), status: 1 }),
        expect.objectContaining({ name: expect.any(Object), status: 1 }),
      ],
    }));
  });

  it('creates a platform plan with backend cents and validates duplicate code', async () => {
    planRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.createPlatformPlan({ code: 'team', name: 'Team', billing_cycle: 'monthly', price_monthly: 9900, price_yearly: 99000, status: 1, sort: 30 })).resolves.toMatchObject({ code: 'team' });

    expect(planRepo.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'team', priceMonthly: 9900, priceYearly: 99000 }));

    planRepo.findOne.mockResolvedValueOnce({ id: 1, code: 'team' });
    await expect(service.createPlatformPlan({ code: 'team', name: 'Team' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid plan code format', async () => {
    await expect(service.createPlatformPlan({ code: 'Team Plan', name: 'Team' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates editable plan fields without changing code', async () => {
    planRepo.findOne.mockResolvedValue({ id: 2, code: 'pro', name: 'Pro', status: 1 });

    await service.updatePlatformPlan('pro', { name: 'Pro Plus', price_monthly: 12900, status: 1 });

    expect(planRepo.save).toHaveBeenCalledWith(expect.objectContaining({ code: 'pro', name: 'Pro Plus', priceMonthly: 12900 }));
  });

  it('updates plan status', async () => {
    planRepo.findOne.mockResolvedValue({ id: 2, code: 'pro', status: 1 });

    await service.updatePlatformPlanStatus('pro', 0);

    expect(planRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 0 }));
  });

  it('replaces supported quotas for a plan', async () => {
    planRepo.findOne.mockResolvedValue({ id: 2, code: 'pro' });

    await service.updatePlatformPlanQuotas('pro', {
      quotas: [
        { quota_type: 'tokens', total_quota: 1000000 },
        { quota_type: 'storage_mb', total_quota: 10240 },
      ],
    });

    expect(quotaRepo.delete).toHaveBeenCalledWith({ planId: 2 });
    expect(quotaRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ planId: 2, quotaType: 'tokens', totalQuota: 1000000, status: 1 }),
      expect.objectContaining({ planId: 2, quotaType: 'storage_mb', totalQuota: 10240, status: 1 }),
    ]);
  });

  it('rejects unsupported quota types', async () => {
    planRepo.findOne.mockResolvedValue({ id: 2, code: 'pro' });

    await expect(service.updatePlatformPlanQuotas('pro', { quotas: [{ quota_type: 'bad', total_quota: 1 }] as any })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists tenant plans with only enabled plans and quotas', async () => {
    planRepo.find.mockResolvedValue([{ id: 2, code: 'pro', name: 'Pro', status: 1 }]);
    quotaRepo.find.mockResolvedValue([{ planId: 2, quotaType: 'tokens', totalQuota: 1000000, status: 1 }]);

    await expect(service.listTenantPlans()).resolves.toEqual([
      expect.objectContaining({ code: 'pro', quotas: [{ quota_type: 'tokens', total_quota: 1000000, status: 1, remark: undefined }] }),
    ]);

    expect(planRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 1 } }));
  });

  it('throws not found for missing platform plan detail', async () => {
    planRepo.findOne.mockResolvedValue(null);
    await expect(service.findPlatformPlan('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run service tests to verify failure**

Run:

```powershell
cd server
pnpm run test -- saas-plan.service.spec.ts --runInBand
```

Expected: FAIL because the spec file imports methods and DTO behavior that do not exist.

- [ ] **Step 3: Create DTOs**

Create `server/src/module/saas/dto/create-saas-plan.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateSaasPlanDto {
  @ApiProperty({ required: true })
  @IsString()
  @Matches(/^[a-z0-9_-]+$/)
  @MaxLength(50)
  code: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false, enum: ['monthly', 'yearly'] })
  @IsOptional()
  @IsIn(['monthly', 'yearly'])
  billing_cycle?: 'monthly' | 'yearly';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  price_monthly?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  price_yearly?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn([0, 1])
  status?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  sort?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
```

Create `server/src/module/saas/dto/update-saas-plan.dto.ts`:

```ts
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSaasPlanDto } from './create-saas-plan.dto';

export class UpdateSaasPlanDto extends PartialType(OmitType(CreateSaasPlanDto, ['code'] as const)) {}
```

Create `server/src/module/saas/dto/update-saas-plan-status.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateSaasPlanStatusDto {
  @ApiProperty({ required: true, enum: [0, 1] })
  @IsIn([0, 1])
  status: number;
}
```

Create `server/src/module/saas/dto/update-saas-plan-quotas.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class SaasPlanQuotaDto {
  @ApiProperty({ required: true, enum: ['users', 'storage_mb', 'ai_calls', 'rag_documents', 'tokens'] })
  @IsIn(['users', 'storage_mb', 'ai_calls', 'rag_documents', 'tokens'])
  quota_type: string;

  @ApiProperty({ required: true })
  @IsInt()
  @Min(0)
  total_quota: number;

  @ApiProperty({ required: false, enum: [0, 1] })
  @IsOptional()
  @IsIn([0, 1])
  status?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

export class UpdateSaasPlanQuotasDto {
  @ApiProperty({ required: true, type: [SaasPlanQuotaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaasPlanQuotaDto)
  quotas: SaasPlanQuotaDto[];
}
```

- [ ] **Step 4: Implement service methods**

Modify `server/src/module/saas/services/saas-plan.service.ts`.

Imports:

```ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';

import { SAAS_PLAN_FREE } from '../constants';
import { CreateSaasPlanDto } from '../dto/create-saas-plan.dto';
import { UpdateSaasPlanQuotasDto } from '../dto/update-saas-plan-quotas.dto';
import { UpdateSaasPlanDto } from '../dto/update-saas-plan.dto';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasPlanQuotaEntity } from '../entities/saas-plan-quota.entity';
```

Add query/type helpers:

```ts
export interface SaasPlanListQuery {
  page?: string | number;
  limit?: string | number;
  status?: string | number;
  keyword?: string;
}

const SUPPORTED_PLAN_QUOTA_TYPES = ['users', 'storage_mb', 'ai_calls', 'rag_documents', 'tokens'] as const;
```

Inject quota repo:

```ts
constructor(
  @InjectRepository(SaasPlanEntity)
  private readonly saasPlanRepo: Repository<SaasPlanEntity>,
  @InjectRepository(SaasPlanQuotaEntity)
  private readonly saasPlanQuotaRepo: Repository<SaasPlanQuotaEntity>,
) {}
```

Add service methods with this behavior:

```ts
async listPlatformPlans(query: SaasPlanListQuery = {}) {
  const { page, limit, skip } = this.resolvePagination(query);
  const baseWhere: any = {};
  if (query.status !== undefined && query.status !== '') baseWhere.status = Number(query.status);
  const where = query.keyword
    ? [
        { ...baseWhere, code: Like(`%${query.keyword}%`) },
        { ...baseWhere, name: Like(`%${query.keyword}%`) },
      ]
    : baseWhere;

  const [plans, total] = await this.saasPlanRepo.findAndCount({
    where,
    order: { sort: 'ASC', id: 'ASC' },
    skip,
    take: limit,
  });

  return { list: await this.attachQuotas(plans), total, page, limit };
}

async listTenantPlans() {
  const plans = await this.saasPlanRepo.find({
    where: { status: 1 },
    order: { sort: 'ASC', id: 'ASC' },
  });
  return this.attachQuotas(plans);
}

async findPlatformPlan(code: string) {
  const plan = await this.saasPlanRepo.findOne({ where: { code } });
  if (!plan) throw new NotFoundException(`Plan ${code} not found`);
  return (await this.attachQuotas([plan]))[0];
}

async createPlatformPlan(dto: CreateSaasPlanDto) {
  this.assertPlanCode(dto.code);
  const existing = await this.saasPlanRepo.findOne({ where: { code: dto.code } });
  if (existing) throw new ConflictException(`Plan ${dto.code} already exists`);
  const plan = this.saasPlanRepo.create({
    code: dto.code,
    name: dto.name,
    billingCycle: dto.billing_cycle || 'monthly',
    priceMonthly: Number(dto.price_monthly || 0),
    priceYearly: Number(dto.price_yearly || 0),
    status: dto.status ?? 1,
    sort: dto.sort ?? 100,
    remark: dto.remark || '',
  });
  return this.toResponse(await this.saasPlanRepo.save(plan), []);
}

async updatePlatformPlan(code: string, dto: UpdateSaasPlanDto) {
  const plan = await this.saasPlanRepo.findOne({ where: { code } });
  if (!plan) throw new NotFoundException(`Plan ${code} not found`);
  if (dto.name !== undefined) plan.name = dto.name;
  if (dto.billing_cycle !== undefined) plan.billingCycle = dto.billing_cycle;
  if (dto.price_monthly !== undefined) plan.priceMonthly = Number(dto.price_monthly);
  if (dto.price_yearly !== undefined) plan.priceYearly = Number(dto.price_yearly);
  if (dto.status !== undefined) plan.status = Number(dto.status);
  if (dto.sort !== undefined) plan.sort = Number(dto.sort);
  if (dto.remark !== undefined) plan.remark = dto.remark;
  return this.findPlatformPlan((await this.saasPlanRepo.save(plan)).code);
}

async updatePlatformPlanStatus(code: string, status: number) {
  const plan = await this.saasPlanRepo.findOne({ where: { code } });
  if (!plan) throw new NotFoundException(`Plan ${code} not found`);
  plan.status = Number(status);
  return this.findPlatformPlan((await this.saasPlanRepo.save(plan)).code);
}

async updatePlatformPlanQuotas(code: string, dto: UpdateSaasPlanQuotasDto) {
  const plan = await this.saasPlanRepo.findOne({ where: { code } });
  if (!plan) throw new NotFoundException(`Plan ${code} not found`);
  for (const quota of dto.quotas) this.assertQuotaType(quota.quota_type);
  await this.saasPlanQuotaRepo.delete({ planId: plan.id });
  await this.saasPlanQuotaRepo.save(dto.quotas.map((quota) => ({
    planId: plan.id,
    quotaType: quota.quota_type,
    totalQuota: Number(quota.total_quota || 0),
    status: quota.status ?? 1,
    remark: quota.remark || '',
  })));
  return this.findPlatformPlan(code);
}
```

Add helpers:

```ts
private async attachQuotas(plans: SaasPlanEntity[]) {
  const planIds = plans.map((plan) => plan.id);
  const quotas = planIds.length
    ? await this.saasPlanQuotaRepo.find({ where: { planId: In(planIds) }, order: { id: 'ASC' } })
    : [];
  return plans.map((plan) => this.toResponse(plan, quotas.filter((quota) => Number(quota.planId) === Number(plan.id))));
}

private toResponse(plan: Partial<SaasPlanEntity>, quotas: Partial<SaasPlanQuotaEntity>[] = []) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    billing_cycle: plan.billingCycle,
    price_monthly: Number(plan.priceMonthly) || 0,
    price_yearly: Number(plan.priceYearly) || 0,
    status: Number(plan.status) || 0,
    sort: Number(plan.sort) || 0,
    remark: plan.remark,
    create_time: plan.createTime,
    update_time: plan.updateTime,
    quotas: quotas.map((quota) => ({
      quota_type: quota.quotaType,
      total_quota: Number(quota.totalQuota) || 0,
      status: quota.status ?? 1,
      remark: quota.remark,
    })),
  };
}

private assertPlanCode(code: string) {
  if (!/^[a-z0-9_-]+$/.test(code)) throw new BadRequestException('Plan code must use lowercase letters, numbers, underscore, or hyphen');
}

private assertQuotaType(quotaType: string) {
  if (!SUPPORTED_PLAN_QUOTA_TYPES.includes(quotaType as any)) throw new BadRequestException(`Unsupported quota type ${quotaType}`);
}

private resolvePagination(query: SaasPlanListQuery) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  return { page, limit, skip: (page - 1) * limit };
}
```

Keep existing `getFreePlan` and `getPlanByCode`, but make sure `getPlanByCode` still filters `status: 1`.

- [ ] **Step 5: Run service tests to verify pass**

Run:

```powershell
cd server
pnpm run test -- saas-plan.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```powershell
git add server/src/module/saas/services/saas-plan.service.ts server/src/module/saas/services/saas-plan.service.spec.ts server/src/module/saas/dto/create-saas-plan.dto.ts server/src/module/saas/dto/update-saas-plan.dto.ts server/src/module/saas/dto/update-saas-plan-status.dto.ts server/src/module/saas/dto/update-saas-plan-quotas.dto.ts server/src/module/saas/saas.module.ts
git commit -m "feat: add SaaS plan catalog operations"
```

## Task 2: Tenant Plan Catalog And Upgrade Order Rules

**Files:**
- Modify: `server/src/module/saas/saas-tenant.controller.ts`
- Modify: `server/src/module/saas/saas-tenant.controller.spec.ts`
- Modify: `server/src/module/saas/services/saas-order.service.ts`
- Modify: `server/src/module/saas/services/saas-order.service.spec.ts`

**Interfaces:**
- Consumes: `SaasPlanService.listTenantPlans()`
- Produces: tenant `GET /api/saas/tenant/plans` responses with `quotas`
- Produces: free-plan order rejection in `SaasOrderService.createUpgradeOrder`

- [ ] **Step 1: Write failing tenant controller test**

In `server/src/module/saas/saas-tenant.controller.spec.ts`, update the plan service mock with `listTenantPlans` and add:

```ts
it('returns enabled tenant plans with quota summaries from plan service', async () => {
  jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
  saasPlanService.listTenantPlans.mockResolvedValue([
    {
      id: 2,
      code: 'pro',
      name: 'Pro',
      billing_cycle: 'monthly',
      price_monthly: 9900,
      price_yearly: 99000,
      quotas: [{ quota_type: 'tokens', total_quota: 1000000 }],
    },
  ]);

  const result = await controller.plans();

  expect(saasPlanService.listTenantPlans).toHaveBeenCalled();
  expect(result.data).toEqual([
    expect.objectContaining({ code: 'pro', quotas: [{ quota_type: 'tokens', total_quota: 1000000 }] }),
  ]);
});
```

- [ ] **Step 2: Write failing order service tests**

In `server/src/module/saas/services/saas-order.service.spec.ts`, add:

```ts
it('rejects free plan upgrade orders', async () => {
  saasPlanRepo.findOne.mockResolvedValue({ id: 1, code: 'free', status: 1 });

  await expect(service.createUpgradeOrder(12, { plan_code: 'free', billing_cycle: 'monthly', payment_method: 'alipay' })).rejects.toBeInstanceOf(BadRequestException);
});

it('starts a new same-plan cycle immediately after payment', async () => {
  const paidAt = new Date('2026-07-03T12:00:00.000Z');
  jest.useFakeTimers().setSystemTime(paidAt);
  txOrderRepo.findOne.mockResolvedValue({
    orderNo: 'SO20260703120000001000001',
    tenantId: 12,
    planId: 2,
    planCode: 'pro',
    billingCycle: 'monthly',
    status: 'pending',
  });

  await service.confirmDevPayment(12, 'SO20260703120000001000001');

  expect(txSubscriptionRepo.update).toHaveBeenCalledWith(
    { tenantId: 12, status: 'active' },
    { status: 'expired', endTime: paidAt },
  );
  expect(txSubscriptionRepo.save).toHaveBeenCalledWith(expect.objectContaining({
    tenantId: 12,
    planId: 2,
    status: 'active',
    startTime: paidAt,
  }));
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```powershell
cd server
pnpm run test -- saas-tenant.controller.spec.ts --runInBand
pnpm run test -- saas-order.service.spec.ts --runInBand
```

Expected: FAIL because tenant controller still reads repo directly and free plan is not rejected.

- [ ] **Step 4: Implement tenant plans through plan service**

Modify `saas-tenant.controller.ts` constructor to use `SaasPlanService` for `plans()` instead of direct `saasPlanRepo.find` mapping:

```ts
return ResultData.ok(await this.saasPlanService.listTenantPlans());
```

Keep the tenant context check unchanged.

- [ ] **Step 5: Reject free plan upgrade orders**

Modify `SaasOrderService.createUpgradeOrder` after loading the plan:

```ts
if (plan.code === SAAS_PLAN_FREE) {
  throw new BadRequestException('Free plan cannot be purchased as an upgrade order');
}
```

Import `SAAS_PLAN_FREE` from `../constants`.

- [ ] **Step 6: Run tests to verify pass**

Run:

```powershell
cd server
pnpm run test -- saas-tenant.controller.spec.ts --runInBand
pnpm run test -- saas-order.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add server/src/module/saas/saas-tenant.controller.ts server/src/module/saas/saas-tenant.controller.spec.ts server/src/module/saas/services/saas-order.service.ts server/src/module/saas/services/saas-order.service.spec.ts
git commit -m "feat: enforce SaaS plan upgrade rules"
```

## Task 3: Platform Plan, Order, And Subscription APIs

**Files:**
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.spec.ts`

**Interfaces:**
- Produces: platform plan routes listed in the design
- Produces: `SaasPlatformService.findOrder(orderNo)`
- Produces: `SaasPlatformService.findSubscription(id)`
- Extends: `SaasPlatformListQuery.order_no?: string`, `plan_code?: string`, `plan_id?: string | number`

- [ ] **Step 1: Write failing platform service tests**

In `saas-platform.service.spec.ts`, inject a `planRepo` mock into the testing module and add:

```ts
it('filters SaaS orders by order number and plan code', async () => {
  orderRepo.findAndCount.mockResolvedValue([[{ orderNo: 'SO1', planCode: 'pro' }], 1]);

  await service.listOrders({ order_no: 'SO1', plan_code: 'pro' });

  expect(orderRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
    where: { orderNo: 'SO1', planCode: 'pro' },
  }));
});

it('finds a platform SaaS order by order number', async () => {
  orderRepo.findOne.mockResolvedValue({ id: 1, orderNo: 'SO1', tenantId: 12, planCode: 'pro' });

  await expect(service.findOrder('SO1')).resolves.toMatchObject({ order_no: 'SO1', tenant_id: 12 });
  expect(orderRepo.findOne).toHaveBeenCalledWith({ where: { orderNo: 'SO1' } });
});

it('filters subscriptions by plan id', async () => {
  subscriptionRepo.findAndCount.mockResolvedValue([[{ id: 9, tenantId: 12, planId: 2, status: 'active' }], 1]);

  await service.listSubscriptions({ plan_id: '2' });

  expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
    where: { planId: 2 },
  }));
});

it('filters subscriptions by plan code when plan id is absent', async () => {
  planRepo.findOne.mockResolvedValue({ id: 3, code: 'team' });
  subscriptionRepo.findAndCount.mockResolvedValue([[{ id: 10, tenantId: 12, planId: 3, status: 'active' }], 1]);

  await service.listSubscriptions({ plan_code: 'team' });

  expect(planRepo.findOne).toHaveBeenCalledWith({ where: { code: 'team' } });
  expect(subscriptionRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
    where: { planId: 3 },
  }));
});

it('returns an empty subscription page for an unknown plan code', async () => {
  planRepo.findOne.mockResolvedValue(null);

  await expect(service.listSubscriptions({ plan_code: 'missing' })).resolves.toMatchObject({ list: [], total: 0 });
  expect(subscriptionRepo.findAndCount).not.toHaveBeenCalled();
});

it('finds subscription detail by id', async () => {
  subscriptionRepo.findOne.mockResolvedValue({ id: 9, tenantId: 12, planId: 2, status: 'active' });

  await expect(service.findSubscription(9)).resolves.toMatchObject({ id: 9, tenant_id: 12, plan_id: 2 });
  expect(subscriptionRepo.findOne).toHaveBeenCalledWith({ where: { id: 9 } });
});
```

- [ ] **Step 2: Write failing platform controller tests**

In `saas-platform.controller.spec.ts`, extend mocks with `planService` and add:

```ts
it('lists platform SaaS plans outside tenant scope', async () => {
  planService.listPlatformPlans.mockResolvedValue({ list: [{ code: 'pro' }], total: 1, page: 1, limit: 20 });

  const result = await controller.listPlans({ status: '1' }, { userId: 1 } as any);

  expect(planService.listPlatformPlans).toHaveBeenCalledWith({ status: '1' });
  expect(result.data.list).toEqual([{ code: 'pro' }]);
});

it('creates a platform SaaS plan outside tenant scope', async () => {
  planService.createPlatformPlan.mockResolvedValue({ code: 'team' });

  const result = await controller.createPlan({ code: 'team', name: 'Team' } as any, { userId: 1 } as any);

  expect(planService.createPlatformPlan).toHaveBeenCalledWith({ code: 'team', name: 'Team' });
  expect(result.data).toEqual({ code: 'team' });
});

it('updates platform SaaS plan quotas outside tenant scope', async () => {
  planService.updatePlatformPlanQuotas.mockResolvedValue({ code: 'pro', quotas: [] });

  const body = { quotas: [{ quota_type: 'tokens', total_quota: 1000 }] };
  const result = await controller.updatePlanQuotas('pro', body as any, { userId: 1 } as any);

  expect(planService.updatePlatformPlanQuotas).toHaveBeenCalledWith('pro', body);
  expect(result.data).toEqual({ code: 'pro', quotas: [] });
});

it('returns platform SaaS order detail outside tenant scope', async () => {
  platformService.findOrder.mockResolvedValue({ order_no: 'SO1' });

  const result = await controller.getOrder('SO1', { userId: 1 } as any);

  expect(platformService.findOrder).toHaveBeenCalledWith('SO1');
  expect(result.data).toEqual({ order_no: 'SO1' });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```powershell
cd server
pnpm run test -- saas-platform.service.spec.ts --runInBand
pnpm run test -- saas-platform.controller.spec.ts --runInBand
```

Expected: FAIL because routes and service methods do not exist.

- [ ] **Step 4: Implement platform service filters and details**

Import and inject `SaasPlanEntity`:

```ts
import { SaasPlanEntity } from '../entities/saas-plan.entity';

constructor(
  @InjectRepository(SaasOrderEntity)
  private readonly orderRepo: Repository<SaasOrderEntity>,
  @InjectRepository(SaasSubscriptionEntity)
  private readonly subscriptionRepo: Repository<SaasSubscriptionEntity>,
  @InjectRepository(SaasPlanEntity)
  private readonly planRepo: Repository<SaasPlanEntity>,
  private readonly resourcePackService: SaasResourcePackService,
  private readonly resourcePackOrderService: SaasResourcePackOrderService,
) {}
```

Modify `SaasPlatformListQuery`:

```ts
export interface SaasPlatformListQuery {
  page?: string | number;
  limit?: string | number;
  status?: string;
  tenant_id?: string | number;
  order_no?: string;
  plan_code?: string;
  plan_id?: string | number;
}
```

In `listOrders`, add:

```ts
if (query.order_no) where.orderNo = query.order_no;
if (query.plan_code) where.planCode = query.plan_code;
```

In `listSubscriptions`, add this after the tenant filter. `plan_id` takes precedence when both filters are supplied:

```ts
const planId = this.resolveTenantId(query.plan_id);
if (planId !== undefined) {
  where.planId = planId;
} else if (query.plan_code) {
  const plan = await this.planRepo.findOne({ where: { code: query.plan_code } });
  if (!plan) {
    return { list: [], total: 0, page, limit };
  }
  where.planId = Number(plan.id);
}
```

Add:

```ts
async findOrder(orderNo: string) {
  const order = await this.orderRepo.findOne({ where: { orderNo } });
  return order ? this.toOrderResponse(order) : null;
}

async findSubscription(id: string | number) {
  const subscriptionId = Number(id);
  if (!Number.isFinite(subscriptionId) || subscriptionId <= 0) return null;
  const subscription = await this.subscriptionRepo.findOne({ where: { id: subscriptionId } });
  return subscription ? this.toSubscriptionResponse(subscription) : null;
}
```

Extract `toOrderResponse` and `toSubscriptionResponse` from current map inline code.

- [ ] **Step 5: Implement platform controller routes**

Inject `SaasPlanService` into `SaasPlatformController`.

Add routes:

```ts
@Get('plans')
@RequirePermission('saas:plan:index')
listPlans(@Query() query: SaasPlanListQuery, @User() user: UserDto) { ... }

@Post('plans')
@RequirePermission('saas:plan:create')
createPlan(@Body() body: CreateSaasPlanDto, @User() user: UserDto) { ... }

@Get('plans/:code')
@RequirePermission('saas:plan:index')
getPlan(@Param('code') code: string, @User() user: UserDto) { ... }

@Put('plans/:code')
@RequirePermission('saas:plan:update')
updatePlan(@Param('code') code: string, @Body() body: UpdateSaasPlanDto, @User() user: UserDto) { ... }

@Put('plans/:code/status')
@RequirePermission('saas:plan:status')
updatePlanStatus(@Param('code') code: string, @Body() body: UpdateSaasPlanStatusDto, @User() user: UserDto) { ... }

@Put('plans/:code/quotas')
@RequirePermission('saas:plan:quota:update')
updatePlanQuotas(@Param('code') code: string, @Body() body: UpdateSaasPlanQuotasDto, @User() user: UserDto) { ... }

@Get('orders/:order_no')
@RequirePermission('saas:order:list')
getOrder(@Param('order_no') orderNo: string, @User() user: UserDto) { ... }

@Get('subscriptions/:id')
@RequirePermission('saas:subscription:list')
getSubscription(@Param('id') id: string, @User() user: UserDto) { ... }
```

Use the same `TenantContext.run({ ignoreTenant: true })` wrapper pattern already in the controller.

- [ ] **Step 6: Run tests to verify pass**

Run:

```powershell
cd server
pnpm run test -- saas-platform.service.spec.ts --runInBand
pnpm run test -- saas-platform.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```powershell
git add server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-platform.controller.spec.ts server/src/module/saas/services/saas-platform.service.ts server/src/module/saas/services/saas-platform.service.spec.ts
git commit -m "feat: expose SaaS plan operations APIs"
```

## Task 4: Plan Operations Menu And Permission Migration

**Files:**
- Create: `server/src/migrations/1760000000011-AlignSaasPlanOperationsMenu.ts`
- Create: `server/src/migration-specs/align-saas-plan-operations-menu.spec.ts`

**Interfaces:**
- Produces permissions:
  - `saas:plan:create`
  - `saas:plan:update`
  - `saas:plan:status`
  - `saas:plan:quota:update`

- [ ] **Step 1: Write failing migration spec**

Create `server/src/migration-specs/align-saas-plan-operations-menu.spec.ts`:

```ts
import { AlignSaasPlanOperationsMenu1760000000011 } from '../migrations/1760000000011-AlignSaasPlanOperationsMenu';

describe('AlignSaasPlanOperationsMenu1760000000011', () => {
  it('inserts platform plan operation permissions', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new AlignSaasPlanOperationsMenu1760000000011().up(queryRunner as any);

    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values ?? []);
    expect(params).toContain('saas:plan:create');
    expect(params).toContain('saas:plan:update');
    expect(params).toContain('saas:plan:status');
    expect(params).toContain('saas:plan:quota:update');
    expect(params).toContain('SaasPlan');
    expect(params).toContain('/saas/platform/plan');
  });
});
```

- [ ] **Step 2: Run migration spec to verify failure**

Run:

```powershell
cd server
pnpm run test -- align-saas-plan-operations-menu.spec.ts --runInBand
```

Expected: FAIL because migration does not exist.

- [ ] **Step 3: Implement idempotent migration**

Create `1760000000011-AlignSaasPlanOperationsMenu.ts` using the `insertChildMenu` and `insertPermission` pattern from earlier SaaS migrations.

Menu alignment SQL should update or insert menu code `SaasPlan` with:

```ts
{
  name: 'Plan Management',
  code: 'SaasPlan',
  type: 2,
  path: 'plans',
  component: '/saas/platform/plan',
  icon: 'ri:price-tag-3-line',
  sort: 20,
  remark: 'Aligned SaaS plan management menu',
}
```

Permissions:

```ts
[
  { parentCode: 'SaasPlan', name: 'Create', slug: 'saas:plan:create', method: 'POST', sort: 20 },
  { parentCode: 'SaasPlan', name: 'Update', slug: 'saas:plan:update', method: 'PUT', sort: 30 },
  { parentCode: 'SaasPlan', name: 'Status', slug: 'saas:plan:status', method: 'PUT', sort: 40 },
  { parentCode: 'SaasPlan', name: 'Quota update', slug: 'saas:plan:quota:update', method: 'PUT', sort: 50 },
]
```

Keep existing `saas:plan:index` intact.

- [ ] **Step 4: Run migration spec to verify pass**

Run:

```powershell
cd server
pnpm run test -- align-saas-plan-operations-menu.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```powershell
git add server/src/migrations/1760000000011-AlignSaasPlanOperationsMenu.ts server/src/migration-specs/align-saas-plan-operations-menu.spec.ts
git commit -m "feat: add SaaS plan operations permissions"
```

## Task 5: Frontend API And Platform Plan Management UI

**Files:**
- Modify: `web/src/api/saas.ts`
- Replace: `web/src/views/saas/platform/plan/index.vue`

**Interfaces:**
- Consumes platform plan APIs from Task 3
- Produces real platform plan management UI

- [ ] **Step 1: Add frontend API types and wrappers**

Modify `web/src/api/saas.ts`.

Add types:

```ts
export interface SaasPlanQuotaRecord {
  quota_type: string
  total_quota: number
  status?: number
  remark?: string
}

export interface SaasPlatformPlanRecord extends SaasPlanOption {
  status: number
  sort: number
  remark?: string
  create_time?: string | Date
  update_time?: string | Date
  quotas: SaasPlanQuotaRecord[]
}

export interface SaasPlatformPlanListParams {
  page?: number
  limit?: number
  status?: number | string
  keyword?: string
}

export interface SaveSaasPlatformPlanParams {
  code?: string
  name: string
  billing_cycle?: 'monthly' | 'yearly'
  price_monthly?: number
  price_yearly?: number
  status?: number
  sort?: number
  remark?: string
}
```

Add wrappers:

```ts
export function fetchPlatformPlans(params: SaasPlatformPlanListParams) {
  return request.get<SaasPlatformPageResult<SaasPlatformPlanRecord>>({ url: '/api/saas/platform/plans', params })
}

export function fetchPlatformPlan(code: string) {
  return request.get<SaasPlatformPlanRecord>({ url: `/api/saas/platform/plans/${code}` })
}

export function createPlatformPlan(params: SaveSaasPlatformPlanParams) {
  return request.post<SaasPlatformPlanRecord>({ url: '/api/saas/platform/plans', data: params })
}

export function updatePlatformPlan(code: string, params: SaveSaasPlatformPlanParams) {
  return request.put<SaasPlatformPlanRecord>({ url: `/api/saas/platform/plans/${code}`, data: params })
}

export function updatePlatformPlanStatus(code: string, status: number) {
  return request.put<SaasPlatformPlanRecord>({ url: `/api/saas/platform/plans/${code}/status`, data: { status } })
}

export function updatePlatformPlanQuotas(code: string, quotas: SaasPlanQuotaRecord[]) {
  return request.put<SaasPlatformPlanRecord>({ url: `/api/saas/platform/plans/${code}/quotas`, data: { quotas } })
}
```

- [ ] **Step 2: Replace platform plan static page**

Replace `web/src/views/saas/platform/plan/index.vue` with a real management page using Element Plus:

- `ElCard` shell matching existing admin pages.
- Filters: keyword input, status select, query button.
- Table columns: code, name, billing cycle, monthly price, yearly price, status, sort, remark, update time, actions.
- Actions: add, edit, enable/disable, quotas.
- Plan dialog with code/name/billing cycle/prices/status/sort/remark.
- Quota dialog with one row per supported quota type.

Use state shape:

```ts
const records = ref<SaasPlatformPlanRecord[]>([])
const loading = ref(false)
const filters = reactive({ keyword: '', status: '' })
const pager = reactive({ page: 1, limit: 20, total: 0 })
const planDialogVisible = ref(false)
const quotaDialogVisible = ref(false)
const editingCode = ref('')
const planForm = reactive({ code: '', name: '', billing_cycle: 'monthly' as 'monthly' | 'yearly', price_monthly_yuan: 0, price_yearly_yuan: 0, status: 1, sort: 100, remark: '' })
const quotaRows = ref<SaasPlanQuotaRecord[]>([])
```

Money conversion helpers:

```ts
function centsToYuan(value: number) { return Number(((Number(value) || 0) / 100).toFixed(2)) }
function yuanToCents(value: number) { return Math.round((Number(value) || 0) * 100) }
```

Supported quota labels:

```ts
const quotaLabels: Record<string, string> = {
  users: 'Users',
  storage_mb: 'Storage MB',
  ai_calls: 'AI Calls',
  rag_documents: 'RAG Documents',
  tokens: 'Tokens',
}
```

- [ ] **Step 3: Run frontend typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit Task 5**

Run:

```powershell
git add web/src/api/saas.ts web/src/views/saas/platform/plan/index.vue
git commit -m "feat: add SaaS plan management UI"
```

## Task 6: Tenant Plan Quota Display And Platform Order/Subscription Details UI

**Files:**
- Modify: `web/src/api/saas.ts`
- Modify: `web/src/views/saas/tenant/plan/index.vue`
- Modify: `web/src/views/saas/platform/subscription/index.vue`

**Interfaces:**
- Consumes `quotas` on tenant plans
- Consumes `GET /api/saas/platform/orders/:order_no`
- Consumes `GET /api/saas/platform/subscriptions/:id`

- [ ] **Step 1: Add frontend detail API wrappers**

Modify `web/src/api/saas.ts`:

```ts
export interface SaasPlatformOrderListParams extends SaasPlatformListParams {
  order_no?: string
  plan_code?: string
}

export interface SaasPlatformSubscriptionListParams extends SaasPlatformListParams {
  plan_id?: number | string
  plan_code?: string
}

export function fetchPlatformOrder(orderNo: string) {
  return request.get<SaasPlatformOrderRecord | null>({ url: `/api/saas/platform/orders/${orderNo}` })
}

export function fetchPlatformSubscription(id: number | string) {
  return request.get<SaasPlatformSubscriptionRecord | null>({ url: `/api/saas/platform/subscriptions/${id}` })
}
```

Update `fetchPlatformOrders` to accept `SaasPlatformOrderListParams` and `fetchPlatformSubscriptions` to accept `SaasPlatformSubscriptionListParams`.

- [ ] **Step 2: Add tenant plan quota rendering**

Modify `web/src/views/saas/tenant/plan/index.vue`:

- Extend `SaasPlanOption` usage to read `plan.quotas || []`.
- Add a compact quota list inside each plan card.
- Disable order button for `plan.code === 'free'` as well as current plan.

Add helper:

```ts
function formatQuotaItem(item: SaasPlanQuotaRecord) {
  const amount = new Intl.NumberFormat('zh-CN').format(Number(item.total_quota) || 0)
  const labels: Record<string, string> = { users: '鐢ㄦ埛', storage_mb: '瀛樺偍 MB', ai_calls: 'AI 璋冪敤', rag_documents: '鐭ヨ瘑搴撴枃妗?, tokens: 'Token' }
  return `${labels[item.quota_type] || item.quota_type}: ${amount}`
}
```

- [ ] **Step 3: Add platform order/subscription filters and drawers**

Modify `web/src/views/saas/platform/subscription/index.vue`:

- Add filter fields:
  - `order_no`
  - `plan_code`
  - `plan_id`
- Orders tab passes `order_no` and `plan_code`.
- Subscriptions tab passes `plan_id` and `plan_code` when present; backend uses `plan_id` first.
- Add operation column with detail button to both tables.
- Add two `ElDrawer` components using `ElDescriptions`.

State:

```ts
const orderDetailVisible = ref(false)
const subscriptionDetailVisible = ref(false)
const detailLoading = ref(false)
const currentOrderDetail = ref<SaasPlatformOrderRecord | null>(null)
const currentSubscriptionDetail = ref<SaasPlatformSubscriptionRecord | null>(null)
```

Methods:

```ts
async function openOrderDetail(row: SaasPlatformOrderRecord) {
  orderDetailVisible.value = true
  detailLoading.value = true
  try { currentOrderDetail.value = await fetchPlatformOrder(row.order_no) } finally { detailLoading.value = false }
}

async function openSubscriptionDetail(row: SaasPlatformSubscriptionRecord) {
  subscriptionDetailVisible.value = true
  detailLoading.value = true
  try { currentSubscriptionDetail.value = await fetchPlatformSubscription(row.id) } finally { detailLoading.value = false }
}
```

- [ ] **Step 4: Run frontend typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

Run:

```powershell
git add web/src/api/saas.ts web/src/views/saas/tenant/plan/index.vue web/src/views/saas/platform/subscription/index.vue
git commit -m "feat: enhance SaaS plan subscription UI"
```

## Task 7: Final Verification And Local Smoke

**Files:**
- Modify only files required to fix verification defects.

**Interfaces:**
- Confirms backend tests pass.
- Confirms backend typecheck passes.
- Confirms frontend typecheck passes.
- Confirms migrations apply locally.
- Confirms browser workflows work.

- [ ] **Step 1: Run full backend tests**

Run:

```powershell
cd server
pnpm exec jest --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend typecheck**

Run:

```powershell
cd server
pnpm exec tsc --noEmit
```

Expected: exit code 0. Remove `server/tsconfig.tsbuildinfo` if generated.

- [ ] **Step 3: Run frontend typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 4: Apply local migrations**

Run:

```powershell
cd server
pnpm run migration:run
```

Expected: `AlignSaasPlanOperationsMenu1760000000011` executed if not already loaded, or `No migrations are pending` on repeated runs.

- [ ] **Step 5: Clear local menu cache when needed**

Run:

```powershell
redis-cli -h 127.0.0.1 -p 6379 DEL "sys_menu:1:1"
```

Adjust key if the current menu cache key differs.

- [ ] **Step 6: Browser smoke check**

Use current local app:

1. Open `http://localhost:5731/#/saas-platform/plans`.
2. Confirm real plan rows load.
3. Create or edit a non-free plan such as `team`.
4. Configure quotas for `team`.
5. Open `http://localhost:5731/#/tenant-saas/plan`.
6. Confirm enabled paid plans show quota summaries and `free` cannot be ordered.
7. Create a paid upgrade order and use local simulated confirmation.
8. Open `http://localhost:5731/#/saas-platform/subscriptions`.
9. Confirm active subscription changed immediately and detail drawer opens.
10. Filter orders by order number or plan code and open order detail drawer.

- [ ] **Step 7: Commit verification fixes if any**

If verification required fixes:

```powershell
git add server/src/module/saas server/src/migrations server/src/migration-specs web/src/api/saas.ts web/src/views/saas
git commit -m "fix: stabilize SaaS plan subscription operations"
```

If no fixes were required, do not create an empty commit.
