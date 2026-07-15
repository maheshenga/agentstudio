import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';

import { AppPackageEntity } from '../../app/entities/app-package.entity';
import { SAAS_SUBSCRIPTION_ACTIVE, SAAS_SUBSCRIPTION_TRIALING } from '../../saas/constants';
import { SaasPlanEntity } from '../../saas/entities/saas-plan.entity';
import { SaasModuleEntity } from '../../saas/entities/saas-module.entity';
import { SaasPlanFeatureEntity } from '../../saas/entities/saas-plan-feature.entity';
import { SaasSubscriptionEntity } from '../../saas/entities/saas-subscription.entity';
import { SystemModuleAccessService } from '../../system-module/services/system-module-access.service';
import { AppPricePlanEntity } from '../entities/app-price-plan.entity';
import { TenantAppLicenseEntity } from '../entities/tenant-app-license.entity';
import { AppLicenseAccessService } from './app-license-access.service';
import { AppPricePlanService } from './app-price-plan.service';

describe('AppLicenseAccessService', () => {
  let service: AppLicenseAccessService;

  const configService = { get: jest.fn() };
  const pricePlanService = {
    listApplicablePlans: jest.fn(),
    listApplicablePlansForApps: jest.fn(),
    toTenantVisiblePlans: jest.fn(),
  };
  const licenseRepo = { find: jest.fn() };
  const subscriptionRepo = { findOne: jest.fn() };
  const saasPlanRepo = { findOne: jest.fn() };
  const saasModuleRepo = { findOne: jest.fn() };
  const saasPlanFeatureRepo = { findOne: jest.fn() };
  const systemModuleAccessService = { assertModuleAccess: jest.fn() };
  const app = { id: 7, code: 'workflow', status: 'published', installed: false } as AppPackageEntity & {
    installed: boolean;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    configService.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'appMarketplace.commerce.enabled' ? true : fallback,
    );
    pricePlanService.listApplicablePlans.mockResolvedValue([]);
    pricePlanService.listApplicablePlansForApps.mockResolvedValue(new Map());
    pricePlanService.toTenantVisiblePlans.mockImplementation((plans: AppPricePlanEntity[]) =>
      plans.map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        pricing_model: plan.pricingModel,
        billing_period: plan.billingPeriod,
        amount_cents: plan.amountCents,
        currency: plan.currency,
        trial_days: plan.trialDays,
        sort: plan.sort,
      })),
    );
    licenseRepo.find.mockResolvedValue([]);
    subscriptionRepo.findOne.mockResolvedValue(null);
    saasPlanRepo.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppLicenseAccessService,
        { provide: ConfigService, useValue: configService },
        { provide: AppPricePlanService, useValue: pricePlanService },
        { provide: getRepositoryToken(TenantAppLicenseEntity), useValue: licenseRepo },
        { provide: getRepositoryToken(SaasSubscriptionEntity), useValue: subscriptionRepo },
        { provide: getRepositoryToken(SaasPlanEntity), useValue: saasPlanRepo },
        { provide: getRepositoryToken(SaasModuleEntity), useValue: saasModuleRepo },
        { provide: getRepositoryToken(SaasPlanFeatureEntity), useValue: saasPlanFeatureRepo },
        { provide: SystemModuleAccessService, useValue: systemModuleAccessService },
      ],
    }).compile();

    service = module.get(AppLicenseAccessService);
  });

  it('treats every app as legacy free while APP_COMMERCE_ENABLED is false', async () => {
    configService.get.mockReturnValue(false);

    await expect(service.getAccessState(23, app)).resolves.toMatchObject({
      commerce_enabled: false,
      access_status: 'legacy_free',
      can_install: true,
      can_open: true,
      action: 'install',
      plans: [],
    });

    expect(pricePlanService.listApplicablePlans).not.toHaveBeenCalled();
    expect(licenseRepo.find).not.toHaveBeenCalled();
  });

  it('keeps a published app with no active price plan legacy free', async () => {
    await expect(service.getAccessState(23, app)).resolves.toMatchObject({
      commerce_enabled: true,
      access_status: 'legacy_free',
      action: 'install',
    });
  });

  it('returns free access for an active free plan', async () => {
    pricePlanService.listApplicablePlans.mockResolvedValue([createPlan({ pricingModel: 'free' })]);

    await expect(service.getAccessState(23, app)).resolves.toMatchObject({
      access_status: 'free',
      can_install: true,
      can_open: true,
      action: 'install',
    });
  });

  it('loads marketplace commerce state with bounded plan and license queries', async () => {
    const freePlan = createPlan({ appId: 7, pricingModel: 'free' });
    const paidPlan = createPlan({ id: 2, appId: 8, code: 'paid_monthly' });
    pricePlanService.listApplicablePlansForApps.mockResolvedValue(
      new Map([
        [7, [freePlan]],
        [8, [paidPlan]],
      ]),
    );
    licenseRepo.find.mockResolvedValue([
      createLicense({
        id: 2,
        appId: 8,
        status: 'active',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      }),
    ]);

    const states = await service.getAccessStates(23, [
      { id: 7, code: 'free_tool', installed: false },
      { id: 8, code: 'paid_tool', installed: true },
    ]);

    expect(states.get(7)).toMatchObject({ access_status: 'free', action: 'install' });
    expect(states.get(8)).toMatchObject({ access_status: 'licensed', action: 'open' });
    expect(pricePlanService.listApplicablePlansForApps).toHaveBeenCalledTimes(1);
    expect(licenseRepo.find).toHaveBeenCalledTimes(1);
    expect(subscriptionRepo.findOne).not.toHaveBeenCalled();
  });

  it('keeps bulk included access only while the matching SaaS subscription is active', async () => {
    const includedPlan = createPlan({
      appId: 7,
      pricingModel: 'included',
      includedPlanCodes: ['pro'],
      amountCents: 0,
      developerShareBps: 0,
    });
    pricePlanService.listApplicablePlansForApps.mockResolvedValue(
      new Map([[7, [includedPlan]]]),
    );
    subscriptionRepo.findOne.mockResolvedValue({ tenantId: 23, planId: 5, status: 'active' });
    saasPlanRepo.findOne.mockResolvedValue({ id: 5, code: 'pro', status: 1 });

    await expect(
      service.getAccessStates(23, [{ id: 7, code: 'included_tool', installed: true }]),
    ).resolves.toEqual(
      new Map([[7, expect.objectContaining({ access_status: 'included', action: 'open' })]]),
    );

    subscriptionRepo.findOne.mockResolvedValue(null);
    await expect(
      service.getAccessStates(23, [{ id: 7, code: 'included_tool', installed: true }]),
    ).resolves.toEqual(
      new Map([[7, expect.objectContaining({ access_status: 'purchase_required' })]]),
    );
  });

  it('returns included access only for an active matching SaaS subscription plan code', async () => {
    const includedPlan = createPlan({ pricingModel: 'included', includedPlanCodes: ['pro'] });
    pricePlanService.listApplicablePlans.mockResolvedValue([includedPlan]);
    subscriptionRepo.findOne.mockResolvedValue({ tenantId: 23, planId: 5, status: 'active' });
    saasPlanRepo.findOne.mockResolvedValue({ id: 5, code: 'basic', status: 1 });

    await expect(service.getAccessState(23, app)).resolves.toMatchObject({
      access_status: 'purchase_required',
    });
    expect(subscriptionRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          expect.objectContaining({
            tenantId: 23,
            status: SAAS_SUBSCRIPTION_ACTIVE,
            startTime: expect.any(Object),
            endTime: IsNull(),
            deleteTime: IsNull(),
          }),
          expect.objectContaining({
            tenantId: 23,
            status: SAAS_SUBSCRIPTION_ACTIVE,
            startTime: expect.any(Object),
            endTime: expect.any(Object),
            deleteTime: IsNull(),
          }),
          expect.objectContaining({
            tenantId: 23,
            status: SAAS_SUBSCRIPTION_TRIALING,
            startTime: expect.any(Object),
            endTime: expect.any(Object),
            deleteTime: IsNull(),
          }),
        ],
      }),
    );

    saasPlanRepo.findOne.mockResolvedValue({ id: 5, code: 'pro', status: 1 });
    await expect(service.getAccessState(23, { ...app, installed: true })).resolves.toMatchObject({
      access_status: 'included',
      action: 'open',
    });
  });

  it('requires an active paid or trial license for paid-only applications', async () => {
    const paidPlan = createPlan({
      pricingModel: 'subscription',
      billingPeriod: 'monthly',
      amountCents: 9900,
      developerShareBps: 7000,
      trialDays: 7,
    });
    pricePlanService.listApplicablePlans.mockResolvedValue([paidPlan]);

    await expect(service.getAccessState(23, app)).resolves.toMatchObject({
      access_status: 'purchase_required',
      can_install: false,
      can_open: false,
      action: 'start_trial',
    });

    licenseRepo.find.mockResolvedValue([
      createLicense({ status: 'active', expiresAt: new Date('2099-01-01T00:00:00.000Z') }),
    ]);
    await expect(service.getAccessState(23, app)).resolves.toMatchObject({
      access_status: 'licensed',
      action: 'install',
      license_expires_at: '2099-01-01T00:00:00.000Z',
    });

    licenseRepo.find.mockResolvedValue([
      createLicense({ status: 'trialing', expiresAt: new Date('2099-02-01T00:00:00.000Z') }),
    ]);
    await expect(service.getAccessState(23, app)).resolves.toMatchObject({
      access_status: 'trialing',
      license_expires_at: '2099-02-01T00:00:00.000Z',
    });
  });

  it('maps historical expired and refunded or revoked licenses to actionable states', async () => {
    pricePlanService.listApplicablePlans.mockResolvedValue([
      createPlan({ pricingModel: 'one_time', amountCents: 29900, developerShareBps: 6000 }),
    ]);
    licenseRepo.find.mockResolvedValue([
      createLicense({ status: 'expired', expiresAt: new Date('2025-01-01T00:00:00.000Z') }),
    ]);

    await expect(service.getAccessState(23, app)).resolves.toMatchObject({
      access_status: 'expired',
      action: 'renew',
    });

    licenseRepo.find.mockResolvedValue([createLicense({ status: 'refunded' })]);
    await expect(service.getAccessState(23, app)).resolves.toMatchObject({
      access_status: 'revoked',
      action: 'contact_admin',
    });
  });

  it('rejects acquisition when the current SaaS subscription does not include the app SaaS module', async () => {
    subscriptionRepo.findOne.mockResolvedValue({ tenantId: 23, planId: 5, status: 'active' });
    saasModuleRepo.findOne.mockResolvedValue({ code: 'recruiting', status: 1 });
    saasPlanFeatureRepo.findOne.mockResolvedValue(null);

    await expect(
      service.assertAppAcquisitionAvailable(
        23,
        { ...app, saasModuleCode: 'recruiting' },
        'purchase',
      ),
    ).rejects.toThrow('Current plan has not enabled this module');

    expect(systemModuleAccessService.assertModuleAccess).not.toHaveBeenCalled();
  });

  it('does not treat soft-deleted or null-ended trialing subscriptions as current acquisition entitlement', async () => {
    subscriptionRepo.findOne.mockResolvedValue(null);
    saasModuleRepo.findOne.mockResolvedValue({ code: 'recruiting', status: 1 });

    await expect(
      service.assertAppAcquisitionAvailable(
        23,
        { ...app, saasModuleCode: 'recruiting' },
        'purchase',
      ),
    ).rejects.toThrow('Current plan has not enabled this module');

    const subscriptionQuery = subscriptionRepo.findOne.mock.calls.at(-1)?.[0];
    expect(subscriptionQuery).toEqual(expect.objectContaining({
      order: { createTime: 'DESC', id: 'DESC' },
    }));
    expect(subscriptionQuery.where).toEqual([
      expect.objectContaining({
        tenantId: 23,
        status: SAAS_SUBSCRIPTION_ACTIVE,
        endTime: IsNull(),
        deleteTime: IsNull(),
      }),
      expect.objectContaining({
        tenantId: 23,
        status: SAAS_SUBSCRIPTION_ACTIVE,
        endTime: expect.any(Object),
        deleteTime: IsNull(),
      }),
      expect.objectContaining({
        tenantId: 23,
        status: SAAS_SUBSCRIPTION_TRIALING,
        startTime: expect.any(Object),
        endTime: expect.any(Object),
        deleteTime: IsNull(),
      }),
    ]);
    expect(subscriptionQuery.where).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: SAAS_SUBSCRIPTION_TRIALING,
          endTime: IsNull(),
        }),
      ]),
    );
    expect(saasPlanFeatureRepo.findOne).not.toHaveBeenCalled();
  });

  it('checks the required system module with the required SaaS module before acquisition', async () => {
    subscriptionRepo.findOne.mockResolvedValue({ tenantId: 23, planId: 5, status: 'active' });
    saasModuleRepo.findOne.mockResolvedValue({ code: 'recruiting', status: 1 });
    saasPlanFeatureRepo.findOne.mockResolvedValue({ planId: 5, featureKey: 'recruiting', enabled: 1 });
    systemModuleAccessService.assertModuleAccess.mockRejectedValueOnce(
      new BadRequestException('Tenant has not enabled this module'),
    );

    await expect(
      service.assertAppAcquisitionAvailable(
        23,
        { ...app, saasModuleCode: 'recruiting', systemModuleCode: 'job_board' },
        'start_trial',
      ),
    ).rejects.toThrow('Tenant has not enabled this module');

    expect(systemModuleAccessService.assertModuleAccess).toHaveBeenCalledWith({
      tenantId: 23,
      moduleCode: 'job_board',
      requiredSaasModuleCode: 'recruiting',
    });
  });
});

function createPlan(overrides: Partial<AppPricePlanEntity> = {}): AppPricePlanEntity {
  return {
    id: 1,
    appId: 7,
    code: 'paid_plan',
    name: 'Paid plan',
    pricingModel: 'subscription',
    billingPeriod: 'monthly',
    amountCents: 9900,
    currency: 'CNY',
    trialDays: 0,
    developerShareBps: 7000,
    includedPlanCodes: [],
    saleScope: 'all',
    tenantIds: [],
    status: 1,
    sort: 100,
    ...overrides,
  };
}

function createLicense(overrides: Partial<TenantAppLicenseEntity> = {}): TenantAppLicenseEntity {
  return {
    id: 1,
    tenantId: 23,
    appId: 7,
    source: 'order',
    status: 'active',
    effectiveAt: new Date('2025-01-01T00:00:00.000Z'),
    expiresAt: null,
    revokeReason: '',
    ...overrides,
  };
}
