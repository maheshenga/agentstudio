# SaaS Module Bridge Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move SaaS commercial module to system module entitlement bridging out of hardcoded runtime logic and into a database-backed configuration table.

**Architecture:** Add a `system_module_saas_bridge` table and TypeORM entity that stores enabled SaaS module to system module pairs. Runtime entitlement resolution will read enabled bridge rows from the repository, while the existing `SAAS_TO_SYSTEM_MODULE_BRIDGE` constant remains as seed data and a bootstrap fallback when the table is empty.

**Tech Stack:** NestJS, TypeORM, MySQL migrations, Jest unit tests.

---

## File Structure

- Create `server/src/module/system-module/entities/system-module-saas-bridge.entity.ts`
  - Owns the TypeORM mapping for `system_module_saas_bridge`.
  - Keeps indexes and audit columns consistent with current system module entities.
- Create `server/src/migrations/1760000000023-CreateSystemModuleSaasBridge.ts`
  - Creates the bridge table.
  - Seeds the existing bridge pairs from `SAAS_TO_SYSTEM_MODULE_BRIDGE`.
  - Rolls back only the seeded bridge table.
- Create `server/src/migration-specs/create-system-module-saas-bridge.spec.ts`
  - Verifies table, indexes, seed SQL, rollback order, and seeded values.
- Modify `server/src/module/system-module/system-module.module.ts`
  - Registers the new entity in `TypeOrmModule.forFeature`.
- Modify `server/src/module/system-module/services/system-module-access.service.ts`
  - Injects bridge repository.
  - Uses enabled bridge rows for `isTenantEntitled`.
  - Falls back to the legacy constant only when no bridge rows exist for tenant SaaS modules.
- Modify `server/src/module/system-module/services/system-module-access.service.spec.ts`
  - Adds repository-backed bridge entitlement tests.
  - Keeps explicit tenant module precedence.
  - Covers disabled bridge rows and legacy fallback.
- Modify `server/src/module/system-module/services/system-module-registry.service.ts`
  - Injects bridge repository.
  - Resolves plan-enabled system module codes through bridge rows.
  - Uses legacy fallback only when the bridge table has no relevant rows.
- Modify `server/src/module/system-module/services/system-module-registry.service.spec.ts`
  - Adds repository-backed list behavior tests.
  - Covers disabled bridge rows and legacy fallback.

---

### Task 1: Migration And Entity

**Files:**
- Create: `server/src/module/system-module/entities/system-module-saas-bridge.entity.ts`
- Create: `server/src/migrations/1760000000023-CreateSystemModuleSaasBridge.ts`
- Create: `server/src/migration-specs/create-system-module-saas-bridge.spec.ts`
- Modify: `server/src/module/system-module/system-module.module.ts`

- [ ] **Step 1: Write failing migration spec**

Create `server/src/migration-specs/create-system-module-saas-bridge.spec.ts`:

```typescript
import { CreateSystemModuleSaasBridge1760000000023 } from '../migrations/1760000000023-CreateSystemModuleSaasBridge';

describe('CreateSystemModuleSaasBridge1760000000023', () => {
  it('creates and seeds the system module SaaS bridge table', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateSystemModuleSaasBridge1760000000023().up(queryRunner as any);

    const calls = queryRunner.query.mock.calls;
    const sql = calls.map(([statement]) => String(statement)).join('\n');
    const params = calls.flatMap(([, values]) => values || []);

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `system_module_saas_bridge`');
    expect(sql).toContain('UNIQUE KEY `uk_system_module_saas_bridge_pair` (`saas_module_code`, `system_module_code`)');
    expect(sql).toContain('KEY `idx_system_module_saas_bridge_saas` (`saas_module_code`)');
    expect(sql).toContain('KEY `idx_system_module_saas_bridge_system` (`system_module_code`)');
    expect(sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(sql).toContain('`delete_time` = NULL');
    expect(params).toEqual(
      expect.arrayContaining([
        'ai_chat',
        'ai_console',
        'taixu_workspace',
        'member_management',
        'tenant_saas',
        'advanced_report',
        'saas_platform',
      ]),
    );
  });

  it('drops only the bridge table on rollback', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };

    await new CreateSystemModuleSaasBridge1760000000023().down(queryRunner as any);

    expect(queryRunner.query.mock.calls.map(([statement]) => statement)).toEqual([
      'DROP TABLE IF EXISTS `system_module_saas_bridge`',
    ]);
  });
});
```

