import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { SaasPlanQuotaEntity } from '../entities/saas-plan-quota.entity';
import { SaasTenantResourceEntity } from '../entities/saas-tenant-resource.entity';

@Injectable()
export class SaasQuotaService {
  constructor(
    @InjectRepository(SaasPlanQuotaEntity)
    private readonly saasPlanQuotaRepo: Repository<SaasPlanQuotaEntity>,
    @InjectRepository(SaasTenantResourceEntity)
    private readonly saasTenantResourceRepo: Repository<SaasTenantResourceEntity>,
  ) {}

  async initializeTenantQuota(tenantId: number, planId: number, manager?: EntityManager): Promise<void> {
    const planQuotaRepo = this.resolvePlanQuotaRepo(manager);
    const tenantResourceRepo = this.resolveTenantResourceRepo(manager);

    const planQuotas = await planQuotaRepo.find({
      where: {
        planId,
        status: 1,
      },
      order: {
        id: 'ASC',
      },
    });

    if (planQuotas.length === 0) {
      return;
    }

    await tenantResourceRepo.upsert(
      planQuotas.map((item) => ({
        tenantId,
        resourceType: item.quotaType,
        totalQuota: Number(item.totalQuota),
        usedQuota: 0,
        status: 1,
      })),
      ['tenantId', 'resourceType'],
    );
  }

  private resolvePlanQuotaRepo(manager?: EntityManager) {
    return manager ? manager.getRepository(SaasPlanQuotaEntity) : this.saasPlanQuotaRepo;
  }

  private resolveTenantResourceRepo(manager?: EntityManager) {
    return manager ? manager.getRepository(SaasTenantResourceEntity) : this.saasTenantResourceRepo;
  }

  async getTenantUsageSummary(tenantId: number): Promise<Array<{ resource_type: string; quota: number; used: number; remaining: number }>> {
    const resources = await this.saasTenantResourceRepo.find({
      where: {
        tenantId,
        status: 1,
      },
      order: {
        id: 'ASC',
      },
    });

    return resources.map((item) => ({
      resource_type: item.resourceType,
      quota: Number(item.totalQuota),
      used: Number(item.usedQuota),
      remaining: Math.max(Number(item.totalQuota) - Number(item.usedQuota), 0),
    }));
  }
}
