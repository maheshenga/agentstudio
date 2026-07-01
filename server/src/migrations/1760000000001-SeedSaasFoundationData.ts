import { MigrationInterface, QueryRunner } from 'typeorm';

type PlanSeed = {
  code: string;
  name: string;
  sort: number;
  remark: string;
};

type QuotaSeed = {
  quotaType: string;
  totalQuota: number;
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

const FREE_PLAN_QUOTAS: QuotaSeed[] = [
  { quotaType: 'users', totalQuota: 3, remark: 'Seeded free plan user quota' },
  { quotaType: 'storage_mb', totalQuota: 512, remark: 'Seeded free plan storage quota' },
  { quotaType: 'ai_calls', totalQuota: 100, remark: 'Seeded free plan AI call quota' },
  { quotaType: 'rag_documents', totalQuota: 10, remark: 'Seeded free plan RAG document quota' },
  { quotaType: 'tokens', totalQuota: 100000, remark: 'Seeded free plan token quota' },
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
    slug: 'saas:subscription:index',
    method: 'GET',
    sort: 10,
    remark: 'Seeded SaaS subscription list permission',
  },
  {
    parentCode: 'SaasUsage',
    name: '数据列表',
    slug: 'saas:usage:index',
    method: 'GET',
    sort: 10,
    remark: 'Seeded SaaS usage list permission',
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
    name: '账单中心',
    code: 'TenantBilling',
    type: 2,
    path: 'billing',
    component: '/saas/tenant/billing',
    icon: 'ri:bank-card-line',
    sort: 10,
    remark: 'Seeded tenant billing menu',
  },
  {
    name: '资源配额',
    code: 'TenantQuota',
    type: 2,
    path: 'quota',
    component: '/saas/tenant/quota',
    icon: 'ri:pie-chart-2-line',
    sort: 20,
    remark: 'Seeded tenant quota menu',
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
];

export class SeedSaasFoundationData1760000000001 implements MigrationInterface {
  name = 'SeedSaasFoundationData1760000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const plan of PLAN_SEEDS) {
      await this.insertPlan(queryRunner, plan);
    }

    for (const quota of FREE_PLAN_QUOTAS) {
      await this.insertPlanQuota(queryRunner, 'free', quota);
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
      DELETE FROM \`saas_plan_quota\`
      WHERE \`plan_id\` IN (
        SELECT \`id\`
        FROM \`saas_plan\`
        WHERE \`code\` = 'free'
      )
      AND \`quota_type\` IN ('users', 'storage_mb', 'ai_calls', 'rag_documents', 'tokens')
    `);

    await queryRunner.query(`
      DELETE FROM \`saas_plan\`
      WHERE \`code\` IN ('free', 'pro', 'enterprise')
    `);

    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`parent_id\` IN (
        SELECT \`child\`.\`id\`
        FROM \`sa_system_menu\` \`child\`
        INNER JOIN \`sa_system_menu\` \`root\`
          ON \`child\`.\`parent_id\` = \`root\`.\`id\`
        WHERE \`root\`.\`parent_id\` = (
          SELECT \`id\`
          FROM \`sa_system_menu\`
          WHERE \`code\` = 'System'
            AND \`path\` = '/system'
            AND \`type\` = 1
            AND \`delete_time\` IS NULL
          ORDER BY \`id\` ASC
          LIMIT 1
        )
          AND \`root\`.\`path\` = '/saas-platform'
          AND \`root\`.\`type\` = 1
          AND \`root\`.\`component\` = ''
          AND \`root\`.\`delete_time\` IS NULL
      )
    `);

    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`parent_id\` IN (
        SELECT \`child\`.\`id\`
        FROM \`sa_system_menu\` \`child\`
        INNER JOIN \`sa_system_menu\` \`root\`
          ON \`child\`.\`parent_id\` = \`root\`.\`id\`
        WHERE \`root\`.\`parent_id\` = 0
          AND \`root\`.\`path\` = '/tenant-saas'
          AND \`root\`.\`type\` = 1
          AND \`root\`.\`component\` = ''
          AND \`root\`.\`delete_time\` IS NULL
      )
    `);

    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`parent_id\` = (
        SELECT \`root\`.\`id\`
        FROM \`sa_system_menu\` \`root\`
        WHERE \`root\`.\`parent_id\` = (
          SELECT \`id\`
          FROM \`sa_system_menu\`
          WHERE \`code\` = 'System'
            AND \`path\` = '/system'
            AND \`type\` = 1
            AND \`delete_time\` IS NULL
          ORDER BY \`id\` ASC
          LIMIT 1
        )
          AND \`root\`.\`path\` = '/saas-platform'
          AND \`root\`.\`type\` = 1
          AND \`root\`.\`component\` = ''
          AND \`root\`.\`delete_time\` IS NULL
        ORDER BY \`root\`.\`id\` ASC
        LIMIT 1
      )
      AND \`parent_id\` <> 0
    `);

    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`parent_id\` = (
        SELECT \`id\`
        FROM \`sa_system_menu\`
        WHERE \`code\` = 'System'
          AND \`path\` = '/system'
          AND \`type\` = 1
          AND \`delete_time\` IS NULL
        ORDER BY \`id\` ASC
        LIMIT 1
      )
      AND \`path\` = '/saas-platform'
      AND \`type\` = 1
      AND \`component\` = ''
      AND \`delete_time\` IS NULL
    `);

    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`parent_id\` = (
        SELECT \`root\`.\`id\`
        FROM \`sa_system_menu\` \`root\`
        WHERE \`root\`.\`parent_id\` = 0
          AND \`root\`.\`path\` = '/tenant-saas'
          AND \`root\`.\`type\` = 1
          AND \`root\`.\`component\` = ''
          AND \`root\`.\`delete_time\` IS NULL
        ORDER BY \`root\`.\`id\` ASC
        LIMIT 1
      )
    `);

    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`parent_id\` = 0
        AND \`path\` = '/tenant-saas'
        AND \`type\` = 1
        AND \`component\` = ''
        AND \`delete_time\` IS NULL
    `);
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
    planCode: string,
    quota: QuotaSeed,
  ): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`saas_plan_quota\` (\`plan_id\`, \`quota_type\`, \`total_quota\`, \`status\`, \`remark\`)
        SELECT \`plan\`.\`id\`, ?, ?, 1, ?
        FROM \`saas_plan\` \`plan\`
        WHERE \`plan\`.\`code\` = ?
          AND \`plan\`.\`delete_time\` IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM \`saas_plan_quota\` \`quota\`
            WHERE \`quota\`.\`plan_id\` = \`plan\`.\`id\`
              AND \`quota\`.\`quota_type\` = ?
          )
      `,
      [quota.quotaType, quota.totalQuota, quota.remark, planCode, quota.quotaType],
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
}
