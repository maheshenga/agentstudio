# SaaS Module Market Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SaaS module catalog, plan-module authorization, tenant module entitlement query, and first backend enforcement points.

**Architecture:** Reuse the existing SaaS module, controllers, migrations, and `saas_plan_feature` mapping. Add only one new catalog table, `saas_module`, then derive tenant entitlements from the active subscription plan. Backend checks stay authoritative; frontend visibility is a convenience layer.

**Tech Stack:** NestJS, TypeORM, Jest, Vue 3, Element Plus, Vite, pnpm.

---

## File Structure

- Create `server/src/module/saas/entities/saas-module.entity.ts`: module catalog entity.
- Create `server/src/module/saas/dto/save-saas-module.dto.ts`: create/update/status/module-binding DTOs.
- Create `server/src/module/saas/services/saas-module.service.ts`: catalog, plan binding, tenant entitlement, and access assertion.
- Create `server/src/module/saas/services/saas-module.service.spec.ts`: service unit tests.
- Modify `server/src/module/saas/saas.module.ts`: register entity/service/export.
- Modify `server/src/module/saas/saas-platform.controller.ts`: platform module and plan-module routes.
- Modify `server/src/module/saas/saas-platform.controller.spec.ts`: controller route delegation tests.
- Modify `server/src/module/saas/saas-tenant.controller.ts`: tenant module route and member enforcement.
- Modify `server/src/module/saas/saas-tenant.controller.spec.ts`: tenant route/enforcement delegation tests.
- Modify `server/src/module/saas/services/saas-resource-pack-order.service.ts`: resource pack creation enforcement.
- Modify `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`: resource pack enforcement test.
- Modify `server/src/module/ai/services/chat.service.ts`: AI module enforcement before quota checks.
- Modify `server/src/module/ai/services/chat.service.spec.ts`: AI enforcement test.
- Create `server/src/migrations/1760000000016-CreateSaasModules.ts`: table migration.
- Create `server/src/migrations/1760000000017-SeedSaasModules.ts`: seed modules, menu, permissions.
- Create migration specs for both migrations.
- Modify `web/src/api/saas.ts`: module API types and wrappers.
- Create `web/src/views/saas/platform/module/index.vue`: platform module catalog page.
- Modify `web/src/views/saas/platform/plan/index.vue`: plan module dialog.
- Modify tenant SaaS pages only where a small visibility check fits without router rewrites.

---

### Task 1: Module Table, DTOs, And Seed Migrations

**Files:**
- Create: `server/src/module/saas/entities/saas-module.entity.ts`
- Create: `server/src/module/saas/dto/save-saas-module.dto.ts`
- Create: `server/src/migrations/1760000000016-CreateSaasModules.ts`
- Create: `server/src/migrations/1760000000017-SeedSaasModules.ts`
- Create: `server/src/migration-specs/create-saas-modules.spec.ts`
- Create: `server/src/migration-specs/seed-saas-modules.spec.ts`

- [ ] **Step 1: Write migration specs first**

Create `server/src/migration-specs/create-saas-modules.spec.ts`:

```ts
import { CreateSaasModules1760000000016 } from '../migrations/1760000000016-CreateSaasModules';

describe('CreateSaasModules1760000000016', () => {
  it('creates the SaaS module catalog table', async () => {
    const queryRunner = { query: jest.fn() };

    await new CreateSaasModules1760000000016().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE `saas_module`');
    expect(sql).toContain('UNIQUE KEY `uk_saas_module_code` (`code`)');
  });
});
```

Create `server/src/migration-specs/seed-saas-modules.spec.ts`:

```ts
import { SeedSaasModules1760000000017 } from '../migrations/1760000000017-SeedSaasModules';

describe('SeedSaasModules1760000000017', () => {
  it('seeds default modules, menu, and permissions idempotently', async () => {
    const queryRunner = { query: jest.fn() };

    await new SeedSaasModules1760000000017().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    const params = queryRunner.query.mock.calls.flatMap(([, values]) => values || []);
    expect(params).toContain('ai_chat');
    expect(params).toContain('member_management');
    expect(params).toContain('SaasModule');
    expect(params).toContain('saas:module:list');
    expect(params).toContain('saas:plan:module:update');
    expect(sql).toContain('NOT EXISTS');
  });
});
```

- [ ] **Step 2: Run migration specs and verify they fail**

Run:

```powershell
cd server
pnpm exec jest create-saas-modules.spec.ts seed-saas-modules.spec.ts --runInBand
```

Expected: FAIL because the two migration classes do not exist.

- [ ] **Step 3: Create the entity**

Create `server/src/module/saas/entities/saas-module.entity.ts`:

```ts
import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Index('uk_saas_module_code', ['code'], { unique: true })
@Entity('saas_module', { comment: 'SaaS module catalog' })
export class SaasModuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'code', length: 50 })
  code: string;

  @Column({ type: 'varchar', name: 'name', length: 100 })
  name: string;

  @Column({ type: 'varchar', name: 'description', length: 255, default: '' })
  description: string;

  @Column({ type: 'varchar', name: 'category', length: 50, default: '' })
  category: string;

  @Column({ type: 'varchar', name: 'icon', length: 100, default: '' })
  icon: string;

  @Column({ type: 'varchar', name: 'route_path', length: 255, default: '' })
  routePath: string;

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

- [ ] **Step 4: Create DTOs**

Create `server/src/module/saas/dto/save-saas-module.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';

