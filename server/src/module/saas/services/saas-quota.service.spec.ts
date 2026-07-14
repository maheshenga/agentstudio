import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';

import { SAAS_QUOTA_AI_CALLS, SAAS_QUOTA_TOKENS } from '../constants';
import { SaasPlanQuotaEntity } from '../entities/saas-plan-quota.entity';
import { SaasQuotaLedgerEntity } from '../entities/saas-quota-ledger.entity';
import { SaasTenantResourceEntity } from '../entities/saas-tenant-resource.entity';
import { SaasQuotaService } from './saas-quota.service';

const MSG_MISSING_TENANT_CONTEXT = '\u7f3a\u5c11\u79df\u6237\u4e0a\u4e0b\u6587';
const MSG_AI_CALLS_QUOTA_INSUFFICIENT = 'AI \u8c03\u7528\u6b21\u6570\u989d\u5ea6\u4e0d\u8db3';
const MSG_TOKENS_QUOTA_INSUFFICIENT = 'Token \u989d\u5ea6\u4e0d\u8db3';

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
    getRepository: jest.fn(),
  };
  const userTenantRepo = {
    count: jest.fn(),
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
  const txQuotaReservationRepo = {
    create: jest.fn((value) => value),
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
  };

  const txManager = {
    getRepository: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    dataSource.getRepository.mockReturnValue(userTenantRepo);
    userTenantRepo.count.mockResolvedValue(0);

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
      if (entity?.name === 'SaasQuotaReservationEntity') {
        return txQuotaReservationRepo;
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
    tenantResourceRepo.findOne.mockResolvedValue(null);
    tenantResourceRepo.save.mockResolvedValue(undefined);

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
    expect(tenantResourceRepo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ tenantId: 42, resourceType: 'users', totalQuota: 3, usedQuota: 0, status: 1 }),
        expect.objectContaining({ tenantId: 42, resourceType: 'storage_mb', totalQuota: 1024, usedQuota: 0, status: 1 }),
        expect.objectContaining({ tenantId: 42, resourceType: 'ai_calls', totalQuota: 50, usedQuota: 0, status: 1 }),
        expect.objectContaining({ tenantId: 42, resourceType: 'rag_documents', totalQuota: 20, usedQuota: 0, status: 1 }),
        expect.objectContaining({ tenantId: 42, resourceType: 'tokens', totalQuota: 100000, usedQuota: 0, status: 1 }),
      ]),
    );
    expect(tenantResourceRepo.upsert).not.toHaveBeenCalled();
  });

  it('uses the transaction manager repositories when one is provided', async () => {
    txPlanQuotaRepo.find.mockResolvedValue([{ quotaType: 'users', totalQuota: 5, status: 1 }]);
    txTenantResourceRepo.findOne.mockResolvedValue(null);
    txTenantResourceRepo.save.mockResolvedValue(undefined);

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
    expect(txTenantResourceRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ tenantId: 88, resourceType: 'users', totalQuota: 5, usedQuota: 0, status: 1 }),
    ]);
    expect(planQuotaRepo.find).not.toHaveBeenCalled();
    expect(tenantResourceRepo.upsert).not.toHaveBeenCalled();
  });

  it('preserves existing used quota when plan initialization refreshes quota totals', async () => {
    planQuotaRepo.find.mockResolvedValue([{ quotaType: 'users', totalQuota: 10, status: 1 }]);
    tenantResourceRepo.findOne.mockResolvedValue({
      id: 3,
      tenantId: 42,
      resourceType: 'users',
      totalQuota: 5,
      usedQuota: 2,
      status: 1,
    });
    tenantResourceRepo.save.mockResolvedValue(undefined);

    await service.initializeTenantQuota(42, 7);

    expect(tenantResourceRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 42, resourceType: 'users' },
    });
    expect(tenantResourceRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 3,
        tenantId: 42,
        resourceType: 'users',
        totalQuota: 10,
        usedQuota: 2,
        status: 1,
      }),
    ]);
    expect(tenantResourceRepo.upsert).not.toHaveBeenCalled();
  });

  it('returns tenant usage summary with non-negative remaining quota', async () => {
    tenantResourceRepo.find.mockResolvedValue([
      { resourceType: 'users', totalQuota: 3, usedQuota: 1 },
      { resourceType: 'tokens', totalQuota: 100, usedQuota: 140 },
    ]);
    userTenantRepo.count.mockResolvedValue(2);

    await expect(service.getTenantUsageSummary(42)).resolves.toEqual([
      { resource_type: 'users', quota: 3, used: 2, remaining: 1 },
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
    expect(userTenantRepo.count).toHaveBeenCalledWith({
      where: { tenantId: 42, status: 1, deleteTime: IsNull() },
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

  it('returns readable Chinese messages for missing tenant context', async () => {
    await expect(service.assertTenantQuotaAvailable(0, 'tokens', 1)).rejects.toThrow('缺少租户上下文');
    await expect(service.consumeTenantQuota(0, 'tokens', 1)).rejects.toThrow('缺少租户上下文');
    await expect(service.grantTenantQuota(0, 'tokens', 1)).rejects.toThrow('缺少租户上下文');
  });

  it('returns canonical Unicode Chinese messages for missing tenant context', async () => {
    await expect(service.assertTenantQuotaAvailable(0, 'tokens', 1)).rejects.toThrow(MSG_MISSING_TENANT_CONTEXT);
    await expect(service.consumeTenantQuota(0, 'tokens', 1)).rejects.toThrow(MSG_MISSING_TENANT_CONTEXT);
    await expect(service.grantTenantQuota(0, 'tokens', 1)).rejects.toThrow(MSG_MISSING_TENANT_CONTEXT);
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

  it('lists platform quota ledger records with pagination and all supported filters', async () => {
    const createdAt = new Date('2026-07-04T12:00:00.000Z');
    quotaLedgerRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 9,
          tenantId: 88,
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
      service.listPlatformQuotaLedgers({
        page: '2',
        limit: '10',
        tenant_id: '88',
        resource_type: 'tokens',
        change_type: 'consume',
        source_type: 'ai_chat',
        source_id: 'chat-1',
      }),
    ).resolves.toEqual({
      list: [
        {
          id: 9,
          tenant_id: 88,
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
        tenantId: 88,
        resourceType: 'tokens',
        changeType: 'consume',
        sourceType: 'ai_chat',
        sourceId: 'chat-1',
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

  it('passes readable Chinese quota messages into AI quota consumption', async () => {
    const spy = jest
      .spyOn(service, 'consumeTenantQuota')
      .mockRejectedValueOnce(new Error('AI 调用次数额度不足'));

    try {
      await expect(service.consumeAiUsage(42, { totalTokens: 100 })).rejects.toThrow('AI 调用次数额度不足');
      expect(spy).toHaveBeenCalledWith(
        42,
        'ai_calls',
        1,
        expect.objectContaining({ message: 'AI 调用次数额度不足' }),
        expect.anything(),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('atomically reserves one AI call and the estimated maximum tokens', async () => {
    const consumeSpy = jest.spyOn(service, 'consumeTenantQuota').mockResolvedValue(undefined);

    const reservation = await (service as any).reserveAiUsage(42, {
      estimatedTokens: 1200,
      sourceId: 'message-1',
    });

    expect(consumeSpy).toHaveBeenCalledWith(
      42,
      SAAS_QUOTA_AI_CALLS,
      1,
      expect.objectContaining({ changeType: 'reserve', sourceId: reservation.id }),
      txManager,
    );
    expect(consumeSpy).toHaveBeenCalledWith(
      42,
      SAAS_QUOTA_TOKENS,
      1200,
      expect.objectContaining({ changeType: 'reserve', sourceId: reservation.id }),
      txManager,
    );
    expect(txQuotaReservationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: reservation.id,
        tenantId: 42,
        status: 'pending',
        reservedCalls: 1,
        reservedTokens: 1200,
        sourceId: 'message-1',
      }),
    );
  });

  it('finalizes a reservation and releases unused token capacity', async () => {
    txQuotaReservationRepo.findOne.mockResolvedValue({
      id: 'reservation-1',
      tenantId: 42,
      status: 'pending',
      reservedCalls: 1,
      reservedTokens: 1200,
      actualTokens: 0,
    });
    const releaseSpy = jest.spyOn(service as any, 'releaseTenantQuotaUsage').mockResolvedValue(undefined);

    await (service as any).finalizeAiUsage('reservation-1', 300);

    expect(releaseSpy).toHaveBeenCalledWith(
      42,
      SAAS_QUOTA_TOKENS,
      900,
      expect.objectContaining({ changeType: 'release', sourceId: 'reservation-1' }),
      txManager,
    );
    expect(txQuotaReservationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'finalized', actualTokens: 300 }),
    );
  });

  it('releases both call and token capacity for a failed reservation', async () => {
    txQuotaReservationRepo.findOne.mockResolvedValue({
      id: 'reservation-2',
      tenantId: 42,
      status: 'pending',
      reservedCalls: 1,
      reservedTokens: 500,
      actualTokens: 0,
    });
    const releaseSpy = jest.spyOn(service as any, 'releaseTenantQuotaUsage').mockResolvedValue(undefined);

    await (service as any).releaseAiUsage('reservation-2');

    expect(releaseSpy).toHaveBeenCalledTimes(2);
    expect(releaseSpy).toHaveBeenCalledWith(
      42,
      SAAS_QUOTA_AI_CALLS,
      1,
      expect.objectContaining({ sourceId: 'reservation-2' }),
      txManager,
    );
    expect(releaseSpy).toHaveBeenCalledWith(
      42,
      SAAS_QUOTA_TOKENS,
      500,
      expect.objectContaining({ sourceId: 'reservation-2' }),
      txManager,
    );
    expect(txQuotaReservationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'released' }),
    );
  });

  it('passes canonical Unicode quota messages into AI quota consumption', async () => {
    const spy = jest.spyOn(service, 'consumeTenantQuota').mockResolvedValue(undefined);

    try {
      await service.consumeAiUsage(42, { totalTokens: 100 });
      expect(spy).toHaveBeenNthCalledWith(
        1,
        42,
        'ai_calls',
        1,
        expect.objectContaining({ message: MSG_AI_CALLS_QUOTA_INSUFFICIENT }),
        expect.anything(),
      );
      expect(spy).toHaveBeenNthCalledWith(
        2,
        42,
        'tokens',
        100,
        expect.objectContaining({ message: MSG_TOKENS_QUOTA_INSUFFICIENT }),
        expect.anything(),
      );
    } finally {
      spy.mockRestore();
    }
  });
});
