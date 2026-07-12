import { BadRequestException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource, IsNull, MoreThan } from 'typeorm';

import { AppStorageObjectEntity } from '../entities/app-storage-object.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';
import { AppRuntimeFileService } from './app-runtime-file.service';

describe('AppRuntimeFileService', () => {
  const objectRepo = {
    create: jest.fn((value) => ({ ...value })),
    save: jest.fn(async (value) => ({ id: 1, ...value })),
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const installRepo = { findOne: jest.fn() };
  const manager = {
    getRepository: jest.fn((entity) =>
      entity === AppStorageObjectEntity ? objectRepo : installRepo,
    ),
  };
  const dataSource = { transaction: jest.fn(async (callback) => callback(manager)) };
  const usageQuery = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };
  const session = {
    id: 41,
    tenantId: 23,
    userId: 91,
    appId: 10,
    versionId: 20,
    installId: 30,
    capabilities: ['files.read', 'files.write'],
  } as any;

  let root: string;
  let service: AppRuntimeFileService;

  beforeEach(async () => {
    jest.clearAllMocks();
    root = mkdtempSync(join(tmpdir(), 'agentstudio-runtime-files-'));
    objectRepo.createQueryBuilder.mockReturnValue(usageQuery);
    usageQuery.getRawOne.mockResolvedValue({ size_byte: '0' });
    installRepo.findOne.mockResolvedValue({ id: 30 });
    const config = {
      get: jest.fn((key: string) => {
        const values = {
          'appMarketplace.runtimeStorageDir': root,
          'appMarketplace.runtimeStorageMaxFileMb': 10,
          'appMarketplace.runtimeStorageQuotaMb': 100,
          'appMarketplace.runtimeStorageAllowedMimeTypes': ['text/plain', 'application/json'],
        };
        return values[key];
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        AppRuntimeFileService,
        { provide: getRepositoryToken(AppStorageObjectEntity), useValue: objectRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(AppRuntimeFileService);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('atomically stores inert bytes and returns only opaque metadata', async () => {
    const file = {
      originalname: 'notes.txt',
      mimetype: 'text/plain',
      size: 5,
      buffer: Buffer.from('hello'),
    } as Express.Multer.File;

    const result = await service.upload(session, file);

    expect(result.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result).toEqual({
      id: result.id,
      name: 'notes.txt',
      mime_type: 'text/plain',
      size: 5,
      checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
      expires_at: null,
    });
    expect(JSON.stringify(result)).not.toMatch(/storage|path|token/i);
    expect(installRepo.findOne).toHaveBeenCalledWith({
      where: { id: 30, tenantId: 23, appId: 10, versionId: 20, enabled: 1 },
      lock: { mode: 'pessimistic_write' },
    });
    const saved = objectRepo.save.mock.calls[0][0];
    expect(saved.storageKey).toBe(`23/10/${result.id}`);
    expect(readFileSync(join(root, '23', '10', result.id), 'utf8')).toBe('hello');
    expect(existsSync(join(root, '23', '10', `${result.id}.tmp`))).toBe(false);
  });

  it('allows duplicate display names while generating independent object ids', async () => {
    const file = {
      originalname: 'same.txt',
      mimetype: 'text/plain',
      size: 1,
      buffer: Buffer.from('a'),
    } as Express.Multer.File;
    const first = await service.upload(session, file);
    const second = await service.upload(session, file);
    expect(first.name).toBe(second.name);
    expect(first.id).not.toBe(second.id);
  });

  it('rejects empty, oversized, and disallowed MIME files before writing', async () => {
    await expect(
      service.upload(session, {
        originalname: 'empty.txt',
        mimetype: 'text/plain',
        size: 0,
        buffer: Buffer.alloc(0),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.upload(session, {
        originalname: 'script.js',
        mimetype: 'application/javascript',
        size: 1,
        buffer: Buffer.from('x'),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.upload(session, {
        originalname: 'large.txt',
        mimetype: 'text/plain',
        size: 11 * 1024 * 1024,
        buffer: Buffer.alloc(1),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('removes staged bytes when the tenant-app quota is exceeded', async () => {
    usageQuery.getRawOne.mockResolvedValue({ size_byte: String(100 * 1024 * 1024) });
    await expect(
      service.upload(session, {
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        size: 5,
        buffer: Buffer.from('hello'),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(usageQuery.where).toHaveBeenCalledWith('object.tenantId = :tenantId', {
      tenantId: 23,
    });
    expect(usageQuery.andWhere).toHaveBeenCalledWith('object.appId = :appId', { appId: 10 });
    expect(existsSync(join(root, '23', '10')) && readFileNames(join(root, '23', '10')).length).toBe(
      0,
    );
  });

  it('opens only active unexpired objects bound to the authorized tenant and app', async () => {
    const objectId = 'a'.repeat(43);
    const objectPath = join(root, '23', '10', objectId);
    mkdirSync(join(root, '23', '10'), { recursive: true });
    writeFileSync(objectPath, 'hello', { flag: 'wx' });
    objectRepo.findOne.mockResolvedValue({
      objectId,
      tenantId: 23,
      appId: 10,
      originalName: 'notes.txt',
      mimeType: 'text/plain',
      sizeByte: 5,
      checksum: 'b'.repeat(64),
      status: 'active',
      expiresTime: null,
    });

    const result = await service.open(session, objectId);

    expect(result).toMatchObject({ name: 'notes.txt', mimeType: 'text/plain', size: 5 });
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString('utf8')).toBe('hello');
    expect(objectRepo.findOne).toHaveBeenCalledWith({
      where: [
        { objectId, tenantId: 23, appId: 10, status: 'active', expiresTime: IsNull() },
        {
          objectId,
          tenantId: 23,
          appId: 10,
          status: 'active',
          expiresTime: MoreThan(expect.any(Date)),
        },
      ],
    });
  });

  it('does not trust a database storage key or expose missing bytes', async () => {
    const objectId = 'a'.repeat(43);
    objectRepo.findOne.mockResolvedValue({
      objectId,
      tenantId: 23,
      appId: 10,
      storageKey: '../../outside',
      originalName: 'notes.txt',
      mimeType: 'text/plain',
      sizeByte: 5,
      status: 'active',
      expiresTime: null,
    });
    await expect(service.open(session, objectId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes only the authorized object and removes owned bytes best effort', async () => {
    const objectId = 'a'.repeat(43);
    const objectPath = join(root, '23', '10', objectId);
    mkdirSync(join(root, '23', '10'), { recursive: true });
    writeFileSync(objectPath, 'hello', { flag: 'wx' });
    objectRepo.update.mockResolvedValue({ affected: 1 });

    await expect(service.delete(session, objectId)).resolves.toEqual({ deleted: true });
    expect(objectRepo.update).toHaveBeenCalledWith(
      { objectId, tenantId: 23, appId: 10, status: 'active' },
      { status: 'deleted' },
    );
    expect(existsSync(objectPath)).toBe(false);
  });

  it('keeps metadata deletion successful when byte cleanup fails', async () => {
    const objectId = 'c'.repeat(43);
    mkdirSync(join(root, '23', '10', objectId), { recursive: true });
    objectRepo.update.mockResolvedValue({ affected: 1 });

    await expect(service.delete(session, objectId)).resolves.toEqual({ deleted: true });
  });
});

function readFileNames(path: string) {
  return readdirSync(path);
}
