# SaaS Order And Payment Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build tenant resource-pack order history, platform resource-pack order details, and platform-managed Alipay configuration.

**Architecture:** Extend the existing SaaS module instead of introducing a new billing module. Resource-pack order listing stays in `SaasResourcePackOrderService`; platform orchestration stays in `SaasPlatformService`/`SaasPlatformController`; Alipay configuration gets a dedicated `saas_payment_config` table and service because secrets must be write-only in API responses. The existing payment service will resolve DB config first and fall back to environment config.

**Tech Stack:** NestJS 11, TypeORM, MySQL migrations, Jest, Vue 3, Element Plus, existing dynamic menu system, existing SaaS payment service.

## Global Constraints

- Do not implement refunds, invoices, exports, reconciliation jobs, or multiple payment providers.
- Do not return private key plaintext from any API.
- Public/private key fields in the UI must be blank on load; blank save means keep existing key.
- Payment service must read database Alipay config first and fall back to environment config when no database row exists.
- Existing resource-pack purchase and payment flow must continue working.
- Migrations must work for existing local databases, not only fresh installs.
- Use TDD for backend service, controller, and migration behavior.
- Preserve unrelated untracked `sdd/` files and frontend temp logs.

---

## File Structure

- Modify `server/src/module/saas/services/saas-resource-pack-order.service.ts`: tenant list, platform order-number filter, platform detail lookup.
- Modify `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`: service tests for tenant list, order number filter, detail lookup.
- Modify `server/src/module/saas/saas-tenant.controller.ts`: tenant order list route.
- Modify `server/src/module/saas/saas-tenant.controller.spec.ts`: tenant route tests.
- Modify `server/src/module/saas/services/saas-platform.service.ts`: platform order detail delegation.
- Modify `server/src/module/saas/services/saas-platform.service.spec.ts`: platform service tests.
- Modify `server/src/module/saas/saas-platform.controller.ts`: platform order detail and Alipay config routes.
- Modify `server/src/module/saas/saas-platform.controller.spec.ts`: platform route tests.
- Create `server/src/module/saas/entities/saas-payment-config.entity.ts`: Alipay config persistence.
- Create `server/src/module/saas/dto/update-alipay-config.dto.ts`: platform config update DTO.
- Create `server/src/module/saas/services/saas-payment-config.service.ts`: masked read/update and config resolution.
- Create `server/src/module/saas/services/saas-payment-config.service.spec.ts`: masking, blank key preservation, config resolution tests.
- Modify `server/src/module/saas/services/saas-payment.service.ts`: consume DB config service with env fallback.
- Modify `server/src/module/saas/services/saas-payment.service.spec.ts`: DB-preferred config tests.
- Modify `server/src/module/saas/saas.module.ts`: register entity/service.
- Create `server/src/migrations/1760000000009-CreateSaasPaymentConfigs.ts`: table migration.
- Create `server/src/migration-specs/create-saas-payment-configs.spec.ts`: table migration assertions.
- Create `server/src/migrations/1760000000010-AlignSaasPaymentConfigMenu.ts`: menu/permission migration.
- Create `server/src/migration-specs/align-saas-payment-config-menu.spec.ts`: menu/permission migration assertions.
- Modify `web/src/api/saas.ts`: new API wrappers and types.
- Modify `web/src/views/saas/tenant/resource-pack/index.vue`: order history section and pending-order actions.
- Modify `web/src/views/saas/platform/resource-pack-order/index.vue`: order number filter and detail drawer.
- Create `web/src/views/saas/platform/payment-config/index.vue`: platform Alipay configuration page.

## Task 1: Backend Resource-Pack Order Listing And Detail APIs

**Files:**
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.ts`
- Modify: `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`
- Modify: `server/src/module/saas/saas-tenant.controller.ts`
- Modify: `server/src/module/saas/saas-tenant.controller.spec.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.ts`
- Modify: `server/src/module/saas/services/saas-platform.service.spec.ts`
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`

**Interfaces:**
- Produces: `SaasResourcePackOrderService.listTenantOrders(tenantId, query)`
- Produces: `SaasResourcePackOrderService.findPlatformOrder(orderNo)`
- Produces: `GET /api/saas/tenant/resource-pack-orders`
- Produces: `GET /api/saas/platform/resource-pack-orders/:order_no`
- Extends: `SaasResourcePackOrderListQuery.order_no?: string`

- [ ] **Step 1: Write failing service tests**

Add tests to `server/src/module/saas/services/saas-resource-pack-order.service.spec.ts`:

