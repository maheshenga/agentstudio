import { MigrationInterface, QueryRunner } from 'typeorm';

type TemplateSeed = {
  code: string;
  name: string;
  category: string;
  icon: string;
  summary: string;
  description: string;
  html: string;
  css: string;
  sort: number;
};

type PermissionSeed = {
  parentCode: string;
  name: string;
  slug: string;
  method: string;
  sort: number;
  remark: string;
};

const TEMPLATES: TemplateSeed[] = [
  {
    code: 'landing_page',
    name: 'Landing Page',
    category: 'Marketing',
    icon: 'ri:pages-line',
    summary: 'A concise product or service landing page.',
    description: 'Use this template for product intros, offers, and campaign pages.',
    sort: 10,
    html: [
      '<section class="factory-hero">',
      '  <p class="eyebrow">New service</p>',
      '  <h1>Launch your offer with clarity</h1>',
      '  <p class="lead">Describe the value, audience, and next step in a focused static page.</p>',
      '  <div class="actions"><a href="#details">Learn more</a><a href="#contact">Contact us</a></div>',
      '</section>',
      '<section id="details" class="factory-grid">',
      '  <article><h2>Fast setup</h2><p>Replace this copy with your product benefits.</p></article>',
      '  <article><h2>Clear promise</h2><p>Show why this module deserves attention.</p></article>',
      '  <article><h2>Simple action</h2><p>Guide visitors to the next step.</p></article>',
      '</section>',
    ].join('\n'),
    css: [
      '.factory-hero{padding:56px 32px;background:#0f766e;color:#fff;border-radius:10px;}',
      '.factory-hero h1{margin:0;font-size:40px;line-height:1.15;}',
      '.eyebrow{margin:0 0 12px;text-transform:uppercase;letter-spacing:.08em;font-size:12px;}',
      '.lead{max-width:640px;font-size:18px;line-height:1.7;}',
      '.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px;}',
      '.actions a{padding:10px 16px;border-radius:6px;background:#fff;color:#0f766e;text-decoration:none;font-weight:700;}',
      '.factory-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-top:18px;}',
      '.factory-grid article{padding:20px;border:1px solid #dbe4e8;border-radius:8px;background:#fff;}',
    ].join('\n'),
  },
  {
    code: 'job_board',
    name: 'Job Board',
    category: 'Recruitment',
    icon: 'ri:briefcase-line',
    summary: 'A static recruitment board for job openings.',
    description: 'Use this template to present roles, benefits, and application instructions.',
    sort: 20,
    html: [
      '<section class="jobs-header">',
      '  <h1>Open Roles</h1>',
      '  <p>Showcase hiring needs and help candidates understand the team.</p>',
      '</section>',
      '<section class="job-list">',
      '  <article><span>Full time</span><h2>Frontend Engineer</h2><p>Build polished SaaS product experiences.</p></article>',
      '  <article><span>Full time</span><h2>Customer Success</h2><p>Help customers adopt the platform.</p></article>',
      '  <article><span>Part time</span><h2>Content Operator</h2><p>Maintain listings, templates, and docs.</p></article>',
      '</section>',
    ].join('\n'),
    css: [
      '.jobs-header{padding:36px 28px;background:#1d4ed8;color:#fff;border-radius:10px;}',
      '.jobs-header h1{margin:0;font-size:34px;}',
      '.job-list{display:grid;gap:14px;margin-top:18px;}',
      '.job-list article{padding:20px;border:1px solid #d8dee9;border-radius:8px;background:#fff;}',
      '.job-list span{display:inline-block;margin-bottom:8px;color:#1d4ed8;font-size:12px;font-weight:700;text-transform:uppercase;}',
      '.job-list h2{margin:0 0 8px;font-size:20px;}',
      '.job-list p{margin:0;color:#4b5563;}',
    ].join('\n'),
  },
  {
    code: 'classifieds',
    name: 'Classifieds',
    category: 'Local Service',
    icon: 'ri:layout-grid-line',
    summary: 'A card-based classified information page.',
    description: 'Use this template for local services, second-hand listings, or community boards.',
    sort: 30,
    html: [
      '<section class="classifieds-header">',
      '  <h1>Featured Listings</h1>',
      '  <p>Publish lightweight listings with category, price, and contact copy.</p>',
      '</section>',
      '<section class="classifieds-grid">',
      '  <article><strong>Office Desk</strong><p>Good condition, available this week.</p><span>$120</span></article>',
      '  <article><strong>Design Service</strong><p>Logo and poster package for small teams.</p><span>From $80</span></article>',
      '  <article><strong>Workshop Room</strong><p>Book a quiet room for training sessions.</p><span>$25/hour</span></article>',
      '</section>',
    ].join('\n'),
    css: [
      '.classifieds-header{padding:32px;border-bottom:3px solid #f59e0b;background:#fffbeb;}',
      '.classifieds-header h1{margin:0;font-size:32px;color:#92400e;}',
      '.classifieds-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:18px;}',
      '.classifieds-grid article{padding:18px;border:1px solid #fde68a;border-radius:8px;background:#fff;}',
      '.classifieds-grid strong{font-size:18px;color:#111827;}',
      '.classifieds-grid span{display:inline-block;margin-top:10px;color:#b45309;font-weight:700;}',
    ].join('\n'),
  },
  {
    code: 'team_directory',
    name: 'Team Directory',
    category: 'Operations',
    icon: 'ri:team-line',
    summary: 'A directory page for teams, contacts, or service owners.',
    description: 'Use this template to present people, owners, responsibilities, or partner lists.',
    sort: 40,
    html: [
      '<section class="directory-header">',
      '  <h1>Team Directory</h1>',
      '  <p>Make key people and responsibilities easy to scan.</p>',
      '</section>',
      '<section class="directory-list">',
      '  <article><h2>Product Team</h2><p>Roadmap, UX, and release coordination.</p><span>product@example.com</span></article>',
      '  <article><h2>Operations Team</h2><p>Onboarding, data quality, and support.</p><span>ops@example.com</span></article>',
      '  <article><h2>Partner Desk</h2><p>Vendor and ecosystem requests.</p><span>partners@example.com</span></article>',
      '</section>',
    ].join('\n'),
    css: [
      '.directory-header{padding:34px;background:#f3f4f6;border-radius:10px;}',
      '.directory-header h1{margin:0;font-size:32px;color:#111827;}',
      '.directory-list{display:grid;gap:12px;margin-top:18px;}',
      '.directory-list article{padding:18px;border-left:4px solid #10b981;background:#fff;border-radius:6px;box-shadow:0 1px 3px rgba(15,23,42,.08);}',
      '.directory-list h2{margin:0 0 8px;font-size:19px;}',
      '.directory-list p{margin:0 0 8px;color:#4b5563;}',
      '.directory-list span{color:#047857;font-weight:700;}',
    ].join('\n'),
  },
];

