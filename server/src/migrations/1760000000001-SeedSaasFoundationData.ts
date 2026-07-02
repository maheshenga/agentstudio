import { MigrationInterface, QueryRunner } from 'typeorm';

type PlanSeed = {
  code: string;
  name: string;
  sort: number;
  remark: string;
};

type QuotaSeed = {
  planCode: string;
  quotaType: string;
  totalQuota: number;
  remark: string;
};

type ResourcePackSeed = {
  code: string;
  name: string;
  resourceType: string;
  quotaAmount: number;
  priceCents: number;
  sort: number;
  remark: string;
};

type MenuSeed = {
  name: string;
  code: string;
  type: number;
  path: string;
  component: string;
  icon: string;
  sort: number;
  remark: string;
};

type PermissionSeed = {
  parentCode: string;
  name: string;
  slug: string;
  method: string;
  sort: number;
  remark: string;
};

const PLAN_SEEDS: PlanSeed[] = [
  { code: 'free', name: 'Free', sort: 10, remark: 'Seeded free SaaS plan' },
  { code: 'pro', name: 'Pro', sort: 20, remark: 'Seeded pro SaaS plan' },
  { code: 'enterprise', name: 'Enterprise', sort: 30, remark: 'Seeded enterprise SaaS plan' },
];

const PLAN_QUOTAS: QuotaSeed[] = [
  { planCode: 'free', quotaType: 'users', totalQuota: 3, remark: 'Seeded free plan user quota' },
  { planCode: 'free', quotaType: 'storage_mb', totalQuota: 512, remark: 'Seeded free plan storage quota' },
  { planCode: 'free', quotaType: 'ai_calls', totalQuota: 100, remark: 'Seeded free plan AI call quota' },
  { planCode: 'free', quotaType: 'rag_documents', totalQuota: 10, remark: 'Seeded free plan RAG document quota' },
  { planCode: 'free', quotaType: 'tokens', totalQuota: 100000, remark: 'Seeded free plan token quota' },
  { planCode: 'pro', quotaType: 'users', totalQuota: 20, remark: 'Seeded pro plan user quota' },
  { planCode: 'pro', quotaType: 'storage_mb', totalQuota: 10240, remark: 'Seeded pro plan storage quota' },
  { planCode: 'pro', quotaType: 'ai_calls', totalQuota: 5000, remark: 'Seeded pro plan AI call quota' },
  { planCode: 'pro', quotaType: 'rag_documents', totalQuota: 500, remark: 'Seeded pro plan RAG document quota' },
  { planCode: 'pro', quotaType: 'tokens', totalQuota: 5000000, remark: 'Seeded pro plan token quota' },
  { planCode: 'enterprise', quotaType: 'users', totalQuota: 100, remark: 'Seeded enterprise plan user quota' },
  { planCode: 'enterprise', quotaType: 'storage_mb', totalQuota: 102400, remark: 'Seeded enterprise plan storage quota' },
  { planCode: 'enterprise', quotaType: 'ai_calls', totalQuota: 50000, remark: 'Seeded enterprise plan AI call quota' },
  { planCode: 'enterprise', quotaType: 'rag_documents', totalQuota: 5000, remark: 'Seeded enterprise plan RAG document quota' },
  { planCode: 'enterprise', quotaType: 'tokens', totalQuota: 50000000, remark: 'Seeded enterprise plan token quota' },
];

const RESOURCE_PACK_SEEDS: ResourcePackSeed[] = [
  {
    code: 'ai_calls_1k',
    name: 'AI Calls 1,000',
    resourceType: 'ai_calls',
    quotaAmount: 1000,
    priceCents: 9900,
    sort: 10,
    remark: 'Adds 1,000 AI calls',
  },
  {
    code: 'tokens_1m',
    name: 'Tokens 1,000,000',
    resourceType: 'tokens',
    quotaAmount: 1000000,
    priceCents: 19900,
    sort: 20,
    remark: 'Adds 1,000,000 tokens',
  },
  {
    code: 'storage_10gb',
    name: 'Storage 10GB',
    resourceType: 'storage_mb',
    quotaAmount: 10240,
    priceCents: 29900,
    sort: 30,
    remark: 'Adds 10GB storage',
  },
  {
    code: 'rag_docs_1k',
    name: 'RAG Documents 1,000',
    resourceType: 'rag_documents',
    quotaAmount: 1000,
    priceCents: 39900,
    sort: 40,
    remark: 'Adds 1,000 RAG documents',
  },
];

