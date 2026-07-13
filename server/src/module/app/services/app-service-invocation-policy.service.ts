import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  PayloadTooLargeException,
  RequestTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';

import { RedisService } from '../../../redis/redis.service';
import { AppLicenseAccessService } from '../../app-commerce/services/app-license-access.service';
import { SaasModuleService } from '../../saas/services/saas-module.service';
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppServiceInstanceEntity } from '../entities/app-service-instance.entity';
import { AppServiceInvocationEntity } from '../entities/app-service-invocation.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';
import type { AuthorizedAppRuntimeSession } from './app-runtime-session.service';
import type { AppServiceLoopbackResponse } from './app-service-loopback.transport';
import { AppServiceRuntimeService } from './app-service-runtime.service';

interface ResolvedInvocationTarget {
  app: AppPackageEntity;
  version: AppPackageVersionEntity;
  instance: AppServiceInstanceEntity;
}

interface InvocationContext {
  tenant: { id: string };
  user: { id: string };
  caller: { app_id: string; version_id: string };
}

@Injectable()
export class AppServiceInvocationPolicyService {
  private cleanupNotBefore = 0;

  constructor(
    @InjectRepository(AppPackageEntity)
    private readonly appRepo: Repository<AppPackageEntity>,
    @InjectRepository(AppPackageVersionEntity)
    private readonly versionRepo: Repository<AppPackageVersionEntity>,
    @InjectRepository(TenantAppInstallEntity)
    private readonly installRepo: Repository<TenantAppInstallEntity>,
    @InjectRepository(AppServiceInstanceEntity)
    private readonly instanceRepo: Repository<AppServiceInstanceEntity>,
    @InjectRepository(AppServiceInvocationEntity)
    private readonly invocationRepo: Repository<AppServiceInvocationEntity>,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly saasModuleService: SaasModuleService,
    private readonly systemModuleAccessService: SystemModuleAccessService,
    private readonly appLicenseAccessService: AppLicenseAccessService,
    private readonly runtimeService: AppServiceRuntimeService,
  ) {}

  async invoke(session: AuthorizedAppRuntimeSession, targetCode: string, input: unknown) {
    const startedAt = Date.now();
    const target = await this.resolveTarget(session, targetCode, startedAt);
    const lease = await this.acquireLease(session, target, startedAt);
    const context: InvocationContext = {
      tenant: { id: String(session.tenantId) },
      user: { id: String(session.userId) },
      caller: { app_id: String(session.appId), version_id: String(session.versionId) },
    };

    try {
      let response: AppServiceLoopbackResponse;
      try {
        response = await this.runtimeService.invokeAuthorized(
          target.app,
          target.version,
          context,
          input,
        );
      } catch (error) {
        if (!this.isServiceExecutionFailure(error)) {
          await this.record(session, target, {
            outcome: 'rejected',
            statusCode: this.statusCode(error),
            durationMs: Date.now() - startedAt,
            errorCode: 'service_target_policy_changed',
          });
          throw error;
        }
        try {
          await this.updateCircuit(session.tenantId, target.instance, true);
        } catch (circuitError) {
          await this.record(session, target, {
            outcome: 'failure',
            statusCode: this.statusCode(error),
            durationMs: Date.now() - startedAt,
            errorCode: this.failureCode(error),
          });
          throw circuitError;
        }
        await this.record(session, target, {
          outcome: 'failure',
          statusCode: this.statusCode(error),
          durationMs: Date.now() - startedAt,
          errorCode: this.failureCode(error),
        });
        throw error;
      }
      const serviceFailure = response.statusCode >= 500 && response.statusCode <= 599;
      try {
        await this.updateCircuit(session.tenantId, target.instance, serviceFailure);
      } catch (error) {
        await this.record(session, target, {
          outcome: serviceFailure ? 'failure' : 'rejected',
          statusCode: serviceFailure ? response.statusCode : 503,
          durationMs: Date.now() - startedAt,
          errorCode: serviceFailure ? 'service_http_5xx' : 'service_quota_unavailable',
        });
        throw error;
      }
      await this.record(session, target, {
        outcome: serviceFailure ? 'failure' : 'success',
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        errorCode: serviceFailure ? 'service_http_5xx' : '',
      });
      return {
        status: response.statusCode,
        headers: response.headers,
        data: response.body,
      };
    } finally {
      await this.releaseLease(session, target, lease.key);
      this.scheduleRetentionCleanup();
    }
  }