const TEMPLATE_PERMISSION: PermissionSeed = {
  parentCode: 'AppFactory',
  name: 'Template List',
  slug: 'app:factory:template:list',
  method: 'GET',
  sort: 50,
  remark: 'Seeded app factory template list permission',
};

export class SeedAppFactoryTemplates1760000000033 implements MigrationInterface {
  name = 'SeedAppFactoryTemplates1760000000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const template of TEMPLATES) {
      await this.insertTemplate(queryRunner, template);
    }
    await this.insertPermission(queryRunner, TEMPLATE_PERMISSION);
    await this.grantExistingPlatformRoles(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE \`role_menu\`
      FROM \`sa_system_role_menu\` \`role_menu\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON \`menu\`.\`id\` = \`role_menu\`.\`menu_id\`
      WHERE \`menu\`.\`slug\` = 'app:factory:template:list'
    `);
    await queryRunner.query(`
      DELETE FROM \`sa_system_menu\`
      WHERE \`slug\` = 'app:factory:template:list'
        AND \`delete_time\` IS NULL
    `);
    await queryRunner.query(
      `
        DELETE FROM \`app_factory_template\`
        WHERE \`code\` IN (?, ?, ?, ?)
          AND \`delete_time\` IS NULL
      `,
      TEMPLATES.map((template) => template.code),
    );
  }

  private async insertTemplate(queryRunner: QueryRunner, template: TemplateSeed): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO \`app_factory_template\` (
          \`code\`,
          \`name\`,
          \`category\`,
          \`icon\`,
          \`summary\`,
          \`description\`,
          \`html_content\`,
          \`css_content\`,
          \`default_visibility\`,
          \`status\`,
          \`sort\`,
          \`remark\`
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'marketplace', 1, ?, 'Seeded factory template')
        ON DUPLICATE KEY UPDATE
          \`name\` = VALUES(\`name\`),
          \`category\` = VALUES(\`category\`),
          \`icon\` = VALUES(\`icon\`),
          \`summary\` = VALUES(\`summary\`),
          \`description\` = VALUES(\`description\`),
          \`html_content\` = VALUES(\`html_content\`),
          \`css_content\` = VALUES(\`css_content\`),
          \`status\` = 1,
          \`sort\` = VALUES(\`sort\`),
          \`delete_time\` = NULL
      `,
      [
        template.code,
        template.name,
        template.category,
        template.icon,
        template.summary,
        template.description,
        template.html,
        template.css,
        template.sort,
      ],
    );
  }

  private async insertPermission(queryRunner: QueryRunner, permission: PermissionSeed): Promise<void> {
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

  private async grantExistingPlatformRoles(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`sa_system_role_menu\` (\`role_id\`, \`menu_id\`)
      SELECT \`role\`.\`id\`, \`menu\`.\`id\`
      FROM \`sa_system_role\` \`role\`
      INNER JOIN \`sa_system_menu\` \`menu\`
        ON \`menu\`.\`slug\` = 'app:factory:template:list'
       AND \`menu\`.\`delete_time\` IS NULL
      WHERE \`role\`.\`code\` IN ('admin', 'super_admin')
        AND NOT EXISTS (
          SELECT 1
          FROM \`sa_system_role_menu\` \`existing\`
          WHERE \`existing\`.\`role_id\` = \`role\`.\`id\`
            AND \`existing\`.\`menu_id\` = \`menu\`.\`id\`
        )
    `);
  }
}