const PLATFORM_ROOT_MENU: MenuSeed = {
  name: 'SaaS管理',
  code: 'SaasManage',
  type: 1,
  path: '/saas-platform',
  component: '',
  icon: 'ri:apps-2-line',
  sort: 90,
  remark: 'Seeded SaaS platform menu root',
};

const PLATFORM_MENUS: MenuSeed[] = [
  {
    name: '租户管理',
    code: 'SaasTenant',
    type: 2,
    path: 'tenants',
    component: '/saas/platform/tenant',
    icon: 'ri:building-line',
    sort: 10,
    remark: 'Seeded SaaS tenant management menu',
  },
  {
    name: '套餐管理',
    code: 'SaasPlan',
    type: 2,
    path: 'plans',
    component: '/saas/platform/plan',
    icon: 'ri:price-tag-3-line',
    sort: 20,
    remark: 'Seeded SaaS plan management menu',
  },
  {
    name: '订阅管理',
    code: 'SaasSubscription',
    type: 2,
    path: 'subscriptions',
    component: '/saas/platform/subscription',
    icon: 'ri:file-list-3-line',
    sort: 30,
    remark: 'Seeded SaaS subscription management menu',
  },
  {
    name: '用量概览',
    code: 'SaasUsage',
    type: 2,
    path: 'usage',
    component: '/saas/platform/usage',
    icon: 'ri:bar-chart-box-line',
    sort: 40,
    remark: 'Seeded SaaS usage overview menu',
  },
  {
    name: 'Resource Packs',
    code: 'SaasResourcePack',
    type: 2,
    path: 'resource-packs',
    component: '/saas/platform/resource-pack',
    icon: 'ri:stack-line',
    sort: 50,
    remark: 'Seeded SaaS resource pack management menu',
  },
  {
    name: 'Resource Pack Orders',
    code: 'SaasResourcePackOrder',
    type: 2,
    path: 'resource-pack-orders',
    component: '/saas/platform/resource-pack-order',
    icon: 'ri:file-list-3-line',
    sort: 60,
    remark: 'Seeded SaaS resource pack order menu',
  },
];

const PLATFORM_PERMISSIONS: PermissionSeed[] = [
  {
    parentCode: 'SaasTenant',
    name: '数据列表',
    slug: 'saas:tenant:index',
    method: 'GET',
    sort: 10,
    remark: 'Seeded SaaS tenant list permission',
  },
  {
    parentCode: 'SaasTenant',
    name: '创建租户',
    slug: 'saas:tenant:save',
    method: 'POST',
    sort: 20,
    remark: 'Seeded SaaS tenant create permission',
  },
  {
    parentCode: 'SaasPlan',
    name: '数据列表',
    slug: 'saas:plan:index',
    method: 'GET',
    sort: 10,
    remark: 'Seeded SaaS plan list permission',
  },
  {
    parentCode: 'SaasPlan',
    name: '修改',
    slug: 'saas:plan:update',
    method: 'PUT',
    sort: 20,
    remark: 'Seeded SaaS plan update permission',
  },
  {
    parentCode: 'SaasSubscription',
    name: '数据列表',
    slug: 'saas:subscription:list',
    method: 'GET',
    sort: 10,
    remark: 'Seeded SaaS subscription list permission',
  },
  {
    parentCode: 'SaasSubscription',
    name: 'Order list',
    slug: 'saas:order:list',
    method: 'GET',
    sort: 20,
    remark: 'Seeded SaaS order list permission',
  },
  {
    parentCode: 'SaasUsage',
    name: '数据列表',
    slug: 'saas:usage:index',
    method: 'GET',
    sort: 10,
    remark: 'Seeded SaaS usage list permission',
  },
  {
    parentCode: 'SaasResourcePack',
    name: 'List',
    slug: 'saas:resource-pack:index',
    method: 'GET',
    sort: 10,
    remark: 'Seeded SaaS resource pack list permission',
  },
  {
    parentCode: 'SaasResourcePackOrder',
    name: 'List',
    slug: 'saas:resource-pack-order:list',
    method: 'GET',
    sort: 10,
    remark: 'Seeded SaaS resource pack order list permission',
  },
];

const TENANT_ROOT_MENU: MenuSeed = {
  name: '订阅服务',
  code: 'TenantSaas',
  type: 1,
  path: '/tenant-saas',
  component: '',
  icon: 'ri:vip-crown-2-line',
  sort: 95,
  remark: 'Seeded tenant SaaS menu root',
};