```ts
it('lists tenant resource pack orders scoped to the current tenant', async () => {
  orderRepo.findAndCount.mockResolvedValue([
    [{ orderNo: 'RPO20260703120000001000001', tenantId: 12, resourcePackCode: 'tokens_1m', status: 'pending' }],
    1,
  ]);

  await expect(
    service.listTenantOrders(12, {
      page: '1',
      limit: '20',
      status: 'pending',
      resource_pack_code: 'tokens_1m',
    }),
  ).resolves.toMatchObject({ total: 1, page: 1, limit: 20 });

  expect(orderRepo.findAndCount).toHaveBeenCalledWith({
    where: {
      tenantId: 12,
      resourcePackCode: 'tokens_1m',
      status: 'pending',
    },
    order: { createTime: 'DESC', id: 'DESC' },
    skip: 0,
    take: 20,
  });
});

it('filters platform resource pack orders by order number', async () => {
  orderRepo.findAndCount.mockResolvedValue([
    [{ orderNo: 'RPO20260703120000001000001', tenantId: 12 }],
    1,
  ]);

  await service.listPlatformOrders({ order_no: 'RPO20260703120000001000001' });

  expect(orderRepo.findAndCount).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { orderNo: 'RPO20260703120000001000001' },
    }),
  );
});

it('finds a platform resource pack order by order number', async () => {
  orderRepo.findOne.mockResolvedValue({
    orderNo: 'RPO20260703120000001000001',
    tenantId: 12,
    resourcePackCode: 'tokens_1m',
  });

  await expect(service.findPlatformOrder('RPO20260703120000001000001')).resolves.toMatchObject({
    order_no: 'RPO20260703120000001000001',
    tenant_id: 12,
  });

  expect(orderRepo.findOne).toHaveBeenCalledWith({
    where: { orderNo: 'RPO20260703120000001000001' },
  });
});
```

- [ ] **Step 2: Run service test to verify it fails**

Run:

```powershell
cd server
pnpm run test -- saas-resource-pack-order.service.spec.ts --runInBand
```

Expected: FAIL because `listTenantOrders`, `findPlatformOrder`, and `order_no` query support do not exist.

- [ ] **Step 3: Implement service methods**

Modify `SaasResourcePackOrderListQuery`:

```ts
export interface SaasResourcePackOrderListQuery {
  page?: string | number;
  limit?: string | number;
  tenant_id?: string | number;
  order_no?: string;
  resource_pack_code?: string;
  resource_type?: string;
  status?: string;
}
```

Add:

```ts
async listTenantOrders(tenantId: number, query: SaasResourcePackOrderListQuery = {}) {
  const { page, limit, skip } = this.resolvePagination(query);
  const where: FindOptionsWhere<SaasResourcePackOrderEntity> = { tenantId };
  if (query.resource_pack_code) {
    where.resourcePackCode = query.resource_pack_code;
  }
  if (query.status) {
    where.status = query.status;
  }

  const [list, total] = await this.resourcePackOrderRepo.findAndCount({
    where,
    order: { createTime: 'DESC', id: 'DESC' },
    skip,
    take: limit,
  });

  return { list: list.map((order) => this.toResponse(order)), total, page, limit };
}
```

Update `listPlatformOrders`:

```ts
if (query.order_no) {
  where.orderNo = query.order_no;
}
```

Add:

```ts
async findPlatformOrder(orderNo: string) {
  const order = await this.resourcePackOrderRepo.findOne({ where: { orderNo } });
  return order ? this.toResponse(order) : null;
}
```

- [ ] **Step 4: Run service test to verify it passes**

Run:

