import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Like, Repository } from 'typeorm';

import { SAAS_PLAN_FREE } from '../constants';
import { CreateSaasPlanDto } from '../dto/create-saas-plan.dto';
import { UpdateSaasPlanQuotasDto } from '../dto/update-saas-plan-quotas.dto';
import { UpdateSaasPlanDto } from '../dto/update-saas-plan.dto';
import { SaasPlanFeatureEntity } from '../entities/saas-plan-feature.entity';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasPlanQuotaEntity } from '../entities/saas-plan-quota.entity';

export interface SaasPlanListQuery {
  page?: string | number;
  limit?: string | number;
  status?: string | number;
  keyword?: string;
}

const SUPPORTED_PLAN_QUOTA_TYPES = ['users', 'storage_mb', 'ai_calls', 'rag_documents', 'tokens'] as const;

@Injectable()
export class SaasPlanService {
  constructor(
    @InjectRepository(SaasPlanEntity)
    private readonly saasPlanRepo: Repository<SaasPlanEntity>,
    @InjectRepository(SaasPlanQuotaEntity)
    private readonly saasPlanQuotaRepo: Repository<SaasPlanQuotaEntity>,
    @InjectRepository(SaasPlanFeatureEntity)
    private readonly saasPlanFeatureRepo: Repository<SaasPlanFeatureEntity>,
  ) {}

  async getFreePlan(): Promise<SaasPlanEntity> {
    return this.getPlanByCode(SAAS_PLAN_FREE);
  }

  async getPlanByCode(planCode: string): Promise<SaasPlanEntity> {
    const plan = await this.saasPlanRepo.findOne({
      where: {
        code: planCode,
        status: 1,
      },
    });

    if (!plan) {
      if (planCode === SAAS_PLAN_FREE) {
        throw new Error('Free plan is not configured');
      }

      throw new Error(`Plan ${planCode} is not configured`);
    }

    return plan;
  }

  async listPlatformPlans(query: SaasPlanListQuery = {}) {
    const { page, limit, skip } = this.resolvePagination(query);
    const baseWhere: Record<string, unknown> = {};
    if (query.status !== undefined && query.status !== '') {
      baseWhere.status = Number(query.status);
    }
    const where = query.keyword
      ? [
          { ...baseWhere, code: Like(`%${query.keyword}%`) },
          { ...baseWhere, name: Like(`%${query.keyword}%`) },
        ]
      : baseWhere;

    const [plans, total] = await this.saasPlanRepo.findAndCount({
      where,
      order: { sort: 'ASC', id: 'ASC' },
      skip,
      take: limit,
    });

    return { list: await this.attachQuotas(plans), total, page, limit };
  }

  async listTenantPlans() {
    const plans = await this.saasPlanRepo.find({
      where: { status: 1 },
      order: { sort: 'ASC', id: 'ASC' },
    });

    return this.attachQuotas(plans);
  }

  async findPlatformPlan(code: string) {
    const plan = await this.saasPlanRepo.findOne({ where: { code } });
    if (!plan) {
      throw new NotFoundException(`Plan ${code} not found`);
    }

    return (await this.attachQuotas([plan]))[0];
  }