const TENANT_MENUS: MenuSeed[] = [
  {
    name: '套餐概览',
    code: 'TenantBilling',
    type: 2,
    path: 'plan',
    component: '/saas/tenant/plan',
    icon: 'ri:bank-card-line',
    sort: 10,
    remark: 'Seeded tenant billing menu',
  },
  {
    name: '用量中心',
    code: 'TenantQuota',
    type: 2,
    path: 'usage',
    component: '/saas/tenant/usage',
    icon: 'ri:pie-chart-2-line',
    sort: 20,
    remark: 'Seeded tenant quota menu',
  },
  {
    name: 'Resource Packs',
    code: 'TenantResourcePack',
    type: 2,
    path: 'resource-packs',
    component: '/saas/tenant/resource-pack',
    icon: 'ri:stack-line',
    sort: 30,
    remark: 'Seeded tenant resource pack menu',
  },
];

const TENANT_PERMISSIONS: PermissionSeed[] = [
  {
    parentCode: 'TenantBilling',
    name: '查看',
    slug: 'tenant:billing:view',
    method: 'GET',
    sort: 10,
    remark: 'Seeded tenant billing view permission',
  },
  {
    parentCode: 'TenantBilling',
    name: '升级套餐',
    slug: 'tenant:billing:upgrade',
    method: 'POST',
    sort: 20,
    remark: 'Seeded tenant billing upgrade permission',
  },
  {
    parentCode: 'TenantQuota',
    name: '查看',
    slug: 'tenant:quota:view',
    method: 'GET',
    sort: 10,
    remark: 'Seeded tenant quota view permission',
  },
  {
    parentCode: 'TenantQuota',
    name: '购买资源包',
    slug: 'tenant:resource:buy',
    method: 'POST',
    sort: 20,
    remark: 'Seeded tenant resource pack purchase permission',
  },
  {
    parentCode: 'TenantResourcePack',
    name: 'View',
    slug: 'tenant:resource-pack:view',
    method: 'GET',
    sort: 10,
    remark: 'Seeded tenant resource pack view permission',
  },
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
  },
];