- [ ] **Step 2: Run migration spec to verify RED**

Run:

```bash
cd server
pnpm.cmd exec jest src/migration-specs/create-system-module-saas-bridge.spec.ts --runInBand
```

Expected: FAIL because `1760000000023-CreateSystemModuleSaasBridge` does not exist.

- [ ] **Step 3: Add entity**

Create `server/src/module/system-module/entities/system-module-saas-bridge.entity.ts`:

```typescript
import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Index('uk_system_module_saas_bridge_pair', ['saasModuleCode', 'systemModuleCode'], { unique: true })
@Index('idx_system_module_saas_bridge_saas', ['saasModuleCode'])
@Index('idx_system_module_saas_bridge_system', ['systemModuleCode'])
@Entity('system_module_saas_bridge')
export class SystemModuleSaasBridgeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'saas_module_code', length: 50 })
  saasModuleCode: string;

  @Column({ type: 'varchar', name: 'system_module_code', length: 80 })
  systemModuleCode: string;

  @Column({ type: 'tinyint', name: 'enabled', default: 1 })
  enabled: number;

  @Column({ type: 'varchar', name: 'source', length: 20, default: 'seed' })
  source: string;

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

- [ ] **Step 4: Add migration**

Create `server/src/migrations/1760000000023-CreateSystemModuleSaasBridge.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

const BRIDGE_ROWS = [
  ['ai_chat', 'ai_console'],
  ['ai_chat', 'taixu_workspace'],
  ['rag', 'taixu_workspace'],
  ['member_management', 'tenant_saas'],
  ['resource_pack', 'tenant_saas'],
  ['advanced_report', 'saas_platform'],
] as const;

export class CreateSystemModuleSaasBridge1760000000023 implements MigrationInterface {
  name = 'CreateSystemModuleSaasBridge1760000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`system_module_saas_bridge\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`saas_module_code\` varchar(50) NOT NULL,
        \`system_module_code\` varchar(80) NOT NULL,
        \`enabled\` tinyint NOT NULL DEFAULT 1,
        \`source\` varchar(20) NOT NULL DEFAULT 'seed',
        \`remark\` varchar(255) NULL,
        \`create_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP,
        \`update_time\` datetime NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`delete_time\` datetime NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_system_module_saas_bridge_pair\` (\`saas_module_code\`, \`system_module_code\`),
        KEY \`idx_system_module_saas_bridge_saas\` (\`saas_module_code\`),
        KEY \`idx_system_module_saas_bridge_system\` (\`system_module_code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    for (const [saasModuleCode, systemModuleCode] of BRIDGE_ROWS) {
      await queryRunner.query(
        `
          INSERT INTO \`system_module_saas_bridge\` (
            \`saas_module_code\`,
            \`system_module_code\`,
            \`enabled\`,
            \`source\`,
            \`remark\`
          )
          VALUES (?, ?, 1, 'seed', 'Seeded SaaS to system module bridge')
          ON DUPLICATE KEY UPDATE
            \`delete_time\` = NULL
        `,
        [saasModuleCode, systemModuleCode],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `system_module_saas_bridge`');
  }
}
```

- [ ] **Step 5: Register entity in module**

Modify `server/src/module/system-module/system-module.module.ts`:

```typescript
import { SystemModuleSaasBridgeEntity } from './entities/system-module-saas-bridge.entity';

