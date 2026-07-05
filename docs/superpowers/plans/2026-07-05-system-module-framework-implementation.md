# System Module Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lower-level system module framework that can register built-in modules now and support metadata-only plugin modules next, without replacing the existing SaaS product module market.

**Architecture:** Create a new backend package at `server/src/module/system-module` with its own registry entities, manifest constants, lifecycle service, access service, and platform/tenant controllers. Keep `saas_module` as the commercial product module catalog and derive tenant system-module availability from existing SaaS plan features until a bridge table is introduced. Add frontend API/types and management pages for platform admins and tenant admins.

**Tech Stack:** NestJS, TypeORM, Jest, Vue 3, Element Plus, TypeScript, MySQL migrations, existing `RequirePermission` and `TenantContext` patterns.

---

## File Structure

### Backend

- Create: `server/src/module/system-module/entities/system-module.entity.ts`
  - Owns the `system_module` registry row and lifecycle fields.
- Create: `server/src/module/system-module/entities/system-module-dependency.entity.ts`
  - Stores dependency edges between system modules.
- Create: `server/src/module/system-module/entities/system-module-menu.entity.ts`
  - Maps a module code to existing `sa_system_menu.id` rows.
- Create: `server/src/module/system-module/entities/system-module-permission.entity.ts`
  - Maps a module code to permission slugs.
- Create: `server/src/module/system-module/entities/system-module-api.entity.ts`
  - Registers API endpoints owned or guarded by a module.
- Create: `server/src/module/system-module/entities/system-tenant-module.entity.ts`
  - Stores tenant-level module availability and tenant config.
- Create: `server/src/module/system-module/entities/system-module-event.entity.ts`
  - Stores lifecycle and health audit events.
- Create: `server/src/module/system-module/constants.ts`
  - Defines lifecycle/source/health constants used by DTOs, entities, and services.
- Create: `server/src/module/system-module/manifests/built-in-modules.ts`
  - Defines code-owned built-in manifests as TypeScript constants.
- Create: `server/src/module/system-module/dto/save-system-module.dto.ts`
  - Defines platform status/config/register DTOs.
- Create: `server/src/module/system-module/dto/plugin-module-manifest.dto.ts`
  - Defines metadata-only plugin manifest validation.
- Create: `server/src/module/system-module/services/system-module-registry.service.ts`
  - Imports manifests idempotently, lists modules, reads details, updates status/config, records events.
- Create: `server/src/module/system-module/services/system-module-access.service.ts`
  - Provides `assertModuleAccess` with module, dependency, tenant, SaaS bridge, and permission gates.
- Create: `server/src/module/system-module/system-module-platform.controller.ts`
  - Platform admin APIs under `/api/system/modules`.
- Create: `server/src/module/system-module/system-module-tenant.controller.ts`
  - Tenant admin APIs under `/api/tenant/modules`.
- Create: `server/src/module/system-module/system-module.module.ts`
  - Registers entities, controllers, services, and exports services.
- Modify: `server/src/module/system/system.module.ts`
  - Import and export `SystemModuleRegistryModule`.
- Modify: `server/src/module/saas/saas.module.ts`
  - Import `SystemModuleRegistryModule` after access service starts deriving from SaaS plans.
- Create: `server/src/migrations/1760000000020-CreateSystemModules.ts`
  - Creates all system module registry tables and useful indexes.
- Create: `server/src/migrations/1760000000021-SeedSystemModules.ts`
  - Seeds platform/tenant module management menus and permissions.
- Create: `server/src/module/system-module/services/system-module-registry.service.spec.ts`
  - Covers idempotent registration, list/detail, status lifecycle, events.
- Create: `server/src/module/system-module/services/system-module-access.service.spec.ts`
  - Covers access gates, tenant spoof prevention, SaaS bridge derivation, denied access cases.
- Create: `server/src/module/system-module/system-module-platform.controller.spec.ts`
  - Covers platform endpoint permissions and `TenantContext.run(...ignoreTenant: true...)`.
- Create: `server/src/module/system-module/system-module-tenant.controller.spec.ts`
  - Covers tenant context source and no body/query tenant override.
- Create: `server/src/migration-specs/create-system-modules.spec.ts`
  - Covers migration SQL creation and rollback intent.
- Create: `server/src/migration-specs/seed-system-modules.spec.ts`
  - Covers seeded menus/permissions and admin role grants.

### Frontend

- Create: `web/src/api/system-module.ts`
  - API clients and types for platform and tenant module endpoints.
- Create: `web/src/views/system/modules/index.vue`
  - Platform module list, status controls, health/event summary entry.
- Create: `web/src/views/system/modules/detail.vue`
  - Module detail with manifest, dependencies, permissions, APIs, events.
- Create: `web/src/views/saas/tenant/modules/index.vue`
  - Tenant-visible module list and tenant config/status surface.
- Modify through migration only: menu entries for `/system/modules`, `/system/modules/detail`, and `/tenant-saas/modules`.
  - The existing menu system resolves routes dynamically from `sa_system_menu`.

---

## P0 - Registry Foundation

### Task 1: Create registry tables and entity classes

**Files:**
- Create: `server/src/migrations/1760000000020-CreateSystemModules.ts`
- Create: `server/src/module/system-module/entities/system-module.entity.ts`
- Create: `server/src/module/system-module/entities/system-module-dependency.entity.ts`
- Create: `server/src/module/system-module/entities/system-module-menu.entity.ts`
- Create: `server/src/module/system-module/entities/system-module-permission.entity.ts`
- Create: `server/src/module/system-module/entities/system-module-api.entity.ts`
- Create: `server/src/module/system-module/entities/system-tenant-module.entity.ts`
- Create: `server/src/module/system-module/entities/system-module-event.entity.ts`
- Create: `server/src/module/system-module/constants.ts`
- Test: `server/src/migration-specs/create-system-modules.spec.ts`

- [ ] **Step 1: Write the migration test**

```ts
// server/src/migration-specs/create-system-modules.spec.ts
import { CreateSystemModules1760000000020 } from '../migrations/1760000000020-CreateSystemModules';

describe('CreateSystemModules1760000000020', () => {
  const queries: string[] = [];
  const queryRunner = {
    query: jest.fn((sql: string) => {
      queries.push(sql);
      return Promise.resolve();
    }),
  } as any;

  beforeEach(() => {
    queries.length = 0;
    queryRunner.query.mockClear();
  });

  it('creates the system module registry tables', async () => {
    await new CreateSystemModules1760000000020().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `system_module`');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `system_module_dependency`');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `system_module_menu`');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `system_module_permission`');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `system_module_api`');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `system_tenant_module`');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `system_module_event`');
    expect(sql).toContain('UNIQUE KEY `uk_system_module_code` (`code`)');
  });

  it('drops registry tables in dependency-safe order', async () => {
    await new CreateSystemModules1760000000020().down(queryRunner);

    expect(queries[0]).toContain('DROP TABLE IF EXISTS `system_module_event`');
    expect(queries.at(-1)).toContain('DROP TABLE IF EXISTS `system_module`');
  });
});
```

- [ ] **Step 2: Run the focused migration test and confirm it fails**

Run:

```powershell
cd server
pnpm.cmd exec jest src/migration-specs/create-system-modules.spec.ts --runInBand
```

Expected: FAIL because `../migrations/1760000000020-CreateSystemModules` does not exist.

- [ ] **Step 3: Add constants**

```ts
// server/src/module/system-module/constants.ts
export const SYSTEM_MODULE_SOURCES = ['built_in', 'plugin', 'extension'] as const;
export type SystemModuleSource = (typeof SYSTEM_MODULE_SOURCES)[number];

export const SYSTEM_MODULE_STATUSES = [
  'draft',
  'installed',
  'enabled',
  'disabled',
  'upgrading',
  'failed',
  'uninstalled',
] as const;
export type SystemModuleStatus = (typeof SYSTEM_MODULE_STATUSES)[number];

export const SYSTEM_MODULE_HEALTH_STATUSES = ['unknown', 'healthy', 'degraded', 'failed'] as const;
export type SystemModuleHealthStatus = (typeof SYSTEM_MODULE_HEALTH_STATUSES)[number];

export const SYSTEM_TENANT_MODULE_SOURCES = ['platform', 'plan', 'plugin', 'manual'] as const;
export type SystemTenantModuleSource = (typeof SYSTEM_TENANT_MODULE_SOURCES)[number];

export const SYSTEM_MODULE_EVENT_TYPES = [
  'install',
  'enable',
  'disable',
  'upgrade',
  'health_check',
  'config_update',
  'uninstall',
] as const;
export type SystemModuleEventType = (typeof SYSTEM_MODULE_EVENT_TYPES)[number];
```

- [ ] **Step 4: Add the core entity**