```powershell
cd server
pnpm run test -- saas-resource-pack-order.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Write failing controller/service delegation tests**

In `server/src/module/saas/saas-tenant.controller.spec.ts`, add a test that calls `controller.resourcePackOrders({ status: 'pending' })` and expects `resourcePackOrderService.listTenantOrders(12, { status: 'pending' })`.

In `server/src/module/saas/services/saas-platform.service.spec.ts`, add:

```ts
it('delegates platform resource pack order detail lookup', async () => {
  resourcePackOrderService.findPlatformOrder.mockResolvedValue({ order_no: 'RPO1' });
  await expect(service.findResourcePackOrder('RPO1')).resolves.toEqual({ order_no: 'RPO1' });
  expect(resourcePackOrderService.findPlatformOrder).toHaveBeenCalledWith('RPO1');
});
```

In `server/src/module/saas/saas-platform.controller.spec.ts`, add a test for `controller.getResourcePackOrder('RPO1', user)` returning `ResultData.ok(...)`.

- [ ] **Step 6: Run controller tests to verify they fail**

Run:

```powershell
cd server
pnpm run test -- saas-tenant.controller.spec.ts --runInBand
pnpm run test -- saas-platform.service.spec.ts --runInBand
pnpm run test -- saas-platform.controller.spec.ts --runInBand
```

Expected: FAIL because routes/delegation do not exist.

- [ ] **Step 7: Implement routes and delegation**

Modify `saas-tenant.controller.ts` imports:

```ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { SaasResourcePackOrderListQuery } from './services/saas-resource-pack-order.service';
```

Add before `@Get('resource-pack-orders/:order_no')`:

```ts
@Get('resource-pack-orders')
@ApiOperation({ summary: 'List current tenant SaaS resource pack orders' })
async resourcePackOrders(@Query() query: SaasResourcePackOrderListQuery) {
  const tenantId = getTenantId();
  if (!tenantId) {
    return ResultData.fail(401, 'Tenant context is required');
  }

  return ResultData.ok(await this.saasResourcePackOrderService.listTenantOrders(tenantId, query));
}
```

Modify `saas-platform.service.ts`:

```ts
findResourcePackOrder(orderNo: string) {
  return this.resourcePackOrderService.findPlatformOrder(orderNo);
}
```

Modify `saas-platform.controller.ts` imports:

```ts
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
```

Add:

```ts
@Get('resource-pack-orders/:order_no')
@ApiOperation({ summary: 'Get SaaS resource pack order detail' })
@RequirePermission('saas:resource-pack-order:list')
getResourcePackOrder(@Param('order_no') orderNo: string, @User() user: UserDto) {
  return TenantContext.run(
    {
      tenantId: undefined,
      userId: user?.userId,
      ignoreAudit: false,
      ignoreTenant: true,
    },
    () => this.platformService.findResourcePackOrder(orderNo).then((data) => ResultData.ok(data)),
  );
}
```

- [ ] **Step 8: Run target backend tests**

Run:

```powershell
cd server
pnpm run test -- saas-resource-pack-order.service.spec.ts --runInBand
pnpm run test -- saas-tenant.controller.spec.ts --runInBand
pnpm run test -- saas-platform.service.spec.ts --runInBand
pnpm run test -- saas-platform.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

Run:

```powershell
git add server/src/module/saas/services/saas-resource-pack-order.service.ts server/src/module/saas/services/saas-resource-pack-order.service.spec.ts server/src/module/saas/saas-tenant.controller.ts server/src/module/saas/saas-tenant.controller.spec.ts server/src/module/saas/services/saas-platform.service.ts server/src/module/saas/services/saas-platform.service.spec.ts server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-platform.controller.spec.ts
git commit -m "feat: expose SaaS resource pack order operations"
```

## Task 2: Alipay Config Entity, Migration, And Service

**Files:**
- Create: `server/src/module/saas/entities/saas-payment-config.entity.ts`
- Create: `server/src/module/saas/dto/update-alipay-config.dto.ts`
- Create: `server/src/module/saas/services/saas-payment-config.service.ts`
- Create: `server/src/module/saas/services/saas-payment-config.service.spec.ts`
- Create: `server/src/migrations/1760000000009-CreateSaasPaymentConfigs.ts`
- Create: `server/src/migration-specs/create-saas-payment-configs.spec.ts`
- Modify: `server/src/module/saas/saas.module.ts`

**Interfaces:**
- Produces: `SaasPaymentConfigEntity`
- Produces: `UpdateAlipayConfigDto`
- Produces: `SaasPaymentConfigService.getAlipayConfigStatus()`
- Produces: `SaasPaymentConfigService.updateAlipayConfig(dto)`
- Produces: `SaasPaymentConfigService.resolveAlipayConfig()`

- [ ] **Step 1: Write failing service tests**

Create `server/src/module/saas/services/saas-payment-config.service.spec.ts` with tests for:

