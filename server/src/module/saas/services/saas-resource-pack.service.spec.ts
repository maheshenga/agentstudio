import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasResourcePackEntity } from '../entities/saas-resource-pack.entity';
import { SaasResourcePackService } from './saas-resource-pack.service';

describe('SaasResourcePackService', () => {
  let service: SaasResourcePackService;

  const resourcePackRepo = {
    findAndCount: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((input) => input),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasResourcePackService,
        {
          provide: getRepositoryToken(SaasResourcePackEntity),
          useValue: resourcePackRepo,
        },
      ],
    }).compile();

    service = module.get(SaasResourcePackService);
  });

  it('lists platform resource packs with pagination and filters', async () => {
    resourcePackRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 1,
          code: 'tokens_1m',
          name: 'Token Pack 1M',
          resourceType: 'tokens',
          quotaAmount: 1000000,
          priceCents: 19900,
          currency: 'CNY',
          status: 1,
          sort: 20,
          remark: 'Adds 1M tokens',
        },
      ],
      1,
    ]);

    await expect(
      service.listPlatformResourcePacks({
        page: '2',
        limit: '10',
        status: '1',
        resource_type: 'tokens',
      }),
    ).resolves.toEqual({
      list: [
        {
          id: 1,
          code: 'tokens_1m',
          name: 'Token Pack 1M',
          resource_type: 'tokens',
          quota_amount: 1000000,
          price_cents: 19900,
          currency: 'CNY',
          status: 1,
          sort: 20,
          remark: 'Adds 1M tokens',
        },
      ],
      total: 1,
      page: 2,
      limit: 10,
    });

    expect(resourcePackRepo.findAndCount).toHaveBeenCalledWith({
      where: { status: 1, resourceType: 'tokens' },
      order: { resourceType: 'ASC', sort: 'ASC', id: 'ASC' },
      skip: 10,
      take: 10,
    });
  });

  it('lists only active resource packs for tenants', async () => {
    resourcePackRepo.find.mockResolvedValue([
      {
        id: 2,
        code: 'ai_calls_1k',
        name: 'AI Calls 1K',
        resourceType: 'ai_calls',
        quotaAmount: 1000,
        priceCents: 9900,
        currency: 'CNY',
        status: 1,
        sort: 10,
        remark: 'Adds 1K AI calls',
      },
    ]);

    await expect(service.listTenantResourcePacks()).resolves.toEqual([
      {
        id: 2,
        code: 'ai_calls_1k',
        name: 'AI Calls 1K',
        resource_type: 'ai_calls',
        quota_amount: 1000,
        price_cents: 9900,
        currency: 'CNY',
        status: 1,
        sort: 10,
        remark: 'Adds 1K AI calls',
      },
    ]);

    expect(resourcePackRepo.find).toHaveBeenCalledWith({
      where: { status: 1 },
      order: { resourceType: 'ASC', sort: 'ASC', id: 'ASC' },
    });
  });

  it('creates a platform resource pack with normalized fields', async () => {
    resourcePackRepo.findOne.mockResolvedValue(null);
    resourcePackRepo.save.mockImplementation(async (input) => ({ id: 3, ...input }));

    await expect(
      service.createPlatformResourcePack({
        code: 'tokens_2m',
        name: 'Tokens 2M',
        resource_type: 'tokens',
        quota_amount: 2000000,
        price_cents: 29900,
        currency: 'CNY',
        status: 1,
        sort: 30,
        remark: 'Adds 2M tokens',
      }),
    ).resolves.toEqual({
      id: 3,
      code: 'tokens_2m',
      name: 'Tokens 2M',
      resource_type: 'tokens',
      quota_amount: 2000000,
      price_cents: 29900,
      currency: 'CNY',
      status: 1,
      sort: 30,
      remark: 'Adds 2M tokens',
    });

    expect(resourcePackRepo.findOne).toHaveBeenCalledWith({ where: { code: 'tokens_2m' }, withDeleted: true });
    expect(resourcePackRepo.create).toHaveBeenCalledWith({
      code: 'tokens_2m',
      name: 'Tokens 2M',
      resourceType: 'tokens',
      quotaAmount: 2000000,
      priceCents: 29900,
      currency: 'CNY',
      status: 1,
      sort: 30,
      remark: 'Adds 2M tokens',
    });
    expect(resourcePackRepo.save).toHaveBeenCalled();
  });

  it('rejects duplicate platform resource pack codes including soft-deleted rows', async () => {
    resourcePackRepo.findOne.mockResolvedValue({ id: 1, code: 'tokens_1m', deleteTime: new Date() });

    await expect(
      service.createPlatformResourcePack({
        code: 'tokens_1m',
        name: 'Tokens 1M',
        resource_type: 'tokens',
        quota_amount: 1000000,
        price_cents: 19900,
      }),
    ).rejects.toThrow('Resource pack tokens_1m already exists');
  });

  it('updates a platform resource pack by code', async () => {
    const existing = {
      id: 1,
      code: 'tokens_1m',
      name: 'Tokens 1M',
      resourceType: 'tokens',
      quotaAmount: 1000000,
      priceCents: 19900,
      currency: 'CNY',
      status: 1,
      sort: 20,
      remark: 'Adds 1M tokens',
    };
    resourcePackRepo.findOne.mockResolvedValue(existing);
    resourcePackRepo.save.mockImplementation(async (input) => input);

    await expect(
      service.updatePlatformResourcePack('tokens_1m', {
        name: 'Tokens 2M',
        quota_amount: 2000000,
        price_cents: 29900,
      }),
    ).resolves.toMatchObject({
      code: 'tokens_1m',
      name: 'Tokens 2M',
      resource_type: 'tokens',
      quota_amount: 2000000,
      price_cents: 29900,
    });

    expect(resourcePackRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'tokens_1m',
        name: 'Tokens 2M',
        quotaAmount: 2000000,
        priceCents: 29900,
      }),
    );
  });

  it('updates a platform resource pack status by code', async () => {
    const existing = {
      id: 1,
      code: 'tokens_1m',
      name: 'Tokens 1M',
      resourceType: 'tokens',
      quotaAmount: 1000000,
      priceCents: 19900,
      currency: 'CNY',
      status: 1,
      sort: 20,
      remark: 'Adds 1M tokens',
    };
    resourcePackRepo.findOne.mockResolvedValue(existing);
    resourcePackRepo.save.mockImplementation(async (input) => input);

    await expect(service.updatePlatformResourcePackStatus('tokens_1m', 0)).resolves.toMatchObject({
      code: 'tokens_1m',
      status: 0,
    });

    expect(resourcePackRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 0 }));
  });
});
