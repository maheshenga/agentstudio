import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasResourcePackEntity } from '../entities/saas-resource-pack.entity';
import { SaasResourcePackService } from './saas-resource-pack.service';

describe('SaasResourcePackService', () => {
  let service: SaasResourcePackService;

  const resourcePackRepo = {
    findAndCount: jest.fn(),
    find: jest.fn(),
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
});