```ts
it('reports missing Alipay keys without exposing secret values', async () => {
  repo.findOne.mockResolvedValue({
    provider: 'alipay',
    scope: 'platform',
    enabled: 1,
    appId: '2026070200000001',
    privateKey: '',
    publicKey: '',
    gatewayUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
    notifyUrl: '',
    returnUrl: '',
  });

  await expect(service.getAlipayConfigStatus()).resolves.toMatchObject({
    provider: 'alipay',
    enabled: true,
    configured: false,
    app_id_masked: '2026********0001',
    private_key_configured: false,
    public_key_configured: false,
  });
});

it('keeps existing keys when update payload leaves key fields blank', async () => {
  repo.findOne.mockResolvedValue({
    id: 1,
    provider: 'alipay',
    scope: 'platform',
    enabled: 1,
    appId: 'old-app-id',
    privateKey: 'old-private',
    publicKey: 'old-public',
    gatewayUrl: 'old-gateway',
    notifyUrl: 'old-notify',
    returnUrl: 'old-return',
  });
  repo.save.mockImplementation(async (value) => value);

  await service.updateAlipayConfig({
    enabled: true,
    app_id: 'new-app-id',
    private_key: '',
    public_key: '',
    gateway_url: 'new-gateway',
    notify_url: 'new-notify',
    return_url: 'new-return',
  });

  expect(repo.save).toHaveBeenCalledWith(
    expect.objectContaining({
      appId: 'new-app-id',
      privateKey: 'old-private',
      publicKey: 'old-public',
      gatewayUrl: 'new-gateway',
    }),
  );
});

it('resolves null when no database config row exists', async () => {
  repo.findOne.mockResolvedValue(null);
  await expect(service.resolveAlipayConfig()).resolves.toBeNull();
});
```

- [ ] **Step 2: Run service test to verify it fails**

Run:

```powershell
cd server
pnpm run test -- saas-payment-config.service.spec.ts --runInBand
```

Expected: FAIL because files do not exist.

- [ ] **Step 3: Create entity and DTO**

Create `saas-payment-config.entity.ts`:

