import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import * as tenantUtils from '../../common/utils/tenant.util';
import { SaasPlanEntity } from './entities/saas-plan.entity';
import { SaasSubscriptionEntity } from './entities/saas-subscription.entity';
import { SaasTrialEntity } from './entities/saas-trial.entity';
import { SaasTenantController } from './saas-tenant.controller';
import { SaasQuotaService } from './services/saas-quota.service';

describe('SaasTenantController', () => {
  let controller: SaasTenantController;

  const saasSubscriptionRepo = {
    findOne: jest.fn(),
  };

  const saasPlanRepo = {
    findOne: jest.fn(),
  };

  const saasTrialRepo = {
    findOne: jest.fn(),
  };

  const saasQuotaService = {
    getTenantUsageSummary: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaasTenantController],
      providers: [
        {
          provide: getRepositoryToken(SaasSubscriptionEntity),
          useValue: saasSubscriptionRepo,
        },
        {
          provide: getRepositoryToken(SaasPlanEntity),
          useValue: saasPlanRepo,
        },
        {
          provide: getRepositoryToken(SaasTrialEntity),
          useValue: saasTrialRepo,
        },
        {
          provide: SaasQuotaService,
          useValue: saasQuotaService,
        },
      ],
    }).compile();

    controller = module.get(SaasTenantController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a tenant subscription summary with plan and trial fields', async () => {
    const subscriptionStart = new Date('2026-07-01T00:00:00.000Z');
    const subscriptionEnd = new Date('2027-07-01T00:00:00.000Z');
    const trialEnd = new Date('2026-07-15T00:00:00.000Z');

    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    saasSubscriptionRepo.findOne.mockResolvedValue({
      id: 9,
      tenantId: 88,
      planId: 3,
      billingCycle: 'yearly',
      status: 'active',
      startTime: subscriptionStart,
      endTime: subscriptionEnd,
    });
    saasPlanRepo.findOne.mockResolvedValue({
      id: 3,
      code: 'pro',
      name: 'Pro',
    });
    saasTrialRepo.findOne.mockResolvedValue({
      id: 19,
      tenantId: 88,
      subscriptionId: 9,
      status: 'trialing',
      endTime: trialEnd,
    });

    const result = await controller.subscription();

    expect(result.data).toEqual({
      tenant_id: 88,
      plan_id: 3,
      current_plan: 'pro',
      plan_name: 'Pro',
      subscription_status: 'active',
      billing_cycle: 'yearly',
      start_time: subscriptionStart,
      end_time: subscriptionEnd,
      trial_status: 'trialing',
      trial_end_time: trialEnd,
      is_trial_active: true,
    });
  });
});
