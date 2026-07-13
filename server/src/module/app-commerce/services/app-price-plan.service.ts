import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

import { AppPackageEntity } from '../../app/entities/app-package.entity';
import type {
  SaveAppPricePlanDto,
  UpdateAppPricePlanDto,
} from '../dto/app-price-plan.dto';
import {
  AppPricePlanEntity,
  type AppBillingPeriod,
  type AppPriceSaleScope,
  type AppPricingModel,
} from '../entities/app-price-plan.entity';

export interface TenantVisibleAppPricePlan {
  id: number;
  code: string;
  name: string;
  pricing_model: AppPricingModel;
  billing_period: AppBillingPeriod;
  amount_cents: number;
  currency: 'CNY';
  trial_days: number;
  sort: number;
}

type SavePlanInput = SaveAppPricePlanDto | (UpdateAppPricePlanDto & { code: string });

@Injectable()
export class AppPricePlanService {
  constructor(
    @InjectRepository(AppPackageEntity)
    private readonly appRepo: Repository<AppPackageEntity>,
    @InjectRepository(AppPricePlanEntity)
    private readonly planRepo: Repository<AppPricePlanEntity>,
  ) {}

  async listPlatformPlans(appCode: string) {
    const app = await this.findApp(appCode);
    const plans = await this.planRepo.find({
      where: { appId: app.id },
      order: { sort: 'ASC', id: 'ASC' },
    });
    return plans.map((plan) => this.toPlatformResponse(plan));
  }

  async listTenantPlans(appId: number, tenantId: number): Promise<TenantVisibleAppPricePlan[]> {
    return this.toTenantVisiblePlans(await this.listApplicablePlans(appId, tenantId));
  }

  async listApplicablePlans(appId: number, tenantId: number): Promise<AppPricePlanEntity[]> {
    const normalizedAppId = this.requirePositiveId(appId, 'Application');
    return (await this.listApplicablePlansForApps([normalizedAppId], tenantId)).get(normalizedAppId) || [];
  }

  async listApplicablePlansForApps(
    appIds: number[],
    tenantId: number,
  ): Promise<Map<number, AppPricePlanEntity[]>> {
    const normalizedAppIds = this.normalizePositiveIds(appIds, 'Application');
    if (normalizedAppIds.length === 0) return new Map();
    const plans = await this.planRepo.find({
      where: {
        appId: In(normalizedAppIds),
        status: 1,
      },
      order: { sort: 'ASC', id: 'ASC' },
    });
    const normalizedTenantId = this.requirePositiveId(tenantId, 'Tenant');
    const result = new Map<number, AppPricePlanEntity[]>(
      normalizedAppIds.map((appId) => [appId, []]),
    );
    for (const plan of plans) {
      if (Number(plan.status) !== 1) continue;
      if (
        plan.saleScope === 'selected_tenants' &&
        !this.normalizeTenantIds(plan.tenantIds).includes(normalizedTenantId)
      ) {
        continue;
      }
      const appId = Number(plan.appId);
      if (result.has(appId)) result.get(appId)?.push(plan);
    }
    return result;
  }

  toTenantVisiblePlans(plans: AppPricePlanEntity[]): TenantVisibleAppPricePlan[] {
    return plans.map((plan) => ({
      id: Number(plan.id),
      code: plan.code,
      name: plan.name,
      pricing_model: plan.pricingModel,
      billing_period: plan.billingPeriod,
      amount_cents: Number(plan.amountCents),
      currency: 'CNY',
      trial_days: Number(plan.trialDays) || 0,
      sort: Number(plan.sort) || 0,
    }));
  }

  async findTenantApp(appCode: string): Promise<AppPackageEntity> {
    const app = await this.findApp(appCode);
    const visibility = app.visibility || 'marketplace';
    if (
      app.status !== 'published' ||
      !['marketplace', 'tenant', 'platform'].includes(visibility)
    ) {
      throw new NotFoundException(`App ${appCode} is not available`);
    }
    return app;
  }