  private async resolveTarget(
    session: AuthorizedAppRuntimeSession,
    targetCode: string,
    startedAt: number,
  ): Promise<ResolvedInvocationTarget> {
    const callerVersion = await this.versionRepo.findOne({
      where: { id: session.versionId, appId: session.appId, deleteTime: IsNull() },
    });
    const declaredTargets = Array.isArray(callerVersion?.serviceTargets)
      ? callerVersion.serviceTargets
      : [];
    if (!callerVersion || !declaredTargets.includes(targetCode)) {
      await this.reject(session, null, null, startedAt, 'service_target_not_declared', 403);
    }

    const app = await this.appRepo.findOne({
      where: {
        code: targetCode,
        type: 'service',
        runtimeType: 'service',
        status: 'published',
        deleteTime: IsNull(),
      },
    });
    if (
      !app ||
      (app.trustLevel !== 'platform_trusted' && app.trustLevel !== 'developer_restricted')
    ) {
      await this.reject(session, app, null, startedAt, 'service_target_unavailable', 403);
    }

    const install = await this.installRepo.findOne({
      where: {
        tenantId: session.tenantId,
        appId: app.id,
        enabled: 1,
        deleteTime: IsNull(),
      },
    });
    if (!install?.versionId) {
      await this.reject(session, app, null, startedAt, 'service_target_not_installed', 403);
    }

    const version = await this.versionRepo.findOne({
      where: {
        appId: app.id,
        reviewStatus: 'approved',
        publishStatus: 'published',
        deleteTime: IsNull(),
      },
      order: { id: 'DESC' },
    });
    if (!version) {
      await this.reject(session, app, null, startedAt, 'service_target_unpublished', 403);
    }
    if (Number(install.versionId) !== Number(version.id)) {
      await this.reject(
        session,
        app,
        version,
        startedAt,
        'service_target_version_mismatch',
        409,
      );
    }
    if (!(await this.hasCurrentEntitlement(session.tenantId, app))) {
      await this.reject(session, app, version, startedAt, 'service_target_not_entitled', 403);
    }

    const instance = await this.instanceRepo.findOne({
      where: {
        appId: app.id,
        versionId: version.id,
        role: 'active',
        processStatus: 'online',
        healthStatus: 'healthy',
      },
    });
    if (!instance) {
      await this.reject(session, app, version, startedAt, 'service_target_unhealthy', 503);
    }
    return { app, version, instance };
  }

  private async acquireLease(
    session: AuthorizedAppRuntimeSession,
    target: ResolvedInvocationTarget,
    startedAt: number,
  ) {
    const keys = this.redisKeys(session.tenantId, target.app.id);
    const script = `
      local open_ttl = redis.call('TTL', KEYS[3])
      if open_ttl > 0 then return {3, open_ttl, 0} end
      local rate = redis.call('INCR', KEYS[2])
      if rate == 1 then redis.call('EXPIRE', KEYS[2], 60) end
      local rate_ttl = redis.call('TTL', KEYS[2])
      if rate > tonumber(ARGV[2]) then return {2, rate_ttl, 0} end
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3])) end
      if current > tonumber(ARGV[1]) then
        redis.call('DECR', KEYS[1])
        return {1, 1, current - 1}
      end
      return {0, 0, current}
    `;
    let raw: unknown;
    try {
      raw = await this.redisService
        .getClient()
        .eval(
          script,
          3,
          keys.concurrency,
          keys.rate,
          keys.circuitOpen,
          this.concurrencyLimit(),
          this.rateLimit(),
          35,
        );
    } catch {
      await this.reject(session, target.app, target.version, startedAt, 'service_quota_unavailable', 503);
    }
    if (!Array.isArray(raw) || raw.length < 3) {
      await this.reject(session, target.app, target.version, startedAt, 'service_quota_unavailable', 503);
    }
    const code = this.redisInteger(raw[0]);
    const retryValue = this.redisInteger(raw[1]);
    const currentValue = this.redisInteger(raw[2]);
    if (code === null || retryValue === null || currentValue === null) {
      await this.reject(session, target.app, target.version, startedAt, 'service_quota_unavailable', 503);
    }
    const retryAfter = this.retryAfter(retryValue);
    const current = Math.max(0, currentValue);
    if (code === 1) {
      await this.reject(session, target.app, target.version, startedAt, 'service_concurrency_limited', 429, retryAfter || 1);
    }
    if (code === 2) {
      await this.reject(session, target.app, target.version, startedAt, 'service_rate_limited', 429, retryAfter);
    }
    if (code === 3) {
      await this.reject(session, target.app, target.version, startedAt, 'service_circuit_open', 503, retryAfter);
    }
    if (code !== 0) {
      await this.reject(session, target.app, target.version, startedAt, 'service_quota_unavailable', 503);
    }
    try {
      await this.instanceRepo.update(
        { id: target.instance.id },
        { activeInvocations: current, lastInvokeTime: new Date() },
      );
    } catch {
      // Redis owns the lease; instance counters are operational mirrors only.
    }
    return { key: keys.concurrency };
  }

