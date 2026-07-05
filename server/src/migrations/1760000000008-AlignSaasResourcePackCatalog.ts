import { MigrationInterface, QueryRunner } from 'typeorm';

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

const RESOURCE_PACK_MENUS: Array<{ parentCode: string; menu: MenuSeed }> = [
  {
    parentCode: 'SaasManage',
    menu: {
      name: '资源包管理',
      code: 'SaasResourcePack',
      type: 2,
      path: 'resource-packs',
      component: '/saas/platform/resource-pack',
      icon: 'ri:stack-line',
      sort: 50,
      remark: 'Seeded SaaS resource pack management menu',
    },
  },
  {
    parentCode: 'TenantSaas',
    menu: {
      name: '资源包',
      code: 'TenantResourcePack',
      type: 2,
      path: 'resource-packs',
      component: '/saas/tenant/resource-pack',
      icon: 'ri:stack-line',
      sort: 30,
      remark: 'Seeded tenant resource pack menu',
    },
  },
];

const RESOURCE_PACK_PERMISSIONS: PermissionSeed[] = [
  {
    parentCode: 'SaasResourcePack',
    name: 'List',
    slug: 'saas:resource-pack:index',
    method: 'GET',
    sort: 10,
    remark: 'Seeded SaaS resource pack list permission',
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

export class AlignSaasResourcePackCatalog1760000000008 implements MigrationInterface {
  name = 'AlignSaasResourcePackCatalog1760000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const pack of RESOURCE_PACK_SEEDS) {
      await this.insertResourcePack(queryRunner, pack);
    }

    for (const item of RESOURCE_PACK_MENUS) {
      await this.insertChildMenu(queryRunner, item.parentCode, item.menu);
    }

    for (const permission of RESOURCE_PACK_PERMISSIONS) {
      await this.insertPermission(queryRunner, permission);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`slug\` IN (
        'saas:resource-pack:index',
        'tenant:resource-pack:view',
        'tenant:resource-pack-order:create',
        'tenant:resource-pack-order:view',
        'tenant:resource-pack-order:pay'
      )
      AND \`delete_time\` IS NULL
    `);

    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`code\` IN ('SaasResourcePack', 'TenantResourcePack')
        AND \`delete_time\` IS NULL
    `);

    await queryRunner.query(`
      DELETE FROM \`saas_resource_pack\`
      WHERE \`code\` IN ('ai_calls_1k', 'tokens_1m', 'storage_10gb', 'rag_docs_1k')
    `);
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
