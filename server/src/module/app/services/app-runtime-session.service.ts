import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';

import { SysUserTenantEntity } from '../../system/user/entities/user-tenant.entity';
import { SaasModuleService } from '../../saas/services/saas-module.service';
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
import { RedisService } from '../../../redis/redis.service';
import { type AppRuntimeCapability, normalizeApprovedCapabilities } from '../app-runtime.constants';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppRuntimeAuditLogEntity } from '../entities/app-runtime-audit-log.entity';
import { AppRuntimeSessionEntity } from '../entities/app-runtime-session.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';
import { AppCapabilityPolicyService } from './app-capability-policy.service';

export interface IssueAppRuntimeSessionInput {
  tenantId: number;
  userId: number;
  appId: number;
  versionId: number;
  installId: number;
  capabilities: string[];
  clientMetadata?: Record<string, unknown>;
}

export interface AppRuntimeRequestMetadata {
  requestId?: string;
  ip?: string;
  userAgent?: string;
}

export interface AuthorizedAppRuntimeSession {
  id: number;
  tenantId: number;
  userId: number;
  appId: number;
  versionId: number;
  installId: number;
  capabilities: AppRuntimeCapability[];
}

@Injectable()
export class AppRuntimeSessionService {
  constructor(
    @InjectRepository(AppRuntimeSessionEntity)
    private readonly sessionRepo: Repository<AppRuntimeSessionEntity>,
    @InjectRepository(AppRuntimeAuditLogEntity)
    private readonly auditRepo: Repository<AppRuntimeAuditLogEntity>,
    @InjectRepository(TenantAppInstallEntity)
    private readonly installRepo: Repository<TenantAppInstallEntity>,
    @InjectRepository(AppPackageEntity)
    private readonly appRepo: Repository<AppPackageEntity>,
    @InjectRepository(AppPackageVersionEntity)
    private readonly versionRepo: Repository<AppPackageVersionEntity>,
    @InjectRepository(SysUserTenantEntity)
    private readonly membershipRepo: Repository<SysUserTenantEntity>,
    private readonly capabilityPolicy: AppCapabilityPolicyService,
    private readonly saasModuleService: SaasModuleService,
    private readonly systemModuleAccessService: SystemModuleAccessService,
    private readonly redisService: RedisService,
  ) {}

  async issue(input: IssueAppRuntimeSessionInput) {
    this.assertEnabled();
    const capabilities = normalizeApprovedCapabilities(input.capabilities);
    const [install, app, version, membership, granted] = await this.loadAuthorityBindings(input);
    if (!install || !app || !version || !membership) {
      throw new UnauthorizedException('App runtime authority is inactive');
    }
    if (!(await this.hasCurrentEntitlement(input.tenantId, app))) {
      throw new ForbiddenException('App runtime entitlement is inactive');
    }
    const grantedSet = new Set(granted);
    if (capabilities.some((capability) => !grantedSet.has(capability))) {
      throw new ForbiddenException('App runtime capability is not granted');
    }
    const token = randomBytes(32).toString('base64url');
    const expiresTime = new Date(Date.now() + this.getTtlSeconds() * 1000);
    const session = this.sessionRepo.create({
      tokenHash: this.hashToken(token),
      tenantId: input.tenantId,
      userId: input.userId,
      appId: input.appId,
      versionId: input.versionId,
      installId: input.installId,
      capabilities,
      nonce: randomBytes(16).toString('hex'),
      clientMetadata: input.clientMetadata || null,
      expiresTime,
      revokedTime: null,
      revokeReason: '',
      lastUsedTime: null,
    });
    await this.sessionRepo.save(session);
    return {
      token,
      expires_at: expiresTime.toISOString(),
      capabilities,
    };
  }

