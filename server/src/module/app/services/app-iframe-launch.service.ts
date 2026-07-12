import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

import { normalizeExternalHttpUrl } from '../../../common/utils/safe-url.util';
import { RedisService } from '../../../redis/redis.service';
import { normalizeApprovedCapabilities, type AppRuntimeCapability } from '../app-runtime.constants';
import { AppRuntimeSessionService } from './app-runtime-session.service';

const LAUNCH_TTL_SECONDS = 60;
const LAUNCH_FRAGMENT_PREFIX = '#agentstudio_launch=';
const TOKEN_PART_PATTERN = /^[A-Za-z0-9_-]+$/;
const NONCE_PATTERN = /^[a-f0-9]{32}$/;
const INVALID_LAUNCH_MESSAGE = 'Iframe launch is invalid or expired';

interface IframeLaunchClaims {
  version: 1;
  tenantId: number;
  userId: number;
  appId: number;
  versionId: number;
  installId: number;
  origin: string;
  capabilities: AppRuntimeCapability[];
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

export interface CreateIframeLaunchInput {
  tenantId: number;
  userId: number;
  appId: number;
  versionId: number;
  installId: number;
  entryUrl: string;
  allowedOrigins: unknown[];
  capabilities: string[];
}

export interface ExchangeIframeLaunchInput {
  tenantId: number;
  userId: number;
  launchToken: string;
}

@Injectable()
export class AppIframeLaunchService {
  constructor(
    private readonly redisService: RedisService,
    private readonly runtimeSessionService: AppRuntimeSessionService,
  ) {}

  isEnabled() {
    return (
      String(process.env.APP_RUNTIME_IFRAME_LAUNCH_ENABLED || '').toLowerCase() === 'true' &&
      this.runtimeSessionService.isEnabled()
    );
  }

  async create(input: CreateIframeLaunchInput) {
    const key = this.getSigningKey();
    const entryUrl = this.normalizeEntryUrl(input.entryUrl);
    const origin = new URL(entryUrl).origin;
    const allowedOrigins = new Set(
      input.allowedOrigins.map((value) => this.normalizeExactOrigin(value)),
    );
    if (!allowedOrigins.has(origin)) {
      throw new ForbiddenException('Iframe launch origin is not approved');
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + LAUNCH_TTL_SECONDS;
    const nonce = randomBytes(16).toString('hex');
    const capabilities = normalizeApprovedCapabilities(input.capabilities);
    const claims: IframeLaunchClaims = {
      version: 1,
      tenantId: this.positiveInteger(input.tenantId),
      userId: this.positiveInteger(input.userId),
      appId: this.positiveInteger(input.appId),
      versionId: this.positiveInteger(input.versionId),
      installId: this.positiveInteger(input.installId),
      origin,
      capabilities,
      issuedAt,
      expiresAt,
      nonce,
    };
    const token = this.sign(claims, key);

    try {
      const stored = await this.redisService
        .getClient()
        .set(this.nonceKey(nonce), '1', 'EX', LAUNCH_TTL_SECONDS, 'NX');
      if (stored !== 'OK') throw new Error('nonce unavailable');
    } catch {
      throw this.invalidLaunch();
    }

    return {
      fragment: `${LAUNCH_FRAGMENT_PREFIX}${token}`,
      expires_at: new Date(expiresAt * 1000).toISOString(),
      origin,
    };
  }

  async exchange(input: ExchangeIframeLaunchInput) {
    const claims = this.verify(input.launchToken, this.getSigningKey());
    if (claims.tenantId !== Number(input.tenantId) || claims.userId !== Number(input.userId)) {
      throw this.invalidLaunch();
    }

    const script = `
      if redis.call("get", KEYS[1]) == "1" then
        return redis.call("del", KEYS[1])
      end
      return 0
    `;
    let consumed = 0;
    try {
      consumed = Number(
        await this.redisService.getClient().eval(script, 1, this.nonceKey(claims.nonce)),
      );
    } catch {
      throw this.invalidLaunch();
    }
    if (consumed !== 1) throw this.invalidLaunch();

    return this.runtimeSessionService.issue({
      tenantId: claims.tenantId,
      userId: claims.userId,
      appId: claims.appId,
      versionId: claims.versionId,
      installId: claims.installId,
      capabilities: claims.capabilities,
    });
  }

  private getSigningKey() {
    if (!this.isEnabled()) throw new ForbiddenException('Iframe launch is disabled');
    const secret = String(process.env.APP_RUNTIME_LAUNCH_SECRET || '');
    if (secret.length < 32) throw new ForbiddenException('Iframe launch is disabled');
    return createHash('sha256').update(secret, 'utf8').digest();
  }

  private sign(claims: IframeLaunchClaims, key: Buffer) {
    const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
    const signature = createHmac('sha256', key).update(payload, 'utf8').digest('base64url');
    return `${payload}.${signature}`;
  }

  private verify(rawToken: string, key: Buffer): IframeLaunchClaims {
    const token = String(rawToken || '').trim();
    const parts = token.split('.');
    if (
      token.length > 4096 ||
      parts.length !== 2 ||
      parts.some((part) => !TOKEN_PART_PATTERN.test(part))
    ) {
      throw this.invalidLaunch();
    }
    const expected = createHmac('sha256', key).update(parts[0], 'utf8').digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(parts[1], 'base64url');
    } catch {
      throw this.invalidLaunch();
    }
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw this.invalidLaunch();
    }