  async savePlan(
    appCode: string,
    dto: SavePlanInput,
    operatorId: number,
    targetPlanCode?: string,
  ) {
    this.requirePositiveId(operatorId, 'Operator');
    const app = await this.findApp(appCode);
    const requestedCode = this.normalizePlanCode(targetPlanCode || dto.code);
    const existing = targetPlanCode
      ? await this.planRepo.findOne({ where: { appId: app.id, code: requestedCode } })
      : null;

    if (targetPlanCode && !existing) {
      throw new NotFoundException(`Price plan ${requestedCode} not found`);
    }

    if (!targetPlanCode) {
      const duplicate = await this.planRepo.findOne({
        where: { appId: app.id, code: requestedCode },
      });
      if (duplicate) {
        throw new ConflictException(`Price plan ${requestedCode} already exists`);
      }
    }

    const normalized = this.normalizePlan(dto, existing || undefined, !existing);
    const plan = existing || this.planRepo.create({ appId: app.id, code: requestedCode });
    Object.assign(plan, normalized, { appId: app.id, code: requestedCode });

    return this.toPlatformResponse(await this.planRepo.save(plan));
  }

  async updateStatus(
    appCode: string,
    planCode: string,
    status: number,
    operatorId: number,
  ) {
    this.requirePositiveId(operatorId, 'Operator');
    if (status !== 0 && status !== 1) {
      throw new BadRequestException('Price plan status must be 0 or 1');
    }

    const app = await this.findApp(appCode);
    const normalizedCode = this.normalizePlanCode(planCode);
    const plan = await this.planRepo.findOne({
      where: { appId: app.id, code: normalizedCode },
    });
    if (!plan) {
      throw new NotFoundException(`Price plan ${normalizedCode} not found`);
    }

    plan.status = status;
    return this.toPlatformResponse(await this.planRepo.save(plan));
  }

  private async findApp(appCode: string): Promise<AppPackageEntity> {
    const normalizedCode = String(appCode || '').trim();
    const app = await this.appRepo.findOne({
      where: { code: normalizedCode, deleteTime: IsNull() },
    });
    if (!app) {
      throw new NotFoundException(`App ${normalizedCode} not found`);
    }
    return app;
  }

  private normalizePlan(
    dto: SavePlanInput,
    existing?: AppPricePlanEntity,
    requireExplicitPaidShare = false,
  ): Partial<AppPricePlanEntity> {
    const pricingModel = (dto.pricing_model ?? existing?.pricingModel) as AppPricingModel;
    const billingPeriod = (dto.billing_period ?? existing?.billingPeriod ?? 'none') as AppBillingPeriod;
    const amountCents = Number(dto.amount_cents ?? existing?.amountCents ?? 0);
    const trialDays = Number(dto.trial_days ?? existing?.trialDays ?? 0);
    const shareWasProvided = dto.developer_share_bps !== undefined || existing !== undefined;
    const developerShareBps = Number(
      dto.developer_share_bps ?? existing?.developerShareBps ?? 0,
    );
    const includedPlanCodes = this.normalizeIncludedPlanCodes(
      dto.included_plan_codes ?? existing?.includedPlanCodes ?? [],
    );
    const saleScope = (dto.sale_scope ?? existing?.saleScope ?? 'all') as AppPriceSaleScope;
    const tenantIds = this.normalizeTenantIds(dto.tenant_ids ?? existing?.tenantIds ?? []);
    const status = Number(dto.status ?? existing?.status ?? 1);
    const sort = Number(dto.sort ?? existing?.sort ?? 100);
    const name = String(dto.name ?? existing?.name ?? '').trim();

    if (!name || name.length > 100) {
      throw new BadRequestException('Price plan name is required and must not exceed 100 characters');
    }
    if (!['free', 'included', 'subscription', 'one_time'].includes(pricingModel)) {
      throw new BadRequestException('Unsupported application pricing model');
    }
    if (!['none', 'monthly', 'yearly'].includes(billingPeriod)) {
      throw new BadRequestException('Unsupported application billing period');
    }
    this.assertIntegerRange(amountCents, 0, 2_147_483_647, 'Amount cents');
    this.assertIntegerRange(trialDays, 0, 365, 'Trial days');
    this.assertIntegerRange(developerShareBps, 0, 10_000, 'Developer share basis points');
    this.assertIntegerRange(status, 0, 1, 'Price plan status');
    this.assertIntegerRange(sort, 0, 2_147_483_647, 'Price plan sort');

    const isFreeLike = pricingModel === 'free' || pricingModel === 'included';
    if (isFreeLike) {
      if (amountCents !== 0 || developerShareBps !== 0) {
        throw new BadRequestException('Free or included plans must have zero amount and developer share');
      }
      if (billingPeriod !== 'none') {
        throw new BadRequestException('Free or included plans must use billing period none');
      }
      if (trialDays !== 0) {
        throw new BadRequestException('Free or included plans cannot define a trial');
      }
    } else {
      if (amountCents <= 0) {
        throw new BadRequestException('Paid plans require a positive integer amount in cents');
      }
      if (requireExplicitPaidShare && !shareWasProvided) {
        throw new BadRequestException('Paid plans require explicit developer_share_bps');
      }
      if (pricingModel === 'subscription' && !['monthly', 'yearly'].includes(billingPeriod)) {
        throw new BadRequestException('Subscription plans must use monthly or yearly billing');
      }
      if (pricingModel === 'one_time' && billingPeriod !== 'none') {
        throw new BadRequestException('One-time plans must use billing period none');
      }
      if (includedPlanCodes.length > 0) {
        throw new BadRequestException('Paid plans cannot define included SaaS plan codes');
      }
    }

    if (pricingModel === 'included' && includedPlanCodes.length === 0) {
      throw new BadRequestException('Included plans require at least one SaaS plan code');
    }
    if (pricingModel === 'free' && includedPlanCodes.length > 0) {
      throw new BadRequestException('Free plans cannot define included SaaS plan codes');
    }
    if (!['all', 'selected_tenants'].includes(saleScope)) {
      throw new BadRequestException('Unsupported application price sale scope');
    }
    if (saleScope === 'selected_tenants' && tenantIds.length === 0) {
      throw new BadRequestException('Selected-tenant plans require at least one tenant id');
    }

    return {
      name,
      pricingModel,
      billingPeriod,
      amountCents,
      currency: 'CNY',
      trialDays,
      developerShareBps,
      includedPlanCodes,
      saleScope,
      tenantIds: saleScope === 'selected_tenants' ? tenantIds : [],
      status,
      sort,
    };
  }

