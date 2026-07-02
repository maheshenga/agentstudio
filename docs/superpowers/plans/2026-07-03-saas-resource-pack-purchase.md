# SaaS Resource Pack Purchase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete tenant purchase flow for SaaS resource packs, including order creation, Alipay payment initiation, payment confirmation, and quota delivery.

**Architecture:** Add a dedicated `saas_resource_pack_order` table and service instead of overloading plan orders. Payment remains centralized in `SaasPaymentService`, with order type routing for plan versus resource-pack orders. Resource-pack fulfillment directly increments `saas_tenant_resource.total_quota` and is guarded by `delivered_at` for idempotency.

**Tech Stack:** NestJS 11, TypeORM, MySQL migrations, Jest, Vue 3, Element Plus, existing SaaS module and dynamic menu system.

## Global Constraints

- Use a dedicated `saas_resource_pack_order` table.
- Resource-pack order numbers must start with `RPO`.
- Keep existing plan order behavior and `SO` order numbers backward compatible.
- Payment request bodies accept optional `order_type`; default is `plan`.
- Resource-pack payment requests use `order_type = "resource_pack"`.
- Alipay notify routes `RPO` order numbers to resource-pack order confirmation.
- Payment confirmation must be idempotent; repeated confirmation must not add quota twice.
- Deliver quota by increasing `saas_tenant_resource.total_quota`.
- Do not implement refunds, invoices, expiry, purchased balance ledger, or consumption priority.
- Use TDD for backend service/controller/payment behavior.
- Preserve unrelated dirty worktree changes.

---

## File Structure

- Create `server/src/module/saas/entities/saas-resource-pack-order.entity.ts`: resource-pack order entity.
- Create `server/src/module/saas/dto/create-resource-pack-order.dto.ts`: tenant create-order DTO.
- Create `server/src/migrations/1760000000006-CreateSaasResourcePackOrders.ts`: table migration.
- Create `server/src/migration-specs/create-saas-resource-pack-orders.spec.ts`: migration assertions.
- Create `server/src/module/saas/services/saas-resource-pack-order.service.ts`: create, find, list, confirm, deliver resource-pack orders.
- Create `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`: service TDD coverage.
- Modify `server/src/module/saas/saas.module.ts`: register entity/service.
- Modify `server/src/module/saas/saas-tenant.controller.ts`: tenant create/read resource-pack order endpoints.
- Modify `server/src/module/saas/saas-tenant.controller.spec.ts`: controller tests.
- Modify `server/src/module/saas/services/saas-platform.service.ts`: platform order list delegation.
- Modify `server/src/module/saas/services/saas-platform.service.spec.ts`: list tests.
- Modify `server/src/module/saas/saas-platform.controller.ts`: platform order list endpoint.
- Modify `server/src/module/saas/saas-platform.controller.spec.ts`: endpoint tests.
- Modify `server/src/module/saas/services/saas-payment.service.ts`: order type aware Alipay creation and subject.
- Modify `server/src/module/saas/services/saas-payment.service.spec.ts`: payment tests.
- Modify `server/src/module/saas/saas-payment.controller.ts`: order type aware dev confirm and notify routing.
- Modify `server/src/module/saas/saas-payment.controller.spec.ts`: controller tests.
- Modify `server/src/migrations/1760000000001-SeedSaasFoundationData.ts`: seed permissions/menu.
- Modify `server/src/migration-specs/seed-saas-foundation-data.spec.ts`: seed assertions.
- Modify `web/src/api/saas.ts`: resource-pack order wrappers and order-type aware payment helpers.
- Modify `web/src/views/saas/tenant/resource-pack/index.vue`: purchase/payment UI.
- Create `web/src/views/saas/platform/resource-pack-order/index.vue`: platform order table.

## Task 1: Backend Resource Pack Order Entity, Migration, And Service

**Files:**
- Create: `server/src/module/saas/entities/saas-resource-pack-order.entity.ts`
- Create: `server/src/module/saas/dto/create-resource-pack-order.dto.ts`
- Create: `server/src/migrations/1760000000006-CreateSaasResourcePackOrders.ts`
- Create: `server/src/migration-specs/create-saas-resource-pack-orders.spec.ts`
- Create: `server/src/module/saas/services/saas-resource-pack-order.service.ts`
- Create: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
- Modify: `server/src/module/saas/saas.module.ts`

**Interfaces:**
- Produces: `SaasResourcePackOrderEntity`
- Produces: `CreateResourcePackOrderDto`
- Produces: `SaasResourcePackOrderService.createTenantOrder(tenantId, dto)`
- Produces: `SaasResourcePackOrderService.findTenantOrder(tenantId, orderNo)`
- Produces: `SaasResourcePackOrderService.confirmDevPayment(tenantId, orderNo)`
- Produces: `SaasResourcePackOrderService.confirmAlipayPayment(orderNo, alipayTradeNo)`
- Produces: `SaasResourcePackOrderService.listPlatformOrders(query)`

- [ ] **Step 1: Write failing service tests**