  async createPlatformPlan(dto: CreateSaasPlanDto) {
    this.assertPlanCode(dto.code);
    const existing = await this.saasPlanRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Plan ${dto.code} already exists`);
    }

    const plan = this.saasPlanRepo.create({
      code: dto.code,
      name: dto.name,
      billingCycle: dto.billing_cycle || 'monthly',
      priceMonthly: Number(dto.price_monthly || 0),
      priceYearly: Number(dto.price_yearly || 0),
      status: dto.status ?? 1,
      sort: dto.sort ?? 100,
      remark: dto.remark || '',
    });

    return this.toResponse(await this.saasPlanRepo.save(plan), []);
  }

  async updatePlatformPlan(code: string, dto: UpdateSaasPlanDto) {
    const plan = await this.saasPlanRepo.findOne({ where: { code } });
    if (!plan) {
      throw new NotFoundException(`Plan ${code} not found`);
    }

    if (dto.name !== undefined) plan.name = dto.name;
    if (dto.billing_cycle !== undefined) plan.billingCycle = dto.billing_cycle;
    if (dto.price_monthly !== undefined) plan.priceMonthly = Number(dto.price_monthly);
    if (dto.price_yearly !== undefined) plan.priceYearly = Number(dto.price_yearly);
    if (dto.status !== undefined) plan.status = Number(dto.status);
    if (dto.sort !== undefined) plan.sort = Number(dto.sort);
    if (dto.remark !== undefined) plan.remark = dto.remark;

    const saved = await this.saasPlanRepo.save(plan);
    return this.findPlatformPlan(saved.code);
  }

  async updatePlatformPlanStatus(code: string, status: number) {
    const plan = await this.saasPlanRepo.findOne({ where: { code } });
    if (!plan) {
      throw new NotFoundException(`Plan ${code} not found`);
    }

    plan.status = Number(status);
    const saved = await this.saasPlanRepo.save(plan);
    return this.findPlatformPlan(saved.code);
  }

  async updatePlatformPlanQuotas(code: string, dto: UpdateSaasPlanQuotasDto) {
    const plan = await this.saasPlanRepo.findOne({ where: { code } });
    if (!plan) {
      throw new NotFoundException(`Plan ${code} not found`);
    }

    for (const quota of dto.quotas) {
      this.assertQuotaType(quota.quota_type);
    }

    await this.saasPlanQuotaRepo.delete({ planId: plan.id });
    await this.saasPlanQuotaRepo.save(
      dto.quotas.map((quota) => ({
        planId: plan.id,
        quotaType: quota.quota_type,
        totalQuota: Number(quota.total_quota || 0),
        status: quota.status ?? 1,
        remark: quota.remark || '',
      })),
    );

    return this.findPlatformPlan(code);
  }

  private async attachQuotas(plans: SaasPlanEntity[]) {
    const planIds = plans.map((plan) => plan.id);
    const quotas = planIds.length
      ? await this.saasPlanQuotaRepo.find({ where: { planId: In(planIds) }, order: { id: 'ASC' } })
      : [];
    const features = planIds.length
      ? await this.saasPlanFeatureRepo.find({
          where: { planId: In(planIds), enabled: 1, deleteTime: IsNull() },
          order: { id: 'ASC' },
        })
      : [];

    return plans.map((plan) =>
      this.toResponse(
        plan,
        quotas.filter((quota) => Number(quota.planId) === Number(plan.id)),
        features.filter((feature) => Number(feature.planId) === Number(plan.id)),
      ),
    );
  }

  private toResponse(plan: Partial<SaasPlanEntity>, quotas: Partial<SaasPlanQuotaEntity>[] = [], features: Partial<SaasPlanFeatureEntity>[] = []) {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      billing_cycle: plan.billingCycle,
      price_monthly: Number(plan.priceMonthly) || 0,
      price_yearly: Number(plan.priceYearly) || 0,
      status: Number(plan.status) || 0,
      sort: Number(plan.sort) || 0,
      remark: plan.remark,
      create_time: plan.createTime,
      update_time: plan.updateTime,
      quotas: quotas.map((quota) => ({
        quota_type: quota.quotaType,
        total_quota: Number(quota.totalQuota) || 0,
        status: quota.status ?? 1,
        remark: quota.remark,
      })),
      features: features.map((feature) => ({
        feature_key: feature.featureKey,
        enabled: feature.enabled ?? 1,
        remark: feature.remark,
      })),
    };
  }

  private assertPlanCode(code: string) {
    if (!/^[a-z0-9_-]+$/.test(code)) {
      throw new BadRequestException('Plan code must use lowercase letters, numbers, underscore, or hyphen');
    }
  }

  private assertQuotaType(quotaType: string) {
    if (!SUPPORTED_PLAN_QUOTA_TYPES.includes(quotaType as (typeof SUPPORTED_PLAN_QUOTA_TYPES)[number])) {
      throw new BadRequestException(`Unsupported quota type ${quotaType}`);
    }
  }

  private resolvePagination(query: SaasPlanListQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    return { page, limit, skip: (page - 1) * limit };
  }
}