```ts
import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Index('uk_saas_payment_config_provider_scope', ['provider', 'scope'], { unique: true })
@Entity('saas_payment_config', { comment: 'SaaS payment provider configs' })
export class SaasPaymentConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'provider', length: 20 })
  provider: string;

  @Column({ type: 'varchar', name: 'scope', length: 20, default: 'platform' })
  scope: string;

  @Column({ type: 'tinyint', name: 'enabled', default: 0 })
  enabled: number;

  @Column({ type: 'varchar', name: 'app_id', length: 64, nullable: true })
  appId?: string;

  @Column({ type: 'text', name: 'private_key', nullable: true })
  privateKey?: string;

  @Column({ type: 'text', name: 'public_key', nullable: true })
  publicKey?: string;

  @Column({ type: 'varchar', name: 'gateway_url', length: 255, nullable: true })
  gatewayUrl?: string;

  @Column({ type: 'varchar', name: 'notify_url', length: 255, nullable: true })
  notifyUrl?: string;

  @Column({ type: 'varchar', name: 'return_url', length: 255, nullable: true })
  returnUrl?: string;

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

Create `update-alipay-config.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAlipayConfigDto {
  @ApiProperty({ required: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  app_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  private_key?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  public_key?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  gateway_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notify_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  return_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}
```

- [ ] **Step 4: Create migration and migration spec**

Create migration with:

```sql
CREATE TABLE `saas_payment_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `provider` varchar(20) NOT NULL,
  `scope` varchar(20) NOT NULL DEFAULT 'platform',
  `enabled` tinyint NOT NULL DEFAULT 0,
  `app_id` varchar(64) NULL,
  `private_key` text NULL,
  `public_key` text NULL,
  `gateway_url` varchar(255) NULL,
  `notify_url` varchar(255) NULL,
  `return_url` varchar(255) NULL,
  `remark` varchar(255) NULL,
  `create_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `update_time` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `delete_time` datetime NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_saas_payment_config_provider_scope` (`provider`, `scope`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

Migration spec must assert table name, private key column, and unique key.

- [ ] **Step 5: Implement service and module registration**

`SaasPaymentConfigService` constants:

```ts
export const SAAS_PAYMENT_PROVIDER_ALIPAY = 'alipay';
export const SAAS_PAYMENT_SCOPE_PLATFORM = 'platform';
export const ALIPAY_DEFAULT_GATEWAY = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
```

Return resolver type:

```ts
export interface ResolvedAlipayConfig {
  enabled: boolean;
  appId: string;
  privateKey: string;
  publicKey: string;
  notifyUrl: string;
  returnUrl: string;
  gatewayUrl: string;
  source: 'database';
}
```

Implement:

```ts
async resolveAlipayConfig(): Promise<ResolvedAlipayConfig | null> {
  const config = await this.findAlipayConfig();
  if (!config) return null;
  return {
    enabled: config.enabled === 1,
    appId: config.appId || '',
    privateKey: config.privateKey || '',
    publicKey: config.publicKey || '',
    notifyUrl: config.notifyUrl || '',
    returnUrl: config.returnUrl || '',
    gatewayUrl: config.gatewayUrl || ALIPAY_DEFAULT_GATEWAY,
    source: 'database',
  };
}
```

Implement masking and `missing_keys` with the same key names used by current payment service.

Register `SaasPaymentConfigEntity` in `TypeOrmModule.forFeature([...])` and add `SaasPaymentConfigService` to providers/exports as needed.

- [ ] **Step 6: Run target tests**

Run:

```powershell
cd server
pnpm run test -- saas-payment-config.service.spec.ts --runInBand
pnpm run test -- create-saas-payment-configs.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add server/src/module/saas/entities/saas-payment-config.entity.ts server/src/module/saas/dto/update-alipay-config.dto.ts server/src/module/saas/services/saas-payment-config.service.ts server/src/module/saas/services/saas-payment-config.service.spec.ts server/src/module/saas/saas.module.ts server/src/migrations/1760000000009-CreateSaasPaymentConfigs.ts server/src/migration-specs/create-saas-payment-configs.spec.ts
git commit -m "feat: add SaaS payment config storage"
```

## Task 3: Platform Alipay Config APIs And Payment Service Resolution

**Files:**
- Modify: `server/src/module/saas/services/saas-payment.service.ts`
- Modify: `server/src/module/saas/services/saas-payment.service.spec.ts`
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`

**Interfaces:**
- Produces: `GET /api/saas/platform/payment/alipay/config`
- Produces: `PUT /api/saas/platform/payment/alipay/config`
- Consumes: `SaasPaymentConfigService.resolveAlipayConfig()`
- Consumes: `SaasPaymentConfigService.getAlipayConfigStatus()`
- Consumes: `SaasPaymentConfigService.updateAlipayConfig(dto)`

- [ ] **Step 1: Write failing payment service test**

Add to `saas-payment.service.spec.ts`:

```ts
it('uses database Alipay config before environment config', async () => {
  paymentConfigService.resolveAlipayConfig.mockResolvedValue({
    enabled: true,
    appId: '2026070200000001',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    notifyUrl: 'http://db-notify/api/saas/payment/alipay/notify',
    returnUrl: 'http://db-return/#/tenant-saas/plan',
    gatewayUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
    source: 'database',
  });
  orderService.findTenantOrder.mockResolvedValue({
    orderNo: 'SO20260702000000001000002',
    tenantId: 12,
    amountCents: 19900,
    planCode: 'pro',
    status: 'pending',
  });

  const result = await service.createAlipayPayment(12, 'SO20260702000000001000002');
  const payUrl = new URL(result.pay_url || '');

  expect(payUrl.searchParams.get('notify_url')).toBe('http://db-notify/api/saas/payment/alipay/notify');
});
```

- [ ] **Step 2: Run payment service test to verify it fails**

Run:

```powershell
cd server
pnpm run test -- saas-payment.service.spec.ts --runInBand
```

Expected: FAIL because `SaasPaymentService` does not inject/use payment config service.

- [ ] **Step 3: Update payment service**

Inject `SaasPaymentConfigService`:

```ts
private readonly paymentConfigService: SaasPaymentConfigService,
```

Make `getAlipayConfig` async or add `resolveAlipayConfig`:

```ts
private async resolveAlipayConfig(): Promise<AlipayConfig> {
  const dbConfig = await this.paymentConfigService.resolveAlipayConfig();
  if (dbConfig) {
    return {
      enabled: dbConfig.enabled,
      appId: dbConfig.appId,
      privateKey: dbConfig.privateKey,
      publicKey: dbConfig.publicKey,
      notifyUrl: dbConfig.notifyUrl,
      returnUrl: dbConfig.returnUrl,
      gatewayUrl: dbConfig.gatewayUrl,
    };
  }
  return this.getEnvironmentAlipayConfig();
}
```

Update `createAlipayPayment` to `await this.resolveAlipayConfig()`.

Update `getAlipayConfigStatus` to return DB status when a DB row exists; fallback to env status otherwise. Keep existing response shape for tenant pages.

Update `verifyAlipayNotify` carefully: it is synchronous today. Either:

- Keep using environment public key for notify in this slice and document DB notify verification as not yet used, or
- Make controller await an async `verifyAlipayNotify`.

Preferred: make `verifyAlipayNotify` async so DB public key works consistently.

- [ ] **Step 4: Update payment controller tests if verify becomes async**

If `verifyAlipayNotify` becomes async, update mocks:

```ts
saasPaymentService.verifyAlipayNotify.mockResolvedValue(true);
```

And controller:

```ts
if (!(await this.saasPaymentService.verifyAlipayNotify(body))) {
  return 'fail';
}
```

- [ ] **Step 5: Write failing platform controller config tests**

In `saas-platform.controller.spec.ts`, add tests that:

- `getAlipayConfig(user)` calls `paymentConfigService.getAlipayConfigStatus()`.
- `updateAlipayConfig(body, user)` calls `paymentConfigService.updateAlipayConfig(body)`.

- [ ] **Step 6: Implement platform config routes**

Inject `SaasPaymentConfigService` into `SaasPlatformController`.

Add:

```ts
@Get('payment/alipay/config')
@ApiOperation({ summary: 'Get platform Alipay config status' })
@RequirePermission('saas:payment-config:view')
getAlipayConfig(@User() user: UserDto) {
  return TenantContext.run(
    { tenantId: undefined, userId: user?.userId, ignoreAudit: false, ignoreTenant: true },
    () => this.paymentConfigService.getAlipayConfigStatus().then((data) => ResultData.ok(data)),
  );
}

@Put('payment/alipay/config')
@ApiOperation({ summary: 'Update platform Alipay config' })
@RequirePermission('saas:payment-config:update')
updateAlipayConfig(@Body() body: UpdateAlipayConfigDto, @User() user: UserDto) {
  return TenantContext.run(
    { tenantId: undefined, userId: user?.userId, ignoreAudit: false, ignoreTenant: true },
    () => this.paymentConfigService.updateAlipayConfig(body).then((data) => ResultData.ok(data)),
  );
}
```

- [ ] **Step 7: Run payment and platform tests**

Run:

```powershell
cd server
pnpm run test -- saas-payment.service.spec.ts --runInBand
pnpm run test -- saas-payment.controller.spec.ts --runInBand
pnpm run test -- saas-platform.controller.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

Run:

```powershell
git add server/src/module/saas/services/saas-payment.service.ts server/src/module/saas/services/saas-payment.service.spec.ts server/src/module/saas/saas-payment.controller.ts server/src/module/saas/saas-payment.controller.spec.ts server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-platform.controller.spec.ts
git commit -m "feat: manage SaaS Alipay configuration"
```

## Task 4: Menu And Permission Migration For Payment Config

**Files:**
- Create: `server/src/migrations/1760000000010-AlignSaasPaymentConfigMenu.ts`
- Create: `server/src/migration-specs/align-saas-payment-config-menu.spec.ts`

**Interfaces:**
- Produces platform menu:
  - code `SaasPaymentConfig`
  - path `payment-config`
  - component `/saas/platform/payment-config`
- Produces permissions:
  - `saas:payment-config:view`
  - `saas:payment-config:update`

- [ ] **Step 1: Write failing migration spec**

Create test that runs `new AlignSaasPaymentConfigMenu1760000000010().up(queryRunner)` and asserts params include:

```ts
expect(params).toContain('SaasPaymentConfig');
expect(params).toContain('payment-config');
expect(params).toContain('/saas/platform/payment-config');
expect(params).toContain('saas:payment-config:view');
expect(params).toContain('saas:payment-config:update');
```

- [ ] **Step 2: Run migration spec to verify it fails**

Run:

```powershell
cd server
pnpm run test -- align-saas-payment-config-menu.spec.ts --runInBand
```

Expected: FAIL because migration does not exist.

- [ ] **Step 3: Implement idempotent migration**

Use the same `insertChildMenu` and `insertPermission` pattern as prior SaaS align migrations. Parent code is `SaasManage`.

Menu:

```ts
{
  name: 'Alipay Config',
  code: 'SaasPaymentConfig',
  type: 2,
  path: 'payment-config',
  component: '/saas/platform/payment-config',
  icon: 'ri:secure-payment-line',
  sort: 70,
  remark: 'Seeded SaaS Alipay config menu',
}
```

Permissions:

```ts
{ parentCode: 'SaasPaymentConfig', name: 'View', slug: 'saas:payment-config:view', method: 'GET', sort: 10 }
{ parentCode: 'SaasPaymentConfig', name: 'Update', slug: 'saas:payment-config:update', method: 'PUT', sort: 20 }
```

- [ ] **Step 4: Run migration spec**

Run:

```powershell
cd server
pnpm run test -- align-saas-payment-config-menu.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```powershell
git add server/src/migrations/1760000000010-AlignSaasPaymentConfigMenu.ts server/src/migration-specs/align-saas-payment-config-menu.spec.ts
git commit -m "feat: add SaaS payment config menu seed"
```

## Task 5: Frontend API Wrappers And Tenant Order History UI

**Files:**
- Modify: `web/src/api/saas.ts`
- Modify: `web/src/views/saas/tenant/resource-pack/index.vue`

**Interfaces:**
- Consumes: `GET /api/saas/tenant/resource-pack-orders`
- Consumes: existing payment create/dev-confirm APIs
- Produces: tenant order history table with pending-order actions

- [ ] **Step 1: Add API types and wrappers**

Modify `web/src/api/saas.ts`:

```ts
export interface TenantResourcePackOrderListParams {
  page?: number
  limit?: number
  resource_pack_code?: string
  status?: string
}

export function fetchTenantResourcePackOrders(params: TenantResourcePackOrderListParams) {
  return request.get<SaasPlatformPageResult<SaasResourcePackOrderRecord>>({
    url: '/api/saas/tenant/resource-pack-orders',
    params
  })
}
```

- [ ] **Step 2: Update tenant resource-pack page state**

Add:

```ts
const orderHistory = ref<SaasResourcePackOrderRecord[]>([])
const orderHistoryLoading = ref(false)
const orderFilters = reactive({
  resource_pack_code: '',
  status: ''
})
const orderPager = reactive({
  page: 1,
  limit: 10,
  total: 0
})
```

Add:

```ts
async function loadOrderHistory() {
  orderHistoryLoading.value = true
  try {
    const result = await fetchTenantResourcePackOrders({
      page: orderPager.page,
      limit: orderPager.limit,
      resource_pack_code: orderFilters.resource_pack_code || undefined,
      status: orderFilters.status || undefined
    })
    orderHistory.value = result.list || []
    orderPager.total = Number(result.total) || 0
  } finally {
    orderHistoryLoading.value = false
  }
}
```

Update order create and payment confirm paths to call `await loadOrderHistory()`.

- [ ] **Step 3: Add tenant order history markup**

Add below current order panel:

```vue
<section class="tenant-resource-pack-page__orders">
  <div class="tenant-resource-pack-page__section-header">
    <div>
      <h2 class="tenant-resource-pack-page__section-title">资源包订单记录</h2>
      <p class="tenant-resource-pack-page__remark">查看历史购买、支付和发放状态。</p>
    </div>
    <ElButton :loading="orderHistoryLoading" @click="loadOrderHistory">刷新</ElButton>
  </div>
  <div class="tenant-resource-pack-page__filters">
    <ElInput v-model="orderFilters.resource_pack_code" clearable placeholder="资源包编码" />
    <ElSelect v-model="orderFilters.status" clearable placeholder="状态">
      <ElOption label="待支付" value="pending" />
      <ElOption label="已支付" value="paid" />
      <ElOption label="已关闭" value="closed" />
    </ElSelect>
    <ElButton type="primary" :loading="orderHistoryLoading" @click="refreshOrderHistory">查询</ElButton>
  </div>
  <ElTable v-loading="orderHistoryLoading" :data="orderHistory" border>
    ...
  </ElTable>
  <ElPagination ... />
</section>
```

Action column:

```vue
<ElButton
  v-if="row.status === 'pending'"
  type="primary"
  link
  @click="resumeOrderPayment(row)"
>
  继续支付
</ElButton>
<ElButton
  v-if="row.status === 'pending'"
  type="success"
  link
  @click="confirmHistoryOrder(row)"
>
  模拟确认
</ElButton>
```

- [ ] **Step 4: Add tenant order action methods**

```ts
async function resumeOrderPayment(order: SaasResourcePackOrderRecord) {
  currentOrder.value = order
  await startAlipayPayment()
}

async function confirmHistoryOrder(order: SaasResourcePackOrderRecord) {
  currentOrder.value = order
  await confirmDevPayment()
}

function refreshOrderHistory() {
  orderPager.page = 1
  loadOrderHistory()
}
```

Call `loadOrderHistory()` in `onMounted`.

- [ ] **Step 5: Run frontend typecheck**

Run:

```powershell
cd web
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

Run:

```powershell
git add web/src/api/saas.ts web/src/views/saas/tenant/resource-pack/index.vue
git commit -m "feat: add tenant SaaS resource pack order history"
```

## Task 6: Platform Order Detail And Alipay Config UI

**Files:**
- Modify: `web/src/api/saas.ts`
- Modify: `web/src/views/saas/platform/resource-pack-order/index.vue`
- Create: `web/src/views/saas/platform/payment-config/index.vue`

**Interfaces:**
- Consumes: `GET /api/saas/platform/resource-pack-orders/:order_no`
- Consumes: `GET /api/saas/platform/payment/alipay/config`
- Consumes: `PUT /api/saas/platform/payment/alipay/config`

- [ ] **Step 1: Add frontend API wrappers**

Add to `web/src/api/saas.ts`:

```ts
export interface PlatformAlipayConfigStatus {
  provider: 'alipay'
  enabled: boolean
  configured: boolean
  missing_keys: string[]
  app_id_masked: string
  gateway_url: string
  notify_url: string
  return_url: string
  private_key_configured: boolean
  public_key_configured: boolean
  remark?: string
}

export interface UpdatePlatformAlipayConfigParams {
  enabled: boolean
  app_id?: string
  private_key?: string
  public_key?: string
  gateway_url?: string
  notify_url?: string
  return_url?: string
  remark?: string
}

export function fetchPlatformResourcePackOrder(orderNo: string) {
  return request.get<SaasResourcePackOrderRecord | null>({
    url: `/api/saas/platform/resource-pack-orders/${orderNo}`
  })
}

export function fetchPlatformAlipayConfig() {
  return request.get<PlatformAlipayConfigStatus>({
    url: '/api/saas/platform/payment/alipay/config'
  })
}

export function updatePlatformAlipayConfig(params: UpdatePlatformAlipayConfigParams) {
  return request.put<PlatformAlipayConfigStatus>({
    url: '/api/saas/platform/payment/alipay/config',
    data: params
  })
}
```

- [ ] **Step 2: Add platform order detail drawer**

Modify `resource-pack-order/index.vue`:

State:

```ts
const detailVisible = ref(false)
const detailLoading = ref(false)
const currentDetail = ref<SaasResourcePackOrderRecord | null>(null)
```

Add `order_no` to filters and query.

Method:

```ts
async function openOrderDetail(row: SaasResourcePackOrderRecord) {
  detailVisible.value = true
  detailLoading.value = true
  try {
    currentDetail.value = await fetchPlatformResourcePackOrder(row.order_no)
  } finally {
    detailLoading.value = false
  }
}
```

Add an operation table column with a `详情` button.

Add `ElDrawer` with `ElDescriptions` for order fields. Do not nest cards inside the drawer.

- [ ] **Step 3: Create platform payment config page**

Create `web/src/views/saas/platform/payment-config/index.vue`.

Use:

```vue
<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-payment-config-page">
      <template #header>
        <div class="saas-payment-config-page__header">
          <div>
            <h1 class="saas-payment-config-page__title">支付宝配置</h1>
            <p class="saas-payment-config-page__subtitle">配置 SaaS 订单支付使用的支付宝参数。</p>
          </div>
          <ElButton :loading="loading" @click="loadConfig">刷新</ElButton>
        </div>
      </template>
      ...
    </ElCard>
  </div>
</template>
```

Form state:

```ts
const form = reactive({
  enabled: false,
  app_id: '',
  private_key: '',
  public_key: '',
  gateway_url: '',
  notify_url: '',
  return_url: '',
  remark: ''
})
```

On load:

```ts
form.enabled = status.enabled
form.app_id = ''
form.private_key = ''
form.public_key = ''
form.gateway_url = status.gateway_url
form.notify_url = status.notify_url
form.return_url = status.return_url
form.remark = status.remark || ''
```

After save, clear key fields and reload status.

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
git add web/src/api/saas.ts web/src/views/saas/platform/resource-pack-order/index.vue web/src/views/saas/platform/payment-config/index.vue
git commit -m "feat: add SaaS payment operations UI"
```

## Task 7: Final Verification And Local Smoke

**Files:**
- Modify only files needed to fix verification defects.

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

Expected:

- `CreateSaasPaymentConfigs1760000000009` executed if not already loaded.
- `AlignSaasPaymentConfigMenu1760000000010` executed if not already loaded.

- [ ] **Step 5: Clear local menu cache when needed**

Run if browser still shows 404 after migration:

```powershell
redis-cli -h 127.0.0.1 -p 6379 KEYS "sys_menu:*"
redis-cli -h 127.0.0.1 -p 6379 DEL "sys_menu:1:1"
```

Adjust cache key to the current tenant/user key if different.

- [ ] **Step 6: Browser smoke check**

Use current local app:

1. Open `http://localhost:5731/#/tenant-saas/resource-packs`.
2. Confirm order history section loads.
3. Create a resource-pack order.
4. Confirm it appears as pending in history.
5. Click local simulated confirmation from the history row.
6. Open `http://localhost:5731/#/saas-platform/resource-pack-orders`.
7. Filter by the created order number.
8. Open detail drawer and confirm status/payment/delivery fields.
9. Open `http://localhost:5731/#/saas-platform/payment-config`.
10. Save non-secret fields with blank key fields and confirm secrets are not displayed.

- [ ] **Step 7: Commit verification fixes if any**

If verification required fixes:

```powershell
git add server/src/module/saas server/src/migrations server/src/migration-specs web/src/api/saas.ts web/src/views/saas
git commit -m "fix: stabilize SaaS order payment operations"
```

If no fixes were required, do not create an empty commit.
