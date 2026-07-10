import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { AppAnalyticsWindow } from '../dto/app-analytics.dto';

type RawRow = Record<string, any>;

const ENTITLEMENT_REASON_CODES = ['missing_plan_module', 'missing_system_module', 'system_module_unavailable'];

@Injectable()
export class AppAnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  async getPlatformOverview(days: AppAnalyticsWindow) {
    const { start } = this.createWindow(days);
    const [publishedRows, installRows, openRows, dailyRows, appRows, installByAppRows, openByAppRows, failureRows] =
      await Promise.all([
        this.dataSource.query(`
          /* app-analytics:platform-published-apps */
          SELECT COUNT(*) AS \`published_apps\`
          FROM \`app_package\`
          WHERE \`status\` = 'published'
            AND \`delete_time\` IS NULL
        `),
        this.dataSource.query(
          `
            /* app-analytics:platform-install-summary */
            SELECT
              COUNT(*) AS \`active_installations\`,
              SUM(CASE WHEN COALESCE(\`installed_time\`, \`create_time\`) >= ? THEN 1 ELSE 0 END) AS \`new_installations\`
            FROM \`tenant_app_install\`
            WHERE \`enabled\` = 1
              AND \`delete_time\` IS NULL
          `,
          [start],
        ),
        this.dataSource.query(
          `
            /* app-analytics:platform-open-summary */
            SELECT
              COUNT(*) AS \`total_opens\`,
              SUM(CASE WHEN \`outcome\` = 'success' THEN 1 ELSE 0 END) AS \`successful_opens\`,
              SUM(CASE WHEN \`outcome\` = 'failed' THEN 1 ELSE 0 END) AS \`failed_opens\`,
              SUM(CASE WHEN \`reason_code\` IN (?, ?, ?) THEN 1 ELSE 0 END) AS \`entitlement_blockers\`,
              COUNT(DISTINCT \`tenant_id\`) AS \`unique_tenants\`,
              COUNT(DISTINCT \`user_id\`) AS \`unique_users\`
            FROM \`app_open_log\`
            WHERE \`create_time\` >= ?
          `,
          [...ENTITLEMENT_REASON_CODES, start],
        ),
        this.dataSource.query(
          `
            /* app-analytics:platform-daily */
            SELECT
              DATE(\`create_time\`) AS \`day\`,
              SUM(CASE WHEN \`outcome\` = 'success' THEN 1 ELSE 0 END) AS \`successful_opens\`,
              SUM(CASE WHEN \`outcome\` = 'failed' THEN 1 ELSE 0 END) AS \`failed_opens\`
            FROM \`app_open_log\`
            WHERE \`create_time\` >= ?
            GROUP BY DATE(\`create_time\`)
            ORDER BY DATE(\`create_time\`) ASC
          `,
          [start],
        ),
        this.dataSource.query(`
          /* app-analytics:platform-apps */
          SELECT
            \`id\` AS \`app_id\`,
            \`code\` AS \`app_code\`,
            \`name\` AS \`app_name\`,
            \`type\` AS \`app_type\`
          FROM \`app_package\`
          WHERE \`status\` = 'published'
            AND \`delete_time\` IS NULL
          ORDER BY \`sort\` ASC, \`id\` ASC
        `),
        this.dataSource.query(
          `
            /* app-analytics:platform-installs-by-app */
            SELECT
              \`app_id\`,
              COUNT(*) AS \`active_installations\`,
              SUM(CASE WHEN COALESCE(\`installed_time\`, \`create_time\`) >= ? THEN 1 ELSE 0 END) AS \`new_installations\`
            FROM \`tenant_app_install\`
            WHERE \`enabled\` = 1
              AND \`delete_time\` IS NULL
            GROUP BY \`app_id\`
          `,
          [start],
        ),
        this.dataSource.query(
          `
            /* app-analytics:platform-opens-by-app */
            SELECT
              \`app_code\`,
              COUNT(*) AS \`total_opens\`,
              SUM(CASE WHEN \`outcome\` = 'success' THEN 1 ELSE 0 END) AS \`successful_opens\`,
              SUM(CASE WHEN \`outcome\` = 'failed' THEN 1 ELSE 0 END) AS \`failed_opens\`,
              SUM(CASE WHEN \`reason_code\` IN (?, ?, ?) THEN 1 ELSE 0 END) AS \`entitlement_blockers\`,
              COUNT(DISTINCT \`tenant_id\`) AS \`unique_tenants\`
            FROM \`app_open_log\`
            WHERE \`create_time\` >= ?
            GROUP BY \`app_code\`
          `,
          [...ENTITLEMENT_REASON_CODES, start],
        ),
        this.dataSource.query(
          `
            /* app-analytics:platform-failures */
            SELECT
              \`log\`.\`app_code\`,
              COALESCE(\`app\`.\`name\`, \`log\`.\`app_code\`) AS \`app_name\`,
              \`log\`.\`tenant_id\`,
              \`log\`.\`user_id\`,
              \`log\`.\`reason_code\`,
              \`log\`.\`failure_message\`,
              \`log\`.\`create_time\`
            FROM \`app_open_log\` \`log\`
            LEFT JOIN \`app_package\` \`app\` ON \`app\`.\`id\` = \`log\`.\`app_id\`
            WHERE \`log\`.\`outcome\` = 'failed'
              AND \`log\`.\`create_time\` >= ?
            ORDER BY \`log\`.\`create_time\` DESC, \`log\`.\`id\` DESC
            LIMIT 20
          `,
          [start],
        ),
      ]);

