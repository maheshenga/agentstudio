import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';

import { SetAppRuntimeKvDto } from '../dto/app-runtime-kv.dto';
import { AppRuntimeKvEntity } from '../entities/app-runtime-kv.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';
import { AuthorizedAppRuntimeSession } from './app-runtime-session.service';

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_VALUE_BYTES = 64 * 1024;

@Injectable()
export class AppRuntimeKvService {
  constructor(
    @InjectRepository(AppRuntimeKvEntity)
    private readonly kvRepo: Repository<AppRuntimeKvEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async get(session: AuthorizedAppRuntimeSession, namespace: string, key: string) {
    const scope = this.normalizeScope(namespace, key);
    const row = await this.kvRepo.findOne({
      where: [
        { tenantId: session.tenantId, appId: session.appId, ...scope, expiresTime: IsNull() },
        {
          tenantId: session.tenantId,
          appId: session.appId,
          ...scope,
          expiresTime: MoreThan(new Date()),
        },
      ],
    });
    if (!row) throw new NotFoundException('App runtime KV value was not found');
    return this.toResponse(row);
  }

  async set(
    session: AuthorizedAppRuntimeSession,
    namespace: string,
    key: string,
    input: SetAppRuntimeKvDto,
  ) {
    const scope = this.normalizeScope(namespace, key);
    const serialized = this.serializeValue(input?.value);
    const sizeByte = Buffer.byteLength(serialized, 'utf8');
    if (sizeByte > MAX_VALUE_BYTES) {
      throw new PayloadTooLargeException('App runtime KV value exceeds 64 KB');
    }
    const ttlSeconds = this.normalizeTtl(input?.ttl_seconds);

    return this.dataSource.transaction(async (manager) => {
      const installRepo = manager.getRepository(TenantAppInstallEntity);
      const transactionRepo = manager.getRepository(AppRuntimeKvEntity);
      const install = await installRepo.findOne({
        where: {
          id: session.installId,
          tenantId: session.tenantId,
          appId: session.appId,
          versionId: session.versionId,
          enabled: 1,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!install) throw new UnauthorizedException('App runtime installation is inactive');

      const stored = await transactionRepo.findOne({
        where: { tenantId: session.tenantId, appId: session.appId, ...scope },
        lock: { mode: 'pessimistic_write' },
      });
      const now = new Date();
      const active =
        stored && (!stored.expiresTime || stored.expiresTime.getTime() > now.getTime());
      const currentVersion = active ? stored.version : 0;
      if (input?.expected_version !== undefined && input.expected_version !== currentVersion) {
        throw new ConflictException('App runtime KV version conflict');
      }

      const usage = await transactionRepo
        .createQueryBuilder('kv')
        .select('COUNT(*)', 'key_count')
        .addSelect('COALESCE(SUM(kv.sizeByte), 0)', 'size_byte')
        .where('kv.tenantId = :tenantId', { tenantId: session.tenantId })
        .andWhere('kv.appId = :appId', { appId: session.appId })
        .andWhere('(kv.expiresTime IS NULL OR kv.expiresTime > :now)', { now })
        .getRawOne<{ key_count: string; size_byte: string }>();
      const keyCount = Number(usage?.key_count || 0) + (active ? 0 : 1);
      const totalBytes =
        Number(usage?.size_byte || 0) - (active ? Number(stored.sizeByte) : 0) + sizeByte;
      if (keyCount > this.getMaxKeys() || totalBytes > this.getMaxBytes()) {
        throw new PayloadTooLargeException('App runtime KV quota exceeded');
      }

      const expiresTime = ttlSeconds ? new Date(now.getTime() + ttlSeconds * 1000) : null;
      const row = stored
        ? Object.assign(stored, {
            value: input.value,
            sizeByte,
            version: currentVersion + 1,
            expiresTime,
          })
        : transactionRepo.create({
            tenantId: session.tenantId,
            appId: session.appId,
            ...scope,
            value: input.value,
            sizeByte,
            version: 1,
            expiresTime,
          });
      return this.toResponse(await transactionRepo.save(row));
    });
  }

  async delete(session: AuthorizedAppRuntimeSession, namespace: string, key: string) {
    const scope = this.normalizeScope(namespace, key);
    const result = await this.kvRepo.delete({
      tenantId: session.tenantId,
      appId: session.appId,
      ...scope,
    });
    return { deleted: Number(result.affected || 0) > 0 };
  }

  private normalizeScope(namespace: string, key: string) {
    return {
      namespace: this.normalizeName(namespace, 64, 'namespace'),
      key: this.normalizeName(key, 191, 'key'),
    };
  }

  private normalizeName(value: string, maxLength: number, label: string) {
    const normalized = String(value || '').trim();
    if (!normalized || normalized.length > maxLength || !NAME_PATTERN.test(normalized)) {
      throw new BadRequestException(`Invalid app runtime KV ${label}`);
    }
    return normalized;
  }

  private serializeValue(value: unknown) {
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) throw new Error('not JSON');
      return serialized;
    } catch {
      throw new BadRequestException('App runtime KV value must be valid JSON');
    }
  }

  private normalizeTtl(value?: number) {
    if (value === undefined) return undefined;
    if (!Number.isInteger(value) || value < 60 || value > 2_592_000) {
      throw new BadRequestException('App runtime KV TTL must be between 60 and 2592000 seconds');
    }
    return value;
  }

  private getMaxKeys() {
    return this.clampEnv('APP_RUNTIME_KV_MAX_KEYS', 1000, 1, 100_000);
  }

  private getMaxBytes() {
    return this.clampEnv('APP_RUNTIME_KV_MAX_BYTES', 5 * 1024 * 1024, 1024, 1024 * 1024 * 1024);
  }

  private clampEnv(name: string, fallback: number, minimum: number, maximum: number) {
    const parsed = Number.parseInt(String(process.env[name] || ''), 10);
    const value = Number.isFinite(parsed) ? parsed : fallback;
    return Math.min(maximum, Math.max(minimum, value));
  }

  private toResponse(row: AppRuntimeKvEntity) {
    return {
      namespace: row.namespace,
      key: row.key,
      value: row.value,
      version: row.version,
      expires_at: row.expiresTime?.toISOString() || null,
    };
  }
}
