import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasPlanQuotaEntity } from '../entities/saas-plan-quota.entity';
import { SaasTenantResourceEntity } from '../entities/saas-tenant-resource.entity';
import { SaasQuotaService } from './saas-quota.service';

describe('SaasQuotaService', () => {
  let service: SaasQuotaService;

  const planQuotaRepo = {
    find: jest.fn(),
  };

  const tenantResourceRepo = {
    upsert: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasQuotaService,
        {
          provide: getRepositoryToken(SaasPlanQuotaEntity),
          useValue: planQuotaRepo,
        },
        {
          provide: getRepositoryToken(SaasTenantResourceEntity),
          useValue: tenantResourceRepo,
        },
      ],
    }).compile();

    service = module.get(SaasQuotaService);
  });

  it('initializes tenant quota rows for every supported plan quota', async () => {
    planQuotaRepo.find.mockResolvedValue([
      { quotaType: 'users', totalQuota: 3, status: 1 },
      { quotaType: 'storage_mb', totalQuota: 1024, status: 1 },
      { quotaType: 'ai_calls', totalQuota: 50, status: 1 },
      { quotaType: 'rag_documents', totalQuota: 20, status: 1 },
      { quotaType: 'tokens', totalQuota: 100000, status: 1 },
    ]);
    tenantResourceRepo.upsert.mockResolvedValue(undefined);

    await service.initializeTenantQuota(42, 7);

    expect(planQuotaRepo.find).toHaveBeenCalledWith({
      where: {
        planId: 7,
        status: 1,
      },
      order: {
        id: 'ASC',
      },
    });
    expect(tenantResourceRepo.upsert).toHaveBeenCalledWith(
      [
        { tenantId: 42, resourceType: 'users', totalQuota: 3, usedQuota: 0, status: 1 },
        { tenantId: 42, resourceType: 'storage_mb', totalQuota: 1024, usedQuota: 0, status: 1 },
        { tenantId: 42, resourceType: 'ai_calls', totalQuota: 50, usedQuota: 0, status: 1 },
        { tenantId: 42, resourceType: 'rag_documents', totalQuota: 20, usedQuota: 0, status: 1 },
        { tenantId: 42, resourceType: 'tokens', totalQuota: 100000, usedQuota: 0, status: 1 },
      ],
      ['tenantId', 'resourceType'],
    );
  });

  it('returns tenant usage summary with non-negative remaining quota', async () => {
    tenantResourceRepo.find.mockResolvedValue([
      { resourceType: 'users', totalQuota: 3, usedQuota: 1 },
      { resourceType: 'tokens', totalQuota: 100, usedQuota: 140 },
    ]);

    await expect(service.getTenantUsageSummary(42)).resolves.toEqual([
      { resource_type: 'users', quota: 3, used: 1, remaining: 2 },
      { resource_type: 'tokens', quota: 100, used: 140, remaining: 0 },
    ]);

    expect(tenantResourceRepo.find).toHaveBeenCalledWith({
      where: {
        tenantId: 42,
        status: 1,
      },
      order: {
        id: 'ASC',
      },
    });
  });
});