export class SeedSaasFoundationData1760000000001 implements MigrationInterface {
  name = 'SeedSaasFoundationData1760000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const plan of PLAN_SEEDS) {
      await this.insertPlan(queryRunner, plan);
    }

    for (const quota of PLAN_QUOTAS) {
      await this.insertPlanQuota(queryRunner, quota);
    }

    for (const pack of RESOURCE_PACK_SEEDS) {
      await this.insertResourcePack(queryRunner, pack);
    }

    await this.insertRootMenuUnderSystem(queryRunner, PLATFORM_ROOT_MENU);
    for (const menu of PLATFORM_MENUS) {
      await this.insertChildMenu(queryRunner, PLATFORM_ROOT_MENU.code, menu);
    }
    for (const permission of PLATFORM_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }

    await this.insertTopLevelRootMenu(queryRunner, TENANT_ROOT_MENU);
    for (const menu of TENANT_MENUS) {
      await this.insertChildMenu(queryRunner, TENANT_ROOT_MENU.code, menu);
    }
    for (const permission of TENANT_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM \`saas_resource_pack\`
      WHERE \`code\` IN ('ai_calls_1k', 'tokens_1m', 'storage_10gb', 'rag_docs_1k')
    `);

    await queryRunner.query(`
      DELETE FROM \`saas_plan_quota\`
      WHERE \`plan_id\` IN (
        SELECT \`id\`
        FROM \`saas_plan\`
        WHERE \`code\` IN ('free', 'pro', 'enterprise')
      )
      AND \`quota_type\` IN ('users', 'storage_mb', 'ai_calls', 'rag_documents', 'tokens')
    `);

    await queryRunner.query(`
      DELETE FROM \`saas_plan\`
      WHERE \`code\` IN ('free', 'pro', 'enterprise')
    `);

    const platformPermissionIds = await this.fetchMenuIds(queryRunner, `
      SELECT \`id\`
      FROM \`sa_system_menu\`
      WHERE \`slug\` IN (
        'saas:tenant:index',
        'saas:tenant:save',
        'saas:plan:index',
        'saas:plan:update',
        'saas:subscription:index',
        'saas:subscription:list',
        'saas:order:list',
        'saas:usage:index',
        'saas:resource-pack:index',
        'saas:resource-pack-order:list'
      )
      AND \`delete_time\` IS NULL
    `);
    await this.deleteMenusByIds(queryRunner, platformPermissionIds);

    const tenantPermissionIds = await this.fetchMenuIds(queryRunner, `
      SELECT \`id\`
      FROM \`sa_system_menu\`
      WHERE \`slug\` IN (
        'tenant:billing:view',
        'tenant:billing:upgrade',
        'tenant:quota:view',
        'tenant:resource:buy',
        'tenant:resource-pack:view',
        'tenant:resource-pack-order:create',
        'tenant:resource-pack-order:view',
        'tenant:resource-pack-order:pay'
      )
      AND \`delete_time\` IS NULL
    `);
    await this.deleteMenusByIds(queryRunner, tenantPermissionIds);

    const platformMenuIds = await this.fetchMenuIds(queryRunner, `
      SELECT \`id\`
      FROM \`sa_system_menu\`
      WHERE \`code\` IN ('SaasTenant', 'SaasPlan', 'SaasSubscription', 'SaasUsage', 'SaasResourcePack', 'SaasResourcePackOrder')
      AND \`delete_time\` IS NULL
    `);
    await this.deleteMenusByIds(queryRunner, platformMenuIds);

    const tenantMenuIds = await this.fetchMenuIds(queryRunner, `
      SELECT \`id\`
      FROM \`sa_system_menu\`
      WHERE \`code\` IN ('TenantBilling', 'TenantQuota', 'TenantResourcePack')
      AND \`delete_time\` IS NULL
    `);
    await this.deleteMenusByIds(queryRunner, tenantMenuIds);

    const platformRootIds = await this.fetchMenuIds(queryRunner, `
      SELECT \`id\`
      FROM \`sa_system_menu\`
      WHERE \`code\` = 'SaasManage'
        AND \`path\` = '/saas-platform'
        AND \`type\` = 1
        AND \`component\` = ''
        AND \`delete_time\` IS NULL
    `);
    await this.deleteMenusByIds(queryRunner, platformRootIds);

    const tenantRootIds = await this.fetchMenuIds(queryRunner, `
      SELECT \`id\`
      FROM \`sa_system_menu\`
      WHERE \`code\` = 'TenantSaas'
        AND \`path\` = '/tenant-saas'
        AND \`type\` = 1
        AND \`component\` = ''
        AND \`delete_time\` IS NULL
    `);
    await this.deleteMenusByIds(queryRunner, tenantRootIds);
  }

  private async insertPlan(queryRunner: QueryRunner, plan: PlanSeed): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`saas_plan\` (\`code\`, \`name\`, \`billing_cycle\`, \`status\`, \`sort\`, \`remark\`)
        VALUES (?, ?, 'monthly', 1, ?, ?)
        ON DUPLICATE KEY UPDATE
          \`name\` = VALUES(\`name\`),
          \`billing_cycle\` = VALUES(\`billing_cycle\`),
          \`status\` = VALUES(\`status\`),
          \`sort\` = VALUES(\`sort\`),
          \`remark\` = VALUES(\`remark\`),
          \`delete_time\` = NULL
      `,
      [plan.code, plan.name, plan.sort, plan.remark],
    );
  }

  private async insertPlanQuota(
    queryRunner: QueryRunner,
    quota: QuotaSeed,
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`saas_plan_quota\` (\`plan_id\`, \`quota_type\`, \`total_quota\`, \`status\`, \`remark\`)
        SELECT \`plan\`.\`id\`, ?, ?, 1, ?
        FROM \`saas_plan\` \`plan\`
        WHERE \`plan\`.\`code\` = ?
          AND \`plan\`.\`delete_time\` IS NULL
        ON DUPLICATE KEY UPDATE
          \`total_quota\` = VALUES(\`total_quota\`),
          \`status\` = VALUES(\`status\`),
          \`remark\` = VALUES(\`remark\`),
          \`delete_time\` = NULL,
          \`update_time\` = NOW()
      `,
      [quota.quotaType, quota.totalQuota, quota.remark, quota.planCode],
    );
  }

  private async insertResourcePack(queryRunner: QueryRunner, pack: ResourcePackSeed): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`saas_resource_pack\` (
          \`code\`,
          \`name\`,
          \`resource_type\`,
          \`quota_amount\`,
          \`price_cents\`,
          \`currency\`,
          \`status\`,
          \`sort\`,
          \`remark\`
        )
        VALUES (?, ?, ?, ?, ?, 'CNY', 1, ?, ?)
        ON DUPLICATE KEY UPDATE
          \`name\` = VALUES(\`name\`),
          \`resource_type\` = VALUES(\`resource_type\`),
          \`quota_amount\` = VALUES(\`quota_amount\`),
          \`price_cents\` = VALUES(\`price_cents\`),
          \`currency\` = VALUES(\`currency\`),
          \`status\` = VALUES(\`status\`),
          \`sort\` = VALUES(\`sort\`),
          \`remark\` = VALUES(\`remark\`),
          \`delete_time\` = NULL,
          \`update_time\` = NOW()
      `,
      [pack.code, pack.name, pack.resourceType, pack.quotaAmount, pack.priceCents, pack.sort, pack.remark],
    );
  }

  private async insertRootMenuUnderSystem(queryRunner: QueryRunner, menu: MenuSeed): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_menu\` (
          \`parent_id\`,
          \`name\`,
          \`code\`,
          \`slug\`,
          \`type\`,
          \`path\`,
          \`component\`,
          \`icon\`,
          \`sort\`,
          \`status\`,
          \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, ?, NULL, ?, ?, ?, ?, ?, 1, ?
        FROM \`sa_system_menu\` \`parent\`
        WHERE \`parent\`.\`code\` = 'System'
          AND \`parent\`.\`path\` = '/system'
          AND \`parent\`.\`type\` = 1
          AND \`parent\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM \`sa_system_menu\`
            WHERE \`code\` = ?
              AND \`delete_time\` IS NULL
          )
        ORDER BY \`parent\`.\`id\` ASC
        LIMIT 1
      `,
      [
        menu.name,
        menu.code,
        menu.type,
        menu.path,
        menu.component,
        menu.icon,
        menu.sort,
        menu.remark,
        menu.code,
      ],
    );
  }

  private async insertTopLevelRootMenu(queryRunner: QueryRunner, menu: MenuSeed): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_menu\` (
          \`parent_id\`,
          \`name\`,
          \`code\`,
          \`slug\`,
          \`type\`,
          \`path\`,
          \`component\`,
          \`icon\`,
          \`sort\`,
          \`status\`,
          \`remark\`
        )
        SELECT 0, ?, ?, NULL, ?, ?, ?, ?, ?, 1, ?
        FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1
          FROM \`sa_system_menu\`
          WHERE \`code\` = ?
            AND \`delete_time\` IS NULL
        )
      `,
      [
        menu.name,
        menu.code,
        menu.type,
        menu.path,
        menu.component,
        menu.icon,
        menu.sort,
        menu.remark,
        menu.code,
      ],
    );
  }

  private async insertChildMenu(
    queryRunner: QueryRunner,
    parentCode: string,
    menu: MenuSeed,
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_menu\` (
          \`parent_id\`,
          \`name\`,
          \`code\`,
          \`slug\`,
          \`type\`,
          \`path\`,
          \`component\`,
          \`icon\`,
          \`sort\`,
          \`status\`,
          \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, ?, NULL, ?, ?, ?, ?, ?, 1, ?
        FROM \`sa_system_menu\` \`parent\`
        WHERE \`parent\`.\`code\` = ?
          AND \`parent\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM \`sa_system_menu\`
            WHERE \`code\` = ?
              AND \`delete_time\` IS NULL
          )
        ORDER BY \`parent\`.\`id\` ASC
        LIMIT 1
      `,
      [
        menu.name,
        menu.code,
        menu.type,
        menu.path,
        menu.component,
        menu.icon,
        menu.sort,
        menu.remark,
        parentCode,
        menu.code,
      ],
    );
  }

  private async insertPermission(
    queryRunner: QueryRunner,
    permission: PermissionSeed,
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`sa_system_menu\` (
          \`parent_id\`,
          \`name\`,
          \`code\`,
          \`slug\`,
          \`type\`,
          \`path\`,
          \`component\`,
          \`method\`,
          \`sort\`,
          \`status\`,
          \`remark\`
        )
        SELECT \`parent\`.\`id\`, ?, NULL, ?, 3, '', '', ?, ?, 1, ?
        FROM \`sa_system_menu\` \`parent\`
        WHERE \`parent\`.\`code\` = ?
          AND \`parent\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM \`sa_system_menu\`
            WHERE \`slug\` = ?
              AND \`delete_time\` IS NULL
          )
        ORDER BY \`parent\`.\`id\` ASC
        LIMIT 1
      `,
      [
        permission.name,
        permission.slug,
        permission.method,
        permission.sort,
        permission.remark,
        permission.parentCode,
        permission.slug,
      ],
    );
  }

  private async fetchMenuIds(queryRunner: QueryRunner, sql: string): Promise<number[]> {
    const rows = (await queryRunner.query(sql)) as Array<{ id: string | number }>;
    return rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
  }

  private async deleteMenusByIds(queryRunner: QueryRunner, ids: number[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const placeholders = ids.map(() => '?').join(', ');
    await queryRunner.query(`DELETE FROM \`sa_system_menu\` WHERE \`id\` IN (${placeholders})`, ids);
  }
}
