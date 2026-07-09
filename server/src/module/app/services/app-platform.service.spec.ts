import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppReviewLogEntity } from '../entities/app-review-log.entity';
import { AppPlatformService } from './app-platform.service';

describe('AppPlatformService', () => {
  let service: AppPlatformService;

  const appRepo = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const versionRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const reviewLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    appRepo.create.mockImplementation((value) => ({ ...value }));
    appRepo.find.mockResolvedValue([]);
    appRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 1, ...value }));
    reviewLogRepo.create.mockImplementation((value) => ({ ...value }));
    reviewLogRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 1, ...value }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppPlatformService,
        { provide: getRepositoryToken(AppPackageEntity), useValue: appRepo },
        { provide: getRepositoryToken(AppPackageVersionEntity), useValue: versionRepo },
        { provide: getRepositoryToken(AppReviewLogEntity), useValue: reviewLogRepo },
      ],
    }).compile();

    service = module.get(AppPlatformService);
  });

  it('creates an iframe app as a published marketplace app', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createApp(
        {
          code: 'supplier_portal',
          name: 'Supplier Portal',
          type: 'iframe',
          entry_url: 'https://supplier.example.com',
          category: 'Industry',
        },
        88,
      ),
    ).resolves.toMatchObject({
      code: 'supplier_portal',
      name: 'Supplier Portal',
      type: 'iframe',
      status: 'published',
      visibility: 'marketplace',
      entry_mode: 'iframe',
      entry_url: 'https://supplier.example.com',
    });

    expect(appRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'supplier_portal',
        type: 'iframe',
        status: 'published',
        entryMode: 'iframe',
        entryUrl: 'https://supplier.example.com',
        developerId: 88,
      }),
    );
  });

  it('creates an internal app that opens an existing route', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createApp({
        code: 'tenant_members',
        name: 'Tenant Members',
        type: 'internal',
        entry_url: '/tenant-saas/members',
      }),
    ).resolves.toMatchObject({
      code: 'tenant_members',
      type: 'internal',
      status: 'published',
      entry_mode: 'internal_route',
      entry_url: '/tenant-saas/members',
    });
  });

  it('rejects duplicate app codes even when the existing row is soft-deleted', async () => {
    appRepo.findOne.mockResolvedValue({ id: 9, code: 'supplier_portal', deleteTime: new Date() });

    await expect(
      service.createApp({
        code: 'supplier_portal',
        name: 'Supplier Portal',
        type: 'iframe',
        entry_url: 'https://supplier.example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(appRepo.findOne).toHaveBeenCalledWith({ where: { code: 'supplier_portal' }, withDeleted: true });
    expect(appRepo.save).not.toHaveBeenCalled();
  });

  it('updates app status and records an audit log', async () => {
    appRepo.findOne.mockResolvedValue({
      id: 3,
      code: 'supplier_portal',
      name: 'Supplier Portal',
      type: 'iframe',
      status: 'published',
      entryMode: 'iframe',
      entryUrl: 'https://supplier.example.com',
    });

    await expect(service.updateStatus('supplier_portal', 'disabled', 77)).resolves.toMatchObject({
      code: 'supplier_portal',
      status: 'disabled',
    });

    expect(appRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 3, status: 'disabled' }));
    expect(reviewLogRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 3,
        versionId: null,
        action: 'disable',
        operatorId: 77,
      }),
    );
    expect(reviewLogRepo.save).toHaveBeenCalled();
  });

  it('rejects updates for unknown apps', async () => {
    appRepo.findOne.mockResolvedValue(null);

    await expect(service.updateStatus('missing_app', 'disabled')).rejects.toBeInstanceOf(NotFoundException);
  });
});
