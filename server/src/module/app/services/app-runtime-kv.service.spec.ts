import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan } from 'typeorm';

import { AppRuntimeKvEntity } from '../entities/app-runtime-kv.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';
import { AppRuntimeKvService } from './app-runtime-kv.service';

describe('AppRuntimeKvService', () => {
  const kvRepo = {
    findOne: jest.fn(),
    create: jest.fn((value) => ({ ...value })),
    save: jest.fn(async (value) => ({ id: value.id ?? 1, ...value })),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const installRepo = { findOne: jest.fn() };
  const manager = {
    getRepository: jest.fn((entity) => (entity === AppRuntimeKvEntity ? kvRepo : installRepo)),
  };
  const dataSource = { transaction: jest.fn(async (callback) => callback(manager)) };
  const quotaQuery = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };
  const session = {
    id: 41,
    tenantId: 23,
    userId: 91,
    appId: 10,
    versionId: 20,
    installId: 30,
    capabilities: ['kv.read', 'kv.write', 'kv.delete'],
  } as any;

  let service: AppRuntimeKvService;

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.APP_RUNTIME_KV_MAX_KEYS;
    delete process.env.APP_RUNTIME_KV_MAX_BYTES;
    kvRepo.createQueryBuilder.mockReturnValue(quotaQuery);
    quotaQuery.getRawOne.mockResolvedValue({ key_count: '0', size_byte: '0' });
    installRepo.findOne.mockResolvedValue({ id: 30 });

    const module = await Test.createTestingModule({
      providers: [
        AppRuntimeKvService,
        { provide: getRepositoryToken(AppRuntimeKvEntity), useValue: kvRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(AppRuntimeKvService);
  });

  afterEach(() => {
    delete process.env.APP_RUNTIME_KV_MAX_KEYS;
    delete process.env.APP_RUNTIME_KV_MAX_BYTES;
  });

  it('reads only an unexpired row bound to the authorized tenant and app', async () => {
    kvRepo.findOne.mockResolvedValue({
      tenantId: 23,
      appId: 10,
      namespace: 'settings',
      key: 'theme',
      value: { mode: 'dark' },
      version: 2,
      expiresTime: null,
    });

    await expect(service.get(session, 'settings', 'theme')).resolves.toEqual({
      namespace: 'settings',
      key: 'theme',
      value: { mode: 'dark' },
      version: 2,
      expires_at: null,
    });
    expect(kvRepo.findOne).toHaveBeenCalledWith({
      where: [
        { tenantId: 23, appId: 10, namespace: 'settings', key: 'theme', expiresTime: IsNull() },
        {
          tenantId: 23,
          appId: 10,
          namespace: 'settings',
          key: 'theme',
          expiresTime: MoreThan(expect.any(Date)),
        },
      ],
    });
  });

  it('treats missing or expired data as not found', async () => {
    kvRepo.findOne.mockResolvedValue(null);
    await expect(service.get(session, 'settings', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('serializes writes by installation and locks the scoped target row', async () => {
    kvRepo.findOne.mockResolvedValue(null);

    await expect(
      service.set(session, 'settings', 'theme', {
        value: { mode: 'dark' },
        expected_version: 0,
        ttl_seconds: 600,
      }),
    ).resolves.toMatchObject({ namespace: 'settings', key: 'theme', version: 1 });

    expect(installRepo.findOne).toHaveBeenCalledWith({
      where: { id: 30, tenantId: 23, appId: 10, versionId: 20, enabled: 1 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(kvRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 23, appId: 10, namespace: 'settings', key: 'theme' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(kvRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 23,
        appId: 10,
        namespace: 'settings',
        key: 'theme',
        value: { mode: 'dark' },
        sizeByte: Buffer.byteLength(JSON.stringify({ mode: 'dark' }), 'utf8'),
        version: 1,
        expiresTime: expect.any(Date),
      }),
    );
  });

  it('requires the expected version to match the active row', async () => {
    kvRepo.findOne.mockResolvedValue({
      id: 7,
      tenantId: 23,
      appId: 10,
      namespace: 'settings',
      key: 'theme',
      value: {},
      sizeByte: 2,
      version: 4,
      expiresTime: null,
    });

    await expect(
      service.set(session, 'settings', 'theme', { value: {}, expected_version: 3 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(kvRepo.save).not.toHaveBeenCalled();
  });

  it('rejects invalid names, non-JSON values, and values over 64 KB', async () => {
    await expect(service.set(session, '../unsafe', 'key', { value: true })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.set(session, 'settings', 'key', { value: undefined as any }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.set(session, 'settings', 'key', { value: 'x'.repeat(65_537) }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('enforces per-tenant-app key and byte quotas inside the transaction', async () => {
    kvRepo.findOne.mockResolvedValue(null);
    quotaQuery.getRawOne.mockResolvedValue({ key_count: '1000', size_byte: '1024' });

    await expect(
      service.set(session, 'settings', 'new-key', { value: true }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(quotaQuery.where).toHaveBeenCalledWith('kv.tenantId = :tenantId', { tenantId: 23 });
    expect(quotaQuery.andWhere).toHaveBeenCalledWith('kv.appId = :appId', { appId: 10 });

    jest.clearAllMocks();
    kvRepo.createQueryBuilder.mockReturnValue(quotaQuery);
    installRepo.findOne.mockResolvedValue({ id: 30 });
    kvRepo.findOne.mockResolvedValue(null);
    quotaQuery.getRawOne.mockResolvedValue({ key_count: '1', size_byte: String(5 * 1024 * 1024) });
    await expect(
      service.set(session, 'settings', 'new-key', { value: true }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('deletes only the authorized tenant and app key and remains idempotent', async () => {
    kvRepo.delete.mockResolvedValue({ affected: 0 });

    await expect(service.delete(session, 'settings', 'theme')).resolves.toEqual({ deleted: false });
    expect(kvRepo.delete).toHaveBeenCalledWith({
      tenantId: 23,
      appId: 10,
      namespace: 'settings',
      key: 'theme',
    });
  });
});