```ts
// server/src/module/system-module/entities/system-module.entity.ts
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { SystemModuleHealthStatus, SystemModuleSource, SystemModuleStatus } from '../constants';

@Index('uk_system_module_code', ['code'], { unique: true })
@Entity('system_module', { comment: 'System module registry' })
export class SystemModuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'code', length: 80 })
  code: string;

  @Column({ type: 'varchar', name: 'name', length: 120 })
  name: string;

  @Column({ type: 'varchar', name: 'source', length: 20 })
  source: SystemModuleSource;

  @Column({ type: 'varchar', name: 'version', length: 40, default: '1.0.0' })
  version: string;

  @Column({ type: 'varchar', name: 'description', length: 500, default: '' })
  description: string;

  @Column({ type: 'varchar', name: 'category', length: 50, default: '' })
  category: string;

  @Column({ type: 'varchar', name: 'icon', length: 100, default: '' })
  icon: string;

  @Column({ type: 'varchar', name: 'status', length: 20, default: 'installed' })
  status: SystemModuleStatus;

  @Column({ type: 'varchar', name: 'entry_route', length: 255, default: '' })
  entryRoute: string;

  @Column({ type: 'json', name: 'manifest', nullable: true })
  manifest?: Record<string, any>;

  @Column({ type: 'json', name: 'config_schema', nullable: true })
  configSchema?: Record<string, any>;

  @Column({ type: 'varchar', name: 'health_status', length: 20, default: 'unknown' })
  healthStatus: SystemModuleHealthStatus;

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

- [ ] **Step 5: Add binding and event entities**

```ts
// server/src/module/system-module/entities/system-module-dependency.entity.ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index('idx_system_module_dependency_module', ['moduleCode'])
@Index('uk_system_module_dependency_pair', ['moduleCode', 'dependsOnCode'], { unique: true })
@Entity('system_module_dependency', { comment: 'System module dependencies' })
export class SystemModuleDependencyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'module_code', length: 80 })
  moduleCode: string;

  @Column({ type: 'varchar', name: 'depends_on_code', length: 80 })
  dependsOnCode: string;

  @Column({ type: 'varchar', name: 'version_range', length: 80, default: '' })
  versionRange: string;

  @Column({ type: 'tinyint', name: 'required', default: 1 })
  required: number;
}
```

```ts
// server/src/module/system-module/entities/system-module-menu.entity.ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index('idx_system_module_menu_module', ['moduleCode'])
@Index('uk_system_module_menu_pair', ['moduleCode', 'menuId'], { unique: true })
@Entity('system_module_menu', { comment: 'System module menu bindings' })
export class SystemModuleMenuEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'module_code', length: 80 })
  moduleCode: string;

  @Column({ type: 'bigint', name: 'menu_id' })
  menuId: number;

  @Column({ type: 'varchar', name: 'binding_type', length: 20, default: 'owned' })
  bindingType: 'owned' | 'required' | 'optional';
}
```

```ts
// server/src/module/system-module/entities/system-module-permission.entity.ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index('idx_system_module_permission_module', ['moduleCode'])
@Index('uk_system_module_permission_pair', ['moduleCode', 'permissionSlug'], { unique: true })
@Entity('system_module_permission', { comment: 'System module permission bindings' })
export class SystemModulePermissionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'module_code', length: 80 })
  moduleCode: string;

  @Column({ type: 'varchar', name: 'permission_slug', length: 120 })
  permissionSlug: string;

  @Column({ type: 'varchar', name: 'binding_type', length: 20, default: 'owned' })
  bindingType: 'owned' | 'required' | 'optional';
}
```

```ts
// server/src/module/system-module/entities/system-module-api.entity.ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index('idx_system_module_api_module', ['moduleCode'])
@Index('idx_system_module_api_route', ['method', 'path'])
@Entity('system_module_api', { comment: 'System module API bindings' })
export class SystemModuleApiEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'module_code', length: 80 })
  moduleCode: string;

  @Column({ type: 'varchar', name: 'method', length: 10 })
  method: string;

  @Column({ type: 'varchar', name: 'path', length: 255 })
  path: string;

  @Column({ type: 'varchar', name: 'permission_slug', length: 120, default: '' })
  permissionSlug: string;

  @Column({ type: 'tinyint', name: 'tenant_scoped', default: 0 })
  tenantScoped: number;
}
```

```ts
// server/src/module/system-module/entities/system-tenant-module.entity.ts
import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import type { SystemTenantModuleSource } from '../constants';

@Index('uk_system_tenant_module_pair', ['tenantId', 'moduleCode'], { unique: true })
@Entity('system_tenant_module', { comment: 'Tenant system module availability' })
export class SystemTenantModuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'varchar', name: 'module_code', length: 80 })
  moduleCode: string;

  @Column({ type: 'tinyint', name: 'enabled', default: 1 })
  enabled: number;

  @Column({ type: 'varchar', name: 'source', length: 20, default: 'platform' })
  source: SystemTenantModuleSource;

  @Column({ type: 'json', name: 'config', nullable: true })
  config?: Record<string, any>;

  @Column({ type: 'datetime', name: 'start_time', nullable: true })
  startTime?: Date;

  @Column({ type: 'datetime', name: 'end_time', nullable: true })
  endTime?: Date;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'delete_time', nullable: true })
  deleteTime?: Date;
}
```

```ts
// server/src/module/system-module/entities/system-module-event.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import type { SystemModuleEventType } from '../constants';

@Index('idx_system_module_event_module', ['moduleCode'])
@Entity('system_module_event', { comment: 'System module lifecycle events' })
export class SystemModuleEventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'module_code', length: 80 })
  moduleCode: string;

  @Column({ type: 'varchar', name: 'event_type', length: 30 })
  eventType: SystemModuleEventType;

  @Column({ type: 'varchar', name: 'status', length: 20 })
  status: 'success' | 'failed';

  @Column({ type: 'varchar', name: 'message', length: 500, default: '' })
  message: string;

  @Column({ type: 'json', name: 'metadata', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'bigint', name: 'operator_id', nullable: true })
  operatorId?: number;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;
}
```

- [ ] **Step 6: Add the migration**

The migration SQL must create the same columns as the entities. Use this shape for each table and include the indexes from the entity decorators:

```ts
// server/src/migrations/1760000000020-CreateSystemModules.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystemModules1760000000020 implements MigrationInterface {
  name = 'CreateSystemModules1760000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`code\` varchar(80) NOT NULL,
        \`name\` varchar(120) NOT NULL,
        \`source\` varchar(20) NOT NULL,
        \`version\` varchar(40) NOT NULL DEFAULT '1.0.0',
        \`description\` varchar(500) NOT NULL DEFAULT '',
        \`category\` varchar(50) NOT NULL DEFAULT '',
        \`icon\` varchar(100) NOT NULL DEFAULT '',
        \`status\` varchar(20) NOT NULL DEFAULT 'installed',
        \`entry_route\` varchar(255) NOT NULL DEFAULT '',
        \`manifest\` json NULL,
        \`config_schema\` json NULL,
        \`health_status\` varchar(20) NOT NULL DEFAULT 'unknown',
        \`sort\` int NOT NULL DEFAULT 100,
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_system_module_code\` (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='System module registry'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module_dependency\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`module_code\` varchar(80) NOT NULL,
        \`depends_on_code\` varchar(80) NOT NULL,
        \`version_range\` varchar(80) NOT NULL DEFAULT '',
        \`required\` tinyint NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_system_module_dependency_pair\` (\`module_code\`, \`depends_on_code\`),
        KEY \`idx_system_module_dependency_module\` (\`module_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='System module dependencies'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module_menu\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`module_code\` varchar(80) NOT NULL,
        \`menu_id\` bigint NOT NULL,
        \`binding_type\` varchar(20) NOT NULL DEFAULT 'owned',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_system_module_menu_pair\` (\`module_code\`, \`menu_id\`),
        KEY \`idx_system_module_menu_module\` (\`module_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='System module menu bindings'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module_permission\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`module_code\` varchar(80) NOT NULL,
        \`permission_slug\` varchar(120) NOT NULL,
        \`binding_type\` varchar(20) NOT NULL DEFAULT 'owned',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_system_module_permission_pair\` (\`module_code\`, \`permission_slug\`),
        KEY \`idx_system_module_permission_module\` (\`module_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='System module permission bindings'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module_api\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`module_code\` varchar(80) NOT NULL,
        \`method\` varchar(10) NOT NULL,
        \`path\` varchar(255) NOT NULL,
        \`permission_slug\` varchar(120) NOT NULL DEFAULT '',
        \`tenant_scoped\` tinyint NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        KEY \`idx_system_module_api_module\` (\`module_code\`),
        KEY \`idx_system_module_api_route\` (\`method\`, \`path\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='System module API bindings'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_tenant_module\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`tenant_id\` bigint NOT NULL,
        \`module_code\` varchar(80) NOT NULL,
        \`enabled\` tinyint NOT NULL DEFAULT 1,
        \`source\` varchar(20) NOT NULL DEFAULT 'platform',
        \`config\` json NULL,
        \`start_time\` datetime NULL,
        \`end_time\` datetime NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_system_tenant_module_pair\` (\`tenant_id\`, \`module_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Tenant system module availability'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module_event\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`module_code\` varchar(80) NOT NULL,
        \`event_type\` varchar(30) NOT NULL,
        \`status\` varchar(20) NOT NULL,
        \`message\` varchar(500) NOT NULL DEFAULT '',
        \`metadata\` json NULL,
        \`operator_id\` bigint NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_system_module_event_module\` (\`module_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='System module lifecycle events'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `system_module_event`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_tenant_module`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_module_api`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_module_permission`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_module_menu`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_module_dependency`');
    await queryRunner.query('DROP TABLE IF EXISTS `system_module`');
  }
}
```

- [ ] **Step 7: Run the focused migration test and commit**

Run:

```powershell
cd server
pnpm.cmd exec jest src/migration-specs/create-system-modules.spec.ts --runInBand
```

Expected: PASS.

Commit:

```powershell
git add server/src/migrations/1760000000020-CreateSystemModules.ts server/src/migration-specs/create-system-modules.spec.ts server/src/module/system-module/entities server/src/module/system-module/constants.ts
git commit -m "feat: add system module registry tables"
```

### Task 2: Add built-in manifests and idempotent registry import

**Files:**
- Create: `server/src/module/system-module/manifests/built-in-modules.ts`
- Create: `server/src/module/system-module/services/system-module-registry.service.ts`
- Create: `server/src/module/system-module/system-module.module.ts`
- Modify: `server/src/module/system/system.module.ts`
- Test: `server/src/module/system-module/services/system-module-registry.service.spec.ts`

- [ ] **Step 1: Write the registry service tests**

```ts
// server/src/module/system-module/services/system-module-registry.service.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { SystemModuleRegistryService } from './system-module-registry.service';