export class SaveSaasModuleDto {
  @ApiProperty({ required: false })
  @ValidateIf((dto) => dto.code !== undefined)
  @IsString()
  @Matches(/^[a-z][a-z0-9_:-]{1,49}$/)
  code?: string;

  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  route_path?: string;

  @ApiProperty({ required: false, enum: [0, 1] })
  @IsOptional()
  @IsIn([0, 1])
  status?: number;

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

export class UpdateSaasModuleStatusDto {
  @ApiProperty({ required: true, enum: [0, 1] })
  @IsIn([0, 1])
  status: number;
}

export class UpdatePlanModulesDto {
  @ApiProperty({ required: true, type: [String] })
  @IsArray()
  @IsString({ each: true })
  module_codes: string[];
}
```

- [ ] **Step 5: Create table migration**

Create `server/src/migrations/1760000000016-CreateSaasModules.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaasModules1760000000016 implements MigrationInterface {
  name = 'CreateSaasModules1760000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`saas_module\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`code\` varchar(50) NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`description\` varchar(255) NOT NULL DEFAULT '',
        \`category\` varchar(50) NOT NULL DEFAULT '',
        \`icon\` varchar(100) NOT NULL DEFAULT '',
        \`route_path\` varchar(255) NOT NULL DEFAULT '',
        \`status\` tinyint NOT NULL DEFAULT 1,
        \`sort\` int NOT NULL DEFAULT 100,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_saas_module_code\` (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `saas_module`');
  }
}
```

- [ ] **Step 6: Create seed migration**

Create `server/src/migrations/1760000000017-SeedSaasModules.ts` with idempotent inserts for `saas_module`, `sa_system_menu`, and `sa_system_role_menu`. Use this exact default module data:

```ts
const MODULES = [
  ['ai_chat', 'AI Chat', 'AI', 'ri:chat-ai-line', '/dashboard/taixu', 10],
  ['rag', 'Knowledge Base', 'AI', 'ri:database-2-line', '/dashboard/taixu', 20],
  ['member_management', 'Member Management', 'Tenant', 'ri:team-line', '/tenant-saas/members', 30],
  ['resource_pack', 'Resource Pack', 'Billing', 'ri:box-3-line', '/tenant-saas/resource-pack', 40],
  ['advanced_report', 'Advanced Report', 'Report', 'ri:bar-chart-line', '/saas-platform/revenue', 50],
] as const;
```

Use menu code `SaasModule`, path `module`, component `/saas/platform/module`, and permission slugs:

```ts
const PERMISSIONS = [
  ['List', 'saas:module:list', 'GET', 10],
  ['Save', 'saas:module:save', 'POST', 20],
  ['Update', 'saas:module:update', 'PUT', 30],
  ['Status', 'saas:module:status', 'PUT', 40],
  ['Plan module update', 'saas:plan:module:update', 'PUT', 50],
] as const;
```

- [ ] **Step 7: Run migration specs**

Run:

```powershell
cd server
pnpm exec jest create-saas-modules.spec.ts seed-saas-modules.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add server/src/module/saas/entities/saas-module.entity.ts `
  server/src/module/saas/dto/save-saas-module.dto.ts `
  server/src/migrations/1760000000016-CreateSaasModules.ts `
  server/src/migrations/1760000000017-SeedSaasModules.ts `
  server/src/migration-specs/create-saas-modules.spec.ts `
  server/src/migration-specs/seed-saas-modules.spec.ts
git commit -m "feat: add SaaS module catalog schema"
```

---

### Task 2: Backend Module Service And Platform Routes

**Files:**
- Create: `server/src/module/saas/services/saas-module.service.ts`
- Create: `server/src/module/saas/services/saas-module.service.spec.ts`
- Modify: `server/src/module/saas/saas.module.ts`
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`

- [ ] **Step 1: Write service tests**

Create `server/src/module/saas/services/saas-module.service.spec.ts`:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasModuleEntity } from '../entities/saas-module.entity';
import { SaasPlanFeatureEntity } from '../entities/saas-plan-feature.entity';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasModuleService } from './saas-module.service';

