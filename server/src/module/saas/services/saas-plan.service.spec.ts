import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SaasPlanFeatureEntity } from '../entities/saas-plan-feature.entity';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasPlanQuotaEntity } from '../entities/saas-plan-quota.entity';
import { SaasPlanService } from './saas-plan.service';

describe('SaasPlanService', () => {
  let service: SaasPlanService;
  const planRepo = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
  };
  const quotaRepo = {
    delete: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };
  const planFeatureRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    planRepo.create.mockImplementation((value) => value);
    planRepo.save.mockImplementation(async (value) => ({ id: 8, ...value }));
    quotaRepo.save.mockImplementation(async (value) => value);
    planFeatureRepo.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasPlanService,
        { provide: getRepositoryToken(SaasPlanEntity), useValue: planRepo },
        { provide: getRepositoryToken(SaasPlanQuotaEntity), useValue: quotaRepo },
        { provide: getRepositoryToken(SaasPlanFeatureEntity), useValue: planFeatureRepo },
      ],
    }).compile();

    service = module.get(SaasPlanService);
  });

  it('lists platform plans with filters and pagination', async () => {
    planRepo.findAndCount.mockResolvedValue([[{ id: 1, code: 'pro', name: 'Pro', status: 1 }], 1]);
    quotaRepo.find.mockResolvedValue([{ planId: 1, quotaType: 'tokens', totalQuota: 1000, status: 1 }]);

    await expect(service.listPlatformPlans({ page: '2', limit: '10', status: '1', keyword: 'pro' })).resolves.toMatchObject({ total: 1, page: 2, limit: 10 });

    expect(planRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: [
        expect.objectContaining({ code: expect.any(Object), status: 1 }),
        expect.objectContaining({ name: expect.any(Object), status: 1 }),
      ],
    }));
  });

  it('lists platform plans with enabled module feature bindings', async () => {
    planRepo.findAndCount.mockResolvedValue([[{ id: 1, code: 'pro', name: 'Pro', status: 1 }], 1]);
    quotaRepo.find.mockResolvedValue([]);
    planFeatureRepo.find.mockResolvedValue([
      { planId: 1, featureKey: 'crm', enabled: 1, remark: 'CRM' },
      { planId: 1, featureKey: 'analytics', enabled: 1 },
    ]);

    await expect(service.listPlatformPlans()).resolves.toMatchObject({
      list: [
        expect.objectContaining({
          code: 'pro',
          features: [
            { feature_key: 'crm', enabled: 1, remark: 'CRM' },
            { feature_key: 'analytics', enabled: 1, remark: undefined },
          ],
        }),
      ],
    });

    expect(planFeatureRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ enabled: 1 }),
    }));
  });

  it('returns platform plan detail with enabled module feature bindings', async () => {
    planRepo.findOne.mockResolvedValue({ id: 2, code: 'team', name: 'Team', status: 1 });
    quotaRepo.find.mockResolvedValue([]);
    planFeatureRepo.find.mockResolvedValue([{ planId: 2, featureKey: 'member_management', enabled: 1 }]);

    await expect(service.findPlatformPlan('team')).resolves.toMatchObject({
      code: 'team',
      features: [{ feature_key: 'member_management', enabled: 1, remark: undefined }],
    });
  });

  it('creates a platform plan with backend cents and validates duplicate code', async () => {
    planRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.createPlatformPlan({ code: 'team', name: 'Team', billing_cycle: 'monthly', price_monthly: 9900, price_yearly: 99000, status: 1, sort: 30 })).resolves.toMatchObject({ code: 'team' });

    expect(planRepo.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'team', priceMonthly: 9900, priceYearly: 99000 }));

    planRepo.findOne.mockResolvedValueOnce({ id: 1, code: 'team' });
    await expect(service.createPlatformPlan({ code: 'team', name: 'Team' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid plan code format', async () => {
    await expect(service.createPlatformPlan({ code: 'Team Plan', name: 'Team' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates editable plan fields without changing code', async () => {
    planRepo.findOne.mockResolvedValue({ id: 2, code: 'pro', name: 'Pro', status: 1 });

    await service.updatePlatformPlan('pro', { name: 'Pro Plus', price_monthly: 12900, status: 1 });

    expect(planRepo.save).toHaveBeenCalledWith(expect.objectContaining({ code: 'pro', name: 'Pro Plus', priceMonthly: 12900 }));
  });

  it('updates plan status', async () => {
    planRepo.findOne.mockResolvedValue({ id: 2, code: 'pro', status: 1 });

    await service.updatePlatformPlanStatus('pro', 0);

    expect(planRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 0 }));
  });

  it('replaces supported quotas for a plan', async () => {
    planRepo.findOne.mockResolvedValue({ id: 2, code: 'pro' });

    await service.updatePlatformPlanQuotas('pro', {
      quotas: [
        { quota_type: 'tokens', total_quota: 1000000 },
        { quota_type: 'storage_mb', total_quota: 10240 },
      ],
    });

    expect(quotaRepo.delete).toHaveBeenCalledWith({ planId: 2 });
    expect(quotaRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ planId: 2, quotaType: 'tokens', totalQuota: 1000000, status: 1 }),
      expect.objectContaining({ planId: 2, quotaType: 'storage_mb', totalQuota: 10240, status: 1 }),
    ]);
  });

  it('rejects unsupported quota types', async () => {
    planRepo.findOne.mockResolvedValue({ id: 2, code: 'pro' });

    await expect(service.updatePlatformPlanQuotas('pro', { quotas: [{ quota_type: 'bad', total_quota: 1 }] as any })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists tenant plans with only enabled plans and quotas', async () => {
    planRepo.find.mockResolvedValue([{ id: 2, code: 'pro', name: 'Pro', status: 1 }]);
    quotaRepo.find.mockResolvedValue([{ planId: 2, quotaType: 'tokens', totalQuota: 1000000, status: 1 }]);

    await expect(service.listTenantPlans()).resolves.toEqual([
      expect.objectContaining({ code: 'pro', quotas: [{ quota_type: 'tokens', total_quota: 1000000, status: 1, remark: undefined }] }),
    ]);

    expect(planRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 1 } }));
  });

  it('throws not found for missing platform plan detail', async () => {
    planRepo.findOne.mockResolvedValue(null);
    await expect(service.findPlatformPlan('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
