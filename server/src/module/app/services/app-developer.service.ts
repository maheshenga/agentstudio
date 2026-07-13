import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

import { CreateDeveloperAppDto, UpdateDeveloperAppDto } from '../dto/app-developer.dto';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppServiceInstanceEntity } from '../entities/app-service-instance.entity';
import { AppServiceInvocationEntity } from '../entities/app-service-invocation.entity';
import { AppDeveloperCertificationService } from './app-developer-certification.service';
import { AppPlatformService } from './app-platform.service';
import { AppServiceRuntimeService } from './app-service-runtime.service';

@Injectable()
export class AppDeveloperService {
  constructor(
    @InjectRepository(AppPackageEntity)
    private readonly appRepo: Repository<AppPackageEntity>,
    @InjectRepository(AppPackageVersionEntity)
    private readonly versionRepo: Repository<AppPackageVersionEntity>,
    @InjectRepository(AppServiceInstanceEntity)
    private readonly instanceRepo: Repository<AppServiceInstanceEntity>,
    @InjectRepository(AppServiceInvocationEntity)
    private readonly invocationRepo: Repository<AppServiceInvocationEntity>,
    private readonly appPlatformService: AppPlatformService,
    private readonly certificationService: AppDeveloperCertificationService,
    private readonly configService: ConfigService,
    private readonly runtimeService: AppServiceRuntimeService,
  ) {}

  listApps(developerId: number) {
    return this.appPlatformService.listDeveloperApps(developerId);
  }

  async getApp(code: string, developerId: number) {
    await this.findOwnedApp(code, developerId);
    return this.appPlatformService.getApp(code);
  }

  async createApp(dto: CreateDeveloperAppDto, developerId: number, developerName: string) {
    const metadata = this.sanitizeMetadata(dto);
    const runtimeType = dto.runtime_type || 'static';
    if (runtimeType === 'service') {
      this.assertDeveloperServiceEnabled();
      await this.certificationService.assertRuntimeApproved(developerId, 'service');
    }
    const payload = {
      code: dto.code.trim(),
      ...metadata,
      name: this.sanitizeRequiredName(dto.name),
      type: runtimeType,
      visibility: 'marketplace' as const,
      developer_name: String(developerName || `User ${developerId}`).slice(0, 100),
    };
    return runtimeType === 'service'
      ? this.appPlatformService.createApp(payload, developerId, {
          trustLevel: 'developer_restricted',
        })
      : this.appPlatformService.createApp(payload, developerId);
  }

  async updateApp(code: string, dto: UpdateDeveloperAppDto, developerId: number) {
    const app = await this.findOwnedApp(code, developerId);
    if (app.status !== 'draft' && app.status !== 'rejected') {
      throw new BadRequestException('Only draft or rejected apps can be edited');
    }
    return this.appPlatformService.updateApp(code, this.sanitizeMetadata(dto));
  }

  async uploadVersion(code: string, file: Express.Multer.File, developerId: number) {
    const app = await this.findOwnedApp(code, developerId);
    if (app.status === 'disabled' || app.status === 'archived') {
      throw new BadRequestException('Disabled or archived apps cannot upload versions');
    }
    if (app.type === 'service') {
      if (app.trustLevel !== 'developer_restricted') {
        throw new BadRequestException('Developer uploads require a restricted service app');
      }
      this.assertDeveloperServiceEnabled();
      const profile = await this.certificationService.assertRuntimeApproved(developerId, 'service');
      return this.appPlatformService.uploadServiceVersion(code, file, developerId, profile);
    }
    return this.appPlatformService.uploadStaticVersion(code, file, developerId);
  }

  async submitVersion(code: string, version: string, developerId: number) {
    await this.findOwnedApp(code, developerId);
    return this.appPlatformService.submitVersion(code, version, developerId);
  }