    let claims: IframeLaunchClaims;
    try {
      claims = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf8'),
      ) as IframeLaunchClaims;
    } catch {
      throw this.invalidLaunch();
    }
    const now = Math.floor(Date.now() / 1000);
    let normalizedOrigin = '';
    try {
      normalizedOrigin = this.normalizeExactOrigin(claims?.origin);
    } catch {
      throw this.invalidLaunch();
    }
    if (
      claims?.version !== 1 ||
      !this.isPositiveInteger(claims.tenantId) ||
      !this.isPositiveInteger(claims.userId) ||
      !this.isPositiveInteger(claims.appId) ||
      !this.isPositiveInteger(claims.versionId) ||
      !this.isPositiveInteger(claims.installId) ||
      !Number.isInteger(claims.issuedAt) ||
      !Number.isInteger(claims.expiresAt) ||
      claims.issuedAt > now + 5 ||
      claims.expiresAt <= now ||
      claims.expiresAt - claims.issuedAt <= 0 ||
      claims.expiresAt - claims.issuedAt > LAUNCH_TTL_SECONDS ||
      !NONCE_PATTERN.test(String(claims.nonce || '')) ||
      normalizedOrigin !== claims.origin ||
      !Array.isArray(claims.capabilities)
    ) {
      throw this.invalidLaunch();
    }
    const capabilities = normalizeApprovedCapabilities(claims.capabilities);
    if (capabilities.length !== claims.capabilities.length) throw this.invalidLaunch();
    return { ...claims, capabilities };
  }

  private normalizeEntryUrl(value: unknown) {
    try {
      return normalizeExternalHttpUrl(String(value || ''), {
        label: 'Iframe app entry',
        httpsOnly: true,
      });
    } catch {
      throw new ForbiddenException('Iframe launch origin is not approved');
    }
  }

  private normalizeExactOrigin(value: unknown) {
    let parsed: URL;
    try {
      parsed = new URL(String(value || '').trim());
    } catch {
      throw new ForbiddenException('Iframe launch origin is not approved');
    }
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      throw new ForbiddenException('Iframe launch origin is not approved');
    }
    return parsed.origin;
  }

  private positiveInteger(value: unknown) {
    const normalized = Number(value);
    if (!this.isPositiveInteger(normalized)) throw this.invalidLaunch();
    return normalized;
  }

  private isPositiveInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && Number(value) > 0;
  }

  private nonceKey(nonce: string) {
    const digest = createHash('sha256').update(nonce, 'utf8').digest('hex');
    return `app-runtime:iframe-launch:${digest}`;
  }

  private invalidLaunch() {
    return new UnauthorizedException(INVALID_LAUNCH_MESSAGE);
  }
}