const makeRepo = (rows: any[] = []) => ({
  rows,
  find: jest.fn(async () => rows.filter((row) => !row.deleteTime)),
  findOne: jest.fn(async ({ where }: any) => rows.find((row) => row.code === where.code && !row.deleteTime) || null),
  upsert: jest.fn(async (values: any[]) => {
    for (const value of values) {
      const existing = rows.find((row) => row.code === value.code);
      if (existing) Object.assign(existing, value);
      else rows.push({ id: rows.length + 1, ...value });
    }
  }),
  save: jest.fn(async (row: any) => row),
  create: jest.fn((row: any) => row),
});

describe('SystemModuleRegistryService', () => {
  it('imports built-in manifests idempotently', async () => {
    const moduleRepo = makeRepo();
    const service = new SystemModuleRegistryService(
      moduleRepo as any,
      makeRepo() as any,
      makeRepo() as any,
      makeRepo() as any,
      makeRepo() as any,
      makeRepo() as any,
    );

    await service.registerBuiltInModules();
    await service.registerBuiltInModules();

    expect(moduleRepo.upsert).toHaveBeenCalledTimes(2);
    expect(moduleRepo.rows.some((row) => row.code === 'core_system')).toBe(true);
    expect(moduleRepo.rows.some((row) => row.code === 'saas_platform')).toBe(true);
  });

  it('updates status and records lifecycle event', async () => {
    const moduleRepo = makeRepo([{ id: 1, code: 'core_system', status: 'installed' }]);
    const eventRepo = makeRepo();
    const service = new SystemModuleRegistryService(
      moduleRepo as any,
      makeRepo() as any,
      makeRepo() as any,
      makeRepo() as any,
      makeRepo() as any,
      eventRepo as any,
    );

    await service.updateStatus('core_system', 'enabled', 7);

    expect(moduleRepo.rows[0].status).toBe('enabled');
    expect(eventRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      moduleCode: 'core_system',
      eventType: 'enable',
      status: 'success',
      operatorId: 7,
    }));
  });

  it('rejects invalid lifecycle states', async () => {
    const service = new SystemModuleRegistryService(
      makeRepo([{ id: 1, code: 'core_system', status: 'installed' }]) as any,
      makeRepo() as any,
      makeRepo() as any,
      makeRepo() as any,
      makeRepo() as any,
      makeRepo() as any,
    );

    await expect(service.updateStatus('core_system', 'deleted' as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws not found for unknown modules', async () => {
    const service = new SystemModuleRegistryService(
      makeRepo() as any,
      makeRepo() as any,
      makeRepo() as any,
      makeRepo() as any,
      makeRepo() as any,
      makeRepo() as any,
    );

    await expect(service.getModule('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run the focused service test and confirm it fails**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/services/system-module-registry.service.spec.ts --runInBand
```

Expected: FAIL because the service and manifest files do not exist.

- [ ] **Step 3: Add built-in manifests**

```ts
// server/src/module/system-module/manifests/built-in-modules.ts
import type { SystemModuleSource, SystemModuleStatus } from '../constants';

export interface SystemModuleManifest {
  code: string;
  name: string;
  source: SystemModuleSource;
  version: string;
  description: string;
  category: string;
  icon: string;
  status: SystemModuleStatus;
  entryRoute: string;
  sort: number;
  dependencies: Array<{ code: string; versionRange?: string; required?: boolean }>;
  permissions: string[];
  apis: Array<{ method: string; path: string; permissionSlug?: string; tenantScoped?: boolean }>;
  configSchema: Record<string, any>;
}

export const BUILT_IN_SYSTEM_MODULES: SystemModuleManifest[] = [
  {
    code: 'core_system',
    name: 'System Management',
    source: 'built_in',
    version: '1.0.0',
    description: 'Users, roles, menus, tenants, and platform configuration.',
    category: 'core',
    icon: 'ri:settings-3-line',
    status: 'enabled',
    entryRoute: '/system/menu',
    sort: 10,
    dependencies: [],
    permissions: ['system:module:list', 'system:module:read', 'system:module:update', 'system:module:status'],
    apis: [
      { method: 'GET', path: '/api/system/modules', permissionSlug: 'system:module:list' },
      { method: 'GET', path: '/api/system/modules/:code', permissionSlug: 'system:module:read' },
      { method: 'PUT', path: '/api/system/modules/:code/status', permissionSlug: 'system:module:status' },
    ],
    configSchema: {},
  },
  {
    code: 'saas_platform',
    name: 'SaaS Platform',
    source: 'built_in',
    version: '1.0.0',
    description: 'Platform plans, tenants, subscriptions, modules, orders, quotas, and revenue operations.',
    category: 'saas',
    icon: 'ri:building-4-line',
    status: 'enabled',
    entryRoute: '/saas-platform/usage',
    sort: 20,
    dependencies: ['core_system'].map((code) => ({ code, required: true })),
    permissions: ['saas:tenant:list', 'saas:plan:index', 'saas:module:list', 'saas:usage:index'],
    apis: [{ method: 'GET', path: '/api/saas/platform/usage/overview', permissionSlug: 'saas:usage:index' }],
    configSchema: {},
  },
  {
    code: 'tenant_saas',
    name: 'Tenant SaaS Console',
    source: 'built_in',
    version: '1.0.0',
    description: 'Tenant plan, usage, members, resource packs, and module visibility.',
    category: 'saas',
    icon: 'ri:team-line',
    status: 'enabled',
    entryRoute: '/tenant-saas/usage',
    sort: 30,
    dependencies: ['core_system', 'saas_platform'].map((code) => ({ code, required: true })),
    permissions: ['tenant:billing:view', 'tenant:member:list', 'tenant:module:list'],
    apis: [{ method: 'GET', path: '/api/tenant/modules', permissionSlug: 'tenant:module:list', tenantScoped: true }],
    configSchema: {},
  },
  {
    code: 'ai_console',
    name: 'AI Console',
    source: 'built_in',
    version: '1.0.0',
    description: 'AI providers, models, chat, and console features.',
    category: 'ai',
    icon: 'ri:chat-ai-line',
    status: 'enabled',
    entryRoute: '/ai/chat',
    sort: 40,
    dependencies: ['core_system'].map((code) => ({ code, required: true })),
    permissions: ['ai:provider:list', 'ai:model:list'],
    apis: [],
    configSchema: {},
  },
  {
    code: 'taixu_workspace',
    name: 'Taixu Workspace',
    source: 'built_in',
    version: '1.0.0',
    description: 'Taixu documents, retrieval, image, agentic workflow, and workspace tools.',
    category: 'ai',
    icon: 'ri:planet-line',
    status: 'enabled',
    entryRoute: '/dashboard/taixu',
    sort: 50,
    dependencies: ['core_system', 'ai_console'].map((code) => ({ code, required: false })),
    permissions: [],
    apis: [],
    configSchema: {},
  },
  {
    code: 'content_article',
    name: 'Article Management',
    source: 'built_in',
    version: '1.0.0',
    description: 'Article content management.',
    category: 'content',
    icon: 'ri:article-line',
    status: 'enabled',
    entryRoute: '/article',
    sort: 60,
    dependencies: ['core_system'].map((code) => ({ code, required: true })),
    permissions: [],
    apis: [],
    configSchema: {},
  },
  {
    code: 'ops_monitor',
    name: 'Monitor And Jobs',
    source: 'built_in',
    version: '1.0.0',
    description: 'Operational monitoring, Redis, database, cron jobs, logs, and generated code tools.',
    category: 'ops',
    icon: 'ri:pulse-line',
    status: 'enabled',
    entryRoute: '/tool/crontab',
    sort: 70,
    dependencies: ['core_system'].map((code) => ({ code, required: true })),
    permissions: [],
    apis: [],
    configSchema: {},
  },
];
```

- [ ] **Step 4: Add the registry service**

```ts
// server/src/module/system-module/services/system-module-registry.service.ts
import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { SYSTEM_MODULE_STATUSES, type SystemModuleStatus } from '../constants';
import { SystemModuleApiEntity } from '../entities/system-module-api.entity';
import { SystemModuleDependencyEntity } from '../entities/system-module-dependency.entity';
import { SystemModuleEntity } from '../entities/system-module.entity';
import { SystemModuleEventEntity } from '../entities/system-module-event.entity';
import { SystemModulePermissionEntity } from '../entities/system-module-permission.entity';
import { BUILT_IN_SYSTEM_MODULES, type SystemModuleManifest } from '../manifests/built-in-modules';

@Injectable()
export class SystemModuleRegistryService implements OnModuleInit {
  constructor(
    @InjectRepository(SystemModuleEntity)
    private readonly moduleRepo: Repository<SystemModuleEntity>,
    @InjectRepository(SystemModuleDependencyEntity)
    private readonly dependencyRepo: Repository<SystemModuleDependencyEntity>,
    @InjectRepository(SystemModulePermissionEntity)
    private readonly permissionRepo: Repository<SystemModulePermissionEntity>,
    @InjectRepository(SystemModuleApiEntity)
    private readonly apiRepo: Repository<SystemModuleApiEntity>,
    @InjectRepository(SystemModuleEventEntity)
    private readonly eventRepo: Repository<SystemModuleEventEntity>,
  ) {}

  async onModuleInit() {
    await this.registerBuiltInModules();
  }

  async registerBuiltInModules() {
    await this.importManifests(BUILT_IN_SYSTEM_MODULES, undefined);
  }

  async importManifests(manifests: SystemModuleManifest[], operatorId?: number) {
    const rows = manifests.map((manifest) => ({
      code: manifest.code,
      name: manifest.name,
      source: manifest.source,
      version: manifest.version,
      description: manifest.description,
      category: manifest.category,
      icon: manifest.icon,
      status: manifest.status,
      entryRoute: manifest.entryRoute,
      manifest,
      configSchema: manifest.configSchema,
      healthStatus: 'unknown' as const,
      sort: manifest.sort,
      remark: 'Registered from manifest',
    }));

    await this.moduleRepo.upsert(rows, ['code']);

    for (const manifest of manifests) {
      await this.replaceManifestBindings(manifest);
      await this.recordEvent(manifest.code, 'install', 'success', 'Manifest registered', { source: manifest.source }, operatorId);
    }
  }

  async listModules(query: { keyword?: string; status?: string; source?: string } = {}) {
    const modules = await this.moduleRepo.find({ where: { deleteTime: IsNull() }, order: { sort: 'ASC', id: 'ASC' } });
    return modules
      .filter((module) => !query.status || module.status === query.status)
      .filter((module) => !query.source || module.source === query.source)
      .filter((module) => {
        if (!query.keyword) return true;
        const keyword = query.keyword.toLowerCase();
        return module.code.toLowerCase().includes(keyword) || module.name.toLowerCase().includes(keyword);
      })
      .map((module) => this.toResponse(module));
  }

  async getModule(code: string) {
    const module = await this.findActiveModule(code);
    const [dependencies, permissions, apis, events] = await Promise.all([
      this.dependencyRepo.find({ where: { moduleCode: code }, order: { id: 'ASC' } }),
      this.permissionRepo.find({ where: { moduleCode: code }, order: { id: 'ASC' } }),
      this.apiRepo.find({ where: { moduleCode: code }, order: { id: 'ASC' } }),
      this.eventRepo.find({ where: { moduleCode: code }, order: { id: 'DESC' }, take: 50 }),
    ]);

    return { ...this.toResponse(module), dependencies, permissions, apis, events };
  }

  async updateStatus(code: string, status: SystemModuleStatus, operatorId?: number) {
    if (!SYSTEM_MODULE_STATUSES.includes(status)) {
      throw new BadRequestException('Invalid module status');
    }

    const module = await this.findActiveModule(code);
    module.status = status;
    const saved = await this.moduleRepo.save(module);
    const eventType = status === 'enabled' ? 'enable' : status === 'disabled' ? 'disable' : 'upgrade';
    await this.recordEvent(code, eventType, 'success', `Module status changed to ${status}`, { status }, operatorId);
    return this.toResponse(saved);
  }

  async listEvents(code: string) {
    await this.findActiveModule(code);
    return this.eventRepo.find({ where: { moduleCode: code }, order: { id: 'DESC' }, take: 100 });
  }

  private async replaceManifestBindings(manifest: SystemModuleManifest) {
    await this.dependencyRepo.delete({ moduleCode: manifest.code });
    await this.permissionRepo.delete({ moduleCode: manifest.code });
    await this.apiRepo.delete({ moduleCode: manifest.code });

    if (manifest.dependencies.length) {
      await this.dependencyRepo.save(
        manifest.dependencies.map((dependency) => ({
          moduleCode: manifest.code,
          dependsOnCode: dependency.code,
          versionRange: dependency.versionRange || '',
          required: dependency.required === false ? 0 : 1,
        })),
      );
    }

    if (manifest.permissions.length) {
      await this.permissionRepo.save(
        manifest.permissions.map((permissionSlug) => ({
          moduleCode: manifest.code,
          permissionSlug,
          bindingType: 'owned' as const,
        })),
      );
    }

    if (manifest.apis.length) {
      await this.apiRepo.save(
        manifest.apis.map((api) => ({
          moduleCode: manifest.code,
          method: api.method.toUpperCase(),
          path: api.path,
          permissionSlug: api.permissionSlug || '',
          tenantScoped: api.tenantScoped ? 1 : 0,
        })),
      );
    }
  }

  private async findActiveModule(code: string) {
    const module = await this.moduleRepo.findOne({ where: { code, deleteTime: IsNull() } });
    if (!module) throw new NotFoundException(`Module ${code} not found`);
    return module;
  }

  private async recordEvent(moduleCode: string, eventType: any, status: 'success' | 'failed', message: string, metadata?: Record<string, any>, operatorId?: number) {
    await this.eventRepo.save(this.eventRepo.create({ moduleCode, eventType, status, message, metadata, operatorId }));
  }

  private toResponse(module: Partial<SystemModuleEntity>) {
    return {
      id: module.id,
      code: module.code,
      name: module.name,
      source: module.source,
      version: module.version,
      description: module.description || '',
      category: module.category || '',
      icon: module.icon || '',
      status: module.status,
      entry_route: module.entryRoute || '',
      manifest: module.manifest || {},
      config_schema: module.configSchema || {},
      health_status: module.healthStatus || 'unknown',
      sort: Number(module.sort) || 0,
      remark: module.remark,
      create_time: module.createTime,
      update_time: module.updateTime,
    };
  }
}
```

- [ ] **Step 5: Register the backend module**

```ts
// server/src/module/system-module/system-module.module.ts
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SystemModuleApiEntity } from './entities/system-module-api.entity';
import { SystemModuleDependencyEntity } from './entities/system-module-dependency.entity';
import { SystemModuleEntity } from './entities/system-module.entity';
import { SystemModuleEventEntity } from './entities/system-module-event.entity';
import { SystemModuleMenuEntity } from './entities/system-module-menu.entity';
import { SystemModulePermissionEntity } from './entities/system-module-permission.entity';
import { SystemTenantModuleEntity } from './entities/system-tenant-module.entity';
import { SystemModuleRegistryService } from './services/system-module-registry.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemModuleEntity,
      SystemModuleDependencyEntity,
      SystemModuleMenuEntity,
      SystemModulePermissionEntity,
      SystemModuleApiEntity,
      SystemTenantModuleEntity,
      SystemModuleEventEntity,
    ]),
  ],
  providers: [SystemModuleRegistryService],
  exports: [SystemModuleRegistryService],
})
export class SystemModuleRegistryModule {}
```

Modify `server/src/module/system/system.module.ts`:

```ts
import { SystemModuleRegistryModule } from '../system-module/system-module.module';
```

Then add `SystemModuleRegistryModule` to both `imports` and `exports`.

- [ ] **Step 6: Run the focused registry test and commit**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/services/system-module-registry.service.spec.ts --runInBand
```