  async getServiceOverview(developerId: number, requestedDays: 1 | 7 | 30 | number = 7) {
    const days = this.normalizeDays(requestedDays);
    const apps = await this.appRepo.find({
      where: { developerId, type: 'service', deleteTime: IsNull() },
      order: { id: 'ASC' },
    });
    if (!apps.length) {
      return this.emptyOverview(days);
    }

    const appIds = apps.map((app) => Number(app.id));
    const [versions, instances, aggregateRows, percentileRows] = await Promise.all([
      this.versionRepo.find({ where: { appId: In(appIds), deleteTime: IsNull() } }),
      this.instanceRepo.find({ where: { appId: In(appIds) }, order: { id: 'DESC' } }),
      this.invocationAggregates(developerId, appIds, days),
      this.invocationPercentiles(developerId, appIds, days),
    ]);
    const versionById = new Map(versions.map((version) => [Number(version.id), version]));
    const instancesByApp = new Map<number, AppServiceInstanceEntity[]>();
    for (const instance of instances) {
      const list = instancesByApp.get(Number(instance.appId)) || [];
      list.push(instance);
      instancesByApp.set(Number(instance.appId), list);
    }
    const aggregateByApp = new Map(
      aggregateRows.map((row) => [Number(row.target_app_id), row]),
    );
    const percentileByApp = new Map(
      percentileRows.map((row) => [Number(row.target_app_id), row]),
    );

    const services = apps.map((app) => {
      const instance = this.preferredInstance(instancesByApp.get(Number(app.id)) || []);
      const version = instance ? versionById.get(Number(instance.versionId)) : undefined;
      const aggregate = aggregateByApp.get(Number(app.id));
      const percentile = percentileByApp.get(Number(app.id));
      const success = this.toCount(aggregate?.success_count);
      const failure = this.toCount(aggregate?.failure_count);
      const rejected = this.toCount(aggregate?.rejected_count);
      const total = this.toCount(aggregate?.total_count);
      return {
        app_code: app.code,
        app_name: app.name,
        version: version?.version || '',
        role: instance?.role || 'unavailable',
        process_status: instance?.processStatus || 'stopped',
        health_status: instance?.healthStatus || 'unknown',
        circuit_state: instance?.circuitState || 'closed',
        restart_count: Math.max(0, Number(instance?.restartCount || 0)),
        success_count: success,
        failure_count: failure,
        rejected_count: rejected,
        total_count: total,
        success_rate: this.successRate(success, total),
        p50_duration_ms: this.toCount(percentile?.p50_duration_ms),
        p95_duration_ms: this.toCount(percentile?.p95_duration_ms),
        last_invoke_time: aggregate?.last_invoke_time || null,
        last_success_time: aggregate?.last_success_time || null,
      };
    });
    const totals = services.reduce(
      (result, item) => ({
        success: result.success + item.success_count,
        failure: result.failure + item.failure_count,
        rejected: result.rejected + item.rejected_count,
        invocations: result.invocations + item.total_count,
      }),
      { success: 0, failure: 0, rejected: 0, invocations: 0 },
    );
    return {
      days,
      total_services: services.length,
      total_invocations: totals.invocations,
      total_success: totals.success,
      total_failure: totals.failure,
      total_rejected: totals.rejected,
      success_rate: this.successRate(totals.success, totals.invocations),
      services,
    };
  }

  async getServiceLogs(code: string, developerId: number, requestedLines = 100) {
    const app = await this.findOwnedApp(code, developerId);
    if (app.type !== 'service') {
      throw new BadRequestException('App is not a service runtime');
    }
    const lines = Math.min(200, Math.max(1, Math.trunc(Number(requestedLines) || 100)));
    return this.runtimeService.getDeveloperRuntimeLogs(app, lines);
  }

  private async findOwnedApp(code: string, developerId: number) {
    const app = await this.appRepo.findOne({
      where: { code, developerId, deleteTime: IsNull() },
    });
    if (!app) {
      throw new NotFoundException(`App ${code} not found`);
    }
    return app;
  }