  async authorize(
    token: string,
    capability: AppRuntimeCapability,
    request: AppRuntimeRequestMetadata = {},
  ): Promise<AuthorizedAppRuntimeSession> {
    this.assertEnabled();
    const session = await this.sessionRepo.findOne({ where: { tokenHash: this.hashToken(token) } });
    if (!session) {
      await this.deny(null, capability, 'unknown_token', request, UnauthorizedException);
    }
    if (session.revokedTime) {
      await this.deny(session, capability, 'revoked', request, UnauthorizedException);
    }
    if (session.expiresTime.getTime() <= Date.now()) {
      await this.deny(session, capability, 'expired', request, UnauthorizedException);
    }
    if (!session.capabilities.includes(capability)) {
      await this.deny(session, capability, 'capability_missing', request, ForbiddenException);
    }

    const [install, app, version, membership, granted] = await this.loadAuthorityBindings(session);

    if (!install)
      await this.deny(session, capability, 'installation_inactive', request, UnauthorizedException);
    if (!app)
      await this.deny(session, capability, 'app_unpublished', request, UnauthorizedException);
    if (!version)
      await this.deny(session, capability, 'version_unpublished', request, UnauthorizedException);
    if (!membership)
      await this.deny(session, capability, 'membership_inactive', request, UnauthorizedException);
    if (!(await this.hasCurrentEntitlement(session.tenantId, app))) {
      await this.deny(session, capability, 'entitlement_inactive', request, ForbiddenException);
    }
    if (!granted.includes(capability)) {
      await this.deny(session, capability, 'consent_revoked', request, ForbiddenException);
    }
    await this.enforceRateLimit(session, capability, request);

    await this.sessionRepo.update(session.id, { lastUsedTime: new Date() });
    await this.audit(session, capability, 'allowed', 'authorized', request);
    return {
      id: session.id,
      tenantId: session.tenantId,
      userId: session.userId,
      appId: session.appId,
      versionId: session.versionId,
      installId: session.installId,
      capabilities: session.capabilities as AppRuntimeCapability[],
    };
  }

  private loadAuthorityBindings(input: {
    tenantId: number;
    userId: number;
    appId: number;
    versionId: number;
    installId: number;
  }) {
    return Promise.all([
      this.installRepo.findOne({
        where: {
          id: input.installId,
          tenantId: input.tenantId,
          appId: input.appId,
          versionId: input.versionId,
          enabled: 1,
          deleteTime: IsNull(),
        },
      }),
      this.appRepo.findOne({
        where: { id: input.appId, status: 'published', deleteTime: IsNull() },
        select: { id: true, saasModuleCode: true, systemModuleCode: true },
      }),
      this.versionRepo.findOne({
        where: {
          id: input.versionId,
          appId: input.appId,
          reviewStatus: 'approved',
          publishStatus: 'published',
          deleteTime: IsNull(),
        },
        select: { id: true },
      }),
      this.membershipRepo.findOne({
        where: { tenantId: input.tenantId, userId: input.userId, deleteTime: IsNull() },
        select: { id: true },
      }),
      this.capabilityPolicy.resolveGrantedCapabilities(input.tenantId, input.versionId),
    ]);
  }