TypeOrmModule.forFeature([
  SystemModuleEntity,
  SystemModuleDependencyEntity,
  SystemModulePermissionEntity,
  SystemModuleApiEntity,
  SystemModuleMenuEntity,
  SystemTenantModuleEntity,
  SystemModuleEventEntity,
  SystemModuleSaasBridgeEntity,
])
```

- [ ] **Step 6: Run migration spec to verify GREEN**

Run:

```bash
cd server
pnpm.cmd exec jest src/migration-specs/create-system-module-saas-bridge.spec.ts --runInBand
```

Expected: PASS.

---

### Task 2: Access Service Bridge Resolution

**Files:**
- Modify: `server/src/module/system-module/services/system-module-access.service.spec.ts`
- Modify: `server/src/module/system-module/services/system-module-access.service.ts`

- [ ] **Step 1: Write failing access tests**

Modify `createService` in `system-module-access.service.spec.ts` to accept `bridgeRows` and pass a `SystemModuleSaasBridgeEntity` repository. Add tests:

```typescript
it('uses enabled database bridge rows for SaaS plan entitlement', async () => {
  const { service } = createService({
    modules: [enabledModule('custom_workspace')],
    bridgeRows: [{ saasModuleCode: 'custom_ai', systemModuleCode: 'custom_workspace', enabled: 1 }],
  });

  await expect(
    service.assertModuleAccess({
      tenantId: 10,
      moduleCode: 'custom_workspace',
      saasModuleCodes: ['custom_ai'],
    }),
  ).resolves.toBe(true);
});

it('ignores disabled database bridge rows', async () => {
  const { service } = createService({
    modules: [enabledModule('custom_workspace')],
    bridgeRows: [{ saasModuleCode: 'custom_ai', systemModuleCode: 'custom_workspace', enabled: 0 }],
  });

  await expect(
    service.assertModuleAccess({
      tenantId: 10,
      moduleCode: 'custom_workspace',
      saasModuleCodes: ['custom_ai'],
    }),
  ).rejects.toThrow('Tenant has not enabled this module');
});

it('falls back to legacy bridge constants when no database bridge rows exist', async () => {
  const { service } = createService({
    modules: [enabledModule('ai_console')],
    bridgeRows: [],
  });

  await expect(
    service.assertModuleAccess({
      tenantId: 10,
      moduleCode: 'ai_console',
      saasModuleCodes: ['ai_chat'],
    }),
  ).resolves.toBe(true);
});
```

- [ ] **Step 2: Run access spec to verify RED**

Run:

```bash
cd server
pnpm.cmd exec jest src/module/system-module/services/system-module-access.service.spec.ts --runInBand
```

Expected: FAIL because constructor and bridge repository behavior are not implemented.

- [ ] **Step 3: Implement access bridge lookup**

Modify `SystemModuleAccessService`:

```typescript
import { In, IsNull, Repository } from 'typeorm';
import { SystemModuleSaasBridgeEntity } from '../entities/system-module-saas-bridge.entity';

constructor(
  @InjectRepository(SystemModuleEntity)
  private readonly moduleRepo: Repository<SystemModuleEntity>,
  @InjectRepository(SystemModuleDependencyEntity)
  private readonly dependencyRepo: Repository<SystemModuleDependencyEntity>,
  @InjectRepository(SystemTenantModuleEntity)
  private readonly tenantModuleRepo: Repository<SystemTenantModuleEntity>,
  @InjectRepository(SystemModuleSaasBridgeEntity)
  private readonly bridgeRepo: Repository<SystemModuleSaasBridgeEntity>,
  private readonly saasModuleService: SaasModuleService,
) {}

