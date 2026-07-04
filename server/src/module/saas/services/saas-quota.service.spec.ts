import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SaasPlanQuotaEntity } from '../entities/saas-plan-quota.entity';
import { SaasQuotaLedgerEntity } from '../entities/saas-quota-ledger.entity';
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
    findOne: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
  };

  const quotaLedgerRepo = {
    create: jest.fn((value) => value),
    findAndCount: jest.fn(),
    save: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(async (handler) => handler(txManager)),
  };

  const txPlanQuotaRepo = {
    find: jest.fn(),
  };

  const txTenantResourceRepo = {
    upsert: jest.fn(),
    findOne: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
  };

  const txQuotaLedgerRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(),
  };

  const txManager = {
    getRepository: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    txManager.getRepository.mockImplementation((entity) => {
      if (entity === SaasPlanQuotaEntity) {
        return txPlanQuotaRepo;
      }
      if (entity === SaasTenantResourceEntity) {
        return txTenantResourceRepo;
      }
      if (entity === SaasQuotaLedgerEntity) {
        return txQuotaLedgerRepo;
      }
      return undefined;
    });

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
        {
          provide: getRepositoryToken(SaasQuotaLedgerEntity),
          useValue: quotaLedgerRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
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

  it('uses the transaction manager repositories when one is provided', async () => {
    txPlanQuotaRepo.find.mockResolvedValue([{ quotaType: 'users', totalQuota: 5, status: 1 }]);
    txTenantResourceRepo.upsert.mockResolvedValue(undefined);

    await service.initializeTenantQuota(88, 12, txManager as any);

    expect(txManager.getRepository).toHaveBeenCalledWith(SaasPlanQuotaEntity);
    expect(txManager.getRepository).toHaveBeenCalledWith(SaasTenantResourceEntity);
    expect(txPlanQuotaRepo.find).toHaveBeenCalledWith({
      where: {
        planId: 12,
        status: 1,
      },
      order: {
        id: 'ASC',
      },
    });
    expect(txTenantResourceRepo.upsert).toHaveBeenCalledWith(
      [{ tenantId: 88, resourceType: 'users', totalQuota: 5, usedQuota: 0, status: 1 }],
      ['tenantId', 'resourceType'],
    );
    expect(planQuotaRepo.find).not.toHaveBeenCalled();
    expect(tenantResourceRepo.upsert).not.toHaveBeenCalled();
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

  it('allows quota checks when remaining quota is enough', async () => {
    tenantResourceRepo.findOne.mockResolvedValue({
      tenantId: 42,
      resourceType: 'tokens',
      totalQuota: 100,
      usedQuota: 20,
      status: 1,
    });

    await expect(service.assertTenantQuotaAvailable(42, 'tokens', 30)).resolves.toBeUndefined();

    expect(tenantResourceRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 42, resourceType: 'tokens', status: 1 },
    });
  });

  it('rejects quota checks when remaining quota is exhausted', async () => {
    tenantResourceRepo.findOne.mockResolvedValue({
      tenantId: 42,
      resourceType: 'ai_calls',
      totalQuota: 3,
      usedQuota: 3,
      status: 1,
    });

    await expect(
      service.assertTenantQuotaAvailable(42, 'ai_calls', 1, 'AI 调用次数额度不足'),
    ).rejects.toThrow('AI 调用次数额度不足');
  });

  it('treats non-positive total quota as unlimited', async () => {
    tenantResourceRepo.findOne.mockResolvedValue({
      tenantId: 42,
      resourceType: 'tokens',
      totalQuota: 0,
      usedQuota: 999999,
      status: 1,
    });

    await expect(service.assertTenantQuotaAvailable(42, 'tokens', 500)).resolves.toBeUndefined();
  });

  it('increments tenant quota usage when amount is positive', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 1 });
    tenantResourceRepo.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      execute,
    });
    tenantResourceRepo.findOne.mockResolvedValue({
      tenantId: 42,
      resourceType: 'tokens',
      totalQuota: 1000,
      usedQuota: 323,
      status: 1,
    });
    quotaLedgerRepo.save.mockResolvedValue(undefined);

    await service.consumeTenantQuota(42, 'tokens', 123);

    expect(execute).toHaveBeenCalled();
    expect(quotaLedgerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 42,
        resourceType: 'tokens',
        changeType: 'consume',
        quotaDelta: 0,
        usedDelta: 123,
        balanceTotalQuota: 1000,
        balanceUsedQuota: 323,
      }),
    );
  });

  it('lists tenant quota ledger records with pagination and filters', async () => {
    const createdAt = new Date('2026-07-04T12:00:00.000Z');
    quotaLedgerRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 9,
          tenantId: 42,
          resourceType: 'tokens',
          changeType: 'consume',
          quotaDelta: 0,
          usedDelta: 321,
          balanceTotalQuota: 1000,
          balanceUsedQuota: 521,
          sourceType: 'ai_chat',
          sourceId: 'chat-1',
          remark: 'AI chat completed',
          createTime: createdAt,
        },
      ],
      1,
    ]);

    await expect(
      service.listTenantQuotaLedgers(42, {
        page: '2',
        limit: '10',
        resource_type: 'tokens',
        change_type: 'consume',
      }),
    ).resolves.toEqual({
      list: [
        {
          id: 9,
          tenant_id: 42,
          resource_type: 'tokens',
          change_type: 'consume',
          quota_delta: 0,
          used_delta: 321,
          balance_total_quota: 1000,
          balance_used_quota: 521,
          source_type: 'ai_chat',
          source_id: 'chat-1',
          remark: 'AI chat completed',
          create_time: createdAt,
        },
      ],
      total: 1,
      page: 2,
      limit: 10,
    });

    expect(quotaLedgerRepo.findAndCount).toHaveBeenCalledWith({
      where: {
        tenantId: 42,
        resourceType: 'tokens',
        changeType: 'consume',
      },
      order: { createTime: 'DESC', id: 'DESC' },
      skip: 10,
      take: 10,
    });
  });

  it('rejects atomic quota consumption when remaining quota is insufficient', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 0 });
    tenantResourceRepo.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      execute,
    });
    tenantResourceRepo.findOne.mockResolvedValue({
      tenantId: 42,
      resourceType: 'tokens',
      totalQuota: 100,
      usedQuota: 99,
      status: 1,
    });

    await expect(service.consumeTenantQuota(42, 'tokens', 2, { message: 'Token 额度不足' })).rejects.toThrow('Token 额度不足');

    expect(quotaLedgerRepo.save).not.toHaveBeenCalled();
  });

  it('grants tenant quota and records a quota ledger entry', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 1 });
    tenantResourceRepo.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      execute,
    });
    tenantResourceRepo.findOne.mockResolvedValue({
      tenantId: 42,
      resourceType: 'tokens',
      totalQuota: 1500,
      usedQuota: 300,
      status: 1,
    });
    quotaLedgerRepo.save.mockResolvedValue(undefined);

    await service.grantTenantQuota(42, 'tokens', 500, {
      sourceType: 'resource_pack_order',
      sourceId: 'RPO1',
      remark: 'Resource pack paid',
    });

    expect(execute).toHaveBeenCalled();
    expect(quotaLedgerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 42,
        resourceType: 'tokens',
        changeType: 'grant',
        quotaDelta: 500,
        usedDelta: 0,
        balanceTotalQuota: 1500,
        balanceUsedQuota: 300,
        sourceType: 'resource_pack_order',
        sourceId: 'RPO1',
      }),
    );
  });

  it('checks and consumes AI call and token usage', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 1 });
    txTenantResourceRepo.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      execute,
    });
    txTenantResourceRepo.findOne
      .mockResolvedValueOnce({
        tenantId: 42,
        resourceType: 'ai_calls',
        totalQuota: 10,
        usedQuota: 3,
        status: 1,
      })
      .mockResolvedValueOnce({
        tenantId: 42,
        resourceType: 'tokens',
        totalQuota: 1000,
        usedQuota: 521,
        status: 1,
      });
    txQuotaLedgerRepo.save.mockResolvedValue(undefined);

    await service.consumeAiUsage(42, { totalTokens: 321 });

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(2);
    expect(txQuotaLedgerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 42,
        resourceType: 'ai_calls',
        changeType: 'consume',
        usedDelta: 1,
        balanceUsedQuota: 3,
      }),
    );
    expect(txQuotaLedgerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 42,
        resourceType: 'tokens',
        changeType: 'consume',
        usedDelta: 321,
        balanceUsedQuota: 521,
      }),
    );
  });
});