  private async hasCurrentEntitlement(tenantId: number, app: AppPackageEntity) {
    try {
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

  private async enforceRateLimit(
    session: AppRuntimeSessionEntity,
    capability: AppRuntimeCapability,
    request: AppRuntimeRequestMetadata,
  ) {
    const windowSeconds = 60;
    const rateLimit = this.getRateLimitPerMinute();
    const key = `app_runtime:rate:${session.id}:${capability}`;
    const script = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      local ttl = redis.call('TTL', KEYS[1])
      if ttl < 0 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
        ttl = tonumber(ARGV[1])
      end
      return { current, ttl }
    `;

    let result: unknown;
    try {
      result = await this.redisService.getClient().eval(script, 1, key, windowSeconds, rateLimit);
    } catch {
      await this.auditBestEffort(session, capability, 'rate_limit_unavailable', request);
      throw new ServiceUnavailableException('App runtime rate limit is unavailable');
    }

    const [count, ttl] = Array.isArray(result) ? result.map(Number) : [Number.NaN, Number.NaN];
    if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
      await this.auditBestEffort(session, capability, 'rate_limit_unavailable', request);
      throw new ServiceUnavailableException('App runtime rate limit is unavailable');
    }
    if (count > rateLimit) {
      const retryAfter = Math.min(windowSeconds, Math.max(1, Math.trunc(ttl)));
      if (count === rateLimit + 1) {
        await this.auditBestEffort(session, capability, 'rate_limited', request);
      }
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'App runtime capability rate limit exceeded',
          error: 'Too Many Requests',
          retry_after: retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async auditBestEffort(
    session: AppRuntimeSessionEntity,
    capability: AppRuntimeCapability,
    reasonCode: string,
    request: AppRuntimeRequestMetadata,
  ) {
    try {
      await this.audit(session, capability, 'denied', reasonCode, request);
    } catch {
      // Authorization remains fail-closed even when operational audit storage is unavailable.
    }
  }

  async revokeInstall(tenantId: number, installId: number, reason: string) {
    const result = await this.sessionRepo.update(
      { tenantId, installId, revokedTime: IsNull() },
      { revokedTime: new Date(), revokeReason: this.limit(reason, 50) },
    );
    return Number(result.affected || 0);
  }

  async revokeVersion(versionId: number, reason: string) {
    const result = await this.sessionRepo.update(
      { versionId, revokedTime: IsNull() },
      { revokedTime: new Date(), revokeReason: this.limit(reason, 50) },
    );
    return Number(result.affected || 0);
  }

  isEnabled() {
    return (
      String(process.env.APP_RUNTIME_CAPABILITIES_ENABLED || '')
        .trim()
        .toLowerCase() === 'true'
    );
  }

  private assertEnabled() {
    if (!this.isEnabled()) throw new ForbiddenException('App runtime capabilities are disabled');
  }

  private getTtlSeconds() {
    const configured = Number.parseInt(
      String(process.env.APP_RUNTIME_SESSION_TTL_SECONDS || ''),
      10,
    );
    const value = Number.isFinite(configured) ? configured : 300;
    return Math.min(900, Math.max(60, value));
  }

  private getRateLimitPerMinute() {
    const configured = Number.parseInt(
      String(process.env.APP_RUNTIME_CAPABILITY_RATE_LIMIT_PER_MINUTE || ''),
      10,
    );
    const value = Number.isFinite(configured) ? configured : 120;
    return Math.min(1000, Math.max(1, value));
  }

  private hashToken(token: string) {
    return createHash('sha256')
      .update(String(token || ''), 'utf8')
      .digest('hex');
  }

  private async deny(
    session: AppRuntimeSessionEntity | null,
    capability: AppRuntimeCapability,
    reasonCode: string,
    request: AppRuntimeRequestMetadata,
    ExceptionType: typeof UnauthorizedException | typeof ForbiddenException,
  ): Promise<never> {
    await this.audit(session, capability, 'denied', reasonCode, request);
    throw new ExceptionType('App runtime authorization denied');
  }

  private async audit(
    session: AppRuntimeSessionEntity | null,
    capability: AppRuntimeCapability,
    outcome: 'allowed' | 'denied',
    reasonCode: string,
    request: AppRuntimeRequestMetadata,
  ) {
    await this.auditRepo.save(
      this.auditRepo.create({
        sessionId: session?.id ?? null,
        tenantId: session?.tenantId ?? 0,
        userId: session?.userId ?? 0,
        appId: session?.appId ?? 0,
        versionId: session?.versionId ?? 0,
        capability: this.limit(capability, 80),
        action: 'authorize',
        outcome,
        reasonCode: this.limit(reasonCode, 50),
        requestId: this.limit(request.requestId, 100),
        ip: this.limit(request.ip, 80),
        userAgent: this.limit(request.userAgent, 500),
      }),
    );
  }

  private limit(value: unknown, maxLength: number) {
    return String(value || '').slice(0, maxLength);
  }
}
