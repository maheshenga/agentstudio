import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AppAnalyticsQueryDto } from '../dto/app-analytics.dto';
import { AppAnalyticsService } from './app-analytics.service';

describe('AppAnalyticsService', () => {
  const query = jest.fn();
  let service: AppAnalyticsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-10T12:00:00.000Z'));
    query.mockReset();
    service = new AppAnalyticsService({ query } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('defaults the analytics window to 30 days and accepts only bounded windows', async () => {
    const defaults = plainToInstance(AppAnalyticsQueryDto, {});
    const valid = plainToInstance(AppAnalyticsQueryDto, { days: '7' });
    const invalid = plainToInstance(AppAnalyticsQueryDto, { days: '14' });

    expect(defaults.days).toBe(30);
    expect(valid.days).toBe(7);
    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });

  it('returns platform overview metrics without multiplying install and open counts', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('app-analytics:platform-published-apps')) return [{ published_apps: '2' }];
      if (sql.includes('app-analytics:platform-install-summary')) {
        return [{ active_installations: '4', new_installations: '2' }];
      }
      if (sql.includes('app-analytics:platform-open-summary')) {
        return [
          {
            total_opens: '10',
            successful_opens: '8',
            failed_opens: '2',
            entitlement_blockers: '1',
            unique_tenants: '3',
            unique_users: '5',
          },
        ];
      }
      if (sql.includes('app-analytics:platform-daily')) {
        return [{ day: '2026-07-10', successful_opens: '3', failed_opens: '1' }];
      }
      if (sql.includes('app-analytics:platform-apps')) {
        return [
          { app_id: '1', app_code: 'job_board', app_name: 'Job Board', app_type: 'static' },
          { app_id: '2', app_code: 'crm', app_name: 'CRM', app_type: 'iframe' },
        ];
      }
      if (sql.includes('app-analytics:platform-installs-by-app')) {
        return [{ app_id: '1', active_installations: '3', new_installations: '1' }];
      }
      if (sql.includes('app-analytics:platform-opens-by-app')) {
        return [
          {
            app_code: 'job_board',
            total_opens: '5',
            successful_opens: '4',
            failed_opens: '1',
            entitlement_blockers: '1',
            unique_tenants: '2',
          },
        ];
      }
      if (sql.includes('app-analytics:platform-failures')) {
        return [
          {
            app_code: 'job_board',
            app_name: 'Job Board',
            tenant_id: '23',
            user_id: '7',
            reason_code: 'missing_plan_module',
            failure_message: 'Required plan module is not enabled',
            create_time: new Date('2026-07-10T10:00:00.000Z'),
            ip: 'must-not-leak',
          },
        ];
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await service.getPlatformOverview(7);

    expect(result.summary).toEqual({
      published_apps: 2,
      active_installations: 4,
      new_installations: 2,
      total_opens: 10,
      successful_opens: 8,
      failed_opens: 2,
      entitlement_blockers: 1,
      unique_tenants: 3,
      unique_users: 5,
      success_rate: 80,
    });
    expect(result.trend).toHaveLength(7);
    expect(result.trend.at(-1)).toEqual({ date: '2026-07-10', successful_opens: 3, failed_opens: 1 });
    expect(result.apps).toEqual([
      expect.objectContaining({
        code: 'job_board',
        active_installations: 3,
        total_opens: 5,
        success_rate: 80,
      }),
      expect.objectContaining({ code: 'crm', active_installations: 0, total_opens: 0, success_rate: 0 }),
    ]);
    expect(result.recent_failures[0]).toEqual({
      app_code: 'job_board',
      app_name: 'Job Board',
      tenant_id: 23,
      user_id: 7,
      outcome: 'failed',
      reason_code: 'missing_plan_module',
      failure_message: 'Required plan module is not enabled',
      create_time: new Date('2026-07-10T10:00:00.000Z'),
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  it('returns per-app version adoption percentages and bounded tenant adoption', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('app-analytics:platform-app-detail')) {
        return [{ app_id: '1', app_code: 'job_board', app_name: 'Job Board', app_type: 'static', category: 'hr' }];
      }
      if (sql.includes('app-analytics:platform-app-install-summary')) {
        return [{ active_installations: '4', new_installations: '1' }];
      }
      if (sql.includes('app-analytics:platform-app-open-summary')) {
        return [{ total_opens: '0', successful_opens: '0', failed_opens: '0', entitlement_blockers: '0', unique_tenants: '0', unique_users: '0' }];
      }
      if (sql.includes('app-analytics:platform-app-daily')) return [];
      if (sql.includes('app-analytics:platform-version-adoption')) {
        return [
          { version_id: '10', version: '2.0.0', installations: '3' },
          { version_id: '9', version: '1.0.0', installations: '1' },
        ];
      }
      if (sql.includes('app-analytics:platform-tenant-adoption')) {
        return [{ tenant_id: '23', version: '2.0.0', installed_time: null, total_opens: '4', successful_opens: '3', failed_opens: '1', last_open_time: null }];
      }
      if (sql.includes('app-analytics:platform-app-failures')) return [];
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await service.getPlatformAppDetail('job_board', 30);

    expect(result.summary.success_rate).toBe(0);
    expect(result.version_adoption).toEqual([
      { version_id: 10, version: '2.0.0', installations: 3, percentage: 75 },
      { version_id: 9, version: '1.0.0', installations: 1, percentage: 25 },
    ]);
    expect(result.tenant_adoption).toHaveLength(1);
  });

  it('scopes every tenant analytics query to the authenticated tenant and hides tenant identities', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('app-analytics:tenant-install-summary')) return [{ enabled_apps: '2' }];
      if (sql.includes('app-analytics:tenant-open-summary')) {
        return [{ total_opens: '5', successful_opens: '4', failed_opens: '1', entitlement_blockers: '1' }];
      }
      if (sql.includes('app-analytics:tenant-daily')) return [];
      if (sql.includes('app-analytics:tenant-installed-apps')) {
        return [{ app_id: '1', app_code: 'job_board', app_name: 'Job Board', app_type: 'static', version_id: '10', version: '2.0.0', installed_time: null }];
      }
      if (sql.includes('app-analytics:tenant-opens-by-app')) {
        return [{ app_code: 'job_board', total_opens: '5', successful_opens: '4', failed_opens: '1', entitlement_blockers: '1', last_open_time: null }];
      }
      if (sql.includes('app-analytics:tenant-version-adoption')) {
        return [{ app_code: 'job_board', app_name: 'Job Board', version_id: '10', version: '2.0.0', successful_opens: '4' }];
      }
      if (sql.includes('app-analytics:tenant-failures')) {
        return [{ app_code: 'job_board', app_name: 'Job Board', reason_code: 'missing_plan_module', failure_message: 'Required plan module is not enabled', create_time: null, tenant_id: '23', user_id: '7' }];
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const result = await service.getTenantOverview(23, 30);

    for (const [, params] of query.mock.calls) {
      expect(params).toContain(23);
    }
    expect(result.summary).toEqual({
      enabled_apps: 2,
      total_opens: 5,
      successful_opens: 4,
      failed_opens: 1,
      entitlement_blockers: 1,
      success_rate: 80,
    });
    expect(result.apps[0]).toEqual(expect.objectContaining({ code: 'job_board', version: '2.0.0', total_opens: 5 }));
    expect(result.version_adoption[0]).toEqual(expect.objectContaining({ percentage: 100 }));
    expect(JSON.stringify(result)).not.toContain('tenant_id');
    expect(JSON.stringify(result)).not.toContain('user_id');
  });
});
