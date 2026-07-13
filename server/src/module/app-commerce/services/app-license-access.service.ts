import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, MoreThan, Repository } from 'typeorm';

import { AppPackageEntity } from '../../app/entities/app-package.entity';
import { SAAS_SUBSCRIPTION_ACTIVE } from '../../saas/constants';
import { SaasPlanEntity } from '../../saas/entities/saas-plan.entity';
import { SaasSubscriptionEntity } from '../../saas/entities/saas-subscription.entity';
import { AppPricePlanEntity } from '../entities/app-price-plan.entity';
import { TenantAppLicenseEntity } from '../entities/tenant-app-license.entity';
import {
  AppPricePlanService,
  type TenantVisibleAppPricePlan,
} from './app-price-plan.service';

export type TenantAppCommerceAccessStatus =
  | 'legacy_free'
  | 'free'
  | 'included'
  | 'trialing'
  | 'licensed'
  | 'purchase_required'
  | 'expired'
  | 'revoked';

export type TenantAppCommerceAction =
  | 'install'
  | 'open'
  | 'start_trial'
  | 'purchase'
  | 'renew'
  | 'contact_admin';

export interface TenantAppCommerceAccess {
  commerce_enabled: boolean;
  access_status: TenantAppCommerceAccessStatus;
  can_install: boolean;
  can_open: boolean;
  action: TenantAppCommerceAction;
  license_expires_at: string | null;
  plans: TenantVisibleAppPricePlan[];
}

export type AppCommerceSubject = Pick<AppPackageEntity, 'id' | 'code'> & {
  installed?: boolean;
};

@Injectable()
export class AppLicenseAccessService {
  constructor(
    private readonly configService: ConfigService,
    private readonly pricePlanService: AppPricePlanService,
    @InjectRepository(TenantAppLicenseEntity)
    private readonly licenseRepo: Repository<TenantAppLicenseEntity>,
    @InjectRepository(SaasSubscriptionEntity)
    private readonly subscriptionRepo: Repository<SaasSubscriptionEntity>,
    @InjectRepository(SaasPlanEntity)
    private readonly saasPlanRepo: Repository<SaasPlanEntity>,
  ) {}

  async getAccessState(
    tenantId: number,
    app: AppCommerceSubject,
  ): Promise<TenantAppCommerceAccess> {
    const installed = Boolean(app.installed);
    if (!this.configService.get<boolean>('appMarketplace.commerce.enabled', false)) {
      return this.entitledAccess('legacy_free', installed, [], null, false);
    }

    const plans = await this.pricePlanService.listApplicablePlans(Number(app.id), Number(tenantId));
    const tenantPlans = this.pricePlanService.toTenantVisiblePlans(plans);
    if (plans.length === 0 || plans.some((plan) => plan.pricingModel === 'free')) {
      return this.evaluateAccess(plans, [], null, installed, tenantPlans);
    }
    const currentSaasPlanCode = plans.some((plan) => plan.pricingModel === 'included')
      ? await this.getCurrentSaasPlanCode(tenantId)
      : null;
    if (this.matchesIncludedPlan(plans, currentSaasPlanCode)) {
      return this.evaluateAccess(plans, [], currentSaasPlanCode, installed, tenantPlans);
    }
    const licenses = await this.loadLicenses(tenantId, [Number(app.id)]);
    return this.evaluateAccess(plans, licenses, currentSaasPlanCode, installed, tenantPlans);
  }

  async getAccessStates(
    tenantId: number,
    apps: AppCommerceSubject[],
  ): Promise<Map<number, TenantAppCommerceAccess>> {
    const subjects = [...new Map((apps || []).map((app) => [Number(app.id), app])).values()]
      .filter((app) => Number.isInteger(Number(app.id)) && Number(app.id) > 0);
    if (subjects.length === 0) return new Map();
    if (!this.configService.get<boolean>('appMarketplace.commerce.enabled', false)) {
      return new Map(
        subjects.map((app) => [
          Number(app.id),
          this.entitledAccess('legacy_free', Boolean(app.installed), [], null, false),
        ]),
      );
    }

    const plansByAppId = await this.pricePlanService.listApplicablePlansForApps(
      subjects.map((app) => Number(app.id)),
      Number(tenantId),
    );
    const hasIncludedPlans = [...plansByAppId.values()].some((plans) =>
      plans.some((plan) => plan.pricingModel === 'included'),
    );
    const currentSaasPlanCode = hasIncludedPlans
      ? await this.getCurrentSaasPlanCode(tenantId)
      : null;
    const licensedAppIds = subjects
      .filter((app) => {
        const plans = plansByAppId.get(Number(app.id)) || [];
        return (
          plans.length > 0 &&
          !plans.some((plan) => plan.pricingModel === 'free') &&
          !this.matchesIncludedPlan(plans, currentSaasPlanCode)
        );
      })
      .map((app) => Number(app.id));
    const licenses = licensedAppIds.length
      ? await this.loadLicenses(tenantId, licensedAppIds)
      : [];
    const licensesByAppId = new Map<number, TenantAppLicenseEntity[]>();
    for (const license of licenses) {
      const appLicenses = licensesByAppId.get(Number(license.appId)) || [];
      appLicenses.push(license);
      licensesByAppId.set(Number(license.appId), appLicenses);
    }

    return new Map(
      subjects.map((app) => {
        const appId = Number(app.id);
        const plans = plansByAppId.get(appId) || [];
        return [
          appId,
          this.evaluateAccess(
            plans,
            licensesByAppId.get(appId) || [],
            currentSaasPlanCode,
            Boolean(app.installed),
            this.pricePlanService.toTenantVisiblePlans(plans),
          ),
        ];
      }),
    );
  }