  private sanitizeMetadata(dto: UpdateDeveloperAppDto) {
    const metadata: UpdateDeveloperAppDto = {};
    if (dto.name !== undefined) {
      metadata.name = this.sanitizeRequiredName(dto.name);
    }
    for (const key of ['category', 'icon', 'summary', 'description'] as const) {
      if (dto[key] !== undefined) {
        metadata[key] = dto[key]?.trim();
      }
    }
    return metadata;
  }

  private sanitizeRequiredName(value: string) {
    const name = String(value || '').trim();
    if (!name) {
      throw new BadRequestException('App name is required');
    }
    return name;
  }

  private assertDeveloperServiceEnabled() {
    if (!this.configService.get<boolean>('appMarketplace.developerService.enabled', false)) {
      throw new BadRequestException('Developer service apps are disabled');
    }
  }

  private normalizeDays(value: number) {
    const days = Number(value);
    if (!Number.isFinite(days)) return 7 as const;
    if (days <= 1) return 1 as const;
    if (days <= 7) return 7 as const;
    return 30 as const;
  }

  private emptyOverview(days: 1 | 7 | 30) {
    return {
      days,
      total_services: 0,
      total_invocations: 0,
      total_success: 0,
      total_failure: 0,
      total_rejected: 0,
      success_rate: 0,
      services: [],
    };
  }

  private preferredInstance(instances: AppServiceInstanceEntity[]) {
    return (
      instances.find((instance) => instance.role === 'active') ||
      instances.find((instance) => instance.role === 'candidate') ||
      instances.find((instance) => instance.role === 'standby')
    );
  }

  private toCount(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
  }

  private successRate(success: number, total: number) {
    return total > 0 ? Math.round((success / total) * 1000) / 10 : 0;
  }

  private async invocationAggregates(developerId: number, appIds: number[], days: 1 | 7 | 30) {
    const placeholders = appIds.map(() => '?').join(', ');
    return this.invocationRepo.query(
      `SELECT target_app_id,
        SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN outcome = 'failure' THEN 1 ELSE 0 END) AS failure_count,
        SUM(CASE WHEN outcome = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
        COUNT(*) AS total_count,
        MAX(create_time) AS last_invoke_time,
        MAX(CASE WHEN outcome = 'success' THEN create_time ELSE NULL END) AS last_success_time
      FROM app_service_invocation
      WHERE developer_id = ? AND target_app_id IN (${placeholders}) AND create_time >= ?
      GROUP BY target_app_id`,
      [developerId, ...appIds, this.since(days)],
    ) as Promise<Array<Record<string, unknown>>>;
  }

  private async invocationPercentiles(developerId: number, appIds: number[], days: 1 | 7 | 30) {
    const placeholders = appIds.map(() => '?').join(', ');
    return this.invocationRepo.query(
      `WITH ranked AS (
        SELECT target_app_id, duration_ms,
          ROW_NUMBER() OVER (PARTITION BY target_app_id ORDER BY duration_ms) AS row_number,
          COUNT(*) OVER (PARTITION BY target_app_id) AS row_count
        FROM app_service_invocation
        WHERE developer_id = ?
          AND target_app_id IN (${placeholders})
          AND create_time >= ?
          AND outcome IN ('success', 'failure')
      )
      SELECT target_app_id,
        MAX(CASE WHEN row_number = CEIL(row_count * 0.50) THEN duration_ms END) AS p50_duration_ms,
        MAX(CASE WHEN row_number = CEIL(row_count * 0.95) THEN duration_ms END) AS p95_duration_ms
      FROM ranked
      GROUP BY target_app_id`,
      [developerId, ...appIds, this.since(days)],
    ) as Promise<Array<Record<string, unknown>>>;
  }

  private since(days: 1 | 7 | 30) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
}
