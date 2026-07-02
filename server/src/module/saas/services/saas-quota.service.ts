import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { SaasPlanQuotaEntity } from '../entities/saas-plan-quota.entity';
import { SaasTenantResourceEntity } from '../entities/saas-tenant-resource.entity';
import { SAAS_QUOTA_AI_CALLS, SAAS_QUOTA_TOKENS } from '../constants';

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

  async assertTenantQuotaAvailable(
    tenantId: number,
    resourceType: string,
    amount: number,
    message = '资源额度不足',
  ): Promise<void> {
    const normalizedAmount = Math.max(Number(amount || 0), 0);
    if (normalizedAmount <= 0) {
      return;
    }
    if (!tenantId) {
      throw new BadRequestException('缺少租户上下文');
    }

    const resource = await this.saasTenantResourceRepo.findOne({
      where: {
        tenantId,
        resourceType,
        status: 1,
      },
    });

    if (!resource) {
      throw new BadRequestException(message);
    }

    const totalQuota = Number(resource.totalQuota);
    if (totalQuota <= 0) {
      return;
    }

    const usedQuota = Number(resource.usedQuota);
    if (totalQuota - usedQuota < normalizedAmount) {
      throw new BadRequestException(message);
    }
  }

  async consumeTenantQuota(tenantId: number, resourceType: string, amount: number): Promise<void> {
    const normalizedAmount = Math.max(Number(amount || 0), 0);
    if (normalizedAmount <= 0) {
      return;
    }
    if (!tenantId) {
      throw new BadRequestException('缺少租户上下文');
    }

    await this.saasTenantResourceRepo.increment(
      {
        tenantId,
        resourceType,
        status: 1,
      },
      'usedQuota',
      normalizedAmount,
    );
  }

  async consumeAiUsage(tenantId: number, usage: { totalTokens?: number }): Promise<void> {
    const totalTokens = Math.max(Number(usage.totalTokens || 0), 0);

    await this.assertTenantQuotaAvailable(tenantId, SAAS_QUOTA_AI_CALLS, 1, 'AI 调用次数额度不足');
    await this.assertTenantQuotaAvailable(tenantId, SAAS_QUOTA_TOKENS, totalTokens, 'Token 额度不足');

    await this.consumeTenantQuota(tenantId, SAAS_QUOTA_AI_CALLS, 1);
    await this.consumeTenantQuota(tenantId, SAAS_QUOTA_TOKENS, totalTokens);
  }
}