  private normalizePlanCode(code: string) {
    const normalized = String(code || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{2,49}$/.test(normalized)) {
      throw new BadRequestException(
        'Price plan code must use 3-50 lowercase letters, numbers, or underscores',
      );
    }
    return normalized;
  }

  private normalizeIncludedPlanCodes(codes: string[]) {
    const values = [...new Set((codes || []).map((code) => String(code).trim().toLowerCase()))]
      .filter(Boolean);
    if (values.length > 100) {
      throw new BadRequestException('At most 100 included SaaS plan codes are allowed');
    }
    if (values.some((code) => !/^[a-z][a-z0-9_-]{1,49}$/.test(code))) {
      throw new BadRequestException('Included SaaS plan codes contain an invalid value');
    }
    return values;
  }

  private normalizeTenantIds(ids: number[]) {
    const values = [...new Set((ids || []).map(Number))];
    if (values.length > 1000) {
      throw new BadRequestException('At most 1000 selected tenants are allowed');
    }
    if (values.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new BadRequestException('Tenant ids must be positive integers');
    }
    return values.sort((left, right) => left - right);
  }

  private requirePositiveId(value: number, label: string) {
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized <= 0) {
      throw new BadRequestException(`${label} id is required`);
    }
    return normalized;
  }

  private normalizePositiveIds(values: number[], label: string) {
    const normalized = [...new Set((values || []).map(Number))];
    if (normalized.length === 0) return [];
    if (normalized.some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new BadRequestException(`${label} ids must be positive integers`);
    }
    return normalized;
  }

  private assertIntegerRange(value: number, min: number, max: number, label: string) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new BadRequestException(`${label} must be an integer from ${min} to ${max}`);
    }
  }

  private toPlatformResponse(plan: AppPricePlanEntity) {
    return {
      id: Number(plan.id),
      app_id: Number(plan.appId),
      code: plan.code,
      name: plan.name,
      pricing_model: plan.pricingModel,
      billing_period: plan.billingPeriod,
      amount_cents: Number(plan.amountCents),
      currency: 'CNY' as const,
      trial_days: Number(plan.trialDays) || 0,
      developer_share_bps: Number(plan.developerShareBps),
      included_plan_codes: this.normalizeIncludedPlanCodes(plan.includedPlanCodes || []),
      sale_scope: plan.saleScope,
      tenant_ids: this.normalizeTenantIds(plan.tenantIds || []),
      status: Number(plan.status),
      sort: Number(plan.sort) || 0,
      create_time: plan.createTime,
      update_time: plan.updateTime,
    };
  }
}