Create `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SAAS_ORDER_PAID, SAAS_ORDER_PENDING, SAAS_PAYMENT_ALIPAY } from '../constants';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasResourcePackEntity } from '../entities/saas-resource-pack.entity';
import { SaasTenantResourceEntity } from '../entities/saas-tenant-resource.entity';
import { SaasResourcePackOrderService } from './saas-resource-pack-order.service';

describe('SaasResourcePackOrderService', () => {
  let service: SaasResourcePackOrderService;

  const packRepo = { findOne: jest.fn() };
  const orderRepo = { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), findAndCount: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const manager = { getRepository: jest.fn() };
  const txOrderRepo = { findOne: jest.fn(), save: jest.fn() };
  const txTenantResourceRepo = { findOne: jest.fn(), save: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    orderRepo.create.mockImplementation((payload) => payload);
    orderRepo.save.mockImplementation(async (payload) => ({ id: 88, ...payload }));
    txOrderRepo.save.mockImplementation(async (payload) => payload);
    txTenantResourceRepo.save.mockImplementation(async (payload) => payload);
    manager.getRepository.mockImplementation((entity) => {
      if (entity === SaasResourcePackOrderEntity) return txOrderRepo;
      if (entity === SaasTenantResourceEntity) return txTenantResourceRepo;
      throw new Error(`Unexpected repository ${entity?.name}`);
    });
    dataSource.transaction.mockImplementation(async (callback) => callback(manager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasResourcePackOrderService,
        { provide: getRepositoryToken(SaasResourcePackEntity), useValue: packRepo },
        { provide: getRepositoryToken(SaasResourcePackOrderEntity), useValue: orderRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(SaasResourcePackOrderService);
  });

  it('creates a pending resource pack order from active pack values', async () => {
    packRepo.findOne.mockResolvedValue({
      id: 2,
      code: 'tokens_1m',
      name: 'Tokens 1,000,000',
      resourceType: 'tokens',
      quotaAmount: 1000000,
      priceCents: 19900,
      currency: 'CNY',
      status: 1,
    });

    const order = await service.createTenantOrder(12, {
      resource_pack_code: 'tokens_1m',
      payment_method: 'alipay',
    });

    expect(packRepo.findOne).toHaveBeenCalledWith({ where: { code: 'tokens_1m', status: 1 } });
    expect(orderRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 12,
        resourcePackId: 2,
        resourcePackCode: 'tokens_1m',
        resourcePackName: 'Tokens 1,000,000',
        resourceType: 'tokens',
        quotaAmount: 1000000,
        amountCents: 19900,
        currency: 'CNY',
        paymentMethod: SAAS_PAYMENT_ALIPAY,
        status: SAAS_ORDER_PENDING,
      }),
    );
    expect(order.orderNo).toMatch(/^RPO\d{17}\d{6}$/);
  });

  it('rejects missing or inactive resource packs', async () => {
    packRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createTenantOrder(12, { resource_pack_code: 'missing', payment_method: 'alipay' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('confirms payment and increments existing tenant resource quota once', async () => {
    const paidAt = new Date('2026-07-03T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(paidAt);
    txOrderRepo.findOne.mockResolvedValue({
      id: 88,
      orderNo: 'RPO20260703120000001000001',
      tenantId: 12,
      resourceType: 'tokens',
      quotaAmount: 1000000,
      status: SAAS_ORDER_PENDING,
      paymentMethod: SAAS_PAYMENT_ALIPAY,
    });
    txTenantResourceRepo.findOne.mockResolvedValue({
      tenantId: 12,
      resourceType: 'tokens',
      totalQuota: 5000000,
      usedQuota: 100,
      status: 1,
    });

    const order = await service.confirmDevPayment(12, 'RPO20260703120000001000001');

    expect(txTenantResourceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 12,
        resourceType: 'tokens',
        totalQuota: 6000000,
        usedQuota: 100,
        status: 1,
      }),
    );
    expect(order.status).toBe(SAAS_ORDER_PAID);
    expect(order.alipayTradeNo).toBe('DEV-RPO20260703120000001000001');
    expect(order.paidAt).toEqual(paidAt);
    expect(order.deliveredAt).toEqual(paidAt);
    jest.useRealTimers();
  });

  it('creates tenant resource row when delivering a new resource type', async () => {
    txOrderRepo.findOne.mockResolvedValue({
      orderNo: 'RPO20260703120000001000002',
      tenantId: 12,
      resourceType: 'rag_documents',
      quotaAmount: 1000,
      status: SAAS_ORDER_PENDING,
    });
    txTenantResourceRepo.findOne.mockResolvedValue(null);

    await service.confirmAlipayPayment('RPO20260703120000001000002', '2026070322000000000001');

    expect(txTenantResourceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 12,
        resourceType: 'rag_documents',
        totalQuota: 1000,
        usedQuota: 0,
        status: 1,
      }),
    );
  });

  it('does not deliver quota again for already delivered paid orders', async () => {
    const deliveredAt = new Date('2026-07-03T12:00:00.000Z');
    txOrderRepo.findOne.mockResolvedValue({
      orderNo: 'RPO20260703120000001000003',
      tenantId: 12,
      resourceType: 'tokens',
      quotaAmount: 1000000,
      status: SAAS_ORDER_PAID,
      deliveredAt,
      paidAt: deliveredAt,
    });

    const order = await service.confirmAlipayPayment('RPO20260703120000001000003', '2026070322000000000001');

    expect(order.status).toBe(SAAS_ORDER_PAID);
    expect(txTenantResourceRepo.findOne).not.toHaveBeenCalled();
    expect(txTenantResourceRepo.save).not.toHaveBeenCalled();
    expect(txOrderRepo.save).not.toHaveBeenCalled();
  });

  it('rejects non-pending resource pack orders that are not already delivered', async () => {
    txOrderRepo.findOne.mockResolvedValue({
      orderNo: 'RPO20260703120000001000004',
      tenantId: 12,
      status: 'closed',
    });

    await expect(service.confirmAlipayPayment('RPO20260703120000001000004', 'trade-no')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lists platform resource pack orders with filters and pagination', async () => {
    orderRepo.findAndCount.mockResolvedValue([
      [{ orderNo: 'RPO20260703120000001000001', tenantId: 12, resourcePackCode: 'tokens_1m' }],
      1,
    ]);

    await expect(
      service.listPlatformOrders({
        page: '2',
        limit: '10',
        tenant_id: '12',
        resource_pack_code: 'tokens_1m',
        resource_type: 'tokens',
        status: 'paid',
      }),
    ).resolves.toMatchObject({ total: 1, page: 2, limit: 10 });

    expect(orderRepo.findAndCount).toHaveBeenCalledWith({
      where: {
        tenantId: 12,
        resourcePackCode: 'tokens_1m',
        resourceType: 'tokens',
        status: 'paid',
      },
      order: { createTime: 'DESC', id: 'DESC' },
      skip: 10,
      take: 10,
    });
  });
});
```

- [ ] **Step 2: Run service test to verify it fails**

Run:

```powershell
cd server
pnpm run test -- saas-resource-pack-order.service.spec.ts --runInBand
```

Expected: FAIL because entity, DTO, and service do not exist.

- [ ] **Step 3: Create entity and DTO**

Create `server/src/module/saas/entities/saas-resource-pack-order.entity.ts`:

```ts
import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Index('uk_saas_resource_pack_order_order_no', ['orderNo'], { unique: true })
@Index('idx_saas_resource_pack_order_tenant_status', ['tenantId', 'status'])
@Index('idx_saas_resource_pack_order_pack_status', ['resourcePackCode', 'status'])
@Entity('saas_resource_pack_order', { comment: 'SaaS resource pack orders' })
export class SaasResourcePackOrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'order_no', length: 32 })
  orderNo: string;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'resource_pack_id' })
  resourcePackId: number;

  @Column({ type: 'varchar', name: 'resource_pack_code', length: 50 })
  resourcePackCode: string;

  @Column({ type: 'varchar', name: 'resource_pack_name', length: 100 })
  resourcePackName: string;

  @Column({ type: 'varchar', name: 'resource_type', length: 50 })
  resourceType: string;

  @Column({ type: 'bigint', name: 'quota_amount', default: 0 })
  quotaAmount: number;

  @Column({ type: 'bigint', name: 'amount_cents', default: 0 })
  amountCents: number;

  @Column({ type: 'varchar', name: 'currency', length: 10, default: 'CNY' })
  currency: string;

  @Column({ type: 'varchar', name: 'payment_method', length: 20, default: 'alipay' })
  paymentMethod: string;

  @Column({ type: 'varchar', name: 'status', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'varchar', name: 'alipay_trade_no', length: 64, nullable: true })
  alipayTradeNo?: string;

  @Column({ type: 'datetime', name: 'paid_at', nullable: true })
  paidAt?: Date;

  @Column({ type: 'datetime', name: 'delivered_at', nullable: true })
  deliveredAt?: Date;

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

Create `server/src/module/saas/dto/create-resource-pack-order.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { SAAS_PAYMENT_ALIPAY } from '../constants';

export class CreateResourcePackOrderDto {
  @ApiProperty({ required: true })
  @IsString()
  @MaxLength(50)
  resource_pack_code: string;