Expected: PASS.

Commit:

```powershell
git add server/src/module/system-module server/src/module/system/system.module.ts
git commit -m "feat: register built-in system modules"
```

### Task 3: Add platform registry APIs and seed management permissions

**Files:**
- Create: `server/src/module/system-module/dto/save-system-module.dto.ts`
- Create: `server/src/module/system-module/system-module-platform.controller.ts`
- Modify: `server/src/module/system-module/system-module.module.ts`
- Create: `server/src/migrations/1760000000021-SeedSystemModules.ts`
- Test: `server/src/module/system-module/system-module-platform.controller.spec.ts`
- Test: `server/src/migration-specs/seed-system-modules.spec.ts`

- [ ] **Step 1: Write controller test**

```ts
// server/src/module/system-module/system-module-platform.controller.spec.ts
import { SystemModulePlatformController } from './system-module-platform.controller';

describe('SystemModulePlatformController', () => {
  it('lists platform modules through registry service', async () => {
    const registry = {
      listModules: jest.fn(async () => [{ code: 'core_system' }]),
      getModule: jest.fn(),
      updateStatus: jest.fn(),
      listEvents: jest.fn(),
      registerBuiltInModules: jest.fn(),
    };
    const controller = new SystemModulePlatformController(registry as any);

    const result = await controller.listModules({}, { userId: 1 } as any);

    expect(registry.listModules).toHaveBeenCalledWith({});
    expect(result.data).toEqual([{ code: 'core_system' }]);
  });

  it('passes operator id when updating module status', async () => {
    const registry = {
      listModules: jest.fn(),
      getModule: jest.fn(),
      updateStatus: jest.fn(async () => ({ code: 'core_system', status: 'disabled' })),
      listEvents: jest.fn(),
      registerBuiltInModules: jest.fn(),
    };
    const controller = new SystemModulePlatformController(registry as any);

    await controller.updateStatus('core_system', { status: 'disabled' } as any, { userId: 9 } as any);

    expect(registry.updateStatus).toHaveBeenCalledWith('core_system', 'disabled', 9);
  });
});
```

- [ ] **Step 2: Add DTO and controller**

```ts
// server/src/module/system-module/dto/save-system-module.dto.ts
import { IsIn, IsOptional, IsString } from 'class-validator';

import { SYSTEM_MODULE_STATUSES, type SystemModuleStatus } from '../constants';

export class SystemModuleListQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateSystemModuleStatusDto {
  @IsIn(SYSTEM_MODULE_STATUSES)
  status: SystemModuleStatus;
}
```