private async resolveSystemModuleCodesFromSaasModules(saasModuleCodes: string[]) {
  const uniqueCodes = [...new Set(saasModuleCodes.filter(Boolean))];
  if (!uniqueCodes.length) return new Set<string>();

  const bridgeRows = await this.bridgeRepo.find({
    where: {
      saasModuleCode: In(uniqueCodes),
      deleteTime: IsNull(),
    },
  });

  if (bridgeRows.length) {
    return new Set(
      bridgeRows
        .filter((row) => Number(row.enabled) === 1)
        .map((row) => row.systemModuleCode)
        .filter(Boolean),
    );
  }

  return new Set(
    uniqueCodes.flatMap((saasModuleCode) => SAAS_TO_SYSTEM_MODULE_BRIDGE[saasModuleCode] || []),
  );
}
```

Use it in `isTenantEntitled`:

```typescript
const entitledSystemModuleCodes = await this.resolveSystemModuleCodesFromSaasModules(tenantSaasModuleCodes);
return entitledSystemModuleCodes.has(moduleCode);
```

- [ ] **Step 4: Run access spec to verify GREEN**

Run:

```bash
cd server
pnpm.cmd exec jest src/module/system-module/services/system-module-access.service.spec.ts --runInBand
```

Expected: PASS.

---

### Task 3: Registry Service Bridge Resolution

**Files:**
- Modify: `server/src/module/system-module/services/system-module-registry.service.spec.ts`
- Modify: `server/src/module/system-module/services/system-module-registry.service.ts`

- [ ] **Step 1: Write failing registry tests**

Modify `createService` to include a `bridgeRepo` registered in `MemoryDataSource`. Add tests:

```typescript
it('marks tenant modules enabled from database SaaS bridge rows', async () => {
  const { service, moduleRepo, bridgeRepo, saasModuleService } = createService();
  await moduleRepo.save({
    code: 'custom_workspace',
    name: 'Custom Workspace',
    source: 'built_in',
    version: '1.0.0',
    description: '',
    category: 'ai',
    icon: 'Bot',
    status: 'enabled',
    entryRoute: '/custom/workspace',
    configSchema: {},
    healthStatus: 'unknown',
    sort: 40,
  });
  await bridgeRepo.save({
    saasModuleCode: 'custom_ai',
    systemModuleCode: 'custom_workspace',
    enabled: 1,
    source: 'platform',
  });
  saasModuleService.listTenantModules.mockResolvedValue([{ code: 'custom_ai' }]);

  await expect(service.listTenantModules(23)).resolves.toEqual([
    expect.objectContaining({
      code: 'custom_workspace',
      tenant_enabled: true,
      entitlement_source: 'plan',
    }),
  ]);
});

it('does not mark tenant modules enabled from disabled database bridge rows', async () => {
  const { service, moduleRepo, bridgeRepo, saasModuleService } = createService();
  await moduleRepo.save({
    code: 'custom_workspace',
    name: 'Custom Workspace',
    source: 'built_in',
    version: '1.0.0',
    description: '',
    category: 'ai',
    icon: 'Bot',
    status: 'enabled',
    entryRoute: '/custom/workspace',
    configSchema: {},
    healthStatus: 'unknown',
    sort: 40,
  });
  await bridgeRepo.save({
    saasModuleCode: 'custom_ai',
    systemModuleCode: 'custom_workspace',
    enabled: 0,
    source: 'platform',
  });
  saasModuleService.listTenantModules.mockResolvedValue([{ code: 'custom_ai' }]);

  await expect(service.listTenantModules(23)).resolves.toEqual([
    expect.objectContaining({
      code: 'custom_workspace',
      tenant_enabled: false,
      entitlement_source: null,
    }),
  ]);
});
```

- [ ] **Step 2: Run registry spec to verify RED**

Run:

```bash
cd server
pnpm.cmd exec jest src/module/system-module/services/system-module-registry.service.spec.ts --runInBand
```

Expected: FAIL because constructor and bridge repository behavior are not implemented.

- [ ] **Step 3: Implement registry bridge lookup**

Modify `SystemModuleRegistryService`:

```typescript
import { In, IsNull, Repository } from 'typeorm';
import { SystemModuleSaasBridgeEntity } from '../entities/system-module-saas-bridge.entity';