  private async releaseLease(
    session: AuthorizedAppRuntimeSession,
    target: ResolvedInvocationTarget,
    concurrencyKey: string,
  ) {
    const script = `
      local current = tonumber(redis.call('GET', KEYS[1]) or '0')
      if current <= 1 then redis.call('DEL', KEYS[1]); return 0 end
      return redis.call('DECR', KEYS[1])
    `;
    try {
      const raw = await this.redisService.getClient().eval(script, 1, concurrencyKey);
      const parsed = this.redisInteger(raw);
      if (parsed === null) throw new Error('invalid_concurrency_state');
      const current = Math.max(0, parsed);
      await this.instanceRepo.update({ id: target.instance.id }, { activeInvocations: current });
    } catch {
      // The short Redis TTL remains the fail-safe for an unavailable release operation.
    }
  }

  private async updateCircuit(
    tenantId: number,
    instance: AppServiceInstanceEntity,
    failed: boolean,
  ) {
    const keys = this.redisKeys(tenantId, instance.appId);
    const script = failed
      ? `
          local failures = redis.call('INCR', KEYS[1])
          redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
          if failures >= tonumber(ARGV[1]) then
            redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[2]))
            return {failures, tonumber(ARGV[2])}
          end
          return {failures, 0}
        `
      : `redis.call('DEL', KEYS[1]); redis.call('DEL', KEYS[2]); return {0, 0}`;
    let failures = 0;
    let retryAfter = 0;
    try {
      const raw = await this.redisService
        .getClient()
        .eval(
          script,
          2,
          keys.circuitFailures,
          keys.circuitOpen,
          this.circuitFailures(),
          this.circuitOpenSeconds(),
          Math.max(120, this.circuitOpenSeconds() * 2),
        );
      if (!Array.isArray(raw) || raw.length < 2) throw new Error('invalid_circuit_state');
      const failureValue = this.redisInteger(raw[0]);
      const retryValue = this.redisInteger(raw[1]);
      if (failureValue === null || retryValue === null) throw new Error('invalid_circuit_state');
      failures = Math.max(0, failureValue);
      retryAfter = this.retryAfter(retryValue, 0);
    } catch {
      throw new ServiceUnavailableException('service_quota_unavailable');
    }
    try {
      await this.instanceRepo.update(
        { id: instance.id },
        failed
          ? {
              consecutiveFailures: failures,
              circuitState: retryAfter > 0 ? 'open' : 'closed',
              circuitOpenUntil:
                retryAfter > 0 ? new Date(Date.now() + retryAfter * 1000) : null,
              lastInvokeTime: new Date(),
              lastErrorCode: 'service_invocation_failed',
              lastErrorMessage: 'Service invocation failed',
            }
          : {
              consecutiveFailures: 0,
              circuitState: 'closed',
              circuitOpenUntil: null,
              lastInvokeTime: new Date(),
              lastSuccessTime: new Date(),
              lastErrorCode: '',
              lastErrorMessage: '',
            },
      );
    } catch {
      // Redis remains authoritative when the operations mirror is unavailable.
    }
    return { failures, retryAfter };
  }

