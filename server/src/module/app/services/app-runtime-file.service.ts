import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { createReadStream, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import { basename, resolve, sep } from 'path';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';

import { AppStorageObjectEntity } from '../entities/app-storage-object.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';
import { AuthorizedAppRuntimeSession } from './app-runtime-session.service';

const OBJECT_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

@Injectable()
export class AppRuntimeFileService {
  constructor(
    @InjectRepository(AppStorageObjectEntity)
    private readonly objectRepo: Repository<AppStorageObjectEntity>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async upload(session: AuthorizedAppRuntimeSession, file: Express.Multer.File) {
    this.assertUpload(file);
    const objectId = randomBytes(32).toString('base64url');
    const storageKey = `${session.tenantId}/${session.appId}/${objectId}`;
    const finalPath = this.resolveOwnedPath(session, objectId);
    const temporaryPath = `${finalPath}.${randomBytes(8).toString('hex')}.tmp`;
    const sizeByte = file.buffer.length;
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const originalName = this.safeName(file.originalname);
    const mimeType = String(file.mimetype || '')
      .trim()
      .toLowerCase();

    mkdirSync(resolve(finalPath, '..'), { recursive: true });
    writeFileSync(temporaryPath, file.buffer, { flag: 'wx' });
    let finalWritten = false;
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const installRepo = manager.getRepository(TenantAppInstallEntity);
        const transactionRepo = manager.getRepository(AppStorageObjectEntity);
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

        const now = new Date();
        const usage = await transactionRepo
          .createQueryBuilder('object')
          .select('COALESCE(SUM(object.sizeByte), 0)', 'size_byte')
          .where('object.tenantId = :tenantId', { tenantId: session.tenantId })
          .andWhere('object.appId = :appId', { appId: session.appId })
          .andWhere('object.status = :status', { status: 'active' })
          .andWhere('(object.expiresTime IS NULL OR object.expiresTime > :now)', { now })
          .getRawOne<{ size_byte: string }>();
        if (Number(usage?.size_byte || 0) + sizeByte > this.getQuotaBytes()) {
          throw new PayloadTooLargeException('App runtime file quota exceeded');
        }

        const row = transactionRepo.create({
          objectId,
          tenantId: session.tenantId,
          appId: session.appId,
          ownerUserId: session.userId,
          storageKey,
          originalName,
          mimeType,
          sizeByte,
          checksum,
          status: 'active',
          expiresTime: null,
        });
        const entity = await transactionRepo.save(row);
        renameSync(temporaryPath, finalPath);
        finalWritten = true;
        return entity;
      });
      return this.toMetadata(saved);
    } catch (error) {
      rmSync(temporaryPath, { force: true });
      if (finalWritten) rmSync(finalPath, { force: true });
      throw error;
    }
  }

  async open(session: AuthorizedAppRuntimeSession, objectId: string) {
    const safeObjectId = this.safeObjectId(objectId);
    const row = await this.objectRepo.findOne({
      where: [
        {
          objectId: safeObjectId,
          tenantId: session.tenantId,
          appId: session.appId,
          status: 'active',
          expiresTime: IsNull(),
        },
        {
          objectId: safeObjectId,
          tenantId: session.tenantId,
          appId: session.appId,
          status: 'active',
          expiresTime: MoreThan(new Date()),
        },
      ],
    });
    if (!row) throw new NotFoundException('App runtime file was not found');
    const filePath = this.resolveOwnedPath(session, safeObjectId);
    if (!existsSync(filePath)) throw new NotFoundException('App runtime file was not found');
    return {
      stream: createReadStream(filePath),
      name: this.safeName(row.originalName),
      mimeType: this.safeMimeType(row.mimeType),
      size: Number(row.sizeByte),
    };
  }

  async delete(session: AuthorizedAppRuntimeSession, objectId: string) {
    const safeObjectId = this.safeObjectId(objectId);
    const result = await this.objectRepo.update(
      {
        objectId: safeObjectId,
        tenantId: session.tenantId,
        appId: session.appId,
        status: 'active',
      },
      { status: 'deleted' },
    );
    const deleted = Number(result.affected || 0) > 0;
    if (deleted) {
      try {
        rmSync(this.resolveOwnedPath(session, safeObjectId), { force: true });
      } catch {
        // Metadata remains authoritative; orphan cleanup is an operational follow-up.
      }
    }
    return { deleted };
  }

  private assertUpload(file?: Express.Multer.File) {
    if (!file?.buffer || file.buffer.length === 0 || Number(file.size || 0) <= 0) {
      throw new BadRequestException('App runtime file must not be empty');
    }
    const declaredSize = Number(file.size || file.buffer.length);
    if (declaredSize > this.getMaxFileBytes() || file.buffer.length > this.getMaxFileBytes()) {
      throw new PayloadTooLargeException('App runtime file exceeds the configured limit');
    }
    const mimeType = String(file.mimetype || '')
      .trim()
      .toLowerCase();
    if (!this.getAllowedMimeTypes().has(mimeType)) {
      throw new BadRequestException('App runtime file MIME type is not allowed');
    }
  }

  private resolveOwnedPath(session: AuthorizedAppRuntimeSession, objectId: string) {
    const root = resolve(
      process.cwd(),
      String(this.config.get('appMarketplace.runtimeStorageDir') || '../upload/app-runtime-data'),
    );
    const candidate = resolve(root, String(session.tenantId), String(session.appId), objectId);
    const normalizedRoot = process.platform === 'win32' ? root.toLowerCase() : root;
    const normalizedCandidate = process.platform === 'win32' ? candidate.toLowerCase() : candidate;
    if (!normalizedCandidate.startsWith(`${normalizedRoot}${sep}`)) {
      throw new NotFoundException('App runtime file was not found');
    }
    return candidate;
  }

  private safeObjectId(value: string) {
    const normalized = String(value || '').trim();
    if (!OBJECT_ID_PATTERN.test(normalized)) {
      throw new BadRequestException('Invalid app runtime file id');
    }
    return normalized;
  }

  private safeName(value: string) {
    return basename(
      String(value || 'file')
        .replace(/[\r\n\0]/g, '')
        .trim() || 'file',
    ).slice(0, 255);
  }

  private safeMimeType(value: string) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(normalized)
      ? normalized
      : 'application/octet-stream';
  }

  private getAllowedMimeTypes() {
    const configured = this.config.get<string[]>('appMarketplace.runtimeStorageAllowedMimeTypes');
    return new Set(
      (configured || []).map((value) => String(value).trim().toLowerCase()).filter(Boolean),
    );
  }

  private getMaxFileBytes() {
    const value = Number(this.config.get('appMarketplace.runtimeStorageMaxFileMb') || 10);
    return Math.min(50, Math.max(1, value)) * 1024 * 1024;
  }

  private getQuotaBytes() {
    const value = Number(this.config.get('appMarketplace.runtimeStorageQuotaMb') || 100);
    return Math.min(10_240, Math.max(1, value)) * 1024 * 1024;
  }

  private toMetadata(row: AppStorageObjectEntity) {
    return {
      id: row.objectId,
      name: row.originalName,
      mime_type: row.mimeType,
      size: Number(row.sizeByte),
      checksum: row.checksum,
      expires_at: row.expiresTime?.toISOString() || null,
    };
  }
}