constructor(
  private readonly dataSource: DataSource,
  @InjectRepository(SystemModuleEntity)
  private readonly moduleRepo: Repository<SystemModuleEntity>,
  @InjectRepository(SystemModuleDependencyEntity)
  private readonly dependencyRepo: Repository<SystemModuleDependencyEntity>,
  @InjectRepository(SystemModulePermissionEntity)
  private readonly permissionRepo: Repository<SystemModulePermissionEntity>,
  @InjectRepository(SystemModuleApiEntity)
  private readonly apiRepo: Repository<SystemModuleApiEntity>,
  @InjectRepository(SystemTenantModuleEntity)
  private readonly tenantModuleRepo: Repository<SystemTenantModuleEntity>,
  @InjectRepository(SystemModuleEventEntity)
  private readonly eventRepo: Repository<SystemModuleEventEntity>,
  @InjectRepository(SystemModuleSaasBridgeEntity)
  private readonly bridgeRepo: Repository<SystemModuleSaasBridgeEntity>,
  private readonly saasModuleService: SaasModuleService,
) {}
```

Add helper:

```typescript
private async resolvePlanEntitledSystemModuleCodes(saasModuleCodes: string[]) {
  const uniqueCodes = [...new Set(saasModuleCodes.filter(Boolean))];
  if (!uniqueCodes.length) return new Set<string>();

  const bridgeRows = await this.bridgeRepo.find({
    where: {
      saasModuleCode: In(uniqueCodes),
      deleteTime: IsNull(),
    },
  });

  if (bridgeRows.length) {
    return new Set(
      bridgeRows
        .filter((row) => Number(row.enabled) === 1)
        .map((row) => row.systemModuleCode)
        .filter(Boolean),
    );
  }

  return new Set(
    uniqueCodes.flatMap((saasModuleCode) => SAAS_TO_SYSTEM_MODULE_BRIDGE[saasModuleCode] || []),
  );
}
```

Use it in `listTenantModules`:

```typescript
const planEntitledModuleCodes = await this.resolvePlanEntitledSystemModuleCodes(
  saasModules.map((module) => module.code).filter((code): code is string => Boolean(code)),
);
```

- [ ] **Step 4: Run registry spec to verify GREEN**

Run:

```bash
cd server
pnpm.cmd exec jest src/module/system-module/services/system-module-registry.service.spec.ts --runInBand
```

Expected: PASS.

---

### Task 4: Focused Verification And Review

**Files:**
- Review all modified source, migration, test, and plan files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
cd server
pnpm.cmd exec jest src/migration-specs/create-system-module-saas-bridge.spec.ts src/module/system-module/services/system-module-access.service.spec.ts src/module/system-module/services/system-module-registry.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run full backend test suite**

Run:

```bash
cd server
pnpm.cmd exec jest --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run backend build**

Run:

```bash
cd server
pnpm.cmd run build
```

Expected: PASS.

- [ ] **Step 4: Diff review**

Run:

```bash
git diff --check
git diff --stat
git status --short
```

Expected:
- No whitespace errors.
- Only intended source, test, migration, and plan files are modified or untracked.
- `server/pnpm-lock.yaml`, `.codegraph/`, and `.codebase-memory/` are not included in the intended commit.

---

### Task 5: Commit

**Files:**
- Stage only the plan file, new entity, new migration, new migration spec, and modified system module service/module/spec files.

- [ ] **Step 1: Stage intended files**

Run:

```bash
git add docs/superpowers/plans/2026-07-05-saas-module-bridge-config.md \
  server/src/module/system-module/entities/system-module-saas-bridge.entity.ts \
  server/src/migrations/1760000000023-CreateSystemModuleSaasBridge.ts \
  server/src/migration-specs/create-system-module-saas-bridge.spec.ts \
  server/src/module/system-module/system-module.module.ts \
  server/src/module/system-module/services/system-module-access.service.ts \
  server/src/module/system-module/services/system-module-access.service.spec.ts \
  server/src/module/system-module/services/system-module-registry.service.ts \
  server/src/module/system-module/services/system-module-registry.service.spec.ts
```

- [ ] **Step 2: Review staged diff**

Run:

```bash
git diff --cached --stat
git diff --cached --check
```

Expected: staged diff contains only intended files and no whitespace errors.

- [ ] **Step 3: Commit**

Run:

```bash
git commit -m "feat: configure saas module bridge"
```

Expected: commit succeeds. Do not push.

---

## Self-Review

- Spec coverage: the plan covers bridge persistence, seeded compatibility, access enforcement, tenant module listing, verification, review, and commit.
- Placeholder scan: no `TBD`, `TODO`, or open-ended implementation placeholders remain.
- Type consistency: entity property names use `saasModuleCode` and `systemModuleCode`; repository helpers and tests use the same names.