```ts
// server/src/module/system-module/system-module-platform.controller.ts
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantContext } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { User, type UserDto } from '../system/user/user.decorator';
import { SystemModuleListQueryDto, UpdateSystemModuleStatusDto } from './dto/save-system-module.dto';
import { SystemModuleRegistryService } from './services/system-module-registry.service';

@ApiTags('System Modules')
@ApiBearerAuth('Authorization')
@Controller('api/system/modules')
export class SystemModulePlatformController {
  constructor(private readonly registry: SystemModuleRegistryService) {}

  @Get()
  @ApiOperation({ summary: 'List system modules' })
  @RequirePermission('system:module:list')
  listModules(@Query() query: SystemModuleListQueryDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.registry.listModules(query).then((data) => ResultData.ok(data)));
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get system module detail' })
  @RequirePermission('system:module:read')
  getModule(@Param('code') code: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.registry.getModule(code).then((data) => ResultData.ok(data)));
  }

  @Put(':code/status')
  @ApiOperation({ summary: 'Update system module status' })
  @RequirePermission('system:module:status')
  updateStatus(@Param('code') code: string, @Body() body: UpdateSystemModuleStatusDto, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.registry.updateStatus(code, body.status, user?.userId).then((data) => ResultData.ok(data)));
  }

  @Get(':code/events')
  @ApiOperation({ summary: 'List system module lifecycle events' })
  @RequirePermission('system:module:event')
  listEvents(@Param('code') code: string, @User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.registry.listEvents(code).then((data) => ResultData.ok(data)));
  }

  @Post('register-built-ins')
  @ApiOperation({ summary: 'Register built-in system module manifests' })
  @RequirePermission('system:module:install')
  registerBuiltIns(@User() user: UserDto) {
    return this.runOutsideTenant(user, () => this.registry.registerBuiltInModules().then(() => ResultData.ok(true)));
  }

  private runOutsideTenant(user: UserDto, callback: () => Promise<ResultData>) {
    return TenantContext.run(
      {
        tenantId: undefined,
        userId: user?.userId,
        ignoreAudit: false,
        ignoreTenant: true,
      },
      callback,
    );
  }
}
```

- [ ] **Step 3: Wire controller into module**

Modify `server/src/module/system-module/system-module.module.ts`:

```ts
import { SystemModulePlatformController } from './system-module-platform.controller';

@Module({
  // existing imports...
  controllers: [SystemModulePlatformController],
  providers: [SystemModuleRegistryService],
  exports: [SystemModuleRegistryService],
})
export class SystemModuleRegistryModule {}
```

- [ ] **Step 4: Write seed migration test and migration**

Test:

```ts
// server/src/migration-specs/seed-system-modules.spec.ts
import { SeedSystemModules1760000000021 } from '../migrations/1760000000021-SeedSystemModules';

describe('SeedSystemModules1760000000021', () => {
  it('seeds system module menus and permissions', async () => {
    const queries: string[] = [];
    const queryRunner = { query: jest.fn((sql: string) => { queries.push(sql); return Promise.resolve(); }) } as any;

    await new SeedSystemModules1760000000021().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('SystemModules');
    expect(sql).toContain('system:module:list');
    expect(sql).toContain('system:module:read');
    expect(sql).toContain('tenant:module:list');
    expect(sql).toContain('sa_system_role_menu');
  });
});
```

Migration:

