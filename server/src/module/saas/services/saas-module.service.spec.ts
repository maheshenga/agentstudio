import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SaasModuleEntity } from '../entities/saas-module.entity';
import { SaasPlanFeatureEntity } from '../entities/saas-plan-feature.entity';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasModuleService } from './saas-module.service';

describe('SaasModuleService', () => {
  let service: SaasModuleService;

  const moduleRepo = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const planRepo = {
    findOne: jest.fn(),
  };
  const planFeatureRepo = {
    delete: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };
  const transactionPlanFeatureRepo = {
    delete: jest.fn(),
    save: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(),
  };
  const subscriptionRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    moduleRepo.create.mockImplementation((value) => value);
    moduleRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 1, ...value }));
    planFeatureRepo.save.mockImplementation(async (value) => value);
    transactionPlanFeatureRepo.save.mockImplementation(async (value) => value);
    dataSource.transaction.mockImplementation((callback) =>
      callback({
        getRepository: jest.fn((entity) => {
          if (entity === SaasPlanFeatureEntity) return transactionPlanFeatureRepo;
          throw new Error('Unexpected transaction repository');
        }),
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasModuleService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(SaasModuleEntity), useValue: moduleRepo },
        { provide: getRepositoryToken(SaasPlanEntity), useValue: planRepo },
        { provide: getRepositoryToken(SaasPlanFeatureEntity), useValue: planFeatureRepo },
        { provide: getRepositoryToken(SaasSubscriptionEntity), useValue: subscriptionRepo },
      ],
    }).compile();

    service = module.get(SaasModuleService);
  });

  it('creates a platform module with a unique code and defaults status to 1', async () => {
    moduleRepo.findOne.mockResolvedValue(null);

    await expect(service.createPlatformModule({ code: 'crm', name: 'CRM', route_path: '/crm' })).resolves.toMatchObject({ code: 'crm', route_path: '/crm', status: 1 });

    expect(moduleRepo.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'crm', routePath: '/crm', status: 1, sort: 100 }));
  });

  it('rejects duplicate platform module code', async () => {
    moduleRepo.findOne.mockResolvedValue({ id: 1, code: 'crm' });

    await expect(service.createPlatformModule({ code: 'crm', name: 'CRM' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate platform module code even when the existing row is soft-deleted', async () => {
    moduleRepo.findOne.mockResolvedValue({ id: 1, code: 'crm', deleteTime: new Date() });

    await expect(service.createPlatformModule({ code: 'crm', name: 'CRM' })).rejects.toBeInstanceOf(BadRequestException);

    expect(moduleRepo.findOne).toHaveBeenCalledWith({ where: { code: 'crm' }, withDeleted: true });
  });

  it('updates platform module status and returns the updated object', async () => {
    moduleRepo.findOne.mockResolvedValue({ id: 2, code: 'crm', name: 'CRM', status: 1 });

    await expect(service.updatePlatformModuleStatus('crm', 0)).resolves.toMatchObject({ code: 'crm', status: 0 });

    expect(moduleRepo.save).toHaveBeenCalledWith(expect.objectContaining({ code: 'crm', status: 0 }));
  });

  it('replaces plan modules after validating the plan and enabled module codes', async () => {
    planRepo.findOne.mockResolvedValue({ id: 8, code: 'pro' });
    moduleRepo.find.mockResolvedValue([
      { id: 1, code: 'crm', name: 'CRM', status: 1 },
      { id: 2, code: 'analytics', name: 'Analytics', status: 1 },
    ]);

    await expect(service.updatePlanModules('pro', ['crm', 'analytics', 'crm'])).resolves.toEqual({
      code: 'pro',
      module_codes: ['crm', 'analytics'],
    });

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(transactionPlanFeatureRepo.delete).toHaveBeenCalledWith({ planId: 8 });
    expect(transactionPlanFeatureRepo.save).toHaveBeenCalledWith([
      { planId: 8, featureKey: 'crm', enabled: 1 },
      { planId: 8, featureKey: 'analytics', enabled: 1 },
    ]);
  });

  it('updates modules for an inactive non-deleted plan', async () => {
    planRepo.findOne.mockResolvedValue({ id: 8, code: 'legacy', status: 0 });
    moduleRepo.find.mockResolvedValue([{ id: 1, code: 'crm', name: 'CRM', status: 1 }]);

    await expect(service.updatePlanModules('legacy', ['crm'])).resolves.toEqual({
      code: 'legacy',
      module_codes: ['crm'],
    });

    expect(planRepo.findOne).toHaveBeenCalledWith({
      where: expect.not.objectContaining({ status: 1 }),
    });
  });

  it('lists tenant modules from the active subscription plan', async () => {
    subscriptionRepo.findOne.mockResolvedValue({ id: 10, tenantId: 12, planId: 8, status: 'active' });
    planFeatureRepo.find.mockResolvedValue([
      { planId: 8, featureKey: 'crm', enabled: 1 },
      { planId: 8, featureKey: 'analytics', enabled: 1 },
    ]);
    moduleRepo.find.mockResolvedValue([
      { id: 1, code: 'crm', name: 'CRM', status: 1 },
      { id: 2, code: 'analytics', name: 'Analytics', status: 1 },
    ]);

    await expect(service.listTenantModules(12)).resolves.toEqual([
      expect.objectContaining({ code: 'crm' }),
      expect.objectContaining({ code: 'analytics' }),
    ]);
  });

  it('rejects when a tenant plan has not enabled the requested module', async () => {
    subscriptionRepo.findOne.mockResolvedValue({ id: 10, tenantId: 12, planId: 8, status: 'active' });
    planFeatureRepo.find.mockResolvedValue([{ planId: 8, featureKey: 'crm', enabled: 1 }]);
    moduleRepo.find.mockResolvedValue([{ id: 1, code: 'crm', name: 'CRM', status: 1 }]);

    await expect(service.assertTenantModuleEnabled(12, 'analytics')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown plans when updating plan modules', async () => {
    planRepo.findOne.mockResolvedValue(null);

    await expect(service.updatePlanModules('missing', ['crm'])).rejects.toBeInstanceOf(NotFoundException);
  });
});