  private evaluateAccess(
    plans: AppPricePlanEntity[],
    licenses: TenantAppLicenseEntity[],
    currentSaasPlanCode: string | null,
    installed: boolean,
    tenantPlans: TenantVisibleAppPricePlan[],
  ): TenantAppCommerceAccess {
    if (plans.length === 0) {
      return this.entitledAccess('legacy_free', installed, tenantPlans);
    }
    if (plans.some((plan) => plan.pricingModel === 'free')) {
      return this.entitledAccess('free', installed, tenantPlans);
    }
    if (this.matchesIncludedPlan(plans, currentSaasPlanCode)) {
      return this.entitledAccess('included', installed, tenantPlans);
    }

    const now = new Date();
    const current = licenses.find((license) => this.isCurrentLicense(license, now));
    if (current) {
      return this.entitledAccess(
        current.status === 'trialing' ? 'trialing' : 'licensed',
        installed,
        tenantPlans,
        this.toIsoString(current.expiresAt),
      );
    }

    const historical = licenses.find((license) => this.isHistoricalDenial(license, now));
    if (historical) {
      if (historical.status === 'expired' || this.isExpiredByTime(historical, now)) {
        return this.deniedAccess(
          'expired',
          'renew',
          tenantPlans,
          this.toIsoString(historical.expiresAt),
        );
      }
      return this.deniedAccess(
        'revoked',
        'contact_admin',
        tenantPlans,
        this.toIsoString(historical.expiresAt),
      );
    }

    const hasTrial = plans.some(
      (plan) => ['subscription', 'one_time'].includes(plan.pricingModel) && Number(plan.trialDays) > 0,
    );
    return this.deniedAccess(
      'purchase_required',
      hasTrial ? 'start_trial' : 'purchase',
      tenantPlans,
    );
  }

  private async getCurrentSaasPlanCode(tenantId: number): Promise<string | null> {
    const now = new Date();
    const subscription = await this.subscriptionRepo.findOne({
      where: [
        {
          tenantId: Number(tenantId),
          status: SAAS_SUBSCRIPTION_ACTIVE,
          startTime: LessThanOrEqual(now),
          endTime: IsNull(),
        },
        {
          tenantId: Number(tenantId),
          status: SAAS_SUBSCRIPTION_ACTIVE,
          startTime: LessThanOrEqual(now),
          endTime: MoreThan(now),
        },
      ],
      order: { createTime: 'DESC', id: 'DESC' },
    });
    if (!subscription) return null;

    const saasPlan = await this.saasPlanRepo.findOne({
      where: { id: Number(subscription.planId), status: 1 },
    });
    return saasPlan?.code ? String(saasPlan.code).trim().toLowerCase() : null;
  }

  private matchesIncludedPlan(plans: AppPricePlanEntity[], currentCode: string | null) {
    if (!currentCode) return false;
    return plans.some((plan) =>
      (plan.includedPlanCodes || []).some(
        (code) => String(code).trim().toLowerCase() === currentCode,
      ),
    );
  }

  private loadLicenses(tenantId: number, appIds: number[]) {
    return this.licenseRepo.find({
      where: {
        tenantId: Number(tenantId),
        appId: In(appIds),
        status: In(['active', 'trialing', 'expired', 'revoked', 'refunded']),
      },
      order: { createTime: 'DESC', id: 'DESC' },
    });
  }

  private isCurrentLicense(license: TenantAppLicenseEntity, now: Date) {
    if (license.status !== 'active' && license.status !== 'trialing') return false;
    const effectiveAt = new Date(license.effectiveAt);
    if (Number.isNaN(effectiveAt.getTime()) || effectiveAt.getTime() > now.getTime()) return false;
    return !this.isExpiredByTime(license, now);
  }

  private isExpiredByTime(license: TenantAppLicenseEntity, now: Date) {
    if (!license.expiresAt) return false;
    const expiresAt = new Date(license.expiresAt);
    return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime();
  }

  private isHistoricalDenial(license: TenantAppLicenseEntity, now: Date) {
    return (
      ['expired', 'revoked', 'refunded'].includes(license.status) ||
      this.isExpiredByTime(license, now)
    );
  }

  private entitledAccess(
    accessStatus: Extract<
      TenantAppCommerceAccessStatus,
      'legacy_free' | 'free' | 'included' | 'trialing' | 'licensed'
    >,
    installed: boolean,
    plans: TenantVisibleAppPricePlan[],
    licenseExpiresAt: string | null = null,
    commerceEnabled = true,
  ): TenantAppCommerceAccess {
    return {
      commerce_enabled: commerceEnabled,
      access_status: accessStatus,
      can_install: true,
      can_open: true,
      action: installed ? 'open' : 'install',
      license_expires_at: licenseExpiresAt,
      plans,
    };
  }

  private deniedAccess(
    accessStatus: Extract<TenantAppCommerceAccessStatus, 'purchase_required' | 'expired' | 'revoked'>,
    action: Extract<TenantAppCommerceAction, 'start_trial' | 'purchase' | 'renew' | 'contact_admin'>,
    plans: TenantVisibleAppPricePlan[],
    licenseExpiresAt: string | null = null,
  ): TenantAppCommerceAccess {
    return {
      commerce_enabled: true,
      access_status: accessStatus,
      can_install: false,
      can_open: false,
      action,
      license_expires_at: licenseExpiresAt,
      plans,
    };
  }

  private toIsoString(value?: Date | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
}