describe('SaasModuleService', () => {
  const moduleRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 1, ...value })),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const planRepo = { findOne: jest.fn() };
  const planFeatureRepo = {
    delete: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    find: jest.fn(),
  };
  const subscriptionRepo = { findOne: jest.fn() };
  let service: SaasModuleService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasModuleService,
        { provide: getRepositoryToken(SaasModuleEntity), useValue: moduleRepo },
        { provide: getRepositoryToken(SaasPlanEntity), useValue: planRepo },
        { provide: getRepositoryToken(SaasPlanFeatureEntity), useValue: planFeatureRepo },
        { provide: getRepositoryToken(SaasSubscriptionEntity), useValue: subscriptionRepo },
      ],
    }).compile();
    service = module.get(SaasModuleService);
  });

  it('creates a module when code is unique', async () => {
    moduleRepo.findOne.mockResolvedValue(null);
    await expect(service.createPlatformModule({ code: 'ai_chat', name: 'AI Chat' })).resolves.toMatchObject({
      code: 'ai_chat',
      name: 'AI Chat',
      status: 1,
    });
  });

  it('rejects duplicate module code', async () => {
    moduleRepo.findOne.mockResolvedValue({ id: 1, code: 'ai_chat' });
    await expect(service.createPlatformModule({ code: 'ai_chat', name: 'AI Chat' })).rejects.toThrow(BadRequestException);
  });

  it('updates module status', async () => {
    moduleRepo.findOne.mockResolvedValue({ id: 1, code: 'ai_chat', status: 1 });
    moduleRepo.update.mockResolvedValue({ affected: 1 });
    await expect(service.updatePlatformModuleStatus('ai_chat', 0)).resolves.toMatchObject({ code: 'ai_chat', status: 0 });
  });

  it('updates plan module mappings', async () => {
    planRepo.findOne.mockResolvedValue({ id: 9, code: 'pro' });
    moduleRepo.find.mockResolvedValue([{ code: 'ai_chat' }, { code: 'resource_pack' }]);
    await service.updatePlanModules('pro', ['ai_chat', 'resource_pack']);
    expect(planFeatureRepo.delete).toHaveBeenCalledWith({ planId: 9 });
    expect(planFeatureRepo.save).toHaveBeenCalledWith([
      { planId: 9, featureKey: 'ai_chat', enabled: 1 },
      { planId: 9, featureKey: 'resource_pack', enabled: 1 },
    ]);
  });

  it('returns tenant enabled modules from active subscription plan', async () => {
    subscriptionRepo.findOne.mockResolvedValue({ planId: 9 });
    planFeatureRepo.find.mockResolvedValue([{ featureKey: 'ai_chat', enabled: 1 }]);
    moduleRepo.find.mockResolvedValue([{ code: 'ai_chat', status: 1, name: 'AI Chat' }]);
    await expect(service.listTenantModules(12)).resolves.toEqual([{ code: 'ai_chat', status: 1, name: 'AI Chat' }]);
  });

  it('rejects disabled tenant modules', async () => {
    jest.spyOn(service, 'listTenantModules').mockResolvedValue([{ code: 'resource_pack' } as any]);
    await expect(service.assertTenantModuleEnabled(12, 'member_management')).rejects.toThrow(BadRequestException);
  });

  it('rejects unknown plan during module binding', async () => {
    planRepo.findOne.mockResolvedValue(null);
    await expect(service.updatePlanModules('missing', ['ai_chat'])).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run service tests and verify they fail**

Run:

```powershell
cd server
pnpm exec jest saas-module.service.spec.ts --runInBand
```

Expected: FAIL because `SaasModuleService` does not exist.

- [ ] **Step 3: Implement service**

Create `server/src/module/saas/services/saas-module.service.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Like, Repository } from 'typeorm';

import { SaveSaasModuleDto } from '../dto/save-saas-module.dto';
import { SaasModuleEntity } from '../entities/saas-module.entity';
import { SaasPlanFeatureEntity } from '../entities/saas-plan-feature.entity';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';

export interface SaasModuleListQuery {
  keyword?: string;
  status?: string | number;
}

@Injectable()
export class SaasModuleService {
  constructor(
    @InjectRepository(SaasModuleEntity) private readonly moduleRepo: Repository<SaasModuleEntity>,
    @InjectRepository(SaasPlanEntity) private readonly planRepo: Repository<SaasPlanEntity>,
    @InjectRepository(SaasPlanFeatureEntity) private readonly planFeatureRepo: Repository<SaasPlanFeatureEntity>,
    @InjectRepository(SaasSubscriptionEntity) private readonly subscriptionRepo: Repository<SaasSubscriptionEntity>,
  ) {}

  async listPlatformModules(query: SaasModuleListQuery = {}) {
    const where: any = { deleteTime: IsNull() };
    if (query.status !== undefined && query.status !== '') where.status = Number(query.status);
    if (query.keyword) where.name = Like(`%${query.keyword}%`);
    return this.moduleRepo.find({ where, order: { sort: 'ASC', id: 'ASC' } });
  }

  async createPlatformModule(dto: SaveSaasModuleDto) {
    if (!dto.code) throw new BadRequestException('Module code is required');
    const existing = await this.moduleRepo.findOne({ where: { code: dto.code, deleteTime: IsNull() } });
    if (existing) throw new BadRequestException('Module code already exists');
    return this.moduleRepo.save(this.moduleRepo.create(this.toEntityPayload(dto, dto.code)));
  }

  async updatePlatformModule(code: string, dto: SaveSaasModuleDto) {
    const module = await this.findModuleOrThrow(code);
    Object.assign(module, this.toEntityPayload(dto, code));
    return this.moduleRepo.save(module);
  }

  async updatePlatformModuleStatus(code: string, status: number) {
    const module = await this.findModuleOrThrow(code);
    module.status = status;
    await this.moduleRepo.update({ code }, { status });
    return module;
  }

  async updatePlanModules(planCode: string, moduleCodes: string[]) {
    const plan = await this.planRepo.findOne({ where: { code: planCode, deleteTime: IsNull() } });
    if (!plan) throw new NotFoundException('SaaS plan not found');
    const uniqueCodes = Array.from(new Set(moduleCodes.filter(Boolean)));
    const modules = uniqueCodes.length
      ? await this.moduleRepo.find({ where: { code: In(uniqueCodes), status: 1, deleteTime: IsNull() } })
      : [];
    if (modules.length !== uniqueCodes.length) throw new BadRequestException('Enabled module not found');
    await this.planFeatureRepo.delete({ planId: plan.id });
    const rows = modules.map((module) => this.planFeatureRepo.create({ planId: plan.id, featureKey: module.code, enabled: 1 }));
    if (rows.length) await this.planFeatureRepo.save(rows);
    return { code: plan.code, module_codes: modules.map((module) => module.code) };
  }

  async listTenantModules(tenantId: number) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { tenantId, status: 'active', deleteTime: IsNull() },
      order: { id: 'DESC' },
    });
    if (!subscription) return [];
    const features = await this.planFeatureRepo.find({ where: { planId: subscription.planId, enabled: 1, deleteTime: IsNull() } });
    const codes = features.map((feature) => feature.featureKey);
    if (!codes.length) return [];
    return this.moduleRepo.find({ where: { code: In(codes), status: 1, deleteTime: IsNull() }, order: { sort: 'ASC', id: 'ASC' } });
  }

  async assertTenantModuleEnabled(tenantId: number, moduleCode: string) {
    const modules = await this.listTenantModules(tenantId);
    if (!modules.some((module) => module.code === moduleCode)) {
      throw new BadRequestException('Current plan has not enabled this module');
    }
  }

  private async findModuleOrThrow(code: string) {
    const module = await this.moduleRepo.findOne({ where: { code, deleteTime: IsNull() } });
    if (!module) throw new NotFoundException('SaaS module not found');
    return module;
  }

  private toEntityPayload(dto: SaveSaasModuleDto, code: string) {
    return {
      code,
      name: dto.name,
      description: dto.description || '',
      category: dto.category || '',
      icon: dto.icon || '',
      routePath: dto.route_path || '',
      status: dto.status ?? 1,
      sort: dto.sort ?? 100,
      remark: dto.remark || '',
    };
  }
}
```

- [ ] **Step 4: Register entity and service**

Modify `server/src/module/saas/saas.module.ts`:

```ts
import { SaasModuleEntity } from './entities/saas-module.entity';
import { SaasModuleService } from './services/saas-module.service';
```

Add `SaasModuleEntity` to `TypeOrmModule.forFeature([...])`.

Add `SaasModuleService` to `providers` and `exports`.

- [ ] **Step 5: Add platform controller routes**

Modify `server/src/module/saas/saas-platform.controller.ts`:

```ts
import { SaveSaasModuleDto, UpdatePlanModulesDto, UpdateSaasModuleStatusDto } from './dto/save-saas-module.dto';
import { SaasModuleListQuery, SaasModuleService } from './services/saas-module.service';
```

Inject `private readonly moduleService: SaasModuleService`.

Add routes:

```ts
  @Get('modules')
  @ApiOperation({ summary: 'List SaaS modules' })
  @RequirePermission('saas:module:list')
  modules(@Query() query: SaasModuleListQuery, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.moduleService.listPlatformModules(query).then((data) => ResultData.ok(data)));
  }

  @Post('modules')
  @ApiOperation({ summary: 'Create SaaS module' })
  @RequirePermission('saas:module:save')
  createModule(@Body() body: SaveSaasModuleDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.moduleService.createPlatformModule(body).then((data) => ResultData.ok(data)));
  }

  @Put('modules/:code')
  @ApiOperation({ summary: 'Update SaaS module' })
  @RequirePermission('saas:module:update')
  updateModule(@Param('code') code: string, @Body() body: SaveSaasModuleDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.moduleService.updatePlatformModule(code, body).then((data) => ResultData.ok(data)));
  }

  @Put('modules/:code/status')
  @ApiOperation({ summary: 'Update SaaS module status' })
  @RequirePermission('saas:module:status')
  updateModuleStatus(@Param('code') code: string, @Body() body: UpdateSaasModuleStatusDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.moduleService.updatePlatformModuleStatus(code, body.status).then((data) => ResultData.ok(data)));
  }

  @Put('plans/:code/modules')
  @ApiOperation({ summary: 'Update SaaS plan modules' })
  @RequirePermission('saas:plan:module:update')
  updatePlanModules(@Param('code') code: string, @Body() body: UpdatePlanModulesDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.moduleService.updatePlanModules(code, body.module_codes).then((data) => ResultData.ok(data)));
  }
```

- [ ] **Step 6: Add controller tests**

In `server/src/module/saas/saas-platform.controller.spec.ts`, add a `moduleService` mock:

```ts
const moduleService = {
  listPlatformModules: jest.fn(),
  createPlatformModule: jest.fn(),
  updatePlatformModule: jest.fn(),
  updatePlatformModuleStatus: jest.fn(),
  updatePlanModules: jest.fn(),
};
```

Provide it in the test module. Add tests:

```ts
it('lists SaaS modules outside tenant scope', async () => {
  moduleService.listPlatformModules.mockResolvedValue([{ code: 'ai_chat' }]);
  const result = await controller.modules({}, { userId: 1 } as any);
  expect(result.data).toEqual([{ code: 'ai_chat' }]);
});

it('updates plan modules outside tenant scope', async () => {
  moduleService.updatePlanModules.mockResolvedValue({ code: 'pro', module_codes: ['ai_chat'] });
  const result = await controller.updatePlanModules('pro', { module_codes: ['ai_chat'] }, { userId: 1 } as any);
  expect(moduleService.updatePlanModules).toHaveBeenCalledWith('pro', ['ai_chat']);
  expect(result.data).toEqual({ code: 'pro', module_codes: ['ai_chat'] });
});
```

- [ ] **Step 7: Run focused tests and typecheck**

Run:

```powershell
cd server
pnpm exec jest saas-module.service.spec.ts saas-platform.controller.spec.ts create-saas-modules.spec.ts seed-saas-modules.spec.ts --runInBand
pnpm exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add server/src/module/saas/services/saas-module.service.ts `
  server/src/module/saas/services/saas-module.service.spec.ts `
  server/src/module/saas/saas.module.ts `
  server/src/module/saas/saas-platform.controller.ts `
  server/src/module/saas/saas-platform.controller.spec.ts
git commit -m "feat: add SaaS module catalog APIs"
```

---

### Task 3: Tenant Module Query And Enforcement Hooks

**Files:**
- Modify: `server/src/module/saas/saas-tenant.controller.ts`
- Modify: `server/src/module/saas/saas-tenant.controller.spec.ts`
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.ts`
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
- Modify: `server/src/module/ai/services/chat.service.ts`
- Modify: `server/src/module/ai/services/chat.service.spec.ts`

- [ ] **Step 1: Add tenant controller tests**

In `server/src/module/saas/saas-tenant.controller.spec.ts`, add a `moduleService` mock:

```ts
const moduleService = {
  listTenantModules: jest.fn(),
  assertTenantModuleEnabled: jest.fn(),
};
```

Provide it in the testing module and inject it into controller construction.

Add tests:

```ts
it('returns tenant modules for current tenant', async () => {
  moduleService.listTenantModules.mockResolvedValue([{ code: 'ai_chat' }]);
  jest.spyOn(tenantUtil, 'getTenantId').mockReturnValue(12);
  const result = await controller.modules();
  expect(moduleService.listTenantModules).toHaveBeenCalledWith(12);
  expect(result.data).toEqual([{ code: 'ai_chat' }]);
});

it('checks member module before listing tenant members', async () => {
  tenantMemberService.listMembers.mockResolvedValue({ list: [], total: 0, page: 1, limit: 20 });
  jest.spyOn(tenantUtil, 'getTenantId').mockReturnValue(12);
  await controller.members({});
  expect(moduleService.assertTenantModuleEnabled).toHaveBeenCalledWith(12, 'member_management');
});
```

- [ ] **Step 2: Run tenant tests and verify they fail**

Run:

```powershell
cd server
pnpm exec jest saas-tenant.controller.spec.ts --runInBand
```

Expected: FAIL because the controller has no `modules()` route and no module assertion.

- [ ] **Step 3: Add tenant route and member enforcement**

Modify `server/src/module/saas/saas-tenant.controller.ts`:

```ts
import { SaasModuleService } from './services/saas-module.service';
```

Inject `private readonly moduleService: SaasModuleService`.

Add route:

```ts
  @Get('modules')
  @ApiOperation({ summary: 'List current tenant enabled SaaS modules' })
  async modules() {
    const tenantId = getTenantId();
    if (!tenantId) {
      return ResultData.fail(401, 'Tenant context is required');
    }

    return ResultData.ok(await this.moduleService.listTenantModules(tenantId));
  }
```

Add checks in `members()` and `createMember()` before tenant member service calls:

```ts
await this.moduleService.assertTenantModuleEnabled(tenantId, 'member_management');
```

- [ ] **Step 4: Add resource-pack enforcement test**

In `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`, add a `saasModuleService` mock:

```ts
const saasModuleService = { assertTenantModuleEnabled: jest.fn() };
```

Provide it if constructor injection is added. Add test:

```ts
it('checks resource pack module before creating tenant orders', async () => {
  packRepo.findOne.mockResolvedValue({
    code: 'tokens_1m',
    name: 'Token Pack',
    resourceType: 'tokens',
    quotaAmount: 1000000,
    priceCents: 9900,
    currency: 'CNY',
  });

  await service.createTenantOrder(12, { resource_pack_code: 'tokens_1m', payment_method: 'alipay' });

  expect(saasModuleService.assertTenantModuleEnabled).toHaveBeenCalledWith(12, 'resource_pack');
});
```

- [ ] **Step 5: Implement resource-pack enforcement**

Modify `server/src/module/saas/services/saas-resource-pack-order.service.ts` constructor to inject `SaasModuleService`.

At the start of `createTenantOrder()` add:

```ts
await this.saasModuleService.assertTenantModuleEnabled(tenantId, 'resource_pack');
```

- [ ] **Step 6: Add AI enforcement test**

In `server/src/module/ai/services/chat.service.spec.ts`, extend the existing SaaS quota mock with:

```ts
const saasModuleService = {
  assertTenantModuleEnabled: jest.fn(),
};
```

Provide `SaasModuleService`. Add test:

```ts
it('checks AI module before quota checks and provider streaming', async () => {
  saasModuleService.assertTenantModuleEnabled.mockRejectedValueOnce(new BadRequestException('Current plan has not enabled this module'));

  await expect(service.handleChatSend(validTenantChatInput)).rejects.toThrow('Current plan has not enabled this module');

  expect(saasModuleService.assertTenantModuleEnabled).toHaveBeenCalledWith(42, 'ai_chat');
  expect(saasQuotaService.assertTenantQuotaAvailable).not.toHaveBeenCalled();
});
```

Use the existing valid tenant chat input helper from that spec. If no helper exists, copy the smallest valid input already used by the quota tests in the same file.

- [ ] **Step 7: Implement AI enforcement**

Modify `server/src/module/ai/services/chat.service.ts`:

```ts
import { SaasModuleService } from '../../saas/services/saas-module.service';
```

Inject `private readonly saasModuleService: SaasModuleService`.

Before the existing `SaasQuotaService.assertTenantQuotaAvailable()` calls, add:

```ts
await this.saasModuleService.assertTenantModuleEnabled(owned.tenantId, 'ai_chat');
```

- [ ] **Step 8: Run focused tests**

Run:

```powershell
cd server
pnpm exec jest saas-tenant.controller.spec.ts saas-resource-pack-order.service.spec.ts chat.service.spec.ts saas-module.service.spec.ts --runInBand
pnpm exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add server/src/module/saas/saas-tenant.controller.ts `
  server/src/module/saas/saas-tenant.controller.spec.ts `
  server/src/module/saas/services/saas-resource-pack-order.service.ts `
  server/src/module/saas/services/saas-resource-pack-order.service.spec.ts `
  server/src/module/ai/services/chat.service.ts `
  server/src/module/ai/services/chat.service.spec.ts
git commit -m "feat: enforce SaaS module access"
```

---

### Task 4: Frontend API And Platform Module Page

**Files:**
- Modify: `web/src/api/saas.ts`
- Create: `web/src/views/saas/platform/module/index.vue`

- [ ] **Step 1: Add API types and wrappers**

Modify `web/src/api/saas.ts`:

```ts
export interface SaasModuleRecord {
  id?: number
  code: string
  name: string
  description?: string
  category?: string
  icon?: string
  route_path?: string
  routePath?: string
  status: number
  sort?: number
  remark?: string
  create_time?: string | Date
}

export interface SaasModuleListParams {
  keyword?: string
  status?: number | string
}

export interface SaveSaasModuleParams {
  code?: string
  name: string
  description?: string
  category?: string
  icon?: string
  route_path?: string
  status?: number
  sort?: number
  remark?: string
}

export function fetchPlatformModules(params: SaasModuleListParams) {
  return request.get<SaasModuleRecord[]>({ url: '/api/saas/platform/modules', params })
}

export function createPlatformModule(params: SaveSaasModuleParams) {
  return request.post<SaasModuleRecord>({ url: '/api/saas/platform/modules', data: params })
}

export function updatePlatformModule(code: string, params: SaveSaasModuleParams) {
  return request.put<SaasModuleRecord>({ url: `/api/saas/platform/modules/${code}`, data: params })
}

export function updatePlatformModuleStatus(code: string, status: number) {
  return request.put<SaasModuleRecord>({ url: `/api/saas/platform/modules/${code}/status`, data: { status } })
}

export function updatePlatformPlanModules(code: string, moduleCodes: string[]) {
  return request.put<{ code: string; module_codes: string[] }>({
    url: `/api/saas/platform/plans/${code}/modules`,
    data: { module_codes: moduleCodes }
  })
}

export function fetchTenantModules() {
  return request.get<SaasModuleRecord[]>({ url: '/api/saas/tenant/modules' })
}
```

- [ ] **Step 2: Create platform module page**

Create `web/src/views/saas/platform/module/index.vue` with:

```vue
<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-module-page">
      <template #header>
        <div class="saas-module-page__header">
          <div>
            <h1 class="saas-module-page__title">SaaS 模块管理</h1>
            <p class="saas-module-page__subtitle">维护套餐可授权的产品模块。</p>
          </div>
          <ElButton type="primary" @click="openCreateDialog">新增模块</ElButton>
        </div>
      </template>

      <div class="saas-module-page__filters">
        <ElInput v-model="filters.keyword" clearable aria-label="模块编码或名称" @keyup.enter="loadModules" />
        <ElSelect v-model="filters.status" clearable aria-label="状态" @change="loadModules">
          <ElOption label="启用" :value="1" />
          <ElOption label="停用" :value="0" />
        </ElSelect>
        <ElButton :loading="loading" @click="loadModules">刷新</ElButton>
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn prop="code" label="编码" min-width="150" />
        <ElTableColumn prop="name" label="名称" min-width="160" />
        <ElTableColumn prop="category" label="分类" width="120" />
        <ElTableColumn prop="route_path" label="路由" min-width="220" show-overflow-tooltip />
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'info'" effect="plain">
              {{ row.status === 1 ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="sort" label="排序" width="90" />
        <ElTableColumn label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openEditDialog(row)">编辑</ElButton>
            <ElButton link :type="row.status === 1 ? 'warning' : 'success'" @click="toggleStatus(row)">
              {{ row.status === 1 ? '停用' : '启用' }}
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElDialog v-model="dialogVisible" :title="editingCode ? '编辑模块' : '新增模块'" width="560px">
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="88px">
        <ElFormItem label="编码" prop="code">
          <ElInput v-model="form.code" :disabled="Boolean(editingCode)" maxlength="50" />
        </ElFormItem>
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="form.name" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="分类" prop="category">
          <ElInput v-model="form.category" maxlength="50" />
        </ElFormItem>
        <ElFormItem label="图标" prop="icon">
          <ElInput v-model="form.icon" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="路由" prop="route_path">
          <ElInput v-model="form.route_path" maxlength="255" />
        </ElFormItem>
        <ElFormItem label="状态" prop="status">
          <ElSwitch v-model="form.status" :active-value="1" :inactive-value="0" />
        </ElFormItem>
        <ElFormItem label="排序" prop="sort">
          <ElInputNumber v-model="form.sort" :min="0" />
        </ElFormItem>
        <ElFormItem label="描述" prop="description">
          <ElInput v-model="form.description" type="textarea" maxlength="255" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="submitModule">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import {
    createPlatformModule,
    fetchPlatformModules,
    updatePlatformModule,
    updatePlatformModuleStatus,
    type SaasModuleRecord,
    type SaveSaasModuleParams
  } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformModulePage' })

  const loading = ref(false)
  const saving = ref(false)
  const dialogVisible = ref(false)
  const editingCode = ref('')
  const records = ref<SaasModuleRecord[]>([])
  const formRef = ref<FormInstance>()
  const filters = reactive({ keyword: '', status: undefined as number | undefined })
  const form = reactive<SaveSaasModuleParams>({
    code: '',
    name: '',
    description: '',
    category: '',
    icon: '',
    route_path: '',
    status: 1,
    sort: 100
  })
  const rules: FormRules = {
    code: [{ required: true, message: '请输入模块编码', trigger: 'blur' }],
    name: [{ required: true, message: '请输入模块名称', trigger: 'blur' }]
  }

  async function loadModules() {
    loading.value = true
    try {
      records.value = await fetchPlatformModules(filters)
    } finally {
      loading.value = false
    }
  }

  function resetForm() {
    Object.assign(form, { code: '', name: '', description: '', category: '', icon: '', route_path: '', status: 1, sort: 100 })
    formRef.value?.clearValidate()
  }

  function openCreateDialog() {
    editingCode.value = ''
    resetForm()
    dialogVisible.value = true
  }

  function openEditDialog(row: SaasModuleRecord) {
    editingCode.value = row.code
    Object.assign(form, {
      code: row.code,
      name: row.name,
      description: row.description || '',
      category: row.category || '',
      icon: row.icon || '',
      route_path: row.route_path || row.routePath || '',
      status: row.status,
      sort: row.sort || 100
    })
    dialogVisible.value = true
  }

  async function submitModule() {
    await formRef.value?.validate()
    saving.value = true
    try {
      if (editingCode.value) await updatePlatformModule(editingCode.value, form)
      else await createPlatformModule(form)
      ElMessage.success('模块已保存')
      dialogVisible.value = false
      await loadModules()
    } finally {
      saving.value = false
    }
  }

  async function toggleStatus(row: SaasModuleRecord) {
    await updatePlatformModuleStatus(row.code, row.status === 1 ? 0 : 1)
    await loadModules()
  }

  onMounted(loadModules)
</script>

<style scoped>
  .saas-module-page__header,
  .saas-module-page__filters {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .saas-module-page__filters {
    justify-content: flex-start;
    margin-bottom: 16px;
  }

  .saas-module-page__title {
    margin: 0;
    font-size: 18px;
  }

  .saas-module-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
</style>
```

- [ ] **Step 3: Run frontend typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add web/src/api/saas.ts web/src/views/saas/platform/module/index.vue
git commit -m "feat: add SaaS module catalog page"
```

---

### Task 5: Plan Module Dialog

**Files:**
- Modify: `web/src/views/saas/platform/plan/index.vue`

- [ ] **Step 1: Add module dialog state and imports**

In `web/src/views/saas/platform/plan/index.vue`, import:

```ts
import {
  fetchPlatformModules,
  updatePlatformPlanModules,
  type SaasModuleRecord
} from '@/api/saas'
```

Add state:

```ts
const moduleDialogVisible = ref(false)
const moduleSaving = ref(false)
const moduleRows = ref<SaasModuleRecord[]>([])
const selectedModuleCodes = ref<string[]>([])
const modulePlanCode = ref('')
```

- [ ] **Step 2: Add action button**

In the plan table action column, add:

```vue
<ElButton link type="primary" @click="openModuleDialog(row)">模块</ElButton>
```

- [ ] **Step 3: Add dialog template**

Add near the quota dialog:

```vue
<ElDialog v-model="moduleDialogVisible" title="套餐模块" width="620px">
  <ElCheckboxGroup v-model="selectedModuleCodes" class="saas-plan-page__module-list">
    <ElCheckbox v-for="module in moduleRows" :key="module.code" :label="module.code">
      {{ module.name }} / {{ module.code }}
    </ElCheckbox>
  </ElCheckboxGroup>
  <template #footer>
    <ElButton @click="moduleDialogVisible = false">取消</ElButton>
    <ElButton type="primary" :loading="moduleSaving" @click="savePlanModules">保存</ElButton>
  </template>
</ElDialog>
```

- [ ] **Step 4: Add methods**

```ts
async function openModuleDialog(row: SaasPlatformPlanRecord) {
  modulePlanCode.value = row.code
  moduleRows.value = await fetchPlatformModules({ status: 1 })
  selectedModuleCodes.value = (row.features || row.modules || []).map((item: any) => item.feature_key || item.code).filter(Boolean)
  moduleDialogVisible.value = true
}

async function savePlanModules() {
  moduleSaving.value = true
  try {
    await updatePlatformPlanModules(modulePlanCode.value, selectedModuleCodes.value)
    ElMessage.success('套餐模块已保存')
    moduleDialogVisible.value = false
    await loadPlans()
  } finally {
    moduleSaving.value = false
  }
}
```

If `SaasPlatformPlanRecord` has no `features` field, add:

```ts
features?: Array<{ feature_key?: string; code?: string }>
modules?: SaasModuleRecord[]
```

to the type in `web/src/api/saas.ts`.

- [ ] **Step 5: Run typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add web/src/api/saas.ts web/src/views/saas/platform/plan/index.vue
git commit -m "feat: configure SaaS plan modules"
```

---

### Task 6: Tenant Visibility And End-To-End Verification

**Files:**
- Modify: `web/src/views/saas/tenant/member/index.vue`
- Modify: `web/src/views/saas/tenant/resource-pack/index.vue`

- [ ] **Step 1: Add a tiny tenant module helper in each page**

In both tenant pages, import:

```ts
import { fetchTenantModules } from '@/api/saas'
```

Add:

```ts
const moduleEnabled = ref(true)

async function loadModuleAccess(moduleCode: string) {
  const modules = await fetchTenantModules()
  moduleEnabled.value = modules.some((module) => module.code === moduleCode)
}
```

- [ ] **Step 2: Use the helper on member page**

In `web/src/views/saas/tenant/member/index.vue`, change mounted logic:

```ts
onMounted(async () => {
  await loadModuleAccess('member_management')
  if (moduleEnabled.value) await loadMembers()
})
```

Wrap the main table card body with:

```vue
<ElEmpty v-if="!moduleEnabled" description="当前套餐未开通成员管理" />
<template v-else>
  existing table and pager content
</template>
```

- [ ] **Step 3: Use the helper on resource-pack page**

In `web/src/views/saas/tenant/resource-pack/index.vue`, change mounted logic:

```ts
onMounted(async () => {
  await loadModuleAccess('resource_pack')
  if (moduleEnabled.value) await loadPageData()
})
```

Show:

```vue
<ElEmpty v-if="!moduleEnabled" description="当前套餐未开通资源包" />
```

above existing resource-pack content, and render existing content only when `moduleEnabled`.

- [ ] **Step 4: Run full verification**

Run:

```powershell
cd server
pnpm exec jest saas-module.service.spec.ts saas-platform.controller.spec.ts saas-tenant.controller.spec.ts saas-resource-pack-order.service.spec.ts chat.service.spec.ts create-saas-modules.spec.ts seed-saas-modules.spec.ts --runInBand
pnpm exec tsc --noEmit
pnpm run build

cd ..\web
pnpm exec vue-tsc --noEmit
pnpm run build

cd ..
git diff --check
```

Expected:

- Jest focused suites pass.
- Backend typecheck passes.
- Backend build exits 0.
- Frontend typecheck passes.
- Frontend build exits 0. Existing CSS warnings are acceptable if exit code is 0.
- `git diff --check` exits 0. Existing line-ending warnings are acceptable.

- [ ] **Step 5: Run migrations locally**

Run:

```powershell
cd server
pnpm run migration:run
```

Expected: migrations `1760000000016` and `1760000000017` execute once.

Clear local menu cache:

```powershell
redis-cli -h 127.0.0.1 -p 6379 KEYS "sys_menu:*"
redis-cli -h 127.0.0.1 -p 6379 DEL "sys_menu:1:1"
```

- [ ] **Step 6: Browser smoke**

Open:

```text
http://localhost:5730/#/saas-platform/module
```

Verify:

- Page title shows `SaaS 模块管理`.
- Default modules appear after migration.
- Create/edit dialog opens.

Open:

```text
http://localhost:5730/#/saas-platform/plan
```

Verify:

- Plan row has `模块` action.
- Module dialog opens.
- Saving selected modules reloads plan list.

Open:

```text
http://localhost:5730/#/tenant-saas/members
http://localhost:5730/#/tenant-saas/resource-pack
```

Verify:

- Pages still load for a plan with matching modules.
- If a module is removed from the active plan, backend rejects access with `Current plan has not enabled this module`.

- [ ] **Step 7: Commit**

```powershell
git add web/src/views/saas/tenant/member/index.vue `
  web/src/views/saas/tenant/resource-pack/index.vue
git commit -m "feat: show tenant SaaS modules by plan"
```

---

## Final Review Checklist

- [ ] `server/pnpm-lock.yaml` remains unstaged unless dependency install truly changed it.
- [ ] No new dependency was added.
- [ ] Module catalog uses `saas_module`; plan binding reuses `saas_plan_feature`.
- [ ] Tenant access derives from active subscription plan.
- [ ] Backend blocks module access even if frontend entry is visible.
- [ ] No separate module purchase flow exists.
- [ ] Final `git status --short --untracked-files=all` is clean except known local noise.