```ts
// server/src/migrations/1760000000021-SeedSystemModules.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

const PLATFORM_PERMISSIONS = [
  ['List', 'system:module:list', 'GET', 10],
  ['Read', 'system:module:read', 'GET', 20],
  ['Install', 'system:module:install', 'POST', 30],
  ['Update', 'system:module:update', 'PUT', 40],
  ['Status', 'system:module:status', 'PUT', 50],
  ['Config', 'system:module:config', 'PUT', 60],
  ['Tenant assignment', 'system:module:tenant', 'PUT', 70],
  ['Event', 'system:module:event', 'GET', 80],
] as const;

const TENANT_PERMISSIONS = [
  ['Tenant module list', 'tenant:module:list', 'GET', 10],
  ['Tenant module config', 'tenant:module:config', 'PUT', 20],
  ['Tenant module status', 'tenant:module:status', 'PUT', 30],
] as const;

export class SeedSystemModules1760000000021 implements MigrationInterface {
  name = 'SeedSystemModules1760000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insertPlatformMenu(queryRunner);
    for (const permission of PLATFORM_PERMISSIONS) await this.insertPermission(queryRunner, 'SystemModules', permission, 'Seeded system module permission');
    await this.insertTenantMenu(queryRunner);
    for (const permission of TENANT_PERMISSIONS) await this.insertPermission(queryRunner, 'TenantSystemModules', permission, 'Seeded tenant system module permission');
    await this.grantAdmin(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE role_menu FROM \`sa_system_role_menu\` role_menu
      INNER JOIN \`sa_system_menu\` menu ON menu.id = role_menu.menu_id
      WHERE menu.remark IN ('Seeded system module menu', 'Seeded system module permission', 'Seeded tenant system module menu', 'Seeded tenant system module permission')
    `);
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`remark\` IN ('Seeded system module menu', 'Seeded system module permission', 'Seeded tenant system module menu', 'Seeded tenant system module permission')
    `);
  }

  private async insertPlatformMenu(queryRunner: QueryRunner) {
    await queryRunner.query(`
      INSERT INTO \`sa_system_menu\` (\`parent_id\`, \`name\`, \`code\`, \`slug\`, \`type\`, \`path\`, \`component\`, \`icon\`, \`sort\`, \`status\`, \`remark\`)
      SELECT parent.id, 'System Modules', 'SystemModules', NULL, 2, 'modules', '/system/modules/index', 'ri:apps-2-line', 90, 1, 'Seeded system module menu'
      FROM \`sa_system_menu\` parent
      WHERE parent.code = 'SystemManage' AND parent.delete_time IS NULL
        AND NOT EXISTS (SELECT 1 FROM \`sa_system_menu\` WHERE code = 'SystemModules' AND delete_time IS NULL)
      ORDER BY parent.id ASC LIMIT 1
    `);
  }

  private async insertTenantMenu(queryRunner: QueryRunner) {
    await queryRunner.query(`
      INSERT INTO \`sa_system_menu\` (\`parent_id\`, \`name\`, \`code\`, \`slug\`, \`type\`, \`path\`, \`component\`, \`icon\`, \`sort\`, \`status\`, \`remark\`)
      SELECT parent.id, 'Tenant Modules', 'TenantSystemModules', NULL, 2, 'modules', '/saas/tenant/modules/index', 'ri:apps-line', 45, 1, 'Seeded tenant system module menu'
      FROM \`sa_system_menu\` parent
      WHERE parent.code = 'TenantSaas' AND parent.delete_time IS NULL
        AND NOT EXISTS (SELECT 1 FROM \`sa_system_menu\` WHERE code = 'TenantSystemModules' AND delete_time IS NULL)
      ORDER BY parent.id ASC LIMIT 1
    `);
  }

  private async insertPermission(queryRunner: QueryRunner, parentCode: string, permission: readonly [string, string, string, number], remark: string) {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_menu\` (\`parent_id\`, \`name\`, \`code\`, \`slug\`, \`type\`, \`path\`, \`component\`, \`method\`, \`sort\`, \`status\`, \`remark\`)
        SELECT parent.id, ?, NULL, ?, 3, '', '', ?, ?, 1, ?
        FROM \`sa_system_menu\` parent
        WHERE parent.code = ?
          AND parent.delete_time IS NULL
          AND NOT EXISTS (SELECT 1 FROM \`sa_system_menu\` WHERE slug = ? AND delete_time IS NULL)
        ORDER BY parent.id ASC LIMIT 1
      `,
      [permission[0], permission[1], permission[2], permission[3], remark, parentCode, permission[1]],
    );
  }

  private async grantAdmin(queryRunner: QueryRunner) {
    await queryRunner.query(`
      INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
      SELECT role.id, menu.id
      FROM \`sa_system_role\` role
      INNER JOIN \`sa_system_menu\` menu ON menu.delete_time IS NULL
      WHERE role.code = 'admin'
        AND role.delete_time IS NULL
        AND menu.remark IN ('Seeded system module menu', 'Seeded system module permission', 'Seeded tenant system module menu', 'Seeded tenant system module permission')
        AND NOT EXISTS (
          SELECT 1 FROM \`sa_system_role_menu\` existing
          WHERE existing.role_id = role.id AND existing.menu_id = menu.id
        )
    `);
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module-platform.controller.spec.ts src/migration-specs/seed-system-modules.spec.ts --runInBand
```

Expected: PASS.

Commit:

```powershell
git add server/src/module/system-module/dto server/src/module/system-module/system-module-platform.controller.ts server/src/module/system-module/system-module.module.ts server/src/migrations/1760000000021-SeedSystemModules.ts server/src/migration-specs/seed-system-modules.spec.ts server/src/module/system-module/system-module-platform.controller.spec.ts
git commit -m "feat: add system module platform APIs"
```

---

## P1 - Access And Entitlement Service

### Task 4: Add module access service with tenant and SaaS bridge gates

**Files:**
- Create: `server/src/module/system-module/services/system-module-access.service.ts`
- Modify: `server/src/module/system-module/system-module.module.ts`
- Modify: `server/src/module/saas/saas.module.ts`
- Test: `server/src/module/system-module/services/system-module-access.service.spec.ts`

- [ ] **Step 1: Write access service tests**

```ts
// server/src/module/system-module/services/system-module-access.service.spec.ts
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { SystemModuleAccessService } from './system-module-access.service';

const repo = (rows: any[]) => ({
  findOne: jest.fn(async ({ where }: any) => {
    if (where.code) return rows.find((row) => row.code === where.code && !row.deleteTime) || null;
    if (where.moduleCode) return rows.find((row) => row.moduleCode === where.moduleCode && row.enabled === where.enabled && !row.deleteTime) || null;
    return null;
  }),
  find: jest.fn(async ({ where }: any) => rows.filter((row) => !where?.moduleCode || row.moduleCode === where.moduleCode)),
});

describe('SystemModuleAccessService', () => {
  it('allows enabled global and tenant modules when permission is present', async () => {
    const service = new SystemModuleAccessService(
      repo([{ code: 'tenant_saas', status: 'enabled' }]) as any,
      repo([]) as any,
      repo([{ tenantId: 11, moduleCode: 'tenant_saas', enabled: 1 }]) as any,
      { listTenantModules: jest.fn(async () => []) } as any,
    );

    await expect(service.assertModuleAccess({
      tenantId: 11,
      moduleCode: 'tenant_saas',
      permission: 'tenant:module:list',
      userPermissions: ['tenant:module:list'],
    })).resolves.toBe(true);
  });

  it('denies disabled global modules', async () => {
    const service = new SystemModuleAccessService(
      repo([{ code: 'tenant_saas', status: 'disabled' }]) as any,
      repo([]) as any,
      repo([{ tenantId: 11, moduleCode: 'tenant_saas', enabled: 1 }]) as any,
      { listTenantModules: jest.fn(async () => []) } as any,
    );

    await expect(service.assertModuleAccess({ tenantId: 11, moduleCode: 'tenant_saas' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('denies missing module', async () => {
    const service = new SystemModuleAccessService(repo([]) as any, repo([]) as any, repo([]) as any, { listTenantModules: jest.fn() } as any);
    await expect(service.assertModuleAccess({ moduleCode: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('derives tenant availability from current SaaS plan feature modules', async () => {
    const service = new SystemModuleAccessService(
      repo([{ code: 'ai_console', status: 'enabled' }]) as any,
      repo([]) as any,
      repo([]) as any,
      { listTenantModules: jest.fn(async () => [{ code: 'ai_chat' }]) } as any,
    );

    await expect(service.assertModuleAccess({ tenantId: 11, moduleCode: 'ai_console', saasModuleCodes: ['ai_chat'] })).resolves.toBe(true);
  });

  it('denies missing user permission', async () => {
    const service = new SystemModuleAccessService(
      repo([{ code: 'tenant_saas', status: 'enabled' }]) as any,
      repo([]) as any,
      repo([{ tenantId: 11, moduleCode: 'tenant_saas', enabled: 1 }]) as any,
      { listTenantModules: jest.fn(async () => []) } as any,
    );

    await expect(service.assertModuleAccess({
      tenantId: 11,
      moduleCode: 'tenant_saas',
      permission: 'tenant:module:list',
      userPermissions: [],
    })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
```

- [ ] **Step 2: Implement the access service**

```ts
// server/src/module/system-module/services/system-module-access.service.ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { SaasModuleService } from '../../saas/services/saas-module.service';
import { SystemModuleDependencyEntity } from '../entities/system-module-dependency.entity';
import { SystemModuleEntity } from '../entities/system-module.entity';
import { SystemTenantModuleEntity } from '../entities/system-tenant-module.entity';

export interface AssertModuleAccessOptions {
  tenantId?: number;
  userId?: number;
  moduleCode: string;
  permission?: string;
  userPermissions?: string[];
  saasModuleCodes?: string[];
}

const SAAS_TO_SYSTEM_MODULE_MAP: Record<string, string[]> = {
  ai_chat: ['ai_console', 'taixu_workspace'],
  rag: ['taixu_workspace'],
  member_management: ['tenant_saas'],
  resource_pack: ['tenant_saas'],
  advanced_report: ['saas_platform'],
};

@Injectable()
export class SystemModuleAccessService {
  constructor(
    @InjectRepository(SystemModuleEntity)
    private readonly moduleRepo: Repository<SystemModuleEntity>,
    @InjectRepository(SystemModuleDependencyEntity)
    private readonly dependencyRepo: Repository<SystemModuleDependencyEntity>,
    @InjectRepository(SystemTenantModuleEntity)
    private readonly tenantModuleRepo: Repository<SystemTenantModuleEntity>,
    private readonly saasModuleService: SaasModuleService,
  ) {}

  async assertModuleAccess(options: AssertModuleAccessOptions) {
    const module = await this.moduleRepo.findOne({ where: { code: options.moduleCode, deleteTime: IsNull() } });
    if (!module) throw new NotFoundException(`Module ${options.moduleCode} not found`);
    if (module.status !== 'enabled') throw new BadRequestException('Module is disabled');

    await this.assertDependenciesEnabled(options.moduleCode);

    if (options.tenantId) {
      const entitled = await this.isTenantEntitled(options.tenantId, options.moduleCode, options.saasModuleCodes);
      if (!entitled) throw new BadRequestException('Tenant has not enabled this module');
    }

    if (options.permission && !(options.userPermissions || []).includes(options.permission)) {
      throw new ForbiddenException('Missing module permission');
    }

    return true;
  }

  async isTenantEntitled(tenantId: number, moduleCode: string, saasModuleCodes?: string[]) {
    const explicit = await this.tenantModuleRepo.findOne({
      where: { tenantId, moduleCode, enabled: 1, deleteTime: IsNull() },
    });
    if (explicit) return true;

    const tenantSaasModules = saasModuleCodes
      ? saasModuleCodes.map((code) => ({ code }))
      : await this.saasModuleService.listTenantModules(tenantId);

    return tenantSaasModules.some((saasModule) => (SAAS_TO_SYSTEM_MODULE_MAP[saasModule.code] || []).includes(moduleCode));
  }

  private async assertDependenciesEnabled(moduleCode: string) {
    const dependencies = await this.dependencyRepo.find({ where: { moduleCode, required: 1 } });
    for (const dependency of dependencies) {
      const dependencyModule = await this.moduleRepo.findOne({ where: { code: dependency.dependsOnCode, deleteTime: IsNull() } });
      if (!dependencyModule || dependencyModule.status !== 'enabled') {
        throw new BadRequestException('Module dependency is not satisfied');
      }
    }
  }
}
```

- [ ] **Step 3: Wire access service and SaaS dependency**

Modify `server/src/module/system-module/system-module.module.ts`:

```ts
import { forwardRef, Global, Module } from '@nestjs/common';
import { SaasModule } from '../saas/saas.module';
import { SystemModuleAccessService } from './services/system-module-access.service';

@Module({
  imports: [
    forwardRef(() => SaasModule),
    TypeOrmModule.forFeature([...]),
  ],
  providers: [SystemModuleRegistryService, SystemModuleAccessService],
  exports: [SystemModuleRegistryService, SystemModuleAccessService],
})
export class SystemModuleRegistryModule {}
```

Modify `server/src/module/saas/saas.module.ts` only if Nest reports a circular dependency in tests:

```ts
import { forwardRef, Module } from '@nestjs/common';
import { SystemModuleRegistryModule } from '../system-module/system-module.module';

@Module({
  imports: [
    forwardRef(() => SystemModuleRegistryModule),
    TypeOrmModule.forFeature([...]),
  ],
})
export class SaasModule {}
```

- [ ] **Step 4: Run focused test and commit**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/services/system-module-access.service.spec.ts --runInBand
```

Expected: PASS.

Commit:

```powershell
git add server/src/module/system-module/services/system-module-access.service.ts server/src/module/system-module/services/system-module-access.service.spec.ts server/src/module/system-module/system-module.module.ts server/src/module/saas/saas.module.ts
git commit -m "feat: add system module access gates"
```

### Task 5: Add tenant module APIs using session tenant context

**Files:**
- Create: `server/src/module/system-module/system-module-tenant.controller.ts`
- Modify: `server/src/module/system-module/system-module.module.ts`
- Modify: `server/src/module/system-module/services/system-module-registry.service.ts`
- Test: `server/src/module/system-module/system-module-tenant.controller.spec.ts`

- [ ] **Step 1: Write tenant controller test**

```ts
// server/src/module/system-module/system-module-tenant.controller.spec.ts
import { SystemModuleTenantController } from './system-module-tenant.controller';

jest.mock('../../common/tenant/tenant.context', () => ({
  getTenantId: jest.fn(() => 23),
}));

describe('SystemModuleTenantController', () => {
  it('lists modules for tenant id from context only', async () => {
    const registry = {
      listTenantModules: jest.fn(async (tenantId: number) => [{ code: 'tenant_saas', tenant_id: tenantId }]),
    };
    const controller = new SystemModuleTenantController(registry as any);

    const result = await controller.listModules();

    expect(registry.listTenantModules).toHaveBeenCalledWith(23);
    expect(result.data).toEqual([{ code: 'tenant_saas', tenant_id: 23 }]);
  });
});
```

- [ ] **Step 2: Add tenant list method to registry service**

Add this method to `SystemModuleRegistryService`:

```ts
async listTenantModules(tenantId: number) {
  const modules = await this.listModules({ status: 'enabled' });
  const tenantRows = await this.tenantModuleRepo.find({ where: { tenantId, enabled: 1, deleteTime: IsNull() } });
  const explicitCodes = new Set(tenantRows.map((row) => row.moduleCode));

  return modules.map((module) => ({
    ...module,
    tenant_enabled: explicitCodes.has(String(module.code)),
    entitlement_source: explicitCodes.has(String(module.code)) ? 'platform' : 'plan',
  }));
}
```

Also inject `SystemTenantModuleEntity` repository into the constructor:

```ts
@InjectRepository(SystemTenantModuleEntity)
private readonly tenantModuleRepo: Repository<SystemTenantModuleEntity>,
```

- [ ] **Step 3: Add tenant controller**

```ts
// server/src/module/system-module/system-module-tenant.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { getTenantId } from '../../common/tenant/tenant.context';
import { ResultData } from '../../common/utils/result';
import { SystemModuleRegistryService } from './services/system-module-registry.service';

@ApiTags('Tenant System Modules')
@ApiBearerAuth('Authorization')
@Controller('api/tenant/modules')
export class SystemModuleTenantController {
  constructor(private readonly registry: SystemModuleRegistryService) {}

  @Get()
  @ApiOperation({ summary: 'List current tenant system modules' })
  @RequirePermission('tenant:module:list')
  async listModules() {
    const tenantId = getTenantId();
    if (!tenantId) return ResultData.fail(401, 'Tenant context is required');
    return ResultData.ok(await this.registry.listTenantModules(tenantId));
  }
}
```

- [ ] **Step 4: Wire tenant controller and run test**

Modify `server/src/module/system-module/system-module.module.ts`:

```ts
controllers: [SystemModulePlatformController, SystemModuleTenantController],
```

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/system-module-tenant.controller.spec.ts src/module/system-module/services/system-module-registry.service.spec.ts --runInBand
```

Expected: PASS.

Commit:

```powershell
git add server/src/module/system-module/system-module-tenant.controller.ts server/src/module/system-module/system-module-tenant.controller.spec.ts server/src/module/system-module/services/system-module-registry.service.ts server/src/module/system-module/system-module.module.ts
git commit -m "feat: add tenant system module APIs"
```

---

## P2 - Admin UI And Tenant UI

### Task 6: Add frontend API and platform module pages

**Files:**
- Create: `web/src/api/system-module.ts`
- Create: `web/src/views/system/modules/index.vue`
- Create: `web/src/views/system/modules/detail.vue`

- [ ] **Step 1: Add frontend API types and clients**

```ts
// web/src/api/system-module.ts
import request from '@/utils/http'

export interface SystemModuleRecord {
  id?: number
  code: string
  name: string
  source: 'built_in' | 'plugin' | 'extension' | string
  version: string
  description?: string
  category?: string
  icon?: string
  status: 'draft' | 'installed' | 'enabled' | 'disabled' | 'upgrading' | 'failed' | 'uninstalled' | string
  entry_route?: string
  manifest?: Record<string, any>
  config_schema?: Record<string, any>
  health_status?: 'unknown' | 'healthy' | 'degraded' | 'failed' | string
  sort?: number
  remark?: string
  tenant_enabled?: boolean
  entitlement_source?: string
  create_time?: string | Date
  update_time?: string | Date
}

export interface SystemModuleEventRecord {
  id: number
  moduleCode?: string
  module_code?: string
  eventType?: string
  event_type?: string
  status: 'success' | 'failed' | string
  message: string
  metadata?: Record<string, any>
  createTime?: string | Date
  create_time?: string | Date
}

export interface SystemModuleListParams {
  keyword?: string
  source?: string
  status?: string
}

export function fetchSystemModules(params?: SystemModuleListParams) {
  return request.get<SystemModuleRecord[]>({ url: '/api/system/modules', params })
}

export function fetchSystemModule(code: string) {
  return request.get<SystemModuleRecord & {
    dependencies?: any[]
    permissions?: any[]
    apis?: any[]
    events?: SystemModuleEventRecord[]
  }>({ url: `/api/system/modules/${code}` })
}

export function updateSystemModuleStatus(code: string, status: string) {
  return request.put<SystemModuleRecord>({ url: `/api/system/modules/${code}/status`, data: { status } })
}

export function fetchSystemModuleEvents(code: string) {
  return request.get<SystemModuleEventRecord[]>({ url: `/api/system/modules/${code}/events` })
}

export function registerBuiltInSystemModules() {
  return request.post<boolean>({ url: '/api/system/modules/register-built-ins' })
}

export function fetchTenantSystemModules() {
  return request.get<SystemModuleRecord[]>({ url: '/api/tenant/modules' })
}
```

- [ ] **Step 2: Add platform module list page**

```vue
<!-- web/src/views/system/modules/index.vue -->
<template>
  <div class="system-module-page">
    <el-card shadow="never">
      <template #header>
        <div class="toolbar">
          <div class="filters">
            <el-input v-model="query.keyword" placeholder="模块编码/名称" clearable @keyup.enter="loadData" />
            <el-select v-model="query.source" placeholder="来源" clearable>
              <el-option label="内置" value="built_in" />
              <el-option label="插件" value="plugin" />
              <el-option label="扩展" value="extension" />
            </el-select>
            <el-select v-model="query.status" placeholder="状态" clearable>
              <el-option label="启用" value="enabled" />
              <el-option label="禁用" value="disabled" />
              <el-option label="已安装" value="installed" />
              <el-option label="失败" value="failed" />
            </el-select>
            <el-button type="primary" :icon="Search" @click="loadData">查询</el-button>
          </div>
          <el-button :icon="Refresh" @click="handleRegisterBuiltIns">同步内置模块</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="rows" row-key="code">
        <el-table-column prop="code" label="编码" min-width="150" />
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="source" label="来源" width="100" />
        <el-table-column prop="version" label="版本" width="100" />
        <el-table-column prop="category" label="分类" width="110" />
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'enabled' ? 'success' : row.status === 'failed' ? 'danger' : 'info'">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="health_status" label="健康" width="110" />
        <el-table-column prop="entry_route" label="入口" min-width="180" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="goDetail(row.code)">详情</el-button>
            <el-button v-if="row.status !== 'enabled'" link type="success" @click="setStatus(row.code, 'enabled')">启用</el-button>
            <el-button v-else link type="warning" @click="setStatus(row.code, 'disabled')">禁用</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { Refresh, Search } from '@element-plus/icons-vue'
  import {
    fetchSystemModules,
    registerBuiltInSystemModules,
    updateSystemModuleStatus,
    type SystemModuleRecord,
  } from '@/api/system-module'

  const router = useRouter()
  const loading = ref(false)
  const rows = ref<SystemModuleRecord[]>([])
  const query = reactive({ keyword: '', source: '', status: '' })

  const loadData = async () => {
    loading.value = true
    try {
      rows.value = await fetchSystemModules(query)
    } finally {
      loading.value = false
    }
  }

  const setStatus = async (code: string, status: string) => {
    await updateSystemModuleStatus(code, status)
    ElMessage.success('状态已更新')
    await loadData()
  }

  const handleRegisterBuiltIns = async () => {
    await registerBuiltInSystemModules()
    ElMessage.success('内置模块已同步')
    await loadData()
  }

  const goDetail = (code: string) => {
    router.push({ path: '/system/modules/detail', query: { code } })
  }

  onMounted(loadData)
</script>

<style lang="scss" scoped>
  .system-module-page {
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .filters {
      display: flex;
      align-items: center;
      gap: 8px;

      .el-input {
        width: 220px;
      }

      .el-select {
        width: 130px;
      }
    }
  }
</style>
```

- [ ] **Step 3: Add detail page**

```vue
<!-- web/src/views/system/modules/detail.vue -->
<template>
  <div class="system-module-detail">
    <el-page-header @back="router.back()">
      <template #content>
        <span>{{ detail?.name || code }}</span>
      </template>
    </el-page-header>

    <el-card v-loading="loading" shadow="never" class="summary">
      <el-descriptions :column="3" border>
        <el-descriptions-item label="编码">{{ detail?.code }}</el-descriptions-item>
        <el-descriptions-item label="来源">{{ detail?.source }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ detail?.version }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detail?.status }}</el-descriptions-item>
        <el-descriptions-item label="健康">{{ detail?.health_status }}</el-descriptions-item>
        <el-descriptions-item label="入口">{{ detail?.entry_route }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-tabs model-value="manifest">
      <el-tab-pane label="Manifest" name="manifest">
        <el-input :model-value="json(detail?.manifest)" type="textarea" :rows="14" readonly />
      </el-tab-pane>
      <el-tab-pane label="依赖" name="dependencies">
        <el-table :data="detail?.dependencies || []">
          <el-table-column prop="dependsOnCode" label="依赖模块" />
          <el-table-column prop="versionRange" label="版本范围" />
          <el-table-column prop="required" label="必需" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="权限" name="permissions">
        <el-table :data="detail?.permissions || []">
          <el-table-column prop="permissionSlug" label="权限标识" />
          <el-table-column prop="bindingType" label="绑定类型" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="API" name="apis">
        <el-table :data="detail?.apis || []">
          <el-table-column prop="method" label="方法" width="100" />
          <el-table-column prop="path" label="路径" />
          <el-table-column prop="permissionSlug" label="权限" />
          <el-table-column prop="tenantScoped" label="租户域" width="100" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="事件" name="events">
        <el-timeline>
          <el-timeline-item v-for="event in detail?.events || []" :key="event.id" :timestamp="String(event.create_time || event.createTime || '')">
            <el-tag :type="event.status === 'success' ? 'success' : 'danger'">{{ event.status }}</el-tag>
            <span class="event-message">{{ event.message }}</span>
          </el-timeline-item>
        </el-timeline>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { fetchSystemModule, type SystemModuleRecord } from '@/api/system-module'

  const route = useRoute()
  const router = useRouter()
  const code = String(route.query.code || '')
  const loading = ref(false)
  const detail = ref<(SystemModuleRecord & { dependencies?: any[]; permissions?: any[]; apis?: any[]; events?: any[] }) | null>(null)

  const json = (value: any) => JSON.stringify(value || {}, null, 2)

  const loadData = async () => {
    if (!code) return
    loading.value = true
    try {
      detail.value = await fetchSystemModule(code)
    } finally {
      loading.value = false
    }
  }

  onMounted(loadData)
</script>

<style lang="scss" scoped>
  .system-module-detail {
    .summary {
      margin: 16px 0;
    }

    .event-message {
      margin-left: 8px;
    }
  }
</style>
```

- [ ] **Step 4: Run frontend type/build check and commit**

Run:

```powershell
cd web
pnpm.cmd run build
```

Expected: PASS, allowing existing warnings unrelated to these files.

Commit:

```powershell
git add web/src/api/system-module.ts web/src/views/system/modules
git commit -m "feat: add system module platform UI"
```

### Task 7: Add tenant module UI

**Files:**
- Create: `web/src/views/saas/tenant/modules/index.vue`

- [ ] **Step 1: Add tenant module page**

```vue
<!-- web/src/views/saas/tenant/modules/index.vue -->
<template>
  <div class="tenant-module-page">
    <el-card shadow="never">
      <template #header>
        <div class="toolbar">
          <span>租户模块</span>
          <el-button :icon="Refresh" @click="loadData">刷新</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="rows" row-key="code">
        <el-table-column prop="name" label="模块" min-width="180">
          <template #default="{ row }">
            <div class="module-name">
              <span>{{ row.name }}</span>
              <small>{{ row.code }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="version" label="版本" width="100" />
        <el-table-column prop="entitlement_source" label="来源" width="120" />
        <el-table-column prop="tenant_enabled" label="租户状态" width="130">
          <template #default="{ row }">
            <el-tag :type="row.tenant_enabled ? 'success' : 'info'">{{ row.tenant_enabled ? '可用' : '由套餐决定' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="平台状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'enabled' ? 'success' : 'danger'">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="entry_route" label="入口" min-width="180">
          <template #default="{ row }">
            <el-button v-if="row.entry_route" link type="primary" @click="go(row.entry_route)">进入</el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { Refresh } from '@element-plus/icons-vue'
  import { fetchTenantSystemModules, type SystemModuleRecord } from '@/api/system-module'

  const router = useRouter()
  const loading = ref(false)
  const rows = ref<SystemModuleRecord[]>([])

  const loadData = async () => {
    loading.value = true
    try {
      rows.value = await fetchTenantSystemModules()
    } finally {
      loading.value = false
    }
  }

  const go = (path: string) => {
    router.push(path)
  }

  onMounted(loadData)
</script>

<style lang="scss" scoped>
  .tenant-module-page {
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .module-name {
      display: flex;
      flex-direction: column;
      gap: 2px;

      small {
        color: var(--el-text-color-secondary);
      }
    }
  }
</style>
```

- [ ] **Step 2: Run frontend build and commit**

Run:

```powershell
cd web
pnpm.cmd run build
```

Expected: PASS, allowing existing warnings unrelated to these files.

Commit:

```powershell
git add web/src/views/saas/tenant/modules/index.vue web/src/api/system-module.ts
git commit -m "feat: add tenant system module UI"
```

---

## P3 - Plugin Metadata Registration

### Task 8: Add metadata-only plugin module registration

**Files:**
- Create: `server/src/module/system-module/dto/plugin-module-manifest.dto.ts`
- Modify: `server/src/module/system-module/services/system-module-registry.service.ts`
- Modify: `server/src/module/system-module/system-module-platform.controller.ts`
- Test: `server/src/module/system-module/services/system-module-registry.service.spec.ts`

- [ ] **Step 1: Add plugin manifest DTO**

```ts
// server/src/module/system-module/dto/plugin-module-manifest.dto.ts
import { IsArray, IsIn, IsObject, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PluginDependencyDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  version?: string;
}

export class PluginModuleManifestDto {
  @Matches(/^[a-z][a-z0-9_]{2,79}$/)
  code: string;

  @IsString()
  name: string;

  @IsIn(['plugin'])
  source: 'plugin';

  @Matches(/^\d+\.\d+\.\d+$/)
  version: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PluginDependencyDto)
  dependencies?: PluginDependencyDto[];

  @IsOptional()
  @IsArray()
  permissions?: string[];

  @IsOptional()
  @IsArray()
  routes?: string[];

  @IsOptional()
  @IsArray()
  api_endpoints?: Array<{ method: string; path: string; permission_slug?: string; tenant_scoped?: boolean }>;

  @IsOptional()
  @IsObject()
  config_schema?: Record<string, any>;

  @IsOptional()
  @IsObject()
  hooks?: Record<string, string>;
}
```

- [ ] **Step 2: Add registry method with hook safety**

Add to `SystemModuleRegistryService`:

```ts
async registerPluginManifest(dto: PluginModuleManifestDto, operatorId?: number) {
  const hooks = dto.hooks || {};
  const unsafeHook = Object.values(hooks).find((value) => value && value !== 'reserved');
  if (unsafeHook) {
    throw new BadRequestException('Plugin hooks are metadata-only and must use reserved values');
  }

  await this.importManifests([
    {
      code: dto.code,
      name: dto.name,
      source: 'plugin',
      version: dto.version,
      description: dto.description || '',
      category: dto.category || 'plugin',
      icon: dto.icon || 'ri:puzzle-line',
      status: 'installed',
      entryRoute: '',
      sort: 500,
      dependencies: (dto.dependencies || []).map((dependency) => ({
        code: dependency.code,
        versionRange: dependency.version || '',
        required: true,
      })),
      permissions: dto.permissions || [],
      apis: (dto.api_endpoints || []).map((api) => ({
        method: api.method,
        path: api.path,
        permissionSlug: api.permission_slug || '',
        tenantScoped: Boolean(api.tenant_scoped),
      })),
      configSchema: dto.config_schema || {},
    },
  ], operatorId);

  return this.getModule(dto.code);
}
```

- [ ] **Step 3: Add platform endpoint**

Add to `SystemModulePlatformController`:

```ts
@Post('plugins/register')
@ApiOperation({ summary: 'Register plugin module metadata' })
@RequirePermission('system:module:install')
registerPlugin(@Body() body: PluginModuleManifestDto, @User() user: UserDto) {
  return this.runOutsideTenant(user, () => this.registry.registerPluginManifest(body, user?.userId).then((data) => ResultData.ok(data)));
}
```

Also import:

```ts
import { PluginModuleManifestDto } from './dto/plugin-module-manifest.dto';
```

- [ ] **Step 4: Extend registry tests**

Add these cases to `system-module-registry.service.spec.ts`:

```ts
it('registers plugin manifests as installed metadata', async () => {
  const moduleRepo = makeRepo();
  const service = new SystemModuleRegistryService(
    moduleRepo as any,
    makeRepo() as any,
    makeRepo() as any,
    makeRepo() as any,
    makeRepo() as any,
    makeRepo() as any,
  );

  await service.registerPluginManifest({
    code: 'example_plugin',
    name: 'Example Plugin',
    source: 'plugin',
    version: '1.0.0',
    hooks: { install: 'reserved' },
  } as any, 3);

  expect(moduleRepo.rows[0]).toMatchObject({ code: 'example_plugin', source: 'plugin', status: 'installed' });
});

it('rejects executable plugin hook values', async () => {
  const service = new SystemModuleRegistryService(
    makeRepo() as any,
    makeRepo() as any,
    makeRepo() as any,
    makeRepo() as any,
    makeRepo() as any,
    makeRepo() as any,
  );

  await expect(service.registerPluginManifest({
    code: 'bad_plugin',
    name: 'Bad Plugin',
    source: 'plugin',
    version: '1.0.0',
    hooks: { install: 'node ./install.js' },
  } as any)).rejects.toBeInstanceOf(BadRequestException);
});
```

- [ ] **Step 5: Run backend focused tests and commit**

Run:

```powershell
cd server
pnpm.cmd exec jest src/module/system-module/services/system-module-registry.service.spec.ts src/module/system-module/system-module-platform.controller.spec.ts --runInBand
```

Expected: PASS.

Commit:

```powershell
git add server/src/module/system-module
git commit -m "feat: add plugin module metadata registration"
```

---

## Final Verification

- [ ] **Step 1: Run backend system-module tests**

```powershell
cd server
pnpm.cmd exec jest src/module/system-module src/migration-specs/create-system-modules.spec.ts src/migration-specs/seed-system-modules.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend full test suite**

```powershell
cd server
pnpm.cmd exec jest --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run backend build**

```powershell
cd server
pnpm.cmd run build
```

Expected: PASS.

- [ ] **Step 4: Run frontend build**

```powershell
cd web
pnpm.cmd run build
```

Expected: PASS, allowing existing warnings that were already present before this module framework work.

- [ ] **Step 5: Review git state**

```powershell
git status --short
```

Expected:

```text
 M server/pnpm-lock.yaml
?? .codebase-memory/
?? .codegraph/
```

Only these pre-existing local files should remain uncommitted. All system module framework implementation files should be committed.

---

## Self-Review

Spec coverage:
- Registry tables, built-in manifests, lifecycle events, and status changes are covered by P0.
- Platform admin APIs and read UI are covered by P0 and P2.
- Tenant module visibility from session tenant context is covered by P1 and P2.
- Ordinary user access gates are covered by `SystemModuleAccessService` in P1.
- Existing SaaS product modules remain intact; P1 adds only read-time SaaS feature derivation.
- Plugin support is metadata-only and hook-safe in P3.

Risk controls:
- No executable plugin code is loaded or run.
- Tenant id comes from `getTenantId()` for tenant APIs.
- `saas_module` is not replaced or renamed.
- The first SaaS bridge is an in-code derivation map, which avoids a risky data migration while the model stabilizes.