  private async hasCurrentEntitlement(tenantId: number, app: AppPackageEntity) {
    try {
      const commerce = await this.appLicenseAccessService.getAccessState(tenantId, {
        ...app,
        installed: true,
      });
      if (!commerce.can_open) return false;
      if (app.saasModuleCode) {
        await this.saasModuleService.assertTenantModuleEnabled(tenantId, app.saasModuleCode);
      }
      if (app.systemModuleCode) {
        await this.systemModuleAccessService.assertModuleAccess({
          tenantId,
          moduleCode: app.systemModuleCode,
          requiredSaasModuleCode: app.saasModuleCode || undefined,
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  private async reject(
    session: AuthorizedAppRuntimeSession,
    app: AppPackageEntity | null,
    version: AppPackageVersionEntity | null,
    startedAt: number,
    errorCode: string,
    statusCode: number,
    retryAfter?: number,
  ): Promise<never> {
    await this.record(session, app && version ? { app, version, instance: null as never } : null, {
      outcome: 'rejected',
      statusCode,
      durationMs: Date.now() - startedAt,
      errorCode,
    }, app, version);
    const body = { message: errorCode, ...(retryAfter ? { retry_after: retryAfter } : {}) };
    if (statusCode === 403) throw new ForbiddenException(body);
    if (statusCode === 503) throw new ServiceUnavailableException(body);
    throw new HttpException(body, statusCode || HttpStatus.BAD_REQUEST);
  }

  private async record(
    session: AuthorizedAppRuntimeSession,
    target: ResolvedInvocationTarget | null,
    input: {
      outcome: 'success' | 'failure' | 'rejected';
      statusCode?: number | null;
      durationMs: number;
      errorCode: string;
    },
    fallbackApp?: AppPackageEntity | null,
    fallbackVersion?: AppPackageVersionEntity | null,
  ) {
    const app = target?.app || fallbackApp;
    const version = target?.version || fallbackVersion;
    try {
      await this.invocationRepo.save(
        this.invocationRepo.create({
          tenantId: session.tenantId,
          callerAppId: session.appId,
          callerVersionId: session.versionId,
          targetAppId: app?.id || 0,
          targetVersionId: version?.id || 0,
          developerId: app?.developerId ?? null,
          outcome: input.outcome,
          statusCode: input.statusCode ?? null,
          durationMs: Math.min(2_147_483_647, Math.max(0, Math.trunc(input.durationMs) || 0)),
          errorCode: String(input.errorCode || '').slice(0, 80),
        }),
      );
    } catch {
      // Invocation metrics must never change the authorized call outcome.
    }
  }

  private redisKeys(tenantId: number, targetAppId: number) {
    const prefix = `app_service:invoke:tenant:${Number(tenantId)}:target:${Number(targetAppId)}`;
    return {
      concurrency: `${prefix}:concurrency`,
      rate: `${prefix}:rate`,
      circuitFailures: `${prefix}:circuit:failures`,
      circuitOpen: `${prefix}:circuit:open`,
    };
  }

  private statusCode(error: unknown) {
    return error instanceof HttpException ? error.getStatus() : 502;
  }

  private failureCode(error: unknown) {
    if (error instanceof RequestTimeoutException) return 'service_timeout';
    if (error instanceof PayloadTooLargeException) return 'service_response_too_large';
    if (error instanceof BadGatewayException) return 'service_gateway_failure';
    return 'service_gateway_failure';
  }

  private isServiceExecutionFailure(error: unknown) {
    return (
      error instanceof RequestTimeoutException ||
      error instanceof PayloadTooLargeException ||
      error instanceof BadGatewayException
    );
  }

  private concurrencyLimit() {
    return this.clamp('appMarketplace.developerService.concurrency', 20, 1, 100);
  }

  private rateLimit() {
    return this.clamp('appMarketplace.developerService.ratePerMinute', 60, 1, 6000);
  }

  private circuitFailures() {
    return this.clamp('appMarketplace.developerService.circuitFailures', 5, 2, 20);
  }

  private circuitOpenSeconds() {
    return this.clamp('appMarketplace.developerService.circuitOpenSeconds', 60, 10, 3600);
  }

  private clamp(key: string, fallback: number, min: number, max: number) {
    const value = Number(this.configService.get<number>(key) ?? fallback);
    return Math.min(max, Math.max(min, Math.trunc(value) || fallback));
  }

  private retryAfter(value: unknown, fallback = 1) {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(3600, parsed) : fallback;
  }

  private redisInteger(value: unknown): number | null {
    if (typeof value === 'string' && !/^-?\d+$/.test(value)) return null;
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  private scheduleRetentionCleanup() {
    const now = Date.now();
    if (now < this.cleanupNotBefore) return;
    this.cleanupNotBefore = now + 60 * 60 * 1000;
    const retentionDays = this.clamp(
      'appMarketplace.developerService.logRetentionDays',
      7,
      1,
      30,
    );
    const cutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000);
    void this.invocationRepo.delete({ createTime: LessThan(cutoff) }).catch(() => undefined);
  }
}