  @ApiProperty({ required: false, default: SAAS_PAYMENT_ALIPAY })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  payment_method?: string;
}
```

- [ ] **Step 4: Create migration and migration spec**

Create `server/src/migrations/1760000000006-CreateSaasResourcePackOrders.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSaasResourcePackOrders1760000000006 implements MigrationInterface {
  name = 'CreateSaasResourcePackOrders1760000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`saas_resource_pack_order\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`order_no\` varchar(32) NOT NULL,
        \`tenant_id\` bigint NOT NULL,
        \`resource_pack_id\` bigint NOT NULL,
        \`resource_pack_code\` varchar(50) NOT NULL,
        \`resource_pack_name\` varchar(100) NOT NULL,
        \`resource_type\` varchar(50) NOT NULL,
        \`quota_amount\` bigint NOT NULL DEFAULT 0,
        \`amount_cents\` bigint NOT NULL DEFAULT 0,
        \`currency\` varchar(10) NOT NULL DEFAULT 'CNY',
        \`payment_method\` varchar(20) NOT NULL DEFAULT 'alipay',
        \`status\` varchar(20) NOT NULL DEFAULT 'pending',
        \`alipay_trade_no\` varchar(64) NULL,
        \`paid_at\` datetime NULL,
        \`delivered_at\` datetime NULL,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`update_time\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_saas_resource_pack_order_order_no\` (\`order_no\`),
        KEY \`idx_saas_resource_pack_order_tenant_status\` (\`tenant_id\`, \`status\`),
        KEY \`idx_saas_resource_pack_order_pack_status\` (\`resource_pack_code\`, \`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `saas_resource_pack_order`');
  }
}
```

Create `server/src/migration-specs/create-saas-resource-pack-orders.spec.ts`:

```ts
import { CreateSaasResourcePackOrders1760000000006 } from '../migrations/1760000000006-CreateSaasResourcePackOrders';

describe('CreateSaasResourcePackOrders1760000000006', () => {
  it('creates resource pack order table with unique order number', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateSaasResourcePackOrders1760000000006().up(queryRunner as any);

    const sql = queryRunner.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE `saas_resource_pack_order`');
    expect(sql).toContain('`order_no` varchar(32) NOT NULL');
    expect(sql).toContain('UNIQUE KEY `uk_saas_resource_pack_order_order_no` (`order_no`)');
    expect(sql).toContain('`delivered_at` datetime NULL');
  });
});
```

- [ ] **Step 5: Implement service**

Create `server/src/module/saas/services/saas-resource-pack-order.service.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { SAAS_ORDER_PAID, SAAS_ORDER_PENDING, SAAS_PAYMENT_ALIPAY } from '../constants';
import { CreateResourcePackOrderDto } from '../dto/create-resource-pack-order.dto';
import { SaasResourcePackOrderEntity } from '../entities/saas-resource-pack-order.entity';
import { SaasResourcePackEntity } from '../entities/saas-resource-pack.entity';
import { SaasTenantResourceEntity } from '../entities/saas-tenant-resource.entity';

export interface SaasResourcePackOrderListQuery {
  page?: string | number;
  limit?: string | number;
  tenant_id?: string | number;
  resource_pack_code?: string;
  resource_type?: string;
  status?: string;
}

@Injectable()
export class SaasResourcePackOrderService {
  constructor(
    @InjectRepository(SaasResourcePackEntity)
    private readonly resourcePackRepo: Repository<SaasResourcePackEntity>,
    @InjectRepository(SaasResourcePackOrderEntity)
    private readonly resourcePackOrderRepo: Repository<SaasResourcePackOrderEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async createTenantOrder(tenantId: number, dto: CreateResourcePackOrderDto): Promise<SaasResourcePackOrderEntity> {
    const pack = await this.resourcePackRepo.findOne({
      where: {
        code: dto.resource_pack_code,
        status: 1,
      },
    });
    if (!pack) {
      throw new NotFoundException(`Resource pack ${dto.resource_pack_code} is not configured`);
    }

    const order = this.resourcePackOrderRepo.create({
      orderNo: this.generateOrderNo(),
      tenantId,
      resourcePackId: pack.id,
      resourcePackCode: pack.code,
      resourcePackName: pack.name,
      resourceType: pack.resourceType,
      quotaAmount: Number(pack.quotaAmount) || 0,
      amountCents: Number(pack.priceCents) || 0,
      currency: pack.currency || 'CNY',
      paymentMethod: dto.payment_method || SAAS_PAYMENT_ALIPAY,
      status: SAAS_ORDER_PENDING,
      remark: `Purchase resource pack ${pack.code}`,
    });

    return this.resourcePackOrderRepo.save(order);
  }

  async findTenantOrder(tenantId: number, orderNo: string): Promise<SaasResourcePackOrderEntity | null> {
    return this.resourcePackOrderRepo.findOne({
      where: {
        tenantId,
        orderNo,
      },
    });
  }

  async confirmDevPayment(tenantId: number, orderNo: string): Promise<SaasResourcePackOrderEntity> {
    return this.confirmPaidOrder({
      where: { tenantId, orderNo },
      resolveTradeNo: (order) => `DEV-${order.orderNo}`,
    });
  }

  async confirmAlipayPayment(orderNo: string, alipayTradeNo: string): Promise<SaasResourcePackOrderEntity> {
    return this.confirmPaidOrder({
      where: { orderNo },
      resolveTradeNo: () => alipayTradeNo,
    });
  }

  async listPlatformOrders(query: SaasResourcePackOrderListQuery = {}) {
    const { page, limit, skip } = this.resolvePagination(query);
    const where: FindOptionsWhere<SaasResourcePackOrderEntity> = {};
    const tenantId = this.resolvePositiveNumber(query.tenant_id);
    if (tenantId !== undefined) where.tenantId = tenantId;
    if (query.resource_pack_code) where.resourcePackCode = query.resource_pack_code;
    if (query.resource_type) where.resourceType = query.resource_type;
    if (query.status) where.status = query.status;

    const [list, total] = await this.resourcePackOrderRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip,
      take: limit,
    });

    return { list: list.map((order) => this.toResponse(order)), total, page, limit };
  }

  toResponse(order: Partial<SaasResourcePackOrderEntity>) {
    return {
      order_no: order.orderNo,
      tenant_id: order.tenantId,
      resource_pack_code: order.resourcePackCode,
      resource_pack_name: order.resourcePackName,
      resource_type: order.resourceType,
      quota_amount: Number(order.quotaAmount) || 0,
      amount_cents: Number(order.amountCents) || 0,
      currency: order.currency,
      payment_method: order.paymentMethod,
      status: order.status,
      alipay_trade_no: order.alipayTradeNo,
      paid_at: order.paidAt,
      delivered_at: order.deliveredAt,
      create_time: order.createTime,
    };
  }

  private async confirmPaidOrder(options: {
    where: Record<string, string | number>;
    resolveTradeNo: (order: SaasResourcePackOrderEntity) => string;
  }): Promise<SaasResourcePackOrderEntity> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(SaasResourcePackOrderEntity);
      const tenantResourceRepo = manager.getRepository(SaasTenantResourceEntity);
      const order = await orderRepo.findOne({ where: options.where });
      if (!order) throw new NotFoundException('Resource pack order not found');
      if (order.status === SAAS_ORDER_PAID && order.deliveredAt) return order;
      if (order.status !== SAAS_ORDER_PENDING) throw new BadRequestException('Only pending resource pack orders can be paid');

      const paidAt = new Date();
      order.status = SAAS_ORDER_PAID;
      order.paidAt = paidAt;
      order.deliveredAt = paidAt;
      order.alipayTradeNo = options.resolveTradeNo(order);

      const resource = await tenantResourceRepo.findOne({
        where: {
          tenantId: order.tenantId,
          resourceType: order.resourceType,
        },
      });
      if (resource) {
        resource.totalQuota = Number(resource.totalQuota || 0) + Number(order.quotaAmount || 0);
        resource.status = 1;
        await tenantResourceRepo.save(resource);
      } else {
        await tenantResourceRepo.save({
          tenantId: order.tenantId,
          resourceType: order.resourceType,
          totalQuota: Number(order.quotaAmount) || 0,
          usedQuota: 0,
          status: 1,
        });
      }

      return orderRepo.save(order);
    });
  }

  private resolvePagination(query: SaasResourcePackOrderListQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return { page, limit, skip: (page - 1) * limit };
  }

  private resolvePositiveNumber(value: string | number | undefined): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  }

  private generateOrderNo(): string {
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
      String(now.getMilliseconds()).padStart(3, '0'),
    ].join('');
    const suffix = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    return `RPO${timestamp}${suffix}`;
  }
}
```

- [ ] **Step 6: Register entity and service**

Modify `server/src/module/saas/saas.module.ts`:

```ts
import { SaasResourcePackOrderEntity } from './entities/saas-resource-pack-order.entity';
import { SaasResourcePackOrderService } from './services/saas-resource-pack-order.service';
```

Add `SaasResourcePackOrderEntity` to `TypeOrmModule.forFeature([...])`.

Add `SaasResourcePackOrderService` to `providers` and `exports`.

- [ ] **Step 7: Run tests**

Run:

```powershell
cd server
pnpm run test -- saas-resource-pack-order.service.spec.ts --runInBand
pnpm run test -- create-saas-resource-pack-orders.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

Run:

```powershell
git add server/src/module/saas/entities/saas-resource-pack-order.entity.ts server/src/module/saas/dto/create-resource-pack-order.dto.ts server/src/migrations/1760000000006-CreateSaasResourcePackOrders.ts server/src/migration-specs/create-saas-resource-pack-orders.spec.ts server/src/module/saas/services/saas-resource-pack-order.service.ts server/src/module/saas/services/saas-resource-pack-order.service.spec.ts server/src/module/saas/saas.module.ts
git commit -m "feat: add SaaS resource pack order service"
```

## Task 2: Tenant And Platform Resource Pack Order APIs

**Files:**
- Modify: `server/src/module/saas/saas-tenant.controller.ts`
- Modify: `server/src/module/saas/saas-tenant.controller.spec.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.spec.ts`
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`
- Modify: `server/src/migrations/1760000000001-SeedSaasFoundationData.ts`
- Modify: `server/src/migration-specs/seed-saas-foundation-data.spec.ts`

**Interfaces:**
- Consumes: `SaasResourcePackOrderService.createTenantOrder(tenantId, dto)`
- Consumes: `SaasResourcePackOrderService.findTenantOrder(tenantId, orderNo)`
- Consumes: `SaasResourcePackOrderService.listPlatformOrders(query)`
- Produces: `POST /api/saas/tenant/resource-pack-orders`
- Produces: `GET /api/saas/tenant/resource-pack-orders/:order_no`
- Produces: `GET /api/saas/platform/resource-pack-orders`

- [ ] **Step 1: Write failing controller/service tests**

In `server/src/module/saas/saas-tenant.controller.spec.ts`, add provider:

```ts
import { SaasResourcePackOrderService } from './services/saas-resource-pack-order.service';

const saasResourcePackOrderService = {
  createTenantOrder: jest.fn(),
  findTenantOrder: jest.fn(),
  toResponse: jest.fn((order) => ({
    order_no: order.orderNo,
    resource_pack_code: order.resourcePackCode,
    status: order.status,
  })),
};
```

Add provider entry:

```ts
{
  provide: SaasResourcePackOrderService,
  useValue: saasResourcePackOrderService,
}
```

Add tests:

```ts
it('creates a tenant resource pack order in tenant context', async () => {
  jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
  saasResourcePackOrderService.createTenantOrder.mockResolvedValue({
    orderNo: 'RPO20260703120000001000001',
    resourcePackCode: 'tokens_1m',
    status: 'pending',
  });

  const result = await controller.createResourcePackOrder({
    resource_pack_code: 'tokens_1m',
    payment_method: 'alipay',
  });

  expect(saasResourcePackOrderService.createTenantOrder).toHaveBeenCalledWith(88, {
    resource_pack_code: 'tokens_1m',
    payment_method: 'alipay',
  });
  expect(result.data).toEqual({
    order_no: 'RPO20260703120000001000001',
    resource_pack_code: 'tokens_1m',
    status: 'pending',
  });
});

it('returns a tenant resource pack order by order number', async () => {
  jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
  saasResourcePackOrderService.findTenantOrder.mockResolvedValue({
    orderNo: 'RPO20260703120000001000001',
    resourcePackCode: 'tokens_1m',
    status: 'paid',
  });

  const result = await controller.resourcePackOrder('RPO20260703120000001000001');

  expect(saasResourcePackOrderService.findTenantOrder).toHaveBeenCalledWith(88, 'RPO20260703120000001000001');
  expect(result.data).toEqual({
    order_no: 'RPO20260703120000001000001',
    resource_pack_code: 'tokens_1m',
    status: 'paid',
  });
});
```

In `server/src/module/saas/services/saas-platform.service.spec.ts`, extend the existing `resourcePackService` mock or create a new `resourcePackOrderService` mock:

```ts
import { SaasResourcePackOrderService } from './saas-resource-pack-order.service';

const resourcePackOrderService = {
  listPlatformOrders: jest.fn(),
};
```

Register provider and add test:

```ts
it('delegates resource pack order listing to the resource pack order service', async () => {
  resourcePackOrderService.listPlatformOrders.mockResolvedValue({
    list: [{ order_no: 'RPO20260703120000001000001' }],
    total: 1,
    page: 1,
    limit: 20,
  });

  await expect(service.listResourcePackOrders({ status: 'paid' })).resolves.toEqual({
    list: [{ order_no: 'RPO20260703120000001000001' }],
    total: 1,
    page: 1,
    limit: 20,
  });
  expect(resourcePackOrderService.listPlatformOrders).toHaveBeenCalledWith({ status: 'paid' });
});
```

In `server/src/module/saas/saas-platform.controller.spec.ts`, add mock method:

```ts
listResourcePackOrders: jest.fn(),
```

Add test:

```ts
it('lists platform SaaS resource pack orders outside tenant scope', async () => {
  platformService.listResourcePackOrders.mockResolvedValue({
    list: [{ order_no: 'RPO20260703120000001000001' }],
    total: 1,
    page: 1,
    limit: 20,
  });

  const result = await controller.listResourcePackOrders({ status: 'paid' }, { userId: 1 } as any);

  expect(platformService.listResourcePackOrders).toHaveBeenCalledWith({ status: 'paid' });
  expect(result.data).toEqual({
    list: [{ order_no: 'RPO20260703120000001000001' }],
    total: 1,
    page: 1,
    limit: 20,
  });
});
```

In `server/src/migration-specs/seed-saas-foundation-data.spec.ts`, add assertions:

```ts
expect(params).toContain('saas:resource-pack-order:list');
expect(params).toContain('tenant:resource-pack-order:create');
expect(params).toContain('tenant:resource-pack-order:view');
expect(params).toContain('tenant:resource-pack-order:pay');
expect(params).toContain('/saas/platform/resource-pack-order');
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
cd server
pnpm run test -- saas-tenant.controller.spec.ts --runInBand
pnpm run test -- saas-platform.service.spec.ts --runInBand
pnpm run test -- saas-platform.controller.spec.ts --runInBand
pnpm run test -- seed-saas-foundation-data.spec.ts --runInBand
```

Expected: FAIL because controller/service methods and seed additions do not exist.

- [ ] **Step 3: Implement tenant endpoints**

Modify `server/src/module/saas/saas-tenant.controller.ts`:

```ts
import { CreateResourcePackOrderDto } from './dto/create-resource-pack-order.dto';
import { SaasResourcePackOrderService } from './services/saas-resource-pack-order.service';
```

Inject `private readonly saasResourcePackOrderService: SaasResourcePackOrderService`.

Add methods:

```ts
@Post('resource-pack-orders')
@ApiOperation({ summary: 'Create a tenant SaaS resource pack order' })
async createResourcePackOrder(@Body() body: CreateResourcePackOrderDto) {
  const tenantId = getTenantId();
  if (!tenantId) {
    return ResultData.fail(401, 'Tenant context is required');
  }

  return ResultData.ok(
    this.saasResourcePackOrderService.toResponse(
      await this.saasResourcePackOrderService.createTenantOrder(tenantId, body),
    ),
  );
}

@Get('resource-pack-orders/:order_no')
@ApiOperation({ summary: 'Get a tenant SaaS resource pack order' })
async resourcePackOrder(@Param('order_no') orderNo: string) {
  const tenantId = getTenantId();
  if (!tenantId) {
    return ResultData.fail(401, 'Tenant context is required');
  }

  const order = await this.saasResourcePackOrderService.findTenantOrder(tenantId, orderNo);
  return ResultData.ok(order ? this.saasResourcePackOrderService.toResponse(order) : null);
}
```

- [ ] **Step 4: Implement platform service/controller endpoint**

Modify `server/src/module/saas/services/saas-platform.service.ts`:

```ts
import { SaasResourcePackOrderListQuery, SaasResourcePackOrderService } from './saas-resource-pack-order.service';
```

Inject `private readonly resourcePackOrderService: SaasResourcePackOrderService`.

Add:

```ts
listResourcePackOrders(query: SaasResourcePackOrderListQuery = {}) {
  return this.resourcePackOrderService.listPlatformOrders(query);
}
```

Modify `server/src/module/saas/saas-platform.controller.ts`:

```ts
import type { SaasResourcePackOrderListQuery } from './services/saas-resource-pack-order.service';
```

Add:

```ts
@Get('resource-pack-orders')
@ApiOperation({ summary: 'List SaaS resource pack orders' })
@RequirePermission('saas:resource-pack-order:list')
listResourcePackOrders(@Query() query: SaasResourcePackOrderListQuery, @User() user: UserDto) {
  return TenantContext.run(
    {
      tenantId: undefined,
      userId: user?.userId,
      ignoreAudit: false,
      ignoreTenant: true,
    },
    () => this.platformService.listResourcePackOrders(query).then((data) => ResultData.ok(data)),
  );
}
```

- [ ] **Step 5: Seed menu and permissions**

Modify `server/src/migrations/1760000000001-SeedSaasFoundationData.ts`.

Add platform menu under `PLATFORM_MENUS`:

```ts
{
  name: 'Resource Pack Orders',
  code: 'SaasResourcePackOrder',
  type: 2,
  path: 'resource-pack-orders',
  component: '/saas/platform/resource-pack-order',
  icon: 'ri:file-list-3-line',
  sort: 60,
  remark: 'Seeded SaaS resource pack order menu',
}
```

Add platform permission:

```ts
{
  parentCode: 'SaasResourcePackOrder',
  name: 'List',
  slug: 'saas:resource-pack-order:list',
  method: 'GET',
  sort: 10,
  remark: 'Seeded SaaS resource pack order list permission',
}
```

Add tenant permissions:

```ts
{
  parentCode: 'TenantResourcePack',
  name: 'Create order',
  slug: 'tenant:resource-pack-order:create',
  method: 'POST',
  sort: 20,
  remark: 'Seeded tenant resource pack order create permission',
},
{
  parentCode: 'TenantResourcePack',
  name: 'View order',
  slug: 'tenant:resource-pack-order:view',
  method: 'GET',
  sort: 30,
  remark: 'Seeded tenant resource pack order view permission',
},
{
  parentCode: 'TenantResourcePack',
  name: 'Pay order',
  slug: 'tenant:resource-pack-order:pay',
  method: 'POST',
  sort: 40,
  remark: 'Seeded tenant resource pack order pay permission',
}
```

Add these slugs/codes to the existing `down()` cleanup lists:

```sql
'saas:resource-pack-order:list'
'tenant:resource-pack-order:create'
'tenant:resource-pack-order:view'
'tenant:resource-pack-order:pay'
'SaasResourcePackOrder'
```

- [ ] **Step 6: Run tests**

Run:

```powershell
cd server
pnpm run test -- saas-tenant.controller.spec.ts --runInBand
pnpm run test -- saas-platform.service.spec.ts --runInBand
pnpm run test -- saas-platform.controller.spec.ts --runInBand
pnpm run test -- seed-saas-foundation-data.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add server/src/module/saas/saas-tenant.controller.ts server/src/module/saas/saas-tenant.controller.spec.ts server/src/module/saas/services/saas-platform.service.ts server/src/module/saas/services/saas-platform.service.spec.ts server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-platform.controller.spec.ts server/src/migrations/1760000000001-SeedSaasFoundationData.ts server/src/migration-specs/seed-saas-foundation-data.spec.ts
git commit -m "feat: expose SaaS resource pack order APIs"
```

## Task 3: Payment Service And Controller Order-Type Routing

**Files:**
- Modify: `server/src/module/saas/services/saas-payment.service.ts`
- Modify: `server/src/module/saas/services/saas-payment.service.spec.ts`
- Modify: `server/src/module/saas/saas-payment.controller.ts`
- Modify: `server/src/module/saas/saas-payment.controller.spec.ts`

**Interfaces:**
- Consumes: `SaasResourcePackOrderService.findTenantOrder(tenantId, orderNo)`
- Consumes: `SaasResourcePackOrderService.confirmDevPayment(tenantId, orderNo)`
- Consumes: `SaasResourcePackOrderService.confirmAlipayPayment(orderNo, alipayTradeNo)`
- Produces: `SaasPaymentService.createAlipayPayment(tenantId, orderNo, orderType?)`
- Produces: `POST /api/saas/payment/dev-confirm` with optional `order_type`
- Produces: `POST /api/saas/payment/alipay/create` with optional `order_type`

- [ ] **Step 1: Write failing payment service tests**

Modify `server/src/module/saas/services/saas-payment.service.spec.ts`.

Add import:

```ts
import { SaasResourcePackOrderService } from './saas-resource-pack-order.service';
```

Add mock:

```ts
const resourcePackOrderService = {
  findTenantOrder: jest.fn(),
};
```

Instantiate service with third constructor argument:

```ts
service = new SaasPaymentService(
  saasOrderService as unknown as SaasOrderService,
  resourcePackOrderService as unknown as SaasResourcePackOrderService,
  configService as unknown as ConfigService,
);
```

Add test:

```ts
it('returns a signed Alipay URL for resource pack orders with resource pack subject', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  resourcePackOrderService.findTenantOrder.mockResolvedValue({
    orderNo: 'RPO20260703120000001000001',
    tenantId: 12,
    status: SAAS_ORDER_PENDING,
    resourcePackCode: 'tokens_1m',
    amountCents: 19900,
  });
  configService.get.mockImplementation((key: string) => {
    const values: Record<string, string | boolean> = {
      'payment.alipay.enabled': true,
      'payment.alipay.appId': '2026070200000001',
      'payment.alipay.privateKey': privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      'payment.alipay.publicKey': publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      'payment.alipay.notifyUrl': 'http://127.0.0.1:8181/api/saas/payment/alipay/notify',
      'payment.alipay.returnUrl': 'http://127.0.0.1:5731/#/tenant-saas/resource-packs',
      'payment.alipay.gatewayUrl': 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
    };
    return values[key];
  });

  const result = await service.createAlipayPayment(12, 'RPO20260703120000001000001', 'resource_pack');

  expect(resourcePackOrderService.findTenantOrder).toHaveBeenCalledWith(12, 'RPO20260703120000001000001');
  const payUrl = new URL(result.pay_url || '');
  const params = Object.fromEntries(payUrl.searchParams.entries());
  expect(JSON.parse(params.biz_content)).toEqual({
    out_trade_no: 'RPO20260703120000001000001',
    total_amount: '199.00',
    subject: 'SaaS resource pack tokens_1m',
    product_code: 'FAST_INSTANT_TRADE_PAY',
  });
  expect(createVerify('RSA-SHA256').update(buildAlipaySignContent(params), 'utf8').verify(publicKey, params.sign, 'base64')).toBe(true);
});
```

- [ ] **Step 2: Write failing payment controller tests**

Modify `server/src/module/saas/saas-payment.controller.spec.ts`.

Add `resourcePackOrderService` provider:

```ts
const resourcePackOrderService = {
  confirmDevPayment: jest.fn(),
  confirmAlipayPayment: jest.fn(),
  toResponse: jest.fn((order) => ({
    order_no: order.orderNo,
    resource_pack_code: order.resourcePackCode,
    status: order.status,
  })),
};
```

Add tests:

```ts
it('dev-confirms a resource pack order when order_type is resource_pack', async () => {
  jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
  resourcePackOrderService.confirmDevPayment.mockResolvedValue({
    orderNo: 'RPO20260703120000001000001',
    resourcePackCode: 'tokens_1m',
    status: 'paid',
  });

  const result = await controller.devConfirm({
    order_no: 'RPO20260703120000001000001',
    order_type: 'resource_pack',
  });

  expect(resourcePackOrderService.confirmDevPayment).toHaveBeenCalledWith(88, 'RPO20260703120000001000001');
  expect(result.data).toEqual({
    order_no: 'RPO20260703120000001000001',
    resource_pack_code: 'tokens_1m',
    status: 'paid',
  });
});

it('routes RPO Alipay notify orders to resource pack confirmation', async () => {
  paymentService.verifyAlipayNotify.mockReturnValue(true);
  resourcePackOrderService.confirmAlipayPayment.mockResolvedValue({ status: 'paid' });

  await expect(
    controller.alipayNotify({
      out_trade_no: 'RPO20260703120000001000001',
      trade_no: '2026070322000000000001',
      trade_status: 'TRADE_SUCCESS',
    }),
  ).resolves.toBe('success');

  expect(resourcePackOrderService.confirmAlipayPayment).toHaveBeenCalledWith(
    'RPO20260703120000001000001',
    '2026070322000000000001',
  );
  expect(orderService.confirmAlipayPayment).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```powershell
cd server
pnpm run test -- saas-payment.service.spec.ts --runInBand
pnpm run test -- saas-payment.controller.spec.ts --runInBand
```

Expected: FAIL because payment service/controller are not order-type aware yet.

- [ ] **Step 4: Implement payment service order type support**

Modify `server/src/module/saas/services/saas-payment.service.ts`.

Add:

```ts
import { SaasResourcePackOrderService } from './saas-resource-pack-order.service';

export type SaasPaymentOrderType = 'plan' | 'resource_pack';

type SaasPayableOrder = {
  orderNo: string;
  amountCents: number;
  subject: string;
};
```

Constructor becomes:

```ts
constructor(
  private readonly saasOrderService: SaasOrderService,
  private readonly saasResourcePackOrderService: SaasResourcePackOrderService,
  private readonly configService: ConfigService,
) {}
```

Change method signature:

```ts
async createAlipayPayment(
  tenantId: number,
  orderNo: string,
  orderType: SaasPaymentOrderType = 'plan',
): Promise<SaasAlipayPaymentResult> {
  const payableOrder = await this.resolvePayableOrder(tenantId, orderNo, orderType);
  const config = this.getAlipayConfig();
  if (!this.isAlipayConfigured(config)) {
    return {
      configured: false,
      provider: SAAS_PAYMENT_ALIPAY,
      order_no: payableOrder.orderNo,
      pay_url: null,
      message: ALIPAY_MISSING_CONFIG_MESSAGE,
    };
  }

  return {
    configured: true,
    provider: SAAS_PAYMENT_ALIPAY,
    order_no: payableOrder.orderNo,
    pay_url: this.buildSignedPagePayUrl(config, payableOrder),
    message: ALIPAY_PAGE_PAY_READY_MESSAGE,
  };
}
```

Add:

```ts
private async resolvePayableOrder(
  tenantId: number,
  orderNo: string,
  orderType: SaasPaymentOrderType,
): Promise<SaasPayableOrder> {
  if (orderType === 'resource_pack') {
    const order = await this.saasResourcePackOrderService.findTenantOrder(tenantId, orderNo);
    if (!order) throw new NotFoundException('Resource pack order not found');
    if (order.status !== SAAS_ORDER_PENDING) throw new BadRequestException('Only pending orders can be paid');
    return {
      orderNo: order.orderNo,
      amountCents: order.amountCents,
      subject: `SaaS resource pack ${order.resourcePackCode}`,
    };
  }

  const order = await this.saasOrderService.findTenantOrder(tenantId, orderNo);
  if (!order) throw new NotFoundException('Order not found');
  if (order.status !== SAAS_ORDER_PENDING) throw new BadRequestException('Only pending orders can be paid');
  return {
    orderNo: order.orderNo,
    amountCents: order.amountCents,
    subject: `SaaS plan ${order.planCode}`,
  };
}
```

Change `buildSignedPagePayUrl` parameter type to `SaasPayableOrder`, and set:

```ts
biz_content: JSON.stringify({
  out_trade_no: order.orderNo,
  total_amount: this.formatAmountYuan(order.amountCents),
  subject: order.subject,
  product_code: ALIPAY_PAGE_PAY_PRODUCT_CODE,
}),
```

- [ ] **Step 5: Implement payment controller routing**

Modify `server/src/module/saas/saas-payment.controller.ts`.

Add imports:

```ts
import { SaasResourcePackOrderService } from './services/saas-resource-pack-order.service';
import type { SaasPaymentOrderType } from './services/saas-payment.service';
```

Inject:

```ts
private readonly saasResourcePackOrderService: SaasResourcePackOrderService,
```

Change `devConfirm` body type and implementation:

```ts
async devConfirm(@Body() body: { order_no: string; order_type?: SaasPaymentOrderType }) {
  const tenantId = getTenantId();
  if (!tenantId) {
    return ResultData.fail(401, 'Tenant context is required');
  }

  if (body.order_type === 'resource_pack') {
    return ResultData.ok(
      this.saasResourcePackOrderService.toResponse(
        await this.saasResourcePackOrderService.confirmDevPayment(tenantId, body.order_no),
      ),
    );
  }

  return ResultData.ok(this.toOrderResponse(await this.saasOrderService.confirmDevPayment(tenantId, body.order_no)));
}
```

Change `createAlipayPayment`:

```ts
async createAlipayPayment(@Body() body: { order_no: string; order_type?: SaasPaymentOrderType }) {
  const tenantId = getTenantId();
  if (!tenantId) {
    return ResultData.fail(401, 'Tenant context is required');
  }

  return ResultData.ok(await this.saasPaymentService.createAlipayPayment(tenantId, body.order_no, body.order_type || 'plan'));
}
```

Change `alipayNotify`:

```ts
const orderNo = String(body.out_trade_no || '');
if (orderNo.startsWith('RPO')) {
  await this.saasResourcePackOrderService.confirmAlipayPayment(orderNo, String(body.trade_no || ''));
  return 'success';
}

await this.saasOrderService.confirmAlipayPayment(orderNo, String(body.trade_no || ''));
return 'success';
```

- [ ] **Step 6: Run payment tests**

Run:

```powershell
cd server
pnpm run test -- saas-payment.service.spec.ts --runInBand
pnpm run test -- saas-payment.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```powershell
git add server/src/module/saas/services/saas-payment.service.ts server/src/module/saas/services/saas-payment.service.spec.ts server/src/module/saas/saas-payment.controller.ts server/src/module/saas/saas-payment.controller.spec.ts
git commit -m "feat: route SaaS resource pack payments"
```

## Task 4: Frontend Resource Pack Purchase Flow

**Files:**
- Modify: `web/src/api/saas.ts`
- Modify: `web/src/views/saas/tenant/resource-pack/index.vue`
- Create: `web/src/views/saas/platform/resource-pack-order/index.vue`

**Interfaces:**
- Consumes: `POST /api/saas/tenant/resource-pack-orders`
- Consumes: `GET /api/saas/tenant/resource-pack-orders/:order_no`
- Consumes: `POST /api/saas/payment/alipay/create` with `order_type`
- Consumes: `POST /api/saas/payment/dev-confirm` with `order_type`
- Produces: tenant resource-pack purchase UI.
- Produces: platform resource-pack order list page.

- [ ] **Step 1: Add API wrappers**

Modify `web/src/api/saas.ts`.

Add interfaces:

```ts
export type SaasPaymentOrderType = 'plan' | 'resource_pack'

export interface CreateResourcePackOrderParams {
  resource_pack_code: string
  payment_method?: string
}

export interface SaasResourcePackOrderRecord {
  order_no: string
  tenant_id?: number
  resource_pack_code: string
  resource_pack_name: string
  resource_type: string
  quota_amount: number
  amount_cents: number
  currency: string
  payment_method?: string
  status: string
  alipay_trade_no?: string
  paid_at?: string | Date
  delivered_at?: string | Date
  create_time?: string | Date
}

export interface SaasResourcePackOrderListParams {
  page?: number
  limit?: number
  tenant_id?: number | string
  resource_pack_code?: string
  resource_type?: string
  status?: string
}
```

Change payment helpers:

```ts
export function devConfirmTenantPayment(orderNo: string, orderType: SaasPaymentOrderType = 'plan') {
  return request.post<SaasOrderRecord | SaasResourcePackOrderRecord>({
    url: '/api/saas/payment/dev-confirm',
    data: {
      order_no: orderNo,
      order_type: orderType
    }
  })
}

export function createAlipayPayment(orderNo: string, orderType: SaasPaymentOrderType = 'plan') {
  return request.post<AlipayPaymentResult>({
    url: '/api/saas/payment/alipay/create',
    data: {
      order_no: orderNo,
      order_type: orderType
    }
  })
}
```

Add:

```ts
export function createTenantResourcePackOrder(params: CreateResourcePackOrderParams) {
  return request.post<SaasResourcePackOrderRecord>({
    url: '/api/saas/tenant/resource-pack-orders',
    data: params
  })
}

export function fetchTenantResourcePackOrder(orderNo: string) {
  return request.get<SaasResourcePackOrderRecord>({
    url: `/api/saas/tenant/resource-pack-orders/${orderNo}`
  })
}

export function fetchPlatformResourcePackOrders(params: SaasResourcePackOrderListParams) {
  return request.get<SaasPlatformPageResult<SaasResourcePackOrderRecord>>({
    url: '/api/saas/platform/resource-pack-orders',
    params
  })
}
```

- [ ] **Step 2: Update tenant resource-pack page**

Modify `web/src/views/saas/tenant/resource-pack/index.vue`.

Add imports:

```ts
import { ElMessage } from 'element-plus'
import {
  createAlipayPayment,
  createTenantResourcePackOrder,
  devConfirmTenantPayment,
  fetchTenantResourcePackOrder,
  fetchTenantResourcePacks,
  type SaasResourcePackOrderRecord,
  type SaasResourcePackRecord
} from '@/api/saas'
```

Add state:

```ts
const currentOrder = ref<SaasResourcePackOrderRecord | null>(null)
const creatingPackCode = ref('')
const creatingAlipayPayment = ref(false)
const confirmingPayment = ref(false)
const pollingPayment = ref(false)
let paymentPollingTimer: number | undefined
let paymentPollingStartedAt = 0
const PAYMENT_POLL_INTERVAL_MS = 5000
const PAYMENT_POLL_TIMEOUT_MS = 120000
```

Replace disabled button with:

```vue
<ElButton
  type="primary"
  :loading="creatingPackCode === pack.code"
  :disabled="Boolean(currentOrder && currentOrder.status !== 'paid')"
  @click="createOrder(pack)"
>
  购买
</ElButton>
```

Add order panel below the grid:

```vue
<section v-if="currentOrder" class="tenant-resource-pack-page__order">
  <div>
    <h2 class="tenant-resource-pack-page__section-title">当前资源包订单</h2>
    <p class="tenant-resource-pack-page__remark">
      {{ currentOrder.order_no }} · {{ currentOrder.resource_pack_code }} · {{ formatPrice(currentOrder.amount_cents, currentOrder.currency) }}
    </p>
    <ElTag :type="currentOrder.status === 'paid' ? 'success' : 'warning'" effect="light">
      {{ currentOrder.status === 'paid' ? '已支付' : '待支付' }}
    </ElTag>
  </div>
  <div class="tenant-resource-pack-page__order-actions">
    <ElButton
      type="primary"
      :disabled="currentOrder.status === 'paid'"
      :loading="creatingAlipayPayment"
      @click="startAlipayPayment"
    >
      去支付宝支付
    </ElButton>
    <ElButton
      type="success"
      :disabled="currentOrder.status === 'paid'"
      :loading="confirmingPayment"
      @click="confirmDevPayment"
    >
      本地模拟支付成功
    </ElButton>
    <span v-if="pollingPayment" class="tenant-resource-pack-page__remark">正在同步支付结果...</span>
  </div>
</section>
```

Add methods:

```ts
async function createOrder(pack: SaasResourcePackRecord) {
  creatingPackCode.value = pack.code
  try {
    currentOrder.value = await createTenantResourcePackOrder({
      resource_pack_code: pack.code,
      payment_method: 'alipay'
    })
    ElMessage.success('资源包订单已创建')
  } finally {
    creatingPackCode.value = ''
  }
}

async function startAlipayPayment() {
  if (!currentOrder.value) return
  creatingAlipayPayment.value = true
  try {
    const result = await createAlipayPayment(currentOrder.value.order_no, 'resource_pack')
    if (result.configured && result.pay_url) {
      window.open(result.pay_url, '_blank', 'noopener,noreferrer')
      startPaymentPolling()
      ElMessage.success('支付宝支付页面已打开')
      return
    }
    ElMessage.warning(result.message || '支付宝沙箱配置未完成')
  } finally {
    creatingAlipayPayment.value = false
  }
}

async function confirmDevPayment() {
  if (!currentOrder.value) return
  confirmingPayment.value = true
  try {
    stopPaymentPolling()
    currentOrder.value = (await devConfirmTenantPayment(
      currentOrder.value.order_no,
      'resource_pack'
    )) as SaasResourcePackOrderRecord
    ElMessage.success('资源包支付成功，额度已发放')
    await loadResourcePacks()
  } finally {
    confirmingPayment.value = false
  }
}

function startPaymentPolling() {
  if (!currentOrder.value || currentOrder.value.status === 'paid' || paymentPollingTimer) return
  pollingPayment.value = true
  paymentPollingStartedAt = Date.now()
  paymentPollingTimer = window.setInterval(() => {
    pollPaymentStatus()
  }, PAYMENT_POLL_INTERVAL_MS)
}

function stopPaymentPolling() {
  if (paymentPollingTimer) {
    window.clearInterval(paymentPollingTimer)
    paymentPollingTimer = undefined
  }
  pollingPayment.value = false
  paymentPollingStartedAt = 0
}

async function pollPaymentStatus() {
  const orderNo = currentOrder.value?.order_no
  if (!orderNo || Date.now() - paymentPollingStartedAt > PAYMENT_POLL_TIMEOUT_MS) {
    stopPaymentPolling()
    return
  }
  const order = await fetchTenantResourcePackOrder(orderNo)
  currentOrder.value = order
  if (order.status === 'paid') {
    stopPaymentPolling()
    ElMessage.success('资源包支付成功，额度已发放')
  }
}

onBeforeUnmount(() => {
  stopPaymentPolling()
})
```

Add scoped styles:

```css
.tenant-resource-pack-page__order {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  padding: 18px;
}

.tenant-resource-pack-page__section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

.tenant-resource-pack-page__order-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
```

- [ ] **Step 3: Create platform resource-pack order page**

Create `web/src/views/saas/platform/resource-pack-order/index.vue` with:

```vue
<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-resource-pack-order-page">
      <template #header>
        <div class="saas-resource-pack-order-page__header">
          <div>
            <h1 class="saas-resource-pack-order-page__title">资源包订单</h1>
            <p class="saas-resource-pack-order-page__subtitle">查看租户资源包购买和发放状态。</p>
          </div>
          <ElButton :loading="loading" @click="loadOrders">刷新</ElButton>
        </div>
      </template>

      <div class="saas-resource-pack-order-page__filters">
        <ElInput v-model="filters.tenant_id" clearable placeholder="租户 ID" class="saas-resource-pack-order-page__input" @keyup.enter="refreshOrders" />
        <ElInput v-model="filters.resource_pack_code" clearable placeholder="资源包编码" class="saas-resource-pack-order-page__input" @keyup.enter="refreshOrders" />
        <ElSelect v-model="filters.resource_type" clearable placeholder="资源类型" class="saas-resource-pack-order-page__select">
          <ElOption label="AI 调用次数" value="ai_calls" />
          <ElOption label="Token" value="tokens" />
          <ElOption label="存储空间" value="storage_mb" />
          <ElOption label="知识库文档" value="rag_documents" />
        </ElSelect>
        <ElSelect v-model="filters.status" clearable placeholder="状态" class="saas-resource-pack-order-page__select">
          <ElOption label="待支付" value="pending" />
          <ElOption label="已支付" value="paid" />
          <ElOption label="已关闭" value="closed" />
        </ElSelect>
        <ElButton type="primary" :loading="loading" @click="refreshOrders">查询</ElButton>
      </div>

      <ElTable v-loading="loading" :data="orders" border>
        <ElTableColumn prop="order_no" label="订单号" min-width="230" show-overflow-tooltip />
        <ElTableColumn prop="tenant_id" label="租户 ID" width="110" />
        <ElTableColumn prop="resource_pack_code" label="资源包" width="170" show-overflow-tooltip />
        <ElTableColumn prop="resource_type" label="资源类型" width="140" />
        <ElTableColumn label="额度" width="150">
          <template #default="{ row }">{{ formatCount(row.quota_amount) }}</template>
        </ElTableColumn>
        <ElTableColumn label="金额" width="130">
          <template #default="{ row }">{{ formatPrice(row.amount_cents, row.currency) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="status" label="状态" width="110">
          <template #default="{ row }">
            <ElTag :type="row.status === 'paid' ? 'success' : row.status === 'pending' ? 'warning' : 'info'" effect="light">
              {{ row.status }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="支付时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.paid_at) }}</template>
        </ElTableColumn>
        <ElTableColumn label="发放时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.delivered_at) }}</template>
        </ElTableColumn>
      </ElTable>

      <ElPagination
        v-model:current-page="pager.page"
        v-model:page-size="pager.limit"
        class="saas-resource-pack-order-page__pagination"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50, 100]"
        :total="pager.total"
        @current-change="loadOrders"
        @size-change="handleSizeChange"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { fetchPlatformResourcePackOrders, type SaasResourcePackOrderRecord } from '@/api/saas'

  defineOptions({ name: 'SaasPlatformResourcePackOrderPage' })

  const loading = ref(false)
  const orders = ref<SaasResourcePackOrderRecord[]>([])
  const filters = reactive({
    tenant_id: '',
    resource_pack_code: '',
    resource_type: '',
    status: ''
  })
  const pager = reactive({ page: 1, limit: 20, total: 0 })
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  async function loadOrders() {
    loading.value = true
    try {
      const result = await fetchPlatformResourcePackOrders({
        page: pager.page,
        limit: pager.limit,
        tenant_id: filters.tenant_id || undefined,
        resource_pack_code: filters.resource_pack_code || undefined,
        resource_type: filters.resource_type || undefined,
        status: filters.status || undefined
      })
      orders.value = result.list || []
      pager.total = Number(result.total) || 0
    } finally {
      loading.value = false
    }
  }

  function refreshOrders() {
    pager.page = 1
    loadOrders()
  }

  function handleSizeChange() {
    pager.page = 1
    loadOrders()
  }

  function formatCount(value: unknown) {
    return new Intl.NumberFormat('zh-CN').format(Number(value) || 0)
  }

  function formatPrice(priceCents: number, currency = 'CNY') {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format((Number(priceCents) || 0) / 100)
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  onMounted(() => {
    loadOrders()
  })
</script>

<style scoped>
  .saas-resource-pack-order-page { min-height: 100%; }
  .saas-resource-pack-order-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  .saas-resource-pack-order-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }
  .saas-resource-pack-order-page__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }
  .saas-resource-pack-order-page__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }
  .saas-resource-pack-order-page__input,
  .saas-resource-pack-order-page__select {
    width: 180px;
  }
  .saas-resource-pack-order-page__pagination {
    margin-top: 16px;
    justify-content: flex-end;
  }
</style>
```

- [ ] **Step 4: Run frontend typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```powershell
git add web/src/api/saas.ts web/src/views/saas/tenant/resource-pack/index.vue web/src/views/saas/platform/resource-pack-order/index.vue
git commit -m "feat: add SaaS resource pack purchase UI"
```

## Task 5: Final Verification

**Files:**
- Modify only files required to fix defects found during verification.

**Interfaces:**
- Confirms backend tests pass.
- Confirms backend typecheck passes.
- Confirms frontend typecheck passes.
- Confirms component paths resolve.

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

Expected: exits with code `0`.

- [ ] **Step 3: Run frontend typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: exits with code `0`.

- [ ] **Step 4: Confirm component paths exist**

Run:

```powershell
Test-Path web\src\views\saas\tenant\resource-pack\index.vue
Test-Path web\src\views\saas\platform\resource-pack-order\index.vue
```

Expected:

```text
True
True
```

- [ ] **Step 5: Browser smoke check**

If the local backend, frontend, migration, and seed are running with the latest code:

1. Open `http://localhost:5731/#/tenant-saas/resource-packs`.
2. Click buy on a seeded resource pack.
3. Confirm the pending order panel appears.
4. Click local dev confirm.
5. Open `http://localhost:5731/#/tenant-saas/usage`.
6. Confirm the matching resource total quota increased.
7. Open `http://localhost:5731/#/saas-platform/resource-pack-orders`.
8. Confirm the resource-pack order appears.

If the running database has not applied new migrations/seeds, record that browser smoke requires migration execution and rely on automated tests/typechecks.

- [ ] **Step 6: Commit verification fixes when present**

If verification required fixes:

```powershell
git add server/src/module/saas server/src/migrations server/src/migration-specs web/src/api/saas.ts web/src/views/saas
git commit -m "fix: stabilize SaaS resource pack purchase flow"
```

If no fixes were required, do not create an empty commit.