    const openSummary = openRows[0] || {};
    const installSummary = installRows[0] || {};
    const installsByApp = new Map<number, RawRow>(
      installByAppRows.map((row: RawRow) => [this.toNumber(row.app_id), row] as [number, RawRow]),
    );
    const opensByApp = new Map<string, RawRow>(
      openByAppRows.map((row: RawRow) => [String(row.app_code), row] as [string, RawRow]),
    );

    return {
      window_days: days,
      summary: {
        published_apps: this.toNumber(publishedRows[0]?.published_apps),
        active_installations: this.toNumber(installSummary.active_installations),
        new_installations: this.toNumber(installSummary.new_installations),
        total_opens: this.toNumber(openSummary.total_opens),
        successful_opens: this.toNumber(openSummary.successful_opens),
        failed_opens: this.toNumber(openSummary.failed_opens),
        entitlement_blockers: this.toNumber(openSummary.entitlement_blockers),
        unique_tenants: this.toNumber(openSummary.unique_tenants),
        unique_users: this.toNumber(openSummary.unique_users),
        success_rate: this.percentage(openSummary.successful_opens, openSummary.total_opens),
      },
      trend: this.fillTrend(days, dailyRows),
      apps: appRows.map((app: RawRow) => {
        const installs = installsByApp.get(this.toNumber(app.app_id)) || {};
        const opens = opensByApp.get(String(app.app_code)) || {};
        return {
          app_id: this.toNumber(app.app_id),
          code: String(app.app_code || ''),
          name: String(app.app_name || ''),
          type: String(app.app_type || ''),
          active_installations: this.toNumber(installs.active_installations),
          new_installations: this.toNumber(installs.new_installations),
          total_opens: this.toNumber(opens.total_opens),
          successful_opens: this.toNumber(opens.successful_opens),
          failed_opens: this.toNumber(opens.failed_opens),
          entitlement_blockers: this.toNumber(opens.entitlement_blockers),
          unique_tenants: this.toNumber(opens.unique_tenants),
          success_rate: this.percentage(opens.successful_opens, opens.total_opens),
        };
      }),
      recent_failures: failureRows.map((row: RawRow) => this.toPlatformFailure(row)),
    };
  }

  async getPlatformAppDetail(code: string, days: AppAnalyticsWindow) {
    const appCode = this.normalizeCode(code);
    const { start } = this.createWindow(days);
    const appRows = await this.dataSource.query(
      `
        /* app-analytics:platform-app-detail */
        SELECT
          \`id\` AS \`app_id\`,
          \`code\` AS \`app_code\`,
          \`name\` AS \`app_name\`,
          \`type\` AS \`app_type\`,
          \`category\`
        FROM \`app_package\`
        WHERE \`code\` = ?
          AND \`delete_time\` IS NULL
        LIMIT 1
      `,
      [appCode],
    );
    const app = appRows[0];
    if (!app) throw new NotFoundException(`App ${appCode} not found`);

    const [installRows, openRows, dailyRows, versionRows, tenantRows, failureRows] = await Promise.all([
      this.dataSource.query(
        `
          /* app-analytics:platform-app-install-summary */
          SELECT
            COUNT(*) AS \`active_installations\`,
            SUM(CASE WHEN COALESCE(\`installed_time\`, \`create_time\`) >= ? THEN 1 ELSE 0 END) AS \`new_installations\`
          FROM \`tenant_app_install\`
          WHERE \`app_id\` = ?
            AND \`enabled\` = 1
            AND \`delete_time\` IS NULL
        `,
        [start, app.app_id],
      ),
      this.dataSource.query(
        `
          /* app-analytics:platform-app-open-summary */
          SELECT
            COUNT(*) AS \`total_opens\`,
            SUM(CASE WHEN \`outcome\` = 'success' THEN 1 ELSE 0 END) AS \`successful_opens\`,
            SUM(CASE WHEN \`outcome\` = 'failed' THEN 1 ELSE 0 END) AS \`failed_opens\`,
            SUM(CASE WHEN \`reason_code\` IN (?, ?, ?) THEN 1 ELSE 0 END) AS \`entitlement_blockers\`,
            COUNT(DISTINCT \`tenant_id\`) AS \`unique_tenants\`,
            COUNT(DISTINCT \`user_id\`) AS \`unique_users\`
          FROM \`app_open_log\`
          WHERE \`app_code\` = ?
            AND \`create_time\` >= ?
        `,
        [...ENTITLEMENT_REASON_CODES, appCode, start],
      ),
      this.dataSource.query(
        `
          /* app-analytics:platform-app-daily */
          SELECT
            DATE(\`create_time\`) AS \`day\`,
            SUM(CASE WHEN \`outcome\` = 'success' THEN 1 ELSE 0 END) AS \`successful_opens\`,
            SUM(CASE WHEN \`outcome\` = 'failed' THEN 1 ELSE 0 END) AS \`failed_opens\`
          FROM \`app_open_log\`
          WHERE \`app_code\` = ?
            AND \`create_time\` >= ?
          GROUP BY DATE(\`create_time\`)
          ORDER BY DATE(\`create_time\`) ASC
        `,
        [appCode, start],
      ),
      this.dataSource.query(
        `
          /* app-analytics:platform-version-adoption */
          SELECT
            \`install\`.\`version_id\`,
            COALESCE(\`version\`.\`version\`, 'Unassigned') AS \`version\`,
            COUNT(*) AS \`installations\`
          FROM \`tenant_app_install\` \`install\`
          LEFT JOIN \`app_package_version\` \`version\`
            ON \`version\`.\`id\` = \`install\`.\`version_id\`
          WHERE \`install\`.\`app_id\` = ?
            AND \`install\`.\`enabled\` = 1
            AND \`install\`.\`delete_time\` IS NULL
          GROUP BY \`install\`.\`version_id\`, \`version\`.\`version\`
          ORDER BY \`installations\` DESC, \`version\`.\`version\` DESC
        `,
        [app.app_id],
      ),
      this.dataSource.query(
        `
          /* app-analytics:platform-tenant-adoption */
          SELECT
            \`install\`.\`tenant_id\`,
            COALESCE(\`version\`.\`version\`, 'Unassigned') AS \`version\`,
            \`install\`.\`installed_time\`,
            COALESCE(\`opens\`.\`total_opens\`, 0) AS \`total_opens\`,
            COALESCE(\`opens\`.\`successful_opens\`, 0) AS \`successful_opens\`,
            COALESCE(\`opens\`.\`failed_opens\`, 0) AS \`failed_opens\`,
            \`opens\`.\`last_open_time\`
          FROM \`tenant_app_install\` \`install\`
          LEFT JOIN \`app_package_version\` \`version\`
            ON \`version\`.\`id\` = \`install\`.\`version_id\`
          LEFT JOIN (
            SELECT
              \`tenant_id\`,
              COUNT(*) AS \`total_opens\`,
              SUM(CASE WHEN \`outcome\` = 'success' THEN 1 ELSE 0 END) AS \`successful_opens\`,
              SUM(CASE WHEN \`outcome\` = 'failed' THEN 1 ELSE 0 END) AS \`failed_opens\`,
              MAX(\`create_time\`) AS \`last_open_time\`
            FROM \`app_open_log\`
            WHERE \`app_code\` = ?
              AND \`create_time\` >= ?
            GROUP BY \`tenant_id\`
          ) \`opens\` ON \`opens\`.\`tenant_id\` = \`install\`.\`tenant_id\`
          WHERE \`install\`.\`app_id\` = ?
            AND \`install\`.\`enabled\` = 1
            AND \`install\`.\`delete_time\` IS NULL
          ORDER BY \`opens\`.\`total_opens\` DESC, \`install\`.\`tenant_id\` ASC
          LIMIT 100
        `,
        [appCode, start, app.app_id],
      ),
      this.dataSource.query(
        `
          /* app-analytics:platform-app-failures */
          SELECT
            \`log\`.\`app_code\`,
            COALESCE(\`app\`.\`name\`, \`log\`.\`app_code\`) AS \`app_name\`,
            \`log\`.\`tenant_id\`,
            \`log\`.\`user_id\`,
            \`log\`.\`reason_code\`,
            \`log\`.\`failure_message\`,
            \`log\`.\`create_time\`
          FROM \`app_open_log\` \`log\`
          LEFT JOIN \`app_package\` \`app\` ON \`app\`.\`id\` = \`log\`.\`app_id\`
          WHERE \`log\`.\`app_code\` = ?
            AND \`log\`.\`outcome\` = 'failed'
            AND \`log\`.\`create_time\` >= ?
          ORDER BY \`log\`.\`create_time\` DESC, \`log\`.\`id\` DESC
          LIMIT 20
        `,
        [appCode, start],
      ),
    ]);

    const installSummary = installRows[0] || {};
    const openSummary = openRows[0] || {};
    const adoptionTotal = versionRows.reduce(
      (total: number, row: RawRow) => total + this.toNumber(row.installations),
      0,
    );

    return {
      window_days: days,
      app: {
        app_id: this.toNumber(app.app_id),
        code: String(app.app_code || ''),
        name: String(app.app_name || ''),
        type: String(app.app_type || ''),
        category: String(app.category || ''),
      },
      summary: {
        active_installations: this.toNumber(installSummary.active_installations),
        new_installations: this.toNumber(installSummary.new_installations),
        total_opens: this.toNumber(openSummary.total_opens),
        successful_opens: this.toNumber(openSummary.successful_opens),
        failed_opens: this.toNumber(openSummary.failed_opens),
        entitlement_blockers: this.toNumber(openSummary.entitlement_blockers),
        unique_tenants: this.toNumber(openSummary.unique_tenants),
        unique_users: this.toNumber(openSummary.unique_users),
        success_rate: this.percentage(openSummary.successful_opens, openSummary.total_opens),
      },
      trend: this.fillTrend(days, dailyRows),
      version_adoption: versionRows.map((row: RawRow) => ({
        version_id: row.version_id == null ? null : this.toNumber(row.version_id),
        version: String(row.version || 'Unassigned'),
        installations: this.toNumber(row.installations),
        percentage: this.percentage(row.installations, adoptionTotal),
      })),
      tenant_adoption: tenantRows.map((row: RawRow) => ({
        tenant_id: this.toNumber(row.tenant_id),
        version: String(row.version || 'Unassigned'),
        installed_time: row.installed_time ?? null,
        total_opens: this.toNumber(row.total_opens),
        successful_opens: this.toNumber(row.successful_opens),
        failed_opens: this.toNumber(row.failed_opens),
        success_rate: this.percentage(row.successful_opens, row.total_opens),
        last_open_time: row.last_open_time ?? null,
      })),
      recent_failures: failureRows.map((row: RawRow) => this.toPlatformFailure(row)),
    };
  }

  async getTenantOverview(tenantId: number, days: AppAnalyticsWindow) {
    const { start } = this.createWindow(days);
    const [installRows, openRows, dailyRows, appRows, openByAppRows, versionRows, failureRows] = await Promise.all([
      this.dataSource.query(
        `
          /* app-analytics:tenant-install-summary */
          SELECT COUNT(*) AS \`enabled_apps\`
          FROM \`tenant_app_install\`
          WHERE \`tenant_id\` = ?
            AND \`enabled\` = 1
            AND \`delete_time\` IS NULL
        `,
        [tenantId],
      ),
      this.dataSource.query(
        `
          /* app-analytics:tenant-open-summary */
          SELECT
            COUNT(*) AS \`total_opens\`,
            SUM(CASE WHEN \`outcome\` = 'success' THEN 1 ELSE 0 END) AS \`successful_opens\`,
            SUM(CASE WHEN \`outcome\` = 'failed' THEN 1 ELSE 0 END) AS \`failed_opens\`,
            SUM(CASE WHEN \`reason_code\` IN (?, ?, ?) THEN 1 ELSE 0 END) AS \`entitlement_blockers\`
          FROM \`app_open_log\`
          WHERE \`tenant_id\` = ?
            AND \`create_time\` >= ?
        `,
        [...ENTITLEMENT_REASON_CODES, tenantId, start],
      ),
      this.dataSource.query(
        `
          /* app-analytics:tenant-daily */
          SELECT
            DATE(\`create_time\`) AS \`day\`,
            SUM(CASE WHEN \`outcome\` = 'success' THEN 1 ELSE 0 END) AS \`successful_opens\`,
            SUM(CASE WHEN \`outcome\` = 'failed' THEN 1 ELSE 0 END) AS \`failed_opens\`
          FROM \`app_open_log\`
          WHERE \`tenant_id\` = ?
            AND \`create_time\` >= ?
          GROUP BY DATE(\`create_time\`)
          ORDER BY DATE(\`create_time\`) ASC
        `,
        [tenantId, start],
      ),
      this.dataSource.query(
        `
          /* app-analytics:tenant-installed-apps */
          SELECT
            \`app\`.\`id\` AS \`app_id\`,
            \`app\`.\`code\` AS \`app_code\`,
            \`app\`.\`name\` AS \`app_name\`,
            \`app\`.\`type\` AS \`app_type\`,
            \`install\`.\`version_id\`,
            COALESCE(\`version\`.\`version\`, '') AS \`version\`,
            \`install\`.\`installed_time\`
          FROM \`tenant_app_install\` \`install\`
          INNER JOIN \`app_package\` \`app\`
            ON \`app\`.\`id\` = \`install\`.\`app_id\`
           AND \`app\`.\`delete_time\` IS NULL
          LEFT JOIN \`app_package_version\` \`version\`
            ON \`version\`.\`id\` = \`install\`.\`version_id\`
          WHERE \`install\`.\`tenant_id\` = ?
            AND \`install\`.\`enabled\` = 1
            AND \`install\`.\`delete_time\` IS NULL
          ORDER BY \`app\`.\`sort\` ASC, \`app\`.\`id\` ASC
        `,
        [tenantId],
      ),
      this.dataSource.query(
        `
          /* app-analytics:tenant-opens-by-app */
          SELECT
            \`app_code\`,
            COUNT(*) AS \`total_opens\`,
            SUM(CASE WHEN \`outcome\` = 'success' THEN 1 ELSE 0 END) AS \`successful_opens\`,
            SUM(CASE WHEN \`outcome\` = 'failed' THEN 1 ELSE 0 END) AS \`failed_opens\`,
            SUM(CASE WHEN \`reason_code\` IN (?, ?, ?) THEN 1 ELSE 0 END) AS \`entitlement_blockers\`,
            MAX(\`create_time\`) AS \`last_open_time\`
          FROM \`app_open_log\`
          WHERE \`tenant_id\` = ?
            AND \`create_time\` >= ?
          GROUP BY \`app_code\`
        `,
        [...ENTITLEMENT_REASON_CODES, tenantId, start],
      ),
      this.dataSource.query(
        `
          /* app-analytics:tenant-version-adoption */
          SELECT
            \`log\`.\`app_code\`,
            COALESCE(\`app\`.\`name\`, \`log\`.\`app_code\`) AS \`app_name\`,
            \`log\`.\`version_id\`,
            COALESCE(\`version\`.\`version\`, 'Unassigned') AS \`version\`,
            COUNT(*) AS \`successful_opens\`
          FROM \`app_open_log\` \`log\`
          LEFT JOIN \`app_package\` \`app\` ON \`app\`.\`id\` = \`log\`.\`app_id\`
          LEFT JOIN \`app_package_version\` \`version\` ON \`version\`.\`id\` = \`log\`.\`version_id\`
          WHERE \`log\`.\`tenant_id\` = ?
            AND \`log\`.\`outcome\` = 'success'
            AND \`log\`.\`create_time\` >= ?
          GROUP BY \`log\`.\`app_code\`, \`app\`.\`name\`, \`log\`.\`version_id\`, \`version\`.\`version\`
          ORDER BY \`log\`.\`app_code\` ASC, \`successful_opens\` DESC
        `,
        [tenantId, start],
      ),
      this.dataSource.query(
        `
          /* app-analytics:tenant-failures */
          SELECT
            \`log\`.\`app_code\`,
            COALESCE(\`app\`.\`name\`, \`log\`.\`app_code\`) AS \`app_name\`,
            \`log\`.\`reason_code\`,
            \`log\`.\`failure_message\`,
            \`log\`.\`create_time\`
          FROM \`app_open_log\` \`log\`
          LEFT JOIN \`app_package\` \`app\` ON \`app\`.\`id\` = \`log\`.\`app_id\`
          WHERE \`log\`.\`tenant_id\` = ?
            AND \`log\`.\`outcome\` = 'failed'
            AND \`log\`.\`create_time\` >= ?
          ORDER BY \`log\`.\`create_time\` DESC, \`log\`.\`id\` DESC
          LIMIT 20
        `,
        [tenantId, start],
      ),
    ]);

    const openSummary = openRows[0] || {};
    const opensByApp = new Map<string, RawRow>(
      openByAppRows.map((row: RawRow) => [String(row.app_code), row] as [string, RawRow]),
    );
    const adoptionTotals = versionRows.reduce((totals: Map<string, number>, row: RawRow) => {
      const code = String(row.app_code || '');
      totals.set(code, (totals.get(code) || 0) + this.toNumber(row.successful_opens));
      return totals;
    }, new Map<string, number>());

    return {
      window_days: days,
      summary: {
        enabled_apps: this.toNumber(installRows[0]?.enabled_apps),
        total_opens: this.toNumber(openSummary.total_opens),
        successful_opens: this.toNumber(openSummary.successful_opens),
        failed_opens: this.toNumber(openSummary.failed_opens),
        entitlement_blockers: this.toNumber(openSummary.entitlement_blockers),
        success_rate: this.percentage(openSummary.successful_opens, openSummary.total_opens),
      },
      trend: this.fillTrend(days, dailyRows),
      apps: appRows.map((app: RawRow) => {
        const opens = opensByApp.get(String(app.app_code)) || {};
        return {
          app_id: this.toNumber(app.app_id),
          code: String(app.app_code || ''),
          name: String(app.app_name || ''),
          type: String(app.app_type || ''),
          version_id: app.version_id == null ? null : this.toNumber(app.version_id),
          version: String(app.version || ''),
          installed_time: app.installed_time ?? null,
          total_opens: this.toNumber(opens.total_opens),
          successful_opens: this.toNumber(opens.successful_opens),
          failed_opens: this.toNumber(opens.failed_opens),
          entitlement_blockers: this.toNumber(opens.entitlement_blockers),
          success_rate: this.percentage(opens.successful_opens, opens.total_opens),
          last_open_time: opens.last_open_time ?? null,
        };
      }),
      version_adoption: versionRows.map((row: RawRow) => ({
        app_code: String(row.app_code || ''),
        app_name: String(row.app_name || row.app_code || ''),
        version_id: row.version_id == null ? null : this.toNumber(row.version_id),
        version: String(row.version || 'Unassigned'),
        successful_opens: this.toNumber(row.successful_opens),
        percentage: this.percentage(row.successful_opens, adoptionTotals.get(String(row.app_code)) || 0),
      })),
      recent_failures: failureRows.map((row: RawRow) => this.toTenantFailure(row)),
    };
  }

  private createWindow(days: AppAnalyticsWindow) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    return { start };
  }

  private fillTrend(days: AppAnalyticsWindow, rows: RawRow[]) {
    const byDay = new Map(
      rows.map((row) => [
        this.formatDay(row.day),
        {
          successful_opens: this.toNumber(row.successful_opens),
          failed_opens: this.toNumber(row.failed_opens),
        },
      ]),
    );
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    return Array.from({ length: days }, (_, index) => {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() - (days - index - 1));
      const day = this.formatDay(date);
      const values = byDay.get(day) || { successful_opens: 0, failed_opens: 0 };
      return { date: day, ...values };
    });
  }

  private toPlatformFailure(row: RawRow) {
    return {
      app_code: String(row.app_code || ''),
      app_name: String(row.app_name || row.app_code || ''),
      tenant_id: this.toNumber(row.tenant_id),
      user_id: row.user_id == null ? null : this.toNumber(row.user_id),
      outcome: 'failed' as const,
      reason_code: String(row.reason_code || 'open_metadata_error'),
      failure_message: String(row.failure_message || 'Unable to open app'),
      create_time: row.create_time ?? null,
    };
  }

  private toTenantFailure(row: RawRow) {
    return {
      app_code: String(row.app_code || ''),
      app_name: String(row.app_name || row.app_code || ''),
      outcome: 'failed' as const,
      reason_code: String(row.reason_code || 'open_metadata_error'),
      failure_message: String(row.failure_message || 'Unable to open app'),
      create_time: row.create_time ?? null,
    };
  }

  private percentage(part: unknown, total: unknown) {
    const denominator = this.toNumber(total);
    if (!denominator) return 0;
    return Number(((this.toNumber(part) / denominator) * 100).toFixed(2));
  }

  private toNumber(value: unknown) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  private formatDay(value: unknown) {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value || '').slice(0, 10);
  }

  private normalizeCode(code: string) {
    return String(code || '')
      .trim()
      .toLowerCase()
      .slice(0, 100);
  }
}
